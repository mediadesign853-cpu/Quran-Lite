import { useRef, useEffect } from 'react';
import {
  Settings,
  Type,
  Check,
  Plus,
  Minus,
  X,
  Sun,
  Moon,
  Monitor,
  Copy,
} from 'lucide-react';
import type { AppSettings, Theme, CopyNumberStyle, CopyReferenceStyle, CopyAyahBracketStyle } from '@/types/quran';
import { Section, Toggle } from '@/components/settings/SettingsPrimitives';
import ThemeSelect from '@/components/ThemeSelect';
import { trapFocus } from '@/lib/focusTrap';

interface SettingsPanelProps {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ settings, onChange, isOpen, onClose }: SettingsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    (panel as HTMLDivElement & { inert: boolean }).inert = !isOpen;
    if (!isOpen) return;
    panel.scrollTop = 0;
    const releaseFocus = trapFocus(panel, closeButtonRef.current);
    return () => {
      (panel as HTMLDivElement & { inert: boolean }).inert = true;
      releaseFocus();
    };
  }, [isOpen]);

  const update = (patch: Partial<AppSettings>) => onChange({ ...settings, ...patch });

  const copyStyles: { value: CopyNumberStyle; label: string }[] = [
    { value: 'plain', label: 'رقم عادي: 37' },
    { value: 'brackets', label: 'بين قوسين: ﴿37﴾' },
    { value: 'none', label: 'بدون رقم' },
  ];

  const copyAyahBracketStyles: {
    value: CopyAyahBracketStyle;
    label: string
  }[] = [
      {
        value: 'curly',
        label: 'قوسان معقوفان { }',
      },
      {
        value: 'ornate',
        label: 'القوسان المزخرفان ﴿ ﴾',
      },
      {
        value: 'none',
        label: 'بدون أقواس',
      },
    ];

  const copyReferenceStyles: {
    value: CopyReferenceStyle;
    label: string;
  }[] = [
      {
        value: 'inline',
        label: 'مع النص',
      },
      {
        value: 'wordFootnote',
        label: 'الهامش  في Word',
      },
      {
        value: 'indesignFootnote',
        label: ' الهامش في InDesign',
      },
      {
        value: 'none',
        label: 'بدون مرجع',
      },
    ];

  return (
    <>
      {isOpen && (
        <div
          className="fixed z-40"
          style={{
            top: 'var(--header-bottom, 0px)',
            bottom: 'var(--footer-height, 0px)',
            left: 0,
            right: 0,
            background: 'var(--overlay)',
          }}
          onClick={onClose}
        />
      )}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal={isOpen}
        aria-hidden={!isOpen}
        aria-label="الإعدادات"
        tabIndex={-1}
        className={`fixed left-0 w-80 bg-(--bg-card) shadow-2xl z-50 flex flex-col transition-transform duration-300 overflow-y-auto
           ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{
          top: 'var(--header-bottom, 0px)',
          bottom: 'var(--footer-height, 0px)',
        }}
      >
        <div className="sticky top-0 bg-(--bg-card) border-b border-(--border) px-4 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-(--accent)" />
            <h2 className="text-sm font-semibold">الإعدادات</h2>
          </div>
          <button ref={closeButtonRef} onClick={onClose} aria-label="إغلاق الإعدادات" className="p-1.5 rounded-lg hover:bg-(--border-light) transition-smooth">
            <X className="w-5 h-5 text-(--text-secondary)" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Theme */}
          <Section
            title="المظهر"
            icon={settings.theme === 'dark' ? Moon : settings.theme === 'system' ? Monitor : Sun}
          >
            <ThemeSelect
              theme={settings.theme}
              onChange={(theme: Theme) => update({ theme })}
            />
          </Section>

          {/* Change Font Size */}
          <Section title="حجم النص" icon={Type}>
            <div className="flex items-center gap-3">
              <button
                onClick={() => update({ fontSize: Math.max(16, settings.fontSize - 2) })}
                className="w-10 h-10 rounded-lg border border-var(--border) flex items-center justify-center hover:bg-(--border-light) transition-smooth"
              >
                <Minus className="w-4 h-4" />
              </button>
              <div className="flex-1 text-center">
                <span className="text-2xl font-bold text-(--accent)">{settings.fontSize}</span>
                <span className="text-xs text-(--text-secondary) mr-1">px</span>
              </div>
              <button
                onClick={() => update({ fontSize: Math.min(56, settings.fontSize + 2) })}
                className="w-10 h-10 rounded-lg border border-var(--border) flex items-center justify-center hover:bg-(--border-light) transition-smooth"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-2">
              <input
                type="range"
                min={16}
                max={56}
                step={2}
                value={settings.fontSize}
                onChange={(e) => update({ fontSize: Number(e.target.value) })}
                className="w-full accent-(--accent)"
              />
            </div>
          </Section>

          {/* Brackets around copied ayahs */}
          <Section title="الأقواس" icon={Copy}>
            <p className="text-xs leading-6 text-(--text-secondary) mb-2">
              وضع الآية بين القوسين
            </p>
            <div role="radiogroup" aria-label="نوع أقواس الآية" className="space-y-2">
              {copyAyahBracketStyles.map((option) => {
                const active = settings.copyAyahBracketStyle === option.value;
                return (
                  <label
                    key={option.value}
                    className={`w-full flex items-start gap-3 px-3 py-3 rounded-lg border cursor-pointer transition-smooth ${active
                      ? 'border-(--accent) bg-(--accent)/5'
                      : 'border-(--border) hover:bg-(--bg-secondary)'
                      }`}
                  >
                    <input
                      type="radio"
                      name="copyAyahBracketStyle"
                      value={option.value}
                      checked={active}
                      onChange={() => update({ copyAyahBracketStyle: option.value })}
                      className="mt-1 accent-(--accent)"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium">
                        {option.label}
                      </span>
                    </span>
                    {active && <Check className="w-4 h-4 mt-0.5 shrink-0 text-(--accent)" />}
                  </label>
                );
              })}
            </div>
          </Section>

          {/* Copy reference placement */}
          <Section title="موضع إدراج مرجع الآية" icon={Copy}>
            <div
              role="radiogroup"
              className="space-y-2  border-t-teal-600"
            >
              {copyReferenceStyles.map((option) => {
                const active = settings.copyReferenceStyle === option.value;

                return (
                  <label
                    key={option.value}
                    className={`w-full flex items-start gap-3 px-3 py-3 rounded-lg border cursor-pointer transition-smooth ${active
                      ? 'border-(--accent) bg-(--accent)/5'
                      : 'border-(--border) hover:bg-(--bg-secondary)'
                      }`}
                  >
                    <input
                      type="radio"
                      name="copyReferenceStyle"
                      value={option.value}
                      checked={active}
                      onChange={() => update({ copyReferenceStyle: option.value })}
                      className="mt-1 accent-(--accent)"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium">{option.label}</span>
                    </span>
                    {active && <Check className="w-4 h-4 mt-0.5 shrink-0 text-(--accent)" />}
                  </label>
                );
              })}
            </div>
          </Section>

          {/* Copy */}
          <Section title="رقم الآية عند النسخ" icon={Copy}>
            <div className="space-y-2">
              {copyStyles.map((c) => (
                <button
                  key={c.value}
                  onClick={() => update({ copyNumberStyle: c.value })}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-smooth ${settings.copyNumberStyle === c.value
                    ? 'border-(--accent) bg-(--accent)/5'
                    : 'border-(--border) hover:bg-(--bg-secondary)'
                    }`}
                >
                  <span className="text-sm font-medium">{c.label}</span>
                  {settings.copyNumberStyle === c.value && <Check className="w-4 h-4 text-(--accent)" />}
                </button>
              ))}
              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-(--border) px-3 py-3">
                <div className="min-w-0">
                  <span className="block text-sm font-medium">
                    حذف رقم الآية الأخيرة
                  </span>
                  <span className="mt-1 block text-xs text-(--text-secondary)">
                    إظهار رقم الآية الأخيرة
                  </span>
                </div>
                <Toggle
                  active={settings.omitLastAyahNumber}
                  onClick={() => update({ omitLastAyahNumber: !settings.omitLastAyahNumber })}
                  label={settings.omitLastAyahNumber ? 'اظهار' : 'اخفاء'}
                />
              </div>
            </div>
          </Section>

          {/* Sources */}
          <div className="flex justify-end
           text-xs text-(--text-secondary)">
            <a
              href="https://tanzil.net"
              target="_blank"
              rel="noreferrer"
              className="inline rounded px-1 -mx-1 text-(--accent-dark)
             dark:bg-[color-mix(in_srgb,var(--accent-light)_15%,transparent)]
             bg-[color-mix(in_srgb,var(--accent)_20%,transparent)]"
            >
              Tanzil Project – tanzil.net
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
