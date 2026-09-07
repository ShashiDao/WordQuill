import { db } from './index';
import type { UserWordProgress, DailyProgress, WordStatus, WordItem } from '../types';

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

export async function getWordProgress(wordId: string): Promise<UserWordProgress | undefined> {
  return db.savedWords.get(wordId);
}

export async function getAllWordProgressMap(): Promise<Map<string, UserWordProgress>> {
  const list = await db.savedWords.toArray();
  const map = new Map<string, UserWordProgress>();
  for (const item of list) {
    map.set(item.id, item);
  }
  return map;
}

export async function recordWordReview(word: WordItem): Promise<UserWordProgress> {
  const existing = await db.savedWords.get(word.id);
  const now = Date.now();

  const updated: UserWordProgress = existing
    ? {
        ...existing,
        reviewCount: (existing.reviewCount || 0) + 1,
        lastReviewedAt: now,
        // If it was 'new', promote to 'learning' upon review
        status: existing.status === 'new' ? 'learning' : existing.status,
      }
    : {
        id: word.id,
        word: word.word,
        status: 'learning',
        isBookmarked: false,
        reviewCount: 1,
        correctCount: 0,
        incorrectCount: 0,
        lastReviewedAt: now,
      };

  await db.savedWords.put(updated);
  await incrementDailyWordsReviewed();
  return updated;
}

export async function setWordStatus(word: WordItem, status: WordStatus): Promise<UserWordProgress> {
  const existing = await db.savedWords.get(word.id);
  const now = Date.now();

  const updated: UserWordProgress = existing
    ? {
        ...existing,
        status,
        lastReviewedAt: now,
      }
    : {
        id: word.id,
        word: word.word,
        status,
        isBookmarked: false,
        reviewCount: 1,
        correctCount: 0,
        incorrectCount: 0,
        lastReviewedAt: now,
      };

  await db.savedWords.put(updated);
  return updated;
}

export async function toggleWordBookmark(word: WordItem): Promise<UserWordProgress> {
  const existing = await db.savedWords.get(word.id);
  const now = Date.now();

  const updated: UserWordProgress = existing
    ? {
        ...existing,
        isBookmarked: !existing.isBookmarked,
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
      };

  await db.savedWords.put(updated);
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

    const updated: UserWordProgress = existing
      ? {
          ...existing,
          reviewCount: (existing.reviewCount || 0) + 1,
          correctCount: (existing.correctCount || 0) + (isCorrect ? 1 : 0),
          incorrectCount: (existing.incorrectCount || 0) + (isCorrect ? 0 : 1),
          lastReviewedAt: now,
          status: isCorrect && (existing.correctCount || 0) >= 2 ? 'mastered' : (existing.status === 'new' ? 'learning' : existing.status),
        }
      : {
          id: word.id,
          word: word.word,
          status: isCorrect ? 'learning' : 'learning',
          isBookmarked: false,
          reviewCount: 1,
          correctCount: isCorrect ? 1 : 0,
          incorrectCount: isCorrect ? 0 : 1,
          lastReviewedAt: now,
        };

    await db.savedWords.put(updated);
  }

  const existingProg = await db.progress.get(today);
  const updatedProg: DailyProgress = existingProg
    ? {
        ...existingProg,
        quizzesCompleted: (existingProg.quizzesCompleted || 0) + 1,
        quizScoreSum: (existingProg.quizScoreSum || 0) + correctCount,
        quizQuestionsTotal: (existingProg.quizQuestionsTotal || 0) + results.length,
      }
    : {
        date: today,
        wordsReviewed: 0,
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

export async function setSetting(key: string, value: string | number | boolean): Promise<void> {
  await db.settings.put({ key, value });
}
