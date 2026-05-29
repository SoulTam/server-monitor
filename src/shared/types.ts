export interface SystemInfo {
  hostname?: string;
  cpuModel?: string;
  cpuCores?: number;
  memoryTotal?: number;
  diskTotal?: string;
  osInfo?: string;
  kernel?: string;
}

export interface ServerConfig {
  id: string;
  name: string;
  ip: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  password?: string;
  privateKeyPath?: string;
  privateKeyPassphrase?: string;
  systemInfo?: SystemInfo;
  monitorInterval: number;
  monitorItems: MetricType[];
  cpuThreshold: number;
  memoryThreshold: number;
  diskThreshold: number;
  networkThreshold: number;
  status: ServerStatus;
  createdAt: string;
  updatedAt: string;
}

export type ServerStatus = 'idle' | 'monitoring' | 'error';

export type MetricType = 'cpu' | 'memory' | 'disk' | 'network';

export type AlertStatus = 'active' | 'dismissed';

export interface MetricRecord {
  id: string;
  serverId: string;
  metricType: MetricType;
  value: number;
  details?: string;
  timestamp: string;
}

export interface AlertRecord {
  id: string;
  serverId: string;
  alertType: MetricType;
  currentValue: number;
  threshold: number;
  status: AlertStatus;
  createdAt: string;
}

export interface RealtimeMetrics {
  serverId: string;
  cpu?: number;
  memory?: number;
  disk?: number;
  networkUp?: number;
  networkDown?: number;
  timestamp: string;
}

export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
