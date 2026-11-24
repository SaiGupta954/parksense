import { useEffect, useRef, useState } from 'react';
import { formatUntil, isParkable } from '../engine';
import { useEvaluation, useNow } from '../lib/hooks';
import { speak } from '../lib/speech';

const LEAD_MS = 10 * 60_000;

function fmtLeft(ms: number): string {
  if (ms <= 0) return '0:00';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}:${String(s).padStart(2, '0')}`;
}

/** "Remind me 10 min before" — browser Notification API + an on-screen countdown ring. No server push. */
export function LeaveBy() {
  const { at, result } = useEvaluation();
  const now = useNow(1000);
  const [reminderAt, setReminderAt] = useState<number | null>(null);
  const [fired, setFired] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const until = result.allowedUntil;
  const untilMs = until?.getTime() ?? null;

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  // A reminder set for an end time that no longer applies is cancelled.
  useEffect(() => {
    if (reminderAt != null && untilMs != null && reminderAt !== untilMs - LEAD_MS) {
      if (timer.current) window.clearTimeout(timer.current);
      setReminderAt(null);
    }
  }, [untilMs, reminderAt]);

  if (!isParkable(result.status) || !until || untilMs == null) return null;
  const total = Math.max(1, untilMs - at.getTime());
  const left = Math.max(0, untilMs - now);
  const frac = Math.min(1, left / total);
  const R = 26;
  const C = 2 * Math.PI * R;

  const arm = async () => {
    let canNotify = false;
    if ('Notification' in window) {
      if (Notification.permission === 'granted') canNotify = true;
      else if (Notification.permission !== 'denied')
        canNotify = (await Notification.requestPermission()) === 'granted';
    }
    const fireAt = untilMs - LEAD_MS;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(
      () => {
        const msg = `Move your car by ${formatUntil(until, new Date())}.`;
        setFired(true);
        if (canNotify)
          new Notification('ParkSense: 10 minutes left', { body: msg, tag: 'parksense-leave' });
        else speak(`Ten minutes left. ${msg}`);
      },
      Math.max(0, fireAt - Date.now()),
    );
    setReminderAt(fireAt);
    setFired(false);
    setNote(
      canNotify
        ? null
        : 'Notifications are off, so I’ll show it here and speak it aloud instead. Keep this tab open.',
    );
  };

  const cancel = () => {
    if (timer.current) window.clearTimeout(timer.current);
    setReminderAt(null);
    setNote(null);
  };

  const soon = left <= LEAD_MS;

  return (
    <section
      aria-label="Leave-by reminder"
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border p-3 ${
        fired || soon ? 'border-regulatory/50 bg-regulatory/10' : 'border-white/[0.07] bg-black/20'
      }`}
    >
      <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0" aria-hidden>
        <circle cx="32" cy="32" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
        <circle
          cx="32"
          cy="32"
          r={R}
          fill="none"
          stroke={soon ? '#E0322B' : '#FFB347'}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - frac)}
          transform="rotate(-90 32 32)"
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
        <text
          x="32"
          y="36"
          textAnchor="middle"
          fontSize="11"
          fontWeight="700"
          fill="#F4F1EA"
          fontFamily="Overpass, sans-serif"
        >
          {fmtLeft(left)}
        </text>
      </svg>
      <div className="min-w-[11rem] flex-1 text-sm">
        <p className="font-semibold text-signwhite">
          {fired
            ? '⏰ 10 minutes left — time to move!'
            : `Leave by ${formatUntil(until, new Date(now))}`}
        </p>
        <p className="text-xs text-white/50">
          {reminderAt
            ? `Reminder set for ${formatUntil(new Date(reminderAt), new Date(now))}.`
            : 'Get a nudge before the rules change.'}
        </p>
        {note && <p className="mt-1 text-[11px] text-yellow-200/80">{note}</p>}
      </div>
      {reminderAt ? (
        <button
          type="button"
          onClick={cancel}
          className="rounded-full px-3 py-1.5 text-xs text-white/60 hover:text-white"
        >
          Cancel
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void arm()}
          className="rounded-full border border-sodium/40 px-3 py-1.5 text-xs font-semibold text-sodium hover:bg-sodium/10"
        >
          Remind me 10 min before
        </button>
      )}
    </section>
  );
}
