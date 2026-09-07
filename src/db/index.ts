import Dexie, { type Table } from 'dexie';
import type { UserWordProgress, DailyProgress, AppSetting } from '../types';

export class WordQuillDB extends Dexie {
  savedWords!: Table<UserWordProgress, string>;
  progress!: Table<DailyProgress, string>;
  settings!: Table<AppSetting, string>;

  constructor() {
    super('WordQuillDB');
    this.version(1).stores({
      savedWords: 'id, word, status, isBookmarked, reviewCount, lastReviewedAt',
      progress: 'date, wordsReviewed, quizzesCompleted',
      settings: 'key',
    });
  }
}

export const db = new WordQuillDB();
