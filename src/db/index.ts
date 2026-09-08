import Dexie, { type Table } from 'dexie';
import type { UserWordProgress, DailyProgress, AppSetting, WordItem } from '../types';

export class WordQuillDB extends Dexie {
  savedWords!: Table<UserWordProgress, string>;
  progress!: Table<DailyProgress, string>;
  settings!: Table<AppSetting, string>;
  customWords!: Table<WordItem, string>;

  constructor() {
    super('WordQuillDB');
    this.version(1).stores({
      savedWords: 'id, word, status, isBookmarked, reviewCount, lastReviewedAt',
      progress: 'date, wordsReviewed, quizzesCompleted',
      settings: 'key',
    });

    this.version(2)
      .stores({
        savedWords: 'id, word, status, isBookmarked, reviewCount, lastReviewedAt, dueDate, interval',
        progress: 'date, wordsReviewed, quizzesCompleted',
        settings: 'key',
      })
      .upgrade(async (tx) => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const today = `${year}-${month}-${day}`;

        await tx
          .table('savedWords')
          .toCollection()
          .modify((record: UserWordProgress) => {
            if (!record.dueDate) {
              record.dueDate = today;
            }
            if (record.interval === undefined || record.interval === null) {
              record.interval = 0;
            }
            if (record.easeFactor === undefined || record.easeFactor === null) {
              record.easeFactor = 2.5;
            }
          });
      });

    this.version(3).stores({
      savedWords: 'id, word, status, isBookmarked, reviewCount, lastReviewedAt, dueDate, interval',
      progress: 'date, wordsReviewed, quizzesCompleted',
      settings: 'key',
      customWords: 'id, word, category, isCustom',
    });
  }
}

export const db = new WordQuillDB();
