import log from 'electron-log';
import { dataService } from '../database/DataService';
import { getMainWindow } from '../index';
import { IPC_CHANNELS } from '../../shared/constants';
import type { MetricType, RealtimeMetrics, AlertRecord } from '../../shared/types';

export class AlertService {
  checkAndAlert(serverId: string, metrics: RealtimeMetrics): void {
    const server = dataService.getServer(serverId);
    if (!server) return;

    const checks: { type: MetricType; value: number | undefined; threshold: number }[] = [
      { type: 'cpu', value: metrics.cpu, threshold: server.cpuThreshold },
      { type: 'memory', value: metrics.memory, threshold: server.memoryThreshold },
      { type: 'disk', value: metrics.disk, threshold: server.diskThreshold },
      { type: 'network', value: (metrics.networkUp || 0) + (metrics.networkDown || 0), threshold: server.networkThreshold },
    ];

    for (const check of checks) {
      if (check.value === undefined || isNaN(check.value)) continue;

      if (check.value > check.threshold) {
        this.triggerAlert(serverId, check.type, check.value, check.threshold);
      } else {
        this.autoRecover(serverId, check.type);
      }
    }
  }

  private triggerAlert(serverId: string, alertType: MetricType, currentValue: number, threshold: number): void {
    const existing = dataService.getActiveAlert(serverId, alertType);
    if (existing) return;

    const id = dataService.saveAlert({
      serverId,
      alertType,
      currentValue,
      threshold,
      status: 'active',
    });

    const alert: AlertRecord = {
      id,
      serverId,
      alertType,
      currentValue,
      threshold,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.ALERT_NOTIFICATION, alert);
    }

    log.warn(`Alert triggered: ${serverId} ${alertType} = ${currentValue} > ${threshold}`);
  }

  private autoRecover(serverId: string, alertType: MetricType): void {
    const existing = dataService.getActiveAlert(serverId, alertType);
    if (existing) {
      dataService.updateAlertStatus(existing.id, 'dismissed');
      log.info(`Alert auto-recovered: ${serverId} ${alertType}`);
    }
  }

  dismissAlert(alertId: string): void {
    dataService.updateAlertStatus(alertId, 'dismissed');
  }

  listAlerts(
    filters: { serverId?: string; alertType?: MetricType; status?: 'active' | 'dismissed' },
    page = 1,
    pageSize = 20,
  ): { records: AlertRecord[]; total: number } {
    return dataService.getAlerts(filters, page, pageSize);
  }
}

export const alertService = new AlertService();
