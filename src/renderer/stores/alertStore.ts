import { create } from 'zustand';
import type { AlertRecord } from '../../shared/types';

interface AlertStore {
  pendingPopup: AlertRecord | null;
  showPopup: (alert: AlertRecord) => void;
  dismissPopup: () => void;
}

export const useAlertStore = create<AlertStore>((set) => ({
  pendingPopup: null,
  showPopup: (alert) => set({ pendingPopup: alert }),
  dismissPopup: () => set({ pendingPopup: null }),
}));
