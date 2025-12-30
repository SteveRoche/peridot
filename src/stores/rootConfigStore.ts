import { BaseDirectory, appConfigDir } from '@tauri-apps/api/path';
import {
  exists,
  mkdir,
  readTextFile,
  writeTextFile,
} from '@tauri-apps/plugin-fs';
import { create } from 'zustand';

const rootConfigFile = 'peridot.json';
const appConfigBaseDir = { baseDir: BaseDirectory.AppConfig };
const initRootConfig: RootConfig = {
  vaults: {},
};

export interface RootConfig {
  vaults: Record<string, VaultInfo>;
}

export interface RootConfigStore extends RootConfig {
  _hydrated: boolean;
  setHydrated: (b: boolean) => void;
  getOpenVault: () => [string, VaultInfo] | undefined;
  createVault: (vaultDir: string) => void;
  openVault: (vaultDir: string) => void;
}

export interface VaultInfo {
  path: string;
  open?: boolean;
}

const saveRootConfig = async (state: RootConfigStore) => {
  const { _hydrated, ...toSave } = state;
  await writeTextFile(rootConfigFile, JSON.stringify(toSave), appConfigBaseDir);
};

export const useRootConfigStore = create<RootConfigStore>()((set, get) => ({
  vaults: {},
  _hydrated: false,
  getOpenVault: () => {
    return Object.entries(get().vaults).find(([_, info]) => info.open);
  },
  setHydrated: (b: boolean) => set({ _hydrated: b }),
  createVault: async (vaultDir: string) => {
    const id = crypto.randomUUID();
    set(state => ({
      vaults: {
        ...state.vaults,
        [id]: {
          path: vaultDir,
        },
      },
    }));
    await saveRootConfig(get());
    return id;
  },
  openVault: async (vaultDir: string) => {
    set(state => ({
      vaults: Object.fromEntries(
        Object.entries(state.vaults).map(([id, vaultInfo]) => {
          if (vaultInfo.path === vaultDir) vaultInfo.open = true;
          else vaultInfo.open = false;
          return [id, vaultInfo];
        }),
      ),
    }));
    await saveRootConfig(get());
  },
}));

const hydrate = async () => {
  const configDir = await appConfigDir();
  if (!(await exists(configDir))) {
    await mkdir(configDir);
  }
  if (!(await exists(rootConfigFile, appConfigBaseDir))) {
    await writeTextFile(
      rootConfigFile,
      JSON.stringify(initRootConfig),
      appConfigBaseDir,
    );
  }
  const rootConfig = JSON.parse(
    await readTextFile(rootConfigFile, appConfigBaseDir),
  ) as RootConfigStore;
  useRootConfigStore.setState({ ...rootConfig, _hydrated: true });
};

hydrate();
