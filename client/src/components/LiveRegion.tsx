import { useDebounced, useEvaluation } from '../lib/hooks';
import { buildAnswer } from '../lib/answer';
import { useStore } from '../store';

/** Announces the answer to screen readers — debounced so dragging the scrubber doesn't spam. */
export function LiveRegion() {
  const { at, result } = useEvaluation();
  const phase = useStore((s) => s.phase);
  const answer = buildAnswer(result, at);
  const text = phase === 'scanning' ? 'Reading the signs…' : answer.spoken;
  const announced = useDebounced(text, 700);
  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      {announced}
    </div>
  );
}
