import { openDb } from '../data/db.js';

// TODO: map raw listings to the jobs schema, hash on (company + title + url)
// for content_hash, and skip rows that already exist (dedup via the UNIQUE
// constraint on jobs.content_hash).
async function main() {
  const db = openDb();
  db.close();
}

main();
