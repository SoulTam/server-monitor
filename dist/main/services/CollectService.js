"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectService = exports.CollectService = void 0;
const electron_log_1 = __importDefault(require("electron-log"));
const SshService_1 = require("./SshService");
const DataService_1 = require("../database/DataService");
const ServerConfigService_1 = require("./ServerConfigService");
const AlertService_1 = require("./AlertService");
const index_1 = require("../index");
const constants_1 = require("../../shared/constants");
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY = 2000;
class CollectService {
    tasks = new Map();
    healthTimer = null;
    async startMonitoring(serverId) {
        if (this.tasks.has(serverId))
            return;
        const server = ServerConfigService_1.serverConfigService.getServer(serverId);
        if (!server)
            throw new Error('Server not found');
        await SshService_1.sshService.connect(serverId, {
            host: server.ip,
            port: server.port,
            username: server.username,
            authType: server.authType,
            password: server.password,
            privateKeyPath: server.privateKeyPath,
            privateKeyPassphrase: server.privateKeyPassphrase,
        });
        DataService_1.dataService.updateServer(serverId, { status: 'monitoring' });
        this.collectSystemInfo(serverId).catch((err) => {
            electron_log_1.default.warn(`System info collection failed for ${serverId}: ${err.message}`);
        });
        const timer = setInterval(() => {
            this.collectMetrics(serverId).catch((err) => {
                electron_log_1.default.error(`Collection failed for ${serverId}: ${err.message}`);
            });
        }, server.monitorInterval * 1000);
        this.tasks.set(serverId, { serverId, timer, reconnectAttempts: 0 });
        this.collectMetrics(serverId).catch((err) => {
            electron_log_1.default.error(`Initial collection failed for ${serverId}: ${err.message}`);
        });
        if (!this.healthTimer) {
            this.healthTimer = setInterval(() => this.healthCheck(), 10000);
        }
    }
    stopMonitoring(serverId) {
        const task = this.tasks.get(serverId);
        if (task) {
            clearInterval(task.timer);
            if (task.reconnectTimer)
                clearTimeout(task.reconnectTimer);
            this.tasks.delete(serverId);
        }
        SshService_1.sshService.disconnect(serverId);
        DataService_1.dataService.updateServer(serverId, { status: 'idle' });
    }
    async ensureConnected(serverId) {
        if (SshService_1.sshService.isConnected(serverId))
            return true;
        const task = this.tasks.get(serverId);
        if (!task)
            return false;
        if (task.reconnectTimer)
            return false;
        task.reconnectAttempts++;
        if (task.reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
            electron_log_1.default.error(`Reconnect failed after ${MAX_RECONNECT_ATTEMPTS} attempts for ${serverId}, stopping monitoring`);
            this.stopMonitoring(serverId);
            DataService_1.dataService.updateServer(serverId, { status: 'error' });
            return false;
        }
        const delay = RECONNECT_BASE_DELAY * Math.pow(2, task.reconnectAttempts - 1);
        electron_log_1.default.info(`Reconnecting ${serverId} (attempt ${task.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in ${delay}ms`);
        return new Promise((resolve) => {
            task.reconnectTimer = setTimeout(async () => {
                task.reconnectTimer = undefined;
                try {
                    const server = ServerConfigService_1.serverConfigService.getServer(serverId);
                    if (!server) {
                        resolve(false);
                        return;
                    }
                    await SshService_1.sshService.connect(serverId, {
                        host: server.ip, port: server.port, username: server.username,
                        authType: server.authType, password: server.password,
                        privateKeyPath: server.privateKeyPath, privateKeyPassphrase: server.privateKeyPassphrase,
                    });
                    task.reconnectAttempts = 0;
                    electron_log_1.default.info(`Reconnected ${serverId}`);
                    resolve(true);
                }
                catch (err) {
                    electron_log_1.default.warn(`Reconnect attempt ${task.reconnectAttempts} failed for ${serverId}: ${err.message}`);
                    resolve(false);
                }
            }, delay);
        });
    }
    healthCheck() {
        for (const [serverId] of this.tasks) {
            if (!SshService_1.sshService.isConnected(serverId)) {
                this.ensureConnected(serverId).catch((err) => {
                    electron_log_1.default.warn(`Health check reconnect failed for ${serverId}: ${err.message}`);
                });
            }
        }
    }
    stopAllMonitoring() {
        if (this.healthTimer) {
            clearInterval(this.healthTimer);
            this.healthTimer = null;
        }
        for (const [id] of this.tasks) {
            this.stopMonitoring(id);
        }
    }
    reconnectAll() {
        for (const [serverId] of this.tasks) {
            this.ensureConnected(serverId).catch((err) => {
                electron_log_1.default.error(`ReconnectAll failed for ${serverId}: ${err.message}`);
            });
        }
    }
    async collectMetrics(serverId) {
        if (!this.tasks.has(serverId))
            return;
        if (!SshService_1.sshService.isConnected(serverId)) {
            const ok = await this.ensureConnected(serverId);
            if (!ok)
                return;
        }
        const server = DataService_1.dataService.getServer(serverId);
        if (!server)
            return;
        const monitorItems = server.monitorItems;
        const timestamp = new Date().toISOString();
        const metrics = { serverId, timestamp };
        let hasError = false;
        if (monitorItems.includes('cpu')) {
            try {
                metrics.cpu = await this.collectCpu(serverId);
                DataService_1.dataService.saveMetric({ serverId, metricType: 'cpu', value: metrics.cpu, timestamp });
            }
            catch (e) {
                electron_log_1.default.warn(`CPU collection failed: ${e.message}`);
                hasError = true;
            }
        }
        if (monitorItems.includes('memory')) {
            try {
                metrics.memory = await this.collectMemory(serverId);
                DataService_1.dataService.saveMetric({ serverId, metricType: 'memory', value: metrics.memory, timestamp });
            }
            catch (e) {
                electron_log_1.default.warn(`Memory collection failed: ${e.message}`);
                hasError = true;
            }
        }
        if (monitorItems.includes('disk')) {
            try {
                const diskResult = await this.collectDisk(serverId);
                metrics.disk = diskResult.usage;
                metrics.diskUsed = diskResult.used;
                metrics.diskTotal = diskResult.total;
                DataService_1.dataService.saveMetric({ serverId, metricType: 'disk', value: diskResult.usage, details: JSON.stringify({ used: diskResult.used, total: diskResult.total }), timestamp });
            }
            catch (e) {
                electron_log_1.default.warn(`Disk collection failed: ${e.message}`);
                hasError = true;
            }
        }
        if (monitorItems.includes('network')) {
            try {
                const net = await this.collectNetwork(serverId);
                metrics.networkUp = net.up;
                metrics.networkDown = net.down;
                const total = net.up + net.down;
                DataService_1.dataService.saveMetric({
                    serverId, metricType: 'network', value: total,
                    details: JSON.stringify({ up: net.up, down: net.down }), timestamp,
                });
            }
            catch (e) {
                electron_log_1.default.warn(`Network collection failed: ${e.message}`);
                hasError = true;
            }
        }
        if (hasError && !SshService_1.sshService.isConnected(serverId)) {
            this.ensureConnected(serverId).catch(() => { });
            return;
        }
        const win = (0, index_1.getMainWindow)();
        if (win && !win.isDestroyed()) {
            win.webContents.send(constants_1.IPC_CHANNELS.MONITOR_METRICS, metrics);
        }
        AlertService_1.alertService.checkAndAlert(serverId, metrics);
    }
    async collectCpu(serverId) {
        const output = await SshService_1.sshService.executeCommand(serverId, "cat /proc/stat | head -1 && sleep 1 && cat /proc/stat | head -1");
        const lines = output.trim().split('\n');
        if (lines.length < 2)
            throw new Error('Invalid CPU output');
        const parse = (line) => line.replace('cpu', '').trim().split(/\s+/).map(Number);
        const first = parse(lines[0]);
        const second = parse(lines[1]);
        const idle1 = first[3] + (first[4] || 0);
        const idle2 = second[3] + (second[4] || 0);
        const total1 = first.reduce((a, b) => a + b, 0);
        const total2 = second.reduce((a, b) => a + b, 0);
        const usage = (1 - (idle2 - idle1) / (total2 - total1)) * 100;
        return Math.round(usage * 10) / 10;
    }
    async collectMemory(serverId) {
        const output = await SshService_1.sshService.executeCommand(serverId, 'free -m');
        const lines = output.trim().split('\n');
        const memLine = lines.find((l) => l.startsWith('Mem:'));
        if (!memLine)
            throw new Error('Invalid memory output');
        const parts = memLine.split(/\s+/);
        const total = parseInt(parts[1], 10);
        const available = parseInt(parts[6], 10);
        const usage = ((1 - available / total) * 100);
        return Math.round(usage * 10) / 10;
    }
    async collectDisk(serverId) {
        const output = await SshService_1.sshService.executeCommand(serverId, 'df / | tail -1');
        const parts = output.trim().split(/\s+/);
        const useIdx = parts.findIndex((p) => p.endsWith('%'));
        if (useIdx === -1)
            throw new Error('Invalid disk output');
        const usage = parseInt(parts[useIdx].replace('%', ''), 10);
        const total = parseInt(parts[useIdx - 3], 10) * 1024;
        const used = parseInt(parts[useIdx - 2], 10) * 1024;
        return { usage, used, total };
    }
    async collectSystemInfo(serverId) {
        const existing = DataService_1.dataService.getServer(serverId);
        if (existing?.systemInfo)
            return;
        const [cpuModel, cpuCores, memTotal, osInfo, kernel, hostname, diskTotal] = await Promise.all([
            SshService_1.sshService.executeCommand(serverId, `cat /proc/cpuinfo | grep "model name" | head -1 | cut -d: -f2 | sed 's/^ //'`).catch(() => ''),
            SshService_1.sshService.executeCommand(serverId, 'nproc').catch(() => ''),
            SshService_1.sshService.executeCommand(serverId, "free -m | grep Mem: | awk '{print $2}'").catch(() => ''),
            SshService_1.sshService.executeCommand(serverId, `cat /etc/os-release | grep "^PRETTY_NAME" | cut -d= -f2 | tr -d '"'`).catch(() => ''),
            SshService_1.sshService.executeCommand(serverId, 'uname -r').catch(() => ''),
            SshService_1.sshService.executeCommand(serverId, 'hostname').catch(() => ''),
            SshService_1.sshService.executeCommand(serverId, "df -h / | tail -1 | awk '{print $2}'").catch(() => ''),
        ]);
        const info = {
            hostname: hostname.trim() || undefined,
            cpuModel: cpuModel.trim() || undefined,
            cpuCores: parseInt(cpuCores.trim(), 10) || undefined,
            memoryTotal: parseInt(memTotal.trim(), 10) || undefined,
            diskTotal: diskTotal.trim() || undefined,
            osInfo: osInfo.trim() || undefined,
            kernel: kernel.trim() || undefined,
        };
        DataService_1.dataService.updateServer(serverId, { systemInfo: info });
        electron_log_1.default.info(`System info collected for ${serverId}: ${JSON.stringify(info)}`);
    }
    async collectNetwork(serverId) {
        const output = await SshService_1.sshService.executeCommand(serverId, "cat /proc/net/dev && sleep 1 && echo '---SEPARATOR---' && cat /proc/net/dev");
        const [first, second] = output.split('---SEPARATOR---');
        const parseBytes = (text) => {
            let rx = 0, tx = 0;
            const lines = text.trim().split('\n').slice(2);
            for (const line of lines) {
                const parts = line.trim().split(/[:\s]+/);
                if (parts[0] === 'lo')
                    continue;
                rx += parseInt(parts[1], 10) || 0;
                tx += parseInt(parts[9], 10) || 0;
            }
            return { rx, tx };
        };
        const b1 = parseBytes(first);
        const b2 = parseBytes(second);
        const down = ((b2.rx - b1.rx) * 8) / 1_000_000;
        const up = ((b2.tx - b1.tx) * 8) / 1_000_000;
        return { up: Math.round(up * 100) / 100, down: Math.round(down * 100) / 100 };
    }
}
exports.CollectService = CollectService;
exports.collectService = new CollectService();
