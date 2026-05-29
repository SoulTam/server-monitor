import { HashRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Layout from './components/Layout';
import ServerListPage from './pages/ServerListPage';
import ServerDetailPage from './pages/ServerDetailPage';
import AlertRecordsPage from './pages/AlertRecordsPage';

const theme = {
  token: {
    colorPrimary: '#1677ff',
    borderRadius: 8,
    colorBgContainer: '#ffffff',
  },
};

export default function App(): JSX.Element {
  return (
    <ConfigProvider theme={theme} locale={zhCN}>
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<ServerListPage />} />
            <Route path="/server/:id" element={<ServerDetailPage />} />
            <Route path="/alerts" element={<AlertRecordsPage />} />
          </Routes>
        </Layout>
      </HashRouter>
    </ConfigProvider>
  );
}
