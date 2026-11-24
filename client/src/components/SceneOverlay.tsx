import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { statusIcon, statusLabel, STATUSES } from '../engine';
import { STATUS_COLOR } from '../lib/answer';
import { useStore, type View } from '../store';

const SCAN_STEPS = ['Finding signs…', 'Reading times…', 'Checking the rules…'];

function ScanOverlay() {
  const phase = useStore((s) => s.phase);
  const photoUrl = useStore((s) => s.photoUrl);
  const mode = useStore((s) => s.mode);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (phase !== 'scanning') return;
    setStep(0);
    const id = window.setInterval(
      () => setStep((s) => Math.min(s + 1, SCAN_STEPS.length - 1)),
      800,
    );
    return () => window.clearInterval(id);
  }, [phase]);

  return (
    <AnimatePresence>
      {phase === 'scanning' && (
        <motion.div
          key="scan"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.6, x: -40, y: 20 }}
          transition={{ duration: 0.45 }}
          className="absolute inset-0 z-20 grid place-items-center bg-asphalt/70 backdrop-blur-sm"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="relative h-[min(52vh,30vw)] min-h-[220px] overflow-hidden rounded-2xl border border-white/10 shadow-glass lg:h-[56vh]">
              {photoUrl && (
                <img
                  src={photoUrl}
                  alt="Captured sign photo"
                  className="h-full w-auto object-contain"
                />
              )}
              <div className="scanline" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-asphalt/40" />
            </div>
            <div
              className="flex items-center gap-2 font-sign text-sm font-bold tracking-wide text-sodium"
              aria-hidden
            >
              <span className="h-2 w-2 animate-ping rounded-full bg-sodium" />
              {SCAN_STEPS[step]}
            </div>
            <p className="text-[11px] text-white/45">
              {mode === 'ai'
                ? '🔒 Reading on this device — nothing is uploaded.'
                : 'Demo: using the sample’s known rules.'}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ViewToggle() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const views: Array<[View, string]> = [
    ['street', 'Street'],
    ['week', 'Week Tower'],
  ];
  return (
    <div
      role="tablist"
      aria-label="3D view"
      className="glass inline-flex rounded-full p-1 shadow-glass"
    >
      {views.map(([v, label]) => (
        <button
          key={v}
          role="tab"
          type="button"
          aria-selected={view === v}
          onClick={() => setView(v)}
          className={`rounded-full px-3.5 py-1 font-sign text-xs font-bold tracking-wide transition ${
            view === v ? 'bg-signwhite text-asphalt' : 'text-white/70 hover:text-white'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Legend() {
  return (
    <ul className="glass hidden flex-wrap gap-x-3 gap-y-1 rounded-xl px-3 py-2 text-[11px] text-white/75 shadow-glass sm:flex">
      {STATUSES.map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ background: STATUS_COLOR[s] }}
            aria-hidden
          />
          <span aria-hidden>{statusIcon(s)}</span>
          {s === 'TIME_LIMITED' ? 'Time limit' : statusLabel(s)}
        </li>
      ))}
    </ul>
  );
}

export function SceneOverlay() {
  const view = useStore((s) => s.view);
  const photoUrl = useStore((s) => s.photoUrl);
  const phase = useStore((s) => s.phase);
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3">
        <div className="pointer-events-auto">
          <ViewToggle />
        </div>
        {photoUrl && phase !== 'scanning' && (
          <img
            src={photoUrl}
            alt="The photo these rules were read from"
            className="pointer-events-auto h-20 w-auto rounded-lg border border-white/10 object-contain opacity-80 shadow-glass transition hover:h-64 hover:opacity-100"
          />
        )}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-2 p-3">
        <Legend />
        <p className="hidden text-[11px] text-white/40 md:block">
          {view === 'street'
            ? 'Drag the ring to change the hour · drag the scene to orbit'
            : 'Hover a block · click to jump there'}
        </p>
      </div>
      <ScanOverlay />
    </>
  );
}
