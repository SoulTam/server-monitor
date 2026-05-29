import { app, BrowserWindow, ipcMain, powerMonitor } from 'electron';
import path from 'path';
import log from 'electron-log';
import { registerIpcHandlers } from './ipc/index';
import { trayService } from './services/TrayService';
import { collectService } from './services/CollectService';
import { dataCleanupJob } from './jobs/DataCleanupJob';
import { getDatabase } from './database/index';

log.initialize();

let mainWindow: BrowserWindow | null = null;

function getResourcePath(...segments: string[]): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ...segments);
  }
  return path.join(app.getAppPath(), ...segments);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    icon: getResourcePath('resources', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow?.hide();
  });
}

app.whenReady().then(async () => {
  try {
    getDatabase();
  } catch (err) {
    log.error(`Failed to initialize database: ${(err as Error).message}`);
    app.quit();
    return;
  }

  registerIpcHandlers();
  createWindow();

  try {
    trayService.create();
  } catch (err) {
    log.error(`Failed to create tray: ${(err as Error).message}`);
  }

  dataCleanupJob.start();

  powerMonitor.on('resume', () => {
    log.info('System resumed from sleep, reconnecting all monitored servers');
    collectService.reconnectAll();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // handled by tray
  }
});

ipcMain.on('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.on('window:close', () => {
  mainWindow?.hide();
});

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}
