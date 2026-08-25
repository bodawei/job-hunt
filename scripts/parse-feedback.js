import { execFileSync } from 'node:child_process';
import { openDb } from '../data/db.js';

function repoSlug() {
  if (process.env.GITHUB_REPOSITORY) {
    return process.env.GITHUB_REPOSITORY;
  }
  return execFileSync(
    'gh',
    ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'],
    {
      encoding: 'utf8',
    },
  ).trim();
}

function fetchCommentBody(commentId) {
  const repo = repoSlug();
  return execFileSync(
    'gh',
    ['api', `repos/${repo}/issues/comments/${commentId}`, '--jq', '.body'],
    {
      encoding: 'utf8',
    },
  );
}

const JOB_LINE = /^\s*job\s*:?\s*(\d+)\s*$/i;
const FIELD_LINE = /^\s*(category|score|reason)\s*:?\s+(.+)$/i;

// A comment can carry feedback on multiple jobs. Each job's own line
// ("job 5" or "job: 5" — colon optional, people type this both ways)
// starts a new block; category/score/reason lines below it (colon also
// optional) belong to that job until the next "job" line. See README.md
// "Leaving feedback" for the format contract.
function parseFeedback(body) {
  const blocks = [];
  let current = null;

  for (const line of body.split('\n')) {
    const jobMatch = line.match(JOB_LINE);
    if (jobMatch) {
      current = { jobId: Number(jobMatch[1]) };
      blocks.push(current);
      continue;
    }
    const fieldMatch = current && line.match(FIELD_LINE);
    if (fieldMatch) {
      current[fieldMatch[1].toLowerCase()] = fieldMatch[2].trim();
    }
  }

  return blocks.filter((block) => block.reason);
}

async function main() {
  const commentId = process.env.COMMENT_ID;
  if (!commentId) {
    throw new Error('COMMENT_ID env var is required');
  }

  const body = fetchCommentBody(commentId);
  const blocks = parseFeedback(body);

  if (blocks.length === 0) {
    console.log(
      'Comment has no structured feedback ("job <id>" + "reason" pair) — skipping.',
    );
    return;
  }

  const db = openDb();
  const getJob = db.prepare('SELECT id FROM jobs WHERE id = ?');
  const insert = db.prepare(
    `INSERT INTO feedback (job_id, corrected_category, corrected_score_direction, reason, github_comment_id)
     VALUES (?, ?, ?, ?, ?)`,
  );

  for (const block of blocks) {
    if (!getJob.get(block.jobId)) {
      console.log(`No job with id ${block.jobId} — skipping that block.`);
      continue;
    }
    insert.run(
      block.jobId,
      block.category ?? null,
      block.score ?? null,
      block.reason,
      Number(commentId),
    );
    console.log(
      `Recorded feedback on job #${block.jobId} from comment ${commentId}.`,
    );
  }

  db.close();
}

main();
