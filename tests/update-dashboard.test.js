import assert from "node:assert/strict";
import test from "node:test";
import { updateDashboard } from "../scripts/update-dashboard.js";

const environment = {
  NOTION_TOKEN: "secret-token",
  NOTION_GOALS_DATA_SOURCE_ID: "goals",
  NOTION_COACH_DATA_SOURCE_ID: "coach",
  NOTION_SKILLS_DATA_SOURCE_ID: "skills",
  NOTION_STUDY_LOG_DATA_SOURCE_ID: "study",
  NOTION_WRONG_ANSWERS_DATA_SOURCE_ID: "wrong",
  NOTION_MOCK_TESTS_DATA_SOURCE_ID: "mock",
  WIDGET_TIME_ZONE: "Asia/Seoul",
};

test("updateDashboard writes the debug snapshot and all derived widget data", async () => {
  const calls = [];
  const snapshot = {
    schemaVersion: 2,
    source: "notion",
    generatedAt: "2026-08-05T01:00:00.000Z",
    sources: { goals: [], coach: [], skills: [], studyLog: [], wrongAnswers: [], mockTests: [] },
  };

  const result = await updateDashboard({
    environment,
    rawOutputPath: "raw.json",
    outputDirectory: "data",
    fetchSnapshot: async ({ config }) => {
      assert.equal(config.token, "secret-token");
      return snapshot;
    },
    writeRaw: async (path, value) => calls.push({ type: "raw", path, value }),
    writeData: async (value, path) => calls.push({ type: "widgets", path, value }),
  });

  assert.equal(result.files, 10);
  assert.equal(calls[0].type, "raw");
  assert.equal(calls[1].type, "widgets");
  assert.equal(calls[1].value.heatmap.levels.length, 56);
});
