import React, { useState } from 'react';
import {
  Flame,
  CheckCircle2,
  BookOpen,
  HelpCircle,
  BarChart2,
  Award,
  Sparkles,
  Volume2,
  Trash2,
  Check,
  RotateCcw,
} from 'lucide-react';
import type { WordItem, UserWordProgress, DailyProgress } from '../types';
import { db } from '../db';
import { speakWord } from '../utils/speech';

interface ProgressDashboardProps {
  words: WordItem[];
  progressMap: Map<string, UserWordProgress>;
  streak: number;
  todayProgress: DailyProgress | null;
  speechRate: number;
  onChangeSpeechRate: (rate: number) => void;
  onDataUpdated: () => void;
}

export const ProgressDashboard: React.FC<ProgressDashboardProps> = ({
  words,
  progressMap,
  streak,
  todayProgress,
  speechRate,
  onChangeSpeechRate,
  onDataUpdated,
}) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [dailyGoal, setDailyGoal] = useState<number>(10);

  // Stats calculation
  const totalWords = words.length;
  let masteredCount = 0;
  let learningCount = 0;
  let bookmarkedCount = 0;
  let totalReviews = 0;
  let totalCorrectAnswers = 0;
  let totalAnswered = 0;

  progressMap.forEach((prog) => {
    if (prog.status === 'mastered') masteredCount++;
    if (prog.status === 'learning') learningCount++;
    if (prog.isBookmarked) bookmarkedCount++;
    totalReviews += prog.reviewCount || 0;
    totalCorrectAnswers += prog.correctCount || 0;
    totalAnswered += (prog.correctCount || 0) + (prog.incorrectCount || 0);
  });

  const wordsStudiedToday = todayProgress?.wordsReviewed || 0;
  const overallAccuracy =
    totalAnswered > 0 ? Math.round((totalCorrectAnswers / totalAnswered) * 100) : 0;
  const masteryPercentage =
    totalWords > 0 ? Math.round((masteredCount / totalWords) * 100) : 0;

  // Category breakdown
  const categoryStats = React.useMemo(() => {
    const cats: Record<string, { total: number; mastered: number; learning: number }> = {};
    words.forEach((w) => {
      if (!cats[w.category]) {
        cats[w.category] = { total: 0, mastered: 0, learning: 0 };
      }
      cats[w.category].total++;
      const p = progressMap.get(w.id);
      if (p?.status === 'mastered') cats[w.category].mastered++;
      if (p?.status === 'learning') cats[w.category].learning++;
    });
    return Object.entries(cats).map(([category, data]) => ({
      category,
      total: data.total,
      mastered: data.mastered,
      percent: Math.round((data.mastered / data.total) * 100),
    }));
  }, [words, progressMap]);

  const handleResetData = async () => {
    setIsResetting(true);
    await db.savedWords.clear();
    await db.progress.clear();
    setShowResetConfirm(false);
    setIsResetting(false);
    onDataUpdated();
  };

  const testPronunciation = () => {
    speakWord('supercalifragilisticexpialidocious', speechRate);
  };

  return (
    <div className="mx-auto max-w-2xl pb-28 pt-4 px-4 space-y-6">
      {/* Streak Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 p-6 text-white shadow-xl">
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-indigo-500/30 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-300 backdrop-blur-sm border border-amber-300/30">
                Daily Discipline
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
                {streak}
              </h2>
              <span className="text-lg font-medium text-indigo-200">
                {streak === 1 ? 'day streak' : 'days streak'}
              </span>
            </div>
            <p className="mt-2 max-w-sm text-xs text-indigo-100/90 leading-relaxed">
              {streak === 0
                ? 'Review words today to ignite your daily learning streak!'
                : streak >= 7
                ? 'Unstoppable consistency! Your memory retention is peaking.'
                : 'Keep practicing every day to cement new words into long-term memory.'}
            </p>
          </div>

          <div className="flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 shadow-inner">
            <Flame
              className={`h-12 w-12 sm:h-14 sm:w-14 transition-transform duration-300 ${
                streak > 0 ? 'text-amber-400 fill-amber-400 animate-bounce' : 'text-indigo-300'
              }`}
            />
          </div>
        </div>

        {/* Subtle decorative glow */}
        <div className="absolute -bottom-12 -right-12 h-48 w-48 rounded-full bg-amber-400/20 blur-2xl" />
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Mastered
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {masteredCount}
          </div>
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            {masteryPercentage}% of deck
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              In Learning
            </span>
            <HelpCircle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {learningCount}
          </div>
          <span className="text-[11px] text-slate-400">active words</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Quiz Accuracy
            </span>
            <Award className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {overallAccuracy}%
          </div>
          <span className="text-[11px] text-slate-400">
            {totalAnswered} questions
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total Reviews
            </span>
            <BookOpen className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {totalReviews}
          </div>
          <span className="text-[11px] text-slate-400">repetitions</span>
        </div>
      </div>

      {/* Today's Learning Goal */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Today's Study Goal
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {wordsStudiedToday} of {dailyGoal} words reviewed today
            </p>
          </div>
          <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
            {Math.min(100, Math.round((wordsStudiedToday / dailyGoal) * 100))}%
          </span>
        </div>

        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-500"
            style={{
              width: `${Math.min(100, (wordsStudiedToday / dailyGoal) * 100)}%`,
            }}
          />
        </div>
      </div>

      {/* Category Mastery Progress */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Category Mastery
          </h3>
        </div>

        <div className="space-y-3.5">
          {categoryStats.map((cat) => (
            <div key={cat.category}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium capitalize text-slate-700 dark:text-slate-200">
                  {cat.category}
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  {cat.mastered}/{cat.total} ({cat.percent}%)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 dark:from-indigo-600 dark:to-indigo-400 transition-all duration-500"
                  style={{ width: `${cat.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Audio & Offline Preferences */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
          Audio & Offline Storage
        </h3>

        <div className="space-y-4 text-xs">
          {/* Pronunciation Speed */}
          <div className="flex items-center justify-between">
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Pronunciation Speed
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Adjust playback speed for clearer vocabulary listening
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {[0.75, 0.85, 1.0].map((rate) => (
                <button
                  key={rate}
                  onClick={() => onChangeSpeechRate(rate)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                    speechRate === rate
                      ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {rate}x
                </button>
              ))}
              <button
                onClick={testPronunciation}
                className="rounded-lg border border-slate-200 p-1 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 cursor-pointer ml-1"
                title="Test pronunciation audio"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Offline Database Status */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Local IndexedDB Cache
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                100% offline-first. Progress is saved locally in your browser.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <Check className="w-3 h-3" /> Active
            </span>
          </div>

          {/* Reset progress */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
            <div>
              <span className="font-semibold text-rose-600 dark:text-rose-400">
                Reset Progress
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Clear all mastered words, streak, and quiz history
              </p>
            </div>

            {showResetConfirm ? (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleResetData}
                  disabled={isResetting}
                  className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700 cursor-pointer"
                >
                  {isResetting ? 'Resetting...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
