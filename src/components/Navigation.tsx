import React from 'react';
import { Layers, CheckCircle2, BookOpen, BarChart3 } from 'lucide-react';
import type { TabType } from '../types';

interface NavigationProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentTab, onTabChange }) => {
  const tabs: { id: TabType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'flashcards', label: 'Flashcards', icon: Layers },
    { id: 'quiz', label: 'Quiz', icon: CheckCircle2 },
    { id: 'words', label: 'Words', icon: BookOpen },
    { id: 'progress', label: 'Progress', icon: BarChart3 },
  ];

  return (
    <nav
      id="bottom-mobile-nav"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-black/[0.08] bg-[#F6F1E7] dark:border-white/[0.08] dark:bg-[#1B1815] md:hidden"
    >
      <div className="flex h-16 items-center justify-around px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`mobile-tab-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-1 flex-col items-center justify-center py-1 transition-colors cursor-pointer ${
                isActive
                  ? 'text-[#D98A93]'
                  : 'text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7]'
              }`}
            >
              <Icon className="w-5 h-5 stroke-[1.5]" />
              <span className="text-[11px] tracking-tight mt-1 font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
