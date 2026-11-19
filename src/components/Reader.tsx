import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { SurahMeta, SurahEdition, AppSettings } from '@/types/quran';
import AyahList from '@/components/reader/AyahList';
import { useReaderContextMenu } from '@/components/reader/hooks/useReaderContextMenu';
import ReaderHeader from '@/components/reader/ReaderHeader';
import ReaderFooter from '@/components/reader/ReaderFooter';
import { ReaderErrorState, ReaderLoadingState } from '@/components/reader/ReaderStates';
import ContextMenu from '@/components/ContextMenu';
import { copyAyahPayload, createAyahCopyPayload, formatCopyFallback, numberSuffix, selectionCopyPayload } from '@/lib/copyText';
import { getAyahText } from '@/lib/quranData';
import { hasPageImages, type PageTarget } from '@/lib/pageImages';
import { saveLastReadPosition } from '@/lib/lastRead';
import { BookOpen, Copy, Ellipsis } from 'lucide-react';

interface ReaderProps {
  surahMeta: SurahMeta | null;
  surahData: SurahEdition[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  settings: AppSettings;
  surahs: SurahMeta[];
  targetAyah: number | null;
  searchQuery: string;
  onPrev: () => void;
  onNext: () => void;
  onOpenSettings: () => void;
  onToggleSidebar: () => void;
  onOpenBookmarks: () => void;
  onShowPage: (target: PageTarget) => void;
  onToggleTheme: () => void;
  onNavigateSurah: (
    surahNumber: number,
    ayahNumber?: number,
    query?: string,
    record?: boolean
  ) => void;
  hasPrev: boolean;
  hasNext: boolean;
}

export default function Reader({
  surahMeta,
  surahData,
  loading,
  error,
  onRetry,
  settings,
  surahs,
  targetAyah,
  searchQuery,
  onPrev,
  onNext,
  onOpenSettings,
  onToggleSidebar,
  onOpenBookmarks,
  onShowPage,
  onToggleTheme,
  onNavigateSurah,
  hasPrev,
  hasNext,
}: ReaderProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const [selectionCopy, setSelectionCopy] = useState<{ payload: ReturnType<typeof selectionCopyPayload>; count: number } | null>(null);
  const [selectedAyahs, setSelectedAyahs] = useState<Set<number>>(() => new Set());
  const ayahRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Page images
  const pagesOn = hasPageImages();

  // Clicking ayah rows toggles them into a shared multi-selection.
  const handleToggleAyahSelection = useCallback((ayahNumber: number) => {
    // A native text selection is handled independently by the browser-copy path.
    setSelectionCopy(null);
    setSelectedAyahs((previous) => {
      const next = new Set(previous);
      if (next.has(ayahNumber)) next.delete(ayahNumber);
      else next.add(ayahNumber);
      return next;
    });
  }, []);

  // Build the same copy payload used by text-range selection, but from whole clicked ayahs.
  const clickedAyahCopy = useMemo(() => {
    if (!surahMeta || !surahData || selectedAyahs.size === 0) return null;

    const numbers = [...selectedAyahs].sort((a, b) => a - b);
    const lastIndex = numbers.length - 1;
    const numberStyle = settings.copyNumberStyle;
    const text = numbers.map((number, index) => {
      const ayahText = getAyahText(surahData, number - 1);
      const appendNumber = numberStyle !== 'none' &&
        !(settings.omitLastAyahNumber && index === lastIndex);
      return ayahText + (appendNumber ? numberSuffix(number, numberStyle) : '');
    }).join(' ');

    return {
      payload: createAyahCopyPayload(
        text,
        surahMeta.name,
        numbers,
        settings.copyAyahBracketStyle,
      ),
      count: numbers.length,
    };
  }, [surahMeta, surahData, selectedAyahs, settings.copyNumberStyle, settings.omitLastAyahNumber, settings.copyAyahBracketStyle]);

  // Native text selection (including a partial selection inside one ayah)
  // takes precedence; clicked rows provide the whole-ayah fallback.
  const activeCopy = selectionCopy ?? clickedAyahCopy;

  const copyClickedAyahs = useCallback(async () => {
    if (!clickedAyahCopy?.payload) return;
    const result = await copyAyahPayload(
      clickedAyahCopy.payload,
      settings.copyReferenceStyle,
      settings.language,
    );
    if (result.ok) setSelectedAyahs(new Set());
  }, [clickedAyahCopy, settings.copyReferenceStyle, settings.language]);

  // Handle Ctrl+C / Cmd+C explicitly so whole-ayah click selection works even
  // when the browser has no native text selection.
  useEffect(() => {
    const handleCopyShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'c' || !clickedAyahCopy) return;

      const nativeSelection = window.getSelection();
      if (nativeSelection && !nativeSelection.isCollapsed && nativeSelection.toString().trim()) return;

      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement ||
        (activeElement instanceof HTMLElement && activeElement.isContentEditable)
      ) return;

      event.preventDefault();
      void copyClickedAyahs();
    };

    document.addEventListener('keydown', handleCopyShortcut);
    return () => document.removeEventListener('keydown', handleCopyShortcut);
  }, [clickedAyahCopy, copyClickedAyahs]);

  // Track native selections in one or more ayahs and expose an explicit copy action.
  const updateMultiAyahSelection = useCallback(() => {
    const root = scrollRef.current;
    const selection = window.getSelection();
    if (!root || !selection || selection.isCollapsed || selection.rangeCount === 0) {
      setSelectionCopy(null);
      return;
    }

    const range = selection.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) {
      setSelectionCopy(null);
      return;
    }

    const selectedAyahNodes = Array.from(
      root.querySelectorAll<HTMLElement>('[data-arabic-text]')
    ).filter((node) => range.intersectsNode(node));

    if (selectedAyahNodes.length === 0) {
      setSelectionCopy(null);
      return;
    }

    const payload = selectionCopyPayload(
      root,
      settings.copyNumberStyle,
      surahMeta?.name ?? '',
      settings.copyAyahBracketStyle,
      settings.omitLastAyahNumber
    );

    setSelectionCopy(payload ? { payload, count: selectedAyahNodes.length } : null);
  }, [settings.copyNumberStyle, settings.copyAyahBracketStyle, settings.omitLastAyahNumber, surahMeta?.name]);

  useEffect(() => {
    document.addEventListener('selectionchange', updateMultiAyahSelection);
    return () => document.removeEventListener('selectionchange', updateMultiAyahSelection);
  }, [updateMultiAyahSelection]);

  const handleCopySelectedAyahs = useCallback(async () => {
    if (!activeCopy?.payload) return;
    const result = await copyAyahPayload(
      activeCopy.payload,
      settings.copyReferenceStyle,
      settings.language
    );
    if (result.ok) {
      if (selectionCopy) {
        window.getSelection()?.removeAllRanges();
        setSelectionCopy(null);
      } else if (clickedAyahCopy) {
        setSelectedAyahs(new Set());
      }
    }
  }, [activeCopy, selectionCopy, clickedAyahCopy, settings.copyReferenceStyle, settings.language]);

  // Copy selected Arabic text
  useEffect(() => {
    const onCopy = (e: ClipboardEvent) => {
      const root = scrollRef.current;

      if (
        !root ||
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const nativeSelection = window.getSelection();
      const hasNativeTextSelection = Boolean(
        nativeSelection && !nativeSelection.isCollapsed && nativeSelection.toString().trim()
      );

      // Preserve normal browser copying outside the Quran text. Inside the
      // reader, a native selection always wins over the clicked-row selection.
      const payload = hasNativeTextSelection
        ? selectionCopyPayload(
          root,
          settings.copyNumberStyle,
          surahMeta?.name ?? '',
          settings.copyAyahBracketStyle,
          settings.omitLastAyahNumber
        )
        : clickedAyahCopy?.payload ?? null;

      if (payload === null) return;

      e.clipboardData?.setData('text/plain', formatCopyFallback(payload, settings.copyReferenceStyle));
      e.preventDefault();
      void copyAyahPayload(payload, settings.copyReferenceStyle, settings.language).then(({ ok }) => {
        if (ok && !hasNativeTextSelection && clickedAyahCopy) {
          setSelectedAyahs(new Set());
        }
      });
    };

    document.addEventListener('copy', onCopy);

    return () => {
      document.removeEventListener('copy', onCopy);
    };
  }, [clickedAyahCopy, settings.copyNumberStyle, settings.omitLastAyahNumber, settings.copyReferenceStyle, settings.copyAyahBracketStyle, settings.language, surahMeta?.name]);

  const { menu, menuItems, closeMenu, handleContextMenu } = useReaderContextMenu({
    scrollRef,
    surahMeta,
    surahData,
    settings,
  });

  // Save last read position while scrolling
  const activeSurahNumber = surahMeta?.number;

  const handleReaderScroll = useCallback(() => {
    if (!activeSurahNumber || !scrollRef.current || scrollFrameRef.current !== null) return;

    // Scroll events can fire many times in one frame. Coalesce them and use the
    // ordered ayah refs for a binary search instead of creating/querying a NodeList.
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      const root = scrollRef.current;
      const refs = ayahRefs.current;
      if (!root || refs.size === 0) return;

      const threshold = root.getBoundingClientRect().top + 48;
      const ayahNumbers = surahData?.[0]?.ayahs.length ?? refs.size;
      let low = 1;
      let high = Math.max(ayahNumbers, refs.size);
      let visibleAyah = 0;

      // Ayah wrappers are mounted in ascending document order, so their bottom
      // edges are monotonic and the first visible ayah can be found in O(log n).
      // Probe for a nearby mounted ref in case a middle index is temporarily unavailable.
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        let probe = middle;
        let element = refs.get(probe);

        if (!element) {
          let left = middle - 1;
          while (left >= low && !refs.has(left)) left--;
          let right = middle + 1;
          while (right <= high && !refs.has(right)) right++;

          const hasLeft = left >= low;
          const hasRight = right <= high;
          if (!hasLeft && !hasRight) break;
          if (hasLeft && hasRight) {
            probe = middle - left <= right - middle ? left : right;
          } else {
            probe = hasLeft ? left : right;
          }
          element = refs.get(probe);
        }

        if (!element) break;

        if (element.getBoundingClientRect().bottom > threshold) {
          visibleAyah = probe;
          high = probe - 1;
        } else {
          low = probe + 1;
        }
      }

      if (visibleAyah > 0) saveLastReadPosition(activeSurahNumber, visibleAyah);
    });
  }, [activeSurahNumber, ayahRefs, surahData]);

  useEffect(() => () => {
    if (scrollFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = null;
    }
  }, []);

  // Keep the reader viewport at the top after a surah change. Reader-local
  // selection state is reset by the surah key on the Reader in App.tsx.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [surahMeta?.number]);

  // Navigate to target ayah
  useEffect(() => {
    const el = targetAyah
      ? ayahRefs.current.get(targetAyah)
      : undefined;

    if (!el) return;

    const far =
      Math.abs(el.getBoundingClientRect().top) >
      window.innerHeight * 3;

    el.scrollIntoView({
      behavior: far ? 'auto' : 'smooth',
      block: 'center',
    });
  }, [targetAyah, surahData]);

  // Keep the three early states separate from the reader layout.
  if (error && !surahData) {
    return <ReaderErrorState error={error} language={settings.language} onRetry={onRetry} />;
  }
  if (loading && !surahData) return <ReaderLoadingState />;
  if (!surahMeta || !surahData || !surahData[0]) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-(--accent)/10 flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-(--accent)" />
          </div>
          <div className="flex items-center gap-2">
            <Ellipsis className=" text-(--accent) animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 flex flex-col min-w-0 min-h-0 h-full mt-4">

      <ReaderHeader
        surahMeta={surahMeta}
        surahData={surahData}
        settings={settings}
        surahs={surahs}
        pagesOn={pagesOn}
        onToggleSidebar={onToggleSidebar}
        onShowPage={onShowPage}
        onOpenBookmarks={onOpenBookmarks}
        onToggleTheme={onToggleTheme}
        onOpenSettings={onOpenSettings}
        onNavigateSurah={onNavigateSurah}
      />

      {loading && surahData && (
       <div className="absolute inset-0 z-10 flex-1 flex items-center justify-center">
       <div className="flex flex-col items-center gap-4">
         <div className="w-16 h-16 rounded-2xl bg-(--accent)/10 flex items-center justify-center">
           <BookOpen className="w-8 h-8 text-(--accent)" />
         </div>
         <div className="flex items-center gap-2">
           <Ellipsis className="w-8 h-8 text-(--accent) animate-pulse" />
         </div>
       </div>
     </div>
      )}
      {error && surahData && (
        <div className="flex items-center justify-center gap-3 px-4 py-2 text-xs text-red-600" role="alert">
          <span>
            {settings.language === 'fa'
              ? 'بارگذاری سوره ناموفق'
              : 'تعذّر تحميل السور'}
          </span>
          <button type="button" onClick={onRetry} className="underline underline-offset-2">
            {settings.language === 'fa' ? 'تلاش دوباره' : 'إعادة المحاولة'}
          </button>
        </div>
      )}

      {/* ==================== SCROLLABLE CONTENT ==================== */}

      <div
        ref={scrollRef}
        onContextMenu={handleContextMenu}
        onScroll={handleReaderScroll}
        onMouseUp={updateMultiAyahSelection}
        onKeyUp={updateMultiAyahSelection}
        className="flex-1 min-h-0 overflow-y-auto pb-24 sm:pb-28"
      >

        <AyahList
          surahMeta={surahMeta}
          surahData={surahData}
          settings={settings}
          targetAyah={targetAyah}
          searchQuery={searchQuery}
          pagesOn={pagesOn}
          onShowPage={onShowPage}
          ayahRefs={ayahRefs}
          selectedAyahs={selectedAyahs}
          onToggleAyahSelection={handleToggleAyahSelection}
        />
      </div>

      {activeCopy && (
        <div className="absolute bottom-20 left-4 z-30">
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => void handleCopySelectedAyahs()}
            className="inline-flex items-center mb-7 gap-2 rounded-full bg-(--accent) px-4  py-2.5 text-sm font-medium text-white shadow-lg transition-smooth hover:brightness-110  focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
          >
            <Copy className="h-4 w-4" />
            {settings.language === 'fa'
              ? selectionCopy
                ? activeCopy.count === 1
                  ? 'کپی متن انتخاب‌شده'
                  : `کپی متن انتخاب‌شده (${activeCopy.count} آیه)`
                : activeCopy.count === 1
                  ? 'کپی آیه انتخاب‌شده'
                  : `کپی آیات انتخاب‌شده (${activeCopy.count})`
              : selectionCopy
                ? activeCopy.count === 1
                  ? 'نسخ النص المحدد'
                  : `نسخ النص المحدد (${activeCopy.count} آيات)`
                : activeCopy.count === 1
                  ? 'نسخ الآية المحددة'
                  : `نسخ الآيات المحددة (${activeCopy.count})`}
          </button>
        </div>
      )}

      <ReaderFooter
        language={settings.language}
        hasPrev={hasPrev}
        hasNext={hasNext}
        onPrev={onPrev}
        onNext={onNext}
      />

      {/* ==================== CONTEXT MENU ==================== */}

      {menu && menuItems.length > 0 && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems}
          onClose={closeMenu}
        />
      )}

    </div>
  );
}