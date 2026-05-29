"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataService = exports.DataService = void 0;
const uuid_1 = require("uuid");
const index_1 = require("./index");
class DataService {
    saveServer(server) {
        const db = (0, index_1.getDatabase)();
        const id = server.id || (0, uuid_1.v4)();
        const now = new Date().toISOString();
        db.prepare(`
      INSERT INTO servers (id, name, ip, port, username, auth_type, password_encrypted, private_key_path, private_key_passphrase, system_info,
        monitor_interval, monitor_items, cpu_threshold, memory_threshold, disk_threshold, network_threshold, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, server.name, server.ip, server.port, server.username, server.authType, server.password || null, server.privateKeyPath || null, server.privateKeyPassphrase || null, server.systemInfo ? JSON.stringify(server.systemInfo) : null, server.monitorInterval, JSON.stringify(server.monitorItems), server.cpuThreshold, server.memoryThreshold, server.diskThreshold, server.networkThreshold, server.status, now, now);
        return id;
    }
    updateServer(id, fields) {
        const db = (0, index_1.getDatabase)();
        const sets = [];
        const values = [];
        const fieldMap = {
            name: 'name', ip: 'ip', port: 'port', username: 'username',
            authType: 'auth_type', password: 'password_encrypted', privateKeyPath: 'private_key_path',
            privateKeyPassphrase: 'private_key_passphrase', systemInfo: 'system_info',
            monitorInterval: 'monitor_interval', cpuThreshold: 'cpu_threshold',
            memoryThreshold: 'memory_threshold', diskThreshold: 'disk_threshold',
            networkThreshold: 'network_threshold', status: 'status',
        };
        for (const [key, col] of Object.entries(fieldMap)) {
            if (key in fields) {
                const val = fields[key];
                sets.push(`${col} = ?`);
                if (key === 'systemInfo' && val && typeof val === 'object') {
                    values.push(JSON.stringify(val));
                }
                else {
                    values.push(val ?? null);
                }
            }
        }
        if ('monitorItems' in fields) {
            sets.push('monitor_items = ?');
            values.push(JSON.stringify(fields.monitorItems));
        }
        if (sets.length === 0)
            return;
        sets.push("updated_at = datetime('now')");
        values.push(id);
        db.prepare(`UPDATE servers SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    }
    deleteServer(id) {
        const db = (0, index_1.getDatabase)();
        db.prepare('DELETE FROM servers WHERE id = ?').run(id);
    }
    getServer(id) {
        const db = (0, index_1.getDatabase)();
        const row = db.prepare('SELECT * FROM servers WHERE id = ?').get(id);
        return row ? this.mapServerRow(row) : undefined;
    }
    listServers() {
        const db = (0, index_1.getDatabase)();
        const rows = db.prepare('SELECT * FROM servers ORDER BY created_at DESC').all();
        return rows.map((r) => this.mapServerRow(r));
    }
    saveMetric(metric) {
        const db = (0, index_1.getDatabase)();
        const id = (0, uuid_1.v4)();
        db.prepare(`
      INSERT INTO metrics (id, server_id, metric_type, value, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, metric.serverId, metric.metricType, metric.value, metric.details || null, metric.timestamp);
        return id;
    }
    getHistory(serverId, metricType, since) {
        const db = (0, index_1.getDatabase)();
        const rows = db.prepare(`
      SELECT * FROM metrics WHERE server_id = ? AND metric_type = ? AND timestamp >= ?
      ORDER BY timestamp ASC
    `).all(serverId, metricType, since);
        return rows.map((r) => ({
            id: r.id,
            serverId: r.server_id,
            metricType: r.metric_type,
            value: r.value,
            details: r.details,
            timestamp: r.timestamp,
        }));
    }
    getLatestMetrics(serverId) {
        const db = (0, index_1.getDatabase)();
        const result = { cpu: undefined, memory: undefined, disk: undefined, network: undefined };
        const types = ['cpu', 'memory', 'disk', 'network'];
        for (const t of types) {
            const row = db.prepare(`
        SELECT value FROM metrics WHERE server_id = ? AND metric_type = ?
        ORDER BY timestamp DESC LIMIT 1
      `).get(serverId, t);
            result[t] = row?.value;
        }
        return result;
    }
    cleanOldMetrics(retentionDays) {
        const db = (0, index_1.getDatabase)();
        const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
        const info = db.prepare('DELETE FROM metrics WHERE timestamp < ?').run(cutoff);
        return info.changes;
    }
    saveAlert(alert) {
        const db = (0, index_1.getDatabase)();
        const id = (0, uuid_1.v4)();
        db.prepare(`
      INSERT INTO alerts (id, server_id, alert_type, current_value, threshold, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(id, alert.serverId, alert.alertType, alert.currentValue, alert.threshold, alert.status);
        return id;
    }
    getAlerts(filters, page = 1, pageSize = 20) {
        const db = (0, index_1.getDatabase)();
        const conditions = [];
        const params = [];
        if (filters.serverId) {
            conditions.push('server_id = ?');
            params.push(filters.serverId);
        }
        if (filters.alertType) {
            conditions.push('alert_type = ?');
            params.push(filters.alertType);
        }
        if (filters.status) {
            conditions.push('status = ?');
            params.push(filters.status);
        }
        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const countRow = db.prepare(`SELECT COUNT(*) as cnt FROM alerts ${where}`).get(...params);
        const rows = db.prepare(`SELECT * FROM alerts ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
            .all(...params, pageSize, (page - 1) * pageSize);
        return {
            total: countRow.cnt,
            records: rows.map((r) => ({
                id: r.id,
                serverId: r.server_id,
                alertType: r.alert_type,
                currentValue: r.current_value,
                threshold: r.threshold,
                status: r.status,
                createdAt: r.created_at,
            })),
        };
    }
    updateAlertStatus(id, status) {
        const db = (0, index_1.getDatabase)();
        db.prepare('UPDATE alerts SET status = ? WHERE id = ?').run(status, id);
    }
    getActiveAlert(serverId, alertType) {
        const db = (0, index_1.getDatabase)();
        const row = db.prepare("SELECT * FROM alerts WHERE server_id = ? AND alert_type = ? AND status = 'active' LIMIT 1").get(serverId, alertType);
        if (!row)
            return undefined;
        return {
            id: row.id,
            serverId: row.server_id,
            alertType: row.alert_type,
            currentValue: row.current_value,
            threshold: row.threshold,
            status: row.status,
            createdAt: row.created_at,
        };
    }
    mapServerRow(row) {
        return {
            id: row.id,
            name: row.name,
            ip: row.ip,
            port: row.port,
            username: row.username,
            authType: row.auth_type,
            password: row.password_encrypted,
            privateKeyPath: row.private_key_path,
            privateKeyPassphrase: row.private_key_passphrase,
            systemInfo: row.system_info ? JSON.parse(row.system_info) : undefined,
            monitorInterval: row.monitor_interval,
            monitorItems: JSON.parse(row.monitor_items),
            cpuThreshold: row.cpu_threshold,
            memoryThreshold: row.memory_threshold,
            diskThreshold: row.disk_threshold,
            networkThreshold: row.network_threshold,
            status: row.status,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
}
exports.DataService = DataService;
exports.dataService = new DataService();
