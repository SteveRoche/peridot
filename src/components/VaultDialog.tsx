import { MouseEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { open } from '@tauri-apps/plugin-dialog';
import { Button } from './ui/button';
import { useRootConfigStore } from '@/stores/rootConfigStore';

export default function VaultDialog() {
  const rootConfig = useRootConfigStore();
  const onClickCreate = async (_: MouseEvent<HTMLButtonElement>) => {
    const dir = await open({ multiple: false, directory: true });
    if (dir) {
      rootConfig.createVault(dir);
      rootConfig.openVault(dir);
    }
  };

  const onSelectVault = (vaultDir: string) => () => {
    rootConfig.openVault(vaultDir);
  };

  return (
    <Dialog defaultOpen={!!!rootConfig.getOpenVault()}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Choose a Vault</DialogTitle>
          <DialogDescription>
            Create a new vault or open an existing one
          </DialogDescription>
        </DialogHeader>
        {Object.entries(rootConfig.vaults).map(([id, vault]) => (
          <Button
            key={id}
            size="sm"
            variant="ghost"
            className="w-full justify-start"
            onClick={onSelectVault(vault.path)}>
            {vault.path}
          </Button>
        ))}
        <Button onClick={onClickCreate}>Create</Button>
      </DialogContent>
    </Dialog>
  );
}
