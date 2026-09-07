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
  value: string | number | boolean;
}

export type TabType = 'flashcards' | 'quiz' | 'words' | 'progress';

export interface QuizQuestion {
  id: string;
  questionType: 'word_to_def' | 'def_to_word';
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
