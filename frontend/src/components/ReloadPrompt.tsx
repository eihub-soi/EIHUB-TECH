import React from 'react';
import { registerSW } from 'virtual:pwa-register';
import { toast } from 'sonner';

// Global singletons to ensure only one registration happens
let isSWRegistered = false;
let globalUpdateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;
const reloadListeners = new Set<(needRefresh: boolean) => void>();
let globalNeedRefresh = false;

export const ReloadPrompt: React.FC = () => {
  const [needRefresh, setNeedRefresh] = React.useState(globalNeedRefresh);

  React.useEffect(() => {
    // Subscribe component state to reload notifications
    const listener = (val: boolean) => {
      setNeedRefresh(val);
    };
    reloadListeners.add(listener);

    // Call registerSW only once per application lifecycle
    if (!isSWRegistered) {
      isSWRegistered = true;
      
      globalUpdateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
          globalNeedRefresh = true;
          reloadListeners.forEach((l) => l(true));
        },
        onOfflineReady() {
          if (import.meta.env.DEV) {
            console.log('PWA Offline Ready');
          }
        },
        onRegistered(r) {
          if (import.meta.env.DEV) {
            console.log('SW Registered successfully:', r);
          }
        },
        onRegisterError(error) {
          console.error('SW registration error:', error);
        },
      });
    }

    return () => {
      reloadListeners.delete(listener);
    };
  }, []);

  React.useEffect(() => {
    if (needRefresh) {
      toast('New content available, click on reload button to update.', {
        action: {
          label: 'Reload',
          onClick: () => {
            if (globalUpdateSW) {
              globalUpdateSW(true);
            }
          },
        },
        duration: 10000,
        onDismiss: () => {
          globalNeedRefresh = false;
          reloadListeners.forEach((l) => l(false));
        },
      });
    }
  }, [needRefresh]);

  return null;
};
