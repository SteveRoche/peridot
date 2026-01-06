import CodeMirror, { ViewUpdate } from '@uiw/react-codemirror';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '../ui/resizable';
import FileExplorerView from './FileExplorerView';
import TypstCanvas, { TypstCanvasHandle } from './TypstCanvas';
import { useEffect, useRef, useState } from 'react';
import { vim } from '@replit/codemirror-vim';
import { useVaultSettingsStore } from '@/stores/vaultSettingsStore';
import { useVaultStore } from '@/stores/vaultStore';

interface VaultViewProps {
  vaultDir: string;
}

export default function VaultView(props: VaultViewProps) {
  const { vaultDir } = props;
  const [source, setSource] = useState<string>('');
  const [openFilePath, setOpenFilePath] = useState<string>('');

  const typstCanvasRef = useRef<TypstCanvasHandle | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const vaultSettings = useVaultSettingsStore();
  const vault = useVaultStore();

  useEffect(() => {
    vaultSettings.hydrate(vaultDir);
    vault.hydrate(vaultDir);
  }, [vaultDir]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (!openFilePath) return;
        vault.writeNote(openFilePath, source);
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
    openFileInEditor(
      await vault.findOrCreateNote(
        noteBasename,
        vaultSettings.newNoteDirectory,
      ),
    );
  };

  const openFileInEditor = async (relativeFilePath: string) => {
    const noteSource = await vault.readNote(relativeFilePath);
    if (noteSource === undefined) return;
    setSource(noteSource);
    setOpenFilePath(relativeFilePath);
    if (typstCanvasRef.current) typstCanvasRef.current.render(noteSource);
  };

  return (
    <main className="h-screen w-screen">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel style={{ overflowY: 'auto' }} defaultSize={20}>
          <FileExplorerView
            fileTree={vault.fileTree}
            onSelectFile={openFileInEditor}
          />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel style={{ overflowY: 'auto' }}>
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
