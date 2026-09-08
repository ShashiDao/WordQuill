import React, { useState } from 'react';
import {
  Feather,
  Check,
  Volume2,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
  BookOpen,
  Target,
  Bell,
  AlertCircle,
} from 'lucide-react';
import { speakWord } from '../utils/speech';
import { useBackupRestore } from '../hooks/useBackupRestore';
import { getSetting } from '../db/operations';

export interface OnboardingPreferences {
  preferredCategories: string[];
  dailyGoal: number;
  speechRate: number;
  reminderEnabled?: boolean;
  reminderTime?: string;
  soundHapticsEnabled?: boolean;
}

interface OnboardingFlowProps {
  isFirstLaunch: boolean;
  initialPreferences?: OnboardingPreferences;
  onComplete: (prefs: OnboardingPreferences) => void;
  onClose?: () => void;
  onRestore?: () => Promise<void> | void;
}

const ALL_CATEGORIES = [
  {
    id: 'advanced',
    label: 'Advanced',
    desc: 'Nuanced expressions and sophisticated diction',
  },
  {
    id: 'literary',
    label: 'Literary',
    desc: 'Poetic flourishes, evocative prose, and rhetorical phrasing',
  },
  {
    id: 'academic',
    label: 'Academic',
    desc: 'Scholarly, analytic, and rigorous conceptual terms',
  },
  {
    id: 'eloquence',
    label: 'Eloquence',
    desc: 'Persuasive rhetoric, articulate discourse, and public speaking',
  },
  {
    id: 'everyday',
    label: 'Everyday',
    desc: 'Practical, elevated vocabulary for insightful conversation',
  },
];

const PURPOSE_OPTIONS = [
  {
    id: 'exam',
    title: 'Exam prep (GRE/SAT)',
    desc: 'High-yield advanced and academic terminology for competitive tests',
    pace: '15 words / day',
    categories: ['advanced', 'academic'],
    dailyGoal: 15,
  },
  {
    id: 'writing',
    title: 'Better writing & speaking',
    desc: 'Articulate diction, rhetoric, and literary nuance for vivid expression',
    pace: '10 words / day',
    categories: ['literary', 'eloquence'],
    dailyGoal: 10,
  },
  {
    id: 'curiosity',
    title: 'General curiosity',
    desc: 'Broad, eclectic expansion spanning all five curated domains',
    pace: '10 words / day',
    categories: ALL_CATEGORIES.map((c) => c.id),
    dailyGoal: 10,
  },
];

const DAILY_GOALS = [
  { count: 5, label: '5 words', pace: 'Gentle & steady' },
  { count: 10, label: '10 words', pace: 'Recommended balance' },
  { count: 15, label: '15 words', pace: 'Active expansion' },
  { count: 20, label: '20 words', pace: 'Intensive immersion' },
];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  isFirstLaunch,
  initialPreferences,
  onComplete,
  onClose,
  onRestore,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const {
    fileInputRef,
    isImporting,
    pendingImportData,
    backupFeedback,
    setBackupFeedback,
    handleFileSelect,
    confirmImport,
    cancelImport,
    openFilePicker,
  } = useBackupRestore(async () => {
    if (onRestore) {
      await onRestore();
    } else {
      const restoredCategories = await getSetting<string[]>(
        'preferredCategories',
        ALL_CATEGORIES.map((c) => c.id)
      );
      const restoredGoal = await getSetting<number>('dailyGoal', 10);
      const restoredSpeech = await getSetting<number>('speechRate', 0.85);
      onComplete({
        preferredCategories: restoredCategories,
        dailyGoal: restoredGoal,
        speechRate: restoredSpeech,
      });
    }
  });

  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    if (initialPreferences?.preferredCategories && initialPreferences.preferredCategories.length > 0) {
      return initialPreferences.preferredCategories;
    }
    return ALL_CATEGORIES.map((c) => c.id);
  });

  const [dailyGoal, setDailyGoal] = useState<number>(() => {
    return initialPreferences?.dailyGoal || 10;
  });

  const [speechRate, setSpeechRate] = useState<number>(() => {
    return initialPreferences?.speechRate || 0.85;
  });

  const [soundHapticsEnabled, setSoundHapticsEnabled] = useState<boolean>(() => {
    return initialPreferences?.soundHapticsEnabled ?? true;
  });

  const [reminderEnabled, setReminderEnabled] = useState<boolean>(() => {
    return initialPreferences?.reminderEnabled ?? false;
  });

  const [reminderTime, setReminderTime] = useState<string>(() => {
    return initialPreferences?.reminderTime ?? '19:00';
  });

  const [notificationStatus, setNotificationStatus] = useState<
    'default' | 'granted' | 'denied' | 'unsupported'
  >(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    if (Notification.permission === 'denied') {
      return 'denied';
    }
    if (Notification.permission === 'granted') {
      return 'granted';
    }
    return 'default';
  });

  const [hasTestedAudio, setHasTestedAudio] = useState(false);

  const formatTime12h = (timeStr: string): string => {
    if (!timeStr) return '7:00 PM';
    const [hStr, mStr] = timeStr.split(':');
    const h = parseInt(hStr, 10);
    const m = mStr || '00';
    if (isNaN(h)) return timeStr;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return `${displayH}:${m} ${ampm}`;
  };

  const handleToggleReminder = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    if (checked) {
      if (typeof window === 'undefined' || !('Notification' in window)) {
        setNotificationStatus('unsupported');
        setReminderEnabled(false);
        return;
      }

      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          setNotificationStatus('granted');
          setReminderEnabled(true);
        } else {
          // If denied, silently disable the setting and show a small inline note, don't nag
          setNotificationStatus('denied');
          setReminderEnabled(false);
        }
      } catch {
        setNotificationStatus('denied');
        setReminderEnabled(false);
      }
    } else {
      setReminderEnabled(false);
    }
  };

  // Toggle single category
  const toggleCategory = (catId: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(catId)) {
        // Prevent deselecting all - must keep at least 1
        if (prev.length === 1) return prev;
        return prev.filter((id) => id !== catId);
      } else {
        return [...prev, catId];
      }
    });
  };

  const handleSelectAllCategories = () => {
    setSelectedCategories(ALL_CATEGORIES.map((c) => c.id));
  };

  const handleTestAudio = () => {
    speakWord('serendipity', speechRate);
    setHasTestedAudio(true);
  };

  const handleSelectPurpose = (opt: (typeof PURPOSE_OPTIONS)[number]) => {
    onComplete({
      preferredCategories: opt.categories,
      dailyGoal: opt.dailyGoal,
      speechRate,
      soundHapticsEnabled,
      reminderEnabled,
      reminderTime,
    });
  };

  const handleFinish = () => {
    onComplete({
      preferredCategories:
        selectedCategories.length > 0
          ? selectedCategories
          : ALL_CATEGORIES.map((c) => c.id),
      dailyGoal,
      speechRate,
      soundHapticsEnabled,
      reminderEnabled,
      reminderTime,
    });
  };

  const handleSkip = () => {
    onComplete({
      preferredCategories: ALL_CATEGORIES.map((c) => c.id),
      dailyGoal: 10,
      speechRate: 0.85,
      soundHapticsEnabled: true,
      reminderEnabled: false,
      reminderTime: '19:00',
    });
  };

  const content = (
    <div className="w-full max-w-lg mx-auto">
      {/* Step Indicators */}
      <div className="mb-6 flex items-center justify-between gap-2 border-b border-black/[0.08] pb-3 dark:border-white/[0.08]">
        {step > 1 || !isFirstLaunch ? (
          <div className="flex items-center gap-2.5 sm:gap-4 text-xs font-medium min-w-0">
            {[
              { num: 1, label: 'Welcome', shortLabel: 'Welcome' },
              { num: 2, label: 'Lexicon', shortLabel: 'Lexicon' },
              { num: 3, label: 'Daily Goal', shortLabel: 'Goal' },
            ].map((s) => (
              <button
                key={s.num}
                onClick={() => {
                  setStep(s.num as 1 | 2 | 3);
                }}
                className={`flex items-center gap-1 sm:gap-1.5 pb-0.5 transition cursor-pointer whitespace-nowrap shrink-0 ${
                  step === s.num
                    ? 'text-[#1B1815] dark:text-[#F6F1E7] border-b border-[#D98A93]'
                    : step > s.num
                    ? 'text-[#8FB996]'
                    : 'text-[#8C8272]'
                }`}
              >
                <span className="text-[11px] font-mono-ipa">0{s.num}</span>
                <span>
                  <span className="hidden sm:inline">{s.label}</span>
                  <span className="sm:hidden">{s.shortLabel}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <span className="text-xs font-medium text-[#8C8272]">Quick Setup</span>
        )}

        <div className="flex items-center gap-2.5 shrink-0">
          {/* Skip option on every step */}
          <button
            onClick={handleSkip}
            className="text-xs font-medium text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7] transition cursor-pointer whitespace-nowrap"
            title="Skip with defaults (all categories, 10 words/day)"
          >
            Skip
          </button>

          {!isFirstLaunch && onClose && (
            <button
              onClick={onClose}
              className="p-1 text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7] transition cursor-pointer"
              aria-label="Close preferences"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Step 1: Welcome & Quick Setup */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-black/[0.08] dark:border-white/[0.08] text-[#D98A93]">
            <Feather className="w-6 h-6 text-[#D98A93]" />
          </div>

          <div>
            <span className="text-xs font-medium text-[#C9924A]">
              Personal Vocabulary Journal
            </span>
            <h1 className="mt-1.5 font-fraunces text-3xl sm:text-4xl font-medium tracking-tight text-[#1B1815] dark:text-[#F6F1E7]">
              WordQuill
            </h1>
            <p className="mt-2.5 text-sm text-[#8C8272] leading-relaxed">
              Build an articulate, commanding vocabulary for exams, writing, and literature. Master nuanced words through spaced repetition, adaptive recall quizzes, and native audio — completely offline in your browser.
            </p>
          </div>

          <div className="space-y-3 pt-1">
            <div className="flex items-start gap-3 text-xs text-[#8C8272]">
              <span className="font-mono-ipa text-[#D98A93] pt-0.5">•</span>
              <div>
                <strong className="text-[#1B1815] dark:text-[#F6F1E7] font-medium">100% Offline & Private</strong>
                <p className="mt-0.5">All progress, flashcard reviews, and quiz scores stay inside your browser IndexedDB. No accounts or trackers.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 text-xs text-[#8C8272]">
              <span className="font-mono-ipa text-[#8FB996] pt-0.5">•</span>
              <div>
                <strong className="text-[#1B1815] dark:text-[#F6F1E7] font-medium">SuperMemo (SM-2) Spaced Repetition</strong>
                <p className="mt-0.5">Words resurface right as your memory begins to fade, cementing rare vocabulary into long-term recall.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 text-xs text-[#8C8272]">
              <span className="font-mono-ipa text-[#C9924A] pt-0.5">•</span>
              <div>
                <strong className="text-[#1B1815] dark:text-[#F6F1E7] font-medium">Accurate IPA & Speech Pronunciation</strong>
                <p className="mt-0.5">Hear every nuance spoken aloud via browser speech synthesis with customized cadence controls.</p>
              </div>
            </div>
          </div>

          {/* Purpose Question & Quick Setup Cards */}
          <div className="pt-2 space-y-3">
            <div>
              <h2 className="font-fraunces text-lg sm:text-xl font-medium text-[#1B1815] dark:text-[#F6F1E7]">
                What are you building your vocabulary for?
              </h2>
              <p className="mt-1 text-xs text-[#8C8272]">
                Choose your focus to set up in one tap, or customize every detail yourself.
              </p>
            </div>

            <div className="space-y-2.5">
              {PURPOSE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectPurpose(opt)}
                  className="w-full group rounded-xl border border-black/[0.08] bg-[#FAF6EE] p-3.5 sm:p-4 text-left transition hover:border-[#D98A93]/60 dark:border-white/[0.08] dark:bg-[#221E1B] dark:hover:border-[#D98A93]/60 cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="font-fraunces text-base font-medium text-[#1B1815] dark:text-[#F6F1E7]">
                        {opt.title}
                      </span>
                      <p className="mt-1 text-xs text-[#8C8272] leading-relaxed">
                        {opt.desc}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] font-mono-ipa text-[#D98A93] bg-[#D98A93]/10 px-2 py-0.5 rounded-md mt-0.5">
                      {opt.pace}
                    </span>
                  </div>
                </button>
              ))}

              {/* 4th card: Let me pick myself */}
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full group rounded-xl border border-black/[0.08] bg-transparent p-3.5 sm:p-4 text-left transition hover:border-black/[0.2] hover:bg-black/[0.02] dark:border-white/[0.08] dark:hover:border-white/[0.2] dark:hover:bg-white/[0.02] cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="font-fraunces text-base font-medium text-[#1B1815] dark:text-[#F6F1E7]">
                      Let me pick myself
                    </span>
                    <p className="mt-1 text-xs text-[#8C8272] leading-relaxed">
                      Hand-pick vocabulary domains, review targets, and pronunciation pace
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#8C8272] group-hover:text-[#1B1815] dark:group-hover:text-[#F6F1E7] shrink-0 mt-1 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            </div>
          </div>

          {/* Backup Restore Link */}
          <div className="pt-1">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={openFilePicker}
              className="text-xs text-[#8C8272] hover:text-[#D98A93] dark:hover:text-[#F6F1E7] underline underline-offset-2 transition cursor-pointer"
            >
              Already have a WordQuill backup? Restore it
            </button>
          </div>

          {/* Pending Backup Import Confirmation */}
          {pendingImportData && (
            <div className="rounded-xl border border-[#D98A93]/40 bg-[#FAF6EE] dark:bg-[#221E1B] p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-[#D98A93] shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-medium text-[#1B1815] dark:text-[#F6F1E7]">
                    Restore WordQuill backup?
                  </p>
                  <p className="text-[#8C8272] mt-0.5 text-[11px]">
                    Contains: {pendingImportData.savedWords?.length || 0} words,{' '}
                    {pendingImportData.progress?.length || 0} daily activity logs,{' '}
                    {pendingImportData.settings?.length || 0} settings.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={confirmImport}
                  disabled={isImporting}
                  className="rounded-lg bg-[#D98A93] px-3.5 py-1.5 text-xs font-medium text-[#1B1815] hover:opacity-90 transition cursor-pointer"
                >
                  {isImporting ? 'Restoring...' : 'Restore backup'}
                </button>
                <button
                  type="button"
                  onClick={cancelImport}
                  disabled={isImporting}
                  className="rounded-lg border border-black/[0.08] dark:border-white/[0.08] px-3 py-1.5 text-xs font-medium text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7] transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Backup feedback */}
          {backupFeedback && (
            <div
              className={`rounded-xl border p-3 text-xs flex items-center justify-between gap-2 ${
                backupFeedback.type === 'success'
                  ? 'border-[#8FB996]/40 text-[#8FB996] bg-[#8FB996]/[0.06]'
                  : 'border-[#D98A93]/40 text-[#D98A93] bg-[#D98A93]/[0.06]'
              }`}
            >
              <span>{backupFeedback.message}</span>
              <button
                type="button"
                onClick={() => setBackupFeedback(null)}
                className="p-0.5 hover:opacity-75 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Skip setup footer link */}
          <div className="pt-2 flex items-center justify-between gap-3 border-t border-black/[0.06] dark:border-white/[0.06]">
            <button
              onClick={handleSkip}
              className="text-xs text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7] transition cursor-pointer"
            >
              Skip setup
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Category Preference */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <span className="text-xs font-medium text-[#D98A93]">
              Step 2 of 3
            </span>
            <h2 className="mt-1 font-fraunces text-2xl sm:text-3xl font-medium tracking-tight text-[#1B1815] dark:text-[#F6F1E7]">
              Select focus domains
            </h2>
            <p className="mt-1.5 text-xs text-[#8C8272]">
              Choose the vocabulary categories you want to prioritize first. You can always switch or explore all words later.
            </p>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-[#8C8272]">
              {selectedCategories.length} of {ALL_CATEGORIES.length} selected
            </span>
            <button
              onClick={handleSelectAllCategories}
              className="text-xs font-medium text-[#D98A93] hover:underline cursor-pointer"
            >
              Select all
            </button>
          </div>

          {/* Categories List: Plain text with checkmark or underline when selected (NO FILLED PILL BADGES) */}
          <div className="space-y-2">
            {ALL_CATEGORIES.map((cat) => {
              const isSelected = selectedCategories.includes(cat.id);
              return (
                <div
                  key={cat.id}
                  onClick={() => toggleCategory(cat.id)}
                  className={`group flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                    isSelected
                      ? 'border-[#D98A93]/60 bg-[#FAF6EE] dark:bg-[#221E1B]'
                      : 'border-black/[0.08] dark:border-white/[0.08] bg-transparent hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="space-y-0.5 pr-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-fraunces text-base font-medium transition-colors ${
                          isSelected
                            ? 'text-[#1B1815] dark:text-[#F6F1E7] border-b border-[#D98A93]'
                            : 'text-[#8C8272] group-hover:text-[#1B1815] dark:group-hover:text-[#F6F1E7]'
                        }`}
                      >
                        {cat.label}
                      </span>
                    </div>
                    <p className="text-xs text-[#8C8272] leading-relaxed">
                      {cat.desc}
                    </p>
                  </div>

                  <div className="flex-shrink-0">
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${
                        isSelected
                          ? 'border-[#D98A93] text-[#D98A93]'
                          : 'border-black/[0.15] dark:border-white/[0.15] text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 flex items-center justify-between gap-3">
            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-1 text-xs text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7] transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <button
              onClick={() => setStep(3)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#D98A93] px-5 py-2.5 text-xs font-medium text-[#1B1815] hover:opacity-90 active:scale-95 transition cursor-pointer"
            >
              <span>Continue to goal</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Daily Goal & Speech Rate */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <span className="text-xs font-medium text-[#8FB996]">
              Step 3 of 3
            </span>
            <h2 className="mt-1 font-fraunces text-2xl sm:text-3xl font-medium tracking-tight text-[#1B1815] dark:text-[#F6F1E7]">
              Set your rhythm
            </h2>
            <p className="mt-1.5 text-xs text-[#8C8272]">
              Choose a manageable daily target and select your preferred pronunciation playback speed.
            </p>
          </div>

          {/* Daily Goal Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-[#8C8272]">
              <span className="font-medium text-[#1B1815] dark:text-[#F6F1E7]">
                Daily Review Target
              </span>
              <span>{dailyGoal} words / day</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {DAILY_GOALS.map((g) => {
                const isSelected = dailyGoal === g.count;
                return (
                  <button
                    key={g.count}
                    onClick={() => setDailyGoal(g.count)}
                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#D98A93] bg-[#FAF6EE] dark:bg-[#221E1B]'
                        : 'border-black/[0.08] dark:border-white/[0.08] hover:border-black/[0.2] dark:hover:border-white/[0.2]'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span
                        className={`font-fraunces text-lg font-medium ${
                          isSelected
                            ? 'text-[#1B1815] dark:text-[#F6F1E7]'
                            : 'text-[#8C8272]'
                        }`}
                      >
                        {g.count}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#D98A93]" />}
                    </div>
                    <span className="text-[11px] text-[#8C8272] mt-0.5">
                      {g.pace}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Speech Rate Selection */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs text-[#8C8272]">
              <span className="font-medium text-[#1B1815] dark:text-[#F6F1E7]">
                Pronunciation Playback Speed
              </span>
              <button
                onClick={handleTestAudio}
                className="inline-flex items-center gap-1 text-xs text-[#D98A93] hover:underline cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Test speech</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                { rate: 0.85, label: '0.85x Deliberate', desc: 'Clear phonetics & articulation' },
                { rate: 1.0, label: '1.0x Natural', desc: 'Standard conversational speed' },
              ].map((r) => {
                const isSelected = speechRate === r.rate;
                return (
                  <button
                    key={r.rate}
                    onClick={() => setSpeechRate(r.rate)}
                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#D98A93] bg-[#FAF6EE] dark:bg-[#221E1B]'
                        : 'border-black/[0.08] dark:border-white/[0.08] hover:border-black/[0.2] dark:hover:border-white/[0.2]'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span
                        className={`text-xs font-medium ${
                          isSelected
                            ? 'text-[#1B1815] dark:text-[#F6F1E7] border-b border-[#D98A93]'
                            : 'text-[#8C8272]'
                        }`}
                      >
                        {r.label}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#D98A93]" />}
                    </div>
                    <span className="text-[11px] text-[#8C8272] mt-1">
                      {r.desc}
                    </span>
                  </button>
                );
              })}
            </div>
            {hasTestedAudio && (
              <p className="text-[11px] text-[#8FB996]">
                Pronunciation test played using native Web Speech API.
              </p>
            )}
          </div>

          {/* Sound & Haptic Feedback */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-[#FAF6EE] dark:bg-[#221E1B]">
              <div className="space-y-0.5 pr-3">
                <span className="font-medium text-xs text-[#1B1815] dark:text-[#F6F1E7]">
                  Sound & Haptic Feedback
                </span>
                <p className="text-[11px] text-[#8C8272]">
                  Subtle audio chime and vibration on correct answers and card mastery
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSoundHapticsEnabled(!soundHapticsEnabled)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                  soundHapticsEnabled ? 'bg-[#8FB996]' : 'bg-black/20 dark:bg-white/20'
                }`}
                aria-label={`Sound and haptics ${soundHapticsEnabled ? 'enabled' : 'disabled'}`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    soundHapticsEnabled ? 'translate-x-4.5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Daily Reminder (Opt-in Notification API) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs text-[#8C8272]">
              <span className="font-medium text-[#1B1815] dark:text-[#F6F1E7]">
                Daily Study Reminder
              </span>
              <span className="text-[11px] text-[#8C8272]">
                {reminderEnabled ? `Active at ${formatTime12h(reminderTime)}` : 'Off'}
              </span>
            </div>

            <div className="rounded-xl border border-black/[0.08] dark:border-white/[0.08] p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Bell className="w-4 h-4 text-[#D98A93]" />
                  <div>
                    <label
                      htmlFor="reminder-toggle"
                      className="text-xs font-medium text-[#1B1815] dark:text-[#F6F1E7] cursor-pointer"
                    >
                      Remind me daily at
                    </label>
                    <p className="text-[11px] text-[#8C8272]">
                      Foreground notification when opening WordQuill past reminder time
                    </p>
                  </div>
                </div>

                <input
                  type="checkbox"
                  id="reminder-toggle"
                  checked={reminderEnabled}
                  onChange={handleToggleReminder}
                  className="h-4 w-4 rounded accent-[#D98A93] cursor-pointer"
                />
              </div>

              {reminderEnabled && (
                <div className="flex items-center gap-2.5 pt-1">
                  <label htmlFor="reminder-time" className="text-xs text-[#8C8272]">
                    Time:
                  </label>
                  <input
                    type="time"
                    id="reminder-time"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    className="rounded-lg border border-black/[0.12] dark:border-white/[0.12] bg-transparent px-2.5 py-1 text-xs text-[#1B1815] dark:text-[#F6F1E7] focus:border-[#D98A93] focus:outline-none"
                  />
                  <span className="text-xs text-[#8C8272]">({formatTime12h(reminderTime)})</span>
                </div>
              )}

              {notificationStatus === 'denied' && (
                <p className="text-[11px] text-[#D98A93]">
                  Notification permission was denied in your browser settings.
                </p>
              )}

              {notificationStatus === 'unsupported' && (
                <p className="text-[11px] text-[#8C8272]">
                  Notifications are not supported in this browser.
                </p>
              )}

              <p className="text-[11px] text-[#8C8272] leading-relaxed">
                Note: Without a background push server, notifications check during open app sessions.
              </p>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between gap-3">
            <button
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-1 text-xs text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7] transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <button
              onClick={handleFinish}
              className="inline-flex items-center gap-2 rounded-xl bg-[#D98A93] px-6 py-2.5 text-xs font-medium text-[#1B1815] hover:opacity-90 active:scale-95 transition cursor-pointer"
            >
              <span>{isFirstLaunch ? 'Complete setup' : 'Save preferences'}</span>
              <Check className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (isFirstLaunch) {
    return (
      <div className="min-h-screen bg-[#F6F1E7] dark:bg-[#1B1815] text-[#1B1815] dark:text-[#F6F1E7] flex flex-col justify-center px-4 py-8 sm:px-6 transition-colors">
        {content}
      </div>
    );
  }

  // Preferences modal overlay
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-black/[0.08] bg-[#F6F1E7] p-6 text-[#1B1815] shadow-xl dark:border-white/[0.08] dark:bg-[#1B1815] dark:text-[#F6F1E7]">
        {content}
      </div>
    </div>
  );
};
