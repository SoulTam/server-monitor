import { Card, Button, Popconfirm, Space } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import MiniChart from './MiniChart';
import { useMonitorStore } from '../stores/monitorStore';
import type { ServerWithMetrics } from '../../shared/ipc-types';
import styles from './ServerCard.module.css';

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)}${units[i]}`;
}

interface ServerCardProps {
  server: ServerWithMetrics;
  onEdit: () => void;
  onDelete: () => void;
  onStart: () => void;
  onStop: () => void;
  onDetail: () => void;
}

export default function ServerCard({ server, onEdit, onDelete, onStart, onStop, onDetail }: ServerCardProps): JSX.Element {
  const history = useMonitorStore((s) => s.historyByServer[server.id]);
  const realtime = useMonitorStore((s) => s.realtimeByServer[server.id]);

  const statusColor: Record<string, string> = {
    monitoring: 'var(--color-success)',
    idle: '#d9d9d9',
    error: 'var(--color-error)',
  };

  const cpu = realtime?.cpu ?? server.latestMetrics?.cpu;
  const memory = realtime?.memory ?? server.latestMetrics?.memory;
  const disk = realtime?.disk ?? server.latestMetrics?.disk;
  const diskUsed = realtime?.diskUsed ?? server.latestMetrics?.diskUsed;
  const diskTotal = realtime?.diskTotal ?? server.latestMetrics?.diskTotal;
  const diskExtra = diskUsed !== undefined && diskTotal !== undefined
    ? `${formatBytes(diskUsed)} / ${formatBytes(diskTotal)}`
    : '';

  return (
    <Card className={styles.card} size="small" onClick={onDetail}>
      <div className={styles.header}>
        <span className={styles.statusDot} style={{ background: statusColor[server.status] }} />
        <span className={styles.name}>{server.name}</span>
      </div>
      <div className={styles.ip}>{server.ip}:{server.port} · {server.username}</div>

      {server.systemInfo && (
        <div className={styles.sysInfo}>
          {server.systemInfo.cpuModel && <span>{server.systemInfo.cpuModel}</span>}
          {server.systemInfo.memoryTotal && <span> · 内存 {server.systemInfo.memoryTotal}MB</span>}
        </div>
      )}

      <div className={styles.metrics}>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>CPU</span>
          <span className={cpu !== undefined && cpu > server.cpuThreshold ? styles.overThreshold : styles.metricValue}>
            {cpu !== undefined ? `${cpu.toFixed(1)}%` : '-'}
          </span>
        </div>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>内存</span>
          <span className={memory !== undefined && memory > server.memoryThreshold ? styles.overThreshold : styles.metricValue}>
            {memory !== undefined ? `${memory.toFixed(1)}%` : '-'}
          </span>
        </div>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>磁盘</span>
          <span>
            <span className={disk !== undefined && disk > server.diskThreshold ? styles.overThreshold : styles.metricValue}>
              {disk !== undefined ? `${disk.toFixed(0)}%` : '-'}
            </span>
            {diskExtra && <span className={styles.metricExtra}> {diskExtra}</span>}
          </span>
        </div>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>周期</span>
          <span className={styles.metricValue}>{server.monitorInterval}s</span>
        </div>
      </div>

      {history && <MiniChart data={history.cpu} />}

      <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
        <Space size="small">
          {server.status === 'monitoring' ? (
            <Button size="small" icon={<PauseCircleOutlined />} onClick={onStop}>停止</Button>
          ) : (
            <Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={onStart}>监控</Button>
          )}
          <Button size="small" icon={<EditOutlined />} onClick={onEdit} />
          <Popconfirm title="确认删除此服务器？" onConfirm={onDelete} okText="确认" cancelText="取消">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      </div>
    </Card>
  );
}
