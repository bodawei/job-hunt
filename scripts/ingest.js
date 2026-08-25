import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from '../data/db.js';
import { fetchJson } from './lib/fetch-json.js';
import { htmlToText } from './lib/html-to-text.js';

// Greenhouse ingester. Reads greenhouse-targets.json, pulls jobs from each company's
// public Greenhouse board, filters to the requested departments + locations, and writes
// one data/raw/<company>-<date>.json per company for normalize.js to load. Each company is
// processed independently so one board's outage can't sink the others; failures are recorded
// in the ingest_failures table so digest.js can report them in the daily issue.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const RAW_DIR = path.join(ROOT, 'data/raw');
const TARGETS_PATH = path.join(ROOT, 'greenhouse-targets.json');
const API = 'https://boards-api.greenhouse.io/v1/boards';
const SOURCE = 'greenhouse';

// Resolve each requested top-level department name to its id plus every descendant id, so a
// job filed under a child dept (e.g. "Software Development" under "Engineering") still matches.
function resolveDeptIds(departments, wantedNames) {
  const byId = new Map(departments.map((d) => [d.id, d]));
  const allowed = new Set();
  const missing = [];
  for (const name of wantedNames) {
    const root = departments.find((d) => d.name === name);
    if (!root) {
      missing.push(name);
      continue;
    }
    const stack = [root.id];
    while (stack.length > 0) {
      const id = stack.pop();
      if (allowed.has(id)) {
        continue;
      }
      allowed.add(id);
      const dept = byId.get(id);
      if (dept?.child_ids) {
        stack.push(...dept.child_ids);
      }
    }
  }
  return { allowed, missing };
}

function matchesLocation(job, locations) {
  const name = (job.location?.name ?? '').toLowerCase();
  return locations.some((loc) => name.includes(loc.toLowerCase()));
}

// Greenhouse mints per-view apply URLs with a duplicated gh_jid and tracking params; rebuild
// a stable one from the job id. (Dedup doesn't hash url, but a clean apply link is nicer.)
function cleanUrl(job) {
  try {
    const u = new URL(job.absolute_url);
    return `${u.origin}${u.pathname}?gh_jid=${job.id}`;
  } catch {
    return job.absolute_url;
  }
}

async function ingestTarget(target) {
  const base = `${API}/${target.board_token}`;

  const deptData = await fetchJson(`${base}/departments`);
  const { allowed, missing } = resolveDeptIds(deptData.departments ?? [], target.departments);
  if (missing.length > 0) {
    const label = missing.map((m) => `'${m}'`).join(', ');
    throw new Error(`department${missing.length > 1 ? 's' : ''} ${label} not found`);
  }

  const jobData = await fetchJson(`${base}/jobs?content=true`);
  const allJobs = jobData.jobs ?? [];
  // A live board with zero postings signals an API/token problem, not a quiet day.
  if (allJobs.length === 0) {
    throw new Error('board returned no jobs');
  }

  const matched = allJobs.filter(
    (job) =>
      (job.departments ?? []).some((d) => allowed.has(d.id)) && matchesLocation(job, target.locations)
  );

  const jobs = matched.map((job) => ({
    company: (job.company_name ?? '').trim() || target.name,
    title: job.title,
    url: cleanUrl(job),
    description: htmlToText(job.content ?? '') || null,
    location: job.location?.name ?? null,
    posted_at: job.first_published ?? null,
    job_type: null,
    compensation: null,
  }));

  return { total: allJobs.length, jobs };
}

async function main() {
  const targets = JSON.parse(readFileSync(TARGETS_PATH, 'utf8'));
  mkdirSync(RAW_DIR, { recursive: true });

  const db = openDb();
  const recordFailure = db.prepare(
    'INSERT INTO ingest_failures (company, board_token, reason) VALUES (?, ?, ?)'
  );

  const today = new Date().toISOString().slice(0, 10);
  let failures = 0;

  for (const target of targets) {
    try {
      const { total, jobs } = await ingestTarget(target);
      const file = path.join(RAW_DIR, `${target.name}-${today}.json`);
      writeFileSync(
        file,
        JSON.stringify({ source: SOURCE, fetched_at: new Date().toISOString(), jobs }, null, 2)
      );
      const rel = path.relative(ROOT, file);
      console.log(`${target.name}: ${jobs.length} matching roles (${total} total on board) -> ${rel}`);
    } catch (err) {
      failures++;
      const reason = err.message;
      recordFailure.run(target.name, target.board_token, reason);
      console.error(`Could not retrieve results for ${target.name}: ${reason}`);
    }
  }

  db.close();
  // Non-zero exit so the daily Action flags a run where any board failed, without losing the
  // companies that succeeded (their files are already written).
  if (failures > 0) {
    process.exitCode = 1;
  }
}

main();
