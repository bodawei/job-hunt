# Raw dump format

Any file dropped in `data/raw/*.json` gets picked up by `normalize.js`, mapped into the
`jobs` table, then moved to `data/raw/processed/`.

```json
{
  "source": "indeed",
  "fetched_at": "2026-08-14T18:00:00Z",
  "jobs": [
    {
      "title": "Senior Software Engineer",
      "company": "Example Corp",
      "location": "Remote",
      "url": "https://to.indeed.com/aabbxdbnvhv4",
      "posted_at": "August 13, 2026",
      "job_type": "Full-time",
      "compensation": "$140,000 - $155,000 a year",
      "description": "full text, from get_job_details"
    }
  ]
}
```

`title`, `company`, and `url` are required (the `jobs` table has `NOT NULL` on all three —
`url` is still needed as the human-facing apply link, it just no longer feeds the dedup
hash, see below). `job_type` and `compensation` are stored as columns on the `jobs` table.
`description` is technically optional in this schema, but `/ingest-indeed` always fetches
it — it's both the real input for scoring and the primary dedup signal (next paragraph),
so a hand-written dump that skips it gets much weaker dedup.

`content_hash` (the dedup key) is `sha256(company|title|location|description)`, normalized
for whitespace. **Never `url`** — Indeed mints a fresh tracking URL per search call even
for the exact same posting, so hashing on it guarantees false "new" rows. When
`description` is absent, `normalize.js` falls back to
`sha256(company|title|location|posted_at|compensation)` instead.

## Indeed workflow (manual)

Run `/ingest-indeed` (see `.claude/commands/ingest-indeed.md`) in a Claude Code session
with the Indeed connector attached. With no arguments it reads `search-targets.json` at
the repo root and searches every target listed there, merging results into one dump here.
Pass a path as an argument to use a different targets file for a one-off run instead. Then
commit `data/jobs.db` plus the archived file under `data/raw/processed/` — `/ingest-indeed`
runs `npm run 2normalize-jobs` for you but does not commit or push.
