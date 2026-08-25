// Resilient JSON GET over global fetch, shared by ingesters.
//
// fetch() resolves (doesn't throw) on 4xx/5xx, so an unattended run would happily
// read garbage or crash deep in a mapping loop. This wrapper turns a non-ok response
// into a typed HttpError, times each request out, and retries transient failures
// (network errors and 5xx) — but never 4xx, which are deterministic.

export class HttpError extends Error {
  constructor(status, url) {
    super(`HTTP ${status} from ${url}`);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
  }
}

const TIMEOUT_MS = 10_000;
const RETRIES = 2;
const BACKOFF_MS = 500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchJson(url, { retries = RETRIES } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) {
        // 4xx is deterministic — a bad token or path won't fix itself, so fail fast.
        if (res.status < 500) throw new HttpError(res.status, url);
        lastError = new HttpError(res.status, url);
      } else {
        return await res.json();
      }
    } catch (err) {
      if (err instanceof HttpError && err.status < 500) throw err;
      lastError = err;
    }
    if (attempt < retries) await sleep(BACKOFF_MS * (attempt + 1));
  }
  throw lastError;
}
