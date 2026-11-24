import { isParkable, limitLabel, quoteSign, statusLabel } from './describe';
import {
  compileRule,
  describeSchedule,
  facesSide,
  isActiveAt,
  signEffect,
  TYPE_PRIORITY,
  type CompiledRule,
} from './rules';
import {
  addMinutes,
  formatTime,
  formatWhen,
  MINUTES_PER_WEEK,
  startOfDay,
  weekdayLong,
} from './time';
import {
  STATUS_SEVERITY,
  type Evaluation,
  type Profile,
  type ReasonStep,
  type SignRule,
  type Status,
  type WeekCell,
} from './types';

interface Snapshot {
  status: Status;
  controlling: SignRule | null;
  maxMinutes: number | null;
}

interface Prepared {
  /** Signs facing the chosen side, top to bottom. */
  facing: CompiledRule[];
  skipped: CompiledRule[];
  at(date: Date): Snapshot;
}

/** Compile the rules once so stepping minute-by-minute through a week stays fast. */
function prepare(rules: readonly SignRule[], profile: Profile): Prepared {
  const sorted = [...rules].sort((a, b) => a.order - b.order).map(compileRule);
  const facing = sorted.filter((c) => facesSide(c.rule, profile.side));
  const skipped = sorted.filter((c) => !facesSide(c.rule, profile.side));
  const effects = new Map(facing.map((c) => [c, signEffect(c.rule, profile)]));

  return {
    facing,
    skipped,
    at(date: Date): Snapshot {
      let best: { c: CompiledRule; status: Status } | null = null;
      let limit: number | null = null;
      for (const c of facing) {
        const effect = effects.get(c);
        if (!effect || effect.kind !== 'restricts' || !isActiveAt(c, date)) continue;
        if (
          (effect.status === 'TIME_LIMITED' || effect.status === 'PAID') &&
          c.rule.maxMinutes != null
        ) {
          limit = limit == null ? c.rule.maxMinutes : Math.min(limit, c.rule.maxMinutes);
        }
        if (!best || TYPE_PRIORITY[c.rule.type] < TYPE_PRIORITY[best.c.rule.type]) {
          best = { c, status: effect.status };
        }
      }
      if (!best) return { status: 'ALLOWED', controlling: null, maxMinutes: null };
      const hasLimit = best.status === 'TIME_LIMITED' || best.status === 'PAID';
      return {
        status: best.status,
        controlling: best.c.rule,
        maxMinutes: hasLimit ? limit : null,
      };
    },
  };
}

function hasLimit(s: Snapshot): boolean {
  return s.status === 'TIME_LIMITED' || (s.status === 'PAID' && s.maxMinutes != null);
}

function findAllowedUntil(p: Prepared, at: Date, start: Snapshot): Date | null {
  if (!isParkable(start.status)) return null;
  const startSeverity = STATUS_SEVERITY[start.status];
  const cap = start.maxMinutes != null ? start.maxMinutes : null;
  for (let i = 1; i <= MINUTES_PER_WEEK; i++) {
    const t = addMinutes(at, i);
    const snap = p.at(t);
    if (STATUS_SEVERITY[snap.status] > startSeverity) return t;
    // The time-limit clock runs out — but only if the limit is still in force then.
    if (cap != null && i >= cap && hasLimit(snap)) return t;
  }
  return null;
}

function findNextAllowed(p: Prepared, at: Date, start: Snapshot): Date | null {
  if (isParkable(start.status)) return null;
  for (let i = 1; i <= MINUTES_PER_WEEK; i++) {
    const t = addMinutes(at, i);
    if (isParkable(p.at(t).status)) return t;
  }
  return null;
}

function signRef(rule: SignRule): string {
  return `Sign ${rule.order} says '${quoteSign(rule.rawText)}'`;
}

/**
 * Decide whether the driver may park at `at`, given the signs on the pole.
 * Pure function: same input → same output, no AI involved.
 */
export function evaluate(rules: readonly SignRule[], at: Date, profile: Profile): Evaluation {
  const p = prepare(rules, profile);
  const now = p.at(at);
  const allowedUntil = findAllowedUntil(p, at, now);
  const nextAllowedAt = findNextAllowed(p, at, now);

  const steps: ReasonStep[] = [];
  const sideNote =
    profile.side === 'both' ? '' : ` You're parking to the ${profile.side} of the pole.`;
  steps.push({ kind: 'clock', text: `It's ${weekdayLong(at)} ${formatTime(at)}.${sideNote}` });

  const activeSignOrders: number[] = [];
  const restricting: SignRule[] = [];
  const sorted = [...rules].sort((a, b) => a.order - b.order);
  const skippedSet = new Set(p.skipped.map((c) => c.rule));

  for (const rule of sorted) {
    const base = { signOrder: rule.order, quote: quoteSign(rule.rawText) };
    if (skippedSet.has(rule)) {
      steps.push({
        ...base,
        kind: 'skipped',
        text: `${signRef(rule)} → its arrow points ${rule.arrow}, away from your side → skipped.`,
      });
      continue;
    }
    const compiled = p.facing.find((c) => c.rule === rule);
    if (!compiled) continue;
    const effect = signEffect(rule, profile);
    if (effect.kind === 'ignored') {
      steps.push({
        ...base,
        kind: 'ignored',
        text: `${signRef(rule)} → not a parking rule I can evaluate → ignored.`,
      });
      continue;
    }
    if (!isActiveAt(compiled, at)) {
      steps.push({
        ...base,
        kind: 'inactive',
        text: `${signRef(rule)} → only ${describeSchedule(rule)} → doesn't apply right now.`,
      });
      continue;
    }
    activeSignOrders.push(rule.order);
    if (effect.kind === 'exempt') {
      steps.push({
        ...base,
        kind: 'exempt',
        text: `${signRef(rule)} → applies now, but ${effect.why} → doesn't restrict you.`,
      });
      continue;
    }
    restricting.push(rule);
    const label = statusLabel(effect.status, rule.maxMinutes).toLowerCase();
    steps.push({ ...base, kind: 'applies', text: `${signRef(rule)} → applies now → ${label}.` });
  }

  const label = statusLabel(now.status, now.maxMinutes);
  if (now.controlling) {
    steps.push({
      kind: 'decision',
      signOrder: now.controlling.order,
      text:
        restricting.length > 1
          ? `Most restrictive sign wins → Sign ${now.controlling.order}: ${label}.`
          : `So → ${label}.`,
    });
  } else {
    steps.push({
      kind: 'decision',
      text: 'No sign restricts parking right now → allowed. Unsigned rules (hydrants, driveways, local laws) may still apply.',
    });
  }

  if (isParkable(now.status)) {
    if (allowedUntil) {
      const capped =
        now.maxMinutes != null &&
        Math.round((allowedUntil.getTime() - at.getTime()) / 60_000) >= now.maxMinutes;
      steps.push({
        kind: 'next',
        text: capped
          ? `You can stay until ${formatWhen(allowedUntil, at)} (${limitLabel(now.maxMinutes).toLowerCase()}).`
          : `You can stay until ${formatWhen(allowedUntil, at)}, when the rules change.`,
      });
    } else {
      steps.push({ kind: 'next', text: 'No sign restrictions kick in for the next 7 days.' });
    }
  } else {
    steps.push({
      kind: 'next',
      text: nextAllowedAt
        ? `Next allowed: ${formatWhen(nextAllowedAt, at)}.`
        : 'Not allowed at any time in the next 7 days.',
    });
  }

  return {
    status: now.status,
    controllingSignOrder: now.controlling?.order ?? null,
    allowedUntil,
    nextAllowedAt,
    reasonSteps: steps,
    maxMinutes: now.maxMinutes,
    activeSignOrders,
    skippedSignOrders: p.skipped.map((c) => c.rule.order),
  };
}

/** Quick status without the reasoning or look-ahead (used for scrubber strips). */
export function statusAt(
  rules: readonly SignRule[],
  at: Date,
  profile: Profile,
): Omit<WeekCell, 'at'> {
  const snap = prepare(rules, profile).at(at);
  return {
    status: snap.status,
    controllingSignOrder: snap.controlling?.order ?? null,
    maxMinutes: snap.maxMinutes,
  };
}

/** 7 days × 24 hours, starting at midnight of the day `from` falls on. */
export function weekGrid(rules: readonly SignRule[], from: Date, profile: Profile): WeekCell[][] {
  const p = prepare(rules, profile);
  const day0 = startOfDay(from);
  const grid: WeekCell[][] = [];
  for (let d = 0; d < 7; d++) {
    const row: WeekCell[] = [];
    for (let h = 0; h < 24; h++) {
      const at = new Date(day0.getFullYear(), day0.getMonth(), day0.getDate() + d, h, 0);
      const snap = p.at(at);
      row.push({
        at,
        status: snap.status,
        controllingSignOrder: snap.controlling?.order ?? null,
        maxMinutes: snap.maxMinutes,
      });
    }
    grid.push(row);
  }
  return grid;
}
