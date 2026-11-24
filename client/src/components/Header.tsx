import { useStore } from '../store';

export function Header() {
  const mode = useStore((s) => s.mode);
  const model = useStore((s) => s.health?.ollama.model);
  const setCaptureOpen = useStore((s) => s.setCaptureOpen);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);

  return (
    <header className="relative z-20 flex items-center gap-3 px-4 py-3 lg:px-6">
      <div className="flex items-center gap-2.5">
        <div
          aria-hidden
          className="grid h-9 w-9 place-items-center rounded-xl border-2 border-permit bg-signwhite font-sign text-xl font-black text-permit shadow-sodium"
        >
          P
        </div>
        <div className="leading-tight">
          <h1 className="font-sign text-lg font-black tracking-wide text-signwhite">ParkSense</h1>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-permit/40 bg-permit/10 px-2.5 py-1 text-[11px] font-medium text-permit"
          title="Your photo is processed by a model running on this computer. Nothing is uploaded."
        >
          <span aria-hidden>🔒</span>
          <span className="sr-only lg:not-sr-only">On-device</span>
        </span>
        <span
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium ${
            mode === 'ai'
              ? 'border-sodium/40 bg-sodium/10 text-sodium'
              : 'border-white/15 bg-white/5 text-white/70'
          }`}
        >
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${mode === 'ai' ? 'bg-sodium' : mode === 'checking' ? 'animate-pulse bg-white/50' : 'bg-white/50'}`}
          />
          <span title={model ?? undefined}>
            {mode === 'ai' ? 'Local AI' : mode === 'checking' ? '…' : 'Demo'}
          </span>
        </span>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
          aria-label="Parking settings"
        >
          ⚙︎
        </button>
        <button
          type="button"
          onClick={() => setCaptureOpen(true)}
          className="whitespace-nowrap rounded-full bg-sodium px-4 py-1.5 font-sign text-sm font-black tracking-wide text-asphalt shadow-sodium hover:brightness-110"
        >
          <span className="sm:hidden">SCAN</span>
          <span className="hidden sm:inline">SCAN A SIGN</span>
        </button>
      </div>
    </header>
  );
}
