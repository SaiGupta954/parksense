import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addMinutes,
  formatTime,
  statusAt,
  statusLabel,
  weekdayLong,
  weekdayShort,
} from '../engine';
import { STATUS_COLOR } from '../lib/answer';
import { useEvaluation } from '../lib/hooks';
import { MAX_OFFSET, useStore } from '../store';

const STEP = 15;

export function Scrubber() {
  const offset = useStore((s) => s.offsetMin);
  const setOffset = useStore((s) => s.setOffset);
  const goLive = useStore((s) => s.goLive);
  const baseTime = useStore((s) => s.baseTime);
  const rules = useStore((s) => s.rules);
  const profile = useStore((s) => s.profile);
  const { at, result } = useEvaluation();
  const [playing, setPlaying] = useState(false);
  const raf = useRef<number | null>(null);

  const base = useMemo(() => new Date(baseTime), [baseTime]);

  // One colored block per hour for the next 7 days.
  const strip = useMemo(
    () =>
      Array.from({ length: 168 }, (_, h) => {
        const t = addMinutes(base, h * 60);
        return statusAt(rules, t, profile).status;
      }),
    [base, rules, profile],
  );

  const ticks = useMemo(() => {
    const out: Array<{ pct: number; label: string }> = [];
    const first = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1);
    for (let d = 0; d < 7; d++) {
      const t = new Date(first.getFullYear(), first.getMonth(), first.getDate() + d);
      const min = (t.getTime() - base.getTime()) / 60_000;
      if (min > 0 && min < MAX_OFFSET)
        out.push({ pct: (min / MAX_OFFSET) * 100, label: weekdayShort(t) });
    }
    return out;
  }, [base]);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      const cur = useStore.getState().offsetMin;
      const next = cur + dt * 0.25; // ~4 hours per second
      if (next >= MAX_OFFSET) {
        setOffset(MAX_OFFSET);
        setPlaying(false);
        return;
      }
      setOffset(next);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [playing, setOffset]);

  const valueText = `${weekdayLong(at)} ${formatTime(at)}, ${statusLabel(result.status, result.maxMinutes)}`;

  return (
    <div className="flex items-center gap-3 px-4 py-3 lg:px-6">
      <button
        type="button"
        onClick={() => {
          if (!playing && offset >= MAX_OFFSET) setOffset(0);
          setPlaying((p) => !p);
        }}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-sm hover:bg-white/10"
        aria-label={playing ? 'Pause time-travel' : 'Play through the week'}
      >
        {playing ? '❚❚' : '▶'}
      </button>

      <div className="relative min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between text-[11px] text-white/50">
          <span className="font-sign font-bold tracking-widest text-white/70">TIME-TRAVEL</span>
          <span className="font-sign text-sm font-bold text-signwhite">
            {weekdayLong(at)} {formatTime(at)}
          </span>
        </div>
        <div className="relative h-9">
          <div
            className="absolute inset-x-0 top-1/2 flex h-3 -translate-y-1/2 overflow-hidden rounded-full"
            aria-hidden
          >
            {strip.map((s, i) => (
              <span
                key={i}
                className="h-full flex-1"
                style={{ background: STATUS_COLOR[s], opacity: 0.75 }}
              />
            ))}
          </div>
          {ticks.map((t) => (
            <span
              key={t.pct}
              aria-hidden
              className="absolute top-0 h-full border-l border-asphalt/80"
              style={{ left: `${t.pct}%` }}
            >
              <span className="absolute -bottom-3.5 -translate-x-1/2 text-[10px] text-white/40">
                {t.label}
              </span>
            </span>
          ))}
          <input
            type="range"
            className="scrubber absolute inset-0"
            min={0}
            max={MAX_OFFSET}
            step={STEP}
            value={Math.round(offset / STEP) * STEP}
            onChange={(e) => {
              setPlaying(false);
              setOffset(Number(e.target.value));
            }}
            aria-label="Time-travel through the next 7 days"
            aria-valuetext={valueText}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          setPlaying(false);
          goLive();
        }}
        disabled={offset === 0}
        className="shrink-0 rounded-full border border-permit/40 px-3 py-1.5 text-xs font-semibold text-permit hover:bg-permit/10 disabled:opacity-40"
      >
        Now
      </button>
    </div>
  );
}
