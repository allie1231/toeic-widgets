import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { WIDGET_SCHEMAS, readWidgetData, validateWidgetCollection } from "./build-json.js";

const ROOT = process.cwd();
const WIDGET_DIRECTORY = path.join(ROOT, "widgets");
const SHARED_STYLES = ["../assets/css/theme.css", "../assets/css/layout.css", "../assets/css/components.css"];
const SHARED_SCRIPTS = ["../assets/js/animation.js", "../assets/js/common.js"];
const LOCAL_REFERENCE = /(?:href|src|data-source)="([^"]+)"/g;

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
}

export async function checkSite() {
  const errors = [];
  const widgetNames = ["hero", "coach", "weak-skills", "study-time", "forecast", "heatmap", "goals", "accuracy", "streak", "rc-speed"];

  await Promise.all(widgetNames.map((name) => checkWidget(name, errors)));

  for (const page of ["index.html", "dashboard.html"]) {
    const filePath = path.join(ROOT, page);
    await checkReferences(filePath, await readFile(filePath, "utf8"), errors);
  }

  const widgetData = await readWidgetData(path.join(ROOT, "data"));
  errors.push(...validateWidgetCollection(widgetData));

  if (Object.keys(WIDGET_SCHEMAS).length !== widgetNames.length) {
    errors.push("Widget page and data schema counts do not match");
  }

  if (errors.length) throw new Error(errors.join("\n"));
  return { pages: widgetNames.length + 2, dataFiles: Object.keys(WIDGET_SCHEMAS).length };
}

async function main() {
  const result = await checkSite();
  console.log(`Validated ${result.pages} pages and ${result.dataFiles} widget data files.`);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
