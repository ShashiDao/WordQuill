import React, { useState, useMemo } from 'react';
import {
  Search,
  Volume2,
  Bookmark,
  CheckCircle,
  HelpCircle,
  Circle,
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
} from 'lucide-react';
import type { WordItem, UserWordProgress, WordStatus } from '../types';
import { speakWord } from '../utils/speech';
import { setWordStatus, toggleWordBookmark } from '../db/operations';

interface WordListViewProps {
  words: WordItem[];
  progressMap: Map<string, UserWordProgress>;
  speechRate: number;
  preferredCategories?: string[];
  onDataUpdated: () => void;
  onSelectWordForFlashcards: (word: WordItem) => void;
}

export const WordListView: React.FC<WordListViewProps> = ({
  words,
  progressMap,
  speechRate,
  preferredCategories,
  onDataUpdated,
  onSelectWordForFlashcards,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(() => {
    if (preferredCategories && preferredCategories.length > 0 && preferredCategories.length < 5) {
      return preferredCategories.length === 1 ? preferredCategories[0] : 'preferred';
    }
    return 'all';
  });
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [expandedWordId, setExpandedWordId] = useState<string | null>(null);

  // Extract categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    words.forEach((w) => set.add(w.category));
    const allCats = Array.from(set);
    if (preferredCategories && preferredCategories.length > 0 && preferredCategories.length < allCats.length) {
      return ['preferred', 'all', ...allCats];
    }
    return ['all', ...allCats];
  }, [words, preferredCategories]);

  // Filter words
  const filteredWords = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return words.filter((w) => {
      // Category filter
      if (selectedCategory === 'preferred' && preferredCategories && preferredCategories.length > 0) {
        if (!preferredCategories.includes(w.category)) return false;
      } else if (selectedCategory !== 'all' && selectedCategory !== 'preferred' && w.category !== selectedCategory) {
        return false;
      }

      // Status filter
      const prog = progressMap.get(w.id);
      if (selectedStatus === 'starred' && !prog?.isBookmarked) return false;
      if (selectedStatus === 'learning' && prog?.status !== 'learning') return false;
      if (selectedStatus === 'mastered' && prog?.status !== 'mastered') return false;
      if (selectedStatus === 'new' && prog?.status && prog.status !== 'new') return false;

      // Search query filter
      if (q) {
        const matchesWord = w.word.toLowerCase().includes(q);
        const matchesDef = w.definition.toLowerCase().includes(q);
        const matchesCat = w.category.toLowerCase().includes(q);
        if (!matchesWord && !matchesDef && !matchesCat) return false;
      }

      return true;
    });
  }, [words, progressMap, selectedCategory, selectedStatus, searchQuery]);

  const handlePronounce = (word: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    speakWord(word, speechRate);
  };

  const handleToggleBookmark = async (word: WordItem, e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleWordBookmark(word);
    onDataUpdated();
  };

  const handleSetStatus = async (
    word: WordItem,
    status: WordStatus,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    await setWordStatus(word, status);
    onDataUpdated();
  };

  const toggleExpand = (id: string) => {
    setExpandedWordId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="mx-auto max-w-2xl pb-24 pt-4 px-4">
      {/* Search Bar */}
      <div className="relative mb-3">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8C8272]" />
        <input
          id="search-words-input"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search words, definitions, or categories..."
          className="w-full rounded-xl border border-black/[0.08] bg-[#FAF6EE] py-2.5 pl-10 pr-9 text-xs text-[#1B1815] placeholder:text-[#8C8272] focus:border-[#D98A93] focus:outline-none dark:border-white/[0.08] dark:bg-[#221E1B] dark:text-[#F6F1E7] dark:placeholder:text-[#8C8272]"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

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

      {/* Status Filter Bar & Total Count */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-[#8C8272]">
        <div className="flex items-center gap-3">
          {[
            { id: 'all', label: 'All' },
            { id: 'new', label: 'New' },
            { id: 'learning', label: 'Learning' },
            { id: 'mastered', label: 'Mastered' },
            { id: 'starred', label: 'Starred' },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedStatus(s.id)}
              className={`pb-0.5 font-medium transition cursor-pointer ${
                selectedStatus === s.id
                  ? 'text-[#1B1815] dark:text-[#F6F1E7] border-b border-[#D98A93]'
                  : 'text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <span className="text-[#8C8272] font-medium text-[11px]">
          Showing {filteredWords.length} words
        </span>
      </div>

      {/* Words List */}
      {filteredWords.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/[0.1] bg-[#FAF6EE] p-12 text-center dark:border-white/[0.1] dark:bg-[#221E1B]">
          <p className="text-xs text-[#8C8272]">
            No words matched your criteria.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setSelectedStatus('all');
            }}
            className="mt-3 text-xs font-medium text-[#D98A93] hover:underline cursor-pointer"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredWords.map((word) => {
            const prog = progressMap.get(word.id);
            const isExpanded = expandedWordId === word.id;
            const currentStatus = prog?.status || 'new';

            return (
              <div
                key={word.id}
                id={`word-card-${word.id}`}
                onClick={() => toggleExpand(word.id)}
                className="group rounded-xl border border-black/[0.08] bg-[#FAF6EE] p-3.5 transition hover:border-[#D98A93]/40 dark:border-white/[0.08] dark:bg-[#221E1B] cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-fraunces text-base font-medium text-[#1B1815] dark:text-[#F6F1E7]">
                        {word.word}
                      </h4>
                      <span className="font-mono-ipa text-xs text-[#8C8272]">
                        {word.phonetic}
                      </span>
                      <span className="text-xs italic text-[#8C8272]">
                        · {word.category}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#8C8272] line-clamp-1">
                      {word.definition}
                    </p>
                  </div>

                  {/* Actions: Pronounce, Star, Expand */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={(e) => handlePronounce(word.word, e)}
                      className="p-1 text-[#8C8272] hover:text-[#D98A93] transition-colors cursor-pointer"
                      title="Pronounce"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={(e) => handleToggleBookmark(word, e)}
                      className="p-1 text-[#8C8272] hover:text-[#C9924A] transition-colors cursor-pointer"
                      title="Bookmark"
                    >
                      <Bookmark
                        className={`w-3.5 h-3.5 ${
                          prog?.isBookmarked ? 'fill-[#C9924A] text-[#C9924A]' : 'text-[#8C8272]'
                        }`}
                      />
                    </button>

                    <div className="text-[#8C8272] p-1">
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-black/[0.08] dark:border-white/[0.08] space-y-2.5">
                    <div>
                      <p className="font-fraunces text-sm font-normal leading-relaxed text-[#1B1815]/90 dark:text-[#F6F1E7]/90">
                        {word.definition}
                      </p>
                    </div>

                    <p className="text-xs italic text-[#8C8272]">
                      "{word.example}"
                    </p>

                    {/* Status Selection and Practice Link */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-[#8C8272]">Status:</span>
                        <button
                          onClick={(e) => handleSetStatus(word, 'new', e)}
                          className={`transition cursor-pointer pb-0.5 ${
                            currentStatus === 'new'
                              ? 'text-[#1B1815] dark:text-[#F6F1E7] border-b border-[#D98A93] font-medium'
                              : 'text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7]'
                          }`}
                        >
                          New
                        </button>
                        <button
                          onClick={(e) => handleSetStatus(word, 'learning', e)}
                          className={`inline-flex items-center gap-1 transition cursor-pointer pb-0.5 ${
                            currentStatus === 'learning'
                              ? 'text-[#C9924A] border-b border-[#C9924A] font-medium'
                              : 'text-[#8C8272] hover:text-[#C9924A]'
                          }`}
                        >
                          <HelpCircle className="w-3 h-3" />
                          <span>Learning</span>
                        </button>
                        <button
                          onClick={(e) => handleSetStatus(word, 'mastered', e)}
                          className={`inline-flex items-center gap-1 transition cursor-pointer pb-0.5 ${
                            currentStatus === 'mastered'
                              ? 'text-[#8FB996] border-b border-[#8FB996] font-medium'
                              : 'text-[#8C8272] hover:text-[#8FB996]'
                          }`}
                        >
                          <CheckCircle className="w-3 h-3" />
                          <span>Mastered</span>
                        </button>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectWordForFlashcards(word);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#D98A93] hover:underline cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3 text-[#D98A93]" />
                        <span>Practice Card</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
