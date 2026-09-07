import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      id="offline-banner"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/90 px-3.5 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-md transition-all duration-300 animate-fade-in"
    >
      <WifiOff className="w-3.5 h-3.5" />
      <span>Offline Mode — All features & vocabulary available offline</span>
    </div>
  );
};
