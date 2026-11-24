import { useStore } from '../store';

export function ConfirmBanner() {
  const notes = useStore((s) => s.notes);
  const readable = useStore((s) => s.readable);
  const rules = useStore((s) => s.rules);
  const low = rules.filter((r) => r.confidence < 0.7).map((r) => r.order);
  const confirm = useStore((s) => s.confirmRules);

  return (
    <div
      role="alert"
      className="rounded-2xl border border-yellow-400/40 bg-yellow-400/10 p-4 text-sm text-yellow-100"
    >
      <p className="font-sign font-black tracking-wide text-yellow-300">
        ⚠ Please confirm what I read
      </p>
      <p className="mt-1 text-yellow-100/80">
        {!readable
          ? 'Parts of this photo were unreadable.'
          : `I'm not fully sure about sign ${low.join(', ')}.`}{' '}
        {notes && <span className="italic">“{notes}”</span>} Check the rules below — any edit
        updates the answer instantly.
      </p>
      <button
        type="button"
        onClick={confirm}
        className="mt-3 rounded-full bg-yellow-300 px-3 py-1 text-xs font-bold text-asphalt hover:brightness-110"
      >
        Looks right
      </button>
    </div>
  );
}
