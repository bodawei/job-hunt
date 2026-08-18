import { execFileSync } from 'node:child_process';
import { openDb } from '../data/db.js';

function repoSlug() {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  return execFileSync('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'], {
    encoding: 'utf8',
  }).trim();
}

function fetchCommentBody(commentId) {
  const repo = repoSlug();
  return execFileSync('gh', ['api', `repos/${repo}/issues/comments/${commentId}`, '--jq', '.body'], {
    encoding: 'utf8',
  });
}

// Parses a small key: value block out of a comment body, e.g.:
//   job: 3
//   category: backend
//   score: down
//   reason: dealbreaker - hybrid 5 days/week, not open to relocation
// See README.md "Leaving feedback" for the format contract.
function parseFeedback(body) {
  const fields = {};
  for (const line of body.split('\n')) {
    const match = line.match(/^\s*(job|category|score|reason)\s*:\s*(.+)$/i);
    if (match) fields[match[1].toLowerCase()] = match[2].trim();
  }
  return fields;
}

async function main() {
  const commentId = process.env.COMMENT_ID;
  if (!commentId) throw new Error('COMMENT_ID env var is required');

  const body = fetchCommentBody(commentId);
  const fields = parseFeedback(body);

  if (!fields.job || !fields.reason) {
    console.log('Comment is not structured feedback (missing "job:" or "reason:") — skipping.');
    return;
  }

  const jobId = Number(fields.job);
  const db = openDb();
  const job = db.prepare('SELECT id FROM jobs WHERE id = ?').get(jobId);
  if (!job) {
    db.close();
    throw new Error(`No job with id ${jobId} — check the "job:" field in the comment.`);
  }

  db.prepare(
    `INSERT INTO feedback (job_id, corrected_category, corrected_score_direction, reason, github_comment_id)
     VALUES (?, ?, ?, ?, ?)`
  ).run(jobId, fields.category ?? null, fields.score ?? null, fields.reason, Number(commentId));

  console.log(`Recorded feedback on job #${jobId} from comment ${commentId}.`);
  db.close();
}

main();
