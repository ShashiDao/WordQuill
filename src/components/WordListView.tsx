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
  onDataUpdated: () => void;
  onSelectWordForFlashcards: (word: WordItem) => void;
}

export const WordListView: React.FC<WordListViewProps> = ({
  words,
  progressMap,
  speechRate,
  onDataUpdated,
  onSelectWordForFlashcards,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [expandedWordId, setExpandedWordId] = useState<string | null>(null);

  // Extract categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    words.forEach((w) => set.add(w.category));
    return ['all', ...Array.from(set)];
  }, [words]);

  // Filter words
  const filteredWords = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return words.filter((w) => {
      // Category filter
      if (selectedCategory !== 'all' && w.category !== selectedCategory) {
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
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          id="search-words-input"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search words, definitions, or categories..."
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Category Horizontal Scrolling Chips */}
      <div className="mb-3 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
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

      {/* Status Filter Bar & Total Count */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 text-xs dark:border-slate-800">
        <div className="flex items-center gap-1">
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
              className={`rounded px-2 py-0.5 font-medium transition cursor-pointer ${
                selectedStatus === s.id
                  ? 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 font-semibold'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <span className="text-slate-400 font-medium text-[11px]">
          Showing {filteredWords.length} words
        </span>
      </div>

      {/* Words List */}
      {filteredWords.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No words matched your criteria.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setSelectedStatus('all');
            }}
            className="mt-3 text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400 cursor-pointer"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredWords.map((word) => {
            const prog = progressMap.get(word.id);
            const isExpanded = expandedWordId === word.id;
            const currentStatus = prog?.status || 'new';

            return (
              <div
                key={word.id}
                id={`word-card-${word.id}`}
                onClick={() => toggleExpand(word.id)}
                className="group rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold text-slate-900 dark:text-white">
                        {word.word}
                      </h4>
                      <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400">
                        {word.phonetic}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium capitalize text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {word.category}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 line-clamp-1">
                      {word.definition}
                    </p>
                  </div>

                  {/* Actions: Pronounce, Star, Status, Expand */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => handlePronounce(word.word, e)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800 dark:hover:text-indigo-400 cursor-pointer"
                      title="Pronounce"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={(e) => handleToggleBookmark(word, e)}
                      className={`rounded-lg p-1.5 transition hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer ${
                        prog?.isBookmarked
                          ? 'text-amber-500 fill-amber-500'
                          : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                      }`}
                      title="Bookmark"
                    >
                      <Bookmark
                        className={`w-4 h-4 ${
                          prog?.isBookmarked ? 'fill-current' : ''
                        }`}
                      />
                    </button>

                    <div className="text-slate-400 p-1">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Full Definition
                      </span>
                      <p className="mt-0.5 text-sm font-medium text-slate-800 dark:text-slate-200">
                        {word.definition}
                      </p>
                    </div>

                    <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        Example Sentence
                      </span>
                      <p className="mt-0.5 text-xs italic text-slate-600 dark:text-slate-300">
                        "{word.example}"
                      </p>
                    </div>

                    {/* Status Toggle Buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-400 mr-1">Status:</span>
                        <button
                          onClick={(e) => handleSetStatus(word, 'new', e)}
                          className={`rounded-md px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                            currentStatus === 'new'
                              ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-white font-semibold'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          New
                        </button>
                        <button
                          onClick={(e) => handleSetStatus(word, 'learning', e)}
                          className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                            currentStatus === 'learning'
                              ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300 font-semibold'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          <HelpCircle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                          Learning
                        </button>
                        <button
                          onClick={(e) => handleSetStatus(word, 'mastered', e)}
                          className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                            currentStatus === 'mastered'
                              ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-300 font-semibold'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          <CheckCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          Mastered
                        </button>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectWordForFlashcards(word);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" />
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
