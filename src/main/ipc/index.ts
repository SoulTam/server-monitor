import { ipcMain } from 'electron';
import log from 'electron-log';
import { IPC_CHANNELS } from '../../shared/constants';
import { serverConfigService } from '../services/ServerConfigService';
import { sshService } from '../services/SshService';
import { collectService } from '../services/CollectService';
import { alertService } from '../services/AlertService';
import { dataService } from '../database/DataService';
import type {
  CreateServerInput,
  UpdateServerInput,
  GetHistoryInput,
  AlertListInput,
} from '../../shared/ipc-types';
import type { IpcResponse } from '../../shared/types';

function wrap<T>(fn: () => T | Promise<T>): Promise<IpcResponse<T>> {
  return Promise.resolve()
    .then(async () => {
      const data = await fn();
      return { success: true, data } as IpcResponse<T>;
    })
    .catch((err: Error) => {
      log.error(`IPC handler error: ${err.message}`);
      return { success: false, error: err.message } as IpcResponse<T>;
    });
}

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SERVER_CREATE, (_e, input: CreateServerInput) =>
    wrap(() => serverConfigService.createServer(input)),
  );

  ipcMain.handle(IPC_CHANNELS.SERVER_UPDATE, (_e, input: UpdateServerInput) =>
    wrap(() => {
      serverConfigService.updateServer(input);
    }),
  );

  ipcMain.handle(IPC_CHANNELS.SERVER_DELETE, (_e, id: string) =>
    wrap(() => {
      serverConfigService.deleteServer(id);
    }),
  );

  ipcMain.handle(IPC_CHANNELS.SERVER_LIST, () =>
    wrap(() => serverConfigService.listServers()),
  );

  ipcMain.handle(IPC_CHANNELS.SERVER_GET_DETAIL, (_e, id: string) =>
    wrap(() => serverConfigService.getServerForDisplay(id)),
  );

  ipcMain.handle(IPC_CHANNELS.LOG_LIST, (_e, payload: { serverId: string }) =>
    wrap(async () => {
      const { serverId } = payload;
      const server = serverConfigService.getServer(serverId);
      if (!server) throw new Error('SERVER_NOT_FOUND');
      if (!server.logsPath) throw new Error('LOGS_PATH_NOT_CONFIGURED');
      // ensure connected
      if (!sshService.isConnected(serverId)) {
        await sshService.connect(serverId, {
          host: server.ip,
          port: server.port,
          username: server.username,
          authType: server.authType,
          password: server.password,
          privateKeyPath: server.privateKeyPath,
          privateKeyPassphrase: server.privateKeyPassphrase,
        });
      }
      // list files recursively under server.logsPath (limit depth 5)
      const cmd = `find ${server.logsPath} -maxdepth 5 -type f -print`;
      const out = await sshService.executeCommand(serverId, cmd);
      const files = out.split('\n').filter(Boolean);
      return files;
    }),
  );

  ipcMain.handle(IPC_CHANNELS.LOG_READ, (_e, payload: { serverId: string; filePath: string; offset?: number; length?: number }) =>
    wrap(async () => {
      const { serverId, filePath, offset = 0, length } = payload;
      const server = serverConfigService.getServer(serverId);
      if (!server) throw new Error('SERVER_NOT_FOUND');
      if (!server.logsPath) throw new Error('LOGS_PATH_NOT_CONFIGURED');
      // Ensure filePath is within logsPath
      if (!filePath.startsWith(server.logsPath)) throw new Error('ACCESS_DENIED');
      if (!sshService.isConnected(serverId)) {
        await sshService.connect(serverId, {
          host: server.ip,
          port: server.port,
          username: server.username,
          authType: server.authType,
          password: server.password,
          privateKeyPath: server.privateKeyPath,
          privateKeyPassphrase: server.privateKeyPassphrase,
        });
      }
      // Use dd to read a range if length provided, else cat
      let cmd: string;
      if (length && length > 0) {
        const blockSize = 65536;
        const blockSkip = Math.floor(offset / blockSize);
        const blockCount = Math.ceil(length / blockSize);
        cmd = `dd if='${filePath}' bs=${blockSize} skip=${blockSkip} count=${blockCount} 2>/dev/null | base64`;
        const b64 = await sshService.executeCommand(serverId, cmd);
        const buf = Buffer.from(b64.trim(), 'base64');
        return buf.toString('utf8');
      }
      cmd = `cat '${filePath}'`;
      const out = await sshService.executeCommand(serverId, cmd);
      return out;
    }),
  );

  ipcMain.handle(IPC_CHANNELS.LOG_STAT, (_e, payload: { serverId: string; filePath: string }) =>
    wrap(async () => {
      const { serverId, filePath } = payload;
      const server = serverConfigService.getServer(serverId);
      if (!server) throw new Error('SERVER_NOT_FOUND');
      if (!server.logsPath) throw new Error('LOGS_PATH_NOT_CONFIGURED');
      if (!filePath.startsWith(server.logsPath)) throw new Error('ACCESS_DENIED');
      const cmd = `wc -c '${filePath}' | awk '{print $1}'`;
      const out = await sshService.executeCommand(serverId, cmd);
      return parseInt(out.trim(), 10);
    }),
  );

  ipcMain.handle(IPC_CHANNELS.MONITOR_START, (_e, serverId: string) =>
    wrap(async () => {
      await collectService.startMonitoring(serverId);
    }),
  );

  ipcMain.handle(IPC_CHANNELS.MONITOR_STOP, (_e, serverId: string) =>
    wrap(() => {
      collectService.stopMonitoring(serverId);
    }),
  );

  ipcMain.handle(IPC_CHANNELS.MONITOR_GET_HISTORY, (_e, input: GetHistoryInput) =>
    wrap(() => {
      const rangeMs: Record<GetHistoryInput['timeRange'], number> = {
        '1h': 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
      };
      const since = new Date(Date.now() - rangeMs[input.timeRange]).toISOString();
      return dataService.getHistory(input.serverId, input.metricType, since);
    }),
  );

  ipcMain.handle(IPC_CHANNELS.ALERT_LIST, (_e, input: AlertListInput) =>
    wrap(() =>
      alertService.listAlerts(
        { serverId: input.serverId, alertType: input.alertType, status: input.status },
        input.page ?? 1,
        input.pageSize ?? 20,
      ),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.ALERT_DISMISS, (_e, alertId: string) =>
    wrap(() => {
      alertService.dismissAlert(alertId);
    }),
  );

  log.info('IPC handlers registered');
}
