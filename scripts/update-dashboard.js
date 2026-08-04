import { pathToFileURL } from "node:url";
import { buildWidgetData, writeWidgetData } from "./build-json.js";
import { fetchNotionSnapshot, getNotionConfig, validateNotionConfig } from "./fetch-notion.js";
import { writeJsonAtomic } from "./json-file.js";

export async function updateDashboard({
  environment = process.env,
  rawOutputPath = "raw.json",
  outputDirectory = "data",
  fetchSnapshot = fetchNotionSnapshot,
  writeRaw = writeJsonAtomic,
  writeData = writeWidgetData,
  now,
} = {}) {
  const config = getNotionConfig(environment);
  const missing = validateNotionConfig(config);
  if (missing.length) throw new Error(`Missing Notion configuration: ${missing.join(", ")}`);

  const snapshot = await fetchSnapshot({ config, now });
  const widgetData = buildWidgetData(snapshot, {
    timeZone: environment.WIDGET_TIME_ZONE || "Asia/Seoul",
    now: new Date(snapshot.generatedAt),
  });

  await writeRaw(rawOutputPath, snapshot);
  await writeData(widgetData, outputDirectory);

  return {
    updated: true,
    rawOutputPath,
    files: Object.keys(widgetData).length,
    sourceCounts: Object.fromEntries(
      Object.entries(snapshot.sources).map(([name, records]) => [name, records.length]),
    ),
  };
}

async function main() {
  const result = await updateDashboard();
  const counts = Object.entries(result.sourceCounts)
    .map(([name, count]) => `${name}=${count}`)
    .join(", ");
  console.log(`Dashboard data updated: ${result.files} widget files, ${result.rawOutputPath} (${counts}).`);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
