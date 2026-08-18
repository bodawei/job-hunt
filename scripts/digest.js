import { execFileSync } from 'node:child_process';
import { openDb } from '../data/db.js';

const LABEL = 'job-digest';

function ensureLabel() {
  try {
    execFileSync(
      'gh',
      ['label', 'create', LABEL, '--color', '0E8A16', '--description', 'Daily job digest issue', '--force'],
      { stdio: 'pipe' }
    );
  } catch {
    // best-effort — if it already exists (or gh lacks perms locally), issue
    // creation below will surface a clearer error if the label is missing.
  }
}

function formatJob(job) {
  const tags = job.tags ? JSON.parse(job.tags) : [];
  const lines = [
    `### #${job.id} — [${job.title}](${job.url}) @ ${job.company}`,
    `**Fit score:** ${job.fit_score}/10  **Location:** ${job.location ?? 'unknown'}`,
  ];
  if (tags.length > 0) lines.push(`**Tags:** ${tags.join(', ')}`);
  lines.push('', job.reasoning ?? '', '');
  return lines.join('\n');
}

function buildBody(jobsByCategory) {
  const sections = [];
  for (const [category, jobs] of jobsByCategory) {
    sections.push(`## ${category} (${jobs.length})`, '', ...jobs.map(formatJob));
  }
  return sections.join('\n');
}

async function main() {
  const db = openDb();
  const jobs = db
    .prepare(
      `SELECT * FROM jobs
       WHERE scored_at IS NOT NULL AND digest_issue_number IS NULL
       ORDER BY category, fit_score DESC`
    )
    .all();

  if (jobs.length === 0) {
    console.log('No newly-scored jobs to digest.');
    db.close();
    return;
  }

  const jobsByCategory = new Map();
  for (const job of jobs) {
    if (!jobsByCategory.has(job.category)) jobsByCategory.set(job.category, []);
    jobsByCategory.get(job.category).push(job);
  }

  const today = new Date().toISOString().slice(0, 10);
  const title = `Job Digest — ${today}`;
  const body = buildBody(jobsByCategory);

  ensureLabel();

  const output = execFileSync('gh', ['issue', 'create', '--title', title, '--body', body, '--label', LABEL], {
    encoding: 'utf8',
  });

  const url = output.trim().split('\n').pop();
  const issueNumber = Number(url.split('/').pop());

  const update = db.prepare('UPDATE jobs SET digest_issue_number = ? WHERE id = ?');
  for (const job of jobs) {
    update.run(issueNumber, job.id);
  }

  console.log(`Posted digest issue #${issueNumber} with ${jobs.length} jobs: ${url}`);
  db.close();
}

main();
