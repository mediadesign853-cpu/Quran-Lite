import { useState, useMemo, useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Search, X, BookOpen, Eye } from 'lucide-react';
import type { SurahMeta } from '@/types/quran';
import { normalizeSearch } from '@/lib/quranData';
import { getSurahViewCount, useStatsVersion } from '@/lib/viewStats';
import { trapFocus } from '@/lib/focusTrap';

interface SidebarProps {
  surahs: SurahMeta[];
  currentSurah: number | null;
  onSelectSurah: (n: number) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ surahs, currentSurah, onSelectSurah, isOpen, onClose }: SidebarProps) {
  const [search, setSearch] = useState('');
  const [activeSurahNumber, setActiveSurahNumber] = useState<number | null>(currentSurah);
  const listRef = useRef<HTMLDivElement>(null);
  const surahButtonRefs = useRef(new Map<number, HTMLButtonElement>());
  const sidebarRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useStatsVersion();

  const filtered = useMemo(() => {
    if (!search.trim()) return surahs;
    const raw = search.trim().replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (digit) => {
      const arabic = '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669'.indexOf(digit);
      const persian = '\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9'.indexOf(digit);
      return String(Math.max(arabic, persian));
    });
    const numeric = /^\d+$/.test(raw);
    if (numeric) return surahs.filter((surah) => String(surah.number) === raw);
    const q = normalizeSearch(search);
    if (!q) return surahs;
    const qLower = search.toLowerCase().trim();
    return surahs.filter(
      (s) =>
        normalizeSearch(s.name).includes(q) ||
        s.englishName.toLowerCase().includes(qLower) ||
        normalizeSearch(s.englishNameTranslation).includes(q)
    );
  }, [surahs, search]);


  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    (sidebar as HTMLElement & { inert: boolean }).inert = !isOpen;
    if (!isOpen) return;
    const releaseFocus = trapFocus(sidebar, searchInputRef.current);
    return () => {
      (sidebar as HTMLElement & { inert: boolean }).inert = true;
      releaseFocus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (currentSurah && listRef.current) {
      const el = listRef.current.querySelector(`[data-surah="${currentSurah}"]`);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [currentSurah]);

  const keyboardActiveSurahNumber =
    activeSurahNumber !== null && filtered.some((surah) => surah.number === activeSurahNumber)
      ? activeSurahNumber
      : currentSurah !== null && filtered.some((surah) => surah.number === currentSurah)
        ? currentSurah
        : filtered[0]?.number ?? null;

  useEffect(() => {
    if (!isOpen || keyboardActiveSurahNumber === null) return;
    surahButtonRefs.current.get(keyboardActiveSurahNumber)?.scrollIntoView({ block: 'nearest' });
  }, [keyboardActiveSurahNumber, isOpen]);

  const handleSidebarKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    const target = event.target;
    const isSearchInput = target === searchInputRef.current;
    const isSurahButton = target instanceof HTMLElement && target.matches('[data-surah]');

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!isSearchInput && !isSurahButton) return;
      if (filtered.length === 0) return;

      event.preventDefault();
      const hasCurrentSurah = currentSurah !== null &&
        filtered.some((surah) => surah.number === currentSurah);
      const startSurahNumber = isSearchInput && hasCurrentSurah
        ? currentSurah
        : keyboardActiveSurahNumber;
      const currentIndex = filtered.findIndex((surah) => surah.number === startSurahNumber);
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      // From the search field, arrows move relative to the current surah.
      // If the filter hides it, navigation starts at the matching edge.
      const nextIndex = isSearchInput && !hasCurrentSurah
        ? direction > 0 ? 0 : filtered.length - 1
        : Math.max(0, Math.min(filtered.length - 1, (currentIndex < 0 ? 0 : currentIndex) + direction));
      const nextSurah = filtered[nextIndex];
      setActiveSurahNumber(nextSurah.number);
      surahButtonRefs.current.get(nextSurah.number)?.focus({ preventScroll: true });
      return;
    }

    if (event.key === 'Enter' && isSearchInput && filtered.length > 0) {
      const activeSurah = filtered.find((surah) => surah.number === keyboardActiveSurahNumber) ?? filtered[0];
      event.preventDefault();
      onSelectSurah(activeSurah.number);
    }
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed right-0 left-0 z-30"
          style={{
            top: 'var(--header-bottom, 0px)',
            bottom: 'var(--footer-height, 0px)',
            background: 'var(--overlay)',
          }}
          onClick={onClose}
        />
      )}
      <aside
        ref={sidebarRef}
        role="dialog"
        aria-modal={isOpen}
        aria-hidden={!isOpen}
        aria-label="قائمة السور"
        tabIndex={-1}
        onKeyDown={handleSidebarKeyDown}
        className={`fixed right-0 w-80 bg-(--bg-secondary)
          border-l border-(--border) z-90  flex flex-col transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0 shadow-2xl' : 'translate-x-full'
        }`}
        style={{
          top: 'var(--header-bottom, 0px)',
          bottom: 'var(--footer-height, 0px)',
        }}
      >
        <div className="p-4 border-b border-(--border)">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-(--accent)" />
              <h2 className="text-sm font-semibold text-(--text-primary)">
                السور
              </h2>
            </div>
            
            <button
              ref={closeButtonRef}
              onClick={onClose}
              aria-label="إغلاق قائمة السور"
              className="cursor-pointer p-1 rounded hover:bg-(--border-light) transition-smooth"
            >
              <X className="w-5 h-5 text-(--text-secondary)" />
            </button>
            
          </div>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--text-secondary)" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setActiveSurahNumber(currentSurah)}
              placeholder="بحث عن سورة..."
              aria-label="البحث عن سورة"
              className="w-full pr-9 pl-3 py-2 text-sm bg-(--bg-card) border border-(--border) rounded-lg focus:outline-hidden focus:border-(--accent) transition-smooth"
            />
          </div>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain px-2 pt-2 pb-24 scroll-pb-24">
          {filtered.map((surah) => {
            const isActive = currentSurah === surah.number;
            const viewCount = getSurahViewCount(surah.number);
            return (
              <button
                key={surah.number}
                ref={(element) => {
                  if (element) surahButtonRefs.current.set(surah.number, element);
                  else surahButtonRefs.current.delete(surah.number);
                }}
                data-surah={surah.number}
                aria-current={isActive ? 'page' : undefined}
                onFocus={() => setActiveSurahNumber(surah.number)}
                onClick={() => onSelectSurah(surah.number)}
                className={`cursor-pointer w-full flex items-center gap-3  border px-3 py-2.5 rounded-lg mb-1 text-right transition-all duration-150 group focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--accent) ${
                  isActive
                    ? 'border-(--accent)/65 bg-(--accent)/18 text-(--text-primary) shadow-sm hover:border-(--accent) hover:bg-(--accent)/26 hover:shadow-md'
                    : keyboardActiveSurahNumber === surah.number
                      ? 'border-(--accent)/45 bg-(--accent)/10 text-(--text-primary) hover:border-(--accent)/65 hover:bg-(--accent)/18 hover:shadow-sm'
                      : 'border-transparent text-(--text-primary) hover:border-(--accent)/35 hover:bg-(--accent)/10 hover:shadow-sm'
                }`}
              >
                <div
                  className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-xs font-semibold ${
                    isActive
                      ? 'bg-(--accent) text-white shadow-sm group-hover:brightness-110'
                      : keyboardActiveSurahNumber === surah.number
                        ? 'bg-(--accent)/15 text-(--accent)'
                        : 'bg-(--border-light) text-(--text-secondary) group-hover:bg-(--accent)/15 group-hover:text-(--accent)'
                  }`}
                >
                  {surah.number}
                </div>
                <div className="flex-1 min-w-0 text-right">
                  <div className="flex items-center justify-between">
                    <span className={`font-quran text-base leading-tight truncate ${isActive || keyboardActiveSurahNumber === surah.number ? 'font-bold text-(--text-primary)' : 'font-medium text-(--text-primary)'}`}>
                      {surah.name}
                    </span>
                    <span className="text-xs text-(--text-secondary)">
                      {surah.numberOfAyahs}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-(--text-secondary)">
                    <span className="truncate">
                      {surah.englishName} · {surah.revelationType === 'Meccan' ? 'مكية' : 'مدنية'}
                    </span>
                    {viewCount > 0 && (
                      <span className="flex items-center gap-0.5 shrink-0 mr-2">
                        <Eye className="w-3 h-3" />
                        {viewCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-8 text-sm text-(--text-secondary)">
              لا توجد نتائج
            </div>
          )}
        </div>
      </aside>
    </>
  );
}