# Notion Sync

Notion is the single source of truth for every study value displayed by TOEIC Widgets. The repository stores a normalized debug snapshot in `raw.json` and derives all ten public widget JSON files from that snapshot.

## Architecture

```text
Six Notion data sources
        │
        ▼
scripts/fetch-notion.js
        │  typed property normalization, pagination, retries
        ▼
raw.json
        │
        ▼
scripts/build-json.js
        │  one shared transformation and validation layer
        ▼
data/*.json
        │
        ├── standalone widgets/*.html
        └── dashboard.html
```

The sync uses the current Notion data-source API rather than the deprecated database-query endpoint. Requests use API version `2026-03-11`, paginate in batches of 100, and retry HTTP 429 and transient 5xx responses. See the official [query data source](https://developers.notion.com/reference/query-a-data-source), [pagination](https://developers.notion.com/reference/pagination), and [request limits](https://developers.notion.com/reference/request-limits) documentation.

## Database mapping

| Logical source | Required properties | Generated widgets |
|---|---|---|
| Goals | `Goal`, `Current`, `Target`, `Progress`, `Deadline` | Hero Progress, Goals, Forecast fallback, dashboard header |
| Coach State | `Date`, `Priority Skill`, `Estimated Minutes`, `Mission`, `Review Due`, `Pace Delta` | AI Coach, Hero focus |
| Skills | `Skill`, `Category` | Weak Skills labels, Coach focus resolution |
| Study Log | `일자`, `Duration` | Study Time, Heatmap, Streak |
| Wrong Answers | `상태`, `위젯노출`, `Skill`, `파트` | Weak Skills, Coach review context |
| Mock Tests | `응시일`, `총점` or `LC환산` + `RC환산`, `P5`, `P6`, `P7`, `RC잔여시간` | Forecast, Accuracy, RC Speed |

Optional mock-test properties `P5 시간`, `P6 시간`, and `P7 시간` (or their English aliases `P5 Time`, `P6 Time`, `P7 Time`) enable part-level RC timing. Until those properties contain values, RC Speed shows onboarding placeholders rather than invented times.

Relations are resolved by Notion page ID inside `raw.json`. Formula values are used when Notion returns them; deterministic builder fallbacks use only other values from the same Notion snapshot.

## Environment variables

### Secret

| Variable | Purpose |
|---|---|
| `NOTION_TOKEN` | Internal Notion integration token with read-content access |

`NOTION_TOKEN` must be a GitHub Actions secret or a local untracked environment variable. It must never be committed, logged, embedded in HTML, or written to `raw.json`.

### Data-source configuration

| Variable | Source |
|---|---|
| `NOTION_GOALS_DATA_SOURCE_ID` | Goals |
| `NOTION_COACH_DATA_SOURCE_ID` | Coach State |
| `NOTION_SKILLS_DATA_SOURCE_ID` | Skills |
| `NOTION_STUDY_LOG_DATA_SOURCE_ID` | Study Log |
| `NOTION_WRONG_ANSWERS_DATA_SOURCE_ID` | Wrong Answers |
| `NOTION_MOCK_TESTS_DATA_SOURCE_ID` | Mock Tests |
| `WIDGET_TIME_ZONE` | Date boundary for weekly data and streaks; defaults to `Asia/Seoul` |

Data-source IDs are stored as GitHub repository variables. The adapter also accepts legacy aliases `OABDAP_DB_ID` and `MOEUK_DB_ID` for Wrong Answers and Mock Tests, but the canonical names above should be used for new environments.

Each source database must be shared with the same Notion integration used by `NOTION_TOKEN`. Missing variables, missing permissions, invalid schemas, or API failures stop the workflow before generated data is committed.

## `raw.json` schema

`raw.json` is intentionally normalized. It contains the source rows needed to reproduce widget JSON but excludes the token, integration metadata, request headers, and configured data-source IDs.

```json
{
  "schemaVersion": 2,
  "source": "notion",
  "generatedAt": "2026-08-05T00:17:00.000Z",
  "sources": {
    "goals": [
      {
        "id": "notion-page-id",
        "createdTime": "ISO-8601 timestamp",
        "lastEditedTime": "ISO-8601 timestamp",
        "properties": {
          "Goal": "900점",
          "Current": 725,
          "Target": 900,
          "Progress": 0.806,
          "Deadline": "2026-11-15"
        }
      }
    ],
    "coach": [],
    "skills": [],
    "studyLog": [],
    "wrongAnswers": [],
    "mockTests": []
  }
}
```

The values above illustrate types only. The checked-in file is generated from Notion and must not be edited by hand.

## Generated widget schemas

| File | Primary fields |
|---|---|
| `data/hero.json` | `title`, `dashboardSubtitle`, `current`, `target`, `progress`, `remainingLabel`, `focus` |
| `data/coach.json` | `date`, `focusSkill`, `durationLabel`, `mission`, `metrics` |
| `data/skills.json` | `periodLabel`, `skills[]` |
| `data/goals.json` | `currentLabel`, `goals[]` |
| `data/study.json` | `hours`, `minutes`, `summary`, `days[]` |
| `data/forecast.json` | `score`, `trendLabel`, `history[]` |
| `data/heatmap.json` | `studyLabel`, `ratioLabel`, `levels[56]` |
| `data/accuracy.json` | `periodLabel`, `parts[]` |
| `data/rc-speed.json` | `totalLabel`, `parts[]` |
| `data/streak.json` | `days`, `bestLabel` |

Every generated payload is validated before it is written. Non-finite numbers and literal `undefined` or `NaN` display values are rejected.

## Empty-state contract

Empty Notion sources are valid production input. The builder preserves each widget's existing dimensions and component structure while producing meaningful onboarding content:

- unavailable scores use an em dash, never zero unless zero is a truthful measurement;
- Coach explains which first record to create;
- Weak Skills explains how to add and link a wrong answer;
- Study Time and Streak show truthful zero values plus onboarding copy;
- Heatmap always contains 56 cells, with level `0` for days without activity;
- Goals, Accuracy, and RC Speed retain their rows with non-numeric placeholders;
- Forecast keeps its chart area and explains that a mock test is required.

The builder never copies sample study values into an empty dataset.

## Commands

```bash
npm test             # adapter, builder, and orchestration tests
npm run data:fetch   # Notion → raw.json
npm run data:build   # raw.json → data/*.json
npm run data:update  # Notion → raw.json → data/*.json
npm run data:check   # validate all generated widget JSON
npm run site:check   # validate pages, assets, bindings, and JSON
```

For local execution, export the variables in the current shell or place them in an untracked `.env.local` used by your own environment loader. The repository scripts do not parse or commit dotenv files.

## GitHub Actions workflow

`.github/workflows/update-data.yml` supports:

- daily execution at `00:17 UTC` (`09:17 Asia/Seoul`);
- manual execution through **Actions → sync Notion data → Run workflow**;
- test execution before fetching;
- full site validation after generation;
- a bot commit only when `raw.json` or `data/` changed.

Successful completion triggers the separate Pages deployment workflow through `workflow_run`. This is required because commits created with GitHub's workflow token do not emit another push workflow. Deployment checks out the newly updated `main` branch and never receives `NOTION_TOKEN`; only the sync job can access it.

## Operational failure behavior

- Configuration error: list missing variable names without printing values.
- Permission or schema error: fail the sync and preserve the previously deployed JSON.
- Rate limit: respect `Retry-After`, then retry with bounded backoff.
- Empty source: produce a complete empty state and succeed.
- No generated diff: finish successfully without an empty commit.
