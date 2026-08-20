---
description: Search Indeed for every target in search-targets.json (or an override file) and fold results into the jobs db
---

Run a manual Indeed ingest:

1. Resolve the targets file: `$ARGUMENTS`, trimmed, if given (a path relative to the
   `job-hunt` repo root — use it as an override, one-off, don't touch
   `search-targets.json`); otherwise `search-targets.json` at the repo root. Read and
   parse it as a JSON array of `{name, search, location, country_code, job_type?}`. If
   the file is missing or isn't valid JSON matching that shape, say so and stop — don't
   guess at targets.
2. For each target, call `search_jobs` (the Indeed MCP tool) with its `search`,
   `location`, `country_code`, and `job_type` if present. Tag each result with which
   target(s) it came from.
3. **Pre-dedupe across all targets' results before fetching any details.** Multiple
   targets often surface the same real posting — collapse results that match on
   `company + title + location + posted_at + compensation` (all available straight
   from `search_jobs`, no detail fetch needed) so you don't waste a `get_job_details`
   call on a job you've already got.
4. For every remaining unique result, call `get_job_details` to get the full
   description. This is required for every result, not optional — the description is
   both the real input for later scoring and the field `normalize.js` hashes on for
   its own (authoritative) dedup against the db.
5. Write the merged results to `data/raw/indeed-<YYYY-MM-DD>.json` in job-hunt,
   following the schema in `data/raw/SCHEMA.md` (source: "indeed", fetched_at, jobs[]).
   Include `job_type` and `compensation` per job when present.
6. Run `npm run 2normalize-jobs` from the job-hunt repo root to load them into
   `data/jobs.db` and archive the raw file to `data/raw/processed/`.
7. Report a short summary: results per target, how many survived the in-run pre-dedup
   in step 3, how many were new vs. already in the db (per `normalize.js`'s own
   dedup), and remind the user the changes are uncommitted until they say to commit.

Do not commit or push automatically — stop after step 7 and wait for confirmation.
