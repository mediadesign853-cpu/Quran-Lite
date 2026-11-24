import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Monitor, Moon, Sun } from 'lucide-react';
import type { Theme } from '@/types/quran';

const THEME_OPTIONS = [
  { value: 'light', label: 'فاتح', Icon: Sun },
  { value: 'dark', label: 'داكن', Icon: Moon },
  { value: 'system', label: 'حسب النظام', Icon: Monitor },
] as const;

interface ThemeSelectProps {
  theme: Theme;
  onChange: (theme: Theme) => void;
  compact?: boolean;
}

/** Dropdown used for the three appearance modes, both in settings and in the header. */
export default function ThemeSelect({ theme, onChange, compact = false }: ThemeSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const current = THEME_OPTIONS.find((option) => option.value === theme) ?? THEME_OPTIONS[2];
  const CurrentIcon = current.Icon;

  return (
    <div ref={rootRef} className={compact ? 'relative' : 'relative w-full'}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={compact ? 'تغيير المظهر' : 'اختيار المظهر'}
        data-tooltip={compact ? 'المظهر' : undefined}
        className={compact
          ? 'tooltip flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-smooth hover:bg-(--border-light) sm:h-9 sm:w-9'
          : 'flex w-full items-center justify-between gap-3 rounded-lg border border-(--border) bg-(--bg-card) px-3 py-2.5 text-sm transition-smooth hover:bg-(--bg-secondary)'}
      >
        {compact ? (
          <CurrentIcon className="h-4 w-4 text-(--text-primary) sm:h-5 sm:w-5" />
        ) : (
          <>
            <span className="flex items-center gap-2 text-(--text-primary)">
              <CurrentIcon className="h-4 w-4 text-(--accent)" />
              {current.label}
            </span>
            <ChevronDown
              className={`h-4 w-4 text-(--text-secondary) transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </>
        )}
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="المظهر"
          className={`absolute z-60 mt-1 min-w-36 overflow-hidden rounded-lg border border-(--border) bg-(--bg-card) p-1 shadow-xl ${compact ? 'left-0' : 'inset-x-0'}`}
        >
          {THEME_OPTIONS.map((option) => {
            const Icon = option.Icon;
            const active = option.value === theme;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-right text-sm transition-smooth hover:bg-(--border-light) ${
                  active ? 'text-(--accent)' : 'text-(--text-primary)'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{option.label}</span>
                {active && <Check className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
