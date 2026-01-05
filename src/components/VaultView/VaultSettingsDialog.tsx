import { DialogDescription } from '@radix-ui/react-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { useVaultSettingsStore } from '@/stores/vaultSettingsStore';
import { ChangeEventHandler, useEffect, useState } from 'react';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';

export interface VaultSettingsDialogProps {
  vaultDir: string;
}

export default function VaultSettingsDialog(props: VaultSettingsDialogProps) {
  const { vaultDir } = props;
  const [open, setOpen] = useState(false);
  const vaultSettings = useVaultSettingsStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ',' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [vaultDir]);

  const toggleVim = (checked: boolean) => {
    vaultSettings.updateSettings({ enableVim: checked });
    vaultSettings.save(vaultDir);
  };

  const saveNewNoteDirectory: ChangeEventHandler<HTMLInputElement> = e => {
    vaultSettings.updateSettings({ newNoteDirectory: e.target.value });
    vaultSettings.save(vaultDir);
  };

  const savePreamble: ChangeEventHandler<HTMLTextAreaElement> = e => {
    vaultSettings.updateSettings({ preamble: e.target.value });
    vaultSettings.save(vaultDir);
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription></DialogDescription>
        </DialogHeader>
        <div className="flex items-center space-x-2">
          <Label htmlFor="new-note-directory">
            Default location for new notes (empty for root folder)
          </Label>
          <Input
            id="new-note-directory"
            value={vaultSettings.newNoteDirectory}
            onChange={saveNewNoteDirectory}
          />
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            id="enable-vim"
            checked={vaultSettings.enableVim}
            onCheckedChange={toggleVim}
          />
          <Label htmlFor="enable-vim">Enable vim keybindings</Label>
        </div>
        <Textarea
          rows={7}
          value={vaultSettings.preamble}
          onChange={savePreamble}
          placeholder="Preamble"
        />
      </DialogContent>
    </Dialog>
  );
}
