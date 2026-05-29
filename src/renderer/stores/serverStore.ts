import { create } from 'zustand';
import type { ServerWithMetrics } from '../../shared/ipc-types';

interface ServerStore {
  servers: ServerWithMetrics[];
  loading: boolean;
  setServers: (servers: ServerWithMetrics[]) => void;
  upsertServer: (server: ServerWithMetrics) => void;
  removeServer: (id: string) => void;
  setLoading: (loading: boolean) => void;
  loadServers: () => Promise<void>;
}

export const useServerStore = create<ServerStore>((set, get) => ({
  servers: [],
  loading: false,
  setServers: (servers) => set({ servers }),
  upsertServer: (server) =>
    set((state) => {
      const idx = state.servers.findIndex((s) => s.id === server.id);
      if (idx >= 0) {
        const next = [...state.servers];
        next[idx] = server;
        return { servers: next };
      }
      return { servers: [...state.servers, server] };
    }),
  removeServer: (id) => set((state) => ({ servers: state.servers.filter((s) => s.id !== id) })),
  setLoading: (loading) => set({ loading }),
  loadServers: async () => {
    set({ loading: true });
    try {
      const res = await window.electronAPI.server.list();
      if (res.success && Array.isArray(res.data)) {
        set({ servers: res.data as ServerWithMetrics[] });
      }
    } finally {
      set({ loading: false });
    }
  },
}));
