import { useState, useEffect } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command';
import { useVaultStore } from '@/stores/vaultStore';
import { TYPST_EXTENSION } from '@/globals';
import { useVaultAppStore } from '@/stores/vaultAppStore';
import { useVaultSettingsStore } from '@/stores/vaultSettingsStore';

type CommandId = 'create-open-note' | 'delete-note';

type CommandDesc = {
  id: CommandId;
  label: string;
};

const COMMAND_DESCS: CommandDesc[] = [
  { id: 'create-open-note', label: 'Create or open note' },
  { id: 'delete-note', label: 'Delete note' },
];

type CommandPalettePage = 'main' | 'notes';

// const COMMAND_MAP: Record<CommandId, CommandDesc> = Object.fromEntries(
//   COMMAND_DESCS.map(desc => [desc.id, desc]),
// ) as { [K in CommandId]: CommandDesc };

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<CommandPalettePage>('main');
  const [query, setQuery] = useState('');

  const newNoteDirectory = useVaultSettingsStore(
    state => state.newNoteDirectory,
  );
  const findOrCreateNote = useVaultStore(state => state.findOrCreateNote);
  const searchNotes = useVaultStore(state => state.searchNotes);
  const setOpenFilePath = (openFilePath: string) =>
    useVaultAppStore.setState({ openFilePath });

  const reset = () => {
    setPage('main');
    setQuery('');
  };

  const onSelectCommand = (commandId: CommandId) => (e: any) => {
    setQuery('');
    switch (commandId) {
      case 'create-open-note':
        setPage('notes');
        break;
    }
  };

  const onSelectNote = (filePath: string) => (e: any) => {
    useVaultAppStore.setState({ openFilePath: filePath });
    reset();
    setOpen(false);
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'p' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        reset();
        setOpen(open => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  });

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder=""
        value={query}
        onValueChange={setQuery}
        onKeyDown={async e => {
          if (
            e.key === 'Enter' &&
            searchNotes(query).length === 0 &&
            query !== ''
          ) {
            const path = await findOrCreateNote(
              `${query}${TYPST_EXTENSION}`,
              newNoteDirectory,
            );
            setOpenFilePath(path);
            reset();
            setOpen(false);
          }
        }}></CommandInput>
      <CommandList>
        {page === 'main' && (
          <>
            <CommandEmpty>No matching commands</CommandEmpty>
            {COMMAND_DESCS.map(desc => (
              <CommandItem
                key={desc.id}
                value={desc.label}
                onSelect={onSelectCommand(desc.id)}>
                <span>{desc.label}</span>
              </CommandItem>
            ))}
          </>
        )}
        {page === 'notes' && (
          <>
            {searchNotes(query).map(filePath => (
              <CommandItem
                key={filePath}
                value={filePath.slice(0, -TYPST_EXTENSION.length)}
                onSelect={onSelectNote(filePath)}>
                <span>{filePath.slice(0, -TYPST_EXTENSION.length)}</span>
              </CommandItem>
            ))}
            <CommandEmpty>No matching notes</CommandEmpty>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
