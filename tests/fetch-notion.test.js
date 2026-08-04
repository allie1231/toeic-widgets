import assert from "node:assert/strict";
import test from "node:test";
import {
  NOTION_API_VERSION,
  fetchNotionSnapshot,
  getNotionConfig,
  simplifyPropertyValue,
  validateNotionConfig,
} from "../scripts/fetch-notion.js";

const sourceNames = ["goals", "coach", "skills", "studyLog", "wrongAnswers", "mockTests"];

test("getNotionConfig supports canonical variables and legacy database aliases", () => {
  const config = getNotionConfig({
    NOTION_TOKEN: "secret-token",
    NOTION_GOALS_DATA_SOURCE_ID: "goals",
    NOTION_COACH_DATA_SOURCE_ID: "coach",
    NOTION_SKILLS_DATA_SOURCE_ID: "skills",
    NOTION_STUDY_LOG_DATA_SOURCE_ID: "study",
    OABDAP_DB_ID: "wrong",
    MOEUK_DB_ID: "mock",
  });

  assert.equal(config.sources.wrongAnswers, "wrong");
  assert.equal(config.sources.mockTests, "mock");
  assert.deepEqual(validateNotionConfig(config), []);
});

test("simplifyPropertyValue normalizes values used by the builder", () => {
  assert.equal(simplifyPropertyValue({ type: "title", title: [{ plain_text: "900점" }] }), "900점");
  assert.equal(simplifyPropertyValue({ type: "select", select: { name: "P7" } }), "P7");
  assert.deepEqual(simplifyPropertyValue({ type: "relation", relation: [{ id: "skill-id" }] }), ["skill-id"]);
  assert.equal(simplifyPropertyValue({ type: "formula", formula: { type: "number", number: 0.8 } }), 0.8);
});

test("fetchNotionSnapshot paginates, normalizes, and never serializes the token", async () => {
  const requests = [];
  const config = {
    token: "secret-token",
    apiVersion: NOTION_API_VERSION,
    sources: Object.fromEntries(sourceNames.map((name) => [name, `${name}-source`])),
  };

  const fetchImpl = async (url, init) => {
    requests.push({ url, init });
    const body = JSON.parse(init.body);
    const isFirstGoalsPage = url.includes("goals-source") && !body.start_cursor;
    const id = url.match(/data_sources\/([^/]+)\/query/)?.[1];

    return new Response(JSON.stringify({
      object: "list",
      results: [{
        object: "page",
        id: `${id}-${body.start_cursor || "first"}`,
        created_time: "2026-08-05T00:00:00.000Z",
        last_edited_time: "2026-08-05T00:00:00.000Z",
        properties: {
          Name: { type: "title", title: [{ plain_text: id }] },
          Score: { type: "number", number: 725 },
        },
      }],
      has_more: isFirstGoalsPage,
      next_cursor: isFirstGoalsPage ? "next-page" : null,
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const snapshot = await fetchNotionSnapshot({
    config,
    fetchImpl,
    sleep: async () => {},
    now: () => new Date("2026-08-05T01:02:03.000Z"),
  });

  assert.equal(snapshot.sources.goals.length, 2);
  assert.equal(snapshot.sources.coach.length, 1);
  assert.equal(snapshot.sources.goals[0].properties.Score, 725);
  assert.equal(snapshot.generatedAt, "2026-08-05T01:02:03.000Z");
  assert.equal(JSON.stringify(snapshot).includes("secret-token"), false);
  assert.equal(requests.length, 7);
  assert.equal(requests[0].init.headers.Authorization, "Bearer secret-token");
});
