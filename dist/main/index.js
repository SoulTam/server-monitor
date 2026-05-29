"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMainWindow = getMainWindow;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const electron_log_1 = __importDefault(require("electron-log"));
const index_1 = require("./ipc/index");
const TrayService_1 = require("./services/TrayService");
const CollectService_1 = require("./services/CollectService");
const DataCleanupJob_1 = require("./jobs/DataCleanupJob");
const index_2 = require("./database/index");
electron_log_1.default.initialize();
let mainWindow = null;
function getResourcePath(...segments) {
    if (electron_1.app.isPackaged) {
        return path_1.default.join(process.resourcesPath, ...segments);
    }
    return path_1.default.join(electron_1.app.getAppPath(), ...segments);
}
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        frame: false,
        icon: getResourcePath('resources', 'icon.png'),
        webPreferences: {
            preload: path_1.default.join(__dirname, '../preload/index.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, '../renderer/index.html'));
    }
    mainWindow.on('close', (e) => {
        e.preventDefault();
        mainWindow?.hide();
    });
}
electron_1.app.whenReady().then(async () => {
    try {
        (0, index_2.getDatabase)();
    }
    catch (err) {
        electron_log_1.default.error(`Failed to initialize database: ${err.message}`);
        electron_1.app.quit();
        return;
    }
    (0, index_1.registerIpcHandlers)();
    createWindow();
    try {
        TrayService_1.trayService.create();
    }
    catch (err) {
        electron_log_1.default.error(`Failed to create tray: ${err.message}`);
    }
    DataCleanupJob_1.dataCleanupJob.start();
    electron_1.powerMonitor.on('resume', () => {
        electron_log_1.default.info('System resumed from sleep, reconnecting all monitored servers');
        CollectService_1.collectService.reconnectAll();
    });
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        // handled by tray
    }
});
electron_1.ipcMain.on('window:minimize', () => {
    mainWindow?.minimize();
});
electron_1.ipcMain.on('window:close', () => {
    mainWindow?.hide();
});
function getMainWindow() {
    return mainWindow;
}
