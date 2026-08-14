import { readdirSync, readFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from '../data/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.join(__dirname, '../data/raw');
const PROCESSED_DIR = path.join(RAW_DIR, 'processed');

function contentHash(job) {
  return createHash('sha256').update(`${job.company}|${job.title}|${job.url}`).digest('hex');
}

async function main() {
  if (!existsSync(RAW_DIR)) return;
  mkdirSync(PROCESSED_DIR, { recursive: true });

  const files = readdirSync(RAW_DIR).filter((f) => f.endsWith('.json'));
  if (files.length === 0) return;

  const db = openDb();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO jobs
      (company, title, url, description, location, source, content_hash, posted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
        job.posted_at ?? null
      );
    }
    renameSync(filePath, path.join(PROCESSED_DIR, file));
  }

  db.close();
}

main();
