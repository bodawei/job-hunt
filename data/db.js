import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'jobs.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

export function openDb() {
  const db = new DatabaseSync(DB_PATH);
  db.exec(readFileSync(SCHEMA_PATH, 'utf8'));
  return db;
}
