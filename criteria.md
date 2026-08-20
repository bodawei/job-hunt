# Job Scoring Criteria

## Must-haves

None yet. Do not disqualify a job for missing anything.

## Dealbreakers

Full exclusion from the digest isn't wired up yet (score.js/digest.js have no
mechanism for it) — for now, a dealbreaker means score `fit_score` at 1, the minimum,
and say so explicitly in `reasoning` (e.g. "Dealbreaker: ..."). It will still appear in
the digest, just at the bottom, until real filtering exists.

- If there is no mention of JavaScript, TypeScript, or a JS/TS framework (React,
  Vue, Angular, Node.js, Next.js, etc.), but there ARE references to Java, Go or
  Python in the description: dealbreaker.

## Nice-to-haves

None yet.

## Soft negatives

Not dealbreakers — each one just nudges `fit_score` down by 1 (see Scoring guidance),
and should still be mentioned in `reasoning` when it applies.

- Mentions PowerShell scripting as a requirement.

## Categories

Sort each job into whichever of these fits best, based on its title and
description. If none fit well, use `other`.

- **backend** — server-side, infrastructure, platform, or distributed-systems roles
- **frontend** — UI/web-client-focused roles
- **fullstack** — roles spanning both frontend and backend
- **ml-ai** — machine learning, AI, or applied-research roles
- **other** — anything that doesn't fit the above

## Scoring guidance

If a dealbreaker above applies, score `fit_score` at 1 regardless of anything else,
and say why in `reasoning`. Otherwise, start from a baseline of how clear and
substantive the listing itself is (1-10) — there are no must-haves or nice-to-haves
yet, so that baseline just gives the digest something real to sort by instead of a
constant value — then subtract 1 for each soft negative above that applies, not going
below 2 (soft negatives should never fully match a real dealbreaker's floor of 1).
Write 1-2 sentences of `reasoning` noting anything a human would want to know at a
glance (compensation, location, notable requirements, anything unusual, any soft
negative that applied). Add 1-3 short `tags` (e.g. relevant tech stack keywords) when
they're obvious from the listing.
