import { useCallback } from 'react';
import type { Side } from '../engine';
import { useStore } from '../store';
import { Sheet } from './Sheet';

export function SettingsSheet() {
  const open = useStore((s) => s.settingsOpen);
  const setOpen = useStore((s) => s.setSettingsOpen);
  const profile = useStore((s) => s.profile);
  const setProfile = useStore((s) => s.setProfile);
  const mode = useStore((s) => s.mode);
  const health = useStore((s) => s.health);
  const forceDemo = useStore((s) => s.forceDemo);
  const setForceDemo = useStore((s) => s.setForceDemo);
  const close = useCallback(() => setOpen(false), [setOpen]);

  const sides: Array<[Side, string]> = [
    ['left', '← Left of pole'],
    ['both', 'Not sure'],
    ['right', 'Right of pole →'],
  ];

  return (
    <Sheet open={open} onClose={close} title="Your car">
      <div className="space-y-5 text-sm">
        <fieldset>
          <legend className="mb-2 text-xs text-white/60">
            Which side of the pole are you parking on? (for arrow signs)
          </legend>
          <div className="grid grid-cols-3 gap-1.5">
            {sides.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={profile.side === value}
                onClick={() => setProfile({ side: value })}
                className={`rounded-xl px-2 py-2 text-xs ${
                  profile.side === value
                    ? 'bg-signwhite font-semibold text-asphalt'
                    : 'border border-white/10 text-white/75'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="mb-1.5 block text-xs text-white/60">
            Residential permit zone (leave empty if none)
          </span>
          <input
            value={profile.permitZone ?? ''}
            onChange={(e) => setProfile({ permitZone: e.target.value || undefined })}
            placeholder="e.g. B"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-sign font-bold text-signwhite focus:border-sodium focus:outline-none"
          />
        </label>

        <label className="flex items-center justify-between gap-3">
          <span>
            Commercial vehicle
            <span className="block text-xs text-white/50">Can use loading zones</span>
          </span>
          <input
            type="checkbox"
            checked={!!profile.isCommercial}
            onChange={(e) => setProfile({ isCommercial: e.target.checked })}
            className="h-5 w-5 accent-[#FFB347]"
          />
        </label>

        {health?.ollama.model && (
          <label className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
            <span>
              Demo mode
              <span className="block text-xs text-white/50">
                Use built-in samples instead of {health.ollama.model}
              </span>
            </span>
            <input
              type="checkbox"
              checked={forceDemo}
              onChange={(e) => setForceDemo(e.target.checked)}
              className="h-5 w-5 accent-[#FFB347]"
            />
          </label>
        )}
        <p className="text-[11px] text-white/40">
          Saved in this browser only. Mode:{' '}
          {mode === 'ai' ? `local AI (${health?.ollama.model})` : 'demo'}.
        </p>
      </div>
    </Sheet>
  );
}
