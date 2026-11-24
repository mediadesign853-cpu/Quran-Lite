import { useEffect, useState, type RefObject } from 'react';
import { Copy } from 'lucide-react';
import type { AppSettings } from '@/types/quran';
import { copyAyahPayload, selectionCopyPayload } from '@/lib/copyText';

interface SelectionCopyToolbarProps {
  rootRef: RefObject<HTMLDivElement | null>;
  settings: AppSettings;
  surahName: string;
}

interface SelectionToolbarState {
  top: number;
  left: number;
  payload: NonNullable<ReturnType<typeof selectionCopyPayload>>;
}

/** Offers a visible copy action when a text selection spans multiple ayahs. */
export default function SelectionCopyToolbar({ rootRef, settings, surahName }: SelectionCopyToolbarProps) {
  const [selection, setSelection] = useState<SelectionToolbarState | null>(null);

  useEffect(() => {
    const updateSelection = () => {
      const root = rootRef.current;
      const currentSelection = window.getSelection();

      if (!root || !currentSelection || currentSelection.isCollapsed || currentSelection.rangeCount === 0) {
        setSelection(null);
        return;
      }

      const range = currentSelection.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) {
        setSelection(null);
        return;
      }

      const selectedAyahs = Array.from(root.querySelectorAll<HTMLElement>('[data-arabic-text]'))
        .filter((node) => {
          try {
            return range.intersectsNode(node) && Boolean(node.textContent?.trim());
          } catch {
            return false;
          }
        });

      // Keep the extra action focused on the multi-ayah selection requested by the user.
      if (selectedAyahs.length < 2) {
        setSelection(null);
        return;
      }

      const payload = selectionCopyPayload(
        root,
        settings.copyNumberStyle,
        surahName,
        settings.copyAyahBracketStyle,
        settings.omitLastAyahNumber,
      );

      if (!payload) {
        setSelection(null);
        return;
      }

      const rect = range.getBoundingClientRect();
      if (!rect.width && !rect.height) {
        setSelection(null);
        return;
      }

      const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
      const center = rect.left + rect.width / 2;
      const left = Math.min(Math.max(center, 96), Math.max(96, viewportWidth - 96));

      setSelection({
        payload,
        top: Math.max(8, rect.top - 12),
        left,
      });
    };

    document.addEventListener('selectionchange', updateSelection);
    document.addEventListener('scroll', updateSelection, true);
    window.addEventListener('resize', updateSelection);

    return () => {
      document.removeEventListener('selectionchange', updateSelection);
      document.removeEventListener('scroll', updateSelection, true);
      window.removeEventListener('resize', updateSelection);
    };
  }, [rootRef, settings.copyNumberStyle, settings.copyAyahBracketStyle, settings.omitLastAyahNumber, surahName]);

  const handleCopy = () => {
    if (!selection) return;

    void copyAyahPayload(selection.payload, settings.copyReferenceStyle).then(({ ok }) => {
      if (!ok) return;
      setSelection(null);
      window.getSelection()?.removeAllRanges();
    });
  };

  if (!selection) return null;

  return (
    <div
      className="fixed z-70 -translate-x-1/2 -translate-y-full"
      style={{ top: selection.top, left: selection.left }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <button
        type="button"
        onClick={handleCopy}
        className="flex items-center gap-2 rounded-full border border-(--border) bg-(--bg-card) px-3 py-2 text-xs font-semibold text-(--text-primary) shadow-xl transition-smooth hover:border-(--accent) hover:text-(--accent)  focus-visible:outline-2 focus-visible:outline-(--accent)"
        aria-label="نسخ الآيات المحددة"
      >
        <Copy className="h-3.5 w-3.5" />
        {'نسخ الآيات المحددة'}
      </button>
    </div>
  );
}
