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
      className="flex items-center gap-3 rounded-2xl border border-yellow-400/40 bg-yellow-400/10 px-3 py-2.5 text-sm"
    >
      <span aria-hidden className="text-lg">
        ⚠
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-sign font-black text-yellow-300">
          {readable && low.length ? `Check sign ${low.join(', ')}` : 'Check what I read'}
        </p>
        {notes && (
          <p className="truncate text-xs text-yellow-100/70" title={notes}>
            {notes}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={confirm}
        className="shrink-0 rounded-full bg-yellow-300 px-3 py-1 text-xs font-bold text-asphalt hover:brightness-110"
      >
        Looks right
      </button>
    </div>
  );
}
