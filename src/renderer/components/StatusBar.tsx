import { useServerStore } from '../stores/serverStore';
import styles from './StatusBar.module.css';

export default function StatusBar(): JSX.Element {
  const servers = useServerStore((s) => s.servers);
  const monitoring = servers.filter((s) => s.status === 'monitoring').length;
  const idle = servers.filter((s) => s.status === 'idle').length;
  const error = servers.filter((s) => s.status === 'error').length;

  return (
    <div className={styles.statusBar}>
      <span className={styles.item}>
        <span className={styles.dot} style={{ background: 'var(--color-success)' }} />
        监控中: {monitoring}
      </span>
      <span className={styles.item}>
        <span className={styles.dot} style={{ background: '#d9d9d9' }} />
        空闲: {idle}
      </span>
      {error > 0 && (
        <span className={styles.item}>
          <span className={styles.dot} style={{ background: 'var(--color-error)' }} />
          异常: {error}
        </span>
      )}
      <span className={styles.right}>总计: {servers.length} 台</span>
    </div>
  );
}
