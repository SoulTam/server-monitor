import log from 'electron-log';
import { sshService } from './SshService';
import { dataService } from '../database/DataService';
import { serverConfigService } from './ServerConfigService';
import { alertService } from './AlertService';
import { getMainWindow } from '../index';
import { IPC_CHANNELS } from '../../shared/constants';
import type { MetricType, RealtimeMetrics, SystemInfo } from '../../shared/types';

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY = 2000;

interface MonitorTask {
  serverId: string;
  timer: ReturnType<typeof setInterval>;
  lastNetworkBytes?: { rx: number; tx: number; time: number };
  reconnectAttempts: number;
  reconnectTimer?: ReturnType<typeof setTimeout>;
}

export class CollectService {
  private tasks: Map<string, MonitorTask> = new Map();
  private healthTimer: ReturnType<typeof setInterval> | null = null;

  async startMonitoring(serverId: string): Promise<void> {
    if (this.tasks.has(serverId)) return;

    const server = serverConfigService.getServer(serverId);
    if (!server) throw new Error('Server not found');

    await sshService.connect(serverId, {
      host: server.ip,
      port: server.port,
      username: server.username,
      authType: server.authType,
      password: server.password,
      privateKeyPath: server.privateKeyPath,
      privateKeyPassphrase: server.privateKeyPassphrase,
    });

    dataService.updateServer(serverId, { status: 'monitoring' });

    this.collectSystemInfo(serverId).catch((err) => {
      log.warn(`System info collection failed for ${serverId}: ${err.message}`);
    });

    const timer = setInterval(() => {
      this.collectMetrics(serverId).catch((err) => {
        log.error(`Collection failed for ${serverId}: ${err.message}`);
      });
    }, server.monitorInterval * 1000);

    this.tasks.set(serverId, { serverId, timer, reconnectAttempts: 0 });
    this.collectMetrics(serverId).catch((err) => {
      log.error(`Initial collection failed for ${serverId}: ${err.message}`);
    });

    if (!this.healthTimer) {
      this.healthTimer = setInterval(() => this.healthCheck(), 10000);
    }
  }

  stopMonitoring(serverId: string): void {
    const task = this.tasks.get(serverId);
    if (task) {
      clearInterval(task.timer);
      if (task.reconnectTimer) clearTimeout(task.reconnectTimer);
      this.tasks.delete(serverId);
    }
    sshService.disconnect(serverId);
    dataService.updateServer(serverId, { status: 'idle' });
  }

  private async ensureConnected(serverId: string): Promise<boolean> {
    if (sshService.isConnected(serverId)) return true;

    const task = this.tasks.get(serverId);
    if (!task) return false;
    if (task.reconnectTimer) return false;

    task.reconnectAttempts++;
    if (task.reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
      log.error(`Reconnect failed after ${MAX_RECONNECT_ATTEMPTS} attempts for ${serverId}, stopping monitoring`);
      this.stopMonitoring(serverId);
      dataService.updateServer(serverId, { status: 'error' });
      return false;
    }

    const delay = RECONNECT_BASE_DELAY * Math.pow(2, task.reconnectAttempts - 1);
    log.info(`Reconnecting ${serverId} (attempt ${task.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in ${delay}ms`);

    return new Promise<boolean>((resolve) => {
      task.reconnectTimer = setTimeout(async () => {
        task.reconnectTimer = undefined;
        try {
          const server = serverConfigService.getServer(serverId);
          if (!server) { resolve(false); return; }
          await sshService.connect(serverId, {
            host: server.ip, port: server.port, username: server.username,
            authType: server.authType, password: server.password,
            privateKeyPath: server.privateKeyPath, privateKeyPassphrase: server.privateKeyPassphrase,
          });
          task.reconnectAttempts = 0;
          log.info(`Reconnected ${serverId}`);
          resolve(true);
        } catch (err) {
          log.warn(`Reconnect attempt ${task.reconnectAttempts} failed for ${serverId}: ${(err as Error).message}`);
          resolve(false);
        }
      }, delay);
    });
  }

  private healthCheck(): void {
    for (const [serverId] of this.tasks) {
      if (!sshService.isConnected(serverId)) {
        this.ensureConnected(serverId).catch((err) => {
          log.warn(`Health check reconnect failed for ${serverId}: ${(err as Error).message}`);
        });
      }
    }
  }

  stopAllMonitoring(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
    for (const [id] of this.tasks) {
      this.stopMonitoring(id);
    }
  }

  reconnectAll(): void {
    for (const [serverId] of this.tasks) {
      this.ensureConnected(serverId).catch((err) => {
        log.error(`ReconnectAll failed for ${serverId}: ${(err as Error).message}`);
      });
    }
  }

  private async collectMetrics(serverId: string): Promise<void> {
    if (!this.tasks.has(serverId)) return;

    if (!sshService.isConnected(serverId)) {
      const ok = await this.ensureConnected(serverId);
      if (!ok) return;
    }

    const server = dataService.getServer(serverId);
    if (!server) return;

    const monitorItems: MetricType[] = server.monitorItems;
    const timestamp = new Date().toISOString();
    const metrics: RealtimeMetrics = { serverId, timestamp };
    let hasError = false;

    if (monitorItems.includes('cpu')) {
      try {
        metrics.cpu = await this.collectCpu(serverId);
        dataService.saveMetric({ serverId, metricType: 'cpu', value: metrics.cpu, timestamp });
      } catch (e) { log.warn(`CPU collection failed: ${(e as Error).message}`); hasError = true; }
    }

    if (monitorItems.includes('memory')) {
      try {
        metrics.memory = await this.collectMemory(serverId);
        dataService.saveMetric({ serverId, metricType: 'memory', value: metrics.memory, timestamp });
      } catch (e) { log.warn(`Memory collection failed: ${(e as Error).message}`); hasError = true; }
    }

    if (monitorItems.includes('disk')) {
      try {
        metrics.disk = await this.collectDisk(serverId);
        dataService.saveMetric({ serverId, metricType: 'disk', value: metrics.disk, timestamp });
      } catch (e) { log.warn(`Disk collection failed: ${(e as Error).message}`); hasError = true; }
    }

    if (monitorItems.includes('network')) {
      try {
        const net = await this.collectNetwork(serverId);
        metrics.networkUp = net.up;
        metrics.networkDown = net.down;
        const total = net.up + net.down;
        dataService.saveMetric({
          serverId, metricType: 'network', value: total,
          details: JSON.stringify({ up: net.up, down: net.down }), timestamp,
        });
      } catch (e) { log.warn(`Network collection failed: ${(e as Error).message}`); hasError = true; }
    }

    if (hasError && !sshService.isConnected(serverId)) {
      this.ensureConnected(serverId).catch(() => {});
      return;
    }

    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.MONITOR_METRICS, metrics);
    }

    alertService.checkAndAlert(serverId, metrics);
  }

  private async collectCpu(serverId: string): Promise<number> {
    const output = await sshService.executeCommand(
      serverId,
      "cat /proc/stat | head -1 && sleep 1 && cat /proc/stat | head -1",
    );
    const lines = output.trim().split('\n');
    if (lines.length < 2) throw new Error('Invalid CPU output');

    const parse = (line: string): number[] =>
      line.replace('cpu', '').trim().split(/\s+/).map(Number);

    const first = parse(lines[0]);
    const second = parse(lines[1]);
    const idle1 = first[3] + (first[4] || 0);
    const idle2 = second[3] + (second[4] || 0);
    const total1 = first.reduce((a, b) => a + b, 0);
    const total2 = second.reduce((a, b) => a + b, 0);
    const usage = (1 - (idle2 - idle1) / (total2 - total1)) * 100;
    return Math.round(usage * 10) / 10;
  }

  private async collectMemory(serverId: string): Promise<number> {
    const output = await sshService.executeCommand(serverId, 'free -m');
    const lines = output.trim().split('\n');
    const memLine = lines.find((l) => l.startsWith('Mem:'));
    if (!memLine) throw new Error('Invalid memory output');

    const parts = memLine.split(/\s+/);
    const total = parseInt(parts[1], 10);
    const available = parseInt(parts[6], 10);
    const usage = ((1 - available / total) * 100);
    return Math.round(usage * 10) / 10;
  }

  private async collectDisk(serverId: string): Promise<number> {
    const output = await sshService.executeCommand(serverId, 'df -h / | tail -1');
    const parts = output.trim().split(/\s+/);
    const useStr = parts.find((p) => p.endsWith('%'));
    if (!useStr) throw new Error('Invalid disk output');
    return parseInt(useStr.replace('%', ''), 10);
  }

  private async collectSystemInfo(serverId: string): Promise<void> {
    const existing = dataService.getServer(serverId);
    if (existing?.systemInfo) return;

    const [cpuModel, cpuCores, memTotal, osInfo, kernel, hostname, diskTotal] = await Promise.all([
      sshService.executeCommand(serverId, `cat /proc/cpuinfo | grep "model name" | head -1 | cut -d: -f2 | sed 's/^ //'`).catch(() => ''),
      sshService.executeCommand(serverId, 'nproc').catch(() => ''),
      sshService.executeCommand(serverId, "free -m | grep Mem: | awk '{print $2}'").catch(() => ''),
      sshService.executeCommand(serverId, `cat /etc/os-release | grep "^PRETTY_NAME" | cut -d= -f2 | tr -d '"'`).catch(() => ''),
      sshService.executeCommand(serverId, 'uname -r').catch(() => ''),
      sshService.executeCommand(serverId, 'hostname').catch(() => ''),
      sshService.executeCommand(serverId, "df -h / | tail -1 | awk '{print $2}'").catch(() => ''),
    ]);

    const info: SystemInfo = {
      hostname: hostname.trim() || undefined,
      cpuModel: cpuModel.trim() || undefined,
      cpuCores: parseInt(cpuCores.trim(), 10) || undefined,
      memoryTotal: parseInt(memTotal.trim(), 10) || undefined,
      diskTotal: diskTotal.trim() || undefined,
      osInfo: osInfo.trim() || undefined,
      kernel: kernel.trim() || undefined,
    };

    dataService.updateServer(serverId, { systemInfo: info });
    log.info(`System info collected for ${serverId}: ${JSON.stringify(info)}`);
  }

  private async collectNetwork(serverId: string): Promise<{ up: number; down: number }> {
    const output = await sshService.executeCommand(
      serverId,
      "cat /proc/net/dev && sleep 1 && echo '---SEPARATOR---' && cat /proc/net/dev",
    );
    const [first, second] = output.split('---SEPARATOR---');
    const parseBytes = (text: string): { rx: number; tx: number } => {
      let rx = 0, tx = 0;
      const lines = text.trim().split('\n').slice(2);
      for (const line of lines) {
        const parts = line.trim().split(/[:\s]+/);
        if (parts[0] === 'lo') continue;
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

export const collectService = new CollectService();
