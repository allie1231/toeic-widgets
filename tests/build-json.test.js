import assert from "node:assert/strict";
import test from "node:test";
import { buildWidgetData, validateRawSnapshot, validateWidgetCollection } from "../scripts/build-json.js";

const record = (id, properties) => ({
  id,
  createdTime: "2026-08-04T00:00:00.000Z",
  lastEditedTime: "2026-08-04T00:00:00.000Z",
  properties,
});

const snapshot = (sources = {}) => ({
  schemaVersion: 2,
  source: "notion",
  generatedAt: "2026-08-05T01:00:00.000Z",
  sources: Object.assign({ goals: [], coach: [], skills: [], studyLog: [], wrongAnswers: [], mockTests: [] }, sources),
});

test("empty Notion sources produce complete, truthful onboarding payloads", () => {
  const widgets = buildWidgetData(snapshot());

  assert.equal(widgets.hero.current, null);
  assert.equal(widgets.hero.target, null);
  assert.equal(widgets.hero.dashboardSubtitle, "Add your current score in Goals to begin.");
  assert.equal(widgets.coach.mission, "No study data yet. Complete your first mock test.");
  assert.equal(widgets.skills.skills.length, 3);
  assert.equal(widgets.study.hours, 0);
  assert.equal(widgets.study.minutes, 0);
  assert.equal(widgets.study.days.length, 7);
  assert.equal(widgets.heatmap.levels.length, 56);
  assert.equal(widgets.heatmap.levels.every((level) => level === 0), true);
  assert.equal(widgets.accuracy.parts.length, 3);
  assert.equal(widgets.accuracy.parts.every((part) => part.accuracy === null), true);
  assert.equal(widgets["rc-speed"].parts.length, 3);
  assert.equal(widgets.streak.days, 0);
  assert.deepEqual(validateWidgetCollection(widgets), []);
  assert.equal(JSON.stringify(widgets).includes("undefined"), false);
  assert.equal(JSON.stringify(widgets).includes("NaN"), false);
});

test("builder derives every widget from normalized Notion records", () => {
  const widgets = buildWidgetData(snapshot({
    goals: [record("goal", { Goal: "900점", Current: 725, Target: 900, Progress: 0.806 })],
    skills: [record("skill", { Skill: "형용사", Category: "Grammar" })],
    wrongAnswers: [record("wrong", { 상태: "미해결", 위젯노출: true, Skill: ["skill"], 파트: "P5" })],
    coach: [record("coach", { Date: "2026-08-05", "Priority Skill": ["skill"], "Estimated Minutes": 25, "Review Due": 1, Mission: "형용사 오답을 복습합니다." })],
    studyLog: [
      record("study-1", { 일자: "2026-08-04", Duration: 30 }),
      record("study-2", { 일자: "2026-08-05", Duration: 45 }),
    ],
    mockTests: [record("mock", { 응시일: "2026-08-05", LC환산: 400, RC환산: 325, P5: 27, P6: 14, P7: 42, RC잔여시간: -2 })],
  }));

  assert.equal(widgets.hero.current, 725);
  assert.equal(widgets.hero.target, 900);
  assert.equal(widgets.hero.progress, 80.6);
  assert.equal(widgets.hero.dashboardSubtitle, "725 → 900 · Live progress from Notion");
  assert.equal(widgets.skills.skills[0].name, "형용사");
  assert.equal(widgets.study.hours, 1);
  assert.equal(widgets.study.minutes, 15);
  assert.equal(widgets.forecast.score, 725);
  assert.equal(widgets.accuracy.parts[0].accuracy, 90);
  assert.equal(widgets.streak.days, 2);
});

test("a current goal score is not presented as a forecast without a mock test", () => {
  const widgets = buildWidgetData(snapshot({
    goals: [record("goal", { Goal: "900점", Current: 725, Target: 900 })],
  }));

  assert.equal(widgets.forecast.score, null);
  assert.equal(widgets.forecast.trendLabel, "No mock tests yet");
});

test("raw snapshot validation rejects incomplete source collections", () => {
  const errors = validateRawSnapshot({ schemaVersion: 2, source: "notion", generatedAt: "bad", sources: {} });
  assert.ok(errors.some((error) => error.includes("generatedAt")));
  assert.ok(errors.some((error) => error.includes("studyLog")));
});
