import { useState } from 'react';
import { useStore } from '../store';

const REPO_URL =
  (import.meta.env.VITE_REPO_URL as string | undefined) ??
  'https://github.com/SaiGupta954/parksense#setup';

function isLocalHost(): boolean {
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h.endsWith('.localhost');
}

export function DemoBanner() {
  const mode = useStore((s) => s.mode);
  const health = useStore((s) => s.health);
  const forceDemo = useStore((s) => s.forceDemo);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);
  const openCapture = useStore((s) => s.setCaptureOpen);

  if (mode !== 'demo' || forceDemo || dismissed) return null;

  // Visitors on the hosted demo (GitHub Pages, Vercel…) get a welcome, not setup commands.
  if (!health && !isLocalHost()) {
    return (
      <div
        role="status"
        className="relative z-20 mx-auto mb-2 flex w-fit max-w-[calc(100%-2rem)] flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-sodium/25 bg-sodium/[0.07] px-3 py-2 text-xs text-white/80"
      >
        <span aria-hidden>👋</span>
        <span title="6 sample poles. Your own photos are read 100% on your computer with a free local AI.">
          Online demo
        </span>
        <button
          type="button"
          onClick={() => openCapture(true)}
          className="rounded-md px-2 py-0.5 font-semibold text-sodium hover:bg-sodium/10"
        >
          Try a sample
        </button>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md px-2 py-0.5 text-sodium underline-offset-2 hover:underline"
        >
          Run locally →
        </a>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="ml-auto rounded-md px-2 py-0.5 text-white/50 hover:text-white"
          aria-label="Dismiss demo notice"
        >
          ✕
        </button>
      </div>
    );
  }

  const pull = health?.pullCommand ?? 'ollama pull qwen2.5vl:7b';
  let reason: string;
  let command: string;
  if (!health) {
    reason = 'Server off';
    command = 'npm run dev';
  } else if (!health.ollama.reachable) {
    reason = 'Start Ollama';
    command = `ollama serve && ${pull}`;
  } else {
    reason = 'Add a vision model';
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
      className="relative z-20 mx-auto mb-2 flex w-fit max-w-[calc(100%-2rem)] flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-sodium/25 bg-sodium/[0.07] px-3 py-2 text-xs text-white/80"
    >
      <span aria-hidden>🧪</span>
      <span title="Demo mode uses 6 sample poles until the local AI is ready.">{reason}</span>
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
