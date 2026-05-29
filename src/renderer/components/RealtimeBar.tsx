import type { ServerWithMetrics } from '../../shared/ipc-types';
import type { RealtimeMetrics } from '../../shared/types';
import styles from './RealtimeBar.module.css';

interface RealtimeBarProps {
  server: ServerWithMetrics;
  realtime?: RealtimeMetrics;
}

export default function RealtimeBar({ server, realtime }: RealtimeBarProps): JSX.Element {
  const items = [
    { label: 'CPU', value: realtime?.cpu, threshold: server.cpuThreshold, unit: '%' },
    { label: '内存', value: realtime?.memory, threshold: server.memoryThreshold, unit: '%' },
    { label: '磁盘', value: realtime?.disk, threshold: server.diskThreshold, unit: '%' },
    { label: '网络↑', value: realtime?.networkUp, threshold: server.networkThreshold, unit: 'Mbps' },
    { label: '网络↓', value: realtime?.networkDown, threshold: server.networkThreshold, unit: 'Mbps' },
  ];

  return (
    <div className={styles.bar}>
      {items.map((item) => {
        const over = item.value !== undefined && item.value > item.threshold;
        return (
          <div key={item.label} className={`${styles.item} ${over ? styles.over : ''}`}>
            <span className={styles.label}>{item.label}</span>
            <span className={styles.value}>
              {item.value !== undefined ? `${item.value.toFixed(1)}${item.unit}` : '-'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
