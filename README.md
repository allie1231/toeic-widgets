# TOEIC Widgets v2

TOEIC 학습 현황을 보여 주는 프레임워크 없는 정적 위젯 시스템입니다. 각 위젯은 Notion에 개별 임베드할 수 있고, `dashboard.html`은 전체 현황을 보여 주는 독립형 대시보드입니다.

## 위젯

| 위젯 | 임베드 경로 |
|---|---|
| Hero Progress | `/widgets/hero.html` |
| AI Coach | `/widgets/coach.html` |
| Weak Skills | `/widgets/weak-skills.html` |
| Goals | `/widgets/goals.html` |
| Study Time | `/widgets/study-time.html` |
| Forecast | `/widgets/forecast.html` |
| Heatmap | `/widgets/heatmap.html` |
| RC Speed | `/widgets/rc-speed.html` |
| Accuracy | `/widgets/accuracy.html` |
| Streak | `/widgets/streak.html` |

배포된 GitHub Pages 주소 뒤에 위 경로를 붙여 Notion의 `/embed` 블록에 입력합니다.

## 데이터

모든 학습 값은 `public/data/`의 JSON에서 읽습니다. 위젯 HTML에는 점수, 날짜, 학습량, 상태와 차트 값이 들어 있지 않습니다. 공용 `DataSource` 컴포넌트가 JSON을 불러와 텍스트, 카운터, 진행률, 반복 목록, 막대 차트, 선 차트와 히트맵에 바인딩합니다.

| 데이터 파일 | 사용 위젯 | 주요 필드 |
|---|---|---|
| `hero.json` | Hero Progress | `current`, `target`, `progress`, `remaining` |
| `coach.json` | AI Coach | `date`, `focusSkill`, `mission`, `metrics` |
| `skills.json` | Weak Skills | `periodLabel`, `skills` |
| `goals.json` | Goals | `currentLabel`, `goals` |
| `study.json` | Study Time | `hours`, `minutes`, `days` |
| `forecast.json` | Forecast | `score`, `trendLabel`, `history` |
| `heatmap.json` | Heatmap | `studyLabel`, `ratioLabel`, `levels` |
| `rc-speed.json` | RC Speed | `totalLabel`, `parts` |
| `accuracy.json` | Accuracy | `periodLabel`, `parts` |
| `streak.json` | Streak | `days`, `bestLabel` |

JSON 요청은 캐시를 사용하지 않으므로 이후 Notion 자동 생성기가 파일을 교체하면 다음 위젯 로드부터 최신 값이 반영됩니다. 요청 실패나 잘못된 JSON은 위젯 안의 접근 가능한 오류 메시지로 처리됩니다.

## 구조

```text
.
├── .github/workflows/
│   ├── deploy.yml
│   └── update-data.yml
├── scripts/
│   ├── fetch-notion.js
│   ├── build-json.js
│   └── update-dashboard.js
└── public/
    ├── assets/
    │   ├── css/
    │   │   ├── theme.css
    │   │   ├── layout.css
    │   │   └── components.css
    │   └── js/
    │       ├── common.js
    │       └── animation.js
    ├── widgets/
    │   └── *.html
    ├── data/
    │   └── *.json
    ├── dashboard.html
    └── index.html
```

## 공용 컴포넌트

`common.js`는 `DataSource`, `ProgressBar`, `Counter`, `Card`, `Theme`을 제공합니다. `animation.js`는 카운트업, 진행률, 페이드와 슬라이드에 사용하는 `Animation` 유틸리티를 제공합니다. 모든 API는 `window.TOEICWidgets`에서 접근할 수 있습니다.

페이지별 CSS와 외부 UI 프레임워크는 사용하지 않습니다. 색상, 간격, 타이포그래피, 그림자, 모서리와 모션은 공용 디자인 토큰에서 관리합니다. 다크 모드와 모션 축소 설정은 운영체제 환경설정을 자동으로 따릅니다.

## 자동화 준비

Phase 3에서는 Notion 연동 경계만 준비되어 있습니다. 현재 코드는 Notion API에 요청하지 않습니다.

- `fetch-notion.js` — 향후 Notion API 응답을 정규화된 스냅샷으로 바꿀 어댑터 경계입니다. 현재는 명시적인 미구현 오류를 반환합니다.
- `build-json.js` — 정규화된 스냅샷을 10개 위젯 JSON으로 검증하고 안전하게 기록합니다.
- `update-dashboard.js` — fetch → build → write 단계를 조율합니다. `NOTION_AUTOMATION_ENABLED=true`가 아니면 아무 파일도 변경하지 않습니다.

예정된 정규화 스냅샷 계약은 다음과 같습니다.

```json
{
  "schemaVersion": 1,
  "generatedAt": "ISO-8601 timestamp",
  "widgets": {
    "hero": {},
    "coach": {},
    "skills": {},
    "goals": {},
    "study": {},
    "forecast": {},
    "heatmap": {},
    "rc-speed": {},
    "accuracy": {},
    "streak": {}
  }
}
```

사용 가능한 명령:

```bash
npm run data:check   # 현재 public/data JSON 검증
npm run data:build   # .cache/notion-snapshot.json을 public/data로 빌드
npm run data:update  # 전체 자동화 실행; 현재는 기본적으로 안전하게 건너뜀
```

`.github/workflows/update-data.yml`은 6시간 주기와 수동 실행을 준비하지만, 저장소 변수 `NOTION_AUTOMATION_ENABLED`가 `true`일 때만 job이 실행됩니다. 실제 연동을 구현한 뒤 `NOTION_TOKEN`, `NOTION_DATABASE_ID` secrets를 등록하고 마지막에 이 변수를 활성화합니다.

## 로컬 실행

```bash
npx serve public
```

브라우저에서 `http://localhost:3000/dashboard.html`을 엽니다.

## 배포

`main` 브랜치에 푸시하면 GitHub Actions가 먼저 10개 JSON 계약을 검증한 뒤 `public/`을 GitHub Pages로 배포합니다. 데이터 자동화가 활성화된 뒤에는 변경된 JSON을 bot commit으로 `main`에 반영하며, 해당 커밋이 기존 배포 workflow를 실행합니다.

## 라이선스

개인용. 잇재 스튜디오.
