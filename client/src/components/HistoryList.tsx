import { useCallback, useEffect, useState } from 'react';
import { deleteHistory, fetchHistory, type HistoryScan } from '../api';
import { useStore } from '../store';

/** Recent scans saved in the local SQLite database (AI mode only). */
export function HistoryList() {
  const mode = useStore((s) => s.mode);
  const scanId = useStore((s) => s.scanId);
  const loadResult = useStore((s) => s.loadResult);
  const [scans, setScans] = useState<HistoryScan[]>([]);

  const refresh = useCallback(() => {
    fetchHistory()
      .then(setScans)
      .catch(() => setScans([]));
  }, []);

  useEffect(() => {
    if (mode === 'ai') refresh();
  }, [mode, scanId, refresh]);

  if (mode !== 'ai' || scans.length === 0) return null;

  return (
    <section aria-labelledby="history-heading">
      <h3
        id="history-heading"
        className="mb-2 font-sign text-sm font-black tracking-widest text-white/80"
      >
        RECENT SCANS{' '}
        <span className="font-sans text-[11px] font-normal tracking-normal text-white/40">
          · stored on this device
        </span>
      </h3>
      <ul className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {scans.map((scan) => {
          const thumb = scan.thumbnail ? `data:image/jpeg;base64,${scan.thumbnail}` : null;
          return (
            <li key={scan.id} className="group relative shrink-0">
              <button
                type="button"
                onClick={() =>
                  loadResult(
                    scan.result,
                    {
                      kind: 'history',
                      label: new Date(scan.createdAt).toLocaleString(),
                      model: scan.model,
                    },
                    thumb,
                  )
                }
                className="flex h-20 w-16 flex-col items-center justify-end overflow-hidden rounded-xl border border-white/10 bg-black/30 text-[10px] text-white/60 hover:border-sodium/50"
                aria-label={`Load scan from ${new Date(scan.createdAt).toLocaleString()}, ${scan.result.signs.length} signs`}
              >
                {thumb ? (
                  <img src={thumb} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="pb-2">{scan.result.signs.length} signs</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => void deleteHistory(scan.id).then(refresh)}
                className="absolute -right-1 -top-1 hidden h-5 w-5 place-items-center rounded-full bg-black/80 text-[10px] text-white/80 group-focus-within:grid group-hover:grid"
                aria-label="Delete this scan"
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
