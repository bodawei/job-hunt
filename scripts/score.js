import { openDb } from '../data/db.js';

// TODO: for each unscored job, call Claude with the job description, the
// full criteria.md, and the 5-10 most similar past feedback-annotated jobs
// (embedding similarity) -> structured JSON {category, fit_score, reasoning,
// tags}. Write results back onto the jobs row (category, fit_score,
// reasoning, tags, scored_at).
async function main() {
  const db = openDb();
  db.close();
}

main();
