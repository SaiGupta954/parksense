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

export function WhyTrace({
  steps,
  controlling,
}: {
  steps: ReasonStep[];
  controlling: number | null;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section
      aria-labelledby="why-heading"
      className="rounded-2xl border border-white/[0.07] bg-black/20"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <h3 id="why-heading" className="font-sign text-sm font-black tracking-widest text-white/80">
          WHY?
        </h3>
        <span className="text-xs text-white/40">{open ? 'Hide' : 'Show'} the reasoning</span>
      </button>
      {open && (
        <ol className="space-y-2 px-4 pb-4 text-[13px] leading-relaxed text-white/75">
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
                className={`flex gap-2.5 ${dim ? 'text-white/45' : ''} ${strong ? 'text-signwhite' : ''}`}
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
