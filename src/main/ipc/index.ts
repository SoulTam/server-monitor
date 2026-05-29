import { ipcMain } from 'electron';
import log from 'electron-log';
import { IPC_CHANNELS } from '../../shared/constants';
import { serverConfigService } from '../services/ServerConfigService';
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
