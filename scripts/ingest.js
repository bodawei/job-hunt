import { openDb } from '../data/db.js';

// TODO: pull raw listings from Greenhouse/Lever/Ashby APIs where available,
// Playwright for JS-heavy career pages without a public feed. Write raw
// listings somewhere normalize.js can pick up (e.g. a staging table or JSON).
async function main() {
  const db = openDb();
  db.close();
}

main();
