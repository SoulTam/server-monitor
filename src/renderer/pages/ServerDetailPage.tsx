import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Space, Tag, message, Segmented } from 'antd';
import { ArrowLeftOutlined, PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import TrendChart from '../components/TrendChart';
import RealtimeBar from '../components/RealtimeBar';
import { useMonitorStore } from '../stores/monitorStore';
import type { ServerWithMetrics } from '../../shared/ipc-types';
import type { MetricType, MetricRecord } from '../../shared/types';

type TimeRange = '1h' | '6h' | '24h' | '7d';

export default function ServerDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [server, setServer] = useState<ServerWithMetrics | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const [historyData, setHistoryData] = useState<Record<MetricType, MetricRecord[]>>({
    cpu: [], memory: [], disk: [], network: [],
  });
  const realtime = useMonitorStore((s) => (id ? s.realtimeByServer[id] : undefined));

  useEffect(() => {
    if (!id) return;
    window.electronAPI.server.getDetail(id).then((res) => {
      if (res.success && res.data) setServer(res.data as ServerWithMetrics);
    });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const types: MetricType[] = ['cpu', 'memory', 'disk', 'network'];
    Promise.all(
      types.map((t) =>
        window.electronAPI.monitor.getHistory({ serverId: id, metricType: t, timeRange }),
      ),
    ).then((results) => {
      const data: Record<MetricType, MetricRecord[]> = { cpu: [], memory: [], disk: [], network: [] };
      types.forEach((t, i) => {
        if (results[i].success && Array.isArray(results[i].data)) {
          data[t] = results[i].data as MetricRecord[];
        }
      });
      setHistoryData(data);
    });
  }, [id, timeRange]);

  useEffect(() => {
    if (!id) return;
    const unsubscribe = window.electronAPI.monitor.onMetrics((metrics) => {
      useMonitorStore.getState().pushRealtime(metrics);
    });
    return unsubscribe;
  }, [id]);

  const handleStart = async (): Promise<void> => {
    if (!id) return;
    const res = await window.electronAPI.monitor.start(id);
    if (res.success) {
      message.success('监控已启动');
      setServer((s) => s ? { ...s, status: 'monitoring' } : s);
    } else {
      message.error(res.error || '启动失败');
    }
  };

  const handleStop = async (): Promise<void> => {
    if (!id) return;
    const res = await window.electronAPI.monitor.stop(id);
    if (res.success) {
      message.success('监控已停止');
      setServer((s) => s ? { ...s, status: 'idle' } : s);
    } else {
      message.error(res.error || '停止失败');
    }
  };

  if (!server) return <div>加载中...</div>;

  const statusTag: Record<string, JSX.Element> = {
    monitoring: <Tag color="success">监控中</Tag>,
    idle: <Tag>空闲</Tag>,
    error: <Tag color="error">异常</Tag>,
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>返回</Button>
        <span style={{ fontWeight: 600, fontSize: 16 }}>{server.name}</span>
        <span style={{ color: '#999' }}>{server.ip}:{server.port}</span>
        {statusTag[server.status]}
        {server.status === 'monitoring' ? (
          <Button icon={<PauseCircleOutlined />} onClick={handleStop}>停止监控</Button>
        ) : (
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleStart}>启动监控</Button>
        )}
      </Space>

      <RealtimeBar server={server} realtime={realtime} />

      {server.systemInfo && (
        <div style={{ display: 'flex', gap: 24, padding: '12px 16px', background: '#fff', borderRadius: 8, boxShadow: 'var(--shadow-card)', marginTop: 16, fontSize: 13, flexWrap: 'wrap' }}>
          {server.systemInfo.hostname && <span><strong>主机名:</strong> {server.systemInfo.hostname}</span>}
          {server.systemInfo.osInfo && <span><strong>系统:</strong> {server.systemInfo.osInfo}</span>}
          {server.systemInfo.kernel && <span><strong>内核:</strong> {server.systemInfo.kernel}</span>}
          {server.systemInfo.cpuModel && <span><strong>CPU:</strong> {server.systemInfo.cpuModel}</span>}
          {server.systemInfo.cpuCores && <span><strong>核心数:</strong> {server.systemInfo.cpuCores}</span>}
          {server.systemInfo.memoryTotal && <span><strong>内存:</strong> {(server.systemInfo.memoryTotal / 1024).toFixed(1)}GB</span>}
          {server.systemInfo.diskTotal && <span><strong>磁盘:</strong> {server.systemInfo.diskTotal}</span>}
        </div>
      )}

      <div style={{ margin: '16px 0' }}>
        <Segmented
          options={[
            { label: '1小时', value: '1h' },
            { label: '6小时', value: '6h' },
            { label: '24小时', value: '24h' },
            { label: '7天', value: '7d' },
          ]}
          value={timeRange}
          onChange={(v) => setTimeRange(v as TimeRange)}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <TrendChart title="CPU使用率" data={historyData.cpu} unit="%" color="#1677ff" threshold={server.cpuThreshold} />
        <TrendChart title="内存使用率" data={historyData.memory} unit="%" color="#52c41a" threshold={server.memoryThreshold} />
        <TrendChart title="磁盘使用率" data={historyData.disk} unit="%" color="#faad14" threshold={server.diskThreshold} />
        <TrendChart title="网络流量" data={historyData.network} unit="Mbps" color="#722ed1" threshold={server.networkThreshold} />
      </div>
    </div>
  );
}
