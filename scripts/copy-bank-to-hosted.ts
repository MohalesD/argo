// Copies the screened question bank from the local embedded database to
// the hosted project, preserving ids, screening results, and provenance.
// The screening run is Goal 1 data; re-screening would re-roll results
// and re-spend the classifier budget for nothing.
import pg from 'pg';
import { adminPool, DB_CONFIG } from '../src/lib/db.js';

const local = new pg.Pool({ ...DB_CONFIG, max: 3 });
const hosted = adminPool();

if (!process.env.DATABASE_URL?.includes('pooler.supabase.com')) {
  throw new Error('Run with ARGO_DB=hosted; refusing to copy a database into itself.');
}

const rows = await local.query(
  `select id, text, category, role_family, level, rationale, provenance,
          screening_status, flag_reason, verification, contributed_by, created_at
   from questions
   where provenance->>'source' = 'argo_seed_bank_v1'
   order by created_at`,
);
console.log(`local bank: ${rows.rows.length} questions`);

let copied = 0;
for (const r of rows.rows) {
  await hosted.query(
    `insert into questions (id, text, category, role_family, level, rationale,
       provenance, screening_status, flag_reason, verification, contributed_by, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     on conflict (id) do nothing`,
    [
      r.id, r.text, r.category, r.role_family, r.level, r.rationale,
      JSON.stringify(r.provenance), r.screening_status, r.flag_reason,
      r.verification, r.contributed_by, r.created_at,
    ],
  );
  copied++;
}

const summary = await hosted.query(
  `select screening_status, count(*)::int as n from questions group by 1 order by 1`,
);
console.log(`copied ${copied}; hosted bank now:`, JSON.stringify(summary.rows));
await local.end();
await hosted.end();
