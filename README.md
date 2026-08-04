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
public/
├── assets/
│   ├── css/
│   │   ├── theme.css
│   │   ├── layout.css
│   │   └── components.css
│   └── js/
│       ├── common.js
│       └── animation.js
├── widgets/
│   ├── hero.html
│   ├── coach.html
│   ├── weak-skills.html
│   ├── goals.html
│   ├── study-time.html
│   ├── forecast.html
│   ├── heatmap.html
│   ├── rc-speed.html
│   ├── accuracy.html
│   └── streak.html
├── data/
│   ├── hero.json
│   ├── coach.json
│   ├── skills.json
│   ├── goals.json
│   ├── study.json
│   ├── forecast.json
│   ├── heatmap.json
│   ├── rc-speed.json
│   ├── accuracy.json
│   └── streak.json
├── dashboard.html
└── index.html
```

## 공용 컴포넌트

`common.js`는 `DataSource`, `ProgressBar`, `Counter`, `Card`, `Theme`을 제공합니다. `animation.js`는 카운트업, 진행률, 페이드와 슬라이드에 사용하는 `Animation` 유틸리티를 제공합니다. 모든 API는 `window.TOEICWidgets`에서 접근할 수 있습니다.

페이지별 CSS와 외부 UI 프레임워크는 사용하지 않습니다. 색상, 간격, 타이포그래피, 그림자, 모서리와 모션은 공용 디자인 토큰에서 관리합니다. 다크 모드와 모션 축소 설정은 운영체제 환경설정을 자동으로 따릅니다.

## 로컬 실행

```bash
npx serve public
```

브라우저에서 `http://localhost:3000/dashboard.html`을 엽니다.

## 배포

`main` 브랜치에 푸시하면 GitHub Actions가 `public/`을 GitHub Pages로 배포합니다. 별도의 빌드 단계나 환경변수는 필요하지 않습니다.

## 라이선스

개인용. 잇재 스튜디오.
