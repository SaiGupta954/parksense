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
import { signStyle } from '../signStyle';
import { useStore } from '../store';

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
  const style = signStyle(rule.type);
  const badge =
    state === 'controlling'
      ? 'border-sodium/60 shadow-sodium'
      : state === 'active'
        ? 'border-white/20'
        : 'border-white/[0.06] opacity-75';

  return (
    <li className={`rounded-xl border bg-black/20 transition ${badge}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`Edit sign ${rule.order}`}
        title={`${TYPE_LABEL[rule.type]} · ${describeSchedule(rule)}`}
        className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left"
      >
        <span
          aria-hidden
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md border font-sign text-xs font-black"
          style={{ background: style.bg, color: style.fg, borderColor: style.border }}
        >
          {rule.order}
        </span>
        <span className="min-w-0 flex-1 truncate font-sign text-sm font-bold text-signwhite">
          {quoteSign(rule.rawText)}
        </span>
        {low && (
          <span className="text-xs font-bold text-yellow-300" title="Not sure — please check">
            ?
          </span>
        )}
        {state === 'skipped' && (
          <span className="text-xs text-white/40" title="Arrow points to the other side">
            ↷
          </span>
        )}
        <span aria-hidden className="text-xs text-white/40">
          {open ? '▴' : '✎'}
        </span>
      </button>

      {open && (
        <div className="grid grid-cols-2 gap-2 px-2.5 pb-3 text-[11px] text-white/60">
          <div
            className="col-span-2 flex flex-wrap gap-1"
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
                  daysOn(d)
                    ? 'bg-signwhite/90 text-asphalt'
                    : 'bg-white/5 text-white/35 line-through'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
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
      <div className="mb-1.5 flex items-center justify-between">
        <h3
          id="rules-heading"
          className="font-sign text-sm font-black tracking-widest text-white/80"
        >
          SIGNS {edited && <span className="ml-1 text-[11px] text-permit">✓ edited</span>}
        </h3>
        <button
          type="button"
          onClick={addRule}
          aria-label="Add a sign"
          title="Add a sign"
          className="grid h-7 w-7 place-items-center rounded-full border border-white/10 text-white/70 hover:bg-white/10"
        >
          +
        </button>
      </div>
      <ul className="space-y-1.5">
        {rules.map((r) => (
          <RuleCard key={r.order} rule={r} state={stateOf(r)} />
        ))}
      </ul>
    </section>
  );
}
