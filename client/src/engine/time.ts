import { DAY_CODES, DAY_INDEX, type Day } from './types';

export const MINUTES_PER_DAY = 1440;
export const MINUTES_PER_WEEK = MINUTES_PER_DAY * 7;
const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "HH:MM" (24h, "24:00" allowed) → minutes since midnight, or null when not parseable. */
export function parseHHMM(value: string | null | undefined): number | null {
  if (value == null) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 24 || m > 59 || (h === 24 && m !== 0)) return null;
  return h * 60 + m;
}

export function toHHMM(minutes: number): string {
  const clamped = Math.max(0, Math.min(MINUTES_PER_DAY, Math.round(minutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Minutes since midnight → "4:00 PM". */
export function formatClock(minutes: number): string {
  const total = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  if (minutes === MINUTES_PER_DAY) return '12:00 AM';
  const suffix = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function minuteOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function formatTime(date: Date): string {
  return formatClock(minuteOfDay(date));
}

export function weekdayLong(date: Date): string {
  return WEEKDAY_LONG[date.getDay()] ?? '';
}

export function weekdayShort(date: Date): string {
  return WEEKDAY_SHORT[date.getDay()] ?? '';
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/** Calendar-day difference (DST-safe). */
export function dayDiff(target: Date, ref: Date): number {
  const a = startOfDay(target);
  const b = startOfDay(ref);
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

/** "today" | "tomorrow" | "Thursday" | "Thu Nov 26". */
export function relativeDay(target: Date, ref: Date): string {
  const diff = dayDiff(target, ref);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff > 1 && diff < 7) return weekdayLong(target);
  return `${weekdayShort(target)} ${target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

/** "today at 12:00 PM". */
export function formatWhen(target: Date, ref: Date): string {
  return `${relativeDay(target, ref)} at ${formatTime(target)}`;
}

/** Short label: "4:00 PM" if today, "4:00 PM tomorrow", "4:00 PM Thu". */
export function formatUntil(target: Date, ref: Date): string {
  const diff = dayDiff(target, ref);
  const time = formatTime(target);
  if (diff === 0) return time;
  if (diff === 1) return `${time} tomorrow`;
  return `${time} ${weekdayShort(target)}`;
}

/** Days in display order (Mon..Sun), compressed to ranges: "Mon–Fri", "Tue", "Mon, Wed, Fri". */
export function describeDays(dayIndexes: ReadonlySet<number>): string {
  if (dayIndexes.size === 7) return 'every day';
  if (dayIndexes.size === 0) return 'no days';
  const order = DAY_CODES.map((d) => DAY_INDEX[d]);
  const present = order.map((i) => dayIndexes.has(i));
  const runs: Array<[number, number]> = [];
  for (let i = 0; i < 7; i++) {
    if (!present[i]) continue;
    const last = runs[runs.length - 1];
    if (last && last[1] === i - 1) last[1] = i;
    else runs.push([i, i]);
  }
  const label = (pos: number) => WEEKDAY_SHORT[order[pos] ?? 0] ?? '';
  return runs
    .map(([a, b]) =>
      a === b ? label(a) : b === a + 1 ? `${label(a)}, ${label(b)}` : `${label(a)}–${label(b)}`,
    )
    .join(', ');
}

export function dayCodeOf(date: Date): Day {
  const idx = date.getDay();
  return (Object.keys(DAY_INDEX) as Day[]).find((d) => DAY_INDEX[d] === idx) ?? 'SUN';
}
