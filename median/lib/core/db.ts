import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { paths } from "./config";

/*
 * Baza de date SQLite (un singur fișier, mod WAL): worker-ul scrie, site-ul citește.
 * Migrațiile sunt aplicate automat la pornire, în ordine, o singură dată.
 */

const MIGRATIONS: string[] = [
  // 1 — schema inițială
  `
  CREATE TABLE sources (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    site TEXT NOT NULL,
    feed_url TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    kind TEXT,
    tier INTEGER NOT NULL DEFAULT 2,
    enabled INTEGER NOT NULL DEFAULT 1,
    hero_images INTEGER NOT NULL DEFAULT 0,
    etag TEXT,
    last_modified TEXT,
    next_fetch_at INTEGER NOT NULL DEFAULT 0,
    last_fetch_at INTEGER,
    last_status TEXT,
    last_error TEXT,
    fail_count INTEGER NOT NULL DEFAULT 0,
    items_total INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE items (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES sources(id),
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    author TEXT,
    category TEXT NOT NULL,
    published_at INTEGER NOT NULL,
    fetched_at INTEGER NOT NULL,
    story_id TEXT,
    fingerprint TEXT NOT NULL DEFAULT '',
    image_candidates TEXT NOT NULL DEFAULT '[]',
    thumb_image_id INTEGER,
    fulltext TEXT,
    fulltext_status TEXT NOT NULL DEFAULT 'none',
    duplicate_of TEXT
  );
  CREATE INDEX items_story ON items(story_id);
  CREATE INDEX items_published ON items(published_at DESC);
  CREATE INDEX items_source ON items(source_id, published_at DESC);

  CREATE TABLE stories (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL,
    category TEXT NOT NULL,
    region TEXT,
    title TEXT NOT NULL,
    keywords TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    first_published_at INTEGER NOT NULL,
    last_published_at INTEGER NOT NULL,
    source_count INTEGER NOT NULL DEFAULT 1,
    item_count INTEGER NOT NULL DEFAULT 1,
    score REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    pinned INTEGER NOT NULL DEFAULT 0,
    breaking INTEGER NOT NULL DEFAULT 0,
    sensitive TEXT,
    article_id INTEGER,
    hero_image_id INTEGER,
    written_source_count INTEGER NOT NULL DEFAULT 0,
    written_at INTEGER
  );
  CREATE INDEX stories_updated ON stories(last_published_at DESC);
  CREATE INDEX stories_category ON stories(category, last_published_at DESC);
  CREATE INDEX stories_score ON stories(score DESC);

  CREATE TABLE articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id TEXT NOT NULL REFERENCES stories(id),
    version INTEGER NOT NULL DEFAULT 1,
    kind TEXT NOT NULL,
    status TEXT NOT NULL,
    headline TEXT NOT NULL,
    dek TEXT NOT NULL DEFAULT '',
    key_points TEXT NOT NULL DEFAULT '[]',
    sections TEXT NOT NULL DEFAULT '[]',
    context TEXT NOT NULL DEFAULT '',
    why TEXT NOT NULL DEFAULT '',
    quotes TEXT NOT NULL DEFAULT '[]',
    tags TEXT NOT NULL DEFAULT '[]',
    entities TEXT NOT NULL DEFAULT '[]',
    image_query TEXT NOT NULL DEFAULT '',
    region TEXT,
    sources TEXT NOT NULL DEFAULT '[]',
    word_count INTEGER NOT NULL DEFAULT 0,
    model TEXT,
    tokens_in INTEGER NOT NULL DEFAULT 0,
    tokens_out INTEGER NOT NULL DEFAULT 0,
    cost_usd REAL NOT NULL DEFAULT 0,
    verification TEXT NOT NULL DEFAULT '{}',
    review_reason TEXT,
    created_at INTEGER NOT NULL,
    published_at INTEGER,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX articles_story ON articles(story_id, version DESC);
  CREATE INDEX articles_status ON articles(status, published_at DESC);

  CREATE TABLE images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    original_url TEXT NOT NULL,
    file_base TEXT,
    widths TEXT NOT NULL DEFAULT '[]',
    width INTEGER,
    height INTEGER,
    thumbhash TEXT,
    color TEXT,
    ahash TEXT,
    credit TEXT NOT NULL DEFAULT '',
    credit_url TEXT,
    license TEXT,
    license_url TEXT,
    source_id TEXT,
    status TEXT NOT NULL DEFAULT 'ok',
    created_at INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX images_original ON images(original_url, kind);

  CREATE TABLE source_image_hashes (
    source_id TEXT NOT NULL,
    hash TEXT NOT NULL,
    seen INTEGER NOT NULL DEFAULT 1,
    first_at INTEGER NOT NULL,
    last_at INTEGER NOT NULL,
    PRIMARY KEY (source_id, hash)
  );

  CREATE TABLE jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    key TEXT NOT NULL UNIQUE,
    payload TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'queued',
    priority INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    run_after INTEGER NOT NULL DEFAULT 0,
    locked_at INTEGER,
    last_error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX jobs_ready ON jobs(status, type, priority DESC, run_after);

  CREATE TABLE ai_usage (
    day TEXT PRIMARY KEY,
    calls INTEGER NOT NULL DEFAULT 0,
    articles INTEGER NOT NULL DEFAULT 0,
    briefs INTEGER NOT NULL DEFAULT 0,
    tokens_in INTEGER NOT NULL DEFAULT 0,
    tokens_out INTEGER NOT NULL DEFAULT 0,
    cost_usd REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

  CREATE TABLE views (
    story_id TEXT NOT NULL,
    day TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (story_id, day)
  );

  CREATE TABLE corrections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at INTEGER NOT NULL,
    level TEXT NOT NULL,
    message TEXT NOT NULL
  );

  CREATE VIRTUAL TABLE search USING fts5(
    story_id UNINDEXED, title, body,
    tokenize = 'unicode61 remove_diacritics 2'
  );
  `,
];

type DB = Database.Database;
const g = globalThis as unknown as { __medianDb?: DB };

export function db(): DB {
  if (g.__medianDb) return g.__medianDb;
  fs.mkdirSync(path.dirname(paths.db), { recursive: true });
  const d = new Database(paths.db);
  d.pragma("journal_mode = WAL");
  d.pragma("synchronous = NORMAL");
  d.pragma("busy_timeout = 5000");
  d.pragma("foreign_keys = ON");
  migrate(d);
  g.__medianDb = d;
  return d;
}

function migrate(d: DB) {
  const version = d.pragma("user_version", { simple: true }) as number;
  for (let i = version; i < MIGRATIONS.length; i++) {
    d.transaction(() => {
      d.exec(MIGRATIONS[i]);
      d.pragma(`user_version = ${i + 1}`);
    })();
  }
}

/** Închide conexiunea (folosit în teste). */
export function closeDb() {
  g.__medianDb?.close();
  g.__medianDb = undefined;
}

export function getSetting<T>(key: string, fallback: T): T {
  const row = db().prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

export function setSetting(key: string, value: unknown) {
  db().prepare("INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, JSON.stringify(value));
}

export function logEvent(level: "info" | "warn" | "error", message: string) {
  const line = `[median] ${message}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
  try {
    const d = db();
    d.prepare("INSERT INTO events(at, level, message) VALUES (?, ?, ?)").run(Date.now(), level, message.slice(0, 1000));
    // Păstrăm doar ultimele ~2000 de evenimente.
    d.prepare("DELETE FROM events WHERE id < (SELECT MAX(id) - 2000 FROM events)").run();
  } catch {
    /* jurnalizarea nu trebuie să oprească niciodată lucrul */
  }
}

export function today(ts = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest" }).format(ts);
}
