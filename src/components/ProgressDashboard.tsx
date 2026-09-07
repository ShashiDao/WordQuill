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
    <div className="mx-auto max-w-2xl pb-28 pt-4 px-4 space-y-4">
      {/* Streak Card */}
      <div className="rounded-2xl border border-black/[0.08] bg-[#FAF6EE] p-6 dark:border-white/[0.08] dark:bg-[#221E1B]">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-[#C9924A]">
              Daily Discipline
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <h2 className="font-fraunces text-4xl sm:text-5xl font-medium tracking-tight text-[#1B1815] dark:text-[#F6F1E7]">
                {streak}
              </h2>
              <span className="text-sm font-medium text-[#8C8272]">
                {streak === 1 ? 'day streak' : 'days streak'}
              </span>
            </div>
            <p className="mt-2 max-w-sm text-xs text-[#8C8272] leading-relaxed">
              {streak === 0
                ? 'Review words today to ignite your daily learning streak.'
                : streak >= 7
                ? 'Unstoppable consistency. Your memory retention is peaking.'
                : 'Keep practicing every day to cement new words into long-term memory.'}
            </p>
          </div>

          <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl border border-black/[0.08] dark:border-white/[0.08] text-[#C9924A]">
            <Flame
              className={`h-8 w-8 sm:h-10 sm:w-10 ${
                streak > 0 ? 'text-[#C9924A] fill-[#C9924A]' : 'text-[#8C8272]'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-black/[0.08] bg-[#FAF6EE] p-4 dark:border-white/[0.08] dark:bg-[#221E1B]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#8C8272]">
              Mastered
            </span>
            <CheckCircle2 className="w-4 h-4 text-[#8FB996]" />
          </div>
          <div className="mt-2 font-fraunces text-2xl font-medium text-[#1B1815] dark:text-[#F6F1E7]">
            {masteredCount}
          </div>
          <span className="text-[11px] font-medium text-[#8FB996]">
            {masteryPercentage}% of deck
          </span>
        </div>

        <div className="rounded-xl border border-black/[0.08] bg-[#FAF6EE] p-4 dark:border-white/[0.08] dark:bg-[#221E1B]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#8C8272]">
              In Learning
            </span>
            <HelpCircle className="w-4 h-4 text-[#C9924A]" />
          </div>
          <div className="mt-2 font-fraunces text-2xl font-medium text-[#1B1815] dark:text-[#F6F1E7]">
            {learningCount}
          </div>
          <span className="text-[11px] text-[#8C8272]">active words</span>
        </div>

        <div className="rounded-xl border border-black/[0.08] bg-[#FAF6EE] p-4 dark:border-white/[0.08] dark:bg-[#221E1B]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#8C8272]">
              Quiz Accuracy
            </span>
            <Award className="w-4 h-4 text-[#D98A93]" />
          </div>
          <div className="mt-2 font-fraunces text-2xl font-medium text-[#1B1815] dark:text-[#F6F1E7]">
            {overallAccuracy}%
          </div>
          <span className="text-[11px] text-[#8C8272]">
            {totalAnswered} questions
          </span>
        </div>

        <div className="rounded-xl border border-black/[0.08] bg-[#FAF6EE] p-4 dark:border-white/[0.08] dark:bg-[#221E1B]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#8C8272]">
              Total Reviews
            </span>
            <BookOpen className="w-4 h-4 text-[#8C8272]" />
          </div>
          <div className="mt-2 font-fraunces text-2xl font-medium text-[#1B1815] dark:text-[#F6F1E7]">
            {totalReviews}
          </div>
          <span className="text-[11px] text-[#8C8272]">repetitions</span>
        </div>
      </div>

      {/* Today's Learning Goal */}
      <div className="rounded-xl border border-black/[0.08] bg-[#FAF6EE] p-5 dark:border-white/[0.08] dark:bg-[#221E1B]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-fraunces text-sm font-medium text-[#1B1815] dark:text-[#F6F1E7]">
              Today's Study Goal
            </h3>
            <p className="text-xs text-[#8C8272] mt-0.5">
              {wordsStudiedToday} of {dailyGoal} words reviewed today
            </p>
          </div>
          <span className="text-xs font-medium text-[#D98A93]">
            {Math.min(100, Math.round((wordsStudiedToday / dailyGoal) * 100))}%
          </span>
        </div>

        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-[#D98A93] transition-all duration-500"
            style={{
              width: `${Math.min(100, (wordsStudiedToday / dailyGoal) * 100)}%`,
            }}
          />
        </div>
      </div>

      {/* Category Mastery Progress */}
      <div className="rounded-xl border border-black/[0.08] bg-[#FAF6EE] p-5 dark:border-white/[0.08] dark:bg-[#221E1B]">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="w-4 h-4 text-[#D98A93]" />
          <h3 className="font-fraunces text-sm font-medium text-[#1B1815] dark:text-[#F6F1E7]">
            Category Mastery
          </h3>
        </div>

        <div className="space-y-3.5">
          {categoryStats.map((cat) => (
            <div key={cat.category}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="capitalize text-[#1B1815] dark:text-[#F6F1E7]">
                  {cat.category}
                </span>
                <span className="text-[#8C8272]">
                  {cat.mastered}/{cat.total} ({cat.percent}%)
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-[#8FB996] transition-all duration-500"
                  style={{ width: `${cat.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Audio & Offline Preferences */}
      <div className="rounded-xl border border-black/[0.08] bg-[#FAF6EE] p-5 dark:border-white/[0.08] dark:bg-[#221E1B]">
        <h3 className="font-fraunces text-sm font-medium text-[#1B1815] dark:text-[#F6F1E7] mb-3">
          Audio & Offline Storage
        </h3>

        <div className="space-y-4 text-xs">
          {/* Pronunciation Speed */}
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium text-[#1B1815] dark:text-[#F6F1E7]">
                Pronunciation Speed
              </span>
              <p className="text-[11px] text-[#8C8272]">
                Adjust playback speed for clearer vocabulary listening
              </p>
            </div>
            <div className="flex items-center gap-3">
              {[0.75, 0.85, 1.0].map((rate) => (
                <button
                  key={rate}
                  onClick={() => onChangeSpeechRate(rate)}
                  className={`pb-0.5 text-xs transition cursor-pointer ${
                    speechRate === rate
                      ? 'text-[#1B1815] dark:text-[#F6F1E7] border-b border-[#D98A93] font-medium'
                      : 'text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7]'
                  }`}
                >
                  {rate}x
                </button>
              ))}
              <button
                onClick={testPronunciation}
                className="p-1 text-[#8C8272] hover:text-[#D98A93] cursor-pointer ml-1"
                title="Test pronunciation audio"
              >
                <Volume2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Offline Database Status */}
          <div className="flex items-center justify-between border-t border-black/[0.06] pt-3 dark:border-white/[0.06]">
            <div>
              <span className="font-medium text-[#1B1815] dark:text-[#F6F1E7]">
                Local IndexedDB Cache
              </span>
              <p className="text-[11px] text-[#8C8272]">
                100% offline-first. Progress is saved locally in your browser.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-[#8FB996]">
              <Check className="w-3 h-3" /> Active
            </span>
          </div>

          {/* Reset progress */}
          <div className="flex items-center justify-between border-t border-black/[0.06] pt-3 dark:border-white/[0.06]">
            <div>
              <span className="font-medium text-[#D98A93]">
                Reset Progress
              </span>
              <p className="text-[11px] text-[#8C8272]">
                Clear all mastered words, streak, and quiz history
              </p>
            </div>

            {showResetConfirm ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetData}
                  disabled={isResetting}
                  className="text-xs font-medium text-[#D98A93] underline cursor-pointer"
                >
                  {isResetting ? 'Resetting...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="text-xs font-medium text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#D98A93] hover:underline cursor-pointer"
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
