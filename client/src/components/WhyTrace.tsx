import { useState } from 'react';
import type { ReasonStep } from '../engine';

const KIND_ICON: Record<ReasonStep['kind'], string> = {
  clock: '🕒',
  applies: '●',
  inactive: '○',
  skipped: '↷',
  exempt: '✓',
  ignored: '–',
  decision: '⇒',
  next: '→',
};

/** Collapsed to one tap; the full step-by-step reasoning is there when you want it. */
export function WhyTrace({
  steps,
  controlling,
}: {
  steps: ReasonStep[];
  controlling: number | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-black/20">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left"
      >
        <span className="font-sign text-sm font-black tracking-widest text-white/80">WHY?</span>
        <span className="flex items-center gap-2 text-xs text-white/50">
          {controlling != null ? `Sign ${controlling} decides` : 'No sign applies'}
          <span aria-hidden className={`transition ${open ? 'rotate-180' : ''}`}>
            ▾
          </span>
        </span>
      </button>
      {open && (
        <ol className="space-y-1.5 px-4 pb-3 text-[13px] leading-relaxed text-white/70">
          {steps.map((step, i) => {
            const strong =
              step.kind === 'decision' ||
              step.kind === 'next' ||
              (step.kind === 'applies' && step.signOrder === controlling);
            const dim =
              step.kind === 'inactive' || step.kind === 'skipped' || step.kind === 'ignored';
            return (
              <li
                key={i}
                className={`flex gap-2.5 ${dim ? 'text-white/40' : ''} ${strong ? 'text-signwhite' : ''}`}
              >
                <span
                  aria-hidden
                  className={`w-4 shrink-0 text-center ${strong ? 'text-sodium' : ''}`}
                >
                  {KIND_ICON[step.kind]}
                </span>
                <span className={strong ? 'font-medium' : ''}>{step.text}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
