import log from 'electron-log';
import { dataService } from '../database/DataService';
import { METRIC_RETENTION_DAYS, CLEANUP_INTERVAL_MS } from '../../shared/constants';

export class DataCleanupJob {
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    this.runCleanup();
    this.timer = setInterval(() => this.runCleanup(), CLEANUP_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private runCleanup(): void {
    try {
      const deleted = dataService.cleanOldMetrics(METRIC_RETENTION_DAYS);
      if (deleted > 0) {
        log.info(`Cleaned up ${deleted} old metric records`);
      }
    } catch (err) {
      log.error(`Cleanup failed: ${(err as Error).message}`);
    }
  }
}

export const dataCleanupJob = new DataCleanupJob();
