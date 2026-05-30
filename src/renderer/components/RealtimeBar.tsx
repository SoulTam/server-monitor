import type { ServerWithMetrics } from '../../shared/ipc-types';
import type { RealtimeMetrics } from '../../shared/types';
import styles from './RealtimeBar.module.css';

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)}${units[i]}`;
}

interface RealtimeBarProps {
  server: ServerWithMetrics;
  realtime?: RealtimeMetrics;
}

export default function RealtimeBar({ server, realtime }: RealtimeBarProps): JSX.Element {
  const diskLabel = realtime?.diskUsed !== undefined && realtime?.diskTotal !== undefined
    ? `${formatBytes(realtime.diskUsed)} / ${formatBytes(realtime.diskTotal)}`
    : '';

  const items = [
    { label: 'CPU', value: realtime?.cpu, threshold: server.cpuThreshold, unit: '%' },
    { label: '内存', value: realtime?.memory, threshold: server.memoryThreshold, unit: '%' },
    { label: '磁盘', value: realtime?.disk, threshold: server.diskThreshold, unit: '%', extra: diskLabel },
    { label: '网络↑', value: realtime?.networkUp, threshold: server.networkThreshold, unit: 'Mbps' },
    { label: '网络↓', value: realtime?.networkDown, threshold: server.networkThreshold, unit: 'Mbps' },
  ];

  return (
    <div className={styles.bar}>
      <div className={styles.serverLabel}>{server.ip}:{server.port}</div>
      {items.map((item) => {
        const over = item.value !== undefined && item.value > item.threshold;
        return (
          <div key={item.label} className={`${styles.item} ${over ? styles.over : ''}`}>
            <span className={styles.label}>{item.label}</span>
            <span className={styles.value}>
              {item.value !== undefined ? `${item.value.toFixed(1)}${item.unit}` : '-'}
            </span>
            {(item as { extra?: string }).extra && (
              <span className={styles.extra}>{(item as { extra?: string }).extra}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
