import React, { useState, useMemo, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  RotateCcw,
  Volume2,
  Award,
  BookOpen,
  ArrowRight,
  Filter,
} from 'lucide-react';
import type { WordItem, UserWordProgress, QuizQuestion } from '../types';
import { speakWord } from '../utils/speech';
import { recordQuizSession } from '../db/operations';

interface QuizViewProps {
  words: WordItem[];
  progressMap: Map<string, UserWordProgress>;
  speechRate: number;
  onDataUpdated: () => void;
  onSelectWordForFlashcard?: (word: WordItem) => void;
}

export const QuizView: React.FC<QuizViewProps> = ({
  words,
  progressMap,
  speechRate,
  onDataUpdated,
  onSelectWordForFlashcard,
}) => {
  // Source selection: 'all' | 'learning' | 'bookmarked'
  const [sourceFilter, setSourceFilter] = useState<'all' | 'learning' | 'bookmarked'>('all');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [sessionResults, setSessionResults] = useState<
    { word: WordItem; isCorrect: boolean }[]
  >([]);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [questionCount, setQuestionCount] = useState<number>(10);

  // Eligible pool of words based on filter
  const eligibleWords = useMemo(() => {
    return words.filter((w) => {
      const prog = progressMap.get(w.id);
      if (sourceFilter === 'learning') {
        return prog?.status === 'learning';
      }
      if (sourceFilter === 'bookmarked') {
        return prog?.isBookmarked;
      }
      return true;
    });
  }, [words, progressMap, sourceFilter]);

  // Generate quiz questions
  const startNewQuiz = (customPool?: WordItem[]) => {
    const pool = customPool || eligibleWords;
    if (pool.length < 4) {
      // If pool has fewer than 4, fallback to all words so 4 options can be generated
      return;
    }

    // Shuffle pool
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const selectedCount = Math.min(shuffled.length, questionCount);
    const chosenWords = shuffled.slice(0, selectedCount);

    const generated: QuizQuestion[] = chosenWords.map((target, idx) => {
      // 50% chance of 'word_to_def' vs 'def_to_word'
      const isWordToDef = idx % 2 === 0;

      // Select 3 distractors from all words (not the target word)
      const distractors = words
        .filter((w) => w.id !== target.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);

      if (isWordToDef) {
        const options = [target.definition, ...distractors.map((d) => d.definition)].sort(
          () => Math.random() - 0.5
        );
        return {
          id: `q-${target.id}-${idx}`,
          questionType: 'word_to_def',
          prompt: target.word,
          phonetic: target.phonetic,
          correctAnswer: target.definition,
          options,
          explanation: target.example,
          wordItem: target,
        };
      } else {
        const options = [target.word, ...distractors.map((d) => d.word)].sort(
          () => Math.random() - 0.5
        );
        return {
          id: `q-${target.id}-${idx}`,
          questionType: 'def_to_word',
          prompt: target.definition,
          phonetic: undefined,
          correctAnswer: target.word,
          options,
          explanation: target.example,
          wordItem: target,
        };
      }
    });

    setQuestions(generated);
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setSessionResults([]);
    setIsCompleted(false);
  };

  // Initialize or re-initialize quiz on filter change
  useEffect(() => {
    if (eligibleWords.length >= 4) {
      startNewQuiz();
    }
  }, [sourceFilter, eligibleWords.length, questionCount]);

  const currentQ = questions[currentIndex] as QuizQuestion | undefined;

  const handleSelectOption = (option: string) => {
    if (isAnswered || !currentQ) return;
    setSelectedOption(option);
    setIsAnswered(true);

    const isCorrect = option === currentQ.correctAnswer;
    const newResults = [...sessionResults, { word: currentQ.wordItem, isCorrect }];
    setSessionResults(newResults);

    // If it's the last question, save session results to Dexie
    if (currentIndex === questions.length - 1) {
      recordQuizSession(newResults).then(() => {
        onDataUpdated();
      });
    }
  };

  const handleNextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      setIsCompleted(true);
    }
  };

  const handlePronounce = (word: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    speakWord(word, speechRate);
  };

  const scoreCount = sessionResults.filter((r) => r.isCorrect).length;
  const missedWords = sessionResults.filter((r) => !r.isCorrect).map((r) => r.word);

  // If not enough words in current filter
  if (eligibleWords.length < 4) {
    return (
      <div className="mx-auto max-w-md pb-24 pt-8 px-4 text-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <HelpCircle className="mx-auto h-12 w-12 text-indigo-500" />
          <h3 className="mt-4 text-lg font-bold text-slate-800 dark:text-slate-100">
            Need at least 4 words
          </h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {sourceFilter === 'learning'
              ? 'You have not marked enough words as "Learning" yet. Browse the word list or flashcards to add words.'
              : sourceFilter === 'bookmarked'
              ? 'You have fewer than 4 bookmarked words. Star more words to quiz from your favorites.'
              : 'Add more words to test your vocabulary.'}
          </p>

          <div className="mt-6 flex flex-col gap-2">
            {sourceFilter !== 'all' && (
              <button
                onClick={() => setSourceFilter('all')}
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 cursor-pointer dark:bg-indigo-500"
              >
                Quiz From All Deck ({words.length} words)
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Quiz Summary Screen
  if (isCompleted) {
    const accuracy = Math.round((scoreCount / questions.length) * 100);
    return (
      <div className="mx-auto max-w-lg pb-24 pt-6 px-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-lg shadow-indigo-500/20">
              <Award className="h-8 w-8 text-amber-200" />
            </div>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Quiz Completed!
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {accuracy >= 80
                ? 'Outstanding mastery of vocabulary!'
                : accuracy >= 60
                ? 'Great progress! Reviewing missed words will help reinforce them.'
                : 'Keep practicing! Repetition leads to permanence.'}
            </p>

            {/* Score Ring / Metric */}
            <div className="mt-6 flex items-center justify-center gap-6 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
              <div className="text-center">
                <div className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">
                  {scoreCount}/{questions.length}
                </div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Score
                </div>
              </div>
              <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
              <div className="text-center">
                <div className="text-3xl font-extrabold text-slate-900 dark:text-white">
                  {accuracy}%
                </div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Accuracy
                </div>
              </div>
            </div>
          </div>

          {/* Missed Words Section */}
          {missedWords.length > 0 && (
            <div className="mt-6">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Words to Review ({missedWords.length})
              </h4>
              <div className="mt-2.5 divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {missedWords.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white text-sm">
                          {item.word}
                        </span>
                        <span className="text-xs text-indigo-600 dark:text-indigo-400 font-mono">
                          {item.phonetic}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                        {item.definition}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handlePronounce(item.word)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800 cursor-pointer"
                        title="Pronounce"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                      {onSelectWordForFlashcard && (
                        <button
                          onClick={() => onSelectWordForFlashcard(item)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800 cursor-pointer"
                          title="Review in flashcards"
                        >
                          <BookOpen className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Actions */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => startNewQuiz()}
              className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 active:scale-95 cursor-pointer dark:bg-indigo-500"
            >
              New Quiz Round
            </button>
            {missedWords.length >= 4 && (
              <button
                onClick={() => startNewQuiz(missedWords)}
                className="flex-1 rounded-xl border border-indigo-200 bg-indigo-50 py-2.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 cursor-pointer dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300"
              >
                Retry Missed ({missedWords.length})
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl pb-24 pt-4 px-4">
      {/* Quiz Source Filter & Length Selector */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Deck:</span>
          {(['all', 'learning', 'bookmarked'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setSourceFilter(filter)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition cursor-pointer ${
                sourceFilter === filter
                  ? 'bg-indigo-50 text-indigo-700 font-semibold dark:bg-indigo-950/70 dark:text-indigo-300'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {filter === 'all'
                ? 'All'
                : filter === 'learning'
                ? 'Learning'
                : 'Starred'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
            Q{currentIndex + 1}/{questions.length}
          </span>
        </div>
      </div>

      {/* Question Progress Bar */}
      <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      {currentQ && (
        <div className="space-y-4">
          {/* Question Card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                {currentQ.questionType === 'word_to_def'
                  ? 'Select Definition'
                  : 'Identify Word'}
              </span>
              <span className="rounded bg-slate-100 px-2 py-0.5 font-medium capitalize dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {currentQ.wordItem.category}
              </span>
            </div>

            <div className="mt-4">
              {currentQ.questionType === 'word_to_def' ? (
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                      {currentQ.prompt}
                    </h3>
                    {currentQ.phonetic && (
                      <p className="mt-1 text-sm font-mono text-indigo-600 dark:text-indigo-400">
                        {currentQ.phonetic}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handlePronounce(currentQ.prompt)}
                    className="rounded-full bg-indigo-50 p-3 text-indigo-600 hover:bg-indigo-100 transition cursor-pointer dark:bg-indigo-950/70 dark:text-indigo-400"
                    title="Pronounce word"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                    Which word matches this meaning?
                  </p>
                  <p className="text-lg sm:text-xl font-medium leading-relaxed text-slate-800 dark:text-slate-100">
                    "{currentQ.prompt}"
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Options Grid */}
          <div className="space-y-2.5">
            {currentQ.options.map((opt, idx) => {
              const isSelected = selectedOption === opt;
              const isCorrect = opt === currentQ.correctAnswer;

              let optionClasses =
                'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-700';

              if (isAnswered) {
                if (isCorrect) {
                  optionClasses =
                    'border-emerald-500 bg-emerald-50/80 text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-200 font-semibold';
                } else if (isSelected) {
                  optionClasses =
                    'border-rose-500 bg-rose-50/80 text-rose-900 dark:border-rose-600 dark:bg-rose-950/50 dark:text-rose-200';
                } else {
                  optionClasses =
                    'border-slate-200 bg-white/50 text-slate-400 dark:border-slate-800/50 dark:bg-slate-900/40 dark:text-slate-600';
                }
              }

              return (
                <button
                  key={`${opt}-${idx}`}
                  disabled={isAnswered}
                  onClick={() => handleSelectOption(opt)}
                  className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left text-sm transition cursor-pointer active:scale-[0.99] ${optionClasses}`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="flex-1 leading-relaxed">{opt}</span>
                  {isAnswered && (
                    <span className="shrink-0">
                      {isCorrect ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      ) : isSelected ? (
                        <XCircle className="h-5 w-5 text-rose-500" />
                      ) : null}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Feedback & Next Button */}
          {isAnswered && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60 transition animate-fade-in">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                    Example in context
                  </span>
                  <p className="mt-1 text-xs italic text-slate-600 dark:text-slate-300">
                    "{currentQ.explanation}"
                  </p>
                </div>
                <button
                  onClick={() => handlePronounce(currentQ.wordItem.word)}
                  className="rounded-lg p-1.5 text-indigo-600 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-indigo-950/60 cursor-pointer"
                  title="Pronounce"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>

              <button
                id="btn-quiz-next"
                onClick={handleNextQuestion}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 active:scale-95 cursor-pointer dark:bg-indigo-500"
              >
                <span>
                  {currentIndex === questions.length - 1
                    ? 'View Results'
                    : 'Next Question'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
