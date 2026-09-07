import React, { useState } from 'react';
import { Download, Share2, X, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        id="pwa-install-btn"
        onClick={install}
        className="flex items-center gap-1.5 rounded-lg border border-black/[0.08] px-2.5 py-1 text-xs font-medium text-[#1B1815] transition hover:border-[#D98A93] dark:border-white/[0.08] dark:text-[#F6F1E7] cursor-pointer"
        title="Install WordQuill on your device"
      >
        <Download className="w-3.5 h-3.5 text-[#D98A93]" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari flow (beforeinstallprompt is not supported by WebKit)
  if (isIOS) {
    return (
      <>
        <button
          id="pwa-install-ios-btn"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-lg border border-black/[0.08] px-2.5 py-1 text-xs font-medium text-[#1B1815] transition hover:border-[#D98A93] dark:border-white/[0.08] dark:text-[#F6F1E7] cursor-pointer"
          title="Install on iOS"
        >
          <Smartphone className="w-3.5 h-3.5 text-[#D98A93]" />
          <span>Install</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-sm rounded-2xl border border-black/[0.08] bg-[#FAF6EE] p-6 dark:border-white/[0.08] dark:bg-[#221E1B]">
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 p-1 text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/[0.08] text-[#D98A93] dark:border-white/[0.08]">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-fraunces text-base font-medium text-[#1B1815] dark:text-[#F6F1E7]">Install on iPhone / iPad</h3>
                  <p className="text-xs text-[#8C8272]">Add WordQuill to your home screen</p>
                </div>
              </div>
              <div className="mt-4 space-y-2.5 text-xs text-[#8C8272]">
                <div className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-black/[0.08] font-mono text-[11px] text-[#8C8272] dark:border-white/[0.08]">1</span>
                  <span>Tap the <strong className="text-[#D98A93] font-medium">Share</strong> button in the Safari bottom toolbar.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-black/[0.08] font-mono text-[11px] text-[#8C8272] dark:border-white/[0.08]">2</span>
                  <span>Scroll down and select <strong className="text-[#D98A93] font-medium">Add to Home Screen</strong>.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-black/[0.08] font-mono text-[11px] text-[#8C8272] dark:border-white/[0.08]">3</span>
                  <span>Enjoy fast offline access directly from your home screen.</span>
                </div>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full rounded-xl bg-[#D98A93] py-2 text-xs font-medium text-[#1B1815] hover:opacity-90 cursor-pointer transition"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
