import { lazy, Suspense, useEffect, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { fetchHealth } from './api';
import { useStore } from './store';
import { scanBlob } from './lib/scan';
import { Header } from './components/Header';
import { DemoBanner } from './components/DemoBanner';
import { AnswerPanel } from './components/AnswerPanel';
import { Scrubber } from './components/Scrubber';
import { SceneOverlay } from './components/SceneOverlay';
import { CaptureSheet } from './components/CaptureSheet';
import { SettingsSheet } from './components/SettingsSheet';
import { LiveRegion } from './components/LiveRegion';

const SceneCanvas = lazy(() => import('./scene/SceneCanvas'));

function SceneFallback() {
  return (
    <div className="absolute inset-0 grid place-items-center text-sm text-white/40">
      <span className="animate-pulse font-sign tracking-widest">BUILDING THE STREET…</span>
    </div>
  );
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function App() {
  const setHealth = useStore((s) => s.setHealth);
  const goLive = useStore((s) => s.goLive);
  const [dragging, setDragging] = useState(false);
  const [gl] = useState(webglAvailable);

  useEffect(() => {
    let alive = true;
    const check = () =>
      void fetchHealth().then((h) => {
        if (alive) setHealth(h);
      });
    check();
    const id = window.setInterval(check, 30_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [setHealth]);

  // Keep "live" time fresh while the user hasn't scrubbed.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (useStore.getState().offsetMin === 0) goLive();
    }, 30_000);
    return () => window.clearInterval(id);
  }, [goLive]);

  // Drag-and-drop a photo anywhere.
  useEffect(() => {
    const over = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault();
        setDragging(true);
      }
    };
    const leave = (e: DragEvent) => {
      if (e.relatedTarget == null) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer?.files[0];
      if (file) void scanBlob(file, file.name);
    };
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="street-bg grain flex min-h-full flex-col lg:h-screen">
        <Header />
        <DemoBanner />
        <main className="layout flex-1 lg:min-h-0">
          <section
            className="area-scene relative h-[45vh] overflow-hidden border-b border-white/5 lg:h-auto lg:border-b-0 lg:border-r"
            aria-label="3D street scene"
          >
            {gl ? (
              <Suspense fallback={<SceneFallback />}>
                <SceneCanvas />
              </Suspense>
            ) : (
              <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/60">
                3D needs WebGL, which this browser has turned off. Everything else still works.
              </div>
            )}
            <SceneOverlay />
          </section>
          <div className="area-scrub border-t border-white/5">
            <Scrubber />
          </div>
          <aside
            className="area-panel relative rounded-t-3xl lg:mt-0 lg:min-h-0 lg:overflow-y-auto lg:rounded-none"
            aria-label="Answer"
          >
            <AnswerPanel />
          </aside>
        </main>
        <footer className="border-t border-white/5 px-4 py-2 text-center text-[11px] text-white/45">
          ParkSense is a helper, not legal advice. Always double-check the sign.
        </footer>
        <CaptureSheet />
        <SettingsSheet />
        <LiveRegion />
        {dragging && (
          <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm">
            <div className="rounded-3xl border-2 border-dashed border-sodium px-10 py-8 font-sign text-2xl font-black tracking-wide text-sodium">
              DROP THE SIGN PHOTO
            </div>
          </div>
        )}
      </div>
    </MotionConfig>
  );
}
