import { contextBridge, ipcRenderer } from 'electron';
import type {
  CreateServerInput,
  UpdateServerInput,
  GetHistoryInput,
  AlertListInput,
} from '../shared/ipc-types';
import type { IpcResponse, RealtimeMetrics, AlertRecord } from '../shared/types';

const IPC_CHANNELS = {
  SERVER_CREATE: 'server:create',
  SERVER_UPDATE: 'server:update',
  SERVER_DELETE: 'server:delete',
  SERVER_LIST: 'server:list',
  SERVER_GET_DETAIL: 'server:getDetail',
  MONITOR_START: 'monitor:start',
  MONITOR_STOP: 'monitor:stop',
  MONITOR_GET_HISTORY: 'monitor:getHistory',
  MONITOR_METRICS: 'monitor:metrics',
  ALERT_LIST: 'alert:list',
  ALERT_DISMISS: 'alert:dismiss',
  ALERT_NOTIFICATION: 'alert:notification',
} as const;

const electronAPI = {
  server: {
    create: (input: CreateServerInput): Promise<IpcResponse<string>> =>
      ipcRenderer.invoke(IPC_CHANNELS.SERVER_CREATE, input),
    update: (input: UpdateServerInput): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke(IPC_CHANNELS.SERVER_UPDATE, input),
    delete: (id: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke(IPC_CHANNELS.SERVER_DELETE, id),
    list: (): Promise<IpcResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.SERVER_LIST),
    getDetail: (id: string): Promise<IpcResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.SERVER_GET_DETAIL, id),
  },
  monitor: {
    start: (serverId: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke(IPC_CHANNELS.MONITOR_START, serverId),
    stop: (serverId: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke(IPC_CHANNELS.MONITOR_STOP, serverId),
    getHistory: (input: GetHistoryInput): Promise<IpcResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.MONITOR_GET_HISTORY, input),
    onMetrics: (callback: (metrics: RealtimeMetrics) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, metrics: RealtimeMetrics): void => {
        callback(metrics);
      };
      ipcRenderer.on(IPC_CHANNELS.MONITOR_METRICS, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.MONITOR_METRICS, handler);
    },
  },
  alert: {
    list: (input: AlertListInput): Promise<IpcResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.ALERT_LIST, input),
    dismiss: (alertId: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke(IPC_CHANNELS.ALERT_DISMISS, alertId),
    onNotification: (callback: (alert: AlertRecord) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, alert: AlertRecord): void => {
        callback(alert);
      };
      ipcRenderer.on(IPC_CHANNELS.ALERT_NOTIFICATION, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.ALERT_NOTIFICATION, handler);
    },
  },
  window: {
    minimize: (): void => ipcRenderer.send('window:minimize'),
    close: (): void => ipcRenderer.send('window:close'),
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
