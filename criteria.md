# Job Scoring Criteria

**Status: placeholder.** This is a deliberately permissive first pass, meant to
validate the ingest → score → digest → feedback loop end-to-end before
investing time in real criteria. Nothing below should cause a job to be
excluded or scored down — there are no must-haves or dealbreakers yet, only
enough structure for `score.js` to produce a real category and a real
sentence of reasoning per job. Revisit this file once a few digest cycles
have produced actual feedback to react to.

## Must-haves

None yet. Do not disqualify a job for missing anything.

## Dealbreakers

None yet. Do not downrank a job for anything you find here.

## Nice-to-haves

None yet.

## Categories

Sort each job into whichever of these fits best, based on its title and
description. If none fit well, use `other`.

- **backend** — server-side, infrastructure, platform, or distributed-systems roles
- **frontend** — UI/web-client-focused roles
- **fullstack** — roles spanning both frontend and backend
- **ml-ai** — machine learning, AI, or applied-research roles
- **other** — anything that doesn't fit the above

## Scoring guidance

Score `fit_score` from 1-10 based only on how clear and substantive the
listing itself is (not on fit to any personal criteria, since none exist
yet) — this just gives the digest something real to sort by instead of a
constant value. Write 1-2 sentences of `reasoning` noting anything a human
would want to know at a glance (compensation, location, notable
requirements, anything unusual). Add 1-3 short `tags` (e.g. relevant tech
stack keywords) when they're obvious from the listing.
