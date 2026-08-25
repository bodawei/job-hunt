# Plan: Greenhouse ingestion source

## Context

`scripts/ingest.js` is a stub; the only working ingestion today is the manual Indeed path.
This adds a Greenhouse ingester that pulls jobs from public Greenhouse job boards (starting
with Harness, board token `harnessinc`) into the existing pipeline. Greenhouse boards expose
a public JSON API — no scraping, no Playwright, no new dependencies (global `fetch`). This
ingester is meant to run unattended in the daily GitHub Action, so it must fail loudly and
survive partial outages rather than silently emitting an empty or garbage run.

It writes to the same seam every source uses: one `data/raw/<company>-<date>.json` file of
`{ source, fetched_at, jobs[] }`, which `npm run 2normalize-jobs` then loads into
`data/jobs.db` (see `data/raw/SCHEMA.md`). Fetch failures are recorded in the db too, so the
digest step (a separate stage) can report them in the daily GitHub issue.

## Config: `greenhouse-targets.json` (new)

Mirrors `search-targets.json`. One entry per company:

```json
[
  {
    "name": "harness",
    "board_token": "harnessinc",
    "departments": ["Engineering"],
    "locations": ["Mountain View", "San Francisco"]
  }
]
```

- `departments` — top-level Greenhouse department names, resolved at runtime to their full
  descendant-id subtree (the site's "Engineering" is a parent over Software Development,
  Cloud Engineering & DevOps, Data, Eng Ops; excludes Sales Eng, Product Mgmt, Impl Eng).
- `locations` — case-insensitive substrings matched against each job's `location.name`.

## Shared helpers (new, in `scripts/lib/`, dependency-free)

**`fetch-json.js`** — wrapper over global `fetch` for resilient JSON GETs:

- `AbortSignal.timeout(~10s)` per request.
- 1–2 retries with small backoff on network error or 5xx; no retry on 4xx (deterministic).
- Throws a typed error (status + url) on `!res.ok`.

**`html-to-text.js`** — Greenhouse job `content` is HTML; the rest of the pipeline expects
plain text. Strip tags, decode common entities (`&amp; &lt; &gt; &#39; &quot; &nbsp;` +
numeric refs), convert `</p>` / `<br>` / `<li>` to newlines/bullets before stripping, then
collapse whitespace. Its output feeds `normalize.js`'s dedup hash, so it must be
deterministic and idempotent — shipped with a `node --test` file
(`scripts/lib/html-to-text.test.js`; `node --test` is built into Node 22, no deps) covering
entities, nested tags, lists, and idempotency.

## `scripts/ingest.js` (implement the stub; `npm run 1ingest-jobs`)

Read `greenhouse-targets.json` and process **each company independently** in its own
try/catch — one company's failure never aborts the others.

For each company:

1. `GET /v1/boards/<token>/departments` (via `fetch-json`).
2. Resolve each requested department name → its id + all descendant ids. If a requested
   name matches no department, fail this company with reason `department '<name>' not found`.
3. `GET /v1/boards/<token>/jobs?content=true`. If the board returns **0 jobs total**, fail
   this company with reason `board returned no jobs` — a live board with zero postings
   signals an API/token problem, not a quiet day.
4. Keep jobs whose department is an allowed id **and** whose `location.name` matches a
   location substring. Matching **0** jobs here (board had jobs, depts resolved, filters
   just didn't match — e.g. SF has no eng roles today) is legitimate: write the file with
   `jobs: []` and report `"0 matching roles (N total on board)"`.
5. Map each kept job → `{ company, title, url (strip Greenhouse per-view gh_jid / tracking
params), description: htmlToText(content), location: location.name, posted_at:
first_published, job_type: null, compensation: null }`.
6. Write `data/raw/<company-name>-<date>.json` = `{ source: "greenhouse", fetched_at,
jobs }`. Date is **UTC** (Actions run UTC).

A non-`ok` response from step 1 or 3 surfaces as the `fetch-json` error → caught with reason
`HTTP <status> from <url>` (network/timeout after retries → `network error: <message>`),
then continue to the next company.

Every failure above is both **recorded to the `ingest_failures` table** (so the digest can
report it) and printed. A row is `{ company, board_token, reason, digest_issue_number NULL,
created_at }` — the `digest_issue_number` NULL/not-null pattern mirrors the `jobs` table so
each failure is reported in exactly one digest.

At end of run:

- Print a per-company summary: total on board, matched, file written — or the failure line.
- If **any** company failed, set `process.exitCode = 1` so the daily Action flags it;
  companies that succeeded still have their files written and their failures recorded.
- No normalize, no commit — `npm run 2normalize-jobs` loads the raw files separately.

## `data/schema.sql`

Add one table (plain `CREATE TABLE IF NOT EXISTS`, so `openDb()` creates it with no
migration):

```sql
CREATE TABLE IF NOT EXISTS ingest_failures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company TEXT NOT NULL,
  board_token TEXT,
  reason TEXT NOT NULL,
  digest_issue_number INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## `scripts/digest.js`

Report unreported fetch failures in the same issue, **below the `Fit score: 1/10`
appendix**:

- Query `SELECT * FROM ingest_failures WHERE digest_issue_number IS NULL`.
- If there are failures, append a final `## Fetch failures (N)` section — one bullet per
  row: `- **<company>** — <reason>`.
- After the issue is created, stamp those rows with the new issue number (same
  `UPDATE ... SET digest_issue_number = ?` sweep already done for jobs), so a failure is
  never double-reported.
- Adjust the early return: currently digest exits without posting when there are no
  newly-scored jobs. Post the issue when there are jobs **or** unreported failures — a run
  that fetched nothing because everything errored is exactly when the issue must appear.
  Only skip when both are empty.

## `normalize.js`

No change. Descriptions arrive as plain text, so the existing `contentHash` / INSERT path
handles Greenhouse rows exactly like Indeed rows.

## `README.md`

Document `greenhouse-targets.json`, the `source: "greenhouse"` per-company-file convention,
the UTC date, the `1ingest-jobs → 2normalize-jobs` path, the exit-non-zero-on-partial-
failure behavior, and that fetch failures surface in the digest issue's `Fetch failures`
section.

## Files

- New: `greenhouse-targets.json`, `scripts/lib/fetch-json.js`, `scripts/lib/html-to-text.js`,
  `scripts/lib/html-to-text.test.js`
- Modified: `scripts/ingest.js`, `scripts/digest.js`, `data/schema.sql`, `README.md`

## Verify

1. `node --test scripts/lib/` — html-to-text cases pass (incl. idempotency).
2. `node scripts/ingest.js` — writes `data/raw/harness-<date>.json`, `source:"greenhouse"`,
   ~2 Mountain View eng roles, plain-text descriptions, no Sales/Product/Impl-Eng roles;
   prints per-company summary; exit code 0.
3. One-off targets file with a bogus `board_token` — prints the failure, any good companies
   still write files, a row lands in `ingest_failures`, `echo $?` = 1.
4. `npm run 2normalize-jobs` then `npm run dump` — clean plain-text descriptions loaded.
5. Re-run ingest + normalize — 0 new rows (dedup stable across the HTML→text transform).
6. `npm run 4post-issue` after a run with a failure — the digest issue ends with a
   `## Fetch failures` section listing the company and reason; a second `4post-issue` does
   **not** repeat it (rows now stamped with the issue number).
