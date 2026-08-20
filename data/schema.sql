CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  location TEXT,
  source TEXT NOT NULL,
  content_hash TEXT NOT NULL UNIQUE,
  posted_at TEXT,
  job_type TEXT,
  compensation TEXT,
  category TEXT,
  fit_score REAL,
  reasoning TEXT,
  tags TEXT,
  scored_at TEXT,
  digest_issue_number INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES jobs(id),
  corrected_category TEXT,
  corrected_score_direction TEXT,
  reason TEXT NOT NULL,
  github_comment_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_feedback_job_id ON feedback(job_id);
