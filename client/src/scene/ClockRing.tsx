import { Html } from '@react-three/drei';
import { type ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { formatTime, minuteOfDay, weekdayShort } from '../engine';
import { useAt } from '../lib/hooks';
import { useStore } from '../store';
import { POLE_POS } from './SignPole';

const R = 1.35;
const Y = 0.2;
const TAU = Math.PI * 2;

/** Angle on the ring for a minute-of-day: midnight at the back, clockwise seen from above. */
function angleFor(min: number) {
  return (min / 1440) * TAU;
}
function pointOn(angle: number, r = R): [number, number, number] {
  return [POLE_POS.x + Math.sin(angle) * r, Y, POLE_POS.z - Math.cos(angle) * r];
}

const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -Y);
const hit = new THREE.Vector3();

/** A draggable 24-hour ring around the pole base — drag it to move the hour. */
export function ClockRing({ color }: { color: string }) {
  const at = useAt();
  const setOffset = useStore((s) => s.setOffset);
  const setDragging = useStore((s) => s.setDraggingClock);
  const dragging = useStore((s) => s.draggingClock);
  const [hover, setHover] = useState(false);
  const lastMin = useRef(0);

  const minute = minuteOfDay(at);
  const knob = pointOn(angleFor(minute));
  const ticks = useMemo(() => Array.from({ length: 24 }, (_, h) => h), []);

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
    lastMin.current = minuteOfDay(at);
    setDragging(true);
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!useStore.getState().draggingClock) return;
    e.stopPropagation();
    if (!e.ray.intersectPlane(plane, hit)) return;
    const dx = hit.x - POLE_POS.x;
    const dz = hit.z - POLE_POS.z;
    let angle = Math.atan2(dx, -dz);
    if (angle < 0) angle += TAU;
    const newMin = Math.round(((angle / TAU) * 1440) / 5) * 5;
    let delta = newMin - lastMin.current;
    if (delta > 720) delta -= 1440;
    if (delta < -720) delta += 1440;
    if (delta === 0) return;
    lastMin.current = (newMin + 1440) % 1440;
    setOffset(useStore.getState().offsetMin + delta);
  };
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    (e.target as Element | null)?.releasePointerCapture?.(e.pointerId);
    setDragging(false);
  };

  const active = hover || dragging;

  return (
    <group>
      {/* visible ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[POLE_POS.x, Y, POLE_POS.z]}>
        <ringGeometry args={[R - 0.025, R + 0.025, 96]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={active ? 0.95 : 0.6}
          toneMapped={false}
        />
      </mesh>
      {/* progress arc from midnight to the current time */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[POLE_POS.x, Y + 0.002, POLE_POS.z]}>
        <ringGeometry
          args={[
            R - 0.06,
            R + 0.06,
            96,
            1,
            Math.PI / 2 - angleFor(minute),
            Math.max(0.0001, angleFor(minute)),
          ]}
        />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.35}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
      {ticks.map((h) => {
        const a = angleFor(h * 60);
        const [x, , z] = pointOn(a, R + 0.12);
        const major = h % 6 === 0;
        return (
          <mesh key={h} position={[x, Y, z]} rotation={[-Math.PI / 2, 0, -a]}>
            <planeGeometry args={[0.02, major ? 0.18 : 0.08]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={major ? 0.8 : 0.35} />
          </mesh>
        );
      })}
      {[0, 6, 12, 18].map((h) => {
        const [x, , z] = pointOn(angleFor(h * 60), R + 0.42);
        return (
          <Html
            key={h}
            position={[x, Y, z]}
            center
            zIndexRange={[5, 0]}
            style={{ pointerEvents: 'none' }}
          >
            <span className="font-sign text-[10px] font-bold text-white/60">
              {['12A', '6A', '12P', '6P'][h / 6]}
            </span>
          </Html>
        );
      })}
      {/* invisible, fat hit area so the ring is easy to grab */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[POLE_POS.x, Y + 0.01, POLE_POS.z]}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerOver={() => {
          setHover(true);
          document.body.style.cursor = 'grab';
        }}
        onPointerOut={() => {
          setHover(false);
          if (!useStore.getState().draggingClock) document.body.style.cursor = '';
        }}
      >
        <ringGeometry args={[R - 0.35, R + 0.35, 64]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* knob */}
      <mesh position={knob}>
        <sphereGeometry args={[active ? 0.13 : 0.1, 20, 20]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh position={[knob[0], Y + 0.45, knob[2]]}>
        <cylinderGeometry args={[0.008, 0.008, 0.9, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} toneMapped={false} />
      </mesh>
      <Html
        position={[knob[0], Y + 1.0, knob[2]]}
        center
        zIndexRange={[6, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div className="whitespace-nowrap rounded-md bg-black/70 px-2 py-0.5 font-sign text-xs font-bold text-signwhite">
          {weekdayShort(at)} {formatTime(at)}
        </div>
      </Html>
    </group>
  );
}
