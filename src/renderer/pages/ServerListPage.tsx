import { useEffect, useState } from 'react';
import { Row, Col, Input, Button, Space, Popconfirm, message } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useServerStore } from '../stores/serverStore';
import { useMonitorStore } from '../stores/monitorStore';
import ServerCard from '../components/ServerCard';
import ServerFormModal from '../components/ServerFormModal';
import type { ServerWithMetrics } from '../../shared/ipc-types';

export default function ServerListPage(): JSX.Element {
  const navigate = useNavigate();
  const { servers, loading, loadServers } = useServerStore();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<ServerWithMetrics | undefined>();

  useEffect(() => {
    loadServers();
    const unsubscribe = window.electronAPI.monitor.onMetrics((metrics) => {
      useMonitorStore.getState().pushRealtime(metrics);
    });
    return unsubscribe;
  }, [loadServers]);

  const filtered = servers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.ip.includes(search),
  );

  const handleAdd = (): void => {
    setEditingServer(undefined);
    setModalOpen(true);
  };

  const handleEdit = (server: ServerWithMetrics): void => {
    setEditingServer(server);
    setModalOpen(true);
  };

  const handleDelete = async (id: string): Promise<void> => {
    const res = await window.electronAPI.server.delete(id);
    if (res.success) {
      message.success('删除成功');
      loadServers();
    } else {
      message.error(res.error || '删除失败');
    }
  };

  const handleStartMonitor = async (id: string): Promise<void> => {
    const res = await window.electronAPI.monitor.start(id);
    if (res.success) {
      message.success('监控已启动');
      loadServers();
    } else {
      message.error(res.error || '启动失败');
    }
  };

  const handleStopMonitor = async (id: string): Promise<void> => {
    const res = await window.electronAPI.monitor.stop(id);
    if (res.success) {
      message.success('监控已停止');
      loadServers();
    } else {
      message.error(res.error || '停止失败');
    }
  };

  const handleModalClose = (): void => {
    setModalOpen(false);
    setEditingServer(undefined);
    loadServers();
  };

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="搜索服务器名称或IP"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 260 }}
          allowClear
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加服务器
        </Button>
      </Space>

      <Row gutter={[16, 16]}>
        {filtered.map((server) => (
          <Col key={server.id} xs={24} sm={12} lg={8} xl={6}>
            <ServerCard
              server={server}
              onEdit={() => handleEdit(server)}
              onDelete={() => handleDelete(server.id)}
              onStart={() => handleStartMonitor(server.id)}
              onStop={() => handleStopMonitor(server.id)}
              onDetail={() => navigate(`/server/${server.id}`)}
            />
          </Col>
        ))}
      </Row>

      <ServerFormModal
        open={modalOpen}
        server={editingServer}
        onClose={handleModalClose}
      />
    </div>
  );
}
