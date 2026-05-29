import { useEffect, useState } from 'react';
import { Table, Tag, Button, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useServerStore } from '../stores/serverStore';
import AlertFilter from '../components/AlertFilter';
import dayjs from 'dayjs';
import type { AlertRecord, MetricType, AlertStatus } from '../../shared/types';
import type { AlertListOutput } from '../../shared/ipc-types';

export default function AlertRecordsPage(): JSX.Element {
  const navigate = useNavigate();
  const { servers, loadServers } = useServerStore();
  const [records, setRecords] = useState<AlertRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [filters, setFilters] = useState<{ serverId?: string; alertType?: MetricType; status?: AlertStatus }>({});

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  useEffect(() => {
    fetchAlerts();
  }, [page, filters]);

  const fetchAlerts = async (): Promise<void> => {
    const res = await window.electronAPI.alert.list({
      ...filters,
      page,
      pageSize,
    });
    if (res.success && res.data) {
      const data = res.data as AlertListOutput;
      setRecords(data.records);
      setTotal(data.total);
    }
  };

  const handleDismiss = async (id: string): Promise<void> => {
    const res = await window.electronAPI.alert.dismiss(id);
    if (res.success) {
      message.success('已忽略');
      fetchAlerts();
    }
  };

  const typeLabel: Record<string, string> = {
    cpu: 'CPU',
    memory: '内存',
    disk: '磁盘',
    network: '网络',
  };

  const columns = [
    {
      title: '服务器',
      dataIndex: 'serverId',
      render: (id: string) => {
        const s = servers.find((sv) => sv.id === id);
        return s ? `${s.name} (${s.ip})` : id;
      },
    },
    {
      title: '类型',
      dataIndex: 'alertType',
      render: (t: string) => typeLabel[t] || t,
    },
    {
      title: '当前值',
      dataIndex: 'currentValue',
      render: (v: number) => `${v.toFixed(1)}%`,
    },
    {
      title: '阈值',
      dataIndex: 'threshold',
      render: (v: number) => `${v}%`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (s: string) =>
        s === 'active' ? <Tag color="error">活跃</Tag> : <Tag color="default">已忽略</Tag>,
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      render: (t: string) => dayjs(t).format('MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      render: (_: unknown, record: AlertRecord) => (
        <>
          <Button type="link" size="small" onClick={() => navigate(`/server/${record.serverId}`)}>
            详情
          </Button>
          {record.status === 'active' && (
            <Button type="link" size="small" onClick={() => handleDismiss(record.id)}>
              忽略
            </Button>
          )}
        </>
      ),
    },
  ];

  return (
    <div>
      <AlertFilter
        servers={servers}
        serverId={filters.serverId}
        alertType={filters.alertType}
        status={filters.status}
        onChange={(f) => { setFilters(f); setPage(1); }}
      />
      <Table
        dataSource={records}
        columns={columns}
        rowKey="id"
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (p) => setPage(p),
          showTotal: (t) => `共 ${t} 条`,
        }}
        size="small"
      />
    </div>
  );
}
