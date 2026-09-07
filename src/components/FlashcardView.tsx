import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Volume2,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  RotateCcw,
  CheckCircle,
  HelpCircle,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import type { WordItem, UserWordProgress } from '../types';
import { speakWord } from '../utils/speech';
import {
  recordWordReview,
  setWordStatus,
  toggleWordBookmark,
} from '../db/operations';

interface FlashcardViewProps {
  words: WordItem[];
  progressMap: Map<string, UserWordProgress>;
  speechRate: number;
  onDataUpdated: () => void;
  onNavigateToQuiz?: () => void;
}

export const FlashcardView: React.FC<FlashcardViewProps> = ({
  words,
  progressMap,
  speechRate,
  onDataUpdated,
  onNavigateToQuiz,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Extract available categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    words.forEach((w) => set.add(w.category));
    return ['all', ...Array.from(set)];
  }, [words]);

  // Filter words based on active category and status
  const filteredWords = useMemo(() => {
    return words.filter((w) => {
      // Category filter
      if (selectedCategory !== 'all' && w.category !== selectedCategory) {
        return false;
      }
      // Status filter
      const prog = progressMap.get(w.id);
      if (selectedStatusFilter === 'starred') {
        return prog?.isBookmarked;
      }
      if (selectedStatusFilter === 'learning') {
        return prog?.status === 'learning';
      }
      if (selectedStatusFilter === 'mastered') {
        return prog?.status === 'mastered';
      }
      if (selectedStatusFilter === 'new') {
        return !prog || prog.status === 'new';
      }
      return true;
    });
  }, [words, progressMap, selectedCategory, selectedStatusFilter]);

  // Ensure currentIndex stays within bounds
  useEffect(() => {
    if (currentIndex >= filteredWords.length) {
      setCurrentIndex(0);
    }
    setIsFlipped(false);
  }, [filteredWords.length, selectedCategory, selectedStatusFilter]);

  const currentWord = filteredWords[currentIndex] as WordItem | undefined;
  const currentProgress = currentWord ? progressMap.get(currentWord.id) : undefined;

  const handlePlayPronunciation = useCallback(
    (e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      if (!currentWord) return;
      setIsSpeaking(true);
      speakWord(
        currentWord.word,
        speechRate,
        () => setIsSpeaking(true),
        () => setIsSpeaking(false)
      );
    },
    [currentWord, speechRate]
  );

  const handleFlipCard = () => {
    setIsFlipped((prev) => {
      const next = !prev;
      // If flipping to the back (revealing definition), record word review
      if (next && currentWord) {
        recordWordReview(currentWord).then(() => {
          onDataUpdated();
        });
      }
      return next;
    });
  };

  const handleNext = useCallback(() => {
    if (filteredWords.length === 0) return;
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % filteredWords.length);
  }, [filteredWords.length]);

  const handlePrev = useCallback(() => {
    if (filteredWords.length === 0) return;
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + filteredWords.length) % filteredWords.length);
  }, [filteredWords.length]);

  const handleShuffle = () => {
    if (filteredWords.length <= 1) return;
    setIsFlipped(false);
    let newIdx = Math.floor(Math.random() * filteredWords.length);
    if (newIdx === currentIndex) {
      newIdx = (newIdx + 1) % filteredWords.length;
    }
    setCurrentIndex(newIdx);
  };

  const handleToggleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentWord) return;
    await toggleWordBookmark(currentWord);
    onDataUpdated();
  };

  const handleMarkStatus = async (status: 'learning' | 'mastered', e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentWord) return;
    await setWordStatus(currentWord, status);
    setActionFeedback(status === 'mastered' ? 'Mastered! ✨' : 'Added to Learning 📖');
    setTimeout(() => setActionFeedback(null), 1500);
    onDataUpdated();
    // Auto advance to next card after a brief moment
    setTimeout(() => {
      handleNext();
    }, 350);
  };

  // Keyboard navigation support: Space to flip, Left/Right arrows to navigate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        handleFlipCard();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        handlePlayPronunciation();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, handlePlayPronunciation]);

  return (
    <div className="mx-auto max-w-xl pb-24 pt-4 px-4">
      {/* Category & Status Filters */}
      <div className="mb-4 space-y-2.5">
        {/* Category horizontal scroll chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                setCurrentIndex(0);
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize whitespace-nowrap transition cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-sm dark:bg-indigo-500'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
              }`}
            >
              {cat === 'all' ? 'All Categories' : cat}
            </button>
          ))}
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <div className="flex items-center gap-1">
            {[
              { id: 'all', label: 'All' },
              { id: 'new', label: 'New' },
              { id: 'learning', label: 'Learning' },
              { id: 'mastered', label: 'Mastered' },
              { id: 'starred', label: 'Starred' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setSelectedStatusFilter(f.id);
                  setCurrentIndex(0);
                }}
                className={`rounded px-2 py-0.5 text-xs font-medium transition cursor-pointer ${
                  selectedStatusFilter === f.id
                    ? 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 font-semibold'
                    : 'hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="text-[11px] font-medium text-slate-400">
            {filteredWords.length > 0
              ? `${currentIndex + 1} of ${filteredWords.length}`
              : '0 words'}
          </div>
        </div>
      </div>

      {/* Empty State if filter yields no words */}
      {filteredWords.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <BookOpen className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-4 text-base font-semibold text-slate-800 dark:text-slate-200">
            No words found
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            No words match the selected category or filter.
          </p>
          <button
            onClick={() => {
              setSelectedCategory('all');
              setSelectedStatusFilter('all');
            }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Filters
          </button>
        </div>
      ) : (
        currentWord && (
          <>
            {/* Progress bar */}
            <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300"
                style={{
                  width: `${((currentIndex + 1) / filteredWords.length) * 100}%`,
                }}
              />
            </div>

            {/* Interactive 3D Flip Card Container */}
            <div
              className="perspective-1000 relative mx-auto h-80 w-full cursor-pointer select-none"
              onClick={handleFlipCard}
              id="flashcard-container"
            >
              {/* Card Inner */}
              <div
                className={`relative h-full w-full rounded-2xl transition-transform duration-500 transform-style-preserve-3d shadow-lg border border-slate-200/80 dark:border-slate-800 ${
                  isFlipped ? 'rotate-y-180' : ''
                }`}
              >
                {/* FRONT FACE */}
                <div className="backface-hidden absolute inset-0 flex flex-col justify-between rounded-2xl bg-white p-6 dark:bg-slate-900">
                  {/* Card Header Top */}
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300">
                      {currentWord.category}
                    </span>

                    <div className="flex items-center gap-1">
                      {/* Status badge */}
                      {currentProgress?.status === 'mastered' && (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                          <CheckCircle className="w-3 h-3" /> Mastered
                        </span>
                      )}
                      {currentProgress?.status === 'learning' && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                          Learning
                        </span>
                      )}

                      {/* Bookmark button */}
                      <button
                        onClick={handleToggleBookmark}
                        className={`rounded-full p-2 transition hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer ${
                          currentProgress?.isBookmarked
                            ? 'text-amber-500 fill-amber-500'
                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                        }`}
                        title="Bookmark word"
                      >
                        <Bookmark
                          className={`w-5 h-5 ${
                            currentProgress?.isBookmarked ? 'fill-current' : ''
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Card Center Body: Word & Phonetic & Pronunciation */}
                  <div className="flex flex-col items-center justify-center text-center my-auto">
                    <h2
                      id="card-word-title"
                      className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white"
                    >
                      {currentWord.word}
                    </h2>
                    <p className="mt-1.5 text-sm font-mono tracking-wide text-indigo-600 dark:text-indigo-400">
                      {currentWord.phonetic}
                    </p>

                    {/* Pronunciation button */}
                    <button
                      id="audio-pronounce-btn"
                      onClick={handlePlayPronunciation}
                      className={`mt-4 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/80 px-4 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 active:scale-95 cursor-pointer dark:border-indigo-800/80 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-900/60 ${
                        isSpeaking ? 'ring-2 ring-indigo-500 animate-pulse' : ''
                      }`}
                      title="Listen to pronunciation"
                    >
                      <Volume2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>{isSpeaking ? 'Speaking...' : 'Listen'}</span>
                    </button>
                  </div>

                  {/* Card Footer Hint */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
                    <span>Space or tap to flip</span>
                    <span>Reviews: {currentProgress?.reviewCount || 0}</span>
                  </div>
                </div>

                {/* BACK FACE */}
                <div className="backface-hidden rotate-y-180 absolute inset-0 flex flex-col justify-between rounded-2xl bg-gradient-to-b from-white to-slate-50 p-6 dark:from-slate-900 dark:to-slate-950">
                  {/* Card Header Top */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        {currentWord.word}
                      </span>
                      <span className="text-xs text-indigo-600 dark:text-indigo-400 font-mono">
                        {currentWord.phonetic}
                      </span>
                    </div>
                    <button
                      onClick={handlePlayPronunciation}
                      className="rounded-full p-1.5 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/50 cursor-pointer"
                      title="Listen"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Definition & Example */}
                  <div className="my-auto space-y-4">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Definition
                      </span>
                      <p className="mt-1 text-base font-medium leading-relaxed text-slate-800 dark:text-slate-200">
                        {currentWord.definition}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-100/80 p-3.5 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        Example
                      </span>
                      <p className="mt-1 text-sm italic leading-relaxed text-slate-600 dark:text-slate-300">
                        "{currentWord.example}"
                      </p>
                    </div>
                  </div>

                  {/* Card Footer Hint */}
                  <div className="text-center text-[11px] text-slate-400 dark:text-slate-500">
                    Tap to flip back
                  </div>
                </div>
              </div>
            </div>

            {/* Action Feedback Badge */}
            {actionFeedback && (
              <div className="mt-2 text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 transition animate-fade-in">
                {actionFeedback}
              </div>
            )}

            {/* Learning Status Quick Actions */}
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                id="btn-mark-learning"
                onClick={(e) => handleMarkStatus('learning', e)}
                className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800 shadow-sm transition hover:bg-amber-100 active:scale-95 cursor-pointer dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/60"
              >
                <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Mark as Learning</span>
              </button>

              <button
                id="btn-mark-mastered"
                onClick={(e) => handleMarkStatus('mastered', e)}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-100 active:scale-95 cursor-pointer dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60"
              >
                <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Mark as Mastered</span>
              </button>
            </div>

            {/* Navigation & Controls Bar */}
            <div className="mt-5 flex items-center justify-between rounded-xl bg-white p-2.5 shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
              <button
                id="btn-prev-card"
                onClick={handlePrev}
                className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 active:scale-95 cursor-pointer dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Previous card"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Prev</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  id="btn-shuffle-card"
                  onClick={handleShuffle}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  title="Shuffle deck"
                >
                  <Shuffle className="w-4 h-4" />
                </button>

                <button
                  id="btn-flip-card-btn"
                  onClick={handleFlipCard}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 cursor-pointer dark:bg-indigo-950/70 dark:text-indigo-300 dark:hover:bg-indigo-900/80"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isFlipped ? 'Show Word' : 'Show Meaning'}</span>
                </button>
              </div>

              <button
                id="btn-next-card"
                onClick={handleNext}
                className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 active:scale-95 cursor-pointer dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Next card"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Practice Prompt */}
            {onNavigateToQuiz && (
              <div className="mt-5 text-center">
                <button
                  onClick={onNavigateToQuiz}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ready to test yourself? Take a quick quiz &rarr;</span>
                </button>
              </div>
            )}
          </>
        )
      )}
    </div>
  );
};
