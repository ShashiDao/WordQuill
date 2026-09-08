import React, { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { registerSW } from 'virtual:pwa-register';

export const PwaUpdateToast: React.FC = () => {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateSWFn, setUpdateSWFn] = useState<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    try {
      const update = registerSW({
        onNeedRefresh() {
          setNeedRefresh(true);
        },
        onOfflineReady() {
          // Keep silent per specification
        },
      });
      setUpdateSWFn(() => update);
    } catch (err) {
      console.warn('PWA registration error:', err);
    }
  }, []);

  if (!needRefresh) return null;

  const handleRefresh = async () => {
    if (updateSWFn) {
      await updateSWFn(true);
    } else {
      window.location.reload();
    }
  };

  return (
    <div
      id="pwa-update-toast"
      role="alert"
      className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center justify-between gap-3 rounded-xl border border-[#D98A93]/40 bg-[#FAF6EE] dark:bg-[#221E1B] px-4 py-3 shadow-lg max-w-sm w-[90vw] transition-all"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#D98A93]/15 text-[#D98A93]">
          <RefreshCw className="h-3.5 w-3.5" />
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          className="text-left text-xs font-medium text-[#1B1815] dark:text-[#F6F1E7] hover:underline cursor-pointer truncate"
        >
          New version available — tap to refresh
        </button>
      </div>

      <button
        type="button"
        onClick={() => setNeedRefresh(false)}
        className="p-1 rounded-md text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7] cursor-pointer shrink-0"
        aria-label="Dismiss update notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
