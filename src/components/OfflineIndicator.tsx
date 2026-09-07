import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      id="offline-banner"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl border border-black/[0.08] bg-[#FAF6EE] px-3.5 py-1.5 text-xs font-medium text-[#C9924A] dark:border-white/[0.08] dark:bg-[#221E1B] transition-all duration-300 animate-fade-in"
    >
      <WifiOff className="w-3.5 h-3.5 text-[#C9924A]" />
      <span>Offline Mode — All features & vocabulary available offline</span>
    </div>
  );
};
