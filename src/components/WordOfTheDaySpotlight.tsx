import React, { useState, useEffect } from 'react';
import { Volume2, X, Sparkles, BookOpen } from 'lucide-react';
import type { WordItem } from '../types';
import { speakWord } from '../utils/speech';

interface WordOfTheDaySpotlightProps {
  word: WordItem;
  speechRate?: number;
  onStudy: (word: WordItem) => void;
  onDismiss: () => void;
}

export const WordOfTheDaySpotlight: React.FC<WordOfTheDaySpotlightProps> = ({
  word,
  speechRate = 0.85,
  onStudy,
  onDismiss,
}) => {
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  const handleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSpeaking(true);
    speakWord(
      word.word,
      speechRate,
      () => setIsSpeaking(true),
      () => setIsSpeaking(false)
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-xs transition-opacity duration-200"
      onClick={onDismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wotd-title"
    >
      <div
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-black/[0.08] bg-[#FAF6EE] p-6 sm:p-8 text-[#1B1815] shadow-2xl dark:border-white/[0.08] dark:bg-[#201D1A] dark:text-[#F6F1E7] transition-all duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium tracking-wide uppercase bg-[#D98A93]/15 text-[#C46873] dark:text-[#E5A3AC]">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Word of the Day</span>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg p-1.5 text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7] transition cursor-pointer"
            aria-label="Close spotlight"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Word Title & Category */}
        <div className="mt-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-wider text-[#8C8272]">
              {word.category}
            </span>
            {word.isCustom && (
              <span className="rounded bg-[#D98A93]/15 px-1.5 py-0.5 text-[9px] font-medium tracking-wide uppercase text-[#D98A93]">
                Custom
              </span>
            )}
          </div>

          <h2
            id="wotd-title"
            className="font-fraunces text-4xl sm:text-5xl font-medium tracking-tight text-[#1B1815] dark:text-[#F6F1E7] my-2"
          >
            {word.word}
          </h2>

          {/* Phonetic & Listen button */}
          <div className="flex items-center gap-3 mt-1 mb-5">
            <span className="font-mono text-sm text-[#8C8272] tracking-wide">
              {word.phonetic}
            </span>
            <button
              type="button"
              onClick={handleSpeak}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-black/[0.08] dark:border-white/[0.08] hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer text-[#1B1815] dark:text-[#F6F1E7]"
              aria-label={`Listen to pronunciation of ${word.word}`}
            >
              <Volume2
                className={`h-3.5 w-3.5 ${
                  isSpeaking ? 'text-[#D98A93] animate-pulse' : 'text-[#8C8272]'
                }`}
              />
              <span>{isSpeaking ? 'Playing...' : 'Listen'}</span>
            </button>
          </div>
        </div>

        {/* Definition */}
        <div className="border-t border-black/[0.08] dark:border-white/[0.08] pt-4 mb-4">
          <p className="font-fraunces text-base sm:text-lg font-normal leading-relaxed text-[#1B1815]/90 dark:text-[#F6F1E7]/90">
            {word.definition}
          </p>
        </div>

        {/* Contextual Example */}
        {word.example && (
          <div className="mb-4 pl-3.5 border-l-2 border-[#D98A93]/50 py-1 bg-black/[0.02] dark:bg-white/[0.02] rounded-r-lg">
            <p className="text-xs sm:text-sm italic text-[#8C8272] leading-relaxed">
              "{word.example}"
            </p>
          </div>
        )}

        {/* Synonyms if available */}
        {word.synonyms && word.synonyms.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-6 text-xs text-[#8C8272]">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#8C8272]/80">
              Synonyms:
            </span>
            {word.synonyms.slice(0, 4).map((syn) => (
              <span
                key={syn}
                className="px-2 py-0.5 rounded-md bg-black/[0.04] dark:bg-white/[0.06] text-[#1B1815] dark:text-[#F6F1E7]"
              >
                {syn}
              </span>
            ))}
          </div>
        )}

        {/* Action CTAs */}
        <div className="mt-2 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => onStudy(word)}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#D98A93] hover:bg-[#CF7B85] text-white font-medium text-sm transition cursor-pointer shadow-sm active:scale-[0.99]"
          >
            <BookOpen className="h-4 w-4" />
            <span>Study this word</span>
          </button>

          <button
            type="button"
            onClick={onDismiss}
            className="text-xs text-[#8C8272] hover:text-[#1B1815] dark:hover:text-[#F6F1E7] transition cursor-pointer py-1.5 hover:underline underline-offset-4"
          >
            Skip to app
          </button>
        </div>
      </div>
    </div>
  );
};
