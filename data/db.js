import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'jobs.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// This SQLite build doesn't support `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, so
// schema.sql alone can't migrate columns onto an already-existing table (it only
// creates tables that don't exist yet). Check and add them here instead.
function ensureColumns(db, table, columns) {
  const existing = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name));
  for (const [name, type] of Object.entries(columns)) {
    if (!existing.has(name)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
    }
  }
}

export function openDb() {
  const db = new DatabaseSync(DB_PATH);
  db.exec(readFileSync(SCHEMA_PATH, 'utf8'));
  ensureColumns(db, 'jobs', { job_type: 'TEXT', compensation: 'TEXT' });
  return db;
}
