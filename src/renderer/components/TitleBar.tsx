import { useLocation, Link } from 'react-router-dom';
import styles from './TitleBar.module.css';

export default function TitleBar(): JSX.Element {
  const location = useLocation();

  const isActive = (path: string): string =>
    location.pathname === path ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink;

  const handleMinimize = (): void => {
    window.electronAPI.window.minimize();
  };

  const handleClose = (): void => {
    window.electronAPI.window.close();
  };

  return (
    <div className={styles.titleBar}>
      <span className={styles.title}>Server Monitor</span>
      <nav className={styles.nav}>
        <Link to="/" className={isActive('/')}>
          服务器列表
        </Link>
        <Link to="/alerts" className={isActive('/alerts')}>
          报警记录
        </Link>
      </nav>
      <div className={styles.actions}>
        <button className={styles.actionBtn} onClick={handleMinimize} title="最小化">
          &#x2014;
        </button>
        <button className={`${styles.actionBtn} ${styles.closeBtn}`} onClick={handleClose} title="关闭">
          &#x2715;
        </button>
      </div>
    </div>
  );
}
