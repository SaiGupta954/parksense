import type { SignRule, SignType } from './engine';

export const COLORS = {
  asphalt: '#0B0D10',
  sodium: '#FFB347',
  red: '#E0322B',
  green: '#1FA463',
  white: '#F4F1EA',
  paid: '#5AA9FF',
  permit: '#B48CFF',
  ink: '#14171C',
} as const;

export type Icon = 'no-p' | 'p' | 'tow' | 'dollar' | 'truck' | 'broom' | 'none';

export interface SignStyle {
  bg: string;
  fg: string;
  border: string;
  icon: Icon;
}

export function signStyle(type: SignType): SignStyle {
  switch (type) {
    case 'tow_away':
    case 'no_stopping':
      return { bg: COLORS.red, fg: COLORS.white, border: COLORS.white, icon: 'tow' };
    case 'no_parking':
      return { bg: COLORS.white, fg: COLORS.red, border: COLORS.red, icon: 'no-p' };
    case 'street_cleaning':
      return { bg: COLORS.white, fg: COLORS.red, border: COLORS.red, icon: 'broom' };
    case 'loading_zone':
      return { bg: '#F6C744', fg: COLORS.ink, border: COLORS.ink, icon: 'truck' };
    case 'permit_only':
      return { bg: COLORS.white, fg: COLORS.green, border: COLORS.green, icon: 'p' };
    case 'metered':
      return { bg: COLORS.green, fg: COLORS.white, border: COLORS.white, icon: 'dollar' };
    case 'time_limit':
    case 'allowed':
      return { bg: COLORS.white, fg: COLORS.green, border: COLORS.green, icon: 'p' };
    default:
      return { bg: COLORS.white, fg: COLORS.ink, border: COLORS.ink, icon: 'none' };
  }
}

/** Split sign text into display lines: honor newlines, then wrap long lines. */
export function signLines(rule: Pick<SignRule, 'rawText'>, maxChars = 16): string[] {
  const out: string[] = [];
  for (const line of rule.rawText.toUpperCase().split(/\n|\s\|\s/)) {
    const words = line.trim().split(/\s+/).filter(Boolean);
    let cur = '';
    for (const w of words) {
      if (cur && (cur + ' ' + w).length > maxChars) {
        out.push(cur);
        cur = w;
      } else cur = cur ? `${cur} ${w}` : w;
    }
    if (cur) out.push(cur);
  }
  return out.slice(0, 7);
}

export function arrowGlyph(arrow: SignRule['arrow']): string {
  return arrow === 'left' ? '←' : arrow === 'right' ? '→' : arrow === 'both' ? '↔' : '';
}

/** Panel height (in canvas units relative to width 1) used by both SVG samples and 3D panels. */
export function panelAspect(rule: SignRule): number {
  const lines = signLines(rule).length;
  const hasIcon = signStyle(rule.type).icon !== 'none';
  const hasArrow = rule.arrow !== 'none';
  return 0.18 + lines * 0.15 + (hasIcon ? 0.26 : 0) + (hasArrow ? 0.16 : 0);
}
