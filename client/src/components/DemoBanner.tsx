import { useState } from 'react';
import { useStore } from '../store';

export function DemoBanner() {
  const mode = useStore((s) => s.mode);
  const health = useStore((s) => s.health);
  const forceDemo = useStore((s) => s.forceDemo);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  if (mode !== 'demo' || forceDemo || dismissed) return null;

  const pull = health?.pullCommand ?? 'ollama pull qwen2.5vl:7b';
  let reason: string;
  let command: string;
  if (!health) {
    reason = 'No local ParkSense server found, so you’re in Demo mode with 6 sample sign stacks.';
    command = 'npm run dev';
  } else if (!health.ollama.reachable) {
    reason = 'Ollama isn’t running, so you’re in Demo mode. Start it, then pull a vision model:';
    command = `ollama serve && ${pull}`;
  } else {
    reason = 'Ollama is running but has no vision model yet. You’re in Demo mode until you run:';
    command = pull;
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the command is visible anyway */
    }
  };

  return (
    <div
      role="status"
      className="relative z-20 mx-4 mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-sodium/25 bg-sodium/[0.07] px-3 py-2 text-xs text-white/80 lg:mx-6"
    >
      <span aria-hidden>🧪</span>
      <span>{reason}</span>
      <code className="rounded-md bg-black/40 px-2 py-0.5 font-mono text-[11px] text-sodium">
        {command}
      </code>
      <button
        type="button"
        onClick={copy}
        className="rounded-md px-2 py-0.5 text-sodium hover:bg-sodium/10"
      >
        {copied ? 'Copied ✓' : 'Copy'}
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="ml-auto rounded-md px-2 py-0.5 text-white/50 hover:text-white"
        aria-label="Dismiss demo mode notice"
      >
        ✕
      </button>
    </div>
  );
}
