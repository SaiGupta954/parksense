import * as THREE from 'three';

export interface Daylight {
  /** 0 = night, 1 = full day. */
  day: number;
  /** Sun elevation, -1..1. */
  elevation: number;
  /** Sun direction (unit-ish), for the directional light. */
  sunPos: THREE.Vector3;
  sky: THREE.Color;
}

const NIGHT = new THREE.Color('#06080c');
const DUSK = new THREE.Color('#3a2638');
const DAY = new THREE.Color('#5f7d9c');

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function daylightAt(date: Date): Daylight {
  const h = date.getHours() + date.getMinutes() / 60;
  const angle = ((h - 6) / 12) * Math.PI; // sunrise 6:00, sunset 18:00
  const elevation = Math.sin(angle);
  const day = smoothstep(-0.12, 0.3, elevation);
  const sky = new THREE.Color();
  if (day < 0.5) sky.lerpColors(NIGHT, DUSK, day * 2);
  else sky.lerpColors(DUSK, DAY, (day - 0.5) * 2);
  const sunPos = new THREE.Vector3(Math.cos(angle) * 22, Math.max(elevation, -0.3) * 18 + 2, 10);
  return { day, elevation, sunPos, sky };
}
