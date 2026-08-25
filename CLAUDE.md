# Code style

- If, while and so on must always enclose their bodies in {}'s.  (No "if true then console.log()" kinds of things)
- Only add comments when the code in question is not obvious.

# Job Search Automation — Project Context

This file gives Claude Code full context on this project. Read it before doing any work here.

## Goal

A system that finds relevant job postings daily, scores them against a living criteria
document using Claude, and delivers a categorized digest — with a feedback loop that
actually improves the criteria over time (not just thumbs up/down).

## Stack decisions (already made, don't relitigate)

- **Language**: JavaScript / Node.js throughout (not Python). Reasons: Playwright's
  primary API is JS/TS (better docs, gets features first); `node:sqlite` or
  `better-sqlite3` both work well for single-writer batch jobs; Claude's JS SDK is
  equally good; GitHub Actions supports Node natively via `actions/setup-node`.
- **Database**: SQLite, as a single file (`data/jobs.db`) **committed directly to this
  git repo**. No hosted DB service needed at this stage — one process (the daily
  GitHub Action) writes to it once a day, so there's no real concurrency to manage.
  This also gives free version history via git.
  - Use `node:sqlite` (built into Node 22+, zero install) or `better-sqlite3`
    (more mature, one `npm install` away) — either is fine, pick one and be consistent.
- **Scheduling / compute**: GitHub Actions, cron-triggered (`schedule` in workflow
  YAML). Entire pipeline runs unattended once a day.
- **Digest delivery**: A new **GitHub Issue** per run, one entry per job, grouped by
  category and sorted by score, with the model's reasoning inline. (Deliberately
  starting here over a hosted page/email — revisit only if this becomes limiting.)
- **Feedback capture**: Comments on the digest Issue. NOT thumbs-up/down — each
  comment should carry a structured correction: corrected category/score direction,
  plus a short reason in the user's own words (e.g. "dealbreaker: contract-to-hire,
  not full-time"). A second workflow, triggered on `issue_comment`, parses these into
  a `feedback` table linked to the job row.
- **Criteria revision**: Deliberately NOT automated end-to-end. Periodically (e.g.
  weekly), review recent `feedback` rows against `criteria.md` in a conversation
  (Claude Code or Cowork) — Claude proposes a diff, the user reviews/edits and commits
  it normally. This keeps a readable git history of *why* the criteria changed.

## Repo layout

```
/data/jobs.db              SQLite db — jobs, feedback, seen-hash dedup
/criteria.md                The living scoring doc: must-haves, dealbreakers,
                             nice-to-haves, category definitions. This is the
                             single most important file in the project — treat
                             edits to it as the main lever for improving results.
/search-targets.json         Named Indeed search targets (title/location/country)
                             that /ingest-indeed fans out over by default. Edit
                             this to change what gets searched.
/scripts/ingest.js           Pull listings: Greenhouse/Lever/Ashby APIs where
                             available, Playwright for JS-heavy career pages
                             without a public feed.
/scripts/normalize.js        Map raw listings to common schema; hash-based dedup
                             on (company + title + location + description) — never
                             URL, which Indeed regenerates per search call.
/scripts/score.js            For each new job: call Claude with the job description
                             + full criteria.md + the 5-10 most similar past,
                             feedback-annotated jobs (embedding similarity) →
                             structured JSON {category, fit_score, reasoning, tags}.
/scripts/digest.js           Group/sort scored jobs, post as a new GitHub Issue.
/scripts/parse-feedback.js   Parse issue_comment payloads into feedback table rows.
/.github/workflows/daily.yml     Cron trigger → ingest → normalize → score →
                                  digest → commit jobs.db back to repo.
/.github/workflows/feedback.yml  Triggered on issue_comment → parse-feedback.js →
                                  append to feedback table, commit.
```

## Design principles

- **Criteria as a living document**, never hardcoded scoring logic. `criteria.md` is
  read fresh by `score.js` on every run.
- **Structured feedback, not binary reactions** — the *reason* for a correction is
  what makes criteria revision possible. A thumbs-down alone can't distinguish "the
  model misjudged this one" from "the criteria doc is missing a rule."
- **Retrieval-based few-shot for scoring**, not a static example set — embed the new
  job, pull the most *similar* labeled past examples, not a fixed sample. Keeps the
  scoring prompt lean and relevant as the feedback table grows past ~100 rows.
- **Human-in-the-loop for criteria edits** — this is intentional friction. The
  criteria-revision step should stay a conversation, not a fully automated rewrite.

## Not yet built (natural next steps)

- [x] `data/jobs.db` schema (jobs, feedback, seen-hash tables)
- [x] `daily.yml` + `feedback.yml` workflows
- [x] `normalize.js`, `score.js`, `digest.js`, `parse-feedback.js` implemented
- [x] `criteria.md` — placeholder/permissive version only, to validate the pipeline
      end-to-end (deliberate, see file header). Real must-haves/dealbreakers/category
      definitions still need to be drafted with the user once there's feedback to
      react to.
- [ ] `ingest.js` — still a stub; real ingestion so far is the manual
      `/ingest-indeed` path only (see README "Pipeline")
- [ ] Decide specific job boards + target company career pages to start with
- [ ] Test Playwright reliability against 2-3 real target company sites before
      committing to the scraping approach broadly
- [ ] Add `ANTHROPIC_API_KEY` as a repo secret (needed by `daily.yml`'s `score`
      step) — not yet set, has to be done by the user via `gh secret set` or the
      GitHub UI
- [ ] Once `feedback` has real rows, add retrieval-based few-shot to `score.js`
      (see TODO in that file)

## Explicitly deferred (don't build yet)

- Hosted database (Turso/Supabase) — only if the git-committed SQLite file becomes
  limiting.
- Hosted digest page or email delivery — only if GitHub Issues becomes limiting.



## Note to self
- One thing worth knowing: CLAUDE.md files are meant to stay fairly lean — some teams keep theirs under a couple hundred lines since Claude Code re-reads it constantly. This one's a reasonable size for a project kickoff; once the scripts exist, you can trim the "not yet built" section down as things get checked off.
- 
