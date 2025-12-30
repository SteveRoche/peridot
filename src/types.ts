import { DirEntry } from '@tauri-apps/plugin-fs';

export type VaultTreeNode = DirEntry & { children?: VaultTreeNode[] };
