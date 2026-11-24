import type { ReadResult, SignRule } from '../engine';
import { poleSvg } from '../signArt';

export interface Sample {
  id: string;
  title: string;
  blurb: string;
  expected: ReadResult;
}

const WEEKDAYS: SignRule['days'] = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
const MON_SAT: SignRule['days'] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function s(
  order: number,
  partial: Partial<SignRule> & Pick<SignRule, 'rawText' | 'type'>,
): SignRule {
  return {
    order,
    days: [],
    anytime: false,
    start: null,
    end: null,
    maxMinutes: null,
    permitZone: null,
    exceptText: null,
    arrow: 'none',
    confidence: 0.96,
    ...partial,
  };
}

export const SAMPLES: Sample[] = [
  {
    id: 'two-hour',
    title: '2-hour limit',
    blurb: '2 hours, 8–6, except Sunday — plus a no-parking arrow',
    expected: {
      readable: true,
      notes: '',
      signs: [
        s(1, {
          rawText: '2 HOUR\nPARKING\n8AM - 6PM\nEXCEPT SUNDAY',
          type: 'time_limit',
          start: '08:00',
          end: '18:00',
          maxMinutes: 120,
          exceptText: 'EXCEPT SUNDAY',
        }),
        s(2, { rawText: 'NO PARKING\nANYTIME', type: 'no_parking', anytime: true, arrow: 'left' }),
      ],
    },
  },
  {
    id: 'street-cleaning',
    title: 'Street cleaning',
    blurb: 'Tuesday 10–12 sweeping over a weekday 2-hour limit',
    expected: {
      readable: true,
      notes: '',
      signs: [
        s(1, {
          rawText: 'NO PARKING\n10AM - 12PM\nTUESDAY\nSTREET CLEANING',
          type: 'street_cleaning',
          days: ['TUE'],
          start: '10:00',
          end: '12:00',
        }),
        s(2, {
          rawText: '2 HOUR PARKING\n9AM - 6PM\nMON THRU FRI',
          type: 'time_limit',
          days: WEEKDAYS,
          start: '09:00',
          end: '18:00',
          maxMinutes: 120,
        }),
      ],
    },
  },
  {
    id: 'rush-hour',
    title: 'Rush-hour tow-away',
    blurb: 'Tow-away 7–9 AM and 4–7 PM weekdays, metered between',
    expected: {
      readable: true,
      notes: '',
      signs: [
        s(1, {
          rawText: 'TOW-AWAY\nNO STOPPING\n7AM - 9AM\nMON - FRI',
          type: 'tow_away',
          days: WEEKDAYS,
          start: '07:00',
          end: '09:00',
        }),
        s(2, {
          rawText: 'TOW-AWAY\nNO STOPPING\n4PM - 7PM\nMON - FRI',
          type: 'tow_away',
          days: WEEKDAYS,
          start: '16:00',
          end: '19:00',
        }),
        s(3, {
          rawText: 'PAY AT METER\n2 HR MAX\n9AM - 4PM\nMON - FRI',
          type: 'metered',
          days: WEEKDAYS,
          start: '09:00',
          end: '16:00',
          maxMinutes: 120,
        }),
      ],
    },
  },
  {
    id: 'permit-b',
    title: 'Permit zone B',
    blurb: '1 hour for visitors, Zone B permit only overnight',
    expected: {
      readable: true,
      notes: 'The zone letter on sign 2 is faded — I think it says B.',
      signs: [
        s(1, {
          rawText: '1 HOUR PARKING\n8AM - 6PM\nEXCEPT VEHICLES\nWITH ZONE B PERMITS',
          type: 'time_limit',
          start: '08:00',
          end: '18:00',
          maxMinutes: 60,
          permitZone: 'B',
        }),
        s(2, {
          rawText: 'PERMIT PARKING\nZONE B ONLY\n6PM - 8AM',
          type: 'permit_only',
          start: '18:00',
          end: '08:00',
          permitZone: 'B',
          confidence: 0.62,
        }),
      ],
    },
  },
  {
    id: 'loading',
    title: 'Metered loading zone',
    blurb: 'Commercial loading mornings, paid parking after',
    expected: {
      readable: true,
      notes: '',
      signs: [
        s(1, {
          rawText: 'COMMERCIAL\nLOADING ONLY\n7AM - 10AM\nMON - SAT',
          type: 'loading_zone',
          days: MON_SAT,
          start: '07:00',
          end: '10:00',
        }),
        s(2, {
          rawText: 'PAY TO PARK\n2 HOUR LIMIT\n10AM - 8PM\nMON - SAT',
          type: 'metered',
          days: MON_SAT,
          start: '10:00',
          end: '20:00',
          maxMinutes: 120,
        }),
      ],
    },
  },
  {
    id: 'nightmare',
    title: 'The nightmare pole',
    blurb: 'Four stacked signs — the reason this app exists',
    expected: {
      readable: true,
      notes: '',
      signs: [
        s(1, {
          rawText: 'NO STOPPING\n4PM - 7PM\nMON - FRI',
          type: 'no_stopping',
          days: WEEKDAYS,
          start: '16:00',
          end: '19:00',
        }),
        s(2, {
          rawText: 'NO PARKING\n12AM - 6AM\nWEDNESDAY\nSTREET CLEANING',
          type: 'street_cleaning',
          days: ['WED'],
          start: '00:00',
          end: '06:00',
        }),
        s(3, {
          rawText: '1 HOUR\nPARKING\n8AM - 4PM\nMON - FRI',
          type: 'time_limit',
          days: WEEKDAYS,
          start: '08:00',
          end: '16:00',
          maxMinutes: 60,
        }),
        s(4, {
          rawText: 'PERMIT 7\nONLY\n7PM - 7AM',
          type: 'permit_only',
          start: '19:00',
          end: '07:00',
          permitZone: '7',
          arrow: 'right',
        }),
      ],
    },
  },
];

export function sampleSvg(sample: Sample): string {
  return poleSvg(sample.expected.signs, SAMPLES.indexOf(sample) + 1);
}

export function sampleDataUrl(sample: Sample): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sampleSvg(sample))}`;
}
