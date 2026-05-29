import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './index';
import type { ServerConfig, MetricRecord, AlertRecord, MetricType, AlertStatus } from '../../shared/types';

export class DataService {
  saveServer(server: Omit<ServerConfig, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): string {
    const db = getDatabase();
    const id = server.id || uuidv4();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO servers (id, name, ip, port, username, auth_type, password_encrypted, private_key_path, private_key_passphrase, system_info,
        monitor_interval, monitor_items, cpu_threshold, memory_threshold, disk_threshold, network_threshold, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, server.name, server.ip, server.port, server.username, server.authType,
      server.password || null, server.privateKeyPath || null, server.privateKeyPassphrase || null,
      server.systemInfo ? JSON.stringify(server.systemInfo) : null,
      server.monitorInterval, JSON.stringify(server.monitorItems),
      server.cpuThreshold, server.memoryThreshold, server.diskThreshold, server.networkThreshold,
      server.status, now, now,
    );
    return id;
  }

  updateServer(id: string, fields: Partial<ServerConfig>): void {
    const db = getDatabase();
    const sets: string[] = [];
    const values: unknown[] = [];

    const fieldMap: Record<string, string> = {
      name: 'name', ip: 'ip', port: 'port', username: 'username',
      authType: 'auth_type', password: 'password_encrypted', privateKeyPath: 'private_key_path',
      privateKeyPassphrase: 'private_key_passphrase', systemInfo: 'system_info',
      monitorInterval: 'monitor_interval', cpuThreshold: 'cpu_threshold',
      memoryThreshold: 'memory_threshold', diskThreshold: 'disk_threshold',
      networkThreshold: 'network_threshold', status: 'status',
    };

    for (const [key, col] of Object.entries(fieldMap)) {
      if (key in fields) {
        const val = (fields as Record<string, unknown>)[key];
        sets.push(`${col} = ?`);
        if (key === 'systemInfo' && val && typeof val === 'object') {
          values.push(JSON.stringify(val));
        } else {
          values.push(val ?? null);
        }
      }
    }

    if ('monitorItems' in fields) {
      sets.push('monitor_items = ?');
      values.push(JSON.stringify(fields.monitorItems));
    }

    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    values.push(id);

    db.prepare(`UPDATE servers SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }

  deleteServer(id: string): void {
    const db = getDatabase();
    db.prepare('DELETE FROM servers WHERE id = ?').run(id);
  }

  getServer(id: string): ServerConfig | undefined {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM servers WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.mapServerRow(row) : undefined;
  }

  listServers(): ServerConfig[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM servers ORDER BY created_at DESC').all() as Record<string, unknown>[];
    return rows.map((r) => this.mapServerRow(r));
  }

  saveMetric(metric: Omit<MetricRecord, 'id'>): string {
    const db = getDatabase();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO metrics (id, server_id, metric_type, value, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, metric.serverId, metric.metricType, metric.value, metric.details || null, metric.timestamp);
    return id;
  }

  getHistory(serverId: string, metricType: MetricType, since: string): MetricRecord[] {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM metrics WHERE server_id = ? AND metric_type = ? AND timestamp >= ?
      ORDER BY timestamp ASC
    `).all(serverId, metricType, since) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: r.id as string,
      serverId: r.server_id as string,
      metricType: r.metric_type as MetricType,
      value: r.value as number,
      details: r.details as string | undefined,
      timestamp: r.timestamp as string,
    }));
  }

  getLatestMetrics(serverId: string): Record<MetricType, number | undefined> {
    const db = getDatabase();
    const result: Record<string, number | undefined> = { cpu: undefined, memory: undefined, disk: undefined, network: undefined };
    const types: MetricType[] = ['cpu', 'memory', 'disk', 'network'];
    for (const t of types) {
      const row = db.prepare(`
        SELECT value FROM metrics WHERE server_id = ? AND metric_type = ?
        ORDER BY timestamp DESC LIMIT 1
      `).get(serverId, t) as { value: number } | undefined;
      result[t] = row?.value;
    }
    return result as Record<MetricType, number | undefined>;
  }

  cleanOldMetrics(retentionDays: number): number {
    const db = getDatabase();
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
    const info = db.prepare('DELETE FROM metrics WHERE timestamp < ?').run(cutoff);
    return info.changes;
  }

  saveAlert(alert: Omit<AlertRecord, 'id' | 'createdAt'>): string {
    const db = getDatabase();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO alerts (id, server_id, alert_type, current_value, threshold, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(id, alert.serverId, alert.alertType, alert.currentValue, alert.threshold, alert.status);
    return id;
  }

  getAlerts(
    filters: { serverId?: string; alertType?: MetricType; status?: AlertStatus },
    page = 1,
    pageSize = 20,
  ): { records: AlertRecord[]; total: number } {
    const db = getDatabase();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.serverId) { conditions.push('server_id = ?'); params.push(filters.serverId); }
    if (filters.alertType) { conditions.push('alert_type = ?'); params.push(filters.alertType); }
    if (filters.status) { conditions.push('status = ?'); params.push(filters.status); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRow = db.prepare(`SELECT COUNT(*) as cnt FROM alerts ${where}`).get(...params) as { cnt: number };
    const rows = db.prepare(`SELECT * FROM alerts ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .all(...params, pageSize, (page - 1) * pageSize) as Record<string, unknown>[];

    return {
      total: countRow.cnt,
      records: rows.map((r) => ({
        id: r.id as string,
        serverId: r.server_id as string,
        alertType: r.alert_type as MetricType,
        currentValue: r.current_value as number,
        threshold: r.threshold as number,
        status: r.status as AlertStatus,
        createdAt: r.created_at as string,
      })),
    };
  }

  updateAlertStatus(id: string, status: AlertStatus): void {
    const db = getDatabase();
    db.prepare('UPDATE alerts SET status = ? WHERE id = ?').run(status, id);
  }

  getActiveAlert(serverId: string, alertType: MetricType): AlertRecord | undefined {
    const db = getDatabase();
    const row = db.prepare(
      "SELECT * FROM alerts WHERE server_id = ? AND alert_type = ? AND status = 'active' LIMIT 1",
    ).get(serverId, alertType) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      id: row.id as string,
      serverId: row.server_id as string,
      alertType: row.alert_type as MetricType,
      currentValue: row.current_value as number,
      threshold: row.threshold as number,
      status: row.status as AlertStatus,
      createdAt: row.created_at as string,
    };
  }

  private mapServerRow(row: Record<string, unknown>): ServerConfig {
    return {
      id: row.id as string,
      name: row.name as string,
      ip: row.ip as string,
      port: row.port as number,
      username: row.username as string,
      authType: row.auth_type as 'password' | 'key',
      password: row.password_encrypted as string | undefined,
      privateKeyPath: row.private_key_path as string | undefined,
      privateKeyPassphrase: row.private_key_passphrase as string | undefined,
      systemInfo: row.system_info ? JSON.parse(row.system_info as string) : undefined,
      monitorInterval: row.monitor_interval as number,
      monitorItems: JSON.parse(row.monitor_items as string),
      cpuThreshold: row.cpu_threshold as number,
      memoryThreshold: row.memory_threshold as number,
      diskThreshold: row.disk_threshold as number,
      networkThreshold: row.network_threshold as number,
      status: row.status as ServerConfig['status'],
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}

export const dataService = new DataService();
