import { describe, expect, it } from 'vitest';
import {
  effectiveDays,
  evaluate,
  formatClock,
  parseDaysInText,
  parseHHMM,
  statusAt,
  weekGrid,
  type Profile,
  type SignRule,
} from './index';

// 2026-11-24 is a Tuesday. All dates are local time.
const at = (day: number, h: number, m = 0) => new Date(2026, 10, day, h, m);
const TUE = 24;
const WED = 25;
const THU = 26;
const SAT = 28;
const SUN = 29;
const MON = 30;

const me: Profile = { side: 'both' };

function sign(partial: Partial<SignRule>): SignRule {
  return {
    order: 1,
    rawText: 'SIGN',
    type: 'no_parking',
    days: [],
    anytime: false,
    start: null,
    end: null,
    maxMinutes: null,
    permitZone: null,
    exceptText: null,
    arrow: 'none',
    confidence: 0.95,
    ...partial,
  };
}

const cleaning = sign({
  order: 2,
  rawText: 'NO PARKING 10AM-12PM TUE',
  type: 'street_cleaning',
  days: ['TUE'],
  start: '10:00',
  end: '12:00',
});

describe('time helpers', () => {
  it('parses and formats 24h times', () => {
    expect(parseHHMM('07:30')).toBe(450);
    expect(parseHHMM('24:00')).toBe(1440);
    expect(parseHHMM('25:00')).toBeNull();
    expect(parseHHMM('8am')).toBeNull();
    expect(formatClock(0)).toBe('12:00 AM');
    expect(formatClock(16 * 60)).toBe('4:00 PM');
    expect(formatClock(12 * 60 + 5)).toBe('12:05 PM');
  });

  it('parses except-day text including ranges', () => {
    expect([...parseDaysInText('EXCEPT SUNDAY')]).toEqual([0]);
    expect([...parseDaysInText('EXCEPT SAT & SUN')].sort()).toEqual([0, 6]);
    expect([...parseDaysInText('except Sat-Sun and holidays')].sort()).toEqual([0, 6]);
    expect(parseDaysInText('EXCEPT BY PERMIT').size).toBe(0);
  });
});

describe('evaluate — basics', () => {
  it('no signs → allowed, with a note that unsigned rules may apply', () => {
    const r = evaluate([], at(TUE, 9), me);
    expect(r.status).toBe('ALLOWED');
    expect(r.controllingSignOrder).toBeNull();
    expect(r.reasonSteps.some((s) => /Unsigned rules/.test(s.text))).toBe(true);
  });

  it('street cleaning applies inside its window and explains why', () => {
    const r = evaluate([cleaning], at(TUE, 11, 5), me);
    expect(r.status).toBe('NOT_ALLOWED');
    expect(r.controllingSignOrder).toBe(2);
    expect(r.nextAllowedAt).toEqual(at(TUE, 12));
    const text = r.reasonSteps.map((s) => s.text).join(' ');
    expect(text).toContain("Sign 2 says 'NO PARKING 10AM-12PM TUE'");
    expect(text).toContain("It's Tuesday 11:05 AM");
    expect(text).toContain('Next allowed: today at 12:00 PM');
  });

  it('street cleaning does not apply on other days or outside the window', () => {
    expect(evaluate([cleaning], at(WED, 11), me).status).toBe('ALLOWED');
    expect(evaluate([cleaning], at(TUE, 12), me).status).toBe('ALLOWED');
    expect(evaluate([cleaning], at(TUE, 9, 59), me).status).toBe('ALLOWED');
  });

  it('allowedUntil points to the start of the next restriction', () => {
    const r = evaluate([cleaning], at(TUE, 8), me);
    expect(r.status).toBe('ALLOWED');
    expect(r.allowedUntil).toEqual(at(TUE, 10));
  });

  it('missing days mean every day', () => {
    const rule = sign({ start: '02:00', end: '05:00' });
    expect(effectiveDays(rule).size).toBe(7);
    expect(evaluate([rule], at(SUN, 3), me).status).toBe('NOT_ALLOWED');
    expect(evaluate([rule], at(THU, 3), me).status).toBe('NOT_ALLOWED');
  });
});

describe('evaluate — overnight and anytime', () => {
  const overnight = sign({
    rawText: 'NO PARKING 10PM-6AM MON',
    days: ['MON'],
    start: '22:00',
    end: '06:00',
  });

  it('overnight range applies late on its start day', () => {
    expect(evaluate([overnight], at(MON, 23), me).status).toBe('NOT_ALLOWED');
  });

  it('overnight range spills past midnight into the next morning', () => {
    // Monday Nov 30 22:00 → Tuesday Dec 1 06:00
    expect(evaluate([overnight], new Date(2026, 11, 1, 3), me).status).toBe('NOT_ALLOWED');
    expect(evaluate([overnight], new Date(2026, 11, 1, 6), me).status).toBe('ALLOWED');
  });

  it('overnight range does not apply in the morning of its start day', () => {
    expect(evaluate([overnight], at(MON, 3), me).status).toBe('ALLOWED');
  });

  it('"anytime" tow-away is never allowed', () => {
    const tow = sign({ rawText: 'TOW-AWAY NO STOPPING ANYTIME', type: 'tow_away', anytime: true });
    const r = evaluate([tow], at(SAT, 14), me);
    expect(r.status).toBe('NOT_ALLOWED');
    expect(r.nextAllowedAt).toBeNull();
    expect(r.reasonSteps.at(-1)?.text).toMatch(/Not allowed at any time/);
  });
});

describe('evaluate — exceptions, permits, commercial', () => {
  const twoHour = sign({
    rawText: '2 HOUR PARKING 8AM-6PM EXCEPT SUNDAY',
    type: 'time_limit',
    start: '08:00',
    end: '18:00',
    maxMinutes: 120,
    exceptText: 'EXCEPT SUNDAY',
  });

  it('Sunday exception: no limit on Sunday', () => {
    expect(evaluate([twoHour], at(SUN, 10), me).status).toBe('ALLOWED');
    expect(evaluate([twoHour], at(SAT, 10), me).status).toBe('TIME_LIMITED');
  });

  it('time limit caps allowedUntil at maxMinutes from now', () => {
    const r = evaluate([twoHour], at(TUE, 9), me);
    expect(r.status).toBe('TIME_LIMITED');
    expect(r.maxMinutes).toBe(120);
    expect(r.allowedUntil).toEqual(at(TUE, 11));
  });

  it('time limit that ends before the cap does not cut the stay short', () => {
    // 5 PM: limit ends at 6 PM, so the 2-hour clock never runs out today.
    const r = evaluate([twoHour], at(TUE, 17), me);
    expect(r.status).toBe('TIME_LIMITED');
    expect(r.allowedUntil).toEqual(at(WED, 8));
  });

  const permitZoneB = sign({
    order: 1,
    rawText: '1 HOUR PARKING 8AM-6PM EXCEPT ZONE B PERMITS',
    type: 'time_limit',
    start: '08:00',
    end: '18:00',
    maxMinutes: 60,
    permitZone: 'B',
  });
  const permitOnlyB = sign({
    order: 2,
    rawText: 'PERMIT B ONLY 6PM-8AM',
    type: 'permit_only',
    start: '18:00',
    end: '08:00',
    permitZone: 'B',
  });

  it('matching permit is exempt from the time limit and permit-only zone', () => {
    const holder: Profile = { side: 'both', permitZone: 'Zone B' };
    expect(evaluate([permitZoneB, permitOnlyB], at(TUE, 10), holder).status).toBe('ALLOWED');
    expect(evaluate([permitZoneB, permitOnlyB], at(TUE, 20), holder).status).toBe('ALLOWED');
    const r = evaluate([permitZoneB, permitOnlyB], at(TUE, 20), holder);
    expect(r.reasonSteps.some((s) => s.kind === 'exempt')).toBe(true);
  });

  it('non-matching permit is treated as no permit', () => {
    const other: Profile = { side: 'both', permitZone: 'C' };
    expect(evaluate([permitZoneB, permitOnlyB], at(TUE, 10), other).status).toBe('TIME_LIMITED');
    const night = evaluate([permitZoneB, permitOnlyB], at(TUE, 20), other);
    expect(night.status).toBe('PERMIT_ONLY');
    expect(night.nextAllowedAt).toEqual(at(WED, 8));
  });

  it('loading zone blocks private cars but not commercial vehicles', () => {
    const loading = sign({
      rawText: 'COMMERCIAL LOADING ONLY 7AM-10AM',
      type: 'loading_zone',
      start: '07:00',
      end: '10:00',
    });
    expect(evaluate([loading], at(TUE, 8), me).status).toBe('NOT_ALLOWED');
    expect(evaluate([loading], at(TUE, 8), { side: 'both', isCommercial: true }).status).toBe(
      'ALLOWED',
    );
  });
});

describe('evaluate — stacked signs and arrows', () => {
  const meter = sign({
    order: 1,
    rawText: 'PAY TO PARK 9AM-6PM 2 HR MAX',
    type: 'metered',
    start: '09:00',
    end: '18:00',
    maxMinutes: 120,
  });

  it('stacked conflicting signs: most restrictive wins', () => {
    const r = evaluate([meter, cleaning], at(TUE, 11), me);
    expect(r.status).toBe('NOT_ALLOWED');
    expect(r.controllingSignOrder).toBe(2);
    expect(r.reasonSteps.some((s) => /Most restrictive sign wins/.test(s.text))).toBe(true);
  });

  it('metered parking is PAID with the limit carried through', () => {
    const r = evaluate([meter, cleaning], at(WED, 11), me);
    expect(r.status).toBe('PAID');
    expect(r.maxMinutes).toBe(120);
    expect(r.allowedUntil).toEqual(at(WED, 13));
  });

  it('PAID → worse status ends the stay early', () => {
    const r = evaluate([meter, cleaning], at(TUE, 9, 30), me);
    expect(r.status).toBe('PAID');
    expect(r.allowedUntil).toEqual(at(TUE, 10));
  });

  it('tow-away outranks no-parking and time limits', () => {
    const tow = sign({
      order: 3,
      rawText: 'TOW AWAY 7-9AM',
      type: 'tow_away',
      start: '07:00',
      end: '09:00',
    });
    const np = sign({
      order: 1,
      rawText: 'NO PARKING 6-10AM',
      type: 'no_parking',
      start: '06:00',
      end: '10:00',
    });
    expect(evaluate([np, tow], at(TUE, 8), me).controllingSignOrder).toBe(3);
    expect(evaluate([np, tow], at(TUE, 9, 30), me).controllingSignOrder).toBe(1);
  });

  it('arrow filtering skips signs pointing away from the chosen side', () => {
    const leftOnly = sign({ rawText: 'NO PARKING ANYTIME ←', anytime: true, arrow: 'left' });
    expect(evaluate([leftOnly], at(TUE, 12), { side: 'left' }).status).toBe('NOT_ALLOWED');
    const right = evaluate([leftOnly], at(TUE, 12), { side: 'right' });
    expect(right.status).toBe('ALLOWED');
    expect(right.skippedSignOrders).toEqual([1]);
    expect(right.reasonSteps.some((s) => s.kind === 'skipped')).toBe(true);
    // "both" arrows always apply
    const both = sign({ anytime: true, arrow: 'both' });
    expect(evaluate([both], at(TUE, 12), { side: 'right' }).status).toBe('NOT_ALLOWED');
  });

  it("'other' signs are ignored", () => {
    const r = evaluate(
      [sign({ type: 'other', rawText: 'NEIGHBORHOOD WATCH', anytime: true })],
      at(TUE, 12),
      me,
    );
    expect(r.status).toBe('ALLOWED');
    expect(r.reasonSteps.some((s) => s.kind === 'ignored')).toBe(true);
  });
});

describe('look-ahead and week grid', () => {
  it('nextAllowedAt wraps across the end of the week', () => {
    // No parking all of Sat + Sun → next allowed Monday 00:00
    const weekend = sign({ rawText: 'NO PARKING SAT-SUN', days: ['SAT', 'SUN'], anytime: true });
    const r = evaluate([weekend], at(SAT, 22), me);
    expect(r.status).toBe('NOT_ALLOWED');
    expect(r.nextAllowedAt).toEqual(at(MON, 0));
  });

  it('end-of-week wrap: Sunday-night overnight rule spills into Monday', () => {
    const sunNight = sign({
      rawText: 'NO PARKING SUN 11PM-5AM',
      days: ['SUN'],
      start: '23:00',
      end: '05:00',
    });
    expect(statusAt([sunNight], at(MON, 2), me).status).toBe('NOT_ALLOWED');
    expect(evaluate([sunNight], at(SUN, 22), me).allowedUntil).toEqual(at(SUN, 23));
  });

  it('weekGrid returns a 7×24 matrix starting at midnight', () => {
    const grid = weekGrid([cleaning], at(TUE, 15, 30), me);
    expect(grid).toHaveLength(7);
    grid.forEach((row) => expect(row).toHaveLength(24));
    expect(grid[0]?.[0]?.at).toEqual(at(TUE, 0));
    expect(grid[0]?.[10]?.status).toBe('NOT_ALLOWED');
    expect(grid[0]?.[11]?.status).toBe('NOT_ALLOWED');
    expect(grid[0]?.[12]?.status).toBe('ALLOWED');
    expect(grid[1]?.[10]?.status).toBe('ALLOWED');
    expect(grid[0]?.[10]?.controllingSignOrder).toBe(2);
  });

  it('is deterministic and does not mutate input', () => {
    const rules = [cleaning, sign({ order: 1, rawText: 'X', type: 'time_limit', maxMinutes: 60 })];
    const copy = JSON.stringify(rules);
    const a = evaluate(rules, at(TUE, 11), me);
    const b = evaluate(rules, at(TUE, 11), me);
    expect(a).toEqual(b);
    expect(JSON.stringify(rules)).toBe(copy);
  });
});
