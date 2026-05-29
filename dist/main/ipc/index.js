"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerIpcHandlers = registerIpcHandlers;
const electron_1 = require("electron");
const electron_log_1 = __importDefault(require("electron-log"));
const constants_1 = require("../../shared/constants");
const ServerConfigService_1 = require("../services/ServerConfigService");
const CollectService_1 = require("../services/CollectService");
const AlertService_1 = require("../services/AlertService");
const DataService_1 = require("../database/DataService");
function wrap(fn) {
    return Promise.resolve()
        .then(async () => {
        const data = await fn();
        return { success: true, data };
    })
        .catch((err) => {
        electron_log_1.default.error(`IPC handler error: ${err.message}`);
        return { success: false, error: err.message };
    });
}
function registerIpcHandlers() {
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.SERVER_CREATE, (_e, input) => wrap(() => ServerConfigService_1.serverConfigService.createServer(input)));
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.SERVER_UPDATE, (_e, input) => wrap(() => {
        ServerConfigService_1.serverConfigService.updateServer(input);
    }));
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.SERVER_DELETE, (_e, id) => wrap(() => {
        ServerConfigService_1.serverConfigService.deleteServer(id);
    }));
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.SERVER_LIST, () => wrap(() => ServerConfigService_1.serverConfigService.listServers()));
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.SERVER_GET_DETAIL, (_e, id) => wrap(() => ServerConfigService_1.serverConfigService.getServerForDisplay(id)));
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.MONITOR_START, (_e, serverId) => wrap(async () => {
        await CollectService_1.collectService.startMonitoring(serverId);
    }));
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.MONITOR_STOP, (_e, serverId) => wrap(() => {
        CollectService_1.collectService.stopMonitoring(serverId);
    }));
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.MONITOR_GET_HISTORY, (_e, input) => wrap(() => {
        const rangeMs = {
            '1h': 60 * 60 * 1000,
            '6h': 6 * 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000,
        };
        const since = new Date(Date.now() - rangeMs[input.timeRange]).toISOString();
        return DataService_1.dataService.getHistory(input.serverId, input.metricType, since);
    }));
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.ALERT_LIST, (_e, input) => wrap(() => AlertService_1.alertService.listAlerts({ serverId: input.serverId, alertType: input.alertType, status: input.status }, input.page ?? 1, input.pageSize ?? 20)));
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.ALERT_DISMISS, (_e, alertId) => wrap(() => {
        AlertService_1.alertService.dismissAlert(alertId);
    }));
    electron_log_1.default.info('IPC handlers registered');
}
