import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  WIDGET_SCHEMAS,
  buildWidgetData,
  readWidgetData,
  validateRawSnapshot,
  validateWidgetCollection,
} from "./build-json.js";

const ROOT = process.cwd();
const WIDGET_DIRECTORY = path.join(ROOT, "widgets");
const SHARED_STYLES = ["../assets/css/theme.css", "../assets/css/layout.css", "../assets/css/components.css"];
const SHARED_SCRIPTS = ["../assets/js/animation.js", "../assets/js/common.js"];
const LOCAL_REFERENCE = /(?:href|src|data-source)="([^"]+)"/g;
const HARDCODED_STUDY_VALUE = />[^<]*(?:\b\d{2,4}\s*(?:점|points?|minutes?|mins?|hours?|days?)|\d+(?:\.\d+)?%)[^<]*</i;
const WIDGET_PAGES = Object.freeze({
  hero: "hero",
  coach: "coach",
  "weak-skills": "skills",
  "study-time": "study",
  forecast: "forecast",
  heatmap: "heatmap",
  goals: "goals",
  accuracy: "accuracy",
  streak: "streak",
  "rc-speed": "rc-speed",
});

const isExternalReference = (reference) => /^(?:[a-z]+:|#)/i.test(reference);

async function checkReferences(filePath, contents, errors) {
  for (const match of contents.matchAll(LOCAL_REFERENCE)) {
    const reference = match[1];
    if (isExternalReference(reference)) continue;
    const cleanReference = reference.split(/[?#]/, 1)[0];
    const target = path.resolve(path.dirname(filePath), cleanReference);
    await access(target).catch(() => errors.push(`${path.relative(ROOT, filePath)} references missing ${reference}`));
  }
}

async function checkWidget(name, errors) {
  const filePath = path.join(WIDGET_DIRECTORY, `${name}.html`);
  const contents = await readFile(filePath, "utf8");

  await checkReferences(filePath, contents, errors);
  for (const style of SHARED_STYLES) {
    if (!contents.includes(`href="${style}"`)) errors.push(`${name}.html is missing ${style}`);
  }
  for (const script of SHARED_SCRIPTS) {
    if (!contents.includes(`src="${script}"`)) errors.push(`${name}.html is missing ${script}`);
  }
  if (/<style\b/i.test(contents)) errors.push(`${name}.html contains inline CSS`);
  if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(contents)) errors.push(`${name}.html contains inline JavaScript`);
  if (/\sstyle="/i.test(contents)) errors.push(`${name}.html contains an inline style attribute`);
  if (HARDCODED_STUDY_VALUE.test(contents)) errors.push(`${name}.html contains a hardcoded study value`);

  const dataKey = WIDGET_PAGES[name];
  const expectedSource = `../data/${WIDGET_SCHEMAS[dataKey].file}`;
  if (!contents.includes(`data-source="${expectedSource}"`)) {
    errors.push(`${name}.html must read ${expectedSource}`);
  }
}

export async function checkSite() {
  const errors = [];
  const widgetNames = Object.keys(WIDGET_PAGES);

  await Promise.all(widgetNames.map((name) => checkWidget(name, errors)));

  for (const page of ["index.html", "dashboard.html"]) {
    const filePath = path.join(ROOT, page);
    await checkReferences(filePath, await readFile(filePath, "utf8"), errors);
  }

  const widgetData = await readWidgetData(path.join(ROOT, "data"));
  errors.push(...validateWidgetCollection(widgetData));

  const rawSnapshot = JSON.parse(await readFile(path.join(ROOT, "raw.json"), "utf8"));
  errors.push(...validateRawSnapshot(rawSnapshot));

  if (!errors.length) {
    const rebuilt = buildWidgetData(rawSnapshot, { now: new Date(rawSnapshot.generatedAt) });
    for (const name of Object.keys(WIDGET_SCHEMAS)) {
      if (JSON.stringify(widgetData[name]) !== JSON.stringify(rebuilt[name])) {
        errors.push(`${WIDGET_SCHEMAS[name].file} is not synchronized with raw.json`);
      }
    }
  }

  if (Object.keys(WIDGET_SCHEMAS).length !== widgetNames.length) {
    errors.push("Widget page and data schema counts do not match");
  }

  if (errors.length) throw new Error(errors.join("\n"));
  return { pages: widgetNames.length + 2, dataFiles: Object.keys(WIDGET_SCHEMAS).length, sources: Object.keys(rawSnapshot.sources).length };
}

async function main() {
  const result = await checkSite();
  console.log(`Validated ${result.pages} pages, ${result.sources} Notion sources, and ${result.dataFiles} widget data files.`);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
