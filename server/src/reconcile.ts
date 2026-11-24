import type { ReadResult, SignRule } from './schema.js';

/**
 * "AI reads, code decides" — applied to extraction too.
 * The model's transcription (rawText) is usually right, but its structured fields
 * sometimes drift: it invents weekdays, mislabels sign types, or flips AM/PM.
 * Here we re-derive what we can deterministically from rawText and override the
 * model where they disagree. Every correction is noted and lowers confidence so
 * the UI asks the user to confirm.
 */

const DAY_WORD =
  /\b(MON(DAY)?S?|TUE(S|SDAY)?S?|WED(NESDAY)?S?|THU(R|RS|RSDAY)?S?|FRI(DAY)?S?|SAT(URDAY)?S?|SUN(DAY)?S?|WEEKDAYS?|DAILY|EVERY ?DAY)\b/;

const TIME = String.raw`(\d{1,2})(?::(\d{2}))?\s*(AM|PM|A\.M\.|P\.M\.)?`;
const RANGE = new RegExp(`${TIME}\\s*(?:-|–|—|TO|THRU)\\s*${TIME}`, 'g');

function to24(h: string, m: string | undefined, ampm: string | undefined): string | null {
  let hour = Number(h);
  const min = Number(m ?? '0');
  if (!ampm || hour < 1 || hour > 12 || min > 59) return null;
  const pm = ampm.startsWith('P');
  if (pm && hour !== 12) hour += 12;
  if (!pm && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** All "8AM - 6PM" style ranges in the text (both ends must carry AM/PM, or share the second's). */
export function timeRanges(text: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const m of text.toUpperCase().matchAll(RANGE)) {
    const endAmPm = m[6];
    const start = to24(m[1] ?? '', m[2], m[3] ?? endAmPm);
    const end = to24(m[4] ?? '', m[5], endAmPm);
    if (start && end) out.push([start, end]);
  }
  return out;
}

export function mentionsDays(text: string): boolean {
  return DAY_WORD.test(text.toUpperCase().replace(/EXCEPT[^\n]*/g, ''));
}

function typeFromText(text: string, current: SignRule['type']): SignRule['type'] {
  const t = text.toUpperCase();
  if (/TOW[- ]?AWAY/.test(t)) return current === 'no_stopping' ? current : 'tow_away';
  if (/STREET\s+(CLEANING|SWEEPING)|SWEEP/.test(t)) return 'street_cleaning';
  if (/LOADING/.test(t)) return 'loading_zone';
  return current;
}

function zoneFromText(text: string): string | null {
  const m =
    /\b(?:ZONE|AREA|DISTRICT)\s+([A-Z0-9]{1,3})\b|\bPERMIT\s+([A-Z0-9]{1,3})\b(?!\s*HOUR)/.exec(
      text.toUpperCase(),
    );
  const zone = m?.[1] ?? m?.[2] ?? null;
  return zone && !/^(ONLY|PARKING|HOLDERS?)$/.test(zone) ? zone : null;
}

export function reconcileSign(sign: SignRule): { sign: SignRule; fixes: string[] } {
  const fixes: string[] = [];
  const text = sign.rawText;
  let next: SignRule = { ...sign };

  if (next.days.length > 0 && !mentionsDays(text)) {
    fixes.push(
      `no days are printed, so it applies every day (model guessed ${next.days.join(',')})`,
    );
    next = { ...next, days: [] };
  }

  const type = typeFromText(text, next.type);
  if (type !== next.type) {
    fixes.push(
      `type is ${type.replace('_', ' ')} per its text (model said ${next.type.replace('_', ' ')})`,
    );
    next = { ...next, type };
  }

  if (!next.permitZone && /PERMIT/i.test(text)) {
    const zone = zoneFromText(text);
    if (zone) {
      fixes.push(`permit zone ${zone} read from its text`);
      next = { ...next, permitZone: zone };
    }
  }

  const ranges = timeRanges(text);
  // Only trust the text when it has exactly one unambiguous range.
  if (!next.anytime && ranges.length === 1) {
    const [start, end] = ranges[0] as [string, string];
    if (start !== next.start || end !== next.end) {
      fixes.push(
        `times are ${start}–${end} per its text (model said ${next.start ?? '?'}–${next.end ?? '?'})`,
      );
      next = { ...next, start, end };
    }
  }

  if (fixes.length) next = { ...next, confidence: Math.min(next.confidence, 0.69) };
  return { sign: next, fixes };
}

export function reconcile(result: ReadResult): ReadResult {
  const notes: string[] = result.notes ? [result.notes] : [];
  const signs = result.signs.map((s) => {
    const { sign, fixes } = reconcileSign(s);
    if (fixes.length) notes.push(`Sign ${s.order}: ${fixes.join('; ')}.`);
    return sign;
  });
  return { ...result, signs, notes: notes.join(' ') };
}
