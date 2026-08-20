# Appendix section for score-1 (dealbreaker) jobs in the digest

## Context

Since the last `criteria.md` revision, `fit_score === 1` is reserved exclusively for
real dealbreakers (soft negatives floor at 2, everything else scores on listing
clarity) — so it's now a clean, unambiguous signal to filter on. Right now
`digest.js` puts every scored job into its category section with the same full
formatting (heading, fit score, location, tags, full reasoning paragraph), which
means dealbreaker jobs take up as much visual space as everything else. The user
wants them pushed out of the main listing into a low-emphasis appendix instead —
still visible (nothing's silently dropped), but clearly de-prioritized: one bullet
per job, a link, and a one-line reason instead of the full block.

## Changes

**`scripts/digest.js`** only — no other files need to change.

1. In `main()`, split the existing query result (`jobs`, unchanged query) into two
   groups: `appendixJobs = jobs.filter(j => j.fit_score === 1)` and everything else.
   Build `jobsByCategory` from the non-appendix set only (unchanged logic otherwise),
   so a category with only score-1 jobs simply won't appear in the main listing.
2. Add a `terseReason(reasoning)` helper: take the first sentence of `reasoning`
   (split on the first `.`/`!`/`?`), and if that's still long, hard-truncate at a
   word boundary (~90 chars) with `…`. `criteria.md` already asks dealbreaker
   reasoning to start with "Dealbreaker: ...", so the first sentence alone is
   normally the whole explanation already — this just guards the edge case.
3. Add a `formatAppendixJob(job)` helper producing one bullet:
   `- [${job.title}](${job.url}) @ ${job.company} — ${terseReason(job.reasoning)}`
4. `buildBody(jobsByCategory, appendixJobs)`: after all the normal category
   sections (unchanged), if `appendixJobs.length > 0` append one more section:
   `## Fit score: 1/10 (${count})` followed by the bullets. Skipped entirely if
   there are no score-1 jobs this run.
5. The `digest_issue_number` update loop at the end of `main()` already iterates
   the full original `jobs` array — no change needed there; appendix jobs still get
   marked as digested like everything else, just rendered differently.

## Verification

1. `node --check scripts/digest.js`.
2. Inline `node -e` test of `terseReason` against a couple of real `reasoning`
   strings already in `data/jobs.db` (e.g. job #42's dealbreaker reasoning) to
   confirm it actually reads as "less than a full line."
3. Point `digest.js` at the real db (there are currently several `fit_score === 1`
   rows from the dealbreaker testing) and inspect the generated body text before
   posting — confirm the main sections exclude them and the appendix lists them
   correctly, without actually calling `gh issue create` (dry-run by reading the
   built body directly rather than running `main()` end-to-end, to avoid posting a
   real issue during verification).
