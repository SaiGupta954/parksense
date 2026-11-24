import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  formatClock,
  quoteSign,
  statusIcon,
  statusLabel,
  weekdayShort,
  type Status,
  type WeekCell,
} from '../engine';
import { STATUS_COLOR } from '../lib/answer';
import { useAt, useReducedMotion, useWeekGrid } from '../lib/hooks';
import { useStore } from '../store';

const SIZE = 0.36;
const GAP = 0.07;
const HEIGHT: Record<Status, number> = {
  ALLOWED: 0.18,
  TIME_LIMITED: 0.5,
  PAID: 0.7,
  PERMIT_ONLY: 0.95,
  NOT_ALLOWED: 1.25,
};

const geo = new THREE.BoxGeometry(SIZE, 1, SIZE);
geo.translate(0, 0.5, 0);

function Block({
  cell,
  x,
  z,
  past,
  current,
  delay,
  onHover,
  onPick,
}: {
  cell: WeekCell;
  x: number;
  z: number;
  past: boolean;
  current: boolean;
  delay: number;
  onHover: (c: WeekCell | null) => void;
  onPick: (c: WeekCell) => void;
}) {
  const reduced = useReducedMotion();
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const [hover, setHover] = useState(false);
  const t = useRef(reduced ? 10 : 0);
  const color = STATUS_COLOR[cell.status];
  const h = HEIGHT[cell.status];

  useFrame((_, dt) => {
    if (!mesh.current) return;
    t.current += dt;
    const grow = Math.min(1, Math.max(0, (t.current - delay) / 0.5));
    const target = h * (hover ? 1.15 : 1) * (1 - Math.pow(1 - grow, 3));
    mesh.current.scale.y +=
      (Math.max(0.001, target) - mesh.current.scale.y) * (1 - Math.exp(-dt * 14));
    if (mat.current) {
      const want = hover || current ? 1.1 : past ? 0.05 : 0.35;
      mat.current.emissiveIntensity +=
        (want - mat.current.emissiveIntensity) * (1 - Math.exp(-dt * 10));
    }
  });

  return (
    <mesh
      ref={mesh}
      geometry={geo}
      position={[x, 0, z]}
      scale={[1, 0.001, 1]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
        onHover(cell);
        document.body.style.cursor = past ? 'not-allowed' : 'pointer';
      }}
      onPointerOut={() => {
        setHover(false);
        onHover(null);
        document.body.style.cursor = '';
      }}
      onClick={(e) => {
        e.stopPropagation();
        onPick(cell);
      }}
    >
      <meshStandardMaterial
        ref={mat}
        color={color}
        emissive={color}
        emissiveIntensity={0.3}
        roughness={0.45}
        metalness={0.1}
        transparent={past}
        opacity={past ? 0.28 : 1}
      />
    </mesh>
  );
}

/** 7 days × 24 hours of parking status as a 3D bar grid. */
export function WeekTower() {
  const grid = useWeekGrid();
  const rules = useStore((s) => s.rules);
  const baseTime = useStore((s) => s.baseTime);
  const setOffset = useStore((s) => s.setOffset);
  const scanId = useStore((s) => s.scanId);
  const at = useAt();
  const [hovered, setHovered] = useState<WeekCell | null>(null);

  const pitch = SIZE + GAP;
  const pos = (d: number, h: number): [number, number] => [
    (h - 11.5) * pitch,
    (d - 3) * pitch * 1.25,
  ];

  const currentKey = useMemo(() => {
    const day0 = grid[0]?.[0]?.at;
    if (!day0) return '';
    const d = Math.floor((at.getTime() - day0.getTime()) / 86_400_000);
    return `${d}:${at.getHours()}`;
  }, [grid, at]);

  const pick = (cell: WeekCell) => {
    const diff = (cell.at.getTime() - baseTime) / 60_000;
    if (diff < -59) return;
    setOffset(Math.max(0, diff + 30));
  };

  const hoverText = (cell: WeekCell) => {
    const rule = rules.find((r) => r.order === cell.controllingSignOrder);
    return {
      title: `${weekdayShort(cell.at)} ${formatClock(cell.at.getHours() * 60)}`,
      status: `${statusIcon(cell.status)} ${statusLabel(cell.status, cell.maxMinutes)}`,
      rule: rule ? `Sign ${rule.order}: “${quoteSign(rule.rawText)}”` : 'No sign restricts parking',
    };
  };

  const [cx, cz] = currentKey
    ? pos(Number(currentKey.split(':')[0]), Number(currentKey.split(':')[1]))
    : [0, 0];

  return (
    <group key={scanId}>
      {/* base plate */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[24 * pitch + 1.6, 7 * pitch * 1.25 + 1.6]} />
        <meshStandardMaterial color="#101317" roughness={0.9} />
      </mesh>
      {grid.map((row, d) =>
        row.map((cell, h) => {
          const [x, z] = pos(d, h);
          const past = cell.at.getTime() + 3_600_000 <= baseTime;
          return (
            <Block
              key={`${d}-${h}`}
              cell={cell}
              x={x}
              z={z}
              past={past}
              current={`${d}:${h}` === currentKey}
              delay={d * 0.06 + h * 0.012}
              onHover={setHovered}
              onPick={pick}
            />
          );
        }),
      )}
      {/* "you are here in time" beacon */}
      {currentKey && (
        <mesh position={[cx, 1.6, cz]}>
          <cylinderGeometry args={[0.025, 0.025, 3.2, 8]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.85} toneMapped={false} />
        </mesh>
      )}
      {grid.map((row, d) => {
        const [x, z] = pos(d, -1.2);
        return (
          <Html
            key={d}
            position={[x, 0.05, z]}
            center
            zIndexRange={[5, 0]}
            style={{ pointerEvents: 'none' }}
          >
            <span className="font-sign text-xs font-black text-white/70">
              {row[0] ? (d === 0 ? 'Today' : weekdayShort(row[0].at)) : ''}
            </span>
          </Html>
        );
      })}
      {[0, 6, 12, 18].map((h) => {
        const [x, z] = pos(7.2, h);
        return (
          <Html
            key={h}
            position={[x, 0.05, z - 0.2]}
            center
            zIndexRange={[5, 0]}
            style={{ pointerEvents: 'none' }}
          >
            <span className="font-sign text-[10px] font-bold text-white/50">
              {['12 AM', '6 AM', '12 PM', '6 PM'][h / 6]}
            </span>
          </Html>
        );
      })}
      {hovered &&
        (() => {
          const d = grid.findIndex((row) => row.includes(hovered));
          const h = hovered.at.getHours();
          const [x, z] = pos(d, h);
          const t = hoverText(hovered);
          return (
            <Html
              position={[x, HEIGHT[hovered.status] + 0.5, z]}
              center
              zIndexRange={[20, 10]}
              style={{ pointerEvents: 'none' }}
            >
              <div className="w-56 rounded-xl border border-white/10 bg-asphalt/90 p-2.5 text-xs shadow-glass backdrop-blur">
                <p className="font-sign font-black text-signwhite">{t.title}</p>
                <p className="font-semibold" style={{ color: STATUS_COLOR[hovered.status] }}>
                  {t.status}
                </p>
                <p className="mt-0.5 text-white/60">{t.rule}</p>
              </div>
            </Html>
          );
        })()}
    </group>
  );
}
