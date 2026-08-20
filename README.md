# job-hunt
Explore using an LLM to help me retrieve/scrape relevant info about job availability so I don't have to be manually searching across tons of sites.

## Pipeline

See [CLAUDE.md](CLAUDE.md) for full design context. The npm scripts are numbered in
pipeline order — `1ingest-jobs` → `2normalize-jobs` → `3score-jobs` → `4post-issue`
→ **5: you**, reviewing the digest issue and commenting feedback on it (deliberately
not scripted — see "Human-in-the-loop" in CLAUDE.md) → `6learn-from-issue-comments`
records it.

## Configuring what gets searched

`/ingest-indeed` doesn't take a search term as an argument — it reads
[search-targets.json](search-targets.json) at the repo root and searches every target
listed there, merging all the results into one raw dump. Edit that file to change what
gets searched; no need to touch the command itself. Each entry:

```json
{ "name": "swe-san-jose", "search": "Software Engineer", "location": "San Jose, CA", "country_code": "US" }
```

`name` is just a label shown in the run summary. `search`, `location`, and
`country_code` map straight to the Indeed connector's `search_jobs` parameters
(`job_type` is also accepted, optional). Multiple targets exist because a single
`search_jobs` call caps at 10 results with no pagination — running a few varied
searches (different titles/seniority levels, say) is the only way to see more than 10
postings in one pull.

`/ingest-indeed <path>` runs a different targets file instead of the default, for a
one-off search without editing `search-targets.json`.

## Leaving feedback on a digest issue

Each job in a digest is headed `### #<id> — <title> @ <company>`. To leave structured
feedback, comment on the issue starting each job's block with its id on its own line,
followed by `category` / `score` / `reason` lines. The colon after each label is
optional — write it or don't:

```
job 3
category: backend
score: down
reason: dealbreaker - hybrid 5 days/week, not open to relocation
```

A single comment can cover multiple jobs — just start a new block with another `job
<id>` line:

```
job 5
reason a compatible role, but the database experience requirement is a stretch for me

job 9
reason this matches my skill set very well, especially the mentoring angle
```

- `job <id>` (required) — starts a block; the numeric id from that job's `###` heading.
- `reason` (required) — why, in your own words. This is what eventually drives
  `criteria.md` revisions, so be specific. Everything else on the line becomes the
  reason, so it doesn't need to be short.
- `category` (optional) — the corrected category, if `score.js` got it wrong.
- `score` (optional) — free text; a direction (`up`/`down`) or a delta (`-2`) both work,
  it's just stored as-is for you to read back later.

A block needs both a `job <id>` line and a `reason` line to be recorded — anything else
is treated as ordinary discussion, not feedback.

