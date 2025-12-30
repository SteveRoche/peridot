import { useState, useEffect } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command';

type CommandId = 'new-note' | 'delete-note';

type CommandDesc = {
  id: CommandId;
  label: string;
};

const COMMAND_DESCS: CommandDesc[] = [
  { id: 'new-note', label: 'New note' },
  { id: 'delete-note', label: 'Delete note' },
];

// const COMMAND_MAP: Record<CommandId, CommandDesc> = Object.fromEntries(
//   COMMAND_DESCS.map(desc => [desc.id, desc]),
// ) as { [K in CommandId]: CommandDesc };

export function CommandPalette() {
  const [open, setOpen] = useState(false);

  const onSelectCommand = (commandId: CommandId) => (e: any) => {
    console.log({ e, id: commandId });
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'p' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(open => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  });

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder=""></CommandInput>
      <CommandList>
        <CommandEmpty>No matching commands</CommandEmpty>
        {COMMAND_DESCS.map(desc => (
          <CommandItem key={desc.id} onSelect={onSelectCommand(desc.id)}>
            <span>{desc.label}</span>
          </CommandItem>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
