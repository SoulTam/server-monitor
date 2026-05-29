import { ReactNode } from 'react';
import TitleBar from './TitleBar';
import StatusBar from './StatusBar';
import AlertPopup from './AlertPopup';
import styles from './Layout.module.css';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps): JSX.Element {
  return (
    <div className={styles.layout}>
      <TitleBar />
      <main className={styles.content}>{children}</main>
      <StatusBar />
      <AlertPopup />
    </div>
  );
}
