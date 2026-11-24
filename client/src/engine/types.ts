/** Day codes as the vision model returns them. */
export const DAY_CODES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
export type Day = (typeof DAY_CODES)[number];

/** JS `Date#getDay()` index (0 = Sunday) for each day code. */
export const DAY_INDEX: Record<Day, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

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
export type SignType = (typeof SIGN_TYPES)[number];

export const ARROWS = ['left', 'right', 'both', 'none'] as const;
export type Arrow = (typeof ARROWS)[number];

/** One sign on the pole, exactly as extracted by the vision model (and possibly edited by the user). */
export interface SignRule {
  /** 1 = top sign on the pole. */
  order: number;
  rawText: string;
  type: SignType;
  /** Empty means "every day". */
  days: Day[];
  anytime: boolean;
  /** 24h "HH:MM" or null. */
  start: string | null;
  end: string | null;
  maxMinutes: number | null;
  permitZone: string | null;
  exceptText: string | null;
  arrow: Arrow;
  confidence: number;
}

export interface ReadResult {
  readable: boolean;
  signs: SignRule[];
  notes: string;
}

export type Side = 'left' | 'right' | 'both';

export interface Profile {
  permitZone?: string;
  isCommercial?: boolean;
  side: Side;
}

export const STATUSES = ['ALLOWED', 'TIME_LIMITED', 'PAID', 'PERMIT_ONLY', 'NOT_ALLOWED'] as const;
export type Status = (typeof STATUSES)[number];

/** Higher = worse for the driver. */
export const STATUS_SEVERITY: Record<Status, number> = {
  ALLOWED: 0,
  TIME_LIMITED: 1,
  PAID: 2,
  PERMIT_ONLY: 3,
  NOT_ALLOWED: 4,
};

export type StepKind =
  'clock' | 'applies' | 'inactive' | 'skipped' | 'exempt' | 'ignored' | 'decision' | 'next';

export interface ReasonStep {
  kind: StepKind;
  text: string;
  signOrder?: number;
  quote?: string;
}

export interface Evaluation {
  status: Status;
  /** The sign whose rule produced `status`, or null when no sign applies. */
  controllingSignOrder: number | null;
  /** When the current (allowed) status gets worse, or the time-limit runs out. */
  allowedUntil: Date | null;
  /** When parking next becomes allowed (only for NOT_ALLOWED / PERMIT_ONLY). */
  nextAllowedAt: Date | null;
  reasonSteps: ReasonStep[];
  /** Effective time limit in minutes (TIME_LIMITED / PAID), if any. */
  maxMinutes: number | null;
  /** Signs whose schedule is in effect right now and that face the chosen side. */
  activeSignOrders: number[];
  /** Signs skipped because their arrow points away from the chosen side. */
  skippedSignOrders: number[];
}

export interface WeekCell {
  at: Date;
  status: Status;
  controllingSignOrder: number | null;
  maxMinutes: number | null;
}
