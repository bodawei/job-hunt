---
description: Search Indeed via the MCP connector and fold results into the jobs db
---

Run a manual Indeed ingest:

1. Search terms/location: use `$ARGUMENTS` if given (format: title | location | country
   code, e.g. `Senior Software Engineer | Remote | US`). If empty, ask the user for
   search terms and location before continuing — don't guess.
2. Call `search_jobs` (the Indeed MCP tool) for those terms. For each result worth
   keeping, optionally call `get_job_details` to pull the full description.
3. Write the results to `data/raw/indeed-<YYYY-MM-DD>.json` in job-hunt, following the
   schema in `data/raw/SCHEMA.md` (source: "indeed", fetched_at, jobs[]).
4. Run `npm run normalize` from the job-hunt repo root to load them into `data/jobs.db`
   and archive the raw file to `data/raw/processed/`.
5. Report a short summary: how many jobs were found, how many were new (vs. deduped
   against existing rows), and remind the user the changes are uncommitted until they
   say to commit.

Do not commit or push automatically — stop after step 5 and wait for confirmation.
