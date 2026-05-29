"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.trayService = exports.TrayService = void 0;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const index_1 = require("../index");
const CollectService_1 = require("./CollectService");
const SshService_1 = require("./SshService");
const index_2 = require("../database/index");
function getResourcePath(...segments) {
    if (electron_1.app.isPackaged) {
        return path_1.default.join(process.resourcesPath, ...segments);
    }
    return path_1.default.join(electron_1.app.getAppPath(), ...segments);
}
class TrayService {
    tray = null;
    create() {
        const iconPath = getResourcePath('resources', 'icon.png');
        const icon = electron_1.nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
        this.tray = new electron_1.Tray(icon);
        this.tray.setToolTip('Server Monitor');
        const contextMenu = electron_1.Menu.buildFromTemplate([
            {
                label: '显示窗口',
                click: () => {
                    const win = (0, index_1.getMainWindow)();
                    if (win) {
                        win.show();
                        win.focus();
                    }
                },
            },
            { type: 'separator' },
            {
                label: '退出',
                click: () => {
                    this.quit();
                },
            },
        ]);
        this.tray.setContextMenu(contextMenu);
        this.tray.on('double-click', () => {
            const win = (0, index_1.getMainWindow)();
            if (win) {
                win.show();
                win.focus();
            }
        });
    }
    quit() {
        CollectService_1.collectService.stopAllMonitoring();
        SshService_1.sshService.disconnectAll();
        (0, index_2.closeDatabase)();
        if (this.tray) {
            this.tray.destroy();
            this.tray = null;
        }
        electron_1.app.quit();
    }
}
exports.TrayService = TrayService;
exports.trayService = new TrayService();
