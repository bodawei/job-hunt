# Raw dump format

Any file dropped in `data/raw/*.json` gets picked up by `normalize.js`, mapped into the
`jobs` table (deduped on `content_hash` = sha256 of `company|title|url`), then moved to
`data/raw/processed/`.

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
      "description": "optional, from get_job_details"
    }
  ]
}
```

`title`, `company`, and `url` are required (they feed the dedup hash). Everything else is
optional. `job_type` and `compensation` aren't columns in the `jobs` table yet — they're
accepted in the raw file but currently dropped by `normalize.js` until the schema grows to
fit them.

## Indeed workflow (manual)

Ask Claude, in a session with the Indeed connector attached, to search Indeed for your
criteria and write a dump here following this schema. Then run `npm run 2normalize-jobs` and
commit `data/jobs.db` plus the archived file under `data/raw/processed/`.
