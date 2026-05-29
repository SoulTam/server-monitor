import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

vi.mock('electron', () => ({
  app: {
    getPath: () => process.env.TEMP || '/tmp',
  },
}));

import { dataService } from '../src/main/database/DataService';
import * as dbModule from '../src/main/database/index';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS servers (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, ip TEXT NOT NULL, port INTEGER NOT NULL DEFAULT 22,
  username TEXT NOT NULL, auth_type TEXT NOT NULL, password_encrypted TEXT, private_key_path TEXT,
  monitor_interval INTEGER NOT NULL DEFAULT 30, monitor_items TEXT NOT NULL DEFAULT '["cpu"]',
  cpu_threshold INTEGER NOT NULL DEFAULT 90, memory_threshold INTEGER NOT NULL DEFAULT 90,
  disk_threshold INTEGER NOT NULL DEFAULT 95, network_threshold INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'idle',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS metrics (
  id TEXT PRIMARY KEY, server_id TEXT NOT NULL, metric_type TEXT NOT NULL,
  value REAL NOT NULL, details TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY, server_id TEXT NOT NULL, alert_type TEXT NOT NULL,
  current_value REAL NOT NULL, threshold REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

describe('DataService', () => {
  let memDb: Database.Database;

  beforeEach(() => {
    memDb = new Database(':memory:');
    memDb.exec(SCHEMA_SQL);
    vi.spyOn(dbModule, 'getDatabase').mockReturnValue(memDb);
  });

  it('saves and retrieves server', () => {
    const id = dataService.saveServer({
      name: 'test', ip: '1.1.1.1', port: 22, username: 'root',
      authType: 'password', password: 'enc',
      monitorInterval: 30, monitorItems: ['cpu', 'memory'],
      cpuThreshold: 90, memoryThreshold: 90, diskThreshold: 95, networkThreshold: 100,
      status: 'idle',
    });
    const s = dataService.getServer(id);
    expect(s?.name).toBe('test');
    expect(s?.ip).toBe('1.1.1.1');
    expect(s?.monitorItems).toEqual(['cpu', 'memory']);
  });

  it('updates server fields selectively', () => {
    const id = dataService.saveServer({
      name: 'a', ip: '1.1.1.1', port: 22, username: 'root',
      authType: 'password', monitorInterval: 30, monitorItems: ['cpu'],
      cpuThreshold: 90, memoryThreshold: 90, diskThreshold: 95, networkThreshold: 100,
      status: 'idle',
    });
    dataService.updateServer(id, { status: 'monitoring' });
    expect(dataService.getServer(id)?.status).toBe('monitoring');
    expect(dataService.getServer(id)?.name).toBe('a');
  });

  it('saves and queries metrics by time range', () => {
    const sid = 'srv-1';
    const now = new Date();
    dataService.saveMetric({ serverId: sid, metricType: 'cpu', value: 50, timestamp: now.toISOString() });
    const old = new Date(now.getTime() - 7200_000);
    dataService.saveMetric({ serverId: sid, metricType: 'cpu', value: 30, timestamp: old.toISOString() });

    const since = new Date(now.getTime() - 3600_000).toISOString();
    const records = dataService.getHistory(sid, 'cpu', since);
    expect(records).toHaveLength(1);
    expect(records[0].value).toBe(50);
  });

  it('returns latest metrics per type', () => {
    const sid = 'srv-2';
    const t1 = new Date(Date.now() - 60_000).toISOString();
    const t2 = new Date().toISOString();
    dataService.saveMetric({ serverId: sid, metricType: 'cpu', value: 10, timestamp: t1 });
    dataService.saveMetric({ serverId: sid, metricType: 'cpu', value: 20, timestamp: t2 });
    const latest = dataService.getLatestMetrics(sid);
    expect(latest.cpu).toBe(20);
  });

  it('cleans old metrics beyond retention', () => {
    const sid = 'srv-3';
    const old = new Date(Date.now() - 31 * 24 * 3600_000).toISOString();
    const recent = new Date().toISOString();
    dataService.saveMetric({ serverId: sid, metricType: 'cpu', value: 1, timestamp: old });
    dataService.saveMetric({ serverId: sid, metricType: 'cpu', value: 2, timestamp: recent });
    const deleted = dataService.cleanOldMetrics(30);
    expect(deleted).toBe(1);
  });

  it('finds active alert for dedup check', () => {
    const sid = 'srv-4';
    dataService.saveAlert({ serverId: sid, alertType: 'cpu', currentValue: 95, threshold: 90, status: 'active' });
    expect(dataService.getActiveAlert(sid, 'cpu')).toBeDefined();
    expect(dataService.getActiveAlert(sid, 'memory')).toBeUndefined();
  });

  it('updates alert status to dismissed', () => {
    const sid = 'srv-5';
    const id = dataService.saveAlert({ serverId: sid, alertType: 'cpu', currentValue: 95, threshold: 90, status: 'active' });
    dataService.updateAlertStatus(id, 'dismissed');
    expect(dataService.getActiveAlert(sid, 'cpu')).toBeUndefined();
  });
});
