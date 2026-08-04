import { pathToFileURL } from "node:url";
import { buildWidgetData, writeWidgetData } from "./build-json.js";
import { fetchNotionSnapshot, getNotionConfig, validateNotionConfig } from "./fetch-notion.js";

export async function updateDashboard({
  environment = process.env,
  outputDirectory = "public/data",
  fetchSnapshot = fetchNotionSnapshot,
  writeData = writeWidgetData,
} = {}) {
  if (environment.NOTION_AUTOMATION_ENABLED !== "true") {
    return {
      updated: false,
      reason: "NOTION_AUTOMATION_ENABLED is not true",
    };
  }

  const config = getNotionConfig(environment);
  const missing = validateNotionConfig(config);
  if (missing.length) {
    throw new Error(`Missing Notion configuration: ${missing.join(", ")}`);
  }

  const snapshot = await fetchSnapshot({ config });
  const widgetData = buildWidgetData(snapshot);
  await writeData(widgetData, outputDirectory);

  return {
    updated: true,
    files: Object.keys(widgetData).length,
  };
}

async function main() {
  const result = await updateDashboard();

  if (!result.updated) {
    console.log(`Dashboard update skipped: ${result.reason}.`);
    return;
  }

  console.log(`Dashboard data updated: ${result.files} files.`);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
