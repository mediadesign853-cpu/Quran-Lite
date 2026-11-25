import { useCallback, useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { BookOpen, RefreshCw, X } from 'lucide-react';
import { trapFocus } from '@/lib/focusTrap';

type UpdatePageProps = {
  version: string;
  onUpdate: () => void;
  onDismiss: () => void;
  /** When present, the dialog switches to a read-only Arabic error state. */
  error?: string | null;
  onCloseError?: () => void;
};

/** Full-screen Arabic update prompt with install and dismiss actions. */
export default function UpdatePage({
  version,
  onUpdate,
  onDismiss,
  error = null,
  onCloseError,
}: UpdatePageProps) {
  const isError = Boolean(error);
  const close = isError ? (onCloseError ?? onDismiss) : onDismiss;
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const handleUpdate = useCallback(() => {
    onUpdate();
  }, [onUpdate]);

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    close();
  }, [close]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    return trapFocus(dialog, isError ? closeRef.current : primaryRef.current);
  }, [isError]);

  return (
    <div
      dir="rtl"
      lang="ar"
      className="fixed inset-0 z-60 flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-dialog-title"
      onKeyDown={handleKeyDown}
    >
      {/* backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={close}
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="max-w-md w-full rounded-3xl border border-(--border) bg-(--bg-card) p-6 shadow-2xl animate-scale-in text-right"
      >
        <div className="flex flex-col items-center gap-3 mb-3">
          <div className="w-14 h-14 rounded-2xl bg-(--accent)/10 flex items-center justify-center text-(--accent)">
            {isError ? (
              <RefreshCw className="w-7 h-7" />
            ) : (
              <BookOpen className="w-7 h-7" />
            )}
          </div>
          <div className="text-(--text-secondary) text-xs tracking-wide">
            قارئ القرآن بدون اتصال
          </div>
        </div>

        <h2 id="update-dialog-title" className="text-xl font-bold text-(--text-primary) mb-1">
          {isError ? 'تعذّر التحديث' : 'تحديث جديد متاح'}
        </h2>
        <p className="text-(--text-secondary) text-sm mb-4 leading-relaxed">
          {isError
            ? error
            : `هناك إصدار جديد من البرنامج${version ? ` (الإصدار ${version})` : ''}. هل تريد التحديث الآن؟`}
        </p>

        {!isError && (
          <div className="text-(--text-secondary) text-xs mb-6 text-right">
            قارئ القرآن الكريم
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          {isError ? (
            <button
              ref={primaryRef}
              type="button"
              onClick={close}
              className="flex-1 rounded-xl bg-(--accent) px-4 py-2.5 text-sm font-medium text-white transition-smooth hover:bg-(--accent-dark)"
            >
              حسناً
            </button>
          ) : (
            <>
              <button
                ref={primaryRef}
                type="button"
                onClick={handleUpdate}
                className="flex-1 rounded-xl bg-(--accent) px-4 py-2.5 text-sm font-medium text-white transition-smooth hover:bg-(--accent-dark)"
              >
                تحديث الآن
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="flex-1 rounded-xl border border-(--border) px-4 py-2.5 text-sm font-medium text-(--text-primary) bg-(--bg-secondary) transition-smooth hover:bg-(--border-light)"
              >
                في وقت لاحق
              </button>
            </>
          )}
        </div>

        <button
          ref={closeRef}
          type="button"
          onClick={close}
          className="absolute left-4 top-4 p-2 rounded-md text-(--text-secondary) hover:text-(--text-primary) transition-smooth"
          aria-label="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      {!isError && (
        <RefreshCw className="fixed left-4 bottom-4 w-6 h-6 text-(--text-secondary) animate-spin" aria-hidden="true" />
      )}
    </div>
  );
}
