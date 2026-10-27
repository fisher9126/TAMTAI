'use strict';
/* SQLite through Node's built-in node:sqlite (Node 22.13+). One file: data/aetherfall.db */
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const file = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'aetherfall.db');
fs.mkdirSync(path.dirname(file), { recursive: true });
const db = new DatabaseSync(file);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'player',
  created_at INTEGER NOT NULL,
  last_login INTEGER,
  last_ip TEXT,
  banned_until INTEGER NOT NULL DEFAULT 0,
  ban_reason TEXT,
  muted_until INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS characters (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  gold INTEGER NOT NULL DEFAULT 0,
  x REAL NOT NULL DEFAULT 1,
  z REAL NOT NULL DEFAULT 9,
  play_seconds INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS friends (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, friend_id)
);
CREATE TABLE IF NOT EXISTS mail (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_name TEXT NOT NULL,
  message TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  claimed_at INTEGER
);
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS chat_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  channel TEXT NOT NULL,
  target TEXT,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER,
  action TEXT NOT NULL,
  target_id INTEGER,
  detail TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mail_user ON mail(user_id, claimed_at);
CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_log(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
`);

const cache = new Map();
function stmt(sql) {
  let s = cache.get(sql);
  if (!s) { s = db.prepare(sql); cache.set(sql, s); }
  return s;
}
const plain = (r) => (r ? Object.assign({}, r) : r);
module.exports = {
  file,
  run: (sql, ...p) => stmt(sql).run(...p),
  get: (sql, ...p) => plain(stmt(sql).get(...p)),
  all: (sql, ...p) => stmt(sql).all(...p).map(plain),
  exec: (sql) => db.exec(sql),
  tx(fn) { db.exec('BEGIN'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } },
  close: () => db.close()
};
