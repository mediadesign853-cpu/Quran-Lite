import { useCallback, useEffect, useState } from 'react';

const GENERIC_ERROR = 'تعذّر تنزيل التحديث أو تثبيته. تحقق من اتصالك بالإنترنت ثم أعد المحاولة.';

/** Bridges the trusted Electron updater events into the themed React overlay. */
export function useDesktopUpdate() {
  const [version, setVersion] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const bridge = window.quranApp?.updater;
    if (!bridge) return;

    const offAvailable = bridge.onAvailable((payload) => {
      const nextVersion = typeof payload?.version === 'string' ? payload.version.trim() : '';
      setError(null);
      setProgress(null);
      setVersion(nextVersion || 'جديد');
    });

    const offProgress = bridge.onProgress((payload) => {
      if (!Number.isFinite(payload?.percent)) return;
      const percent = Math.max(0, Math.min(100, Math.round(payload.percent)));
      setVersion(null);
      setError(null);
      setProgress(percent);
    });

    const offError = bridge.onError((payload) => {
      // Keep the raw detail in the console; the visible dialog stays fully Arabic.
      if (typeof payload?.message === 'string') console.error('Desktop updater:', payload.message);
      setVersion(null);
      setProgress(null);
      setError(GENERIC_ERROR);
    });

    return () => {
      offAvailable();
      offProgress();
      offError();
    };
  }, []);

  const respond = useCallback(async (accepted: boolean) => {
    const bridge = window.quranApp?.updater;
    if (!bridge) return false;
    try {
      return await bridge.respond(accepted);
    } catch {
      return false;
    }
  }, []);

  const accept = useCallback(() => {
    setVersion(null);
    setError(null);
    setProgress(0);
    void respond(true);
  }, [respond]);

  const dismiss = useCallback(() => {
    setVersion(null);
    void respond(false);
  }, [respond]);

  const clearError = useCallback(() => setError(null), []);

  return { version, progress, error, accept, dismiss, clearError };
}
