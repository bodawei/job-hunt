import { openDb } from '../data/db.js';

// TODO: group/sort newly-scored jobs by category and fit_score, post as a
// new GitHub Issue (label it so feedback.yml can filter comments on it),
// and record the issue number back onto each job row (digest_issue_number).
async function main() {
  const db = openDb();
  db.close();
}

main();
