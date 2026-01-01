import CodeMirror, { ViewUpdate } from '@uiw/react-codemirror';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '../ui/resizable';
import FileExplorerView from './FileExplorerView';
import TypstCanvas, { TypstCanvasHandle } from './TypstCanvas';
import { VaultTreeNode } from '@/types';
import { useEffect, useRef, useState } from 'react';
import { create, readDir, open, writeTextFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { TYPST_EXTENSION } from '@/globals';
import { vim } from '@replit/codemirror-vim';
import { useVaultSettingsStore } from '@/stores/vaultSettingsStore';

interface VaultViewProps {
  vaultDir: string;
}

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

export default function VaultView(props: VaultViewProps) {
  const { vaultDir } = props;
  const [source, setSource] = useState<string>('');
  const [openFilePath, setOpenFilePath] = useState<string>('');
  const [fileTree, setFileTree] = useState<VaultTreeNode[]>([]);

  const typstCanvasRef = useRef<TypstCanvasHandle | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const vaultSettings = useVaultSettingsStore();

  useEffect(() => {
    vaultSettings.hydrate(vaultDir);
    loadVaultDirEntries(vaultDir).then(setFileTree);
  }, [vaultDir]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (!openFilePath) return;

        join(vaultDir, openFilePath).then(async fileAbsPath => {
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

  const handleLink = async (url: string) => {
    const noteBasename = `${url.slice('peridot://'.length, url.length)}.typ`;
    let relativeFilePath = scanAndFindFile('', fileTree, noteBasename);
    if (!relativeFilePath) {
      relativeFilePath = noteBasename;
      await create(await join(vaultDir, relativeFilePath));
      loadVaultDirEntries(vaultDir).then(setFileTree);
    }

    openFileInEditor(relativeFilePath);
  };

  const openFileInEditor = async (relativeFilePath: string) => {
    if (!relativeFilePath.endsWith(TYPST_EXTENSION)) return;

    const fileAbsPath = await join(vaultDir, relativeFilePath);
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
              extensions={vaultSettings.enableVim ? [vim()] : []}
              onChange={onSourceChange}
            />
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  );
}
