import * as THREE from 'three';
import type { SignRule } from '../engine';
import { drawSignToCanvas, signArt } from '../signArt';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return [c, ctx];
}

/** Deterministic PRNG so textures look the same on every load. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function asphaltTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(512, 512);
  const rand = rng(7);
  ctx.fillStyle = '#16181c';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const v = 18 + Math.floor(rand() * 26);
    ctx.fillStyle = `rgba(${v},${v},${v + 3},${0.35 + rand() * 0.4})`;
    ctx.fillRect(rand() * 512, rand() * 512, 1 + rand() * 2, 1 + rand() * 2);
  }
  // a few cracks / tar seams
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    let x = rand() * 512;
    let y = rand() * 512;
    ctx.moveTo(x, y);
    for (let j = 0; j < 8; j++) {
      x += (rand() - 0.5) * 60;
      y += (rand() - 0.5) * 60;
      ctx.lineTo(x, y);
    }
    ctx.lineWidth = 1 + rand() * 1.5;
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function concreteTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(256, 256);
  const rand = rng(11);
  ctx.fillStyle = '#34373c';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2500; i++) {
    const v = 45 + Math.floor(rand() * 20);
    ctx.fillStyle = `rgba(${v},${v},${v},0.5)`;
    ctx.fillRect(rand() * 256, rand() * 256, 1.5, 1.5);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Building facade: dark wall + a grid of windows, some lit warm. Used as both map and emissive map. */
export function facadeTexture(seed: number, cols: number, rows: number): THREE.CanvasTexture {
  const W = cols * 32;
  const H = rows * 40;
  const [c, ctx] = canvas(W, H);
  const rand = rng(seed);
  ctx.fillStyle = '#0d0f13';
  ctx.fillRect(0, 0, W, H);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = rand() < 0.38;
      const warm = rand() < 0.75;
      ctx.fillStyle = lit
        ? warm
          ? `rgba(255,${170 + Math.floor(rand() * 40)},90,${0.6 + rand() * 0.4})`
          : 'rgba(170,200,255,0.7)'
        : '#15181d';
      ctx.fillRect(x * 32 + 7, y * 40 + 9, 18, 24);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const PANEL_TEX_WIDTH = 512;

export function panelTexture(rule: SignRule): THREE.CanvasTexture {
  const art = signArt(rule);
  const [c, ctx] = canvas(PANEL_TEX_WIDTH, Math.round(art.height * PANEL_TEX_WIDTH));
  drawSignToCanvas(ctx, art, PANEL_TEX_WIDTH);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
