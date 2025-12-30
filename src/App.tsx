import { useEffect, useRef, useState } from 'react';
import './App.css';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from './components/ui/resizable';
import CodeMirror, { ViewUpdate } from '@uiw/react-codemirror';
import { vim } from '@replit/codemirror-vim';
import { CommandPalette } from './components/CommandPalette';
import { readDir, open, writeTextFile, create } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import type { VaultTreeNode } from './types';
import FileExplorerView from './components/FileExplorerView';
import { TYPST_EXTENSION } from './globals';
import TypstCanvas, { TypstCanvasHandle } from './components/TypstCanvas';
import VaultDialog from './components/VaultDialog';
import { useRootConfigStore } from './stores/rootConfigStore';

const loadVaultDirEntries = async (
  vaultDir: string,
): Promise<VaultTreeNode[]> => {
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

  return scan(vaultDir);
};

export default function App() {
  const [source, setSource] = useState<string>('');
  const [openFilePath, setOpenFilePath] = useState<string>('');
  const [fileTree, setFileTree] = useState<VaultTreeNode[]>([]);

  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typstCanvasRef = useRef<TypstCanvasHandle | null>(null);
  const rootConfig = useRootConfigStore();

  useEffect(() => {
    const openVault = rootConfig.getOpenVault();
    if (!openVault) return;
    loadVaultDirEntries(openVault[1].path).then(setFileTree);
  }, [rootConfig.vaults]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const openVault = rootConfig.getOpenVault();
        if (!openVault) return;
        if (!openFilePath) return;

        join(openVault[1].path, openFilePath).then(async fileAbsPath => {
          await writeTextFile(fileAbsPath, source);
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [openFilePath, source]);

  const onSourceChange = (newSource: string, viewUpdate: ViewUpdate) => {
    if (!viewUpdate.docChanged) return;

    setSource(newSource);

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      if (typstCanvasRef.current) typstCanvasRef.current.render(newSource);
    }, 50);
  };

  const scanAndFindFile = (
    dirPath: string,
    dir: VaultTreeNode[],
    basename: string,
  ): string | null => {
    for (const entry of dir) {
      if (entry.isDirectory && entry.children) {
        const innerDirPath =
          basename === '' ? entry.name : `${dirPath}/${entry.name}`;
        const scan = scanAndFindFile(innerDirPath, entry.children, basename);
        if (scan !== null) return scan;
      } else if (entry.name === basename) {
        return `${dirPath}/${basename}`;
      }
    }
    return null;
  };

  const handleLink = async (url: string) => {
    const noteBasename = `${url.slice('peridot://'.length, url.length)}.typ`;
    let relativeFilePath = scanAndFindFile('', fileTree, noteBasename);
    if (!relativeFilePath) {
      relativeFilePath = `Inbox/${noteBasename}`;
      await create(
        await join(rootConfig.getOpenVault()![1].path, relativeFilePath),
      );
      loadVaultDirEntries(rootConfig.getOpenVault()![1].path).then(setFileTree);
    }

    openFileInEditor(relativeFilePath);
  };

  const openFileInEditor = async (relativeFilePath: string) => {
    if (!relativeFilePath.endsWith(TYPST_EXTENSION)) return;

    const fileAbsPath = await join(
      rootConfig.getOpenVault()![1].path,
      relativeFilePath,
    );
    const file = await open(fileAbsPath, { read: true, write: true });
    const stat = await file.stat();
    const buf = new Uint8Array(stat.size);
    await file.read(buf);
    const textContents = new TextDecoder().decode(buf);
    await file.close();

    setSource(textContents);
    setOpenFilePath(relativeFilePath);

    if (typstCanvasRef.current) typstCanvasRef.current.render(textContents);
  };

  return (
    <>
      <CommandPalette />
      <main className="h-screen w-screen">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel style={{ overflowY: 'scroll' }} defaultSize={20}>
            <FileExplorerView
              fileTree={fileTree}
              onSelectFile={openFileInEditor}
            />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel style={{ overflowY: 'scroll' }}>
            <TypstCanvas
              ref={typstCanvasRef}
              filePath={openFilePath}
              onLinkCallback={handleLink}
            />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel>
            {openFilePath && (
              <CodeMirror
                value={source}
                height="100vh"
                extensions={[vim()]}
                onChange={onSourceChange}
              />
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
        {!!!rootConfig.getOpenVault()?.[1].path && <VaultDialog />}
      </main>
    </>
  );
}
