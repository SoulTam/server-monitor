"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertService = exports.AlertService = void 0;
const electron_log_1 = __importDefault(require("electron-log"));
const DataService_1 = require("../database/DataService");
const index_1 = require("../index");
const constants_1 = require("../../shared/constants");
class AlertService {
    checkAndAlert(serverId, metrics) {
        const server = DataService_1.dataService.getServer(serverId);
        if (!server)
            return;
        const checks = [
            { type: 'cpu', value: metrics.cpu, threshold: server.cpuThreshold },
            { type: 'memory', value: metrics.memory, threshold: server.memoryThreshold },
            { type: 'disk', value: metrics.disk, threshold: server.diskThreshold },
            { type: 'network', value: (metrics.networkUp || 0) + (metrics.networkDown || 0), threshold: server.networkThreshold },
        ];
        for (const check of checks) {
            if (check.value === undefined || isNaN(check.value))
                continue;
            if (check.value > check.threshold) {
                this.triggerAlert(serverId, check.type, check.value, check.threshold);
            }
            else {
                this.autoRecover(serverId, check.type);
            }
        }
    }
    triggerAlert(serverId, alertType, currentValue, threshold) {
        const existing = DataService_1.dataService.getActiveAlert(serverId, alertType);
        if (existing)
            return;
        const id = DataService_1.dataService.saveAlert({
            serverId,
            alertType,
            currentValue,
            threshold,
            status: 'active',
        });
        const alert = {
            id,
            serverId,
            alertType,
            currentValue,
            threshold,
            status: 'active',
            createdAt: new Date().toISOString(),
        };
        const win = (0, index_1.getMainWindow)();
        if (win && !win.isDestroyed()) {
            win.webContents.send(constants_1.IPC_CHANNELS.ALERT_NOTIFICATION, alert);
        }
        electron_log_1.default.warn(`Alert triggered: ${serverId} ${alertType} = ${currentValue} > ${threshold}`);
    }
    autoRecover(serverId, alertType) {
        const existing = DataService_1.dataService.getActiveAlert(serverId, alertType);
        if (existing) {
            DataService_1.dataService.updateAlertStatus(existing.id, 'dismissed');
            electron_log_1.default.info(`Alert auto-recovered: ${serverId} ${alertType}`);
        }
    }
    dismissAlert(alertId) {
        DataService_1.dataService.updateAlertStatus(alertId, 'dismissed');
    }
    listAlerts(filters, page = 1, pageSize = 20) {
        return DataService_1.dataService.getAlerts(filters, page, pageSize);
    }
}
exports.AlertService = AlertService;
exports.alertService = new AlertService();
