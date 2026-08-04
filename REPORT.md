# TOEIC Widgets Repository Audit

Audit date: 2026-08-04  
Baseline commit: `ead6147`

## Executive summary

The repository is already framework-free and has a sound shared-asset foundation. All ten widget pages use the same three stylesheets and two browser scripts, all ten data files are referenced, and the current static link scan reports no broken local references. The main Sprint 1 work is therefore architectural consolidation rather than visual redesign: move the deployable site from `public/` to the requested repository-root layout, formalize the landing/dashboard vocabulary as named reusable components, and rebuild the first three widgets against those component contracts.

The approved visible landing experience is currently `dashboard.html`: `index.html` immediately redirects to it. Sprint 1 should preserve that rendered design.

## Current folder structure

```text
.
├── .github/
│   └── workflows/
│       ├── deploy.yml
│       └── update-data.yml
├── public/
│   ├── assets/
│   │   ├── css/
│   │   │   ├── theme.css
│   │   │   ├── layout.css
│   │   │   └── components.css
│   │   └── js/
│   │       ├── common.js
│   │       └── animation.js
│   ├── data/
│   │   ├── accuracy.json
│   │   ├── coach.json
│   │   ├── forecast.json
│   │   ├── goals.json
│   │   ├── heatmap.json
│   │   ├── hero.json
│   │   ├── rc-speed.json
│   │   ├── skills.json
│   │   ├── streak.json
│   │   └── study.json
│   ├── widgets/
│   │   ├── accuracy.html
│   │   ├── coach.html
│   │   ├── forecast.html
│   │   ├── goals.html
│   │   ├── heatmap.html
│   │   ├── hero.html
│   │   ├── rc-speed.html
│   │   ├── streak.html
│   │   ├── study-time.html
│   │   └── weak-skills.html
│   ├── dashboard.html
│   └── index.html
├── scripts/
│   ├── build-json.js
│   ├── fetch-notion.js
│   └── update-dashboard.js
├── .gitattributes
├── .gitignore
├── package.json
└── README.md
```

## Duplicated CSS

- No widget contains inline CSS, and no full selector block is duplicated across `theme.css`, `layout.css`, and `components.css`.
- All widget pages repeat only the required stylesheet `<link>` declarations; the CSS implementation itself remains shared.
- Semantic duplication remains in the component vocabulary:
  - `.pill` and `.status-tag` share the same compact rounded-control foundation and should become explicit `Chip` and `Badge` components.
  - `.widget-header`, `.widget-row`, and `.metric-row` share layout behavior and need a stable reusable `Header` contract.
  - `.widget-card` is visually reusable but is named for one context instead of being exposed as a general `Card` component.
  - A reusable `Button` contract does not exist; interactive styles currently cover only the skip link.
- `components.css` is 562 lines. It is intentionally centralized, but clearer component sections and stable class names will reduce future selector drift.

## Duplicated JavaScript

- No page contains inline JavaScript.
- Browser behavior is centralized in `common.js` and `animation.js`; counters, progress, data binding, chart rendering, theme detection, and animation are not duplicated across widgets.
- The three Node scripts repeat a small direct-execution/error-reporting wrapper. This is low-risk build-tool duplication and can be extracted later if the automation surface grows.
- No duplicate browser component implementation was found.

## Broken links

- Static scan result: **77 local references checked, 0 missing**.
- All dashboard iframe sources resolve to existing widget pages.
- All widget `data-source` paths resolve to existing JSON files.
- All CSS and JavaScript asset references resolve.
- `index.html` correctly redirects to `dashboard.html`.

## Unused files

- No orphaned production widget, JSON, CSS, or browser JavaScript file was found.
- `fetch-notion.js` and `update-data.yml` are intentionally dormant Phase 3 architecture. They are not part of the current browser runtime and remain guarded by `NOTION_AUTOMATION_ENABLED`.
- `.gitattributes`, `.gitignore`, package scripts, and both workflows are active repository infrastructure.

## Pages not using shared styles

- `dashboard.html` and all ten widget pages load `theme.css`, `layout.css`, and `components.css`.
- `index.html` does not load shared styles because it is a redirect-only entry document with a plain fallback link. Once moved to the root, the fallback can use the shared `Button` component without changing the approved visible landing experience.

## Recommended improvements

1. Move `index.html`, `dashboard.html`, `widgets/`, `assets/`, and `data/` to the repository root as requested, then update deployment and automation paths atomically.
2. Formalize `Card`, `Progress`, `Badge`, `Chip`, `Button`, and `Header` class contracts while preserving the current tokens and rendering.
3. Migrate all existing widget markup to the stable component names; keep feature-specific selectors only for genuinely unique content.
4. Rebuild Hero, Coach, and Weak Skills with semantic sections, JSON-only values, zero inline CSS/JS, loading/error behavior, and reduced-motion support.
5. Add a reusable repository check command for local references, JSON validity, forbidden inline code, and required shared assets so the same gate runs locally and in GitHub Actions.
6. Keep the Notion adapter disabled until its schema mapping, pagination, rate-limit handling, retries, and fixture-based tests are implemented.
7. Preserve the dashboard visual output throughout; structural refactors should be verified with desktop and mobile screenshots before each commit.
