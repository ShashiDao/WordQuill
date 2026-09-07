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
        <div className="rounded-2xl border border-black/[0.08] bg-[#FAF6EE] p-8 dark:border-white/[0.08] dark:bg-[#221E1B]">
          <HelpCircle className="mx-auto h-10 w-10 text-[#C9924A]" />
          <h3 className="mt-4 text-lg font-medium text-[#1B1815] dark:text-[#F6F1E7]">
            Need at least 4 words
          </h3>
          <p className="mt-2 text-xs text-[#8C8272]">
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
                className="w-full rounded-xl border border-[#D98A93] py-2.5 text-xs font-medium text-[#D98A93] hover:bg-[#D98A93]/[0.08] cursor-pointer"
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
        <div className="rounded-2xl border border-black/[0.08] bg-[#FAF6EE] p-6 dark:border-white/[0.08] dark:bg-[#221E1B]">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-black/[0.08] dark:border-white/[0.08] text-[#C9924A]">
              <Award className="h-7 w-7 text-[#C9924A]" />
            </div>
            <h2 className="mt-4 font-fraunces text-2xl font-medium tracking-tight text-[#1B1815] dark:text-[#F6F1E7]">
              Quiz Completed
            </h2>
            <p className="mt-1 text-xs text-[#8C8272]">
              {accuracy >= 80
                ? 'Outstanding mastery of vocabulary.'
                : accuracy >= 60
                ? 'Great progress. Reviewing missed words will help reinforce them.'
                : 'Keep practicing. Repetition leads to permanence.'}
            </p>

            {/* Score Metric */}
            <div className="mt-6 flex items-center justify-center gap-8 rounded-xl border border-black/[0.08] bg-[#FAF6EE] p-4 dark:border-white/[0.08] dark:bg-[#221E1B]">
              <div className="text-center">
                <div className="font-fraunces text-3xl font-medium text-[#D98A93]">
                  {scoreCount}/{questions.length}
                </div>
                <div className="text-xs font-medium text-[#8C8272]">
                  Score
                </div>
              </div>
              <div className="h-8 w-px bg-black/[0.08] dark:bg-white/[0.08]" />
              <div className="text-center">
                <div className="font-fraunces text-3xl font-medium text-[#8FB996]">
                  {accuracy}%
                </div>
                <div className="text-xs font-medium text-[#8C8272]">
                  Accuracy
                </div>
              </div>
            </div>
          </div>

          {/* Missed Words Section */}
          {missedWords.length > 0 && (
            <div className="mt-6">
              <h4 className="text-xs font-medium uppercase tracking-wider text-[#8C8272]">
                Words to Review ({missedWords.length})
              </h4>
              <div className="mt-2.5 divide-y divide-black/[0.08] rounded-xl border border-black/[0.08] dark:divide-white/[0.08] dark:border-white/[0.08]">
                {missedWords.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-fraunces font-medium text-[#1B1815] dark:text-[#F6F1E7] text-sm">
                          {item.word}
                        </span>
                        <span className="text-xs text-[#8C8272] font-mono-ipa">
                          {item.phonetic}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-[#8C8272] line-clamp-1">
                        {item.definition}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handlePronounce(item.word)}
                        className="p-1.5 text-[#8C8272] hover:text-[#D98A93] transition-colors cursor-pointer"
                        title="Pronounce"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                      {onSelectWordForFlashcard && (
                        <button
                          onClick={() => onSelectWordForFlashcard(item)}
                          className="p-1.5 text-[#8C8272] hover:text-[#D98A93] transition-colors cursor-pointer"
                          title="Review in flashcards"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
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
              className="flex-1 rounded-xl bg-[#D98A93] py-2.5 text-xs font-medium text-[#1B1815] hover:opacity-90 active:scale-95 cursor-pointer transition"
            >
              New Quiz Round
            </button>
            {missedWords.length >= 4 && (
              <button
                onClick={() => startNewQuiz(missedWords)}
                className="flex-1 rounded-xl border border-[#D98A93] py-2.5 text-xs font-medium text-[#D98A93] hover:bg-[#D98A93]/[0.08] cursor-pointer transition"
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.08] pb-3 dark:border-white/[0.08]">
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#8C8272]">Deck:</span>
          {(['all', 'learning', 'bookmarked'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setSourceFilter(filter)}
              className={`pb-0.5 text-xs font-medium capitalize transition cursor-pointer ${
                sourceFilter === filter
                  ? 'text-[#1B1815] dark:text-[#F6F1E7] border-b border-[#D98A93]'
                  : 'text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7]'
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
          <span className="text-xs font-medium text-[#D98A93]">
            Question {currentIndex + 1} of {questions.length}
          </span>
        </div>
      </div>

      {/* Question Progress Bar */}
      <div className="mb-5 h-1 w-full overflow-hidden rounded-full bg-black/[0.05] dark:bg-white/[0.05]">
        <div
          className="h-full bg-[#D98A93] transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      {currentQ && (
        <div className="space-y-4">
          {/* Question Card */}
          <div className="rounded-2xl border border-black/[0.08] bg-[#FAF6EE] p-6 dark:border-white/[0.08] dark:bg-[#221E1B]">
            <div className="flex items-center justify-between text-xs text-[#8C8272]">
              <span className="text-[11px] font-medium uppercase tracking-wider text-[#D98A93]">
                {currentQ.questionType === 'word_to_def'
                  ? 'Select Definition'
                  : 'Identify Word'}
              </span>
              <span className="text-xs italic text-[#8C8272]">
                {currentQ.wordItem.category}
              </span>
            </div>

            <div className="mt-3">
              {currentQ.questionType === 'word_to_def' ? (
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-fraunces text-3xl font-medium tracking-tight text-[#1B1815] dark:text-[#F6F1E7]">
                      {currentQ.prompt}
                    </h3>
                    {currentQ.phonetic && (
                      <p className="mt-1 text-sm font-mono-ipa text-[#8C8272]">
                        {currentQ.phonetic}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handlePronounce(currentQ.prompt)}
                    className="p-2 text-[#8C8272] hover:text-[#D98A93] transition-colors cursor-pointer"
                    title="Pronounce word"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-[#8C8272] mb-1">
                    Which word matches this meaning?
                  </p>
                  <p className="font-fraunces text-lg font-normal leading-relaxed text-[#1B1815]/90 dark:text-[#F6F1E7]/90">
                    "{currentQ.prompt}"
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Options Grid */}
          <div className="space-y-2">
            {currentQ.options.map((opt, idx) => {
              const isSelected = selectedOption === opt;
              const isCorrect = opt === currentQ.correctAnswer;

              let optionClasses =
                'border-black/[0.08] bg-[#FAF6EE] text-[#1B1815] hover:border-black/[0.2] dark:border-white/[0.08] dark:bg-[#221E1B] dark:text-[#F6F1E7] dark:hover:border-white/[0.2]';

              if (isAnswered) {
                if (isCorrect) {
                  optionClasses =
                    'border-[#8FB996] bg-[#8FB996]/[0.08] text-[#8FB996] font-medium';
                } else if (isSelected) {
                  optionClasses =
                    'border-[#D98A93] bg-[#D98A93]/[0.08] text-[#D98A93] font-medium';
                } else {
                  optionClasses =
                    'border-black/[0.04] bg-[#FAF6EE]/50 text-[#8C8272] dark:border-white/[0.04] dark:bg-[#221E1B]/50';
                }
              }

              return (
                <button
                  key={`${opt}-${idx}`}
                  disabled={isAnswered}
                  onClick={() => handleSelectOption(opt)}
                  className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left text-xs transition cursor-pointer ${optionClasses}`}
                >
                  <span className="font-mono text-xs text-[#8C8272] pt-0.5">
                    {String.fromCharCode(65 + idx)}.
                  </span>
                  <span className="flex-1 leading-relaxed">{opt}</span>
                  {isAnswered && (
                    <span className="shrink-0 pt-0.5">
                      {isCorrect ? (
                        <CheckCircle2 className="h-4 w-4 text-[#8FB996]" />
                      ) : isSelected ? (
                        <XCircle className="h-4 w-4 text-[#D98A93]" />
                      ) : null}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Feedback & Next Button */}
          {isAnswered && (
            <div className="rounded-xl border border-black/[0.08] bg-[#FAF6EE] p-4 dark:border-white/[0.08] dark:bg-[#221E1B] transition animate-fade-in space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-[#8C8272]">
                    Example in context
                  </span>
                  <p className="mt-1 text-xs italic text-[#8C8272]">
                    "{currentQ.explanation}"
                  </p>
                </div>
                <button
                  onClick={() => handlePronounce(currentQ.wordItem.word)}
                  className="p-1 text-[#8C8272] hover:text-[#D98A93] cursor-pointer"
                  title="Pronounce"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                id="btn-quiz-next"
                onClick={handleNextQuestion}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D98A93] py-2.5 text-xs font-medium text-[#1B1815] hover:opacity-90 active:scale-95 cursor-pointer transition"
              >
                <span>
                  {currentIndex === questions.length - 1
                    ? 'View Results'
                    : 'Next Question'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
