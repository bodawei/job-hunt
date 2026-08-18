# job-hunt
Explore using an LLM to help me retrieve/scrape relevant info about job availability so I don't have to be manually searching across tons of sites.

## Pipeline

See [CLAUDE.md](CLAUDE.md) for full design context. Short version: `ingest.js` /
`/ingest-indeed` → `normalize.js` → `score.js` → `digest.js` post a new GitHub Issue
(labeled `job-digest`) per run → you comment feedback on it → `parse-feedback.js`
records it.

## Leaving feedback on a digest issue

Each job in a digest is headed `### #<id> — <title> @ <company>`. To leave structured
feedback on one, comment on the issue with a small `key: value` block referencing that
id:

```
job: 3
category: backend
score: down
reason: dealbreaker - hybrid 5 days/week, not open to relocation
```

- `job` (required) — the numeric id from the job's `###` heading.
- `reason` (required) — why, in your own words. This is what eventually drives
  `criteria.md` revisions, so be specific.
- `category` (optional) — the corrected category, if `score.js` got it wrong.
- `score` (optional) — a direction (`up` / `down`), not a replacement number.

Comments missing `job:` or `reason:` are ignored (treated as ordinary discussion, not
feedback).

