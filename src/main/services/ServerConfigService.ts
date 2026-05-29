import { dataService } from '../database/DataService';
import { encrypt, decrypt } from '../utils/crypto';
import type { ServerConfig } from '../../shared/types';
import type { CreateServerInput, UpdateServerInput, ServerWithMetrics } from '../../shared/ipc-types';
import { DEFAULT_SERVER_CONFIG } from '../../shared/constants';

export class ServerConfigService {
  createServer(input: CreateServerInput): string {
    const encryptedPassword = input.password ? encrypt(input.password) : undefined;
    const encryptedPassphrase = input.privateKeyPassphrase ? encrypt(input.privateKeyPassphrase) : undefined;
    return dataService.saveServer({
      name: input.name,
      ip: input.ip,
      port: input.port ?? DEFAULT_SERVER_CONFIG.port,
      username: input.username,
      authType: input.authType,
      password: encryptedPassword,
      privateKeyPath: input.privateKeyPath,
      privateKeyPassphrase: encryptedPassphrase,
      monitorInterval: input.monitorInterval ?? DEFAULT_SERVER_CONFIG.monitorInterval,
      monitorItems: input.monitorItems ?? [...DEFAULT_SERVER_CONFIG.monitorItems],
      cpuThreshold: input.cpuThreshold ?? DEFAULT_SERVER_CONFIG.cpuThreshold,
      memoryThreshold: input.memoryThreshold ?? DEFAULT_SERVER_CONFIG.memoryThreshold,
      diskThreshold: input.diskThreshold ?? DEFAULT_SERVER_CONFIG.diskThreshold,
      networkThreshold: input.networkThreshold ?? DEFAULT_SERVER_CONFIG.networkThreshold,
      status: 'idle',
    });
  }

  updateServer(input: UpdateServerInput): void {
    const fields: Partial<ServerConfig> = { ...input };
    if (input.password) {
      fields.password = encrypt(input.password);
    } else {
      delete fields.password;
    }
    if (input.privateKeyPassphrase) {
      fields.privateKeyPassphrase = encrypt(input.privateKeyPassphrase);
    } else {
      delete fields.privateKeyPassphrase;
    }
    dataService.updateServer(input.id, fields);
  }

  deleteServer(id: string): void {
    const server = dataService.getServer(id);
    if (server && server.status === 'monitoring') {
      throw new Error('Cannot delete a server that is currently being monitored');
    }
    dataService.deleteServer(id);
  }

  listServers(): ServerWithMetrics[] {
    const servers = dataService.listServers();
    return servers.map((s) => {
      const latest = dataService.getLatestMetrics(s.id);
      const activeAlerts = dataService.getAlerts({ serverId: s.id, status: 'active' }, 1, 1);
      return {
        ...s,
        password: undefined,
        privateKeyPassphrase: undefined,
        latestMetrics: {
          cpu: latest.cpu,
          memory: latest.memory,
          disk: latest.disk,
        },
        activeAlertCount: activeAlerts.total,
      };
    });
  }

  getServer(id: string): ServerConfig | undefined {
    const server = dataService.getServer(id);
    if (!server) return undefined;
    const result = { ...server };
    if (result.password) result.password = decrypt(result.password);
    if (result.privateKeyPassphrase) result.privateKeyPassphrase = decrypt(result.privateKeyPassphrase);
    return result;
  }

  getServerForDisplay(id: string): ServerWithMetrics | undefined {
    const server = dataService.getServer(id);
    if (!server) return undefined;
    const latest = dataService.getLatestMetrics(id);
    const activeAlerts = dataService.getAlerts({ serverId: id, status: 'active' }, 1, 1);
    return {
      ...server,
      password: undefined,
      privateKeyPassphrase: undefined,
      latestMetrics: { cpu: latest.cpu, memory: latest.memory, disk: latest.disk },
      activeAlertCount: activeAlerts.total,
    };
  }
}

export const serverConfigService = new ServerConfigService();
