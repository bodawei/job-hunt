import { openDb } from '../data/db.js';

// TODO: parse an issue_comment webhook payload (job reference + corrected
// category/score direction + reason) into a feedback row linked to the
// job's id.
async function main() {
  const db = openDb();
  db.close();
}

main();
