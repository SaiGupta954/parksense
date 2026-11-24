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
    setNote(canNotify ? null : 'Notifications off — I’ll speak it. Keep this tab open.');
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
      className={`flex items-center gap-3 rounded-2xl border px-3 py-2 ${
        fired || soon ? 'border-regulatory/50 bg-regulatory/10' : 'border-white/[0.07] bg-black/20'
      }`}
    >
      <svg width="44" height="44" viewBox="0 0 64 64" className="shrink-0" aria-hidden>
        <circle cx="32" cy="32" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={R}
          fill="none"
          stroke={soon ? '#E0322B' : '#FFB347'}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - frac)}
          transform="rotate(-90 32 32)"
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="font-sign text-lg font-black text-signwhite">{fmtLeft(left)}</p>
        <p className="text-xs text-white/50">{fired ? '⏰ Time to move!' : 'left'}</p>
        {note && <p className="text-[11px] text-yellow-200/80">{note}</p>}
      </div>
      <button
        type="button"
        onClick={reminderAt ? cancel : () => void arm()}
        aria-pressed={reminderAt != null}
        aria-label={reminderAt ? 'Cancel reminder' : 'Remind me 10 min before'}
        title={reminderAt ? 'Reminder on — tap to cancel' : 'Remind me 10 min before'}
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border text-lg ${
          reminderAt ? 'border-sodium bg-sodium/20' : 'border-white/10 bg-white/5 hover:bg-white/10'
        }`}
      >
        {reminderAt ? '🔔' : '🔕'}
      </button>
    </section>
  );
}
