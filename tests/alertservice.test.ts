import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

vi.mock('electron', () => ({
  app: { getPath: () => process.env.TEMP || '/tmp' },
  BrowserWindow: { getAllWindows: () => [] },
}));

vi.mock('../src/main/index', () => ({ getMainWindow: () => null }));

import { alertService } from '../src/main/services/AlertService';
import { dataService } from '../src/main/database/DataService';
import * as dbModule from '../src/main/database/index';

const SCHEMA_SQL = `
CREATE TABLE servers (
  id TEXT PRIMARY KEY, name TEXT, ip TEXT, port INTEGER DEFAULT 22, username TEXT,
  auth_type TEXT, password_encrypted TEXT, private_key_path TEXT,
  monitor_interval INTEGER DEFAULT 30, monitor_items TEXT DEFAULT '["cpu"]',
  cpu_threshold INTEGER DEFAULT 90, memory_threshold INTEGER DEFAULT 90,
  disk_threshold INTEGER DEFAULT 95, network_threshold INTEGER DEFAULT 100,
  status TEXT DEFAULT 'idle', created_at TEXT, updated_at TEXT
);
CREATE TABLE metrics (id TEXT PRIMARY KEY, server_id TEXT, metric_type TEXT, value REAL, details TEXT, timestamp TEXT);
CREATE TABLE alerts (id TEXT PRIMARY KEY, server_id TEXT, alert_type TEXT,
  current_value REAL, threshold REAL, status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now')));
`;

function seedServer(memDb: Database.Database, id: string): void {
  memDb.prepare(`INSERT INTO servers (id, name, ip, port, username, auth_type, monitor_interval, monitor_items,
    cpu_threshold, memory_threshold, disk_threshold, network_threshold, status, created_at, updated_at)
    VALUES (?, 'srv', '1.1.1.1', 22, 'root', 'password', 30, '["cpu","memory","disk","network"]',
    90, 90, 95, 100, 'idle', datetime('now'), datetime('now'))`).run(id);
}

describe('AlertService', () => {
  let memDb: Database.Database;
  const sid = 'test-server';

  beforeEach(() => {
    memDb = new Database(':memory:');
    memDb.exec(SCHEMA_SQL);
    seedServer(memDb, sid);
    vi.spyOn(dbModule, 'getDatabase').mockReturnValue(memDb);
  });

  it('triggers alert when value exceeds threshold (BR-1 first time)', () => {
    alertService.checkAndAlert(sid, { serverId: sid, cpu: 95, timestamp: new Date().toISOString() });
    expect(dataService.getActiveAlert(sid, 'cpu')).toBeDefined();
  });

  it('does not duplicate alerts on consecutive overshoots (BR-1 dedup)', () => {
    alertService.checkAndAlert(sid, { serverId: sid, cpu: 95, timestamp: new Date().toISOString() });
    alertService.checkAndAlert(sid, { serverId: sid, cpu: 96, timestamp: new Date().toISOString() });
    alertService.checkAndAlert(sid, { serverId: sid, cpu: 97, timestamp: new Date().toISOString() });
    const alerts = dataService.getAlerts({ serverId: sid }, 1, 100);
    expect(alerts.records.filter((a) => a.status === 'active')).toHaveLength(1);
  });

  it('auto-recovers when value falls below threshold (BR-6)', () => {
    alertService.checkAndAlert(sid, { serverId: sid, cpu: 95, timestamp: new Date().toISOString() });
    expect(dataService.getActiveAlert(sid, 'cpu')).toBeDefined();
    alertService.checkAndAlert(sid, { serverId: sid, cpu: 50, timestamp: new Date().toISOString() });
    expect(dataService.getActiveAlert(sid, 'cpu')).toBeUndefined();
  });

  it('triggers a fresh alert after recovery + new spike', () => {
    alertService.checkAndAlert(sid, { serverId: sid, cpu: 95, timestamp: new Date().toISOString() });
    alertService.checkAndAlert(sid, { serverId: sid, cpu: 50, timestamp: new Date().toISOString() });
    alertService.checkAndAlert(sid, { serverId: sid, cpu: 99, timestamp: new Date().toISOString() });
    expect(dataService.getActiveAlert(sid, 'cpu')).toBeDefined();
  });

  it('treats different metric types independently', () => {
    alertService.checkAndAlert(sid, { serverId: sid, cpu: 95, memory: 95, timestamp: new Date().toISOString() });
    expect(dataService.getActiveAlert(sid, 'cpu')).toBeDefined();
    expect(dataService.getActiveAlert(sid, 'memory')).toBeDefined();
  });

  it('skips NaN/undefined values', () => {
    alertService.checkAndAlert(sid, { serverId: sid, cpu: NaN, timestamp: new Date().toISOString() });
    expect(dataService.getActiveAlert(sid, 'cpu')).toBeUndefined();
  });
});
