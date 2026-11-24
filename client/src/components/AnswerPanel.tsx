import { AnimatePresence, motion } from 'framer-motion';
import { formatTime, weekdayLong } from '../engine';
import { buildAnswer } from '../lib/answer';
import { useEvaluation } from '../lib/hooks';
import { speak, speechSupported } from '../lib/speech';
import { lowConfidence, useStore } from '../store';
import { ConfirmBanner } from './ConfirmBanner';
import { ErrorCard } from './ErrorCard';
import { HistoryList } from './HistoryList';
import { LeaveBy } from './LeaveBy';
import { RuleChips } from './RuleChips';
import { WhyTrace } from './WhyTrace';

export function AnswerPanel() {
  const { at, result } = useEvaluation();
  const offset = useStore((s) => s.offsetMin);
  const source = useStore((s) => s.source);
  const phase = useStore((s) => s.phase);
  const showConfirm = useStore(lowConfidence);
  const rulesCount = useStore((s) => s.rules.length);
  const answer = buildAnswer(result, at);
  const live = offset === 0;

  return (
    <div className="glass flex min-h-full flex-col gap-5 rounded-t-3xl p-5 shadow-glass lg:rounded-none lg:p-7">
      <div aria-hidden className="mx-auto -mt-2 h-1 w-10 rounded-full bg-white/15 lg:hidden" />

      <div className="flex items-center justify-between gap-2 text-xs text-white/55">
        <span className="truncate">
          {source.kind === 'photo' ? '📷' : source.kind === 'history' ? '🕘' : '🧪'} {source.label}
          {source.model ? ` · read by ${source.model}` : ''}
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 ${live ? 'bg-permit/15 text-permit' : 'bg-sodium/15 text-sodium'}`}
        >
          {live ? '● Live' : '⟲ Time-travel'} · {weekdayLong(at).slice(0, 3)} {formatTime(at)}
        </span>
      </div>

      {phase === 'error' && <ErrorCard />}
      {showConfirm && <ConfirmBanner />}

      <section
        aria-labelledby="answer-heading"
        className={phase === 'scanning' ? 'opacity-40 transition' : 'transition'}
      >
        <h2 id="answer-heading" className="sr-only">
          Can I park here?
        </h2>
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-semibold"
              style={{
                borderColor: `${answer.color}66`,
                color: answer.color,
                background: `${answer.color}14`,
              }}
            >
              {answer.pill}
            </span>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.p
                key={answer.headline}
                initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -18, filter: 'blur(6px)' }}
                transition={{ duration: 0.28 }}
                className="mt-1 font-sign text-[7rem] font-black leading-[0.85] tracking-tight sm:text-[9rem]"
                style={{ color: answer.color, textShadow: `0 0 60px ${answer.color}55` }}
              >
                {answer.headline}
              </motion.p>
            </AnimatePresence>
            <p className="mt-2 font-sign text-xl font-bold text-signwhite sm:text-2xl">
              {answer.sub}
            </p>
          </div>
          {speechSupported() && (
            <button
              type="button"
              onClick={() => speak(answer.spoken)}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-xl hover:bg-white/10"
              aria-label="Read the answer aloud"
              title="Read the answer aloud"
            >
              🔊
            </button>
          )}
        </div>
      </section>

      {live && <LeaveBy />}

      {rulesCount > 0 && (
        <WhyTrace steps={result.reasonSteps} controlling={result.controllingSignOrder} />
      )}

      <RuleChips evaluation={result} />

      <HistoryList />
    </div>
  );
}
