import React, { useState, useEffect, useRef } from 'react';
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
  Calendar,
  Download,
  Upload,
  AlertCircle,
  X,
  Share2,
} from 'lucide-react';
import type { WordItem, UserWordProgress, DailyProgress } from '../types';
import { db } from '../db';
import { speakWord } from '../utils/speech';
import {
  getTodayString,
  getSetting,
  getLeeches,
  getActivityCalendar,
  exportDatabaseBackup,
} from '../db/operations';
import { useBackupRestore } from '../hooks/useBackupRestore';

interface ProgressDashboardProps {
  words: WordItem[];
  progressMap: Map<string, UserWordProgress>;
  streak: number;
  todayProgress: DailyProgress | null;
  speechRate: number;
  dailyGoal?: number;
  soundHapticsEnabled?: boolean;
  onToggleSoundHaptics?: () => void;
  onChangeSpeechRate: (rate: number) => void;
  onDataUpdated: () => void;
  onNavigateToFlashcardsWithFilter?: (filter: string) => void;
}

export const ProgressDashboard: React.FC<ProgressDashboardProps> = ({
  words,
  progressMap,
  streak,
  todayProgress,
  speechRate,
  dailyGoal: propDailyGoal,
  soundHapticsEnabled = true,
  onToggleSoundHaptics,
  onChangeSpeechRate,
  onDataUpdated,
  onNavigateToFlashcardsWithFilter,
}) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [dailyGoal, setDailyGoal] = useState<number>(propDailyGoal || 10);

  // Backup & Restore Hook
  const [isExporting, setIsExporting] = useState(false);
  const {
    fileInputRef,
    isImporting,
    pendingImportData,
    backupFeedback,
    setBackupFeedback,
    handleFileSelect,
    confirmImport,
    cancelImport,
  } = useBackupRestore(onDataUpdated);

  // Share Streak State
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const shareTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (shareTimeoutRef.current) {
        clearTimeout(shareTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (propDailyGoal !== undefined) {
      setDailyGoal(propDailyGoal);
    } else {
      getSetting<number>('dailyGoal', 10).then((val) => setDailyGoal(val));
    }
  }, [propDailyGoal]);

  // Stats calculation
  const totalWords = words.length;
  const today = getTodayString();
  let masteredCount = 0;
  let learningCount = 0;
  let bookmarkedCount = 0;
  let dueTodayCount = 0;
  let totalReviews = 0;
  let totalCorrectAnswers = 0;
  let totalAnswered = 0;

  progressMap.forEach((prog) => {
    if (prog.status === 'mastered') masteredCount++;
    if (prog.status === 'learning') learningCount++;
    if (prog.isBookmarked) bookmarkedCount++;
    if (prog.status !== 'new' && prog.dueDate && prog.dueDate <= today) {
      dueTodayCount++;
    }
    totalReviews += prog.reviewCount || 0;
    totalCorrectAnswers += prog.correctCount || 0;
    totalAnswered += (prog.correctCount || 0) + (prog.incorrectCount || 0);
  });

  const wordsStudiedToday = todayProgress?.wordsReviewed || 0;
  const overallAccuracy =
    totalAnswered > 0 ? Math.round((totalCorrectAnswers / totalAnswered) * 100) : 0;
  const masteryPercentage =
    totalWords > 0 ? Math.round((masteredCount / totalWords) * 100) : 0;
  const leechesCount = React.useMemo(
    () => getLeeches(words, progressMap).length,
    [words, progressMap]
  );

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

  // Activity calendar records for 12 weeks / 84 days
  const [calendarRecords, setCalendarRecords] = useState<DailyProgress[]>([]);

  useEffect(() => {
    getActivityCalendar(84).then((recs) => {
      setCalendarRecords(recs);
    });
  }, [todayProgress, streak]);

  // Session-dismissible leech callout
  const [isLeechAlertDismissed, setIsLeechAlertDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('wordquill_leeches_dismissed') === 'true';
    } catch {
      return false;
    }
  });

  const handleDismissLeechAlert = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLeechAlertDismissed(true);
    try {
      sessionStorage.setItem('wordquill_leeches_dismissed', 'true');
    } catch {}
  };

  // Compute 12 columns of 7 days (Sunday to Saturday) ending on current week
  const heatmapData = React.useMemo(() => {
    const progressMapByDate = new Map<string, number>();
    calendarRecords.forEach((r) => {
      progressMapByDate.set(r.date, r.wordsReviewed || 0);
    });

    const now = new Date();
    // Align so the final column ends on Saturday of current week
    const currentDayOfWeek = now.getDay(); // 0 (Sun) to 6 (Sat)
    const daysUntilEndOfWeek = 6 - currentDayOfWeek;
    const endDate = new Date(now);
    endDate.setDate(now.getDate() + daysUntilEndOfWeek);

    // 84 days total (12 weeks * 7 days)
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 83);

    const columns: {
      date: string;
      formattedDate: string;
      dayOfWeek: number;
      count: number;
      isFuture: boolean;
      isToday: boolean;
    }[][] = [];

    const todayStr = getTodayString(now);
    let totalReviewed = 0;

    for (let w = 0; w < 12; w++) {
      const colDays: (typeof columns)[0] = [];
      for (let d = 0; d < 7; d++) {
        const current = new Date(startDate);
        current.setDate(startDate.getDate() + (w * 7 + d));
        const dateStr = getTodayString(current);
        const isFuture = dateStr > todayStr;
        const isToday = dateStr === todayStr;
        const count = isFuture ? 0 : progressMapByDate.get(dateStr) || 0;
        if (!isFuture) totalReviewed += count;

        colDays.push({
          date: dateStr,
          formattedDate: current.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          dayOfWeek: d,
          count,
          isFuture,
          isToday,
        });
      }
      columns.push(colDays);
    }

    return { columns, totalReviewed };
  }, [calendarRecords]);

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

  const handleShareStreak = async () => {
    const wordsText = masteredCount === 1 ? '1 word' : `${masteredCount} words`;
    const shareText = `🔥 ${streak}-day vocabulary streak on WordQuill — ${wordsText} mastered.`;

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'WordQuill',
          text: shareText,
        });
        return;
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') {
          return;
        }
      }
    }

    // Fallback when navigator.share is unsupported (desktop browsers)
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(shareText);
        setShareFeedback('Copied to clipboard');
        if (shareTimeoutRef.current) {
          clearTimeout(shareTimeoutRef.current);
        }
        shareTimeoutRef.current = window.setTimeout(() => {
          setShareFeedback(null);
        }, 2500);
      } catch (err) {
        console.warn('Clipboard write failed:', err);
      }
    }
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setBackupFeedback(null);
      await exportDatabaseBackup();
      setBackupFeedback({
        type: 'success',
        message: 'Progress exported as JSON backup.',
      });
    } catch (err) {
      console.error(err);
      setBackupFeedback({
        type: 'error',
        message: 'Failed to export backup data.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl pb-36 pt-4 px-4 space-y-4">
      {/* Streak Card */}
      <div className="rounded-2xl border border-black/[0.08] bg-[#FAF6EE] p-6 dark:border-white/[0.08] dark:bg-[#221E1B]">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-[#C9924A]">
              Daily discipline
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <h2 className="font-fraunces text-4xl sm:text-5xl font-medium tracking-tight text-[#1B1815] dark:text-[#F6F1E7]">
                {streak}
              </h2>
              <span className="text-sm font-medium text-[#8C8272]">
                {streak === 1 ? 'day streak' : 'days streak'}
              </span>
              <button
                id="share-streak-btn"
                onClick={handleShareStreak}
                className="self-center rounded-lg border border-black/[0.08] p-1.5 text-[#8C8272] hover:text-[#1B1815] hover:border-[#D98A93] dark:border-white/[0.08] dark:hover:text-[#F6F1E7] transition-colors cursor-pointer ml-1"
                title="Share your streak"
                aria-label="Share your streak"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>
            </div>
            {shareFeedback && (
              <div
                id="share-streak-feedback"
                className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-[#8FB996] transition"
              >
                <Check className="w-3.5 h-3.5 text-[#8FB996]" />
                <span>{shareFeedback}</span>
              </div>
            )}
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

        {/* 12-Week Activity Heatmap (GitHub-style 84 days) */}
        <div className="mt-5 pt-4 border-t border-black/[0.06] dark:border-white/[0.06]">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#8C8272]" />
              <span className="text-[11px] font-medium text-[#8C8272] uppercase tracking-wider">
                12-Week Activity
              </span>
            </div>
            <span className="text-[11px] text-[#8C8272]">
              {heatmapData.totalReviewed} words reviewed
            </span>
          </div>

          {/* Heatmap Grid */}
          <div className="overflow-x-auto pb-1 scrollbar-none mask-edge-fade">
            <div className="inline-flex gap-1.5 items-center">
              {/* Day of week labels */}
              <div className="flex flex-col gap-1 sm:gap-1.5 text-[9px] font-mono text-[#8C8272] pr-1 select-none">
                <span className="h-3 w-4 sm:h-3.5 leading-3">Sun</span>
                <span className="h-3 w-4 sm:h-3.5 leading-3">Mon</span>
                <span className="h-3 w-4 sm:h-3.5 leading-3">Tue</span>
                <span className="h-3 w-4 sm:h-3.5 leading-3">Wed</span>
                <span className="h-3 w-4 sm:h-3.5 leading-3">Thu</span>
                <span className="h-3 w-4 sm:h-3.5 leading-3">Fri</span>
                <span className="h-3 w-4 sm:h-3.5 leading-3">Sat</span>
              </div>

              {/* 12 Week Columns */}
              <div className="flex gap-1 sm:gap-1.5">
                {heatmapData.columns.map((col, colIdx) => (
                  <div key={colIdx} className="flex flex-col gap-1 sm:gap-1.5">
                    {col.map((day) => {
                      let colorClass =
                        'bg-black/[0.04] dark:bg-white/[0.05] border border-black/[0.04] dark:border-white/[0.04]';
                      if (day.isFuture) {
                        colorClass =
                          'opacity-20 bg-transparent border border-dashed border-black/[0.06] dark:border-white/[0.06]';
                      } else if (day.count >= 20) {
                        colorClass = 'bg-[#D98A93] border border-[#D98A93]';
                      } else if (day.count >= 10) {
                        colorClass = 'bg-[#8FB996] border border-[#8FB996]';
                      } else if (day.count >= 5) {
                        colorClass = 'bg-[#8FB996]/70 border border-[#8FB996]/80';
                      } else if (day.count >= 1) {
                        colorClass = 'bg-[#8FB996]/35 border border-[#8FB996]/40';
                      }

                      return (
                        <div
                          key={day.date}
                          className={`h-3 w-3 sm:h-3.5 sm:w-3.5 rounded-[3px] transition-transform hover:scale-125 cursor-pointer ${
                            day.isToday ? 'ring-1 ring-[#D98A93]' : ''
                          } ${colorClass}`}
                          title={
                            day.isFuture
                              ? `${day.formattedDate} (Future)`
                              : `${day.formattedDate}: ${day.count} word${day.count === 1 ? '' : 's'} reviewed`
                          }
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-3 flex items-center justify-between text-[11px] text-[#8C8272]">
            <span>Past 84 days</span>
            <div className="flex items-center gap-1.5">
              <span>Less</span>
              <div
                className="h-2.5 w-2.5 rounded-[2px] bg-black/[0.04] dark:bg-white/[0.05] border border-black/[0.04] dark:border-white/[0.04]"
                title="0 words"
              />
              <div
                className="h-2.5 w-2.5 rounded-[2px] bg-[#8FB996]/35 border border-[#8FB996]/40"
                title="1–4 words"
              />
              <div
                className="h-2.5 w-2.5 rounded-[2px] bg-[#8FB996]/70 border border-[#8FB996]/80"
                title="5–9 words"
              />
              <div
                className="h-2.5 w-2.5 rounded-[2px] bg-[#8FB996] border border-[#8FB996]"
                title="10–19 words"
              />
              <div
                className="h-2.5 w-2.5 rounded-[2px] bg-[#D98A93] border border-[#D98A93]"
                title="20+ words"
              />
              <span>More</span>
            </div>
          </div>
        </div>
      </div>

      {/* Proactive Leech Callout (dismissible for this session) */}
      {leechesCount > 0 && !isLeechAlertDismissed && (
        <div
          id="progress-leech-callout"
          onClick={() => {
            onNavigateToFlashcardsWithFilter?.('leeches');
          }}
          className="group flex items-center justify-between gap-3 rounded-xl border border-[#D98A93]/40 bg-[#FAF6EE] dark:bg-[#221E1B] p-3.5 shadow-sm hover:border-[#D98A93] transition cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#D98A93]/15 text-[#D98A93]">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-[#1B1815] dark:text-[#F6F1E7]">
                {leechesCount} {leechesCount === 1 ? 'word keeps' : 'words keep'} slipping — review them now
              </p>
              <p className="text-[11px] text-[#8C8272] truncate">
                Tap to jump straight into targeted flashcard review for slipping words
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline text-xs font-medium text-[#D98A93] group-hover:underline">
              Review now &rarr;
            </span>
            <button
              type="button"
              onClick={handleDismissLeechAlert}
              className="p-1 rounded-md text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] cursor-pointer"
              aria-label="Dismiss leech callout for this session"
              title="Dismiss for this session"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Primary Metrics Grid */}
      <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${leechesCount > 0 ? 'lg:grid-cols-6' : 'lg:grid-cols-5'}`}>
        <div className="rounded-xl border border-black/[0.08] bg-[#FAF6EE] p-4 dark:border-white/[0.08] dark:bg-[#221E1B]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#8C8272]">
              Due Today
            </span>
            <Calendar className="w-4 h-4 text-[#D98A93]" />
          </div>
          <div className="mt-2 font-fraunces text-2xl font-medium text-[#1B1815] dark:text-[#F6F1E7]">
            {dueTodayCount}
          </div>
          <span className="text-[11px] font-medium text-[#D98A93]">
            {dueTodayCount === 0 ? 'all caught up' : 'ready for review'}
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

        {leechesCount > 0 && (
          <div
            onClick={() => onNavigateToFlashcardsWithFilter?.('leeches')}
            className="rounded-xl border border-black/[0.08] bg-[#FAF6EE] p-4 dark:border-white/[0.08] dark:bg-[#221E1B] cursor-pointer hover:border-[#D98A93] transition group"
            title="Click to review leeches in Flashcards"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#8C8272] group-hover:text-[#D98A93] transition-colors">
                Leeches
              </span>
              <AlertCircle className="w-4 h-4 text-[#D98A93]" />
            </div>
            <div className="mt-2 font-fraunces text-2xl font-medium text-[#1B1815] dark:text-[#F6F1E7]">
              {leechesCount}
            </div>
            <span className="text-[11px] font-medium text-[#D98A93] group-hover:underline">
              review now &rarr;
            </span>
          </div>
        )}

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

        <div className={`rounded-xl border border-black/[0.08] bg-[#FAF6EE] p-4 dark:border-white/[0.08] dark:bg-[#221E1B] ${leechesCount > 0 ? '' : 'col-span-2 sm:col-span-1'}`}>
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
      <div className="rounded-xl border border-black/[0.08] bg-[#FAF6EE] p-5 pb-6 dark:border-white/[0.08] dark:bg-[#221E1B]">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="w-4 h-4 text-[#D98A93]" />
          <h3 className="font-fraunces text-sm font-medium text-[#1B1815] dark:text-[#F6F1E7]">
            Category mastery
          </h3>
        </div>

        <div className="space-y-3.5 pb-1">
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

          {/* Sound & Haptics Feedback */}
          <div className="flex items-center justify-between border-t border-black/[0.06] pt-3 dark:border-white/[0.06]">
            <div>
              <span className="font-medium text-[#1B1815] dark:text-[#F6F1E7]">
                Sound & Haptics Feedback
              </span>
              <p className="text-[11px] text-[#8C8272]">
                Audio chime and vibration cues for correct answers and card mastery
              </p>
            </div>
            {onToggleSoundHaptics && (
              <button
                id="toggle-sound-haptics-dashboard"
                onClick={onToggleSoundHaptics}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                  soundHapticsEnabled ? 'bg-[#8FB996]' : 'bg-black/20 dark:bg-white/20'
                }`}
                title={`Sound & Haptics: ${soundHapticsEnabled ? 'Enabled' : 'Disabled'}`}
                aria-label={`Sound and haptics feedback ${soundHapticsEnabled ? 'enabled' : 'disabled'}`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    soundHapticsEnabled ? 'translate-x-4.5' : 'translate-x-1'
                  }`}
                />
              </button>
            )}
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

      {/* Backup Section */}
      <div className="rounded-2xl border border-black/[0.08] bg-[#FAF6EE] p-5 dark:border-white/[0.08] dark:bg-[#221E1B]">
        <div className="mb-2">
          <h3 className="font-fraunces text-base font-medium text-[#1B1815] dark:text-[#F6F1E7]">
            Backup
          </h3>
          <p className="text-xs text-[#8C8272] mt-0.5">
            Export or restore your vocabulary history, spaced repetition data, and preferences as a local JSON file.
          </p>
        </div>

        <div className="space-y-3 pt-2">
          {/* Export Action */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] pt-3 dark:border-white/[0.06]">
            <div>
              <span className="text-xs font-medium text-[#1B1815] dark:text-[#F6F1E7]">
                Export progress
              </span>
              <p className="text-[11px] text-[#8C8272]">
                Save all reviews, mastered words, quiz records, and settings to a JSON file
              </p>
            </div>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.08] px-3.5 py-1.5 text-xs font-medium text-[#1B1815] hover:bg-black/[0.03] dark:border-white/[0.08] dark:text-[#F6F1E7] dark:hover:bg-white/[0.03] transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#D98A93]" />
              <span>{isExporting ? 'Exporting...' : 'Export progress'}</span>
            </button>
          </div>

          {/* Import Action */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] pt-3 dark:border-white/[0.06]">
            <div>
              <span className="text-xs font-medium text-[#1B1815] dark:text-[#F6F1E7]">
                Import progress
              </span>
              <p className="text-[11px] text-[#8C8272]">
                Restore your progress from a previously saved JSON backup file
              </p>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.08] px-3.5 py-1.5 text-xs font-medium text-[#1B1815] hover:bg-black/[0.03] dark:border-white/[0.08] dark:text-[#F6F1E7] dark:hover:bg-white/[0.03] transition cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-[#8FB996]" />
                <span>Import progress</span>
              </button>
            </div>
          </div>

          {/* Confirmation Step Before Overwriting */}
          {pendingImportData && (
            <div className="rounded-xl border border-[#D98A93]/40 bg-[#D98A93]/[0.06] p-3.5 space-y-2.5">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-[#D98A93] shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-medium text-[#1B1815] dark:text-[#F6F1E7]">
                    This will replace your current progress. Continue?
                  </p>
                  <p className="text-[#8C8272] mt-0.5 text-[11px]">
                    Backup contains: {pendingImportData.savedWords?.length || 0} words,{' '}
                    {pendingImportData.progress?.length || 0} daily activity logs,{' '}
                    {pendingImportData.settings?.length || 0} settings.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={confirmImport}
                  disabled={isImporting}
                  className="rounded-lg bg-[#D98A93] px-3 py-1.5 text-xs font-medium text-[#1B1815] hover:opacity-90 transition cursor-pointer"
                >
                  {isImporting ? 'Importing...' : 'Yes, overwrite & restore'}
                </button>
                <button
                  onClick={cancelImport}
                  disabled={isImporting}
                  className="text-xs font-medium text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7] transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Feedback messages */}
          {backupFeedback && (
            <div
              className={`rounded-xl border p-3 text-xs flex items-center justify-between ${
                backupFeedback.type === 'success'
                  ? 'border-[#8FB996]/40 text-[#8FB996] bg-[#8FB996]/[0.06]'
                  : 'border-[#D98A93]/40 text-[#D98A93] bg-[#D98A93]/[0.06]'
              }`}
            >
              <span>{backupFeedback.message}</span>
              <button
                onClick={() => setBackupFeedback(null)}
                className="text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7] p-0.5 ml-2 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
