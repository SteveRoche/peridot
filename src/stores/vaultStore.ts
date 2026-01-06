import { create as createStore } from 'zustand';
import {
  open,
  create,
  DirEntry,
  readDir,
  writeTextFile,
  exists,
  mkdir,
  writeFile,
  readFile,
} from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { TYPST_EXTENSION } from '@/globals';
import { VAULT_PACKAGES_DIR } from '@/globals';
import untar from 'js-untar';
import { decompressSync } from 'fflate';

export interface Vault {
  fileTree: VaultTreeNode[];
  vaultDir: string;
}

export type VaultTreeNode = DirEntry & { children?: VaultTreeNode[] };

export interface VaultStore extends Vault {
  _hydrated: boolean;
  hydrate(vaultDir: string): Promise<void>;
  reload(vaultDir: string): Promise<void>;
  findOrCreateNote(
    fileBasename: string,
    newNoteDirectory: string,
  ): Promise<string>;
  readNote(relativePath: string): Promise<string | undefined>;
  writeNote(relativePath: string, source: string): Promise<void>;
  searchNotes(query: string): string[];
  fetchPackage(spec: string): Promise<Package>;
}

export const useVaultStore = createStore<VaultStore>((set, get) => ({
  _hydrated: false,
  fileTree: [],
  vaultDir: '',

  async hydrate(vaultDir: string) {
    const scan = async (dirPath: string): Promise<VaultTreeNode[]> => {
      const entries = await readDir(dirPath);
      const data: VaultTreeNode[] = [];

      for (const entry of entries) {
        if (entry.isDirectory) {
          const dir = await join(dirPath, entry.name);
          data.push({ ...entry, children: await scan(dir) });
        } else {
          data.push({ ...entry });
        }
      }
      return data;
    };
    const fileTree = await scan(vaultDir);
    set({ fileTree, vaultDir });
  },

  async reload(vaultDir: string) {
    await get().hydrate(vaultDir);
  },

  async findOrCreateNote(fileBasename: string, newNoteDirectory: string) {
    const scanDirForFile = (
      dirPath: string,
      dir: VaultTreeNode[],
    ): string | undefined => {
      for (const entry of dir) {
        if (entry.isDirectory && entry.children) {
          const innerDirPath =
            fileBasename === '' ? entry.name : `${dirPath}/${entry.name}`;
          const scan = scanDirForFile(innerDirPath, entry.children);
          if (scan !== undefined) return scan;
        } else if (entry.name === fileBasename) {
          return `${dirPath}/${fileBasename}`;
        }
      }
      return undefined;
    };
    const foundFile = scanDirForFile('', get().fileTree);
    if (foundFile) {
      return foundFile;
    }
    const newFilePath = await join(newNoteDirectory, fileBasename);
    const vaultDir = get().vaultDir;
    await create(await join(vaultDir, newFilePath));
    await get().reload(vaultDir);
    return newFilePath;
  },

  async readNote(relativePath: string) {
    if (!relativePath.endsWith(TYPST_EXTENSION)) return undefined;

    const vaultDir = get().vaultDir;

    const fileAbsPath = await join(vaultDir, relativePath);
    const file = await open(fileAbsPath, { read: true, write: true });
    const stat = await file.stat();
    const buf = new Uint8Array(stat.size);
    await file.read(buf);
    const textContents = new TextDecoder().decode(buf);
    await file.close();

    return textContents;
  },

  async writeNote(relativePath: string, source: string) {
    const absPath = await join(get().vaultDir, relativePath);
    await writeTextFile(absPath, source);
  },

  searchNotes(query: string): string[] {
    const lowercaseQuery = query.toLowerCase();
    const findFiles = (
      tree: VaultTreeNode[],
      dirPath: string = '',
      acc: string[] = [],
    ): string[] => {
      for (const node of tree) {
        if (node.isDirectory && node.children) {
          const innerDirPath =
            dirPath === '' ? node.name : `${dirPath}/${node.name}`;
          findFiles(node.children, innerDirPath, acc);
        } else if (node.name.toLowerCase().includes(lowercaseQuery)) {
          acc.push(`${dirPath}/${node.name}`);
        }
      }
      return acc;
    };

    const fileTree = get().fileTree;
    return findFiles(fileTree);
  },

  async fetchPackage(spec: string): Promise<Package> {
    const [_, name, version] = spec.replace(':', '/').split('/');
    const url = `https://packages.typst.org/preview/${name}-${version}.tar.gz`;
    const response = await fetch(url);
    if (response.status === 404) {
      throw 2;
    }
    const vaultDir = get().vaultDir;
    const packageDir = `${vaultDir}/${VAULT_PACKAGES_DIR}/${spec}`;
    if (await exists(packageDir)) {
      const packageFiles = await collectPackageFiles(packageDir);
      return {
        spec,
        files: packageFiles,
      };
    } else {
      await mkdir(packageDir, {
        recursive: true,
      });
      const files = await untar(
        decompressSync(new Uint8Array(await response.arrayBuffer()))
          .buffer as ArrayBuffer,
      );
      let packageFiles: PackageFile[] = [];
      await Promise.all(
        files.map(async file => {
          if (file.type === '5' && file.name !== '.') {
            await mkdir(
              `${vaultDir}/${VAULT_PACKAGES_DIR}/${spec}/${file.name}`,
            );
          }
          if (file.type === '0') {
            await writeFile(
              `${vaultDir}/${VAULT_PACKAGES_DIR}/${spec}/${file.name}`,
              new Uint8Array(file.buffer),
            );
            packageFiles.push({
              path: file.name,
              bytes: new Uint8Array(file.buffer),
            });
          }
        }),
      );
      return {
        spec,
        files: packageFiles,
      };
    }
  },
}));

async function collectPackageFiles(
  root: string,
  currentRelDir: string = '',
): Promise<PackageFile[]> {
  const entries = await readDir(`${root}/${currentRelDir}`);
  let files: PackageFile[] = [];

  for (const entry of entries) {
    if (entry.isDirectory) {
      files.push(
        ...(await collectPackageFiles(
          root,
          currentRelDir === ''
            ? `${entry.name}`
            : `${currentRelDir}/${entry.name}`,
        )),
      );
    } else {
      const bytes = await readFile(`${root}/${currentRelDir}/${entry.name}`);
      files.push({
        path: `${currentRelDir}/${entry.name}`, // relative path
        bytes,
      });
    }
  }

  return files;
}

export type Package = {
  spec: string;
  files: PackageFile[];
};

export type PackageFile = {
  path: string;
  bytes: Uint8Array;
};
