import {
  formatTime,
  formatUntil,
  formatWhen,
  isParkable,
  statusIcon,
  statusLabel,
  weekdayLong,
  type Evaluation,
} from '../engine';
import { COLORS } from '../signStyle';

export const STATUS_COLOR = {
  ALLOWED: COLORS.green,
  TIME_LIMITED: COLORS.sodium,
  PAID: COLORS.paid,
  PERMIT_ONLY: COLORS.permit,
  NOT_ALLOWED: COLORS.red,
} as const;

export interface Answer {
  headline: 'YES' | 'NO';
  sub: string;
  pill: string;
  color: string;
  spoken: string;
}

export function buildAnswer(r: Evaluation, at: Date): Answer {
  const pill = `${statusIcon(r.status)} ${statusLabel(r.status, r.maxMinutes)}`;
  const color = STATUS_COLOR[r.status];
  const when = `${weekdayLong(at)} ${formatTime(at)}`;
  if (isParkable(r.status)) {
    return {
      headline: 'YES',
      sub: r.allowedUntil ? `until ${formatUntil(r.allowedUntil, at)}` : 'all week',
      pill,
      color,
      spoken: `Yes, you can park here${r.status === 'PAID' ? ' if you pay' : ''}, ${r.allowedUntil ? `until ${formatWhen(r.allowedUntil, at)}` : 'with no sign limits for the next 7 days'}. Checked for ${when}.`,
    };
  }
  const next = r.nextAllowedAt
    ? `Next allowed ${formatWhen(r.nextAllowedAt, at)}`
    : 'Not allowed this week';
  return {
    headline: 'NO',
    sub: r.nextAllowedAt ? `free from ${formatUntil(r.nextAllowedAt, at)}` : 'all week',
    pill,
    color,
    spoken: `No, ${r.status === 'PERMIT_ONLY' ? 'this is permit parking only' : 'you cannot park here'} right now. ${next}. Checked for ${when}.`,
  };
}
