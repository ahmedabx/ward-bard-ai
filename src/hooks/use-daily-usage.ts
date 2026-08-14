import { useCallback, useEffect, useState } from 'react';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Client-side daily usage counter (UI only).
 * Stores { date, used } under `medbard.usage.<key>` in localStorage.
 */
export function useDailyUsage(key: string, limit: number) {
  const storageKey = `medbard.usage.${key}`;

  const read = useCallback((): number => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return 0;
      const parsed = JSON.parse(raw) as { date?: string; used?: number };
      if (parsed.date !== todayKey()) return 0;
      return Math.max(0, Number(parsed.used) || 0);
    } catch {
      return 0;
    }
  }, [storageKey]);

  const [used, setUsed] = useState<number>(() => read());

  useEffect(() => {
    setUsed(read());
  }, [read]);

  const consume = useCallback(
    (amount = 1) => {
      setUsed((prev) => {
        const next = Math.min(limit, prev + amount);
        try {
          localStorage.setItem(storageKey, JSON.stringify({ date: todayKey(), used: next }));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [limit, storageKey],
  );

  const remaining = Math.max(0, limit - used);

  return { used, remaining, limit, limitReached: remaining <= 0, consume };
}
