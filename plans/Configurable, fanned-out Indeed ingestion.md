# Configurable, fanned-out Indeed ingestion

## Context

`/ingest-indeed` makes one `search_jobs` call, capped at 10 results (no pagination
param), and dedups on `sha256(company|title|url)`. Both broken, confirmed today:

- Indeed mints a fresh tracking URL per search call for the same posting (PayPal's
  Staff SWE req got 3 different URLs across 3 searches, same everything else) → url
  dedup fails.
- `company|title|location` isn't safe either — Walmart posts distinct reqs under
  identical title+location for different teams → would wrongly merge.
- Fix: hash on `company|title|location|description`. Requires `get_job_details` on
  every result (currently "optional") — needed for real scoring anyway, and
  `search_jobs` alone never returns a description.

Also moving search terms into an editable config file so the user controls what's
searched without editing the slash command. Dropping the free-text argument (easy to
fire accidentally); only argument becomes an optional override-file path.

## Changes

**1. New `search-targets.json`** (repo root) — JSON array of named targets, seeded
with the 3 variants tested today:

```json
[
  {
    "name": "swe-san-jose",
    "search": "Software Engineer",
    "location": "San Jose, CA",
    "country_code": "US"
  },
  {
    "name": "senior-swe-san-jose",
    "search": "Senior Software Engineer",
    "location": "San Jose, CA",
    "country_code": "US"
  },
  {
    "name": "staff-swe-san-jose",
    "search": "Staff Software Engineer",
    "location": "San Jose, CA",
    "country_code": "US"
  }
]
```

**2. Rewrite `.claude/commands/ingest-indeed.md`**:

- `$ARGUMENTS` = path to alternate config file if given, else `search-targets.json`.
  Error and stop if missing/invalid.
- `search_jobs` once per target.
- Pre-dedupe combined results on `company+title+location+posted_at+compensation`
  before fetching details (avoid wasted calls when targets overlap).
- `get_job_details` on every remaining result — required, not optional.
- Write merged dump, run `npm run 2normalize-jobs`.
- Report per-target/dedup/new counts. Still no auto-commit/push.

**3. Schema**: add `job_type`, `compensation` columns (currently accepted in raw
dumps, silently dropped).

- `data/schema.sql`: `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_type TEXT;` /
  `...compensation TEXT;` — migrates the existing committed db automatically via
  `openDb()`.
- `normalize.js` `INSERT`: add both fields.

**4. `normalize.js`** — fix `contentHash`. Never use `url` — it's proven unstable
(fresh per search call, even for the same posting). When description is missing, fall
back to the same weaker signal the in-run pre-dedupe already trusts
(`company+title+location+posted_at+compensation`) instead:

```js
function normalizeText(text) {
  return text.trim().replace(/\s+/g, ' ');
}
function contentHash(job) {
  const identity = job.description
    ? `${job.company}|${job.title}|${job.location}|${normalizeText(job.description)}`
    : `${job.company}|${job.title}|${job.location}|${job.posted_at}|${job.compensation}`;
  return createHash('sha256').update(identity).digest('hex');
}
```

Only affects new inserts — existing rows keep their current hash.

**5. Docs**: `data/raw/SCHEMA.md` (dedup key, new columns, new `/ingest-indeed`
behavior, `search-targets.json` shape), `CLAUDE.md` repo layout, `README.md` new
"Configuring what gets searched" section.

## Verification

1. `node --check scripts/normalize.js`.
2. Inline hash sanity check — whitespace-insensitive, description-sensitive.
3. `npm run dump` — confirm migration applies cleanly to the existing 20 rows.
4. Run `/ingest-indeed` for real.
5. `npm run dump` again — no dupes, both distinct Walmart reqs present,
   `job_type`/`compensation` populated on new rows.
6. `git status` — only `jobs.db` + archived dump changed.
