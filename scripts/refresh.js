// Notion에서 데이터를 뽑아 public/data/*.json에 저장한다.
// GitHub Actions에서 10분마다 실행됨.
import fs from 'node:fs/promises';
import path from 'node:path';

const TOKEN = process.env.NOTION_TOKEN;
const OABDAP_DB = process.env.OABDAP_DB_ID;
const MOEUK_DB = process.env.MOEUK_DB_ID;

if (!TOKEN || !OABDAP_DB || !MOEUK_DB) {
  console.error('환경변수 NOTION_TOKEN / OABDAP_DB_ID / MOEUK_DB_ID 가 필요합니다.');
  process.exit(1);
}

function today() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

async function query(dbId, body = {}) {
  const r = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Notion ${r.status}: ${await r.text()}`);
  return r.json();
}

async function buildQueue() {
  const t = today();
  const [dueRes, anyRes] = await Promise.all([
    query(OABDAP_DB, {
      filter: {
        and: [
          { property: '상태', select: { does_not_equal: '해결' } },
          { property: '다음복습일', formula: { date: { on_or_before: t } } },
        ],
      },
      page_size: 100,
    }),
    query(OABDAP_DB, {
      filter: { property: '상태', select: { does_not_equal: '해결' } },
      page_size: 1,
    }),
  ]);

  let rc = 0, lc = 0;
  for (const p of dueRes.results || []) {
    const area = p.properties['영역']?.formula?.string;
    if (area === 'RC') rc++;
    else if (area === 'LC') lc++;
  }
  const hasAny = (anyRes.results || []).length > 0;
  return { total: rc + lc, rc, lc, hasAny, updatedAt: new Date().toISOString() };
}

async function buildScore() {
  const data = await query(MOEUK_DB, {
    sorts: [{ property: '응시일', direction: 'descending' }],
    page_size: 1,
  });
  if (!data.results?.length) return { empty: true, updatedAt: new Date().toISOString() };
  const p = data.results[0].properties;
  const lc = p['LC환산']?.number ?? null;
  const rc = p['RC환산']?.number ?? null;
  const total = p['총점']?.formula?.number ?? ((lc || 0) + (rc || 0));
  return {
    lc, rc, total,
    lcTarget: 470, rcTarget: 430, totalTarget: 900,
    회차: p['회차']?.title?.[0]?.plain_text ?? '',
    응시일: p['응시일']?.date?.start ?? '',
    updatedAt: new Date().toISOString(),
  };
}

async function buildPace() {
  const data = await query(MOEUK_DB, {
    sorts: [{ property: '응시일', direction: 'ascending' }],
    page_size: 20,
  });
  const points = (data.results || [])
    .map((row) => ({
      date: row.properties['응시일']?.date?.start ?? null,
      rem: row.properties['RC잔여시간']?.number ?? null,
    }))
    .filter((x) => x.date && x.rem !== null);
  return { points, updatedAt: new Date().toISOString() };
}

async function main() {
  const outDir = path.join(process.cwd(), 'public', 'data');
  await fs.mkdir(outDir, { recursive: true });

  const [queue, score, pace] = await Promise.all([
    buildQueue().catch((e) => ({ error: e.message })),
    buildScore().catch((e) => ({ error: e.message })),
    buildPace().catch((e) => ({ error: e.message })),
  ]);

  await fs.writeFile(path.join(outDir, 'queue.json'), JSON.stringify(queue, null, 2));
  await fs.writeFile(path.join(outDir, 'score.json'), JSON.stringify(score, null, 2));
  await fs.writeFile(path.join(outDir, 'pace.json'), JSON.stringify(pace, null, 2));

  console.log('✅ refreshed', { queue: queue.total ?? '—', score: score.total ?? '—', pace: pace.points?.length ?? '—' });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
