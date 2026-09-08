import React from 'react';
import { X, ShieldCheck, Database, HardDrive, Wifi, Lock } from 'lucide-react';

interface DataPrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DataPrivacyModal: React.FC<DataPrivacyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="data-privacy-title"
    >
      <div
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-black/[0.08] bg-[#F6F1E7] p-6 text-[#1B1815] shadow-xl dark:border-white/[0.08] dark:bg-[#1B1815] dark:text-[#F6F1E7]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-black/[0.08] pb-4 dark:border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#8FB996]/15 text-[#8FB996]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="data-privacy-title"
                className="font-fraunces text-xl font-medium text-[#1B1815] dark:text-[#F6F1E7]"
              >
                How your data works
              </h2>
              <p className="text-xs text-[#8C8272]">
                Honest, plain-language breakdown of your privacy and storage
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7] transition cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 pt-4 text-xs text-[#8C8272] leading-relaxed">
          {/* Item 1 */}
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-black/[0.08] dark:border-white/[0.08] text-[#D98A93] mt-0.5">
              <Database className="h-3.5 w-3.5" />
            </div>
            <div>
              <strong className="block text-[#1B1815] dark:text-[#F6F1E7] font-medium mb-0.5">
                100% Local in IndexedDB
              </strong>
              <p>
                All your progress — saved words, review schedules, spaced repetition intervals, quiz results, custom vocabulary, and streaks — lives entirely inside this browser&apos;s IndexedDB database.
              </p>
            </div>
          </div>

          {/* Item 2 */}
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-black/[0.08] dark:border-white/[0.08] text-[#8FB996] mt-0.5">
              <Lock className="h-3.5 w-3.5" />
            </div>
            <div>
              <strong className="block text-[#1B1815] dark:text-[#F6F1E7] font-medium mb-0.5">
                No Accounts, No Servers, No Analytics
              </strong>
              <p>
                Nothing you do in WordQuill is ever sent to a remote server. There are no user accounts, no passwords, no trackers, and no telemetry analytics.
              </p>
            </div>
          </div>

          {/* Item 3 */}
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-black/[0.08] dark:border-white/[0.08] text-[#C9924A] mt-0.5">
              <Wifi className="h-3.5 w-3.5" />
            </div>
            <div>
              <strong className="block text-[#1B1815] dark:text-[#F6F1E7] font-medium mb-0.5">
                The Only Network Request
              </strong>
              <p>
                The only external network request the app ever makes is fetching Google Fonts (Fraunces and Plus Jakarta Sans) on your very first visit. Once loaded, the fonts are cached locally by the browser and service worker so the app remains fully functional offline.
              </p>
            </div>
          </div>

          {/* Item 4 */}
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-black/[0.08] dark:border-white/[0.08] text-[#8C8272] mt-0.5">
              <HardDrive className="h-3.5 w-3.5" />
            </div>
            <div>
              <strong className="block text-[#1B1815] dark:text-[#F6F1E7] font-medium mb-0.5">
                Keep Your Progress Safe
              </strong>
              <p>
                Because your data is tied to this specific browser, clearing browser history/data or using Private/Incognito mode will erase your records. We encourage downloading a JSON backup file periodically from the Dashboard or Settings.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between border-t border-black/[0.08] pt-4 dark:border-white/[0.08]">
          <span className="text-[11px] text-[#8C8272]">
            WordQuill · Pure offline learning
          </span>
          <button
            onClick={onClose}
            className="rounded-xl bg-[#D98A93] px-4 py-2 text-xs font-medium text-[#1B1815] hover:opacity-90 transition cursor-pointer"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};
