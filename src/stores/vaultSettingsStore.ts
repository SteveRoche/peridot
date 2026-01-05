import { VAULT_CONFIG_FILE, VAULT_DATA_DIR } from '@/globals';
import {
  exists,
  mkdir,
  readTextFile,
  writeTextFile,
} from '@tauri-apps/plugin-fs';
import { create } from 'zustand';

export interface VaultSettings {
  enableVim: boolean;
  preamble: string;
  newNoteDirectory: string;
}

export interface VaultSettingsStore extends VaultSettings {
  _hydrated: boolean;
  hydrate: (vaultDir: string) => Promise<void>;
  save: (vaultDir: string) => Promise<void>;
  updateSettings: (settings: Partial<VaultSettings>) => void;
}

const initVaultSettings: VaultSettings = {
  enableVim: false,
  preamble: '',
  newNoteDirectory: '',
};

export const useVaultSettingsStore = create<VaultSettingsStore>()(
  (set, get) => ({
    _hydrated: false,
    ...initVaultSettings,

    async hydrate(vaultDir: string) {
      const vaultDataDir = `${vaultDir}/${VAULT_DATA_DIR}`;
      if (!(await exists(vaultDataDir))) {
        await mkdir(vaultDataDir);
      }
      const vaultConfigFile = `${vaultDataDir}/${VAULT_CONFIG_FILE}`;
      if (!(await exists(vaultConfigFile))) {
        await writeTextFile(vaultConfigFile, JSON.stringify(initVaultSettings));
      }
      const vaultConfig = JSON.parse(
        await readTextFile(vaultConfigFile),
      ) as VaultSettings;
      set({ ...vaultConfig, _hydrated: true });
    },

    async save(vaultDir: string) {
      const { _hydrated, ...toSave } = get();
      await writeTextFile(
        `${vaultDir}/${VAULT_DATA_DIR}/${VAULT_CONFIG_FILE}`,
        JSON.stringify(toSave),
      );
    },

    updateSettings(update) {
      set(state => ({
        ...state,
        ...update,
      }));
    },
  }),
);
