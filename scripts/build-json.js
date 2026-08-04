import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const WIDGET_SCHEMAS = Object.freeze({
  hero: { file: "hero.json", fields: { title: "string", current: "number", target: "number", progress: "number", remaining: "number", focus: "string" } },
  coach: { file: "coach.json", fields: { date: "string", dateLabel: "string", focusSkill: "string", durationLabel: "string", mission: "string", metrics: "array" } },
  skills: { file: "skills.json", fields: { periodLabel: "string", skills: "array" } },
  goals: { file: "goals.json", fields: { currentLabel: "string", goals: "array" } },
  study: { file: "study.json", fields: { periodLabel: "string", hours: "number", minutes: "number", summary: "string", days: "array" } },
  forecast: { file: "forecast.json", fields: { score: "number", trendLabel: "string", summary: "string", history: "array" } },
  heatmap: { file: "heatmap.json", fields: { periodLabel: "string", studyLabel: "string", ratioLabel: "string", levels: "array" } },
  "rc-speed": { file: "rc-speed.json", fields: { totalLabel: "string", parts: "array" } },
  accuracy: { file: "accuracy.json", fields: { periodLabel: "string", parts: "array" } },
  streak: { file: "streak.json", fields: { icon: "string", days: "number", unitLabel: "string", bestLabel: "string" } },
});

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

function matchesType(value, expectedType) {
  if (expectedType === "array") return Array.isArray(value);
  return typeof value === expectedType;
}

export function validateWidgetData(name, data) {
  const schema = WIDGET_SCHEMAS[name];
  if (!schema) return [`Unknown widget data key: ${name}`];
  if (!isObject(data)) return [`${schema.file} must contain a JSON object`];

  return Object.entries(schema.fields).flatMap(([field, expectedType]) => {
    if (!(field in data)) return [`${schema.file} is missing ${field}`];
    if (!matchesType(data[field], expectedType)) {
      return [`${schema.file}.${field} must be ${expectedType}`];
    }
    return [];
  });
}

export function validateWidgetCollection(widgetData) {
  if (!isObject(widgetData)) return ["Widget data must be an object"];

  const errors = [];
  for (const name of Object.keys(WIDGET_SCHEMAS)) {
    if (!(name in widgetData)) {
      errors.push(`Missing widget data: ${name}`);
      continue;
    }
    errors.push(...validateWidgetData(name, widgetData[name]));
  }
  return errors;
}

export function buildWidgetData(snapshot) {
  if (!isObject(snapshot) || !isObject(snapshot.widgets)) {
    throw new Error("Normalized snapshot must contain a widgets object");
  }

  const errors = validateWidgetCollection(snapshot.widgets);
  if (errors.length) throw new Error(errors.join("\n"));

  return structuredClone(snapshot.widgets);
}

export async function readWidgetData(directory = "data") {
  const widgetData = {};

  for (const [name, schema] of Object.entries(WIDGET_SCHEMAS)) {
    const filePath = path.resolve(directory, schema.file);
    widgetData[name] = JSON.parse(await readFile(filePath, "utf8"));
  }

  return widgetData;
}

export async function writeWidgetData(widgetData, directory = "data") {
  const errors = validateWidgetCollection(widgetData);
  if (errors.length) throw new Error(errors.join("\n"));

  const outputDirectory = path.resolve(directory);
  await mkdir(outputDirectory, { recursive: true });

  for (const [name, schema] of Object.entries(WIDGET_SCHEMAS)) {
    const outputPath = path.join(outputDirectory, schema.file);
    const temporaryPath = `${outputPath}.${process.pid}.tmp`;
    const contents = `${JSON.stringify(widgetData[name], null, 2)}\n`;

    try {
      await writeFile(temporaryPath, contents, "utf8");
      await rename(temporaryPath, outputPath);
    } finally {
      await unlink(temporaryPath).catch(() => {});
    }
  }
}

function parseArguments(argumentsList) {
  const options = { check: false, input: "", output: "data" };

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

  if (!options.input) throw new Error("Building JSON requires --input <normalized-snapshot.json>");
  const snapshot = JSON.parse(await readFile(path.resolve(options.input), "utf8"));
  await writeWidgetData(buildWidgetData(snapshot), options.output);
  console.log(`Updated ${Object.keys(WIDGET_SCHEMAS).length} widget JSON files.`);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
