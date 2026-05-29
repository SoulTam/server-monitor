import { Select, Space, Button, DatePicker } from 'antd';
import { ClearOutlined } from '@ant-design/icons';
import type { ServerWithMetrics } from '../../shared/ipc-types';
import type { MetricType, AlertStatus } from '../../shared/types';

interface AlertFilterProps {
  servers: ServerWithMetrics[];
  serverId?: string;
  alertType?: MetricType;
  status?: AlertStatus;
  onChange: (filters: { serverId?: string; alertType?: MetricType; status?: AlertStatus }) => void;
}

export default function AlertFilter({ servers, serverId, alertType, status, onChange }: AlertFilterProps): JSX.Element {
  return (
    <Space style={{ marginBottom: 16 }} wrap>
      <Select
        placeholder="选择服务器"
        style={{ width: 180 }}
        allowClear
        value={serverId}
        onChange={(v) => onChange({ serverId: v, alertType, status })}
        options={servers.map((s) => ({ label: `${s.name} (${s.ip})`, value: s.id }))}
      />
      <Select
        placeholder="报警类型"
        style={{ width: 140 }}
        allowClear
        value={alertType}
        onChange={(v) => onChange({ serverId, alertType: v, status })}
        options={[
          { label: 'CPU', value: 'cpu' },
          { label: '内存', value: 'memory' },
          { label: '磁盘', value: 'disk' },
          { label: '网络', value: 'network' },
        ]}
      />
      <Select
        placeholder="状态"
        style={{ width: 120 }}
        allowClear
        value={status}
        onChange={(v) => onChange({ serverId, alertType, status: v })}
        options={[
          { label: '活跃', value: 'active' },
          { label: '已忽略', value: 'dismissed' },
        ]}
      />
      <Button icon={<ClearOutlined />} onClick={() => onChange({})}>清除</Button>
    </Space>
  );
}
