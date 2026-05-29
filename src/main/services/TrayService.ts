import { Tray, Menu, nativeImage, app } from 'electron';
import path from 'path';
import { getMainWindow } from '../index';
import { collectService } from './CollectService';
import { sshService } from './SshService';
import { closeDatabase } from '../database/index';

function getResourcePath(...segments: string[]): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ...segments);
  }
  return path.join(app.getAppPath(), ...segments);
}

export class TrayService {
  private tray: Tray | null = null;

  create(): void {
    const iconPath = getResourcePath('resources', 'icon.png');
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    this.tray = new Tray(icon);
    this.tray.setToolTip('Server Monitor');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '显示窗口',
        click: () => {
          const win = getMainWindow();
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
      const win = getMainWindow();
      if (win) {
        win.show();
        win.focus();
      }
    });
  }

  quit(): void {
    collectService.stopAllMonitoring();
    sshService.disconnectAll();
    closeDatabase();
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
    app.quit();
  }
}

export const trayService = new TrayService();
