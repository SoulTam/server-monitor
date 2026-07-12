import { app, BrowserWindow, ipcMain, powerMonitor } from 'electron';
import path from 'path';
import log from 'electron-log';
import { registerIpcHandlers } from './ipc/index';
import { trayService } from './services/TrayService';
import { collectService } from './services/CollectService';
import { dataCleanupJob } from './jobs/DataCleanupJob';
import { getDatabase } from './database/index';
import { dataService } from './database/DataService';

log.initialize();

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

function getResourcePath(...segments: string[]): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ...segments);
  }
  return path.join(app.getAppPath(), ...segments);
}

async function restoreMonitoringState(): Promise<void> {
  try {
    const servers = dataService.listServers();
    const monitored = servers.filter(s => s.status === 'monitoring');
    if (monitored.length === 0) return;
    log.info(`Found ${monitored.length} server(s) with stale 'monitoring' status, attempting recovery`);
    for (const server of monitored) {
      try {
        await collectService.startMonitoring(server.id);
        log.info(`Auto-restored monitoring for server: ${server.name}`);
      } catch (err) {
        log.warn(`Failed to restore monitoring for ${server.name}: ${(err as Error).message}, resetting to idle`);
        dataService.updateServer(server.id, { status: 'idle' });
      }
    }
  } catch (err) {
    log.error(`Failed to restore monitoring state: ${(err as Error).message}`);
  }
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
    if (isQuitting) return;
    e.preventDefault();
    mainWindow?.hide();
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on('second-instance', () => {
  const win = getMainWindow();
  if (win) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
});

app.whenReady().then(async () => {
  try {
    getDatabase();
  } catch (err) {
    log.error(`Failed to initialize database: ${(err as Error).message}`);
    app.quit();
    return;
  }

  registerIpcHandlers();

  await restoreMonitoringState();

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

export function setIsQuitting(value: boolean): void {
  isQuitting = value;
}
