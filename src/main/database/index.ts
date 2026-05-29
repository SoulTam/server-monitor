import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import log from 'electron-log';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  ip TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 22,
  username TEXT NOT NULL,
  auth_type TEXT NOT NULL CHECK(auth_type IN ('password', 'key')),
  password_encrypted TEXT,
  private_key_path TEXT,
  monitor_interval INTEGER NOT NULL DEFAULT 30,
  monitor_items TEXT NOT NULL DEFAULT '["cpu","memory","disk","network"]',
  cpu_threshold INTEGER NOT NULL DEFAULT 90,
  memory_threshold INTEGER NOT NULL DEFAULT 90,
  disk_threshold INTEGER NOT NULL DEFAULT 95,
  network_threshold INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'idle' CHECK(status IN ('idle', 'monitoring', 'error')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS metrics (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL,
  metric_type TEXT NOT NULL CHECK(metric_type IN ('cpu', 'memory', 'disk', 'network')),
  value REAL NOT NULL,
  details TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_metrics_query
  ON metrics(server_id, metric_type, timestamp);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL,
  alert_type TEXT NOT NULL CHECK(alert_type IN ('cpu', 'memory', 'disk', 'network')),
  current_value REAL NOT NULL,
  threshold REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'dismissed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_alerts_server
  ON alerts(server_id, alert_type, status);

CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

const CURRENT_VERSION = 3;

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (db) return db;

  const dbPath = path.join(app.getPath('userData'), 'server-monitor.db');
  log.info(`Database path: ${dbPath}`);

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initSchema(db);
  return db;
}

function initSchema(database: Database.Database): void {
  const versionRow = database
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'")
    .get() as { name: string } | undefined;

  if (!versionRow) {
    database.exec(SCHEMA_SQL);
    database.prepare('INSERT INTO schema_version (version) VALUES (?)').run(CURRENT_VERSION);
    log.info(`Database initialized at version ${CURRENT_VERSION}`);
    return;
  }

  const currentVersion = database.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number };
  const ver = currentVersion?.v ?? 0;

  if (ver < 2) {
    log.info('Migrating database to version 2: add private_key_passphrase column');
    database.exec("ALTER TABLE servers ADD COLUMN private_key_passphrase TEXT");
    database.prepare('INSERT INTO schema_version (version) VALUES (2)').run();
  }

  if (ver < 3) {
    log.info('Migrating database to version 3: add system_info column');
    database.exec("ALTER TABLE servers ADD COLUMN system_info TEXT");
    database.prepare('INSERT INTO schema_version (version) VALUES (3)').run();
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
