export interface WordItem {
  id: string;
  word: string;
  phonetic: string;
  definition: string;
  example: string;
  category: string;
}

export type WordStatus = 'new' | 'learning' | 'mastered';

export interface UserWordProgress {
  id: string; // matches WordItem.id
  word: string;
  status: WordStatus;
  isBookmarked: boolean;
  reviewCount: number;
  correctCount: number;
  incorrectCount: number;
  lastReviewedAt: number; // timestamp
  interval: number; // days until next review (SM-2)
  easeFactor: number; // SM-2 ease factor, default 2.5
  dueDate: string; // ISO date string YYYY-MM-DD
}

export interface DailyProgress {
  date: string; // YYYY-MM-DD
  wordsReviewed: number;
  quizzesCompleted: number;
  quizScoreSum: number;
  quizQuestionsTotal: number;
}

export interface AppSetting {
  key: string;
  value: string | number | boolean | string[] | any;
}

export type TabType = 'flashcards' | 'quiz' | 'words' | 'progress';

export interface QuizQuestion {
  id: string;
  questionType: 'word_to_def' | 'def_to_word' | 'cloze' | 'spelling';
  prompt: string;
  phonetic?: string;
  correctAnswer: string;
  options: string[];
  explanation: string;
  wordItem: WordItem;
}

export interface QuizResultSummary {
  total: number;
  correct: number;
  wrongItems: WordItem[];
  completedAt: number;
}

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}
