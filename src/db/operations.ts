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

/**
 * Returns true if a word is considered a "leech":
 * a word the user keeps getting wrong despite repeated review.
 */
export function isLeech(progress: UserWordProgress): boolean {
  if (!progress) return false;
  const incorrect = progress.incorrectCount || 0;
  const correct = progress.correctCount || 0;
  return incorrect >= 4 && incorrect > correct;
}

/**
 * Returns words matching isLeech, sorted by incorrectCount descending.
 */
export function getLeeches(
  words: WordItem[],
  progressMap: Map<string, UserWordProgress>
): WordItem[] {
  const leeches: WordItem[] = [];
  for (const word of words) {
    const prog = progressMap.get(word.id);
    if (prog && isLeech(prog)) {
      leeches.push(word);
    }
  }
  return leeches.sort((a, b) => {
    const incA = progressMap.get(a.id)?.incorrectCount || 0;
    const incB = progressMap.get(b.id)?.incorrectCount || 0;
    return incB - incA;
  });
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

/**
 * Returns true if a streak freeze is available in the trailing 7 calendar days.
 * A freeze is available if fewer than 1 freeze was consumed in the trailing 7 calendar days.
 */
export function isStreakFreezeAvailable(
  freezesUsed: string[],
  refDateStr: string = getTodayString()
): boolean {
  // Trailing 7 calendar days: [refDateStr - 6 days, refDateStr]
  const d = new Date(refDateStr + 'T12:00:00');
  d.setDate(d.getDate() - 6);
  const cutoffStr = getTodayString(d);

  const usedInWindow = freezesUsed.filter(
    (dateStr) => dateStr >= cutoffStr && dateStr <= refDateStr
  );
  return usedInWindow.length < 1;
}

/**
 * Checks if yesterday was a missed day requiring a streak freeze, and if available,
 * records that freeze date in the 'streakFreezesUsed' setting.
 * Called once per app load. Returns true if a freeze was actually consumed.
 */
export async function consumeStreakFreezeIfNeeded(): Promise<boolean> {
  const records = await db.progress.toArray();
  const activeDates = new Set(
    records
      .filter((r) => (r.wordsReviewed || 0) > 0 || (r.quizzesCompleted || 0) > 0)
      .map((r) => r.date)
  );

  const yesterday = getPastDateString(1);
  const twoDaysAgo = getPastDateString(2);

  // If yesterday had active study, no freeze needed
  if (activeDates.has(yesterday)) {
    return false;
  }

  const freezesUsed = await getSetting<string[]>('streakFreezesUsed', []);

  // If yesterday is already recorded as a freeze, nothing to consume
  if (freezesUsed.includes(yesterday)) {
    return false;
  }

  // To consume a freeze for yesterday:
  // 1. Two days ago must have had active progress so there was an active streak to protect
  // 2. Cannot freeze more than one missed day in a row (two days ago must NOT be a freeze day)
  // 3. A freeze must be available in the trailing 7 calendar days
  if (!activeDates.has(twoDaysAgo)) {
    return false;
  }
  if (freezesUsed.includes(twoDaysAgo)) {
    return false;
  }

  if (!isStreakFreezeAvailable(freezesUsed, yesterday)) {
    return false;
  }

  // Consume the freeze for yesterday and persist to settings
  const updated = [...freezesUsed, yesterday];
  await setSetting('streakFreezesUsed', updated);
  return true;
}

/**
 * Calculates current consecutive day streak.
 * Supports 1 streak-freeze grace day per rolling 7-day window.
 * Read-only calculation; does not write to settings.
 */
export async function calculateStreak(): Promise<number> {
  const records = await db.progress.toArray();
  if (records.length === 0) return 0;

  // Set of dates with at least 1 word reviewed or 1 quiz completed
  const activeDates = new Set(
    records
      .filter((r) => (r.wordsReviewed || 0) > 0 || (r.quizzesCompleted || 0) > 0)
      .map((r) => r.date)
  );

  const freezesUsed = await getSetting<string[]>('streakFreezesUsed', []);
  const freezeDates = new Set(freezesUsed);

  const today = getTodayString();
  const yesterday = getPastDateString(1);
  const twoDaysAgo = getPastDateString(2);

  let currentStreak = 0;
  let checkDate = new Date();

  // If not active today, check if active yesterday or if yesterday can be freeze-covered
  if (!activeDates.has(today)) {
    if (activeDates.has(yesterday)) {
      // Active yesterday: start counting back from yesterday
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      // Neither today nor yesterday has activity: yesterday is the gap date
      const isYesterdayCovered = freezeDates.has(yesterday);
      const canFreezeYesterday =
        !isYesterdayCovered &&
        isStreakFreezeAvailable(freezesUsed, yesterday) &&
        activeDates.has(twoDaysAgo); // Cannot freeze more than one missed day in a row

      if (isYesterdayCovered || canFreezeYesterday) {
        // Mark that gap date as freeze-covered and continue counting backward as if it were active
        freezeDates.add(yesterday);
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        return 0;
      }
    }
  }

  // Count backward as long as dates are active or valid freeze-covered days
  let lastWasFreeze = false;
  while (true) {
    const dStr = getTodayString(checkDate);
    if (activeDates.has(dStr)) {
      currentStreak++;
      lastWasFreeze = false;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (
      freezeDates.has(dStr) ||
      (dStr === yesterday &&
        isStreakFreezeAvailable(freezesUsed, yesterday) &&
        activeDates.has(twoDaysAgo))
    ) {
      if (lastWasFreeze) {
        // Do not auto-consume a freeze for more than one missed day in a row
        break;
      }
      currentStreak++;
      lastWasFreeze = true;
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

