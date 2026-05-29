export const IPC_CHANNELS = {
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

export const DEFAULT_SERVER_CONFIG = {
  port: 22,
  monitorInterval: 30,
  monitorItems: ['cpu', 'memory', 'disk', 'network'] as const,
  cpuThreshold: 90,
  memoryThreshold: 90,
  diskThreshold: 95,
  networkThreshold: 100,
};

export const METRIC_RETENTION_DAYS = 30;
export const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
export const SSH_CONNECT_TIMEOUT = 10000;
export const SSH_COMMAND_TIMEOUT = 5000;
export const SSH_KEEPALIVE_INTERVAL = 10000;
export const SSH_KEEPALIVE_MAX_COUNT = 3;
