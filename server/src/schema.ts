import { z } from 'zod';

export const SIGN_TYPES = [
  'no_stopping',
  'tow_away',
  'no_parking',
  'street_cleaning',
  'loading_zone',
  'permit_only',
  'metered',
  'time_limit',
  'allowed',
  'other',
] as const;
export const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
export const ARROWS = ['left', 'right', 'both', 'none'] as const;

/** JSON schema passed to Ollama's `format` for structured output. */
export const SIGN_JSON_SCHEMA = {
  type: 'object',
  properties: {
    readable: { type: 'boolean' },
    signs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          order: { type: 'integer', description: '1 = top sign on the pole' },
          rawText: { type: 'string' },
          type: { type: 'string', enum: [...SIGN_TYPES] },
          days: { type: 'array', items: { type: 'string', enum: [...DAYS] } },
          anytime: { type: 'boolean' },
          start: { type: ['string', 'null'], description: '24h HH:MM' },
          end: { type: ['string', 'null'], description: '24h HH:MM' },
          maxMinutes: { type: ['integer', 'null'] },
          permitZone: { type: ['string', 'null'] },
          exceptText: { type: ['string', 'null'] },
          arrow: { type: 'string', enum: [...ARROWS] },
          confidence: { type: 'number' },
        },
        required: [
          'order',
          'rawText',
          'type',
          'days',
          'anytime',
          'start',
          'end',
          'maxMinutes',
          'permitZone',
          'exceptText',
          'arrow',
          'confidence',
        ],
      },
    },
    notes: { type: 'string' },
  },
  required: ['readable', 'signs', 'notes'],
} as const;

export const SYSTEM_PROMPT = `You are a precise transcription engine for street parking signs.
You ONLY extract what is printed on the signs. You never decide whether parking is allowed.

Rules:
- Transcribe EVERY parking sign in the photo exactly, from the TOP of the pole to the BOTTOM. order 1 = top sign.
- rawText: the sign's exact wording, one line per printed line, separated by "\\n".
- If one sign lists two separate time ranges (e.g. "7-9AM & 4-7PM"), output it as two entries with the same rawText.
- Convert all times to 24-hour "HH:MM" (e.g. 4PM → "16:00", 12AM/midnight → "00:00", noon → "12:00").
- Expand day ranges: "MON-FRI" → ["MON","TUE","WED","THU","FRI"].
- days: ONLY days printed on that sign. If no day is printed, days MUST be []. Never infer weekdays from "EXCEPT SUNDAY" — put that in exceptText and leave days [].
- Read AM/PM on BOTH ends of every range. "6PM - 8AM" is overnight: start "18:00", end "08:00".
- Set anytime: true for "ANYTIME", "AT ALL TIMES" or "24 HOURS"; then start and end are null.
- maxMinutes: "2 HOUR PARKING" → 120, "30 MIN" → 30; otherwise null.
- permitZone: the zone/area letter or number on permit signs, including "EXCEPT ZONE B PERMITS" exemptions (e.g. "B"); otherwise null.
- exceptText: any "EXCEPT ..." clause verbatim (e.g. "EXCEPT SUNDAY"); otherwise null.
- arrow: the direction of the arrow on the sign: left, right, both (double-headed) or none.
- Signs mentioning STREET CLEANING or SWEEPING are street_cleaning; LOADING signs are loading_zone.
- type: tow_away, no_stopping, no_parking, street_cleaning, loading_zone, permit_only, metered (pay/meter), time_limit (N hour parking), allowed, or other.
- confidence: 0.95+ only when every character is crisp; lower it for blur, glare, fading or anything you inferred.
- NEVER guess unreadable text. Lower that sign's confidence (0..1) and explain what was unclear in "notes".
- If there are no readable parking signs, set readable: false and signs: [].
- Return ONLY JSON that matches the provided schema. No prose, no markdown.`;

export const STRICT_REMINDER =
  'Your previous reply was not valid. Reply again with ONLY a JSON object matching the schema exactly: times as "HH:MM" 24-hour strings or null, days as MON..SUN codes, confidence between 0 and 1. No other text.';

const DAY_ALIASES: Record<string, (typeof DAYS)[number]> = {
  MON: 'MON',
  MONDAY: 'MON',
  TUE: 'TUE',
  TUES: 'TUE',
  TUESDAY: 'TUE',
  WED: 'WED',
  WEDNESDAY: 'WED',
  THU: 'THU',
  THUR: 'THU',
  THURS: 'THU',
  THURSDAY: 'THU',
  FRI: 'FRI',
  FRIDAY: 'FRI',
  SAT: 'SAT',
  SATURDAY: 'SAT',
  SUN: 'SUN',
  SUNDAY: 'SUN',
};

/** Best-effort normalization of common time spellings to "HH:MM". Unknown input is returned unchanged. */
export function normalizeTime(value: string): string {
  const v = value.trim().toUpperCase().replace(/\./g, '');
  if (v === 'NOON') return '12:00';
  if (v === 'MIDNIGHT') return '00:00';
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM|A|P)?$/.exec(v);
  if (!m) return value;
  let h = Number(m[1]);
  const min = Number(m[2] ?? '0');
  const ampm = m[3];
  if (ampm) {
    if (h < 1 || h > 12) return value;
    if (ampm.startsWith('A')) h = h === 12 ? 0 : h;
    else h = h === 12 ? 12 : h + 12;
  } else if (m[2] === undefined) {
    return value; // a bare number like "8" is ambiguous
  }
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

const timeField = z.preprocess(
  (v) => (v == null || v === '' ? null : typeof v === 'string' ? normalizeTime(v) : v),
  z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/, 'time must be HH:MM')
    .nullable(),
);

const daysField = z.preprocess(
  (v) =>
    Array.isArray(v)
      ? [
          ...new Set(
            v.map((d) => (typeof d === 'string' ? (DAY_ALIASES[d.trim().toUpperCase()] ?? d) : d)),
          ),
        ]
      : v,
  z.array(z.enum(DAYS)),
);

const nullableString = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
  z.string().nullable(),
);

export const SignSchema = z.object({
  order: z.coerce.number().int().min(1),
  rawText: z.string(),
  type: z.preprocess((v) => (typeof v === 'string' ? v.toLowerCase() : v), z.enum(SIGN_TYPES)),
  days: daysField,
  anytime: z.boolean(),
  start: timeField,
  end: timeField,
  maxMinutes: z.preprocess(
    (v) => (v === '' ? null : v),
    z.coerce.number().int().positive().nullable(),
  ),
  permitZone: nullableString,
  exceptText: nullableString,
  arrow: z.preprocess((v) => (typeof v === 'string' ? v.toLowerCase() : v), z.enum(ARROWS)),
  confidence: z.preprocess(
    (v) => (typeof v === 'number' && v > 1 && v <= 100 ? v / 100 : v),
    z.number().min(0).max(1),
  ),
});

export const ReadSchema = z.object({
  readable: z.boolean(),
  signs: z.array(SignSchema).max(12),
  notes: z.string(),
});

export type SignRule = z.infer<typeof SignSchema>;
export type ReadResult = z.infer<typeof ReadSchema>;

export const ReadRequestSchema = z.object({
  imageBase64: z.string().min(16),
  thumbnailBase64: z.string().max(400_000).optional(),
});
