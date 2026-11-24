import { describe, expect, it } from 'vitest';
import { reconcile, reconcileSign, timeRanges } from './reconcile.js';
import type { SignRule } from './schema.js';

const base: SignRule = {
  order: 1,
  rawText: '',
  type: 'no_parking',
  days: [],
  anytime: false,
  start: null,
  end: null,
  maxMinutes: null,
  permitZone: null,
  exceptText: null,
  arrow: 'none',
  confidence: 1,
};
const sign = (p: Partial<SignRule>): SignRule => ({ ...base, ...p });

describe('reconcile (real qwen2.5vl:7b mistakes)', () => {
  it('parses time ranges from sign text', () => {
    expect(timeRanges('8AM - 6PM')).toEqual([['08:00', '18:00']]);
    expect(timeRanges('PERMIT B ONLY\n6PM - 8AM')).toEqual([['18:00', '08:00']]);
    expect(timeRanges('12AM - 6AM WEDNESDAY')).toEqual([['00:00', '06:00']]);
    expect(timeRanges('7AM-9AM & 4PM-7PM')).toHaveLength(2);
    expect(timeRanges('2 HOUR PARKING')).toEqual([]);
  });

  it('drops weekdays the model invented from "EXCEPT SUNDAY"', () => {
    const { sign: s, fixes } = reconcileSign(
      sign({
        rawText: '2 HOUR\nPARKING\n8AM - 6PM\nEXCEPT SUNDAY',
        type: 'time_limit',
        days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
        start: '08:00',
        end: '18:00',
        maxMinutes: 120,
        exceptText: 'EXCEPT SUNDAY',
      }),
    );
    expect(s.days).toEqual([]);
    expect(fixes).toHaveLength(1);
    expect(s.confidence).toBeLessThan(0.7);
  });

  it('keeps printed days', () => {
    const { fixes } = reconcileSign(
      sign({
        rawText: '2 HOUR PARKING\n9AM - 6PM\nMON THRU FRI',
        type: 'time_limit',
        days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
        start: '09:00',
        end: '18:00',
      }),
    );
    expect(fixes).toEqual([]);
  });

  it('fixes a misread overnight end time and invented days', () => {
    const { sign: s } = reconcileSign(
      sign({
        rawText: 'PERMIT PARKING\nZONE B ONLY\n6PM - 8AM',
        type: 'permit_only',
        days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
        start: '18:00',
        end: '20:00',
        permitZone: 'B',
      }),
    );
    expect(s).toMatchObject({ start: '18:00', end: '08:00', days: [] });
  });

  it('recovers a missed permit-zone exemption', () => {
    const { sign: s } = reconcileSign(
      sign({
        rawText: '1 HOUR PARKING\n8AM - 6PM\nEXCEPT VEHICLES\nWITH ZONE B PERMITS',
        type: 'time_limit',
        start: '08:00',
        end: '18:00',
        maxMinutes: 60,
      }),
    );
    expect(s.permitZone).toBe('B');
  });

  it('corrects sign type from its text', () => {
    expect(
      reconcileSign(
        sign({
          rawText: 'NO PARKING\n10AM - 12PM\nTUESDAY\nSTREET CLEANING',
          days: ['TUE'],
          start: '10:00',
          end: '12:00',
        }),
      ).sign.type,
    ).toBe('street_cleaning');
    expect(
      reconcileSign(
        sign({
          rawText: 'COMMERCIAL\nLOADING ONLY\n7AM - 10AM\nMON - SAT',
          days: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
          start: '07:00',
          end: '10:00',
        }),
      ).sign.type,
    ).toBe('loading_zone');
  });

  it('leaves a correct read untouched and explains fixes in notes', () => {
    const good = sign({
      rawText: 'TOW-AWAY\nNO STOPPING\n7AM - 9AM\nMON - FRI',
      type: 'tow_away',
      days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      start: '07:00',
      end: '09:00',
    });
    expect(reconcile({ readable: true, signs: [good], notes: '' })).toEqual({
      readable: true,
      signs: [good],
      notes: '',
    });
    const bad = sign({
      order: 2,
      rawText: 'NO PARKING\n2AM - 5AM',
      days: ['MON'],
      start: '02:00',
      end: '05:00',
    });
    expect(reconcile({ readable: true, signs: [bad], notes: '' }).notes).toMatch(
      /^Sign 2: no days are printed/,
    );
  });
});
