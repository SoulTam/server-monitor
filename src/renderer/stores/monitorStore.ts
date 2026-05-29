import { create } from 'zustand';
import type { RealtimeMetrics } from '../../shared/types';

interface MonitorStore {
  realtimeByServer: Record<string, RealtimeMetrics>;
  historyByServer: Record<string, { cpu: number[]; memory: number[]; disk: number[]; network: number[] }>;
  pushRealtime: (metrics: RealtimeMetrics) => void;
  setHistory: (
    serverId: string,
    history: { cpu: number[]; memory: number[]; disk: number[]; network: number[] },
  ) => void;
}

const HISTORY_LEN = 20;

export const useMonitorStore = create<MonitorStore>((set) => ({
  realtimeByServer: {},
  historyByServer: {},
  pushRealtime: (metrics) =>
    set((state) => {
      const prev = state.historyByServer[metrics.serverId] || {
        cpu: [],
        memory: [],
        disk: [],
        network: [],
      };
      const append = (arr: number[], v?: number): number[] => {
        const next = [...arr, v ?? 0];
        return next.length > HISTORY_LEN ? next.slice(next.length - HISTORY_LEN) : next;
      };
      const networkTotal = (metrics.networkUp || 0) + (metrics.networkDown || 0);
      return {
        realtimeByServer: { ...state.realtimeByServer, [metrics.serverId]: metrics },
        historyByServer: {
          ...state.historyByServer,
          [metrics.serverId]: {
            cpu: append(prev.cpu, metrics.cpu),
            memory: append(prev.memory, metrics.memory),
            disk: append(prev.disk, metrics.disk),
            network: append(prev.network, networkTotal),
          },
        },
      };
    }),
  setHistory: (serverId, history) =>
    set((state) => ({
      historyByServer: { ...state.historyByServer, [serverId]: history },
    })),
}));
