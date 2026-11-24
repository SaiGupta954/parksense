import { minuteOfDay, parseHHMM, MINUTES_PER_DAY, describeDays, formatClock } from './time';
import {
  DAY_CODES,
  DAY_INDEX,
  type Profile,
  type SignRule,
  type SignType,
  type Status,
} from './types';

const DAY_WORD =
  /^(SUN(DAYS?)?|MON(DAYS?)?|TUE(S|SDAYS?)?|WED(NESDAYS?)?|THU(R|RS|RSDAYS?)?|FRI(DAYS?)?|SAT(URDAYS?)?)$/;
const PREFIX_INDEX: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

function dayFromWord(word: string): number | null {
  if (!DAY_WORD.test(word)) return null;
  return PREFIX_INDEX[word.slice(0, 3)] ?? null;
}

/** Expand a Mon-first range, e.g. SAT..SUN, FRI..MON. */
function expandRange(from: number, to: number): number[] {
  const monFirst = (d: number) => (d + 6) % 7;
  const out: number[] = [];
  let pos = monFirst(from);
  const end = monFirst(to);
  for (let guard = 0; guard < 7; guard++) {
    out.push((pos + 1) % 7);
    if (pos === end) break;
    pos = (pos + 1) % 7;
  }
  return out;
}

/**
 * Parse days mentioned in free text such as "EXCEPT SUNDAY", "EXCEPT SAT & SUN",
 * "EXCEPT SAT-SUN". Holidays and other words are ignored.
 */
export function parseDaysInText(text: string | null | undefined): Set<number> {
  const result = new Set<number>();
  if (!text) return result;
  const tokens = text.toUpperCase().match(/[A-Z]+|[-–—]/g) ?? [];
  for (let i = 0; i < tokens.length; i++) {
    const day = dayFromWord(tokens[i] ?? '');
    if (day == null) continue;
    const sep = tokens[i + 1];
    const nextDay = tokens[i + 2] != null ? dayFromWord(tokens[i + 2] ?? '') : null;
    if (sep && /^([-–—]|THRU|THROUGH|TO)$/.test(sep) && nextDay != null) {
      expandRange(day, nextDay).forEach((d) => result.add(d));
      i += 2;
    } else {
      result.add(day);
    }
  }
  return result;
}

/** Index set (0 = Sunday) of the days a rule is in force. Missing days mean every day. */
export function effectiveDays(rule: SignRule): Set<number> {
  const base = rule.days.length > 0 ? rule.days : DAY_CODES;
  const days = new Set(base.map((d) => DAY_INDEX[d]));
  const exceptText = rule.exceptText ?? '';
  if (/EXCEPT/i.test(exceptText) || /EXCEPT/i.test(rule.rawText)) {
    // Only take days that appear after the word EXCEPT.
    const source = /EXCEPT/i.test(exceptText) ? exceptText : rule.rawText;
    const afterExcept = source.slice(source.toUpperCase().indexOf('EXCEPT'));
    parseDaysInText(afterExcept).forEach((d) => days.delete(d));
  }
  return days;
}

export interface Window {
  /** Minutes since midnight. */
  start: number;
  end: number;
  allDay: boolean;
  overnight: boolean;
}

export function timeWindow(rule: SignRule): Window {
  const s = parseHHMM(rule.start);
  const e = parseHHMM(rule.end);
  if (rule.anytime || (s == null && e == null)) {
    return { start: 0, end: MINUTES_PER_DAY, allDay: true, overnight: false };
  }
  const start = s ?? 0;
  const end = e ?? MINUTES_PER_DAY;
  if (start === end) return { start: 0, end: MINUTES_PER_DAY, allDay: true, overnight: false };
  return { start, end, allDay: false, overnight: start > end };
}

/** Precomputed, fast form of a rule. */
export interface CompiledRule {
  rule: SignRule;
  days: Set<number>;
  window: Window;
}

export function compileRule(rule: SignRule): CompiledRule {
  return { rule, days: effectiveDays(rule), window: timeWindow(rule) };
}

/** Is the rule's schedule in force at `at`? Overnight windows belong to the day they start. */
export function isActiveAt(compiled: CompiledRule, at: Date): boolean {
  const { days, window } = compiled;
  const dow = at.getDay();
  const m = minuteOfDay(at);
  if (window.allDay) return days.has(dow);
  if (!window.overnight) return days.has(dow) && m >= window.start && m < window.end;
  return (days.has(dow) && m >= window.start) || (days.has((dow + 6) % 7) && m < window.end);
}

/** Does the sign govern the side of the pole the user is parking on? */
export function facesSide(rule: SignRule, side: Profile['side']): boolean {
  if (side === 'both' || rule.arrow === 'none' || rule.arrow === 'both') return true;
  return rule.arrow === side;
}

/** Most restrictive first. */
export const TYPE_PRIORITY: Record<SignType, number> = {
  tow_away: 0,
  no_stopping: 0,
  no_parking: 1,
  street_cleaning: 2,
  loading_zone: 3,
  permit_only: 4,
  metered: 5,
  time_limit: 6,
  allowed: 7,
  other: 99,
};

export function normalizeZone(zone: string | null | undefined): string {
  return (zone ?? '')
    .toUpperCase()
    .replace(/\b(ZONE|AREA|PERMIT|DISTRICT|NO\.?)\b/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

export function permitMatches(rule: SignRule, profile: Profile): boolean {
  const signZone = normalizeZone(rule.permitZone);
  const mine = normalizeZone(profile.permitZone);
  return signZone !== '' && mine !== '' && signZone === mine;
}

export type SignEffect =
  { kind: 'restricts'; status: Status } | { kind: 'exempt'; why: string } | { kind: 'ignored' };

/** What does this sign mean for this driver, assuming its schedule is in force? */
export function signEffect(rule: SignRule, profile: Profile): SignEffect {
  switch (rule.type) {
    case 'tow_away':
    case 'no_stopping':
    case 'no_parking':
    case 'street_cleaning':
      return { kind: 'restricts', status: 'NOT_ALLOWED' };
    case 'loading_zone':
      return profile.isCommercial
        ? { kind: 'exempt', why: 'your commercial vehicle can use the loading zone' }
        : { kind: 'restricts', status: 'NOT_ALLOWED' };
    case 'permit_only':
      return permitMatches(rule, profile)
        ? { kind: 'exempt', why: `your Zone ${normalizeZone(profile.permitZone)} permit matches` }
        : { kind: 'restricts', status: 'PERMIT_ONLY' };
    case 'metered':
      return permitMatches(rule, profile)
        ? { kind: 'exempt', why: `your Zone ${normalizeZone(profile.permitZone)} permit is exempt` }
        : { kind: 'restricts', status: 'PAID' };
    case 'time_limit':
      return permitMatches(rule, profile)
        ? { kind: 'exempt', why: `your Zone ${normalizeZone(profile.permitZone)} permit is exempt` }
        : { kind: 'restricts', status: 'TIME_LIMITED' };
    case 'allowed':
      return { kind: 'restricts', status: rule.maxMinutes != null ? 'TIME_LIMITED' : 'ALLOWED' };
    default:
      return { kind: 'ignored' };
  }
}

/** "Tue 10:00 AM–12:00 PM", "Mon–Fri any time", "every day 10:00 PM–6:00 AM". */
export function describeSchedule(rule: SignRule): string {
  const compiled = compileRule(rule);
  const days = describeDays(compiled.days);
  const w = compiled.window;
  if (w.allDay) return days === 'every day' ? 'at all times' : `${days}, all day`;
  return `${days} ${formatClock(w.start)}–${formatClock(w.end)}`;
}
