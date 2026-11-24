import { useEffect, useMemo, useState } from 'react';
import { evaluate, weekGrid, type Evaluation, type WeekCell } from '../engine';
import { selectAt, useStore } from '../store';

export function useReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mql = window.matchMedia?.(query);
    if (!mql) return;
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export function useAt(): Date {
  const baseTime = useStore((s) => s.baseTime);
  const offsetMin = useStore((s) => s.offsetMin);
  return useMemo(() => selectAt({ baseTime, offsetMin }), [baseTime, offsetMin]);
}

/** Evaluation at the scrubbed moment. Re-runs instantly when rules, time or profile change. */
export function useEvaluation(): { at: Date; result: Evaluation } {
  const rules = useStore((s) => s.rules);
  const profile = useStore((s) => s.profile);
  const at = useAt();
  const result = useMemo(() => evaluate(rules, at, profile), [rules, at, profile]);
  return { at, result };
}

export function useWeekGrid(): WeekCell[][] {
  const rules = useStore((s) => s.rules);
  const profile = useStore((s) => s.profile);
  const baseTime = useStore((s) => s.baseTime);
  const day = new Date(baseTime).toDateString();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => weekGrid(rules, new Date(baseTime), profile), [rules, profile, day]);
}

/** Re-render every `ms` (for countdowns). */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

/** A value that only updates after it stops changing for `ms`. */
export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return v;
}
