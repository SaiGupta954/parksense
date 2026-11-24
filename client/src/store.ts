import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { MINUTES_PER_WEEK, type Profile, type ReadResult, type SignRule } from './engine';
import type { Health } from './api';
import { SAMPLES } from './samples/samples';

export type Mode = 'checking' | 'ai' | 'demo';
export type View = 'street' | 'week';
export type ScanPhase = 'idle' | 'scanning' | 'error';

export interface AppError {
  title: string;
  detail: string;
  /** What the user can do next. */
  action?: 'retry' | 'samples' | 'upload' | 'manual';
}

export interface ScanSource {
  kind: 'sample' | 'photo' | 'history' | 'manual';
  label: string;
  model?: string;
}

export const MAX_OFFSET = MINUTES_PER_WEEK - 15;

function roundedNow(): number {
  const d = new Date();
  d.setSeconds(0, 0);
  return d.getTime();
}

interface State {
  mode: Mode;
  health: Health | null;
  /** User chose demo even though AI is available. */
  forceDemo: boolean;

  rules: SignRule[];
  notes: string;
  readable: boolean;
  source: ScanSource;
  photoUrl: string | null;
  /** Increments every time a new set of signs lands — drives the fly-in animation. */
  scanId: number;
  edited: boolean;
  confirmed: boolean;

  phase: ScanPhase;
  error: AppError | null;

  baseTime: number;
  offsetMin: number;
  profile: Profile;
  view: View;
  draggingClock: boolean;
  captureOpen: boolean;
  settingsOpen: boolean;

  setHealth(health: Health | null): void;
  setForceDemo(v: boolean): void;
  loadResult(result: ReadResult, source: ScanSource, photoUrl: string | null): void;
  startScan(photoUrl: string): void;
  failScan(error: AppError): void;
  clearError(): void;
  updateRule(order: number, patch: Partial<SignRule>): void;
  addRule(): void;
  removeRule(order: number): void;
  confirmRules(): void;
  setOffset(min: number): void;
  goLive(): void;
  setProfile(patch: Partial<Profile>): void;
  setView(view: View): void;
  setDraggingClock(v: boolean): void;
  setCaptureOpen(v: boolean): void;
  setSettingsOpen(v: boolean): void;
}

const first = SAMPLES.find((s) => s.id === 'nightmare') ?? SAMPLES[0];

export const useStore = create<State>()(
  persist(
    (set) => ({
      mode: 'checking',
      health: null,
      forceDemo: false,

      rules: first ? first.expected.signs : [],
      notes: first ? first.expected.notes : '',
      readable: true,
      source: { kind: 'sample', label: first?.title ?? 'Sample' },
      photoUrl: null,
      scanId: 1,
      edited: false,
      confirmed: false,

      phase: 'idle',
      error: null,

      baseTime: roundedNow(),
      offsetMin: 0,
      profile: { side: 'both' },
      view: 'street',
      draggingClock: false,
      captureOpen: false,
      settingsOpen: false,

      setHealth: (health) =>
        set((s) => ({
          health,
          mode: !s.forceDemo && health?.ollama.reachable && health.ollama.model ? 'ai' : 'demo',
        })),
      setForceDemo: (forceDemo) =>
        set((s) => ({
          forceDemo,
          mode: !forceDemo && s.health?.ollama.reachable && s.health.ollama.model ? 'ai' : 'demo',
        })),
      loadResult: (result, source, photoUrl) =>
        set((s) => ({
          rules: [...result.signs].sort((a, b) => a.order - b.order),
          notes: result.notes,
          readable: result.readable,
          source,
          photoUrl,
          scanId: s.scanId + 1,
          edited: false,
          confirmed: false,
          phase: 'idle',
          error: null,
          captureOpen: false,
        })),
      startScan: (photoUrl) =>
        set({ phase: 'scanning', photoUrl, error: null, captureOpen: false }),
      failScan: (error) => set({ phase: 'error', error }),
      clearError: () => set({ phase: 'idle', error: null }),
      updateRule: (order, patch) =>
        set((s) => ({
          rules: s.rules.map((r) => (r.order === order ? { ...r, ...patch, confidence: 1 } : r)),
          edited: true,
        })),
      addRule: () =>
        set((s) => {
          const order = s.rules.reduce((m, r) => Math.max(m, r.order), 0) + 1;
          const rule: SignRule = {
            order,
            rawText: 'NO PARKING',
            type: 'no_parking',
            days: [],
            anytime: false,
            start: '08:00',
            end: '10:00',
            maxMinutes: null,
            permitZone: null,
            exceptText: null,
            arrow: 'none',
            confidence: 1,
          };
          return { rules: [...s.rules, rule], edited: true, scanId: s.scanId + 1 };
        }),
      removeRule: (order) =>
        set((s) => ({
          rules: s.rules.filter((r) => r.order !== order).map((r, i) => ({ ...r, order: i + 1 })),
          edited: true,
          scanId: s.scanId + 1,
        })),
      confirmRules: () => set({ confirmed: true }),
      setOffset: (min) => set({ offsetMin: Math.max(0, Math.min(MAX_OFFSET, Math.round(min))) }),
      goLive: () => set({ baseTime: roundedNow(), offsetMin: 0 }),
      setProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
      setView: (view) => set({ view }),
      setDraggingClock: (draggingClock) => set({ draggingClock }),
      setCaptureOpen: (captureOpen) => set({ captureOpen }),
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
    }),
    {
      name: 'parksense:prefs',
      storage: createJSONStorage(() => {
        try {
          return window.localStorage;
        } catch {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
      }),
      partialize: (s) => ({ profile: s.profile, forceDemo: s.forceDemo }),
    },
  ),
);

/** The moment the user is looking at (live, or scrubbed). */
export function selectAt(s: Pick<State, 'baseTime' | 'offsetMin'>): Date {
  return new Date(s.baseTime + s.offsetMin * 60_000);
}

export function lowConfidence(
  s: Pick<State, 'rules' | 'readable' | 'notes' | 'confirmed'>,
): boolean {
  if (s.confirmed) return false;
  return !s.readable || s.rules.some((r) => r.confidence < 0.7);
}
