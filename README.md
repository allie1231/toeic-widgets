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
├── dashboard.html
└── index.html
```

## 공용 컴포넌트

`common.js`는 `ProgressBar`, `Counter`, `Card`, `Theme`을 제공합니다. `animation.js`는 카운트업, 진행률, 페이드와 슬라이드에 사용하는 `Animation` 유틸리티를 제공합니다. 모든 API는 `window.TOEICWidgets`에서 접근할 수 있습니다.

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
