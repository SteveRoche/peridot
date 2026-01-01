import './App.css';
import { CommandPalette } from './components/CommandPalette';
import VaultDialog from './components/VaultDialog';
import { useRootConfigStore } from './stores/rootConfigStore';
import VaultView from './components/VaultView';
import VaultSettingsDialog from './components/VaultView/VaultSettingsDialog';

export default function App() {
  const rootConfig = useRootConfigStore();
  const openVaultPath = rootConfig.getOpenVault()?.[1].path;

  return (
    <>
      <CommandPalette />
      {!openVaultPath && <VaultDialog />}
      {openVaultPath && <VaultView vaultDir={openVaultPath} />}
      {openVaultPath && <VaultSettingsDialog vaultDir={openVaultPath} />}
    </>
  );
}
