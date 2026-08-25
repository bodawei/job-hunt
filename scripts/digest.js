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

// Dealbreaker reasoning (per criteria.md) leads with "Dealbreaker: ..." as its own
// sentence, so the first sentence alone is normally the whole explanation already —
// this just guards against a first sentence that runs long.
function terseReason(reasoning) {
  if (!reasoning) return '';
  const firstSentence = (reasoning.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? reasoning).trim();
  const MAX = 90;
  if (firstSentence.length <= MAX) return firstSentence;
  return `${firstSentence.slice(0, MAX).replace(/\s+\S*$/, '')}…`;
}

function formatAppendixJob(job) {
  return `- #${job.id} — [${job.title}](${job.url}) @ ${job.company} — ${terseReason(job.reasoning)}`;
}

function formatFailure(failure) {
  return `- **${failure.company}** — ${failure.reason}`;
}

function buildBody(jobsByCategory, appendixJobs, failures) {
  const sections = [];
  for (const [category, jobs] of jobsByCategory) {
    sections.push(`## ${category} (${jobs.length})`, '', ...jobs.map(formatJob));
  }
  if (appendixJobs.length > 0) {
    sections.push(`## Fit score: 1/10 (${appendixJobs.length})`, '', ...appendixJobs.map(formatAppendixJob), '');
  }
  if (failures.length > 0) {
    sections.push(`## Fetch failures (${failures.length})`, '', ...failures.map(formatFailure), '');
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

  // Fetch failures not yet reported in any digest. A run that fetched nothing because a
  // board errored is exactly when the issue must appear, so these can carry a digest alone.
  const failures = db
    .prepare('SELECT * FROM ingest_failures WHERE digest_issue_number IS NULL ORDER BY id')
    .all();

  if (jobs.length === 0 && failures.length === 0) {
    console.log('No newly-scored jobs or fetch failures to digest.');
    db.close();
    return;
  }

  const appendixJobs = jobs.filter((job) => job.fit_score === 1);
  const mainJobs = jobs.filter((job) => job.fit_score !== 1);

  const jobsByCategory = new Map();
  for (const job of mainJobs) {
    if (!jobsByCategory.has(job.category)) jobsByCategory.set(job.category, []);
    jobsByCategory.get(job.category).push(job);
  }

  const today = new Date().toISOString().slice(0, 10);
  const title = `Job Digest — ${today}`;
  const body = buildBody(jobsByCategory, appendixJobs, failures);

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

  // Stamp reported failures so they're never posted in a later digest.
  const stampFailure = db.prepare('UPDATE ingest_failures SET digest_issue_number = ? WHERE id = ?');
  for (const failure of failures) {
    stampFailure.run(issueNumber, failure.id);
  }

  console.log(
    `Posted digest issue #${issueNumber} with ${jobs.length} jobs` +
      `${failures.length > 0 ? ` and ${failures.length} fetch failures` : ''}: ${url}`
  );
  db.close();
}

main();
