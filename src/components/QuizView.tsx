import React, { useState, useMemo, useEffect, useRef } from 'react';
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
import { shuffle } from '../utils/shuffle';
import { recordQuizSession, getDueWords, isLeech } from '../db/operations';

const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface QuizViewProps {
  words: WordItem[];
  progressMap: Map<string, UserWordProgress>;
  speechRate: number;
  preferredCategories?: string[];
  onDataUpdated: () => void;
  onSelectWordForFlashcard?: (word: WordItem) => void;
}

export const QuizView: React.FC<QuizViewProps> = ({
  words,
  progressMap,
  speechRate,
  preferredCategories,
  onDataUpdated,
  onSelectWordForFlashcard,
}) => {
  // Category selection: defaults to preferred categories if set, otherwise 'all'
  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    if (preferredCategories && preferredCategories.length > 0 && preferredCategories.length < 5) {
      return preferredCategories.length === 1 ? preferredCategories[0] : 'preferred';
    }
    return 'all';
  });

  // Source selection: 'learning' | 'all' | 'bookmarked'
  const [sourceFilter, setSourceFilter] = useState<'learning' | 'all' | 'bookmarked'>('learning');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [typedAnswer, setTypedAnswer] = useState<string>('');
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [sessionResults, setSessionResults] = useState<
    { word: WordItem; isCorrect: boolean }[]
  >([]);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [questionCount, setQuestionCount] = useState<number>(10);

  // Extract available categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    words.forEach((w) => set.add(w.category));
    const allCats = Array.from(set);
    if (preferredCategories && preferredCategories.length > 0 && preferredCategories.length < allCats.length) {
      return ['preferred', 'all', ...allCats];
    }
    return ['all', ...allCats];
  }, [words, preferredCategories]);

  // Helper to compute pool snapshot for a quiz round
  const getEligiblePoolSnapshot = (
    cat: string,
    source: 'learning' | 'all' | 'bookmarked',
    pMap: Map<string, UserWordProgress>
  ): WordItem[] => {
    let catPool = words;
    if (cat === 'preferred' && preferredCategories && preferredCategories.length > 0) {
      catPool = words.filter((w) => preferredCategories.includes(w.category));
    } else if (cat !== 'all' && cat !== 'preferred') {
      catPool = words.filter((w) => w.category === cat);
    }

    if (source === 'learning') {
      const due = getDueWords(catPool, pMap);
      return due.length >= 4 ? due : catPool;
    }
    if (source === 'bookmarked') {
      return catPool.filter((w) => pMap.get(w.id)?.isBookmarked);
    }
    return catPool;
  };

  const quizPoolRef = useRef<WordItem[]>([]);
  const hasInitializedRef = useRef(false);
  const prevFilterRef = useRef({ selectedCategory, sourceFilter, questionCount });

  // Generate quiz questions
  const startNewQuiz = (customPool?: WordItem[]) => {
    const pool: WordItem[] = customPool || getEligiblePoolSnapshot(selectedCategory, sourceFilter, progressMap);
    quizPoolRef.current = pool;

    if (pool.length < 4) {
      setQuestions([]);
      setCurrentIndex(0);
      setSelectedOption(null);
      setTypedAnswer('');
      setIsAnswered(false);
      setSessionResults([]);
      setIsCompleted(false);
      return;
    }

    const selectedCount = Math.min(pool.length, questionCount);
    let chosenWords: WordItem[];

    if (sourceFilter === 'all' && !customPool) {
      // Exclude leeches from the normal weighted quiz pool so they don't dominate every quiz
      const nonLeechPool = pool.filter((w) => {
        const prog = progressMap.get(w.id);
        return !prog || !isLeech(prog);
      });
      const quizPool = nonLeechPool.length >= 4 ? nonLeechPool : pool;

      // Weight picks toward words returned by getDueWords() and words where incorrectCount > correctCount
      const dueWordsList = getDueWords(quizPool, progressMap);
      const dueSet = new Set(dueWordsList.map((w) => w.id));

      const priorityCandidates: { word: WordItem; weight: number }[] = [];
      for (const w of quizPool) {
        const prog = progressMap.get(w.id);
        const isDue = dueSet.has(w.id);
        const isStruggling = prog
          ? !isLeech(prog) && (prog.incorrectCount || 0) > (prog.correctCount || 0)
          : false;

        if (isDue || isStruggling) {
          let weight = 1;
          if (isDue) weight += 2;
          if (isStruggling) weight += 3;
          priorityCandidates.push({ word: w, weight });
        }
      }

      // Reserve slots for priority words (up to ~60%), leaving the remaining slots for random pool
      const maxPrioritySlots = Math.min(
        priorityCandidates.length,
        Math.max(1, Math.floor(selectedCount * 0.6))
      );

      // Weighted random sampling without replacement using exponential keys
      const sampledPriority = priorityCandidates
        .map((item) => ({
          word: item.word,
          key: Math.pow(Math.random(), 1 / item.weight),
        }))
        .sort((a, b) => b.key - a.key)
        .slice(0, maxPrioritySlots)
        .map((item) => item.word);

      const chosenIds = new Set(sampledPriority.map((w) => w.id));

      // Fill remaining slots randomly from the non-leech pool
      const remainingPool = shuffle(quizPool.filter((w) => !chosenIds.has(w.id)));

      const needed = selectedCount - sampledPriority.length;
      const sampledRemaining = remainingPool.slice(0, needed);

      chosenWords = shuffle<WordItem>([...sampledPriority, ...sampledRemaining]);
    } else {
      // Shuffle pool
      const shuffled = shuffle<WordItem>(pool);
      chosenWords = shuffled.slice(0, selectedCount);
    }

    const questionTypes: QuizQuestion['questionType'][] = [
      'word_to_def',
      'def_to_word',
      'cloze',
      'spelling',
      'synonym_match',
      'typed_recall',
    ];

    const generated: QuizQuestion[] = chosenWords.map((target, idx) => {
      let assignedType = questionTypes[Math.floor(Math.random() * questionTypes.length)];

      // synonym_match is only eligible for words with at least 1 synonym; fall back to word_to_def
      if (assignedType === 'synonym_match') {
        if (!target.synonyms || target.synonyms.length === 0) {
          assignedType = 'word_to_def';
        }
      }

      if (assignedType === 'typed_recall') {
        return {
          id: `q-${target.id}-${idx}`,
          questionType: 'typed_recall',
          prompt: target.definition,
          phonetic: target.phonetic,
          correctAnswer: target.word,
          options: [],
          explanation: target.example,
          wordItem: target,
        };
      }

      if (assignedType === 'cloze') {
        const regex = new RegExp(`\\b${escapeRegExp(target.word)}\\b`, 'i');
        if (regex.test(target.example)) {
          return {
            id: `q-${target.id}-${idx}`,
            questionType: 'cloze',
            prompt: target.example.replace(regex, '_____'),
            phonetic: target.phonetic,
            correctAnswer: target.word,
            options: [],
            explanation: target.example,
            wordItem: target,
          };
        }
        // Fall back to word_to_def if word does not appear verbatim in example
        assignedType = 'word_to_def';
      }

      if (assignedType === 'spelling') {
        return {
          id: `q-${target.id}-${idx}`,
          questionType: 'spelling',
          prompt: target.definition,
          phonetic: undefined,
          correctAnswer: target.word,
          options: [],
          explanation: target.example,
          wordItem: target,
        };
      }

      if (assignedType === 'synonym_match') {
        const candidateSynonyms = target.synonyms!;
        const correctSynonym = candidateSynonyms[Math.floor(Math.random() * candidateSynonyms.length)];

        // 3 distractors: synonyms/words from other unrelated words
        const unrelatedWords = shuffle<WordItem>(
          words.filter((w) => w.id !== target.id && w.word.toLowerCase() !== target.word.toLowerCase())
        );

        const targetSynSet = new Set(candidateSynonyms.map((s) => s.toLowerCase()));
        targetSynSet.add(target.word.toLowerCase());

        const distractorOptions: string[] = [];
        for (const other of unrelatedWords) {
          if (distractorOptions.length >= 3) break;
          let pick: string | undefined;
          if (other.synonyms && other.synonyms.length > 0) {
            const validSyns = other.synonyms.filter(
              (s) => !targetSynSet.has(s.toLowerCase()) && !distractorOptions.includes(s)
            );
            if (validSyns.length > 0) {
              pick = validSyns[Math.floor(Math.random() * validSyns.length)];
            }
          }
          if (!pick && !targetSynSet.has(other.word.toLowerCase()) && !distractorOptions.includes(other.word)) {
            pick = other.word;
          }
          if (pick && !distractorOptions.includes(pick)) {
            distractorOptions.push(pick);
          }
        }

        const options = shuffle<string>([correctSynonym, ...distractorOptions]);

        return {
          id: `q-${target.id}-${idx}`,
          questionType: 'synonym_match',
          prompt: target.word,
          phonetic: target.phonetic,
          correctAnswer: correctSynonym,
          options,
          explanation: target.example,
          wordItem: target,
        };
      }

      // Distractor selection: prefer 3 wrong options from the SAME category as target word.
      // Only fall back to cross-category sampling if that category has fewer than 4 words total.
      const sameCategoryWords = words.filter((w) => w.category === target.category);
      let distractors: WordItem[];

      if (sameCategoryWords.length >= 4) {
        distractors = shuffle<WordItem>(sameCategoryWords.filter((w) => w.id !== target.id)).slice(0, 3);
      } else {
        distractors = shuffle<WordItem>(words.filter((w) => w.id !== target.id)).slice(0, 3);
      }

      if (assignedType === 'word_to_def') {
        const options = shuffle<string>([target.definition, ...distractors.map((d) => d.definition)]);
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
        const options = shuffle([target.word, ...distractors.map((d) => d.word)]);
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
    setTypedAnswer('');
    setIsAnswered(false);
    setSessionResults([]);
    setIsCompleted(false);
  };

  // Initialize quiz on mount or re-initialize on explicit filter change
  useEffect(() => {
    const filterChanged =
      prevFilterRef.current.selectedCategory !== selectedCategory ||
      prevFilterRef.current.sourceFilter !== sourceFilter ||
      prevFilterRef.current.questionCount !== questionCount;

    prevFilterRef.current = { selectedCategory, sourceFilter, questionCount };

    // Explicit filter change: restart quiz with new filter
    if (filterChanged) {
      if (words.length >= 4) {
        startNewQuiz();
      }
      return;
    }

    // Initial mount: start quiz once words are ready
    if (!hasInitializedRef.current && words.length >= 4) {
      hasInitializedRef.current = true;
      startNewQuiz();
    }
  }, [sourceFilter, selectedCategory, questionCount, words.length]);

  const currentQ = questions[currentIndex] as QuizQuestion | undefined;

  const handleSelectOption = (option: string) => {
    if (isAnswered || !currentQ) return;
    setSelectedOption(option);
    setIsAnswered(true);

    const isCorrect = option.trim().toLowerCase() === currentQ.correctAnswer.trim().toLowerCase();
    const newResults = [...sessionResults, { word: currentQ.wordItem, isCorrect }];
    setSessionResults(newResults);

    // If it's the last question, save session results to Dexie
    if (currentIndex === questions.length - 1) {
      recordQuizSession(newResults).then(() => {
        onDataUpdated();
      });
    }
  };

  const handleCheckTypedAnswer = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isAnswered || !currentQ) return;
    const trimmed = typedAnswer.trim();
    if (!trimmed) return;

    setSelectedOption(trimmed);
    setIsAnswered(true);

    const isCorrect = trimmed.toLowerCase() === currentQ.correctAnswer.trim().toLowerCase();
    const newResults = [...sessionResults, { word: currentQ.wordItem, isCorrect }];
    setSessionResults(newResults);

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
      setTypedAnswer('');
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

  // Quiz Summary Screen (rendered when session completes, immune to subsequent pool recomputations)
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
              <h4 className="text-xs font-medium text-[#8C8272]">
                Words to review ({missedWords.length})
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

  // If not enough words in current filter and no active quiz
  if (questions.length === 0) {
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

  return (
    <div className="mx-auto max-w-xl pb-24 pt-4 px-4">
      {/* Category Horizontal Scrolling Tabs */}
      <div className="mb-3 flex items-center gap-4 overflow-x-auto pb-2 scrollbar-none border-b border-black/[0.08] dark:border-white/[0.08] mask-edge-fade">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`pb-1 text-xs font-medium capitalize whitespace-nowrap transition cursor-pointer ${
              selectedCategory === cat
                ? 'text-[#1B1815] dark:text-[#F6F1E7] border-b border-[#D98A93]'
                : 'text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7]'
            }`}
          >
            {cat === 'all'
              ? 'All Categories'
              : cat === 'preferred'
              ? `Preferred (${preferredCategories?.length || 0})`
              : cat}
          </button>
        ))}
      </div>

      {/* Quiz Source Filter & Length Selector */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.08] pb-3 dark:border-white/[0.08]">
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#8C8272]">Deck:</span>
          {(['learning', 'all', 'bookmarked'] as const).map((filter) => (
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
              <span className="text-[11px] font-medium text-[#D98A93]">
                {currentQ.questionType === 'word_to_def'
                  ? 'Select definition'
                  : currentQ.questionType === 'def_to_word'
                  ? 'Identify word'
                  : currentQ.questionType === 'cloze'
                  ? 'Complete sentence'
                  : currentQ.questionType === 'spelling'
                  ? 'Spell the word'
                  : currentQ.questionType === 'typed_recall'
                  ? 'Active recall (type word)'
                  : 'Select synonym'}
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
              ) : currentQ.questionType === 'def_to_word' ? (
                <div>
                  <p className="text-xs text-[#8C8272] mb-1">
                    Which word matches this meaning?
                  </p>
                  <p className="font-fraunces text-lg font-normal leading-relaxed text-[#1B1815]/90 dark:text-[#F6F1E7]/90">
                    "{currentQ.prompt}"
                  </p>
                </div>
              ) : currentQ.questionType === 'cloze' ? (
                <div>
                  <p className="text-xs text-[#8C8272] mb-1.5">
                    Fill in the missing word:
                  </p>
                  <p className="font-fraunces text-lg font-normal leading-relaxed text-[#1B1815]/90 dark:text-[#F6F1E7]/90">
                    "{currentQ.prompt}"
                  </p>
                  <p className="mt-2 text-xs text-[#8C8272]">
                    Definition: {currentQ.wordItem.definition}
                  </p>
                </div>
              ) : currentQ.questionType === 'synonym_match' ? (
                <div>
                  <p className="text-xs text-[#8C8272] mb-1">
                    Select the closest synonym:
                  </p>
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
                  <p className="mt-2 text-xs italic text-[#8C8272]">
                    Definition: {currentQ.wordItem.definition}
                  </p>
                </div>
              ) : currentQ.questionType === 'spelling' ? (
                <div>
                  <p className="text-xs text-[#8C8272] mb-1.5">
                    Spell the word that matches this definition:
                  </p>
                  <p className="font-fraunces text-lg font-normal leading-relaxed text-[#1B1815]/90 dark:text-[#F6F1E7]/90">
                    "{currentQ.prompt}"
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-[#8C8272] mb-1.5">
                    Active Recall: Type the word for this definition:
                  </p>
                  <p className="font-fraunces text-lg font-normal leading-relaxed text-[#1B1815]/90 dark:text-[#F6F1E7]/90">
                    "{currentQ.prompt}"
                  </p>
                  {currentQ.phonetic && (
                    <p className="mt-1.5 text-xs font-mono-ipa text-[#8C8272]">
                      Phonetic cue: {currentQ.phonetic}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Options or Text Input Area */}
          {currentQ.questionType === 'cloze' || currentQ.questionType === 'spelling' || currentQ.questionType === 'typed_recall' ? (
            <div className="space-y-3">
              {!isAnswered ? (
                <form
                  onSubmit={handleCheckTypedAnswer}
                  className="flex flex-col sm:flex-row gap-2.5"
                >
                  <input
                    id="quiz-text-input"
                    type="text"
                    autoFocus
                    value={typedAnswer}
                    onChange={(e) => setTypedAnswer(e.target.value)}
                    placeholder={
                      currentQ.questionType === 'cloze'
                        ? 'Type the missing word...'
                        : currentQ.questionType === 'spelling'
                        ? 'Spell the word from memory...'
                        : 'Type the word from memory...'
                    }
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    className="flex-1 rounded-xl border border-black/[0.08] bg-[#FAF6EE] px-4 py-3 text-xs text-[#1B1815] placeholder:text-[#8C8272] focus:border-[#D98A93] focus:outline-none dark:border-white/[0.08] dark:bg-[#221E1B] dark:text-[#F6F1E7] transition"
                  />
                  <button
                    id="btn-quiz-check"
                    type="submit"
                    disabled={!typedAnswer.trim()}
                    className="rounded-xl bg-[#D98A93] px-6 py-3 text-xs font-medium text-[#1B1815] hover:opacity-90 active:scale-95 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition shrink-0"
                  >
                    Check
                  </button>
                </form>
              ) : (
                <div className="space-y-2">
                  {selectedOption?.toLowerCase() === currentQ.correctAnswer.toLowerCase() ? (
                    <div className="flex items-center gap-3 rounded-xl border border-[#8FB996] bg-[#8FB996]/[0.08] p-3.5 text-xs text-[#8FB996]">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#8FB996]" />
                      <div className="flex-1">
                        <span className="text-[#8C8272] mr-1.5">Your answer:</span>
                        <span className="font-fraunces font-medium text-sm text-[#8FB996]">
                          {selectedOption}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-[#8FB996]">Correct</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 rounded-xl border border-[#D98A93] bg-[#D98A93]/[0.08] p-3.5 text-xs text-[#D98A93]">
                        <XCircle className="h-4 w-4 shrink-0 text-[#D98A93]" />
                        <div className="flex-1">
                          <span className="text-[#8C8272] mr-1.5">Your answer:</span>
                          <span className="font-fraunces font-medium text-sm text-[#D98A93]">
                            {selectedOption || '(blank)'}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-[#D98A93]">Incorrect</span>
                      </div>
                      <div className="flex items-center gap-3 rounded-xl border border-[#8FB996] bg-[#8FB996]/[0.08] p-3.5 text-xs text-[#8FB996]">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-[#8FB996]" />
                        <div className="flex-1">
                          <span className="text-[#8C8272] mr-1.5">Correct answer:</span>
                          <span className="font-fraunces font-medium text-sm text-[#8FB996]">
                            {currentQ.correctAnswer}
                          </span>
                          {currentQ.wordItem.phonetic && (
                            <span className="ml-2 font-mono-ipa text-xs text-[#8C8272]">
                              {currentQ.wordItem.phonetic}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Options Grid */
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
          )}

          {/* Feedback & Next Button */}
          {isAnswered && (
            <div className="rounded-xl border border-black/[0.08] bg-[#FAF6EE] p-4 dark:border-white/[0.08] dark:bg-[#221E1B] transition animate-fade-in space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-medium text-[#8C8272]">
                    {currentQ.questionType === 'cloze'
                      ? 'Full sentence'
                      : currentQ.questionType === 'synonym_match'
                      ? 'Context & Synonyms'
                      : 'Example in context'}
                  </span>
                  <p className="mt-1 text-xs italic text-[#8C8272]">
                    "{currentQ.explanation}"
                  </p>
                  {currentQ.questionType === 'synonym_match' && currentQ.wordItem.synonyms && currentQ.wordItem.synonyms.length > 0 && (
                    <p className="mt-1.5 text-xs text-[#8C8272]">
                      <span className="font-medium text-[#1B1815] dark:text-[#F6F1E7]">Synonyms: </span>
                      {currentQ.wordItem.synonyms.join(', ')}
                    </p>
                  )}
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
