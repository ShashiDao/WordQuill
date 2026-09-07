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
        {/* Category horizontal scroll tabs */}
        <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-none border-b border-black/[0.08] dark:border-white/[0.08]">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                setCurrentIndex(0);
              }}
              className={`pb-1 text-xs font-medium capitalize whitespace-nowrap transition cursor-pointer ${
                selectedCategory === cat
                  ? 'text-[#1B1815] dark:text-[#F6F1E7] border-b border-[#D98A93]'
                  : 'text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7]'
              }`}
            >
              {cat === 'all' ? 'All Categories' : cat}
            </button>
          ))}
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center justify-between gap-2 pt-1 text-xs text-[#8C8272]">
          <div className="flex items-center gap-3">
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
                className={`pb-0.5 text-xs font-medium transition cursor-pointer ${
                  selectedStatusFilter === f.id
                    ? 'text-[#1B1815] dark:text-[#F6F1E7] border-b border-[#D98A93]'
                    : 'text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="text-[11px] font-medium text-[#8C8272]">
            {filteredWords.length > 0
              ? `${currentIndex + 1} of ${filteredWords.length}`
              : '0 words'}
          </div>
        </div>
      </div>

      {/* Empty State if filter yields no words */}
      {filteredWords.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/[0.1] bg-[#FAF6EE] p-12 text-center dark:border-white/[0.1] dark:bg-[#221E1B]">
          <BookOpen className="mx-auto h-10 w-10 text-[#8C8272]" />
          <h3 className="mt-4 text-base font-medium text-[#1B1815] dark:text-[#F6F1E7]">
            No words found
          </h3>
          <p className="mt-1 text-xs text-[#8C8272]">
            No words match the selected category or filter.
          </p>
          <button
            onClick={() => {
              setSelectedCategory('all');
              setSelectedStatusFilter('all');
            }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[#D98A93] px-3.5 py-1.5 text-xs font-medium text-[#D98A93] hover:bg-[#D98A93]/[0.08] cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Filters
          </button>
        </div>
      ) : (
        currentWord && (
          <>
            {/* Progress bar */}
            <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-black/[0.05] dark:bg-white/[0.05]">
              <div
                className="h-full bg-[#D98A93] transition-all duration-300"
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
                className={`relative h-full w-full rounded-2xl transition-transform duration-500 transform-style-preserve-3d border border-black/[0.08] dark:border-white/[0.08] ${
                  isFlipped ? 'rotate-y-180' : ''
                }`}
              >
                {/* FRONT FACE */}
                <div className="backface-hidden absolute inset-0 flex flex-col justify-between rounded-2xl bg-[#FAF6EE] p-6 dark:bg-[#221E1B]">
                  {/* Card Header Top */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs italic text-[#8C8272]">
                      {currentWord.category}
                    </span>

                    {/* Bookmark button */}
                    <button
                      onClick={handleToggleBookmark}
                      className="p-1 text-[#8C8272] hover:text-[#C9924A] cursor-pointer transition-colors"
                      title="Bookmark word"
                    >
                      <Bookmark
                        className={`w-4 h-4 ${
                          currentProgress?.isBookmarked ? 'fill-[#C9924A] text-[#C9924A]' : 'text-[#8C8272]'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Card Center Body: Word & Phonetic & Pronunciation */}
                  <div className="flex flex-col items-center justify-center text-center my-auto">
                    <h2
                      id="card-word-title"
                      className="font-fraunces text-4xl font-medium tracking-tight text-[#1B1815] dark:text-[#F6F1E7]"
                    >
                      {currentWord.word}
                    </h2>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="font-mono-ipa text-sm text-[#8C8272]">
                        {currentWord.phonetic}
                      </span>
                      <span className="text-xs italic text-[#8C8272]">
                        · {currentWord.category}
                      </span>
                    </div>

                    {/* Pronunciation button: icon + text only, accent color with bottom border under text */}
                    <button
                      id="audio-pronounce-btn"
                      onClick={handlePlayPronunciation}
                      className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-[#D98A93] cursor-pointer hover:opacity-80 transition-opacity"
                      title="Listen to pronunciation"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-[#D98A93]" />
                      <span className="border-b border-[#D98A93] pb-0.5">
                        {isSpeaking ? 'Speaking...' : 'Listen'}
                      </span>
                    </button>
                  </div>

                  {/* Card Footer Hint */}
                  <div className="flex items-center justify-between text-[11px] text-[#8C8272] border-t border-black/[0.08] dark:border-white/[0.08] pt-3">
                    <span>Space or tap to flip</span>
                    <span>
                      {currentProgress?.status === 'mastered'
                        ? 'Mastered · '
                        : currentProgress?.status === 'learning'
                        ? 'Learning · '
                        : ''}
                      reviewed {currentProgress?.reviewCount || 0} times
                    </span>
                  </div>
                </div>

                {/* BACK FACE */}
                <div className="backface-hidden rotate-y-180 absolute inset-0 flex flex-col justify-between rounded-2xl bg-[#FAF6EE] p-6 dark:bg-[#221E1B]">
                  {/* Card Header Top */}
                  <div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-fraunces text-2xl font-medium text-[#1B1815] dark:text-[#F6F1E7]">
                          {currentWord.word}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono-ipa text-xs text-[#8C8272]">
                            {currentWord.phonetic}
                          </span>
                          <span className="text-xs italic text-[#8C8272]">
                            · {currentWord.category}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={handlePlayPronunciation}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#D98A93] cursor-pointer hover:opacity-80 transition-opacity"
                        title="Listen"
                      >
                        <Volume2 className="w-3.5 h-3.5 text-[#D98A93]" />
                        <span className="border-b border-[#D98A93] pb-0.5">Listen</span>
                      </button>
                    </div>

                    {/* Single 1px hairline divider between word/IPA and definition block */}
                    <div className="w-full border-b border-black/[0.08] dark:border-white/[0.08] my-3.5" />
                  </div>

                  {/* Definition & Example */}
                  <div className="my-auto space-y-3">
                    <div>
                      <p className="font-fraunces text-base font-normal leading-[1.6] text-[#1B1815]/90 dark:text-[#F6F1E7]/90">
                        {currentWord.definition}
                      </p>
                    </div>

                    <p className="text-xs italic leading-relaxed text-[#8C8272]">
                      "{currentWord.example}"
                    </p>

                    {/* Small inline icon + muted-color text below the definition */}
                    <div className="flex items-center gap-1.5 text-xs text-[#8C8272] pt-1">
                      {currentProgress?.status === 'mastered' ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 text-[#8FB996]" />
                          <span className="text-[#8FB996] font-medium">Mastered</span>
                          <span>· reviewed {currentProgress?.reviewCount || 0} times</span>
                        </>
                      ) : currentProgress?.status === 'learning' ? (
                        <>
                          <HelpCircle className="w-3.5 h-3.5 text-[#C9924A]" />
                          <span className="text-[#C9924A] font-medium">Learning</span>
                          <span>· reviewed {currentProgress?.reviewCount || 0} times</span>
                        </>
                      ) : (
                        <span>Reviewed {currentProgress?.reviewCount || 0} times</span>
                      )}
                    </div>
                  </div>

                  {/* Card Footer Hint */}
                  <div className="text-center text-[11px] text-[#8C8272] border-t border-black/[0.08] dark:border-white/[0.08] pt-2.5">
                    Tap to flip back
                  </div>
                </div>
              </div>
            </div>

            {/* Action Feedback Badge */}
            {actionFeedback && (
              <div className="mt-2 text-center text-xs font-medium text-[#8FB996] transition animate-fade-in">
                {actionFeedback}
              </div>
            )}

            {/* Segmented control: Learning / Mastered buttons */}
            <div className="mt-4 flex w-full max-w-sm mx-auto rounded-xl border border-black/[0.08] dark:border-white/[0.08] divide-x divide-black/[0.08] dark:divide-white/[0.08] overflow-hidden text-xs">
              <button
                id="btn-mark-learning"
                onClick={(e) => handleMarkStatus('learning', e)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 transition-colors cursor-pointer ${
                  currentProgress?.status === 'learning'
                    ? 'bg-[#C9924A]/[0.08] text-[#C9924A] font-medium'
                    : 'text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7]'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5 text-[#C9924A]" />
                <span>Learning</span>
              </button>

              <button
                id="btn-mark-mastered"
                onClick={(e) => handleMarkStatus('mastered', e)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 transition-colors cursor-pointer ${
                  currentProgress?.status === 'mastered'
                    ? 'bg-[#8FB996]/[0.08] text-[#8FB996] font-medium'
                    : 'text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7]'
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5 text-[#8FB996]" />
                <span>Mastered</span>
              </button>
            </div>

            {/* Navigation & Controls Bar */}
            <div className="mt-4 flex items-center justify-between rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-[#FAF6EE] dark:bg-[#221E1B] p-2 text-xs">
              <button
                id="btn-prev-card"
                onClick={handlePrev}
                className="flex items-center gap-1 px-2.5 py-1.5 font-medium text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7] cursor-pointer"
                aria-label="Previous card"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Prev</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  id="btn-shuffle-card"
                  onClick={handleShuffle}
                  className="p-1.5 text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7] cursor-pointer"
                  title="Shuffle deck"
                >
                  <Shuffle className="w-4 h-4" />
                </button>

                <button
                  id="btn-flip-card-btn"
                  onClick={handleFlipCard}
                  className="flex items-center gap-1 text-xs font-medium text-[#D98A93] hover:opacity-80 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="border-b border-[#D98A93] pb-0.5">
                    {isFlipped ? 'Show Word' : 'Show Meaning'}
                  </span>
                </button>
              </div>

              <button
                id="btn-next-card"
                onClick={handleNext}
                className="flex items-center gap-1 px-2.5 py-1.5 font-medium text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7] cursor-pointer"
                aria-label="Next card"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Practice Prompt */}
            {onNavigateToQuiz && (
              <div className="mt-4 text-center">
                <button
                  onClick={onNavigateToQuiz}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#D98A93] hover:underline cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#D98A93]" />
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
