import { openDb } from '../data/db.js';

function truncate(value, max = 120) {
  if (typeof value !== 'string' || value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}…`;
}

function dumpTable(db, table) {
  const rows = db.prepare(`SELECT * FROM ${table}`).all();
  console.log(`\n=== ${table} (${rows.length}) ===`);
  if (rows.length === 0) {
    return;
  }
  console.table(rows.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, truncate(v)]))));
}

function main() {
  const db = openDb();
  dumpTable(db, 'jobs');
  dumpTable(db, 'feedback');
  db.close();
}

main();
