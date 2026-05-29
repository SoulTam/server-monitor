"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SSH_KEEPALIVE_MAX_COUNT = exports.SSH_KEEPALIVE_INTERVAL = exports.SSH_COMMAND_TIMEOUT = exports.SSH_CONNECT_TIMEOUT = exports.CLEANUP_INTERVAL_MS = exports.METRIC_RETENTION_DAYS = exports.DEFAULT_SERVER_CONFIG = exports.IPC_CHANNELS = void 0;
exports.IPC_CHANNELS = {
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
};
exports.DEFAULT_SERVER_CONFIG = {
    port: 22,
    monitorInterval: 30,
    monitorItems: ['cpu', 'memory', 'disk', 'network'],
    cpuThreshold: 90,
    memoryThreshold: 90,
    diskThreshold: 95,
    networkThreshold: 100,
};
exports.METRIC_RETENTION_DAYS = 30;
exports.CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
exports.SSH_CONNECT_TIMEOUT = 10000;
exports.SSH_COMMAND_TIMEOUT = 5000;
exports.SSH_KEEPALIVE_INTERVAL = 10000;
exports.SSH_KEEPALIVE_MAX_COUNT = 3;
