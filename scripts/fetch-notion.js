import { pathToFileURL } from "node:url";

export const NOTION_API_VERSION = "2022-06-28";

export class NotionIntegrationPendingError extends Error {
  constructor() {
    super("Notion fetching is intentionally disabled until the API integration is implemented.");
    this.name = "NotionIntegrationPendingError";
  }
}

export function getNotionConfig(environment = process.env) {
  return {
    token: environment.NOTION_TOKEN || "",
    databaseId: environment.NOTION_DATABASE_ID || "",
    apiVersion: NOTION_API_VERSION,
  };
}

export function validateNotionConfig(config) {
  const missing = [];
  if (!config.token) missing.push("NOTION_TOKEN");
  if (!config.databaseId) missing.push("NOTION_DATABASE_ID");
  return missing;
}

/**
 * Future Notion adapter boundary.
 *
 * This function will eventually fetch source records and return a normalized
 * snapshot shaped as { schemaVersion, generatedAt, widgets }. It deliberately
 * performs no network request in Phase 3.
 */
export async function fetchNotionSnapshot() {
  throw new NotionIntegrationPendingError();
}

async function main() {
  const config = getNotionConfig();
  const missing = validateNotionConfig(config);

  if (missing.length) {
    throw new Error(`Missing future Notion configuration: ${missing.join(", ")}`);
  }

  await fetchNotionSnapshot({ config });
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
