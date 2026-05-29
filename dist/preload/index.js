"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
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
};
const electronAPI = {
    server: {
        create: (input) => electron_1.ipcRenderer.invoke(IPC_CHANNELS.SERVER_CREATE, input),
        update: (input) => electron_1.ipcRenderer.invoke(IPC_CHANNELS.SERVER_UPDATE, input),
        delete: (id) => electron_1.ipcRenderer.invoke(IPC_CHANNELS.SERVER_DELETE, id),
        list: () => electron_1.ipcRenderer.invoke(IPC_CHANNELS.SERVER_LIST),
        getDetail: (id) => electron_1.ipcRenderer.invoke(IPC_CHANNELS.SERVER_GET_DETAIL, id),
    },
    monitor: {
        start: (serverId) => electron_1.ipcRenderer.invoke(IPC_CHANNELS.MONITOR_START, serverId),
        stop: (serverId) => electron_1.ipcRenderer.invoke(IPC_CHANNELS.MONITOR_STOP, serverId),
        getHistory: (input) => electron_1.ipcRenderer.invoke(IPC_CHANNELS.MONITOR_GET_HISTORY, input),
        onMetrics: (callback) => {
            const handler = (_event, metrics) => {
                callback(metrics);
            };
            electron_1.ipcRenderer.on(IPC_CHANNELS.MONITOR_METRICS, handler);
            return () => electron_1.ipcRenderer.removeListener(IPC_CHANNELS.MONITOR_METRICS, handler);
        },
    },
    alert: {
        list: (input) => electron_1.ipcRenderer.invoke(IPC_CHANNELS.ALERT_LIST, input),
        dismiss: (alertId) => electron_1.ipcRenderer.invoke(IPC_CHANNELS.ALERT_DISMISS, alertId),
        onNotification: (callback) => {
            const handler = (_event, alert) => {
                callback(alert);
            };
            electron_1.ipcRenderer.on(IPC_CHANNELS.ALERT_NOTIFICATION, handler);
            return () => electron_1.ipcRenderer.removeListener(IPC_CHANNELS.ALERT_NOTIFICATION, handler);
        },
    },
    window: {
        minimize: () => electron_1.ipcRenderer.send('window:minimize'),
        close: () => electron_1.ipcRenderer.send('window:close'),
    },
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', electronAPI);
