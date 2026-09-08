import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  Plus,
  Trash2,
  Tag,
} from 'lucide-react';
import type { WordItem, UserWordProgress, WordStatus } from '../types';
import { speakWord } from '../utils/speech';
import {
  setWordStatus,
  toggleWordBookmark,
  getLeeches,
  addCustomWord,
  deleteCustomWord,
} from '../db/operations';

const STATUS_OPTIONS: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'learning', label: 'Learning' },
  { id: 'mastered', label: 'Mastered' },
  { id: 'starred', label: 'Starred' },
  { id: 'leeches', label: 'Leeches' },
  { id: 'custom', label: 'Custom' },
];

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
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState<boolean>(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const [expandedWordId, setExpandedWordId] = useState<string | null>(null);

  // Custom Word Creation State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [newWord, setNewWord] = useState({
    word: '',
    phonetic: '',
    definition: '',
    example: '',
    category: 'advanced',
    synonyms: '',
    antonyms: '',
    etymology: '',
    tags: '',
  });

  // Close status dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setIsStatusMenuOpen(false);
      }
    };
    if (isStatusMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isStatusMenuOpen]);

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

  // Extract tags (collections)
  const tags = useMemo(() => {
    const set = new Set<string>();
    words.forEach((w) => {
      if (w.tags) {
        w.tags.forEach((t) => set.add(t));
      }
    });
    return ['all', ...Array.from(set)];
  }, [words]);

  const formatTagLabel = (tag: string): string => {
    if (tag === 'all') return 'All';
    if (tag.toUpperCase() === 'GRE') return 'GRE';
    if (tag.toUpperCase() === 'SAT') return 'SAT';
    return tag
      .split(/[-_]/)
      .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : ''))
      .join(' ');
  };

  // Filter words
  const filteredWords = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const sourceWords = selectedStatus === 'leeches' ? getLeeches(words, progressMap) : words;

    return sourceWords.filter((w) => {
      // Category filter
      if (selectedCategory === 'preferred' && preferredCategories && preferredCategories.length > 0) {
        if (!preferredCategories.includes(w.category)) return false;
      } else if (selectedCategory !== 'all' && selectedCategory !== 'preferred' && w.category !== selectedCategory) {
        return false;
      }

      // Collection (Tag) filter
      if (selectedTag !== 'all') {
        if (!w.tags || !w.tags.includes(selectedTag)) return false;
      }

      // Status filter
      const prog = progressMap.get(w.id);
      if (selectedStatus === 'starred' && !prog?.isBookmarked) return false;
      if (selectedStatus === 'learning' && prog?.status !== 'learning') return false;
      if (selectedStatus === 'mastered' && prog?.status !== 'mastered') return false;
      if (selectedStatus === 'new' && prog?.status && prog.status !== 'new') return false;
      if (selectedStatus === 'custom' && !w.isCustom) return false;

      // Search query filter (matches word, definition, category, or tags)
      if (q) {
        const matchesWord = w.word.toLowerCase().includes(q);
        const matchesDef = w.definition.toLowerCase().includes(q);
        const matchesCat = w.category.toLowerCase().includes(q);
        const matchesTag = w.tags?.some((t) => t.toLowerCase().includes(q));
        if (!matchesWord && !matchesDef && !matchesCat && !matchesTag) return false;
      }

      return true;
    });
  }, [words, progressMap, selectedCategory, selectedTag, selectedStatus, searchQuery, preferredCategories]);

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

  const handleDeleteCustom = async (id: string, wordText: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Delete custom word "${wordText}"?`)) {
      await deleteCustomWord(id);
      onDataUpdated();
    }
  };

  const handleCreateCustomWord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.word.trim() || !newWord.definition.trim() || !newWord.example.trim()) {
      setAddError('Word, definition, and example are required.');
      return;
    }
    setAddError(null);
    try {
      await addCustomWord({
        word: newWord.word.trim(),
        phonetic: newWord.phonetic.trim() || undefined,
        definition: newWord.definition.trim(),
        example: newWord.example.trim(),
        category: newWord.category,
        synonyms: newWord.synonyms ? newWord.synonyms.split(',').map((s) => s.trim()).filter(Boolean) : [],
        antonyms: newWord.antonyms ? newWord.antonyms.split(',').map((s) => s.trim()).filter(Boolean) : [],
        etymology: newWord.etymology.trim() || undefined,
        tags: newWord.tags ? newWord.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean) : ['custom'],
      });
      setNewWord({
        word: '',
        phonetic: '',
        definition: '',
        example: '',
        category: 'advanced',
        synonyms: '',
        antonyms: '',
        etymology: '',
        tags: '',
      });
      setShowAddModal(false);
      onDataUpdated();
    } catch (err) {
      setAddError('Failed to save word. Please try again.');
    }
  };

  return (
    <div className="mx-auto max-w-2xl pb-24 pt-4 px-4">
      {/* Search Bar & Add Custom Word Button */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8C8272]" />
          <input
            id="search-words-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search words, definitions, categories, or #tags..."
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
        <button
          id="btn-add-custom-word"
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-[#FAF6EE] dark:bg-[#221E1B] hover:border-[#D98A93] text-xs font-medium text-[#1B1815] dark:text-[#F6F1E7] transition-colors cursor-pointer shrink-0"
          title="Add your own custom vocabulary word"
        >
          <Plus className="w-3.5 h-3.5 text-[#D98A93]" />
          <span>Add Word</span>
        </button>
      </div>

      {/* Consolidated Filter Row: Category tabs + Word Count & Status dropdown */}
      <div className="mb-2.5 flex items-center justify-between gap-3 border-b border-black/[0.08] pb-2 dark:border-white/[0.08]">
        {/* Category Horizontal Scrolling Tabs */}
        <div className="flex items-center gap-3.5 overflow-x-auto pb-0.5 scrollbar-none mask-edge-fade min-w-0 flex-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
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

        {/* Word Count and Compact Status Filter Dropdown */}
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-[#8C8272] font-medium text-[11px] whitespace-nowrap">
            Showing {filteredWords.length} words
          </span>

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
              <span>{STATUS_OPTIONS.find((o) => o.id === selectedStatus)?.label || 'Status'}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-[#8C8272] transition-transform duration-150 ${isStatusMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isStatusMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-30 min-w-[130px] rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-[#FAF6EE] dark:bg-[#201D1A] py-1 shadow-lg">
                {STATUS_OPTIONS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setSelectedStatus(f.id);
                      setIsStatusMenuOpen(false);
                    }}
                    className={`w-full px-3 py-1.5 text-left text-xs transition-colors cursor-pointer flex items-center justify-between ${
                      selectedStatus === f.id
                        ? 'text-[#D98A93] font-medium'
                        : 'text-[#1B1815] dark:text-[#F6F1E7] hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <span>{f.label}</span>
                    {selectedStatus === f.id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#D98A93]" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Collections Chip Row */}
      <div className="mb-4 flex items-center gap-3.5 overflow-x-auto pb-2 border-b border-black/[0.08] dark:border-white/[0.08] scrollbar-none mask-edge-fade min-w-0">
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => setSelectedTag(tag)}
            className={`pb-0.5 text-xs font-medium whitespace-nowrap transition cursor-pointer shrink-0 ${
              selectedTag === tag
                ? 'text-[#1B1815] dark:text-[#F6F1E7] border-b border-[#D98A93]'
                : 'text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7]'
            }`}
          >
            {formatTagLabel(tag)}
          </button>
        ))}
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
              setSelectedTag('all');
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
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-fraunces text-base font-medium text-[#1B1815] dark:text-[#F6F1E7]">
                        {word.word}
                      </h4>
                      {word.isCustom && (
                        <span className="rounded bg-[#D98A93]/15 px-1.5 py-0.5 text-[9px] font-medium tracking-wide uppercase text-[#D98A93]">
                          Custom
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 min-w-0">
                      <span className="font-mono-ipa text-xs text-[#8C8272] whitespace-nowrap shrink-0">
                        {word.phonetic}
                      </span>
                      <span className="text-xs italic text-[#8C8272] whitespace-nowrap overflow-hidden text-ellipsis min-w-0">
                        · {word.category}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#8C8272] line-clamp-1">
                      {word.definition}
                    </p>
                  </div>

                  {/* Actions: Pronounce, Star, Delete (if custom), Expand */}
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

                    {word.isCustom && (
                      <button
                        onClick={(e) => handleDeleteCustom(word.id, word.word, e)}
                        className="p-1 text-[#8C8272] hover:text-[#D98A93] transition-colors cursor-pointer"
                        title="Delete custom word"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

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

                    {/* Synonyms & Antonyms */}
                    {word.synonyms && word.synonyms.length > 0 && (
                      <p className="text-xs text-[#8C8272] leading-relaxed">
                        <span className="font-medium text-[#1B1815] dark:text-[#F6F1E7]">Synonyms: </span>
                        {word.synonyms.join(', ')}
                      </p>
                    )}
                    {word.antonyms && word.antonyms.length > 0 && (
                      <p className="text-xs text-[#8C8272] leading-relaxed">
                        <span className="font-medium text-[#1B1815] dark:text-[#F6F1E7]">Antonyms: </span>
                        {word.antonyms.join(', ')}
                      </p>
                    )}

                    <div>
                      <p className="text-xs italic text-[#8C8272]">
                        "{word.example}"
                      </p>
                      {word.etymology && (
                        <p className="mt-1 text-[11px] italic text-[#8C8272]/90">
                          {word.etymology}
                        </p>
                      )}
                    </div>

                    {/* Don't confuse with callout */}
                    {word.confusedWith && word.confusedWith.length > 0 && (
                      <div className="rounded-lg border border-[#C9924A]/25 bg-[#C9924A]/[0.06] p-2.5 text-xs">
                        <span className="font-medium text-[#C9924A]">Don't confuse with: </span>
                        {word.confusedWith.map((c, i) => (
                          <span key={i} className="text-[#1B1815]/90 dark:text-[#F6F1E7]/90">
                            <span className="font-medium underline decoration-[#C9924A]/50">{c.word}</span> ({c.distinction})
                            {i < word.confusedWith!.length - 1 ? '; ' : ''}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Tags */}
                    {word.tags && word.tags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 pt-1">
                        <Tag className="w-3 h-3 text-[#8C8272]" />
                        {word.tags.map((tag) => (
                          <button
                            key={tag}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSearchQuery(tag);
                            }}
                            className="rounded-md border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.03] dark:bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-[#8C8272] hover:text-[#D98A93] hover:border-[#D98A93]/40 transition-colors cursor-pointer"
                            title={`Filter by #${tag}`}
                          >
                            #{tag}
                          </button>
                        ))}
                      </div>
                    )}

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

      {/* Add Custom Word Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-[#FAF6EE] dark:bg-[#201D1A] p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.08] dark:border-white/[0.08]">
              <h3 className="font-fraunces text-lg font-medium text-[#1B1815] dark:text-[#F6F1E7]">
                Add Custom Word
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {addError && (
              <div className="mt-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500">
                {addError}
              </div>
            )}

            <form onSubmit={handleCreateCustomWord} className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-[#8C8272] uppercase tracking-wider mb-1">
                  Word *
                </label>
                <input
                  type="text"
                  required
                  value={newWord.word}
                  onChange={(e) => setNewWord({ ...newWord, word: e.target.value })}
                  placeholder="e.g., Solipsism"
                  className="w-full rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#181513] px-3 py-2 text-xs text-[#1B1815] dark:text-[#F6F1E7] focus:border-[#D98A93] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#8C8272] uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={newWord.category}
                    onChange={(e) => setNewWord({ ...newWord, category: e.target.value })}
                    className="w-full rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#181513] px-3 py-2 text-xs text-[#1B1815] dark:text-[#F6F1E7] focus:border-[#D98A93] focus:outline-none"
                  >
                    <option value="advanced">Advanced</option>
                    <option value="literary">Literary</option>
                    <option value="academic">Academic</option>
                    <option value="eloquence">Eloquence</option>
                    <option value="everyday">Everyday</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#8C8272] uppercase tracking-wider mb-1">
                    Phonetic (IPA)
                  </label>
                  <input
                    type="text"
                    value={newWord.phonetic}
                    onChange={(e) => setNewWord({ ...newWord, phonetic: e.target.value })}
                    placeholder="e.g., /ˈsɒl.ɪp.sɪ.zəm/"
                    className="w-full rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#181513] px-3 py-2 text-xs text-[#1B1815] dark:text-[#F6F1E7] focus:border-[#D98A93] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#8C8272] uppercase tracking-wider mb-1">
                  Definition *
                </label>
                <textarea
                  required
                  rows={2}
                  value={newWord.definition}
                  onChange={(e) => setNewWord({ ...newWord, definition: e.target.value })}
                  placeholder="The theory that only oneself exists..."
                  className="w-full rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#181513] px-3 py-2 text-xs text-[#1B1815] dark:text-[#F6F1E7] focus:border-[#D98A93] focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#8C8272] uppercase tracking-wider mb-1">
                  Example Sentence *
                </label>
                <textarea
                  required
                  rows={2}
                  value={newWord.example}
                  onChange={(e) => setNewWord({ ...newWord, example: e.target.value })}
                  placeholder="His philosophy verged on an unyielding solipsism..."
                  className="w-full rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#181513] px-3 py-2 text-xs text-[#1B1815] dark:text-[#F6F1E7] focus:border-[#D98A93] focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#8C8272] uppercase tracking-wider mb-1">
                    Synonyms (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={newWord.synonyms}
                    onChange={(e) => setNewWord({ ...newWord, synonyms: e.target.value })}
                    placeholder="egocentricity, egoism"
                    className="w-full rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#181513] px-3 py-2 text-xs text-[#1B1815] dark:text-[#F6F1E7] focus:border-[#D98A93] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#8C8272] uppercase tracking-wider mb-1">
                    Antonyms (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={newWord.antonyms}
                    onChange={(e) => setNewWord({ ...newWord, antonyms: e.target.value })}
                    placeholder="altruism, empathy"
                    className="w-full rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#181513] px-3 py-2 text-xs text-[#1B1815] dark:text-[#F6F1E7] focus:border-[#D98A93] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#8C8272] uppercase tracking-wider mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={newWord.tags}
                  onChange={(e) => setNewWord({ ...newWord, tags: e.target.value })}
                  placeholder="GRE, philosophy, academic"
                  className="w-full rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#181513] px-3 py-2 text-xs text-[#1B1815] dark:text-[#F6F1E7] focus:border-[#D98A93] focus:outline-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-black/[0.08] dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#D98A93] text-xs font-medium text-[#1B1815] hover:opacity-90 active:scale-95 cursor-pointer transition"
                >
                  Save Word
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
