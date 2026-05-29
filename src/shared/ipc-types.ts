import { ServerConfig, MetricRecord, AlertRecord, MetricType, AlertStatus } from './types';

export interface CreateServerInput {
  name: string;
  ip: string;
  port?: number;
  username: string;
  authType: 'password' | 'key';
  password?: string;
  privateKeyPath?: string;
  privateKeyPassphrase?: string;
  monitorInterval?: number;
  monitorItems?: MetricType[];
  cpuThreshold?: number;
  memoryThreshold?: number;
  diskThreshold?: number;
  networkThreshold?: number;
}

export interface UpdateServerInput {
  id: string;
  name?: string;
  ip?: string;
  port?: number;
  username?: string;
  authType?: 'password' | 'key';
  password?: string;
  privateKeyPath?: string;
  privateKeyPassphrase?: string;
  monitorInterval?: number;
  monitorItems?: MetricType[];
  cpuThreshold?: number;
  memoryThreshold?: number;
  diskThreshold?: number;
  networkThreshold?: number;
}

export interface GetHistoryInput {
  serverId: string;
  metricType: MetricType;
  timeRange: '1h' | '6h' | '24h' | '7d';
}

export interface AlertListInput {
  serverId?: string;
  alertType?: MetricType;
  status?: AlertStatus;
  page?: number;
  pageSize?: number;
}

export interface AlertListOutput {
  records: AlertRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ServerWithMetrics extends ServerConfig {
  latestMetrics?: {
    cpu?: number;
    memory?: number;
    disk?: number;
    networkUp?: number;
    networkDown?: number;
  };
  activeAlertCount?: number;
}

export type {
  ServerConfig,
  MetricRecord,
  AlertRecord,
  MetricType,
  AlertStatus,
};
