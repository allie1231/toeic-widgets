# TOEIC Widgets · 잇재

노션 임베드용 위젯 4종. **GitHub Actions + GitHub Pages**로 무료 호스팅.

| 위젯 | 파일 | 데이터 |
|---|---|---|
| SCORE | `score.html` | 최근 모의고사 LC/RC/총점 |
| QUEUE | `queue.html` | 오늘 복습할 오답 개수 (RC/LC 분리) |
| PACE | `pace.html` | RC 잔여시간 추이 |
| TIMER | `timer.html` | 프리셋 4종 (API 불필요) |

## 동작 방식

```
GitHub Actions (10분마다)
     ↓
scripts/refresh.js 실행 → 노션 API → public/data/*.json 생성
     ↓
GitHub Pages 재배포
     ↓
노션에 임베드된 위젯이 JSON을 읽어서 표시
```

토큰은 **GitHub Secret**에만 저장. 클라이언트로 노출되지 않음.

## 설치 (15분)

### 1. Notion 인테그레이션

1. https://www.notion.so/my-integrations → **+ New integration**
2. 이름 `TOEIC Widgets`, 워크스페이스 선택
3. **Internal Integration Secret** 복사 (`secret_...`)
4. 노션 워크스페이스로 가서 **❌ 오답 DB** 열기 → 우측 상단 `...` → **Connections** → `TOEIC Widgets` 추가
5. **📊 모의고사 기록 DB**도 동일하게 연결

### 2. GitHub 리포지토리 만들기

```bash
cd toeic-widgets-gh
git init
git add .
git commit -m "init"
gh repo create toeic-widgets --public --source=. --push
```

### 3. Secrets 등록

리포지토리 → **Settings → Secrets and variables → Actions → New repository secret**

| 이름 | 값 |
|---|---|
| `NOTION_TOKEN` | 1단계 시크릿 |
| `OABDAP_DB_ID` | `188daf6c-7fec-4e70-a2da-8b1f658adc39` |
| `MOEUK_DB_ID` | `eb8904a5-c442-4961-a391-f77924710678` |

### 4. Pages 활성화

**Settings → Pages → Build and deployment → Source**를 `GitHub Actions`로 설정.

### 5. 워크플로우 실행

**Actions 탭 → refresh & deploy → Run workflow**로 첫 실행.
완료되면 배포 URL이 표시됨:
`https://<username>.github.io/toeic-widgets/`

### 6. 노션에 임베드

TOEIC 900 페이지에서 `/embed` 입력 → 아래 URL 붙여넣기:

```
https://<username>.github.io/toeic-widgets/score.html
https://<username>.github.io/toeic-widgets/queue.html
https://<username>.github.io/toeic-widgets/pace.html
https://<username>.github.io/toeic-widgets/timer.html
```

## 로컬 테스트

```bash
# 노션 데이터 뽑아보기
NOTION_TOKEN=secret_... OABDAP_DB_ID=... MOEUK_DB_ID=... node scripts/refresh.js

# public 폴더를 정적 서버로 열기
npx serve public
```

## 구조

```
toeic-widgets/
├── .github/workflows/
│   └── refresh.yml       # 10분마다 실행
├── scripts/
│   └── refresh.js        # Notion → JSON
├── public/               # GitHub Pages 루트
│   ├── index.html
│   ├── style.css
│   ├── score.html / queue.html / pace.html / timer.html
│   └── data/             # Actions가 채움
└── README.md
```

## Vercel 버전과의 차이

| | Vercel | **GitHub (이 버전)** |
|---|---|---|
| 데이터 신선도 | 요청 시 실시간 (캐시 5분) | 10분마다 갱신 |
| 인프라 | Vercel + GitHub | GitHub만 |
| 토큰 저장 | Vercel 환경변수 | GitHub Secret |
| 비용 | 무료 | 무료 |

읽기 전용이라 10분 지연은 실사용에 영향 없음.

## 라이선스

개인용. 잇재 스튜디오.
