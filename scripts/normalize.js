import { readdirSync, readFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from '../data/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.join(__dirname, '../data/raw');
const PROCESSED_DIR = path.join(RAW_DIR, 'processed');

function normalizeText(text) {
  return text.trim().replace(/\s+/g, ' ');
}

// Never hash on `url` — Indeed mints a fresh tracking URL per search call even for
// the exact same posting, so it guarantees false "new" rows. Description is the
// stable identity signal; when it's missing, fall back to the same weaker signal the
// /ingest-indeed command already trusts for its own in-run pre-dedupe.
function contentHash(job) {
  const identity = job.description
    ? `${job.company}|${job.title}|${job.location}|${normalizeText(job.description)}`
    : `${job.company}|${job.title}|${job.location}|${job.posted_at}|${job.compensation}`;
  return createHash('sha256').update(identity).digest('hex');
}

async function main() {
  if (!existsSync(RAW_DIR)) {
    return;
  }
  mkdirSync(PROCESSED_DIR, { recursive: true });

  const files = readdirSync(RAW_DIR).filter((f) => f.endsWith('.json'));
  if (files.length === 0) {
    return;
  }

  const db = openDb();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO jobs
      (company, title, url, description, location, source, content_hash, posted_at, job_type, compensation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const file of files) {
    const filePath = path.join(RAW_DIR, file);
    const { source, jobs } = JSON.parse(readFileSync(filePath, 'utf8'));
    for (const job of jobs) {
      insert.run(
        job.company,
        job.title,
        job.url,
        job.description ?? null,
        job.location ?? null,
        source,
        contentHash(job),
        job.posted_at ?? null,
        job.job_type ?? null,
        job.compensation ?? null
      );
    }
    renameSync(filePath, path.join(PROCESSED_DIR, file));
  }

  db.close();
}

main();
