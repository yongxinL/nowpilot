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
    <div style={{
            position: 'relative',
            display: 'inline-block',
          }} ref={containerRef}>
      {/* Trigger Button Pill */}
      <button
        type="button"
        id="write-formatting-trigger"
        onClick={() => setIsOpen(!isOpen)}
        style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: 12,
            background: 'var(--muted)',
            color: 'var(--foreground)',
            fontSize: 12,
            fontWeight: 400,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'var(--border)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
            cursor: 'pointer',
            transition: 'all 200ms ease',
            userSelect: 'none',
          }}
      >
        <span>{styleValue}</span>
        <span style={{
            color: 'var(--muted-foreground)',
            fontWeight: 700,
          }}>·</span>
        <span>{lengthValue}</span>
        <span style={{
            color: 'var(--muted-foreground)',
            fontWeight: 700,
          }}>·</span>
        <span>{languageValue}</span>
        <span style={{
            color: 'var(--muted-foreground)',
            fontSize: '10px',
            marginLeft: 2,
          }}>
          {isOpen ? <UpOutlined style={{
            fontSize: '9px',
          }} /> : <DownOutlined style={{
            fontSize: '9px',
          }} />}
        </span>
      </button>

      {/* Main Formatting Popover Card */}
      {isOpen && (
        <div
          id="write-formatting-popover"
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            marginTop: 8,
            zIndex: 50,
            width: 270,
            background: 'var(--card)',
            borderRadius: 16,
            boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'var(--border)',
            padding: 16,
          }} className="np-zoom-fade-in np-fade-in np-zoom-fade-in"
        >
          {/* 1. Style Section */}
          <div style={{
            marginBottom: 16,
          }}>
            <div style={{
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--muted-foreground)',
            marginBottom: 8,
            userSelect: 'none',
          }}>
              Style
            </div>
            <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
          }}>
              {WRITE_STYLES.map((style) => {
                const isSelected = styleValue === style;
                return (
                  <button
                    key={style}
                    type="button"
                    onClick={() => onChangeStyle(style)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: isSelected ? 500 : 400,
                      cursor: 'pointer',
                      transition: 'all 200ms ease',
                      userSelect: 'none',
                      background: isSelected ? '#ece6f8' : 'var(--muted)',
                      color: isSelected ? 'var(--foreground)' : 'var(--muted-foreground)',
                      boxShadow: isSelected ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    }}
                  >
                    {style}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Length Section */}
          <div style={{
            marginBottom: 16,
          }}>
            <div style={{
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--muted-foreground)',
            marginBottom: 8,
            userSelect: 'none',
          }}>
              Length
            </div>
            <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
              {WRITE_LENGTHS.map((len) => {
                const isSelected = lengthValue === len;
                return (
                  <button
                    key={len}
                    type="button"
                    onClick={() => onChangeLength(len)}
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      padding: '6px 0',
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: isSelected ? 500 : 400,
                      cursor: 'pointer',
                      transition: 'all 200ms ease',
                      userSelect: 'none',
                      background: isSelected ? '#ece6f8' : 'var(--muted)',
                      color: isSelected ? 'var(--foreground)' : 'var(--muted-foreground)',
                      boxShadow: isSelected ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    }}
                  >
                    {len}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Language Section */}
          <div style={{
            position: 'relative',
          }}>
            <div style={{
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--muted-foreground)',
            marginBottom: 8,
            userSelect: 'none',
          }}>
              Language
            </div>
            <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
              {/* Primary Active Language Button */}
              <button
                type="button"
                onClick={() => onChangeLanguage(activeLanguageObj.name)}
                style={{
            paddingLeft: 14,
            paddingRight: 14,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 500,
            background: '#ece6f8',
            color: 'var(--foreground)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
            cursor: 'pointer',
            userSelect: 'none',
          }}
              >
                {activeLanguageObj.name}
              </button>

              {/* More Languages Trigger Button (...) */}
              <button
                type="button"
                id="write-language-more-btn"
                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 700,
                  transition: 'all 200ms ease',
                  cursor: 'pointer',
                  userSelect: 'none',
                  background: isLangMenuOpen ? 'var(--border)' : 'var(--muted)',
                  color: isLangMenuOpen ? 'var(--foreground)' : 'var(--muted-foreground)',
                }}
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
                style={{
            position: 'absolute',
            left: 0,
            top: '100%',
            marginTop: 8,
            zIndex: 50,
            width: 190,
            background: 'var(--card)',
            borderRadius: 16,
            boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'var(--border)',
            padding: 8,
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '310px',
          }} className="np-zoom-fade-in np-fade-in np-zoom-fade-in"
              >
                {/* Search Bar */}
                <div style={{
            position: 'relative',
            marginBottom: 8,
          }}>
                  <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--muted)',
            borderRadius: 12,
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 6,
            paddingBottom: 6,
          }}>
                    <SearchOutlined style={{
            color: 'var(--muted-foreground)',
            fontSize: 12,
          }} />
                    <input
                      type="text"
                      value={langSearch}
                      onChange={(e) => setLangSearch(e.target.value)}
                      placeholder="Search"
                      autoFocus
                      style={{
            background: 'transparent',
            borderStyle: 'none',
            outline: 'none',
            fontSize: 12,
            color: 'var(--foreground)',
            width: '100%',
          }}
                    />
                  </div>
                </div>

                {/* Scrollable Language List */}
                <div style={{
            overflowY: 'auto',
            maxHeight: 230,
            paddingRight: 4,
            rowGap: 2,
            display: 'flex',
            flexDirection: 'column',
          }} className="custom-scrollbar">
                  {filteredLanguages.length > 0 ? (
                    filteredLanguages.map((lang) => {
                      const isSelected = languageValue === lang.name;
                      return (
                        <div
                          key={lang.code}
                          onClick={() => handleSelectLanguage(lang.name)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 12,
                            cursor: 'pointer',
                            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
                            display: 'flex',
                            flexDirection: 'column',
                            background: isSelected ? '#faf5ff' : 'transparent',
                            color: isSelected ? '#6b21a8' : 'var(--foreground)',
                            fontWeight: isSelected ? 500 : 400,
                          }}
                        >
                          <span style={{
            fontSize: 12,
            lineHeight: 1.25,
            fontWeight: 400,
          }}>{lang.name}</span>
                          <span style={{
            fontSize: '10px',
            color: 'var(--muted-foreground)',
            lineHeight: 1.25,
          }}>
                            {lang.nativeName}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 16,
            paddingBottom: 16,
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--muted-foreground)',
          }}>
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
