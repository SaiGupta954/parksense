import { AdaptiveDpr, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { isParkable } from '../engine';
import { STATUS_COLOR } from '../lib/answer';
import { useEvaluation, useReducedMotion } from '../lib/hooks';
import { useStore, type View } from '../store';
import { Atmosphere } from './Atmosphere';
import { Car } from './Car';
import { ClockRing } from './ClockRing';
import { SignPole } from './SignPole';
import { Street } from './Street';
import { WeekTower } from './WeekTower';

const PRESETS: Record<View, { pos: THREE.Vector3; target: THREE.Vector3 }> = {
  street: { pos: new THREE.Vector3(3.3, 2.45, 5.9), target: new THREE.Vector3(-0.55, 1.95, -0.2) },
  week: { pos: new THREE.Vector3(-0.6, 10.5, 11.8), target: new THREE.Vector3(-0.6, 0, 0.3) },
};

/** Glides the camera between the street and the Week Tower (snaps with reduced motion). */
function CameraRig({ controls }: { controls: React.RefObject<OrbitControlsImpl> }) {
  const view = useStore((s) => s.view);
  const reduced = useReducedMotion();
  const camera = useThree((s) => s.camera);
  const moving = useRef(true);
  const scanId = useStore((s) => s.scanId);

  useEffect(() => {
    moving.current = true;
  }, [view, scanId]);

  useFrame((_, dt) => {
    const c = controls.current;
    if (!moving.current || !c) return;
    const p = PRESETS[view];
    if (reduced) {
      camera.position.copy(p.pos);
      c.target.copy(p.target);
      moving.current = false;
    } else {
      const k = 1 - Math.exp(-dt * 3.2);
      camera.position.lerp(p.pos, k);
      c.target.lerp(p.target, k);
      if (camera.position.distanceTo(p.pos) < 0.02 && c.target.distanceTo(p.target) < 0.02)
        moving.current = false;
    }
    c.update();
  });

  // Let the user take over the camera at any time.
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const stop = () => {
      moving.current = false;
    };
    c.addEventListener('start', stop);
    return () => c.removeEventListener('start', stop);
  }, [controls]);

  return null;
}

function Scene() {
  const { result } = useEvaluation();
  const view = useStore((s) => s.view);
  const dragging = useStore((s) => s.draggingClock);
  const controls = useRef<OrbitControlsImpl>(null);
  const color = STATUS_COLOR[result.status];

  return (
    <>
      <Atmosphere />
      {view === 'street' ? (
        <>
          <Street />
          <SignPole evaluation={result} />
          <Car parked={isParkable(result.status)} />
          <ClockRing color={color} />
        </>
      ) : (
        <WeekTower />
      )}
      <OrbitControls
        ref={controls}
        makeDefault
        enabled={!dragging}
        enablePan={false}
        enableDamping
        minDistance={4}
        maxDistance={18}
        minPolarAngle={0.35}
        maxPolarAngle={1.48}
      />
      <CameraRig controls={controls} />
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.62} luminanceSmoothing={0.2} />
        <Vignette offset={0.28} darkness={0.72} />
      </EffectComposer>
    </>
  );
}

export default function SceneCanvas() {
  return (
    <Canvas
      className="!absolute inset-0"
      dpr={[1, 2]}
      camera={{ position: PRESETS.street.pos.toArray(), fov: 42, near: 0.1, far: 200 }}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      onPointerMissed={() => useStore.getState().setDraggingClock(false)}
    >
      <AdaptiveDpr pixelated={false} />
      <Scene />
    </Canvas>
  );
}
