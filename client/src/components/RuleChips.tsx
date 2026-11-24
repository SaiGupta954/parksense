import { useState } from 'react';
import {
  ARROWS,
  DAY_CODES,
  describeSchedule,
  SIGN_TYPES,
  TYPE_LABEL,
  quoteSign,
  type Day,
  type Evaluation,
  type SignRule,
} from '../engine';
import { useStore } from '../store';

const chip =
  'rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/85 hover:border-white/25 focus-visible:border-sodium';
const input =
  'rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-white/90 focus:border-sodium focus:outline-none';

function RuleCard({
  rule,
  state,
}: {
  rule: SignRule;
  state: 'controlling' | 'active' | 'inactive' | 'skipped';
}) {
  const update = useStore((s) => s.updateRule);
  const remove = useStore((s) => s.removeRule);
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<SignRule>) => update(rule.order, patch);
  const toggleDay = (d: Day) => {
    const all = rule.days.length === 0 ? [...DAY_CODES] : rule.days;
    const next = all.includes(d) ? all.filter((x) => x !== d) : [...all, d];
    if (next.length === 0) return; // a sign applies on at least one day ("no days" = every day)
    set({ days: next.length === 7 ? [] : DAY_CODES.filter((x) => next.includes(x)) });
  };
  const daysOn = (d: Day) => rule.days.length === 0 || rule.days.includes(d);
  const low = rule.confidence < 0.7;
  const badge =
    state === 'controlling'
      ? 'border-sodium/60 shadow-sodium'
      : state === 'active'
        ? 'border-white/20'
        : 'border-white/[0.06] opacity-75';

  return (
    <li className={`rounded-2xl border bg-black/20 p-3 transition ${badge}`}>
      <div className="flex items-start gap-3">
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg font-sign text-sm font-black ${
            state === 'controlling' ? 'bg-sodium text-asphalt' : 'bg-white/10 text-white/80'
          }`}
          aria-label={`Sign ${rule.order}`}
        >
          {rule.order}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="truncate font-sign text-sm font-bold text-signwhite"
            title={quoteSign(rule.rawText)}
          >
            {quoteSign(rule.rawText)}
          </p>
          <p className="text-[11px] text-white/50">
            {TYPE_LABEL[rule.type]} · {describeSchedule(rule)}
            {state === 'skipped' ? ' · other side' : ''}
            {low && (
              <span className="ml-1 text-yellow-300">
                · {Math.round(rule.confidence * 100)}% sure
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={`Edit sign ${rule.order}`}
          className="rounded-full px-2 py-1 text-xs text-sodium hover:bg-sodium/10"
        >
          {open ? 'Done' : 'Edit'}
        </button>
      </div>

      {/* Chips — always visible, quick to scan */}
      <div
        className="mt-2.5 flex flex-wrap gap-1.5"
        role="group"
        aria-label={`Days for sign ${rule.order}`}
      >
        {DAY_CODES.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={daysOn(d)}
            onClick={() => toggleDay(d)}
            className={`rounded-md px-1.5 py-0.5 font-sign text-[11px] font-bold ${
              daysOn(d) ? 'bg-signwhite/90 text-asphalt' : 'bg-white/5 text-white/35 line-through'
            }`}
          >
            {d}
          </button>
        ))}
        {rule.maxMinutes != null && <span className={chip}>⏱ {rule.maxMinutes} min</span>}
        {rule.permitZone && <span className={chip}>🅿 Zone {rule.permitZone}</span>}
        {rule.arrow !== 'none' && <span className={chip}>Arrow {rule.arrow}</span>}
        {rule.exceptText && <span className={chip}>{rule.exceptText}</span>}
      </div>

      {open && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-white/60">
          <label className="col-span-2 flex flex-col gap-1">
            Sign text
            <textarea
              className={`${input} font-sign`}
              rows={2}
              value={rule.rawText}
              onChange={(e) => set({ rawText: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            Type
            <select
              className={input}
              value={rule.type}
              onChange={(e) => set({ type: e.target.value as SignRule['type'] })}
            >
              {SIGN_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-end gap-2 pb-1">
            <input
              type="checkbox"
              checked={rule.anytime}
              onChange={(e) => set({ anytime: e.target.checked })}
              className="accent-[#FFB347]"
            />
            Any time
          </label>
          <label className="flex flex-col gap-1">
            Start
            <input
              type="time"
              className={input}
              value={rule.start ?? ''}
              disabled={rule.anytime}
              onChange={(e) => set({ start: e.target.value || null })}
              aria-label={`Start time for sign ${rule.order}`}
            />
          </label>
          <label className="flex flex-col gap-1">
            End
            <input
              type="time"
              className={input}
              value={rule.end ?? ''}
              disabled={rule.anytime}
              onChange={(e) => set({ end: e.target.value || null })}
              aria-label={`End time for sign ${rule.order}`}
            />
          </label>
          <label className="flex flex-col gap-1">
            Time limit (min)
            <input
              type="number"
              min={0}
              step={15}
              className={input}
              value={rule.maxMinutes ?? ''}
              onChange={(e) =>
                set({ maxMinutes: e.target.value ? Math.max(1, Number(e.target.value)) : null })
              }
            />
          </label>
          <label className="flex flex-col gap-1">
            Permit zone
            <input
              className={input}
              value={rule.permitZone ?? ''}
              placeholder="—"
              onChange={(e) => set({ permitZone: e.target.value || null })}
            />
          </label>
          <label className="flex flex-col gap-1">
            Arrow
            <select
              className={input}
              value={rule.arrow}
              onChange={(e) => set({ arrow: e.target.value as SignRule['arrow'] })}
            >
              {ARROWS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Except
            <input
              className={input}
              value={rule.exceptText ?? ''}
              placeholder="e.g. EXCEPT SUNDAY"
              onChange={(e) => set({ exceptText: e.target.value || null })}
            />
          </label>
          <button
            type="button"
            onClick={() => remove(rule.order)}
            className="col-span-2 mt-1 justify-self-start rounded-full px-2 py-1 text-xs text-[#ff7b73] hover:bg-regulatory/10"
          >
            Remove this sign
          </button>
        </div>
      )}
    </li>
  );
}

export function RuleChips({ evaluation }: { evaluation: Evaluation }) {
  const rules = useStore((s) => s.rules);
  const addRule = useStore((s) => s.addRule);
  const edited = useStore((s) => s.edited);

  const stateOf = (r: SignRule) =>
    evaluation.controllingSignOrder === r.order
      ? 'controlling'
      : evaluation.skippedSignOrders.includes(r.order)
        ? 'skipped'
        : evaluation.activeSignOrders.includes(r.order)
          ? 'active'
          : 'inactive';

  return (
    <section aria-labelledby="rules-heading">
      <div className="mb-2 flex items-center justify-between">
        <h3
          id="rules-heading"
          className="font-sign text-sm font-black tracking-widest text-white/80"
        >
          WHAT I READ
        </h3>
        <span className="text-[11px] text-white/40">
          {edited ? 'Edited by you ✓' : 'Tap Edit to fix anything'}
        </span>
      </div>
      <ul className="space-y-2">
        {rules.map((r) => (
          <RuleCard key={r.order} rule={r} state={stateOf(r)} />
        ))}
      </ul>
      <button
        type="button"
        onClick={addRule}
        className="mt-2 w-full rounded-xl border border-dashed border-white/15 py-2 text-xs text-white/60 hover:border-white/30 hover:text-white"
      >
        + Add a sign
      </button>
    </section>
  );
}
