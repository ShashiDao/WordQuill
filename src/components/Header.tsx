import React from 'react';
import { Feather, Moon, Sun, Flame, Snowflake, Volume2, Settings, Download, Sparkles } from 'lucide-react';
import type { TabType, BeforeInstallPromptEvent } from '../types';

interface HeaderProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  streak: number;
  freezeAvailable?: boolean;
  speechRate: number;
  onChangeSpeechRate: (rate: number) => void;
  soundHapticsEnabled?: boolean;
  onToggleSoundHaptics?: () => void;
  onOpenPreferences: () => void;
  installPromptEvent?: BeforeInstallPromptEvent | null;
  onInstall?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  isDark,
  onToggleTheme,
  streak,
  freezeAvailable = false,
  speechRate,
  onChangeSpeechRate,
  soundHapticsEnabled = true,
  onToggleSoundHaptics,
  onOpenPreferences,
  installPromptEvent = null,
  onInstall,
}) => {
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true);

  const canInstall = Boolean(installPromptEvent) && !isStandalone;
  return (
    <header className="sticky top-0 z-40 border-b border-black/[0.08] bg-[#F6F1E7]/95 backdrop-blur-sm dark:border-white/[0.08] dark:bg-[#1B1815]/95 transition-colors">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand */}
        <div
          onClick={() => onTabChange('flashcards')}
          className="flex items-center gap-2.5 cursor-pointer select-none group"
          id="brand-header"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/[0.08] dark:border-white/[0.08] text-[#D98A93] group-hover:border-[#D98A93]/50 transition-colors">
            <Feather className="w-4 h-4 text-[#D98A93]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-fraunces italic font-medium text-xl text-[#1B1815] dark:text-[#F6F1E7]">
                WordQuill
              </span>
            </div>
            <p className="text-[11px] text-[#8C8272] hidden sm:block">
              Offline Vocabulary Mastery
            </p>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-4 overflow-x-auto scrollbar-none mask-edge-fade">
          <button
            id="nav-tab-flashcards"
            onClick={() => onTabChange('flashcards')}
            className={`pb-1 text-xs font-medium transition-all cursor-pointer ${
              currentTab === 'flashcards'
                ? 'text-[#1B1815] dark:text-[#F6F1E7] border-b border-[#D98A93]'
                : 'text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7]'
            }`}
          >
            Flashcards
          </button>
          <button
            id="nav-tab-quiz"
            onClick={() => onTabChange('quiz')}
            className={`pb-1 text-xs font-medium transition-all cursor-pointer ${
              currentTab === 'quiz'
                ? 'text-[#1B1815] dark:text-[#F6F1E7] border-b border-[#D98A93]'
                : 'text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7]'
            }`}
          >
            Quiz
          </button>
          <button
            id="nav-tab-words"
            onClick={() => onTabChange('words')}
            className={`pb-1 text-xs font-medium transition-all cursor-pointer ${
              currentTab === 'words'
                ? 'text-[#1B1815] dark:text-[#F6F1E7] border-b border-[#D98A93]'
                : 'text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7]'
            }`}
          >
            Word List
          </button>
          <button
            id="nav-tab-progress"
            onClick={() => onTabChange('progress')}
            className={`pb-1 text-xs font-medium transition-all cursor-pointer ${
              currentTab === 'progress'
                ? 'text-[#1B1815] dark:text-[#F6F1E7] border-b border-[#D98A93]'
                : 'text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7]'
            }`}
          >
            Dashboard
          </button>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Compact Streak & Freeze Badge */}
          <div
            id="streak-badge"
            className="flex items-center gap-1.5 text-xs font-medium text-[#C9924A]"
            title={`${streak} day learning streak${freezeAvailable ? ' · 1 streak freeze available' : ''}`}
          >
            <div className="flex items-center gap-1">
              <Flame className="w-4 h-4 text-[#C9924A]" />
              <span>{streak}d</span>
            </div>
            {freezeAvailable && (
              <span
                id="freeze-available-indicator"
                className="inline-flex items-center text-[#8FB996]"
                title="1 streak freeze available in current 7-day window"
              >
                <Snowflake className="w-3.5 h-3.5 text-[#8FB996]" />
              </span>
            )}
          </div>

          {/* Speech Rate Control */}
          <button
            id="speech-rate-toggle"
            onClick={() => onChangeSpeechRate(speechRate === 0.85 ? 1.0 : 0.85)}
            className="hidden sm:flex items-center gap-1.5 rounded-lg border border-black/[0.08] px-2.5 py-1 text-xs font-medium text-[#8C8272] hover:text-[#1B1815] dark:border-white/[0.08] dark:text-[#8C8272] dark:hover:text-[#F6F1E7] cursor-pointer transition-colors"
            title="Toggle speech pronunciation speed (0.85x / 1.0x)"
          >
            <Volume2 className="w-3.5 h-3.5 text-[#D98A93]" />
            <span>{speechRate === 0.85 ? '0.85x' : '1.0x'}</span>
          </button>

          {/* Sound & Haptics Toggle */}
          {onToggleSoundHaptics && (
            <button
              id="sound-haptics-toggle"
              onClick={onToggleSoundHaptics}
              className="hidden sm:flex items-center gap-1.5 rounded-lg border border-black/[0.08] px-2.5 py-1 text-xs font-medium text-[#8C8272] hover:text-[#1B1815] dark:border-white/[0.08] dark:text-[#8C8272] dark:hover:text-[#F6F1E7] cursor-pointer transition-colors"
              title={`Sound & Haptics: ${soundHapticsEnabled ? 'On' : 'Off'}`}
              aria-label={`Sound and haptics feedback ${soundHapticsEnabled ? 'enabled' : 'disabled'}`}
            >
              <Sparkles className={`w-3.5 h-3.5 ${soundHapticsEnabled ? 'text-[#8FB996]' : 'text-[#8C8272]/50'}`} />
              <span>{soundHapticsEnabled ? 'SFX On' : 'SFX Off'}</span>
            </button>
          )}

          {/* Native Install Button: plain icon+text, no pill, consistent with existing header icon buttons */}
          {canInstall && (
            <button
              id="header-install-btn"
              onClick={onInstall}
              className="flex items-center gap-1.5 rounded-lg border border-black/[0.08] px-2.5 py-1 text-xs font-medium text-[#8C8272] hover:text-[#1B1815] hover:border-[#D98A93] dark:border-white/[0.08] dark:text-[#8C8272] dark:hover:text-[#F6F1E7] cursor-pointer transition-colors"
              title="Install WordQuill on your device"
            >
              <Download className="w-3.5 h-3.5 text-[#D98A93]" />
              <span>Install</span>
            </button>
          )}

          {/* Theme Toggle */}
          <button
            id="theme-toggle-btn"
            onClick={onToggleTheme}
            className="rounded-lg border border-black/[0.08] p-1.5 text-[#8C8272] hover:text-[#1B1815] dark:border-white/[0.08] dark:hover:text-[#F6F1E7] transition-colors cursor-pointer"
            aria-label="Toggle dark mode"
          >
            {isDark ? <Sun className="w-4 h-4 text-[#C9924A]" /> : <Moon className="w-4 h-4 text-[#8C8272]" />}
          </button>

          {/* Preferences */}
          <button
            id="preferences-btn"
            onClick={onOpenPreferences}
            className="rounded-lg border border-black/[0.08] p-1.5 text-[#8C8272] hover:text-[#1B1815] dark:border-white/[0.08] dark:hover:text-[#F6F1E7] transition-colors cursor-pointer"
            aria-label="Preferences"
            title="Preferences & Study Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
