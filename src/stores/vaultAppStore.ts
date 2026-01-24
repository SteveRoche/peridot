import { create as createStore } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface VaultAppStore {
  openFilePath: string;
}

export const useVaultAppStore = createStore<VaultAppStore>()(subscribeWithSelector((set, get) => ({
  openFilePath: '',
})));
