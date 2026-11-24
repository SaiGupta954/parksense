import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Evaluation, SignRule } from '../engine';
import { STATUS_COLOR } from '../lib/answer';
import { useReducedMotion } from '../lib/hooks';
import { signArt } from '../signArt';
import { useStore } from '../store';
import { panelTexture } from './textures';

export const POLE_POS = new THREE.Vector3(0, 0, -0.45);
const PANEL_W = 0.95;
const GAP = 0.07;
const TOP = 3.4;
const MAX_STACK = 3.3;

/** Re-draw textures once the Overpass webfont is ready (canvas can't wait for it on its own). */
function useFontsReady(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    const fonts = document.fonts;
    if (!fonts?.load) return;
    void Promise.all([fonts.load('900 64px Overpass'), fonts.ready]).then(() => {
      if (alive) setN((x) => x + 1);
    });
    return () => {
      alive = false;
    };
  }, []);
  return n;
}

type PanelState = 'controlling' | 'active' | 'inactive' | 'skipped';

const easeOutBack = (t: number) => {
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

function Panel({
  rule,
  y,
  height,
  width,
  state,
  index,
  scanId,
  glowColor,
  fontsVersion,
}: {
  rule: SignRule;
  y: number;
  height: number;
  width: number;
  state: PanelState;
  index: number;
  scanId: number;
  glowColor: string;
  fontsVersion: number;
}) {
  const reduced = useReducedMotion();
  const group = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const glow = useRef<THREE.MeshBasicMaterial>(null);
  const progress = useRef(reduced ? 1 : 0);
  const clock = useRef(0);

  // Only redraw the texture when what's printed on the sign changes (or the font finishes loading).
  const { rawText, type, arrow } = rule;
  const tex = useMemo(
    () => panelTexture({ ...rule, rawText, type, arrow }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawText, type, arrow, fontsVersion],
  );
  useEffect(() => () => tex.dispose(), [tex]);

  useEffect(() => {
    progress.current = reduced ? 1 : 0;
    clock.current = 0;
  }, [scanId, reduced]);

  const target = useMemo(() => new THREE.Vector3(0, y, 0.07), [y]);
  const start = useMemo(
    () => new THREE.Vector3(2.6 + index * 0.25, 2.4 + index * 0.35, 4.2),
    [index],
  );
  const dimColor = useMemo(() => new THREE.Color(), []);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    // Fly-in from the "photo" towards the pole, staggered top to bottom.
    if (progress.current < 1) {
      clock.current += dt;
      const t = Math.min(1, Math.max(0, (clock.current - index * 0.14) / 0.85));
      progress.current = t;
      const e = easeOutBack(t);
      g.position.lerpVectors(start, target, e);
      g.rotation.set((1 - e) * -0.6, (1 - e) * -1.8, (1 - e) * 0.3);
      const s = 0.4 + 0.6 * Math.min(1, e);
      g.scale.setScalar(s);
    } else {
      g.position.copy(target);
      g.rotation.set(0, 0, 0);
      g.scale.setScalar(1);
    }
    const k = 1 - Math.exp(-dt * 8);
    if (mat.current) {
      const want = state === 'controlling' ? 0.62 : state === 'active' ? 0.3 : 0.04;
      mat.current.emissiveIntensity += (want - mat.current.emissiveIntensity) * k;
      dimColor.set(state === 'controlling' || state === 'active' ? '#ffffff' : '#4a4a4a');
      mat.current.color.lerp(dimColor, k);
    }
    if (glow.current) {
      const want = state === 'controlling' ? 0.95 : 0;
      glow.current.opacity += (want - glow.current.opacity) * k;
      glow.current.color.set(glowColor);
    }
  });

  return (
    <group ref={group} position={start}>
      {/* glow frame behind the controlling panel (blooms) */}
      <mesh position={[0, 0, -0.012]}>
        <planeGeometry args={[width + 0.12, height + 0.12]} />
        <meshBasicMaterial
          ref={glow}
          color={glowColor}
          transparent
          opacity={0}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <boxGeometry args={[width, height, 0.012]} />
        <meshStandardMaterial attach="material-0" color="#9aa0a6" metalness={0.7} roughness={0.4} />
        <meshStandardMaterial attach="material-1" color="#9aa0a6" metalness={0.7} roughness={0.4} />
        <meshStandardMaterial attach="material-2" color="#9aa0a6" metalness={0.7} roughness={0.4} />
        <meshStandardMaterial attach="material-3" color="#9aa0a6" metalness={0.7} roughness={0.4} />
        <meshStandardMaterial
          attach="material-4"
          ref={mat}
          map={tex}
          emissiveMap={tex}
          emissive="#ffffff"
          emissiveIntensity={0.3}
          roughness={0.55}
        />
        <meshStandardMaterial attach="material-5" color="#7d8288" metalness={0.8} roughness={0.5} />
      </mesh>
      {/* mounting brackets */}
      {[height / 2 - 0.08, -height / 2 + 0.08].map((by) => (
        <mesh key={by} position={[0, by, -0.035]}>
          <boxGeometry args={[0.16, 0.03, 0.05]} />
          <meshStandardMaterial color="#5b6066" metalness={0.8} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

export function SignPole({ evaluation }: { evaluation: Evaluation }) {
  const rules = useStore((s) => s.rules);
  const scanId = useStore((s) => s.scanId);
  const fontsVersion = useFontsReady();
  const glowColor = STATUS_COLOR[evaluation.status];

  // Tall stacks are scaled down so the bottom sign stays above the sidewalk.
  const { layout, width, top } = useMemo(() => {
    const sorted = [...rules].sort((a, b) => a.order - b.order);
    const heights = sorted.map((r) => signArt(r).height * PANEL_W);
    const total = heights.reduce((a, h) => a + h + GAP, 0);
    const scale = Math.min(1, MAX_STACK / Math.max(total, 0.001));
    const topY = Math.max(TOP, 0.55 + total * scale);
    let y = topY;
    const items = sorted.map((rule, i) => {
      const h = (heights[i] ?? 0) * scale;
      const center = y - h / 2;
      y -= h + GAP * scale;
      return { rule, y: center, h };
    });
    return { layout: items, width: PANEL_W * scale, top: topY };
  }, [rules]);

  const poleHeight = top + 0.3;

  const stateOf = (r: SignRule): PanelState =>
    evaluation.controllingSignOrder === r.order
      ? 'controlling'
      : evaluation.skippedSignOrders.includes(r.order)
        ? 'skipped'
        : evaluation.activeSignOrders.includes(r.order)
          ? 'active'
          : 'inactive';

  return (
    <group position={POLE_POS}>
      <mesh position={[0, poleHeight / 2, 0]}>
        <cylinderGeometry args={[0.045, 0.055, poleHeight, 16]} />
        <meshStandardMaterial color="#8d939b" metalness={0.75} roughness={0.35} />
      </mesh>
      <mesh position={[0, poleHeight, 0]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial color="#8d939b" metalness={0.75} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.1, 0.12, 0.08, 16]} />
        <meshStandardMaterial color="#55595f" />
      </mesh>
      {layout.map(({ rule, y, h }, i) => (
        <Panel
          key={`${scanId}-${rule.order}`}
          rule={rule}
          y={y}
          height={h}
          width={width}
          index={i}
          state={stateOf(rule)}
          scanId={scanId}
          glowColor={glowColor}
          fontsVersion={fontsVersion}
        />
      ))}
    </group>
  );
}
