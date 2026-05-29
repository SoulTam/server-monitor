"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataCleanupJob = exports.DataCleanupJob = void 0;
const electron_log_1 = __importDefault(require("electron-log"));
const DataService_1 = require("../database/DataService");
const constants_1 = require("../../shared/constants");
class DataCleanupJob {
    timer = null;
    start() {
        this.runCleanup();
        this.timer = setInterval(() => this.runCleanup(), constants_1.CLEANUP_INTERVAL_MS);
    }
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    runCleanup() {
        try {
            const deleted = DataService_1.dataService.cleanOldMetrics(constants_1.METRIC_RETENTION_DAYS);
            if (deleted > 0) {
                electron_log_1.default.info(`Cleaned up ${deleted} old metric records`);
            }
        }
        catch (err) {
            electron_log_1.default.error(`Cleanup failed: ${err.message}`);
        }
    }
}
exports.DataCleanupJob = DataCleanupJob;
exports.dataCleanupJob = new DataCleanupJob();
