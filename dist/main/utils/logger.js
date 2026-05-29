"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_log_1 = __importDefault(require("electron-log"));
electron_log_1.default.transports.file.level = 'info';
electron_log_1.default.transports.console.level = 'debug';
exports.default = electron_log_1.default;
