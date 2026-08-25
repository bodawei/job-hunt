import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from '../data/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CRITERIA_PATH = path.join(__dirname, '../criteria.md');
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

const SCORE_TOOL = {
  name: 'score_job',
  description:
    'Record the category, fit score, reasoning, and tags for a job listing.',
  input_schema: {
    type: 'object',
    properties: {
      category: { type: 'string' },
      fit_score: { type: 'number', description: '1-10' },
      reasoning: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
    },
    required: ['category', 'fit_score', 'reasoning', 'tags'],
  },
};

async function scoreJob(client, criteria, job) {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    tools: [SCORE_TOOL],
    tool_choice: { type: 'tool', name: 'score_job' },
    messages: [
      {
        role: 'user',
        content: `Criteria:\n\n${criteria}\n\nJob listing:\n\nCompany: ${job.company}\nTitle: ${job.title}\nLocation: ${job.location ?? 'unknown'}\nDescription:\n${job.description ?? '(no description available)'}`,
      },
    ],
  });

  const toolUse = message.content.find((block) => block.type === 'tool_use');
  return toolUse.input;
}

// TODO: once the feedback table has ~100+ rows, pull the 5-10 most similar
// past feedback-annotated jobs (embedding similarity) into the prompt as
// retrieval-based few-shot examples, per CLAUDE.md. Skipped for now since
// feedback is empty on a fresh pipeline.
async function main() {
  const db = openDb();
  const criteria = readFileSync(CRITERIA_PATH, 'utf8');
  const client = new Anthropic();

  const unscored = db
    .prepare('SELECT * FROM jobs WHERE scored_at IS NULL')
    .all();
  if (unscored.length === 0) {
    console.log('No unscored jobs.');
    db.close();
    return;
  }

  const update = db.prepare(`
    UPDATE jobs SET category = ?, fit_score = ?, reasoning = ?, tags = ?, scored_at = datetime('now')
    WHERE id = ?
  `);

  for (const job of unscored) {
    const result = await scoreJob(client, criteria, job);
    update.run(
      result.category,
      result.fit_score,
      result.reasoning,
      JSON.stringify(result.tags ?? []),
      job.id,
    );
    console.log(
      `Scored #${job.id} ${job.company} — ${job.title}: ${result.category} (${result.fit_score})`,
    );
  }

  db.close();
}

main();
