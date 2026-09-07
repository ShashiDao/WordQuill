import React from 'react';
import { Feather, Moon, Sun, Flame, Volume2 } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import type { TabType } from '../types';

interface HeaderProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  streak: number;
  speechRate: number;
  onChangeSpeechRate: (rate: number) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  isDark,
  onToggleTheme,
  streak,
  speechRate,
  onChangeSpeechRate,
}) => {
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
          {/* Streak indicator - plain text + icon, no pill */}
          <div
            id="streak-badge"
            className="flex items-center gap-1 text-xs font-medium text-[#C9924A]"
            title={`${streak} day learning streak`}
          >
            <Flame className="w-4 h-4 text-[#C9924A]" />
            <span>{streak}d</span>
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

          {/* In-App PWA Install */}
          <PWAInstallButton />

          {/* Theme Toggle */}
          <button
            id="theme-toggle-btn"
            onClick={onToggleTheme}
            className="rounded-lg border border-black/[0.08] p-1.5 text-[#8C8272] hover:text-[#1B1815] dark:border-white/[0.08] dark:hover:text-[#F6F1E7] transition-colors cursor-pointer"
            aria-label="Toggle dark mode"
          >
            {isDark ? <Sun className="w-4 h-4 text-[#C9924A]" /> : <Moon className="w-4 h-4 text-[#8C8272]" />}
          </button>
        </div>
      </div>
    </header>
  );
};
