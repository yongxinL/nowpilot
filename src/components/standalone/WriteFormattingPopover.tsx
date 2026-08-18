import React, { useState, useMemo, useRef, useEffect } from 'react';
import { SearchOutlined, UpOutlined, DownOutlined } from '@ant-design/icons';

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
}

export const WRITE_STYLES = [
  'Formal',
  'Casual',
  'Professional',
  'Enthusiastic',
  'Informational',
  'Funny',
] as const;

export const WRITE_LENGTHS = ['Short', 'Medium', 'Long'] as const;

export const WRITE_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'zh-CN', name: 'Simplified Chinese', nativeName: '中文(简体)' },
  { code: 'zh-TW', name: 'Traditional Chinese', nativeName: '中文(繁體)' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
];

interface WriteFormattingPopoverProps {
  styleValue: string;
  onChangeStyle: (val: string) => void;
  lengthValue: string;
  onChangeLength: (val: string) => void;
  languageValue: string;
  onChangeLanguage: (val: string) => void;
}

export const WriteFormattingPopover: React.FC<WriteFormattingPopoverProps> = ({
  styleValue,
  onChangeStyle,
  lengthValue,
  onChangeLength,
  languageValue,
  onChangeLanguage,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [langSearch, setLangSearch] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        langMenuRef.current &&
        !langMenuRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setIsLangMenuOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const filteredLanguages = useMemo(() => {
    if (!langSearch.trim()) return WRITE_LANGUAGES;
    const query = langSearch.toLowerCase().trim();
    return WRITE_LANGUAGES.filter(
      (lang) =>
        lang.name.toLowerCase().includes(query) ||
        lang.nativeName.toLowerCase().includes(query) ||
        lang.code.toLowerCase().includes(query)
    );
  }, [langSearch]);

  const handleSelectLanguage = (langName: string) => {
    onChangeLanguage(langName);
    setIsLangMenuOpen(false);
  };

  const activeLanguageObj = useMemo(() => {
    return WRITE_LANGUAGES.find((l) => l.name === languageValue) || WRITE_LANGUAGES[0];
  }, [languageValue]);

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Trigger Button Pill */}
      <button
        type="button"
        id="write-formatting-trigger"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100/90 dark:bg-zinc-800 hover:bg-zinc-200/70 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-normal border border-zinc-200/60 dark:border-zinc-700/60 shadow-2xs cursor-pointer transition-all select-none"
      >
        <span>{styleValue}</span>
        <span className="text-zinc-400 dark:text-zinc-500 font-bold">·</span>
        <span>{lengthValue}</span>
        <span className="text-zinc-400 dark:text-zinc-500 font-bold">·</span>
        <span>{languageValue}</span>
        <span className="text-zinc-400 text-[10px] ml-0.5">
          {isOpen ? <UpOutlined className="text-[9px]" /> : <DownOutlined className="text-[9px]" />}
        </span>
      </button>

      {/* Main Formatting Popover Card */}
      {isOpen && (
        <div
          id="write-formatting-popover"
          className="absolute right-0 top-full mt-2 z-50 w-[270px] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-100 dark:border-zinc-800 p-4 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* 1. Style Section */}
          <div className="mb-4">
            <div className="text-[12px] font-medium text-zinc-500 dark:text-zinc-400 mb-2 select-none">
              Style
            </div>
            <div className="flex flex-wrap gap-2">
              {WRITE_STYLES.map((style) => {
                const isSelected = styleValue === style;
                return (
                  <button
                    key={style}
                    type="button"
                    onClick={() => onChangeStyle(style)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-normal cursor-pointer transition-all select-none ${
                      isSelected
                        ? 'bg-[#ece6f8] text-zinc-900 dark:bg-purple-950/80 dark:text-purple-200 font-medium shadow-2xs'
                        : 'bg-zinc-100/90 dark:bg-zinc-800/90 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80'
                    }`}
                  >
                    {style}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Length Section */}
          <div className="mb-4">
            <div className="text-[12px] font-medium text-zinc-500 dark:text-zinc-400 mb-2 select-none">
              Length
            </div>
            <div className="flex items-center gap-2">
              {WRITE_LENGTHS.map((len) => {
                const isSelected = lengthValue === len;
                return (
                  <button
                    key={len}
                    type="button"
                    onClick={() => onChangeLength(len)}
                    className={`flex-1 text-center py-1.5 rounded-xl text-xs font-normal cursor-pointer transition-all select-none ${
                      isSelected
                        ? 'bg-[#ece6f8] text-zinc-900 dark:bg-purple-950/80 dark:text-purple-200 font-medium shadow-2xs'
                        : 'bg-zinc-100/90 dark:bg-zinc-800/90 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80'
                    }`}
                  >
                    {len}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Language Section */}
          <div className="relative">
            <div className="text-[12px] font-medium text-zinc-500 dark:text-zinc-400 mb-2 select-none">
              Language
            </div>
            <div className="flex items-center gap-2">
              {/* Primary Active Language Button */}
              <button
                type="button"
                onClick={() => onChangeLanguage(activeLanguageObj.name)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-normal bg-[#ece6f8] text-zinc-900 dark:bg-purple-950/80 dark:text-purple-200 font-medium shadow-2xs cursor-pointer select-none"
              >
                {activeLanguageObj.name}
              </button>

              {/* More Languages Trigger Button (...) */}
              <button
                type="button"
                id="write-language-more-btn"
                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none ${
                  isLangMenuOpen
                    ? 'bg-zinc-300 dark:bg-zinc-600 text-zinc-900 dark:text-zinc-100'
                    : 'bg-zinc-100/90 dark:bg-zinc-800/90 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80'
                }`}
                title="More languages"
              >
                ···
              </button>
            </div>

            {/* Nested / Popout Language Selection Dropdown */}
            {isLangMenuOpen && (
              <div
                ref={langMenuRef}
                id="write-language-dropdown"
                className="absolute left-0 top-full mt-2 z-50 w-[190px] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-100 dark:border-zinc-800 p-2 flex flex-col animate-in fade-in zoom-in-95 duration-150"
                style={{ maxHeight: '310px' }}
              >
                {/* Search Bar */}
                <div className="relative mb-2">
                  <div className="flex items-center gap-2 bg-zinc-100/90 dark:bg-zinc-800/90 rounded-xl px-2.5 py-1.5">
                    <SearchOutlined className="text-zinc-400 text-xs" />
                    <input
                      type="text"
                      value={langSearch}
                      onChange={(e) => setLangSearch(e.target.value)}
                      placeholder="Search"
                      autoFocus
                      className="bg-transparent border-none outline-none text-xs text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 w-full"
                    />
                  </div>
                </div>

                {/* Scrollable Language List */}
                <div className="overflow-y-auto max-h-[230px] pr-1 space-y-0.5 custom-scrollbar">
                  {filteredLanguages.length > 0 ? (
                    filteredLanguages.map((lang) => {
                      const isSelected = languageValue === lang.name;
                      return (
                        <div
                          key={lang.code}
                          onClick={() => handleSelectLanguage(lang.name)}
                          className={`px-2.5 py-1.5 rounded-xl cursor-pointer transition-colors flex flex-col ${
                            isSelected
                              ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-900 dark:text-purple-200 font-medium'
                              : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200'
                          }`}
                        >
                          <span className="text-xs leading-tight font-normal">{lang.name}</span>
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 leading-tight">
                            {lang.nativeName}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-2 py-4 text-center text-xs text-zinc-400">
                      No language found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
