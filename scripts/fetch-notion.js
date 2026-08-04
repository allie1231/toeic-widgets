import { pathToFileURL } from "node:url";
import { writeJsonAtomic } from "./json-file.js";

export const NOTION_API_VERSION = "2026-03-11";
export const NOTION_API_BASE_URL = "https://api.notion.com/v1";

export const NOTION_SOURCES = Object.freeze({
  goals: ["NOTION_GOALS_DATA_SOURCE_ID", "NOTION_GOALS_DATABASE_ID"],
  coach: ["NOTION_COACH_DATA_SOURCE_ID", "NOTION_COACH_DATABASE_ID"],
  skills: ["NOTION_SKILLS_DATA_SOURCE_ID", "NOTION_SKILLS_DATABASE_ID"],
  studyLog: ["NOTION_STUDY_LOG_DATA_SOURCE_ID", "NOTION_STUDY_LOG_DATABASE_ID"],
  wrongAnswers: ["NOTION_WRONG_ANSWERS_DATA_SOURCE_ID", "OABDAP_DB_ID"],
  mockTests: ["NOTION_MOCK_TESTS_DATA_SOURCE_ID", "MOEUK_DB_ID"],
});

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const firstEnvironmentValue = (environment, names) => names
  .map((name) => environment[name]?.trim())
  .find(Boolean) || "";

export function getNotionConfig(environment = process.env) {
  return {
    token: environment.NOTION_TOKEN?.trim() || "",
    apiVersion: environment.NOTION_API_VERSION?.trim() || NOTION_API_VERSION,
    sources: Object.fromEntries(
      Object.entries(NOTION_SOURCES).map(([name, variables]) => [name, firstEnvironmentValue(environment, variables)]),
    ),
  };
}

export function validateNotionConfig(config) {
  const missing = [];
  if (!config?.token) missing.push("NOTION_TOKEN");

  for (const [name, variables] of Object.entries(NOTION_SOURCES)) {
    if (!config?.sources?.[name]) missing.push(variables[0]);
  }

  return missing;
}

function richTextToPlainText(items) {
  if (!Array.isArray(items)) return "";
  return items.map((item) => item?.plain_text || item?.text?.content || "").join("");
}

function simplifyTypedValue(value) {
  if (!value || typeof value !== "object") return null;

  switch (value.type) {
    case "string":
      return value.string ?? null;
    case "number":
      return value.number ?? null;
    case "boolean":
      return value.boolean ?? null;
    case "date":
      return value.date?.start || null;
    case "array":
      return Array.isArray(value.array) ? value.array.map(simplifyPropertyValue) : [];
    case "incomplete":
    case "unsupported":
      return null;
    default:
      return value[value.type] ?? null;
  }
}

export function simplifyPropertyValue(property) {
  if (!property || typeof property !== "object") return null;

  switch (property.type) {
    case "title":
    case "rich_text":
      return richTextToPlainText(property[property.type]);
    case "number":
    case "checkbox":
    case "url":
    case "email":
    case "phone_number":
    case "created_time":
    case "last_edited_time":
      return property[property.type] ?? null;
    case "select":
    case "status":
      return property[property.type]?.name || null;
    case "multi_select":
      return (property.multi_select || []).map((option) => option.name);
    case "date":
      return property.date?.start || null;
    case "relation":
      return (property.relation || []).map((relation) => relation.id);
    case "formula":
      return simplifyTypedValue(property.formula);
    case "rollup":
      return simplifyTypedValue(property.rollup);
    case "people":
      return (property.people || []).map((person) => person.name || person.id);
    case "unique_id":
      return property.unique_id
        ? `${property.unique_id.prefix ? `${property.unique_id.prefix}-` : ""}${property.unique_id.number}`
        : null;
    default:
      return null;
  }
}

export function normalizeNotionPage(page) {
  return {
    id: page.id,
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
    properties: Object.fromEntries(
      Object.entries(page.properties || {}).map(([name, property]) => [name, simplifyPropertyValue(property)]),
    ),
  };
}

async function notionRequest(url, {
  token,
  apiVersion,
  body,
  fetchImpl,
  sleep,
  maxAttempts = 5,
}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Notion-Version": apiVersion,
      },
      body: JSON.stringify(body),
    });

    if (response.ok) return response.json();

    const retryable = response.status === 429 || response.status >= 500;
    if (retryable && attempt < maxAttempts) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Math.min(8000, 500 * (2 ** (attempt - 1)));
      await sleep(delay);
      continue;
    }

    const details = await response.json().catch(() => ({}));
    const message = typeof details.message === "string" ? `: ${details.message}` : "";
    throw new Error(`Notion request failed (${response.status})${message}`);
  }

  throw new Error("Notion request failed after all retry attempts");
}

export async function queryNotionDataSource(dataSourceId, {
  token,
  apiVersion = NOTION_API_VERSION,
  fetchImpl = globalThis.fetch,
  sleep = wait,
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("A Fetch API implementation is required");

  const records = [];
  let cursor;

  do {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;

    const response = await notionRequest(
      `${NOTION_API_BASE_URL}/data_sources/${encodeURIComponent(dataSourceId)}/query`,
      { token, apiVersion, body, fetchImpl, sleep },
    );

    records.push(...(response.results || []).filter((result) => result.object === "page"));
    cursor = response.has_more ? response.next_cursor : null;
  } while (cursor);

  return records;
}

export async function fetchNotionSnapshot({
  config = getNotionConfig(),
  fetchImpl = globalThis.fetch,
  sleep = wait,
  now = () => new Date(),
} = {}) {
  const missing = validateNotionConfig(config);
  if (missing.length) throw new Error(`Missing Notion configuration: ${missing.join(", ")}`);

  const sources = {};

  // Sequential queries stay below Notion's average request-rate limit and keep
  // retry behavior deterministic when a data source spans multiple pages.
  for (const [name, dataSourceId] of Object.entries(config.sources)) {
    const pages = await queryNotionDataSource(dataSourceId, {
      token: config.token,
      apiVersion: config.apiVersion,
      fetchImpl,
      sleep,
    });
    sources[name] = pages.map(normalizeNotionPage);
  }

  return {
    schemaVersion: 2,
    source: "notion",
    generatedAt: now().toISOString(),
    sources,
  };
}

function parseArguments(argumentsList) {
  const options = { output: "raw.json" };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--output") options.output = argumentsList[++index] || "";
    else throw new Error(`Unknown argument: ${argument}`);
  }

  if (!options.output) throw new Error("--output requires a file path");
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const snapshot = await fetchNotionSnapshot();
  await writeJsonAtomic(options.output, snapshot);

  const counts = Object.entries(snapshot.sources)
    .map(([name, records]) => `${name}=${records.length}`)
    .join(", ");
  console.log(`Wrote ${options.output} (${counts}).`);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
