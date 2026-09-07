import React, { useState, useEffect, useCallback, Suspense } from 'react';
import type { TabType, WordItem, UserWordProgress, DailyProgress } from './types';
import rawWords from './data/words.json';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { OfflineIndicator } from './components/OfflineIndicator';
import {
  getAllWordProgressMap,
  calculateStreak,
  getTodayString,
} from './db/operations';
import { db } from './db';

// Code-split tab views using React.lazy as mandated by architecture requirements
const FlashcardView = React.lazy(() =>
  import('./components/FlashcardView').then((m) => ({ default: m.FlashcardView }))
);
const QuizView = React.lazy(() =>
  import('./components/QuizView').then((m) => ({ default: m.QuizView }))
);
const WordListView = React.lazy(() =>
  import('./components/WordListView').then((m) => ({ default: m.WordListView }))
);
const ProgressDashboard = React.lazy(() =>
  import('./components/ProgressDashboard').then((m) => ({ default: m.ProgressDashboard }))
);

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabType>('flashcards');
  const [words] = useState<WordItem[]>(rawWords as WordItem[]);
  const [progressMap, setProgressMap] = useState<Map<string, UserWordProgress>>(new Map());
  const [streak, setStreak] = useState<number>(0);
  const [todayProgress, setTodayProgress] = useState<DailyProgress | null>(null);
  const [speechRate, setSpeechRate] = useState<number>(() => {
    const saved = localStorage.getItem('wordquill_speech_rate');
    return saved ? parseFloat(saved) : 0.85;
  });

  // Dark/Light Theme management
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('wordquill_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('wordquill_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('wordquill_theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  const handleSpeechRateChange = (rate: number) => {
    setSpeechRate(rate);
    localStorage.setItem('wordquill_speech_rate', rate.toString());
  };

  // Load Dexie data
  const loadData = useCallback(async () => {
    try {
      const [pMap, currentStreak, today] = await Promise.all([
        getAllWordProgressMap(),
        calculateStreak(),
        db.progress.get(getTodayString()),
      ]);
      setProgressMap(pMap);
      setStreak(currentStreak);
      setTodayProgress(today || null);
    } catch (err) {
      console.warn('Error loading progress data from IndexedDB:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Navigate to flashcard with a specific word
  const handleSelectWordForFlashcards = () => {
    setCurrentTab('flashcards');
  };

  return (
    <div className="min-h-screen bg-[#F6F1E7] text-[#1B1815] dark:bg-[#1B1815] dark:text-[#F6F1E7] flex flex-col font-sans transition-colors duration-200">
      {/* Offline Alert Banner */}
      <OfflineIndicator />

      {/* Header */}
      <Header
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        streak={streak}
        speechRate={speechRate}
        onChangeSpeechRate={handleSpeechRateChange}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        <Suspense
          fallback={
            <div className="flex h-72 items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#D98A93] border-t-transparent" />
                <p className="text-xs font-medium text-[#8C8272]">Loading dictionary...</p>
              </div>
            </div>
          }
        >
          {currentTab === 'flashcards' && (
            <FlashcardView
              words={words}
              progressMap={progressMap}
              speechRate={speechRate}
              onDataUpdated={loadData}
              onNavigateToQuiz={() => setCurrentTab('quiz')}
            />
          )}

          {currentTab === 'quiz' && (
            <QuizView
              words={words}
              progressMap={progressMap}
              speechRate={speechRate}
              onDataUpdated={loadData}
              onSelectWordForFlashcard={handleSelectWordForFlashcards}
            />
          )}

          {currentTab === 'words' && (
            <WordListView
              words={words}
              progressMap={progressMap}
              speechRate={speechRate}
              onDataUpdated={loadData}
              onSelectWordForFlashcards={handleSelectWordForFlashcards}
            />
          )}

          {currentTab === 'progress' && (
            <ProgressDashboard
              words={words}
              progressMap={progressMap}
              streak={streak}
              todayProgress={todayProgress}
              speechRate={speechRate}
              onChangeSpeechRate={handleSpeechRateChange}
              onDataUpdated={loadData}
            />
          )}
        </Suspense>
      </main>

      {/* Mobile Bottom Navigation */}
      <Navigation currentTab={currentTab} onTabChange={setCurrentTab} />
    </div>
  );
}
