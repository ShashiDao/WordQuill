import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Volume2,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Shuffle,
  RotateCcw,
  CheckCircle,
  HelpCircle,
  BookOpen,
} from 'lucide-react';
import type { WordItem, UserWordProgress } from '../types';
import { speakWord } from '../utils/speech';
import {
  recordWordReview,
  setWordStatus,
  toggleWordBookmark,
  getDueWords,
  incrementDailyWordsReviewed,
} from '../db/operations';

const STATUS_OPTIONS: { id: string; label: string }[] = [
  { id: 'learning', label: 'Learning' },
  { id: 'all', label: 'All' },
  { id: 'starred', label: 'Starred' },
  { id: 'new', label: 'New' },
  { id: 'mastered', label: 'Mastered' },
  { id: 'custom', label: 'Custom' },
];

interface FlashcardViewProps {
  words: WordItem[];
  progressMap: Map<string, UserWordProgress>;
  speechRate: number;
  preferredCategories?: string[];
  initialWordId?: string | null;
  onClearInitialWord?: () => void;
  onDataUpdated: () => void;
  onNavigateToQuiz?: () => void;
}

export const FlashcardView: React.FC<FlashcardViewProps> = ({
  words,
  progressMap,
  speechRate,
  preferredCategories,
  initialWordId,
  onClearInitialWord,
  onDataUpdated,
  onNavigateToQuiz,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    if (preferredCategories && preferredCategories.length > 0 && preferredCategories.length < 5) {
      return preferredCategories.length === 1 ? preferredCategories[0] : 'preferred';
    }
    return 'all';
  });
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('learning');
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState<boolean>(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Close status dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setIsStatusMenuOpen(false);
      }
    };
    if (isStatusMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isStatusMenuOpen]);

  // Touch gesture state for swipe support (no gesture library dependency)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isSwipingRef = useRef(false);

  // Reset drag offset when changing cards
  useEffect(() => {
    setDragOffset({ x: 0, y: 0 });
    setIsDragging(false);
  }, [currentIndex]);

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

  // Compute word pool snapshot for active category & status filter
  const computeWordPool = useCallback(
    (cat: string, statusFilter: string, pMap: Map<string, UserWordProgress>): WordItem[] => {
      let pool: WordItem[];
      if (statusFilter === 'learning') {
        pool = getDueWords(words, pMap);
      } else if (statusFilter === 'starred') {
        pool = words.filter((w) => pMap.get(w.id)?.isBookmarked);
      } else if (statusFilter === 'mastered') {
        pool = words.filter((w) => pMap.get(w.id)?.status === 'mastered');
      } else if (statusFilter === 'new') {
        pool = words.filter((w) => {
          const prog = pMap.get(w.id);
          return !prog || prog.status === 'new';
        });
      } else if (statusFilter === 'custom') {
        pool = words.filter((w) => w.isCustom);
      } else {
        pool = words;
      }

      if (cat === 'preferred' && preferredCategories && preferredCategories.length > 0) {
        return pool.filter((w) => preferredCategories.includes(w.category));
      }
      if (cat !== 'all' && cat !== 'preferred') {
        return pool.filter((w) => w.category === cat);
      }
      return pool;
    },
    [words, preferredCategories]
  );

  // Snapshot word list: immune to background progressMap updates during active study
  const [cardPool, setCardPool] = useState<WordItem[]>(() =>
    computeWordPool(selectedCategory, selectedStatusFilter, progressMap)
  );

  // Re-snapshot pool only when category, status filter, or words change
  useEffect(() => {
    setCardPool(computeWordPool(selectedCategory, selectedStatusFilter, progressMap));
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [selectedCategory, selectedStatusFilter, computeWordPool]);

  // Navigate to specific word requested from other views (e.g. WordListView / Quiz)
  useEffect(() => {
    if (!initialWordId) return;
    const targetWord = words.find((w) => w.id === initialWordId);
    if (targetWord) {
      setSelectedCategory('all');
      setSelectedStatusFilter('all');
      const allPool = words;
      setCardPool(allPool);
      const targetIndex = allPool.findIndex((w) => w.id === initialWordId);
      setCurrentIndex(targetIndex >= 0 ? targetIndex : 0);
      setIsFlipped(false);
      onClearInitialWord?.();
    }
  }, [initialWordId, words, onClearInitialWord]);

  const filteredWords = cardPool;

  // Ensure currentIndex stays within bounds
  useEffect(() => {
    if (currentIndex >= filteredWords.length) {
      setCurrentIndex(0);
    }
    setIsFlipped(false);
  }, [filteredWords.length]);

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
      // If flipping to the back (revealing definition), increment daily study progress
      if (next && currentWord) {
        incrementDailyWordsReviewed().then(() => {
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
    const isCorrect = status === 'mastered';
    await recordWordReview(currentWord, isCorrect);
    setActionFeedback(status === 'mastered' ? 'Mastered! Scheduled ahead ✨' : 'Reviewing tomorrow 📖');
    setTimeout(() => setActionFeedback(null), 1500);
    onDataUpdated();
    // Auto advance to next card after a brief moment
    setTimeout(() => {
      handleNext();
    }, 350);
  };

  // Touch event handlers for swipe gesture support (pure touch events, no external library)
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
    isSwipingRef.current = false;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartRef.current || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;

    // Movement threshold to distinguish tap from intentional gesture
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      isSwipingRef.current = true;
    }

    if (Math.abs(dx) >= Math.abs(dy)) {
      // Horizontal dominance: card follows finger horizontally with slight rotation
      setDragOffset({ x: dx, y: dy * 0.15 });
    } else {
      // Vertical dominance: subtle vertical nudge for flip gesture
      setDragOffset({ x: dx * 0.15, y: dy * 0.45 });
    }
  };

  const handleTouchEnd = () => {
    if (!touchStartRef.current) {
      setIsDragging(false);
      return;
    }

    const dx = dragOffset.x;
    const dy = dragOffset.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const THRESHOLD_X = 80; // Distance threshold for Mastered / Learning swipe (~80px)
    const THRESHOLD_Y = 55; // Distance threshold for Flip swipe

    setIsDragging(false);

    if (absX >= THRESHOLD_X && absX > absY) {
      if (dx > 0) {
        // Swipe right: Equivalent to tapping "Mastered"
        setDragOffset({ x: 360, y: dy });
        setTimeout(() => {
          handleMarkStatus('mastered');
        }, 160);
      } else {
        // Swipe left: Equivalent to tapping "Learning"
        setDragOffset({ x: -360, y: dy });
        setTimeout(() => {
          handleMarkStatus('learning');
        }, 160);
      }
    } else if (absY >= THRESHOLD_Y && absY > absX) {
      // Swipe up or down: Equivalent to flip action
      setDragOffset({ x: 0, y: 0 });
      handleFlipCard();
    } else {
      // Snap back if distance threshold was not reached
      setDragOffset({ x: 0, y: 0 });
    }

    // Preserve isSwipingRef briefly to suppress the synthesized click event
    setTimeout(() => {
      touchStartRef.current = null;
      isSwipingRef.current = false;
    }, 120);
  };

  const handleTouchCancel = () => {
    touchStartRef.current = null;
    isSwipingRef.current = false;
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
  };

  const handleClickCard = () => {
    // Suppress tap-flip if user just performed a drag gesture
    if (isSwipingRef.current) return;
    handleFlipCard();
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
      {/* Consolidated Filter Row: Category tabs + Status dropdown */}
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-black/[0.08] pb-2 dark:border-white/[0.08]">
        <div className="flex items-center gap-3.5 overflow-x-auto pb-0.5 scrollbar-none mask-edge-fade min-w-0 flex-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                setCurrentIndex(0);
              }}
              className={`pb-0.5 text-xs font-medium capitalize whitespace-nowrap transition cursor-pointer shrink-0 ${
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

        {/* Compact Status Filter Dropdown */}
        <div className="relative shrink-0" ref={statusMenuRef}>
          <button
            id="status-filter-btn"
            type="button"
            onClick={() => setIsStatusMenuOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#1B1815] dark:text-[#F6F1E7] rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-[#FAF6EE] dark:bg-[#201D1A] hover:border-[#D98A93] transition-colors cursor-pointer"
            title="Filter by learning status"
            aria-haspopup="true"
            aria-expanded={isStatusMenuOpen}
          >
            <span>{STATUS_OPTIONS.find((o) => o.id === selectedStatusFilter)?.label || 'Status'}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-[#8C8272] transition-transform duration-150 ${isStatusMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isStatusMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 z-30 min-w-[130px] rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-[#FAF6EE] dark:bg-[#201D1A] py-1 shadow-lg">
              {STATUS_OPTIONS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    setSelectedStatusFilter(f.id);
                    setCurrentIndex(0);
                    setIsStatusMenuOpen(false);
                  }}
                  className={`w-full px-3 py-1.5 text-left text-xs transition-colors cursor-pointer flex items-center justify-between ${
                    selectedStatusFilter === f.id
                      ? 'text-[#D98A93] font-medium'
                      : 'text-[#1B1815] dark:text-[#F6F1E7] hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
                  }`}
                >
                  <span>{f.label}</span>
                  {selectedStatusFilter === f.id && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D98A93]" />
                  )}
                </button>
              ))}
            </div>
          )}
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
            {/* Progress bar with inline position */}
            <div className="mb-3 flex items-center gap-2.5">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-black/[0.05] dark:bg-white/[0.05]">
                <div
                  className="h-full bg-[#D98A93] transition-all duration-300"
                  style={{
                    width: `${((currentIndex + 1) / filteredWords.length) * 100}%`,
                  }}
                />
              </div>
              <span className="text-[11px] font-mono text-[#8C8272] shrink-0">
                {currentIndex + 1}/{filteredWords.length}
              </span>
            </div>

            {/* Interactive 3D Flip Card Container with Swipe Gestures */}
            <div
              className="perspective-1000 relative mx-auto h-[350px] w-full cursor-pointer select-none touch-none"
              onClick={handleClickCard}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchCancel}
              id="flashcard-container"
            >
              {/* Drag Motion Wrapper: card follows finger horizontally with slight rotation & snap-back */}
              <div
                className="relative h-full w-full transform-style-preserve-3d"
                style={{
                  transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0) rotate(${dragOffset.x * 0.045}deg)`,
                  transition: isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)',
                }}
              >
                {/* Card Inner */}
                <div
                  className={`relative h-full w-full rounded-2xl transition-transform duration-500 transform-style-preserve-3d border border-black/[0.08] dark:border-white/[0.08] ${
                    isFlipped ? 'rotate-y-180' : ''
                  }`}
                >
                  {/* FRONT FACE */}
                  <div className="backface-hidden absolute inset-0 flex flex-col justify-between rounded-2xl bg-[#FAF6EE] p-6 dark:bg-[#221E1B] overflow-hidden">
                    {/* Directional swipe color tint overlay (green-ish for right, warm for left) */}
                    <div
                      className="pointer-events-none absolute inset-0 transition-opacity duration-75"
                      style={{
                        backgroundColor:
                          dragOffset.x > 5
                            ? '#8FB996'
                            : dragOffset.x < -5
                            ? '#C9924A'
                            : 'transparent',
                        opacity: Math.min(Math.abs(dragOffset.x) / 80, 1) * 0.16,
                      }}
                    />

                    {/* Swipe directional cues */}
                    {dragOffset.x > 25 && (
                      <div
                        className="pointer-events-none absolute top-3 inset-x-0 flex justify-center items-center gap-1.5 text-xs font-medium text-[#8FB996] transition-opacity duration-150"
                        style={{ opacity: Math.min((dragOffset.x - 25) / 45, 1) }}
                      >
                        <CheckCircle className="w-3.5 h-3.5 text-[#8FB996]" />
                        <span>Mastered</span>
                      </div>
                    )}
                    {dragOffset.x < -25 && (
                      <div
                        className="pointer-events-none absolute top-3 inset-x-0 flex justify-center items-center gap-1.5 text-xs font-medium text-[#C9924A] transition-opacity duration-150"
                        style={{ opacity: Math.min((Math.abs(dragOffset.x) - 25) / 45, 1) }}
                      >
                        <HelpCircle className="w-3.5 h-3.5 text-[#C9924A]" />
                        <span>Learning</span>
                      </div>
                    )}
                    {Math.abs(dragOffset.y) > 25 && Math.abs(dragOffset.y) > Math.abs(dragOffset.x) && (
                      <div
                        className="pointer-events-none absolute bottom-11 inset-x-0 flex justify-center items-center gap-1.5 text-xs font-medium text-[#D98A93] transition-opacity duration-150"
                        style={{ opacity: Math.min((Math.abs(dragOffset.y) - 25) / 30, 1) }}
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-[#D98A93]" />
                        <span>Flip to meaning</span>
                      </div>
                    )}

                    {/* Card Header Top */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs italic text-[#8C8272]">
                        {currentWord.category}
                      </span>
                      {currentWord.isCustom && (
                        <span className="rounded bg-[#D98A93]/15 px-1.5 py-0.5 text-[9px] font-medium tracking-wide uppercase text-[#D98A93]">
                          Custom
                        </span>
                      )}
                    </div>

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
                    <div className="mt-2">
                      <span className="font-mono-ipa text-sm text-[#8C8272]">
                        {currentWord.phonetic}
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

                  {/* Card Footer: Review status */}
                  <div className="flex items-center justify-end text-[11px] text-[#8C8272] border-t border-black/[0.08] dark:border-white/[0.08] pt-3">
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
                <div className="backface-hidden rotate-y-180 absolute inset-0 flex flex-col justify-between rounded-2xl bg-[#FAF6EE] p-6 dark:bg-[#221E1B] overflow-hidden">
                  {/* Directional swipe color tint overlay (green-ish for right, warm for left) */}
                  <div
                    className="pointer-events-none absolute inset-0 transition-opacity duration-75"
                    style={{
                      backgroundColor:
                        dragOffset.x > 5
                          ? '#8FB996'
                          : dragOffset.x < -5
                          ? '#C9924A'
                          : 'transparent',
                      opacity: Math.min(Math.abs(dragOffset.x) / 80, 1) * 0.16,
                    }}
                  />

                  {/* Swipe directional cues */}
                  {dragOffset.x > 25 && (
                    <div
                      className="pointer-events-none absolute top-3 inset-x-0 flex justify-center items-center gap-1.5 text-xs font-medium text-[#8FB996] transition-opacity duration-150"
                      style={{ opacity: Math.min((dragOffset.x - 25) / 45, 1) }}
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-[#8FB996]" />
                      <span>Mastered</span>
                    </div>
                  )}
                  {dragOffset.x < -25 && (
                    <div
                      className="pointer-events-none absolute top-3 inset-x-0 flex justify-center items-center gap-1.5 text-xs font-medium text-[#C9924A] transition-opacity duration-150"
                      style={{ opacity: Math.min((Math.abs(dragOffset.x) - 25) / 45, 1) }}
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-[#C9924A]" />
                      <span>Learning</span>
                    </div>
                  )}
                  {Math.abs(dragOffset.y) > 25 && Math.abs(dragOffset.y) > Math.abs(dragOffset.x) && (
                    <div
                      className="pointer-events-none absolute bottom-11 inset-x-0 flex justify-center items-center gap-1.5 text-xs font-medium text-[#D98A93] transition-opacity duration-150"
                      style={{ opacity: Math.min((Math.abs(dragOffset.y) - 25) / 30, 1) }}
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[#D98A93]" />
                      <span>Flip to word</span>
                    </div>
                  )}

                  {/* Card Header Top */}
                  <div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-fraunces text-2xl font-medium text-[#1B1815] dark:text-[#F6F1E7]">
                            {currentWord.word}
                          </span>
                          {currentWord.isCustom && (
                            <span className="rounded bg-[#D98A93]/15 px-1.5 py-0.5 text-[9px] font-medium tracking-wide uppercase text-[#D98A93]">
                              Custom
                            </span>
                          )}
                        </div>
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
                  <div className="my-auto space-y-2.5 overflow-y-auto max-h-[220px] pr-1 scrollbar-none">
                    <div>
                      <p className="font-fraunces text-base font-normal leading-[1.5] text-[#1B1815]/90 dark:text-[#F6F1E7]/90">
                        {currentWord.definition}
                      </p>
                    </div>

                    {/* Synonyms & Antonyms: plain comma-separated text under definition */}
                    {currentWord.synonyms && currentWord.synonyms.length > 0 && (
                      <p className="text-xs text-[#8C8272] leading-relaxed">
                        <span className="font-medium text-[#1B1815] dark:text-[#F6F1E7]">Synonyms: </span>
                        {currentWord.synonyms.join(', ')}
                      </p>
                    )}
                    {currentWord.antonyms && currentWord.antonyms.length > 0 && (
                      <p className="text-xs text-[#8C8272] leading-relaxed">
                        <span className="font-medium text-[#1B1815] dark:text-[#F6F1E7]">Antonyms: </span>
                        {currentWord.antonyms.join(', ')}
                      </p>
                    )}

                    <div>
                      <p className="text-xs italic leading-relaxed text-[#8C8272]">
                        "{currentWord.example}"
                      </p>
                      {currentWord.etymology && (
                        <p className="mt-1 text-[11px] italic text-[#8C8272]/90">
                          {currentWord.etymology}
                        </p>
                      )}
                    </div>

                    {/* Don't confuse with callout */}
                    {currentWord.confusedWith && currentWord.confusedWith.length > 0 && (
                      <div className="rounded-lg border border-[#C9924A]/25 bg-[#C9924A]/[0.06] p-2 text-xs">
                        <span className="font-medium text-[#C9924A]">Don't confuse with: </span>
                        {currentWord.confusedWith.map((c, i) => (
                          <span key={i} className="text-[#1B1815]/90 dark:text-[#F6F1E7]/90">
                            <span className="font-medium underline decoration-[#C9924A]/50">{c.word}</span> ({c.distinction})
                            {i < currentWord.confusedWith!.length - 1 ? '; ' : ''}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Context Tags */}
                    {currentWord.tags && currentWord.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {currentWord.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-md border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.03] dark:bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-[#8C8272]"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Small inline icon + muted-color text below the definition */}
                    <div className="flex items-center gap-1.5 text-xs text-[#8C8272] pt-0.5">
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
          </>
        )
      )}
    </div>
  );
};
