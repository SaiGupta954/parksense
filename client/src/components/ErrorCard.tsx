import { lastRetry } from '../lib/scan';
import { useStore } from '../store';

export function ErrorCard() {
  const error = useStore((s) => s.error);
  const clear = useStore((s) => s.clearError);
  const openCapture = useStore((s) => s.setCaptureOpen);
  const addRule = useStore((s) => s.addRule);
  if (!error) return null;

  const action = (() => {
    switch (error.action) {
      case 'retry':
        return lastRetry ? { label: 'Try again', run: () => lastRetry?.() } : null;
      case 'samples':
        return {
          label: 'Try a sample',
          run: () => {
            clear();
            openCapture(true);
          },
        };
      case 'upload':
        return {
          label: 'Choose another photo',
          run: () => {
            clear();
            openCapture(true);
          },
        };
      case 'manual':
        return {
          label: 'Enter rules by hand',
          run: () => {
            clear();
            addRule();
          },
        };
      default:
        return null;
    }
  })();

  return (
    <div
      role="alert"
      className="rounded-2xl border border-regulatory/40 bg-regulatory/10 p-4 text-sm"
    >
      <p className="font-sign font-black tracking-wide text-[#ff7b73]">✕ {error.title}</p>
      <p className="mt-1 text-white/75">{error.detail}</p>
      <div className="mt-3 flex gap-2">
        {action && (
          <button
            type="button"
            onClick={action.run}
            className="rounded-full bg-signwhite px-3 py-1 text-xs font-bold text-asphalt hover:brightness-95"
          >
            {action.label}
          </button>
        )}
        <button
          type="button"
          onClick={clear}
          className="rounded-full px-3 py-1 text-xs text-white/60 hover:text-white"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
