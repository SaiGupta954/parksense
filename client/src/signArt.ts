import type { SignRule } from './engine';
import { arrowGlyph, panelAspect, signLines, signStyle, type Icon } from './signStyle';

/**
 * A tiny vector description of a sign panel, in units where the panel is 1 wide.
 * Rendered both to SVG (sample photos) and to a canvas (3D panel textures),
 * so the "photo" and the 3D twin look like the same sign.
 */
export type Shape =
  | {
      kind: 'circle';
      cx: number;
      cy: number;
      r: number;
      stroke?: string;
      fill?: string;
      width?: number;
    }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string; width: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; fill: string; r?: number }
  | {
      kind: 'text';
      x: number;
      y: number;
      size: number;
      text: string;
      fill: string;
      maxWidth: number;
    };

export interface SignArt {
  height: number;
  bg: string;
  border: string;
  shapes: Shape[];
}

const FONT = '"Overpass", "Arial Narrow", Arial, sans-serif';

function iconShapes(icon: Icon, cy: number, fg: string): Shape[] {
  const r = 0.095;
  const cx = 0.5;
  switch (icon) {
    case 'no-p':
    case 'broom':
      return [
        {
          kind: 'text',
          x: cx,
          y: cy + 0.045,
          size: 0.13,
          text: 'P',
          fill: '#14171C',
          maxWidth: 0.2,
        },
        { kind: 'circle', cx, cy, r, stroke: fg, width: 0.022 },
        {
          kind: 'line',
          x1: cx - r * 0.7,
          y1: cy - r * 0.7,
          x2: cx + r * 0.7,
          y2: cy + r * 0.7,
          stroke: fg,
          width: 0.022,
        },
      ];
    case 'tow':
      return [
        { kind: 'circle', cx, cy, r, stroke: fg, width: 0.022 },
        {
          kind: 'line',
          x1: cx - r * 0.7,
          y1: cy - r * 0.7,
          x2: cx + r * 0.7,
          y2: cy + r * 0.7,
          stroke: fg,
          width: 0.022,
        },
      ];
    case 'p':
      return [
        { kind: 'text', x: cx, y: cy + 0.065, size: 0.2, text: 'P', fill: fg, maxWidth: 0.3 },
      ];
    case 'dollar':
      return [
        { kind: 'circle', cx, cy, r, stroke: fg, width: 0.018 },
        { kind: 'text', x: cx, y: cy + 0.045, size: 0.13, text: '$', fill: fg, maxWidth: 0.2 },
      ];
    case 'truck':
      return [
        { kind: 'rect', x: cx - 0.13, y: cy - 0.06, w: 0.15, h: 0.09, fill: fg, r: 0.008 },
        { kind: 'rect', x: cx + 0.03, y: cy - 0.03, w: 0.08, h: 0.06, fill: fg, r: 0.008 },
        { kind: 'circle', cx: cx - 0.08, cy: cy + 0.045, r: 0.02, fill: fg },
        { kind: 'circle', cx: cx + 0.07, cy: cy + 0.045, r: 0.02, fill: fg },
      ];
    default:
      return [];
  }
}

export function signArt(rule: SignRule): SignArt {
  const style = signStyle(rule.type);
  const lines = signLines(rule);
  const height = panelAspect(rule);
  const shapes: Shape[] = [];
  let y = 0.09;
  if (style.icon !== 'none') {
    shapes.push(...iconShapes(style.icon, y + 0.12, style.fg));
    y += 0.26;
  }
  for (const line of lines) {
    shapes.push({
      kind: 'text',
      x: 0.5,
      y: y + 0.12,
      size: 0.125,
      text: line,
      fill: style.fg,
      maxWidth: 0.84,
    });
    y += 0.15;
  }
  const glyph = arrowGlyph(rule.arrow);
  if (glyph) {
    shapes.push({
      kind: 'text',
      x: 0.5,
      y: y + 0.13,
      size: 0.16,
      text: glyph,
      fill: style.fg,
      maxWidth: 0.6,
    });
  }
  return { height, bg: style.bg, border: style.border, shapes };
}

/** Draw a sign onto a canvas of size (px wide × px*height tall). */
export function drawSignToCanvas(ctx: CanvasRenderingContext2D, art: SignArt, px: number) {
  const h = art.height * px;
  ctx.clearRect(0, 0, px, h);
  const radius = 0.05 * px;
  const roundRect = (x: number, yy: number, w: number, hh: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, yy);
    ctx.arcTo(x + w, yy, x + w, yy + hh, r);
    ctx.arcTo(x + w, yy + hh, x, yy + hh, r);
    ctx.arcTo(x, yy + hh, x, yy, r);
    ctx.arcTo(x, yy, x + w, yy, r);
    ctx.closePath();
  };
  ctx.fillStyle = art.bg;
  roundRect(0, 0, px, h, radius);
  ctx.fill();
  ctx.strokeStyle = art.border;
  ctx.lineWidth = 0.022 * px;
  roundRect(0.03 * px, 0.03 * px, px * 0.94, h - 0.06 * px, radius * 0.7);
  ctx.stroke();

  for (const s of art.shapes) {
    if (s.kind === 'circle') {
      ctx.beginPath();
      ctx.arc(s.cx * px, s.cy * px, s.r * px, 0, Math.PI * 2);
      if (s.fill) {
        ctx.fillStyle = s.fill;
        ctx.fill();
      }
      if (s.stroke) {
        ctx.strokeStyle = s.stroke;
        ctx.lineWidth = (s.width ?? 0.02) * px;
        ctx.stroke();
      }
    } else if (s.kind === 'line') {
      ctx.beginPath();
      ctx.moveTo(s.x1 * px, s.y1 * px);
      ctx.lineTo(s.x2 * px, s.y2 * px);
      ctx.strokeStyle = s.stroke;
      ctx.lineWidth = s.width * px;
      ctx.lineCap = 'round';
      ctx.stroke();
    } else if (s.kind === 'rect') {
      ctx.fillStyle = s.fill;
      roundRect(s.x * px, s.y * px, s.w * px, s.h * px, (s.r ?? 0) * px);
      ctx.fill();
    } else {
      let size = s.size * px;
      ctx.font = `900 ${size}px ${FONT}`;
      const max = s.maxWidth * px;
      const w = ctx.measureText(s.text).width;
      if (w > max) {
        size *= max / w;
        ctx.font = `900 ${size}px ${FONT}`;
      }
      ctx.fillStyle = s.fill;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(s.text, s.x * px, s.y * px);
    }
  }
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** SVG markup for one panel, positioned at (x, y) with width w. */
export function signSvgGroup(art: SignArt, x: number, y: number, w: number): string {
  const h = art.height * w;
  const u = (n: number) => (n * w).toFixed(2);
  const parts: string[] = [
    `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)})">`,
    `<rect width="${w}" height="${h.toFixed(2)}" rx="${u(0.05)}" fill="${art.bg}"/>`,
    `<rect x="${u(0.03)}" y="${u(0.03)}" width="${u(0.94)}" height="${(h - 0.06 * w).toFixed(2)}" rx="${u(0.035)}" fill="none" stroke="${art.border}" stroke-width="${u(0.022)}"/>`,
  ];
  for (const s of art.shapes) {
    if (s.kind === 'circle') {
      parts.push(
        `<circle cx="${u(s.cx)}" cy="${u(s.cy)}" r="${u(s.r)}" fill="${s.fill ?? 'none'}"${s.stroke ? ` stroke="${s.stroke}" stroke-width="${u(s.width ?? 0.02)}"` : ''}/>`,
      );
    } else if (s.kind === 'line') {
      parts.push(
        `<line x1="${u(s.x1)}" y1="${u(s.y1)}" x2="${u(s.x2)}" y2="${u(s.y2)}" stroke="${s.stroke}" stroke-width="${u(s.width)}" stroke-linecap="round"/>`,
      );
    } else if (s.kind === 'rect') {
      parts.push(
        `<rect x="${u(s.x)}" y="${u(s.y)}" width="${u(s.w)}" height="${u(s.h)}" rx="${u(s.r ?? 0)}" fill="${s.fill}"/>`,
      );
    } else {
      // Rough width estimate for condensed bold caps; squeeze long lines to fit.
      const estimate = s.text.length * s.size * 0.62;
      const fit =
        estimate > s.maxWidth
          ? ` textLength="${u(s.maxWidth)}" lengthAdjust="spacingAndGlyphs"`
          : '';
      parts.push(
        `<text x="${u(s.x)}" y="${u(s.y)}" font-family='Overpass, "Arial Narrow", Arial, sans-serif' font-weight="900" font-size="${u(s.size)}" fill="${s.fill}" text-anchor="middle"${fit}>${esc(s.text)}</text>`,
      );
    }
  }
  parts.push('</g>');
  return parts.join('');
}

/** A full "photo" of a sign pole as an SVG document: night street, pole, stacked panels. */
export function poleSvg(rules: readonly SignRule[], seed = 1): string {
  const W = 640;
  const panelW = 300;
  const gap = 14;
  const arts = [...rules].sort((a, b) => a.order - b.order).map(signArt);
  // Signs that repeat the same text (e.g. two time ranges on one sign) are drawn once.
  const unique = arts.filter(
    (a, i) => i === 0 || JSON.stringify(a.shapes) !== JSON.stringify(arts[i - 1]?.shapes),
  );
  const stackH = unique.reduce((sum, a) => sum + a.height * panelW + gap, 0);
  const H = Math.max(820, stackH + 260);
  const px = (W - panelW) / 2;
  let y = 90;
  const panels = unique
    .map((a) => {
      const g = signSvgGroup(a, px, y, panelW);
      y += a.height * panelW + gap;
      return g;
    })
    .join('');
  const tilt = ((seed * 37) % 5) - 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141A24"/><stop offset="0.7" stop-color="#2A2420"/><stop offset="1" stop-color="#3A2C1E"/></linearGradient>
<radialGradient id="lamp" cx="0.85" cy="0.08" r="0.6"><stop offset="0" stop-color="#FFB347" stop-opacity="0.55"/><stop offset="1" stop-color="#FFB347" stop-opacity="0"/></radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#sky)"/>
<rect width="${W}" height="${H}" fill="url(#lamp)"/>
<rect x="0" y="${H - 120}" width="${W}" height="120" fill="#1A1C20"/>
<g transform="rotate(${tilt} ${W / 2} ${H / 2})">
<rect x="${W / 2 - 9}" y="40" width="18" height="${H}" fill="#7C838C"/>
<rect x="${W / 2 - 9}" y="40" width="5" height="${H}" fill="#A3AAB3"/>
${panels}
</g>
</svg>`;
}
