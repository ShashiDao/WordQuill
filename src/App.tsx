import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { Share2, X } from 'lucide-react';
import type { TabType, WordItem, UserWordProgress, DailyProgress, BeforeInstallPromptEvent } from './types';
import rawWords from './data/words.json';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { OfflineIndicator } from './components/OfflineIndicator';
import { OnboardingFlow, type OnboardingPreferences } from './components/OnboardingFlow';
import {
  getAllWordProgressMap,
  calculateStreak,
  getTodayString,
  getSetting,
  setSetting,
  consumeStreakFreezeIfNeeded,
  isStreakFreezeAvailable,
  getCustomWords,
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
  const [words, setWords] = useState<WordItem[]>(rawWords as WordItem[]);
  const [progressMap, setProgressMap] = useState<Map<string, UserWordProgress>>(new Map());
  const [streak, setStreak] = useState<number>(0);
  const [freezeAvailable, setFreezeAvailable] = useState<boolean>(true);
  const [todayProgress, setTodayProgress] = useState<DailyProgress | null>(null);
  const [speechRate, setSpeechRate] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('wordquill_speech_rate');
      return saved ? parseFloat(saved) : 0.85;
    } catch {
      return 0.85;
    }
  });

  // Settings & Onboarding state
  const [isOnboardingChecking, setIsOnboardingChecking] = useState<boolean>(true);
  const [isOnboardingNeeded, setIsOnboardingNeeded] = useState<boolean>(false);
  const [showPreferences, setShowPreferences] = useState<boolean>(false);
  const [preferredCategories, setPreferredCategories] = useState<string[]>([
    'advanced',
    'literary',
    'academic',
    'eloquence',
    'everyday',
  ]);
  const [dailyGoal, setDailyGoal] = useState<number>(10);
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(false);
  const [reminderTime, setReminderTime] = useState<string>('19:00');
  const [soundHapticsEnabled, setSoundHapticsEnabled] = useState<boolean>(true);

  // Native PWA install prompt & iOS install tip states
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosTip, setShowIosTip] = useState<boolean>(false);
  const [pendingFlashcardWordId, setPendingFlashcardWordId] = useState<string | null>(null);
  const [pendingFlashcardStatusFilter, setPendingFlashcardStatusFilter] = useState<string | null>(null);

  // Capture native beforeinstallprompt on mount
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // iOS Safari detection for dismissible one-time install tip (only in main app shell)
  useEffect(() => {
    if (isOnboardingChecking || isOnboardingNeeded) return;

    if (typeof window === 'undefined' || !window.navigator) return;
    const ua = window.navigator.userAgent;
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isIOS && !isStandalone) {
      try {
        const dismissed = localStorage.getItem('wordquill_ios_install_dismissed');
        if (!dismissed) {
          setShowIosTip(true);
        }
      } catch {
        // ignore
      }
    }
  }, [isOnboardingChecking, isOnboardingNeeded]);

  const handleDismissIosTip = () => {
    setShowIosTip(false);
    try {
      localStorage.setItem('wordquill_ios_install_dismissed', 'true');
    } catch {
      // ignore
    }
  };

  const handleInstallApp = async () => {
    if (!installPromptEvent) return;
    try {
      await installPromptEvent.prompt();
    } catch (err) {
      console.warn('Install prompt error:', err);
    } finally {
      // Clears it from state regardless of outcome
      setInstallPromptEvent(null);
    }
  };

  // Check onboarding on initial launch
  useEffect(() => {
    async function checkOnboardingAndSettings() {
      try {
        await consumeStreakFreezeIfNeeded();
        const completed = await getSetting<boolean | undefined>('onboardingComplete', undefined);
        const cats = await getSetting<string[]>('preferredCategories', [
          'advanced',
          'literary',
          'academic',
          'eloquence',
          'everyday',
        ]);
        const goal = await getSetting<number>('dailyGoal', 10);
        const storedSpeech = await getSetting<number>('speechRate', speechRate);
        const remEnabled = await getSetting<boolean>('reminderEnabled', false);
        const remTime = await getSetting<string>('reminderTime', '19:00');
        const soundHaptics = await getSetting<boolean>('soundHapticsEnabled', true);

        setPreferredCategories(cats);
        setDailyGoal(goal);
        if (storedSpeech) setSpeechRate(storedSpeech);
        setReminderEnabled(remEnabled);
        setReminderTime(remTime);
        setSoundHapticsEnabled(soundHaptics);

        // Foreground opt-in reminder check
        if (
          remEnabled &&
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          const todayStr = getTodayString();
          const lastShownDate = await getSetting<string>('lastReminderShownDate', '');

          if (lastShownDate !== todayStr) {
            const now = new Date();
            const [targetH, targetM] = remTime.split(':').map((v) => parseInt(v, 10));
            const currentMins = now.getHours() * 60 + now.getMinutes();
            const targetMins = (isNaN(targetH) ? 19 : targetH) * 60 + (isNaN(targetM) ? 0 : targetM);

            if (currentMins >= targetMins) {
              const todayProg = await db.progress.get(todayStr);
              const wordsReviewed = todayProg?.wordsReviewed || 0;

              if (wordsReviewed === 0) {
                try {
                  new Notification('WordQuill Daily Reminder', {
                    body: 'Time for your daily vocabulary review! Keep your learning streak alive.',
                    icon: '/pwa-192x192.png',
                  });
                  await setSetting('lastReminderShownDate', todayStr);
                } catch (notifErr) {
                  console.warn('Could not display local notification:', notifErr);
                }
              }
            }
          }
        }

        if (completed === undefined) {
          setIsOnboardingNeeded(true);
        } else {
          setIsOnboardingNeeded(false);
        }
      } catch (err) {
        console.warn('Error reading settings from database:', err);
        setIsOnboardingNeeded(false);
      } finally {
        setIsOnboardingChecking(false);
      }
    }

    checkOnboardingAndSettings();
  }, []);

  // Dark/Light Theme management
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('wordquill_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      try {
        localStorage.setItem('wordquill_theme', 'dark');
      } catch {
        // ignore
      }
    } else {
      root.classList.remove('dark');
      try {
        localStorage.setItem('wordquill_theme', 'light');
      } catch {
        // ignore
      }
    }
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  const handleSpeechRateChange = (rate: number) => {
    setSpeechRate(rate);
    try {
      localStorage.setItem('wordquill_speech_rate', rate.toString());
    } catch {
      // ignore
    }
    setSetting('speechRate', rate);
  };

  const handleToggleSoundHaptics = async () => {
    const nextVal = !soundHapticsEnabled;
    setSoundHapticsEnabled(nextVal);
    await setSetting('soundHapticsEnabled', nextVal);
    try {
      localStorage.setItem('wordquill_sound_haptics', nextVal ? 'true' : 'false');
    } catch {
      // ignore
    }
  };

  const handleNavigateToFlashcardsWithFilter = (filter: string) => {
    setPendingFlashcardStatusFilter(filter);
    setCurrentTab('flashcards');
  };

  const handleCompleteOnboarding = async (prefs: OnboardingPreferences) => {
    try {
      await setSetting('onboardingComplete', true);
      await setSetting('preferredCategories', prefs.preferredCategories);
      await setSetting('dailyGoal', prefs.dailyGoal);
      await setSetting('speechRate', prefs.speechRate);
      if (prefs.soundHapticsEnabled !== undefined) {
        await setSetting('soundHapticsEnabled', prefs.soundHapticsEnabled);
        setSoundHapticsEnabled(prefs.soundHapticsEnabled);
        try {
          localStorage.setItem('wordquill_sound_haptics', prefs.soundHapticsEnabled ? 'true' : 'false');
        } catch {}
      }
      if (prefs.reminderEnabled !== undefined) {
        await setSetting('reminderEnabled', prefs.reminderEnabled);
        setReminderEnabled(prefs.reminderEnabled);
      }
      if (prefs.reminderTime) {
        await setSetting('reminderTime', prefs.reminderTime);
        setReminderTime(prefs.reminderTime);
      }
      setPreferredCategories(prefs.preferredCategories);
      setDailyGoal(prefs.dailyGoal);
      setSpeechRate(prefs.speechRate);
      try {
        localStorage.setItem('wordquill_speech_rate', prefs.speechRate.toString());
      } catch {
        // ignore
      }
    } catch (err) {
      console.warn('Failed to save settings:', err);
    }
    setIsOnboardingNeeded(false);
    setShowPreferences(false);
  };

  // Load Dexie data
  const loadData = useCallback(async () => {
    try {
      const [pMap, currentStreak, today, freezes, custom] = await Promise.all([
        getAllWordProgressMap(),
        calculateStreak(),
        db.progress.get(getTodayString()),
        getSetting<string[]>('streakFreezesUsed', []),
        getCustomWords(),
      ]);
      setProgressMap(pMap);
      setStreak(currentStreak);
      setTodayProgress(today || null);
      setFreezeAvailable(isStreakFreezeAvailable(freezes));
      if (custom && custom.length > 0) {
        setWords([...(rawWords as WordItem[]), ...custom]);
      } else {
        setWords(rawWords as WordItem[]);
      }
    } catch (err) {
      console.warn('Error loading progress data from IndexedDB:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRestoreFromBackup = async () => {
    try {
      await setSetting('onboardingComplete', true);
      const cats = await getSetting<string[]>('preferredCategories', [
        'advanced',
        'literary',
        'academic',
        'eloquence',
        'everyday',
      ]);
      const goal = await getSetting<number>('dailyGoal', 10);
      const storedSpeech = await getSetting<number>('speechRate', speechRate);
      const remEnabled = await getSetting<boolean>('reminderEnabled', false);
      const remTime = await getSetting<string>('reminderTime', '19:00');
      setPreferredCategories(cats);
      setDailyGoal(goal);
      if (storedSpeech) setSpeechRate(storedSpeech);
      setReminderEnabled(remEnabled);
      setReminderTime(remTime);
      await loadData();
    } catch (err) {
      console.warn('Failed to refresh data after restore:', err);
    }
    setIsOnboardingNeeded(false);
    setShowPreferences(false);
  };

  // Navigate to flashcard with a specific word
  const handleSelectWordForFlashcards = (word: WordItem) => {
    setPendingFlashcardWordId(word.id);
    setCurrentTab('flashcards');
  };

  // If checking onboarding status, render subtle loader
  if (isOnboardingChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F1E7] dark:bg-[#1B1815]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#D98A93] border-t-transparent" />
      </div>
    );
  }

  // First launch onboarding flow: rendered before the main app shell
  if (isOnboardingNeeded) {
    return (
      <OnboardingFlow
        isFirstLaunch={true}
        initialPreferences={{
          preferredCategories,
          dailyGoal,
          speechRate,
          reminderEnabled,
          reminderTime,
        }}
        onComplete={handleCompleteOnboarding}
        onRestore={handleRestoreFromBackup}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F1E7] text-[#1B1815] dark:bg-[#1B1815] dark:text-[#F6F1E7] flex flex-col font-sans transition-colors duration-200">
      {/* Offline Alert Banner */}
      <OfflineIndicator />

      {/* iOS Safari Install Tip (one-time dismissible, main app shell only) */}
      {showIosTip && (
        <div
          id="ios-install-tip"
          className="border-b border-black/[0.08] bg-[#FAF6EE] px-4 py-2 dark:border-white/[0.08] dark:bg-[#201D1A] transition-colors"
        >
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-[#8C8272]">
              <Share2 className="w-3.5 h-3.5 text-[#D98A93] shrink-0" />
              <span>
                Tap <strong className="font-medium text-[#1B1815] dark:text-[#F6F1E7]">Share</strong>, then <strong className="font-medium text-[#1B1815] dark:text-[#F6F1E7]">Add to Home Screen</strong>.
              </span>
            </div>
            <button
              id="dismiss-ios-tip-btn"
              onClick={handleDismissIosTip}
              className="p-1 text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7] cursor-pointer transition-colors"
              aria-label="Dismiss iOS install tip"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <Header
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        streak={streak}
        freezeAvailable={freezeAvailable}
        speechRate={speechRate}
        soundHapticsEnabled={soundHapticsEnabled}
        onToggleSoundHaptics={handleToggleSoundHaptics}
        onChangeSpeechRate={handleSpeechRateChange}
        onOpenPreferences={() => setShowPreferences(true)}
        installPromptEvent={installPromptEvent}
        onInstall={handleInstallApp}
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
              preferredCategories={preferredCategories}
              initialWordId={pendingFlashcardWordId}
              onClearInitialWord={() => setPendingFlashcardWordId(null)}
              initialStatusFilter={pendingFlashcardStatusFilter}
              onClearInitialStatusFilter={() => setPendingFlashcardStatusFilter(null)}
              onDataUpdated={loadData}
              onNavigateToQuiz={() => setCurrentTab('quiz')}
            />
          )}

          {currentTab === 'quiz' && (
            <QuizView
              words={words}
              progressMap={progressMap}
              speechRate={speechRate}
              preferredCategories={preferredCategories}
              onDataUpdated={loadData}
              onSelectWordForFlashcard={handleSelectWordForFlashcards}
            />
          )}

          {currentTab === 'words' && (
            <WordListView
              words={words}
              progressMap={progressMap}
              speechRate={speechRate}
              preferredCategories={preferredCategories}
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
              dailyGoal={dailyGoal}
              soundHapticsEnabled={soundHapticsEnabled}
              onToggleSoundHaptics={handleToggleSoundHaptics}
              onChangeSpeechRate={handleSpeechRateChange}
              onDataUpdated={loadData}
              onNavigateToFlashcardsWithFilter={handleNavigateToFlashcardsWithFilter}
            />
          )}
        </Suspense>
      </main>

      {/* Mobile Bottom Navigation */}
      <Navigation currentTab={currentTab} onTabChange={setCurrentTab} />

      {/* Preferences Modal (reopens 3-step setup in editable form) */}
      {showPreferences && (
        <OnboardingFlow
          isFirstLaunch={false}
          initialPreferences={{
            preferredCategories,
            dailyGoal,
            speechRate,
            reminderEnabled,
            reminderTime,
            soundHapticsEnabled,
          }}
          onComplete={handleCompleteOnboarding}
          onClose={() => setShowPreferences(false)}
          onRestore={handleRestoreFromBackup}
        />
      )}
    </div>
  );
}
