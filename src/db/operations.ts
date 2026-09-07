import { db } from './index';
import type { UserWordProgress, DailyProgress, WordStatus, WordItem, AppSetting } from '../types';

export function getTodayString(d = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getPastDateString(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return getTodayString(d);
}

export function addDaysToDate(d: Date, days: number): string {
  const target = new Date(d);
  target.setDate(target.getDate() + days);
  return getTodayString(target);
}

/**
 * Standard SuperMemo SM-2 algorithm:
 * Quality:
 *   correct -> quality 4
 *   incorrect -> quality 1
 *
 * Ease Factor formula:
 *   EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
 *   Minimum EF is 1.3
 *
 * Interval formula:
 *   If quality < 3 (incorrect):
 *     interval = 1
 *   If quality >= 3 (correct):
 *     If previous interval === 0: interval = 1
 *     Else if previous interval === 1: interval = 6
 *     Else: interval = Math.round(previous_interval * new_EF)
 *
 * Due Date formula:
 *   dueDate = today + interval days (ISO YYYY-MM-DD string)
 */
export function calculateSM2(
  isCorrect: boolean,
  currentInterval: number = 0,
  currentEaseFactor: number = 2.5
): {
  interval: number;
  easeFactor: number;
  dueDate: string;
  status: WordStatus;
} {
  const quality = isCorrect ? 4 : 1;

  // Calculate new Ease Factor
  const calculatedEF =
    currentEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  const easeFactor = Math.max(1.3, Math.round(calculatedEF * 100) / 100);

  // Calculate new Interval
  let interval: number;
  if (quality < 3) {
    // Incorrect: reset interval to 1 day
    interval = 1;
  } else {
    // Correct: schedule interval progression
    if (currentInterval === 0) {
      interval = 1;
    } else if (currentInterval === 1) {
      interval = 6;
    } else {
      interval = Math.max(1, Math.round(currentInterval * easeFactor));
    }
  }

  // Calculate Due Date
  const dueDate = addDaysToDate(new Date(), interval);

  // Mature card status threshold: cards with 14+ day intervals are graduated to 'mastered'
  const status: WordStatus = interval >= 14 ? 'mastered' : 'learning';

  return { interval, easeFactor, dueDate, status };
}

let cachedProgressMap = new Map<string, UserWordProgress>();

export async function getWordProgress(wordId: string): Promise<UserWordProgress | undefined> {
  const item = await db.savedWords.get(wordId);
  if (item) {
    const today = getTodayString();
    if (item.interval === undefined) item.interval = 0;
    if (item.easeFactor === undefined) item.easeFactor = 2.5;
    if (!item.dueDate) item.dueDate = today;
  }
  return item;
}

export async function getAllWordProgressMap(): Promise<Map<string, UserWordProgress>> {
  const list = await db.savedWords.toArray();
  const map = new Map<string, UserWordProgress>();
  const today = getTodayString();
  for (const item of list) {
    if (item.interval === undefined) item.interval = 0;
    if (item.easeFactor === undefined) item.easeFactor = 2.5;
    if (!item.dueDate) item.dueDate = today;
    map.set(item.id, item);
  }
  cachedProgressMap = map;
  return map;
}

/**
 * Returns words with dueDate <= today, oldest-due-first,
 * falling back to 'new' words if the due queue is empty.
 */
export function getDueWords(
  words: WordItem[],
  progressMap?: Map<string, UserWordProgress>
): WordItem[] {
  const map = progressMap || cachedProgressMap;
  const today = getTodayString();

  const dueWords: WordItem[] = [];
  const newWords: WordItem[] = [];

  for (const word of words) {
    const prog = map.get(word.id);
    if (!prog || (prog.status === 'new' && (!prog.reviewCount || prog.reviewCount === 0))) {
      newWords.push(word);
    } else if (prog.dueDate && prog.dueDate <= today) {
      dueWords.push(word);
    }
  }

  if (dueWords.length > 0) {
    // Sort oldest-due-first: smallest/earliest dueDate first
    dueWords.sort((a, b) => {
      const progA = map.get(a.id);
      const progB = map.get(b.id);
      const dueA = progA?.dueDate || '';
      const dueB = progB?.dueDate || '';
      if (dueA !== dueB) {
        return dueA.localeCompare(dueB);
      }
      return (progA?.lastReviewedAt || 0) - (progB?.lastReviewedAt || 0);
    });
    return dueWords;
  }

  // Fall back to 'new' words if the due queue is empty
  return newWords.length > 0 ? newWords : words;
}

export async function recordWordReview(
  word: WordItem,
  isCorrect: boolean = true
): Promise<UserWordProgress> {
  const existing = await db.savedWords.get(word.id);
  const now = Date.now();
  const prevInterval = existing?.interval ?? 0;
  const prevEF = existing?.easeFactor ?? 2.5;

  const sm2 = calculateSM2(isCorrect, prevInterval, prevEF);

  const updated: UserWordProgress = existing
    ? {
        ...existing,
        reviewCount: (existing.reviewCount || 0) + 1,
        correctCount: (existing.correctCount || 0) + (isCorrect ? 1 : 0),
        incorrectCount: (existing.incorrectCount || 0) + (isCorrect ? 0 : 1),
        lastReviewedAt: now,
        interval: sm2.interval,
        easeFactor: sm2.easeFactor,
        dueDate: sm2.dueDate,
        status: sm2.status,
      }
    : {
        id: word.id,
        word: word.word,
        status: sm2.status,
        isBookmarked: false,
        reviewCount: 1,
        correctCount: isCorrect ? 1 : 0,
        incorrectCount: isCorrect ? 0 : 1,
        lastReviewedAt: now,
        interval: sm2.interval,
        easeFactor: sm2.easeFactor,
        dueDate: sm2.dueDate,
      };

  await db.savedWords.put(updated);
  cachedProgressMap.set(updated.id, updated);
  await incrementDailyWordsReviewed();
  return updated;
}

export async function setWordStatus(word: WordItem, status: WordStatus): Promise<UserWordProgress> {
  const existing = await db.savedWords.get(word.id);
  const now = Date.now();
  const today = getTodayString();

  let interval = existing?.interval ?? 0;
  let easeFactor = existing?.easeFactor ?? 2.5;
  let dueDate = existing?.dueDate ?? today;

  if (status === 'mastered') {
    interval = Math.max(14, interval === 0 ? 14 : interval);
    dueDate = addDaysToDate(new Date(), interval);
  } else if (status === 'learning') {
    interval = Math.max(1, interval === 0 ? 1 : interval);
    dueDate = addDaysToDate(new Date(), interval);
  } else if (status === 'new') {
    interval = 0;
    dueDate = today;
  }

  const updated: UserWordProgress = existing
    ? {
        ...existing,
        status,
        interval,
        easeFactor,
        dueDate,
        lastReviewedAt: now,
      }
    : {
        id: word.id,
        word: word.word,
        status,
        isBookmarked: false,
        reviewCount: status === 'new' ? 0 : 1,
        correctCount: 0,
        incorrectCount: 0,
        lastReviewedAt: now,
        interval,
        easeFactor,
        dueDate,
      };

  await db.savedWords.put(updated);
  cachedProgressMap.set(updated.id, updated);
  return updated;
}

export async function toggleWordBookmark(word: WordItem): Promise<UserWordProgress> {
  const existing = await db.savedWords.get(word.id);
  const now = Date.now();
  const today = getTodayString();

  const updated: UserWordProgress = existing
    ? {
        ...existing,
        isBookmarked: !existing.isBookmarked,
        interval: existing.interval ?? 0,
        easeFactor: existing.easeFactor ?? 2.5,
        dueDate: existing.dueDate ?? today,
      }
    : {
        id: word.id,
        word: word.word,
        status: 'new',
        isBookmarked: true,
        reviewCount: 0,
        correctCount: 0,
        incorrectCount: 0,
        lastReviewedAt: now,
        interval: 0,
        easeFactor: 2.5,
        dueDate: today,
      };

  await db.savedWords.put(updated);
  cachedProgressMap.set(updated.id, updated);
  return updated;
}

export async function incrementDailyWordsReviewed(): Promise<DailyProgress> {
  const today = getTodayString();
  const existing = await db.progress.get(today);

  const updated: DailyProgress = existing
    ? {
        ...existing,
        wordsReviewed: (existing.wordsReviewed || 0) + 1,
      }
    : {
        date: today,
        wordsReviewed: 1,
        quizzesCompleted: 0,
        quizScoreSum: 0,
        quizQuestionsTotal: 0,
      };

  await db.progress.put(updated);
  return updated;
}

export async function recordQuizSession(
  results: { word: WordItem; isCorrect: boolean }[]
): Promise<void> {
  const now = Date.now();
  const today = getTodayString();

  let correctCount = 0;
  for (const { word, isCorrect } of results) {
    if (isCorrect) correctCount++;
    const existing = await db.savedWords.get(word.id);

    const prevInterval = existing?.interval ?? 0;
    const prevEF = existing?.easeFactor ?? 2.5;

    const sm2 = calculateSM2(isCorrect, prevInterval, prevEF);

    const updated: UserWordProgress = existing
      ? {
          ...existing,
          reviewCount: (existing.reviewCount || 0) + 1,
          correctCount: (existing.correctCount || 0) + (isCorrect ? 1 : 0),
          incorrectCount: (existing.incorrectCount || 0) + (isCorrect ? 0 : 1),
          lastReviewedAt: now,
          interval: sm2.interval,
          easeFactor: sm2.easeFactor,
          dueDate: sm2.dueDate,
          status: sm2.status,
        }
      : {
          id: word.id,
          word: word.word,
          status: sm2.status,
          isBookmarked: false,
          reviewCount: 1,
          correctCount: isCorrect ? 1 : 0,
          incorrectCount: isCorrect ? 0 : 1,
          lastReviewedAt: now,
          interval: sm2.interval,
          easeFactor: sm2.easeFactor,
          dueDate: sm2.dueDate,
        };

    await db.savedWords.put(updated);
    cachedProgressMap.set(updated.id, updated);
  }

  const existingProg = await db.progress.get(today);
  const updatedProg: DailyProgress = existingProg
    ? {
        ...existingProg,
        wordsReviewed: (existingProg.wordsReviewed || 0) + results.length,
        quizzesCompleted: (existingProg.quizzesCompleted || 0) + 1,
        quizScoreSum: (existingProg.quizScoreSum || 0) + correctCount,
        quizQuestionsTotal: (existingProg.quizQuestionsTotal || 0) + results.length,
      }
    : {
        date: today,
        wordsReviewed: results.length,
        quizzesCompleted: 1,
        quizScoreSum: correctCount,
        quizQuestionsTotal: results.length,
      };

  await db.progress.put(updatedProg);
}

export async function calculateStreak(): Promise<number> {
  const records = await db.progress.toArray();
  if (records.length === 0) return 0;

  // Set of dates with at least 1 word reviewed or 1 quiz completed
  const activeDates = new Set(
    records
      .filter((r) => (r.wordsReviewed || 0) > 0 || (r.quizzesCompleted || 0) > 0)
      .map((r) => r.date)
  );

  const today = getTodayString();
  const yesterday = getPastDateString(1);

  let currentStreak = 0;
  let checkDate = new Date();

  // If not active today, check if active yesterday
  if (!activeDates.has(today)) {
    if (!activeDates.has(yesterday)) {
      return 0;
    }
    // Start counting back from yesterday
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const dStr = getTodayString(checkDate);
    if (activeDates.has(dStr)) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return currentStreak;
}

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const setting = await db.settings.get(key);
  if (!setting) return defaultValue;
  return setting.value as T;
}

export async function setSetting(key: string, value: string | number | boolean | string[] | any): Promise<void> {
  await db.settings.put({ key, value });
}

export interface BackupData {
  version: number;
  exportedAt: string;
  savedWords: UserWordProgress[];
  progress: DailyProgress[];
  settings: AppSetting[];
}

export function validateBackupShape(data: unknown): data is BackupData {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;

  // Must contain valid arrays for at least one table
  const hasValidWords = !obj.savedWords || Array.isArray(obj.savedWords);
  const hasValidProgress = !obj.progress || Array.isArray(obj.progress);
  const hasValidSettings = !obj.settings || Array.isArray(obj.settings);

  const hasAnyData =
    (Array.isArray(obj.savedWords) && obj.savedWords.length > 0) ||
    (Array.isArray(obj.progress) && obj.progress.length > 0) ||
    (Array.isArray(obj.settings) && obj.settings.length > 0);

  return hasValidWords && hasValidProgress && hasValidSettings && hasAnyData;
}

export async function exportDatabaseBackup(): Promise<void> {
  const [savedWords, progress, settings] = await Promise.all([
    db.savedWords.toArray(),
    db.progress.toArray(),
    db.settings.toArray(),
  ]);

  const backup: BackupData = {
    version: 2,
    exportedAt: new Date().toISOString(),
    savedWords,
    progress,
    settings,
  };

  const jsonString = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const todayStr = getTodayString();
  const filename = `wordquill-backup-${todayStr}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function importDatabaseBackup(data: BackupData): Promise<{
  wordsCount: number;
  progressCount: number;
  settingsCount: number;
}> {
  let wordsCount = 0;
  let progressCount = 0;
  let settingsCount = 0;

  await db.transaction('rw', [db.savedWords, db.progress, db.settings], async () => {
    if (Array.isArray(data.savedWords) && data.savedWords.length > 0) {
      await db.savedWords.bulkPut(data.savedWords);
      wordsCount = data.savedWords.length;
    }
    if (Array.isArray(data.progress) && data.progress.length > 0) {
      await db.progress.bulkPut(data.progress);
      progressCount = data.progress.length;
    }
    if (Array.isArray(data.settings) && data.settings.length > 0) {
      await db.settings.bulkPut(data.settings);
      settingsCount = data.settings.length;
    }
  });

  return { wordsCount, progressCount, settingsCount };
}

