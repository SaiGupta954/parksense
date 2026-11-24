import type { SignType, Status } from './types';

export function limitLabel(maxMinutes: number | null): string {
  if (maxMinutes == null) return 'Time limit';
  if (maxMinutes % 60 === 0) return `${maxMinutes / 60}-hour limit`;
  return `${maxMinutes}-min limit`;
}

/** Status is never conveyed by color alone: icon + words. */
export function statusIcon(status: Status): string {
  switch (status) {
    case 'ALLOWED':
      return '✓';
    case 'TIME_LIMITED':
      return '⏱';
    case 'PAID':
      return '$';
    case 'PERMIT_ONLY':
      return '🅿';
    case 'NOT_ALLOWED':
      return '✕';
  }
}

export function statusLabel(status: Status, maxMinutes: number | null = null): string {
  switch (status) {
    case 'ALLOWED':
      return 'Allowed';
    case 'TIME_LIMITED':
      return limitLabel(maxMinutes);
    case 'PAID':
      return maxMinutes != null ? `Paid · ${limitLabel(maxMinutes).toLowerCase()}` : 'Paid';
    case 'PERMIT_ONLY':
      return 'Permit only';
    case 'NOT_ALLOWED':
      return 'No parking';
  }
}

export function isParkable(status: Status): boolean {
  return status === 'ALLOWED' || status === 'TIME_LIMITED' || status === 'PAID';
}

export const TYPE_LABEL: Record<SignType, string> = {
  no_stopping: 'No stopping',
  tow_away: 'Tow-away',
  no_parking: 'No parking',
  street_cleaning: 'Street cleaning',
  loading_zone: 'Loading zone',
  permit_only: 'Permit only',
  metered: 'Metered',
  time_limit: 'Time limit',
  allowed: 'Parking allowed',
  other: 'Other',
};

/** Single-line version of the sign text for quoting. */
export function quoteSign(rawText: string): string {
  return rawText
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
