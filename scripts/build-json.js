import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { writeJsonAtomic } from "./json-file.js";

export const SOURCE_KEYS = Object.freeze([
  "goals",
  "coach",
  "skills",
  "studyLog",
  "wrongAnswers",
  "mockTests",
]);

export const WIDGET_SCHEMAS = Object.freeze({
  hero: { file: "hero.json", fields: { title: "string", current: ["number", "null"], target: ["number", "null"], progress: "number", remainingLabel: "string", focus: "string", scoreAriaLabel: "string", progressAriaLabel: "string" } },
  coach: { file: "coach.json", fields: { date: "string", dateLabel: "string", focusSkill: "string", durationLabel: "string", mission: "string", metrics: "array" } },
  skills: { file: "skills.json", fields: { periodLabel: "string", skills: "array" } },
  goals: { file: "goals.json", fields: { currentLabel: "string", goals: "array" } },
  study: { file: "study.json", fields: { periodLabel: "string", hours: "number", minutes: "number", durationAriaLabel: "string", summary: "string", chartSummary: "string", days: "array" } },
  forecast: { file: "forecast.json", fields: { score: ["number", "null"], trendLabel: "string", summary: "string", history: "array", chartSummary: "string" } },
  heatmap: { file: "heatmap.json", fields: { periodLabel: "string", studyLabel: "string", ratioLabel: "string", summary: "string", levels: "array" } },
  "rc-speed": { file: "rc-speed.json", fields: { totalLabel: "string", parts: "array" } },
  accuracy: { file: "accuracy.json", fields: { periodLabel: "string", parts: "array" } },
  streak: { file: "streak.json", fields: { icon: "string", days: "number", unitLabel: "string", bestLabel: "string", ariaLabel: "string" } },
});

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const clamp = (value, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, value));
const round = (value, decimals = 0) => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);
const numberOrNull = (value) => isFiniteNumber(value) ? value : null;
const textOrEmpty = (value) => typeof value === "string" ? value.trim() : "";
const arrayOrEmpty = (value) => Array.isArray(value) ? value : [];
const property = (record, name) => record?.properties?.[name];

function matchesType(value, expectedType) {
  const types = Array.isArray(expectedType) ? expectedType : [expectedType];
  return types.some((type) => {
    if (type === "array") return Array.isArray(value);
    if (type === "null") return value === null;
    return typeof value === type;
  });
}

function findInvalidValue(value, pathLabel) {
  if (typeof value === "number" && !Number.isFinite(value)) return `${pathLabel} contains a non-finite number`;
  if (typeof value === "string" && /\b(?:undefined|NaN)\b/.test(value)) return `${pathLabel} contains an invalid display value`;

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const error = findInvalidValue(value[index], `${pathLabel}[${index}]`);
      if (error) return error;
    }
  } else if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      const error = findInvalidValue(child, `${pathLabel}.${key}`);
      if (error) return error;
    }
  }

  return "";
}

export function validateWidgetData(name, data) {
  const schema = WIDGET_SCHEMAS[name];
  if (!schema) return [`Unknown widget data key: ${name}`];
  if (!isObject(data)) return [`${schema.file} must contain a JSON object`];

  const errors = Object.entries(schema.fields).flatMap(([field, expectedType]) => {
    if (!(field in data)) return [`${schema.file} is missing ${field}`];
    if (!matchesType(data[field], expectedType)) {
      const label = Array.isArray(expectedType) ? expectedType.join(" or ") : expectedType;
      return [`${schema.file}.${field} must be ${label}`];
    }
    return [];
  });

  const invalid = findInvalidValue(data, schema.file);
  if (invalid) errors.push(invalid);
  return errors;
}

export function validateWidgetCollection(widgetData) {
  if (!isObject(widgetData)) return ["Widget data must be an object"];

  const errors = [];
  for (const name of Object.keys(WIDGET_SCHEMAS)) {
    if (!(name in widgetData)) errors.push(`Missing widget data: ${name}`);
    else errors.push(...validateWidgetData(name, widgetData[name]));
  }
  return errors;
}

export function validateRawSnapshot(snapshot) {
  const errors = [];
  if (!isObject(snapshot)) return ["raw.json must contain a JSON object"];
  if (snapshot.schemaVersion !== 2) errors.push("raw.json.schemaVersion must be 2");
  if (snapshot.source !== "notion") errors.push('raw.json.source must be "notion"');
  if (!textOrEmpty(snapshot.generatedAt) || Number.isNaN(Date.parse(snapshot.generatedAt))) {
    errors.push("raw.json.generatedAt must be an ISO-8601 timestamp");
  }
  if (!isObject(snapshot.sources)) return [...errors, "raw.json.sources must be an object"];

  for (const key of SOURCE_KEYS) {
    if (!Array.isArray(snapshot.sources[key])) {
      errors.push(`raw.json.sources.${key} must be an array`);
      continue;
    }
    snapshot.sources[key].forEach((record, index) => {
      if (!isObject(record) || !isObject(record.properties)) {
        errors.push(`raw.json.sources.${key}[${index}] must contain properties`);
      }
    });
  }
  return errors;
}

function dateKey(value, timeZone) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

const keyToDate = (key) => new Date(`${key}T00:00:00.000Z`);
const addDays = (key, count) => {
  const date = keyToDate(key);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
};
const differenceInDays = (later, earlier) => Math.round((keyToDate(later) - keyToDate(earlier)) / 86400000);

function formatDateLabel(key) {
  if (!key) return "Date not set";
  return key.replaceAll("-", ".");
}

function getCurrentAndTarget(goals) {
  const ordered = goals
    .map((record) => ({
      current: numberOrNull(property(record, "Current")),
      target: numberOrNull(property(record, "Target")),
      progress: numberOrNull(property(record, "Progress")),
      deadline: textOrEmpty(property(record, "Deadline")),
    }))
    .filter((goal) => goal.target !== null)
    .sort((left, right) => left.target - right.target);
  const current = ordered.map((goal) => goal.current).find((value) => value !== null) ?? null;
  const target = ordered.at(-1)?.target ?? null;
  return { ordered, current, target };
}

function goalProgress(goal, current) {
  if (goal.progress !== null) {
    return clamp(round(goal.progress <= 1 ? goal.progress * 100 : goal.progress));
  }
  if (current === null || !goal.target) return 0;
  return clamp(round((current / goal.target) * 100));
}

function indexSkills(records) {
  return new Map(records.map((record) => [record.id, {
    name: textOrEmpty(property(record, "Skill")) || "Unnamed skill",
    category: textOrEmpty(property(record, "Category")) || "Skill",
  }]));
}

function getVisibleWrongAnswers(records) {
  return records.filter((record) => property(record, "상태") !== "해결" && property(record, "위젯노출") === true);
}

function buildWeakSkills(records, skillIndex) {
  const counts = new Map();

  for (const record of records) {
    const relations = arrayOrEmpty(property(record, "Skill"));
    if (relations.length) {
      relations.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1));
    } else {
      const fallback = textOrEmpty(property(record, "오답유형"));
      if (fallback) counts.set(`label:${fallback}`, (counts.get(`label:${fallback}`) || 0) + 1);
    }
  }

  const ranked = [...counts.entries()]
    .map(([id, count]) => ({ id, count, name: id.startsWith("label:") ? id.slice(6) : skillIndex.get(id)?.name || "Linked skill" }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, "ko"))
    .slice(0, 3);
  const maximum = ranked[0]?.count || 1;

  if (!ranked.length) {
    return [
      { name: "No wrong answers recorded yet.", countLabel: "Start with one review", level: 0, ariaLabel: "No wrong answers recorded", progressAriaLabel: "Weak-skill data not available yet" },
      { name: "Add an item to Wrong Answers", countLabel: "Notion", level: 0, ariaLabel: "Add an item to the Wrong Answers database", progressAriaLabel: "Onboarding step" },
      { name: "Link it to a Skill", countLabel: "Notion", level: 0, ariaLabel: "Link the wrong answer to a skill", progressAriaLabel: "Onboarding step" },
    ];
  }

  return ranked.map(({ name, count }) => {
    const level = round((count / maximum) * 100);
    return {
      name,
      countLabel: `${count}회`,
      level,
      ariaLabel: `${name} 오답 ${count}회`,
      progressAriaLabel: `${name} 상대 취약도 ${level}%`,
    };
  });
}

function latestRecord(records, propertyName) {
  return [...records].sort((left, right) => {
    const leftValue = textOrEmpty(property(left, propertyName)) || left.lastEditedTime || "";
    const rightValue = textOrEmpty(property(right, propertyName)) || right.lastEditedTime || "";
    return rightValue.localeCompare(leftValue);
  })[0] || null;
}

function buildCoach(records, skillIndex, visibleWrongAnswers, today) {
  const coach = latestRecord(records, "Date");
  if (!coach) {
    return {
      date: today,
      dateLabel: formatDateLabel(today),
      focusSkill: "Ready when you are",
      durationLabel: "—",
      mission: "No study data yet. Complete your first mock test.",
      metrics: [
        { label: "Review", value: "No items" },
        { label: "Pace", value: "Not measured" },
        { label: "Focus", value: "Choose a skill" },
      ],
    };
  }

  const focusId = arrayOrEmpty(property(coach, "Priority Skill"))[0];
  const focus = skillIndex.get(focusId);
  const minutes = numberOrNull(property(coach, "Estimated Minutes"));
  const reviewDue = numberOrNull(property(coach, "Review Due")) ?? visibleWrongAnswers.length;
  const paceDelta = numberOrNull(property(coach, "Pace Delta"));
  const wrongPart = textOrEmpty(property(visibleWrongAnswers[0], "파트"));
  const date = textOrEmpty(property(coach, "Date")) || today;

  return {
    date,
    dateLabel: formatDateLabel(date),
    focusSkill: focus?.name || "Choose a priority skill",
    durationLabel: minutes === null ? "Time not set" : `${minutes} min`,
    mission: textOrEmpty(property(coach, "Mission")) || "Add today's mission in Coach State.",
    metrics: [
      { label: "Review", value: reviewDue ? `${reviewDue}문제` : "No items" },
      { label: "Pace", value: paceDelta === null ? "수집 중" : `${paceDelta > 0 ? "+" : ""}${paceDelta}분` },
      { label: "Focus", value: wrongPart || focus?.category || "Choose a skill" },
    ],
  };
}

function mondayFor(key) {
  const date = keyToDate(key);
  const day = date.getUTCDay();
  return addDays(key, -(day === 0 ? 6 : day - 1));
}

function studyMinutesByDate(records) {
  const minutes = new Map();
  for (const record of records) {
    const key = textOrEmpty(property(record, "일자"));
    const duration = numberOrNull(property(record, "Duration"));
    if (!key || duration === null || duration <= 0) continue;
    minutes.set(key, (minutes.get(key) || 0) + duration);
  }
  return minutes;
}

function buildStudy(records, today) {
  const labels = ["월", "화", "수", "목", "금", "토", "일"];
  const start = mondayFor(today);
  const minutesByDate = studyMinutesByDate(records);
  const values = labels.map((_, index) => minutesByDate.get(addDays(start, index)) || 0);
  const total = values.reduce((sum, value) => sum + value, 0);
  const maximum = Math.max(...values, 0);
  const days = labels.map((label, index) => ({
    label,
    percent: maximum ? round((values[index] / maximum) * 100) : 0,
  }));
  const activeDays = values.filter((value) => value > 0).length;

  return {
    periodLabel: "This week",
    hours: Math.floor(total / 60),
    minutes: Math.round(total % 60),
    durationAriaLabel: total ? `${Math.floor(total / 60)}시간 ${Math.round(total % 60)}분` : "이번 주 학습 시간 0분",
    summary: total ? `${activeDays}일 학습 · 총 ${Math.round(total)}분` : "0 min this week · 학습 로그를 추가해 주세요.",
    chartSummary: total ? `이번 주 ${activeDays}일 동안 ${Math.round(total)}분 학습했습니다.` : "이번 주 학습 기록이 아직 없습니다.",
    days,
  };
}

function heatLevel(minutes) {
  if (minutes <= 0) return 0;
  if (minutes <= 15) return 1;
  if (minutes <= 30) return 2;
  if (minutes <= 60) return 3;
  return 4;
}

function buildHeatmap(records, today) {
  const minutesByDate = studyMinutesByDate(records);
  const start = addDays(today, -55);
  const levels = Array.from({ length: 56 }, (_, index) => heatLevel(minutesByDate.get(addDays(start, index)) || 0));
  const studiedDays = levels.filter((level) => level > 0).length;
  const ratio = round((studiedDays / 56) * 100);
  return {
    periodLabel: "최근 8주",
    studyLabel: studiedDays ? `${studiedDays}일 학습` : "학습 기록 없음",
    ratioLabel: `56일 중 ${ratio}%`,
    summary: studiedDays ? `최근 8주 동안 총 ${studiedDays}일 학습했습니다.` : "학습 로그를 추가하면 이곳에 활동이 표시됩니다.",
    levels,
  };
}

function computeStreak(records, today) {
  const active = [...studyMinutesByDate(records).keys()].sort();
  if (!active.length) return { current: 0, best: 0 };

  let best = 1;
  let run = 1;
  for (let index = 1; index < active.length; index += 1) {
    run = differenceInDays(active[index], active[index - 1]) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }

  const last = active.at(-1);
  let current = 0;
  if (last === today || last === addDays(today, -1)) {
    current = 1;
    for (let index = active.length - 1; index > 0; index -= 1) {
      if (differenceInDays(active[index], active[index - 1]) !== 1) break;
      current += 1;
    }
  }

  return { current, best };
}

function mockScore(record) {
  const formulaScore = numberOrNull(property(record, "총점"));
  if (formulaScore !== null) return formulaScore;
  const lc = numberOrNull(property(record, "LC환산"));
  const rc = numberOrNull(property(record, "RC환산"));
  return lc === null && rc === null ? null : (lc || 0) + (rc || 0);
}

function orderedMocks(records) {
  return records
    .map((record) => ({ record, date: textOrEmpty(property(record, "응시일")), score: mockScore(record) }))
    .filter((entry) => entry.date)
    .sort((left, right) => left.date.localeCompare(right.date));
}

function buildForecast(records, currentScore) {
  const mocks = orderedMocks(records).filter((entry) => entry.score !== null);
  const history = mocks.map((entry) => entry.score);
  const score = history.at(-1) ?? currentScore;
  const trend = history.length > 1 ? history.at(-1) - history[0] : null;
  return {
    score,
    trendLabel: trend === null ? (history.length ? "1 test recorded" : "No mock tests yet") : `${trend >= 0 ? "+" : ""}${trend} trend`,
    summary: history.length ? "최근 모의고사 기준 · 예상 점수" : "Complete your first mock test to start a forecast.",
    history,
    chartSummary: history.length > 1 ? `최근 ${history.length}회 모의고사 점수 추이입니다.` : "점수 추이를 표시하려면 모의고사 기록이 더 필요합니다.",
  };
}

function buildAccuracy(records) {
  const latest = orderedMocks(records).at(-1)?.record || null;
  const definitions = [{ name: "P5", maximum: 30 }, { name: "P6", maximum: 16 }, { name: "P7", maximum: 54 }];
  return {
    periodLabel: latest ? "Last test" : "No mock test yet",
    parts: definitions.map(({ name, maximum }) => {
      const correct = latest ? numberOrNull(property(latest, name)) : null;
      const accuracy = correct === null ? null : clamp(round((correct / maximum) * 100));
      return {
        name,
        accuracy,
        ariaLabel: accuracy === null ? `${name} 정답률 기록 없음` : `${name} 정답률 ${accuracy}%`,
      };
    }),
  };
}

function formatMinutes(value) {
  if (!isFiniteNumber(value)) return "—";
  const minutes = Math.max(0, value);
  const whole = Math.floor(minutes);
  const seconds = Math.round((minutes - whole) * 60);
  return `${whole}:${String(seconds).padStart(2, "0")}`;
}

function speedStatus(part, minutes) {
  if (minutes === null) return { status: "Add time in Notion", tone: "neutral" };
  const targets = { P5: 10, P6: 8, P7: 57 };
  const target = targets[part];
  if (minutes <= target) return { status: "On pace", tone: "success" };
  return { status: "Need pace", tone: "warning" };
}

function buildRcSpeed(records) {
  const latest = orderedMocks(records).at(-1)?.record || null;
  const remaining = latest ? numberOrNull(property(latest, "RC잔여시간")) : null;
  const definitions = [
    { name: "P5", fields: ["P5 시간", "P5 Time"] },
    { name: "P6", fields: ["P6 시간", "P6 Time"] },
    { name: "P7", fields: ["P7 시간", "P7 Time"] },
  ];
  const parts = definitions.map(({ name, fields }) => {
    const minutes = latest
      ? fields.map((field) => numberOrNull(property(latest, field))).find((value) => value !== null) ?? null
      : null;
    const { status, tone } = speedStatus(name, minutes);
    return {
      name,
      time: formatMinutes(minutes),
      status,
      tone,
      ariaLabel: minutes === null ? `${name} 풀이 시간 기록 없음` : `${name} 풀이 시간 ${formatMinutes(minutes)}`,
    };
  });

  return {
    totalLabel: remaining === null ? "No timing data yet" : `RC ${Math.max(0, 75 - remaining)} min used`,
    parts,
  };
}

export function buildWidgetData(snapshot, {
  timeZone = "Asia/Seoul",
  now = new Date(snapshot?.generatedAt || Date.now()),
} = {}) {
  const rawErrors = validateRawSnapshot(snapshot);
  if (rawErrors.length) throw new Error(rawErrors.join("\n"));

  const today = dateKey(now, timeZone);
  const sources = snapshot.sources;
  const skillIndex = indexSkills(sources.skills);
  const visibleWrongAnswers = getVisibleWrongAnswers(sources.wrongAnswers);
  const { ordered: goals, current, target } = getCurrentAndTarget(sources.goals);
  const coach = buildCoach(sources.coach, skillIndex, visibleWrongAnswers, today);
  const progress = current !== null && target ? clamp(round((current / target) * 100, 1)) : 0;
  const streak = computeStreak(sources.studyLog, today);

  const widgetData = {
    hero: {
      title: target ? `TOEIC ${target} Project` : "TOEIC Goal Project",
      current,
      target,
      progress,
      remainingLabel: current !== null && target !== null ? `${Math.max(0, target - current)} points left` : "Add Current and Target in Goals",
      focus: coach.focusSkill === "Ready when you are" ? "Set your focus" : `${coach.focusSkill} Focus`,
      scoreAriaLabel: current === null ? `현재 점수 미입력, 목표 점수 ${target ?? "미입력"}` : `현재 점수 ${current}점, 목표 점수 ${target ?? "미입력"}점`,
      progressAriaLabel: current === null || target === null ? "목표 점수 진행률을 계산할 데이터가 없습니다" : `목표 점수 진행률 ${progress}%`,
    },
    coach,
    skills: {
      periodLabel: visibleWrongAnswers.length ? "최근 오답" : "Getting started",
      skills: buildWeakSkills(visibleWrongAnswers, skillIndex),
    },
    goals: {
      currentLabel: current === null ? "Current score —" : `${current} current`,
      goals: goals.length
        ? goals.map((goal) => {
          const value = goalProgress(goal, current);
          return { target: goal.target, progress: value, percentLabel: `${value}%`, ariaLabel: `${goal.target}점 목표 ${value}%` };
        })
        : Array.from({ length: 4 }, (_, index) => ({
          target: "—",
          progress: 0,
          percentLabel: index === 0 ? "Add goals in Notion" : "—",
          ariaLabel: "목표 점수 기록 없음",
        })),
    },
    study: buildStudy(sources.studyLog, today),
    forecast: buildForecast(sources.mockTests, current),
    heatmap: buildHeatmap(sources.studyLog, today),
    "rc-speed": buildRcSpeed(sources.mockTests),
    accuracy: buildAccuracy(sources.mockTests),
    streak: {
      icon: streak.current ? "🔥" : "🌱",
      days: streak.current,
      unitLabel: "days",
      bestLabel: streak.best ? `최고 기록 ${streak.best}일` : "첫 학습을 기록하면 스트릭이 시작됩니다.",
      ariaLabel: streak.current ? `현재 ${streak.current}일 연속 학습 중이며 최고 기록은 ${streak.best}일입니다.` : "연속 학습 기록이 아직 없습니다.",
    },
  };

  const errors = validateWidgetCollection(widgetData);
  if (errors.length) throw new Error(errors.join("\n"));
  return widgetData;
}

export async function readWidgetData(directory = "data") {
  const widgetData = {};
  for (const [name, schema] of Object.entries(WIDGET_SCHEMAS)) {
    widgetData[name] = JSON.parse(await readFile(path.resolve(directory, schema.file), "utf8"));
  }
  return widgetData;
}

export async function writeWidgetData(widgetData, directory = "data") {
  const errors = validateWidgetCollection(widgetData);
  if (errors.length) throw new Error(errors.join("\n"));

  for (const [name, schema] of Object.entries(WIDGET_SCHEMAS)) {
    await writeJsonAtomic(path.join(directory, schema.file), widgetData[name]);
  }
}

function parseArguments(argumentsList) {
  const options = { check: false, input: "raw.json", output: "data" };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--check") options.check = true;
    else if (argument === "--input") options.input = argumentsList[++index] || "";
    else if (argument === "--output") options.output = argumentsList[++index] || "";
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.output) throw new Error("--output requires a directory");
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.check) {
    const widgetData = await readWidgetData(options.output);
    const errors = validateWidgetCollection(widgetData);
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(`Validated ${Object.keys(WIDGET_SCHEMAS).length} widget JSON files.`);
    return;
  }

  const snapshot = JSON.parse(await readFile(path.resolve(options.input), "utf8"));
  await writeWidgetData(buildWidgetData(snapshot), options.output);
  console.log(`Updated ${Object.keys(WIDGET_SCHEMAS).length} widget JSON files from ${options.input}.`);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
