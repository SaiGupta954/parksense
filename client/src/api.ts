import type { ReadResult } from './engine';

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';

export interface Health {
  ok: boolean;
  ollama: { url: string; reachable: boolean; model: string | null; installed: string[] };
  preferredModels: string[];
  pullCommand: string;
}

export interface ReadResponse extends ReadResult {
  model: string;
  scanId: number;
}

export interface HistoryScan {
  id: number;
  createdAt: string;
  model: string;
  result: ReadResult;
  thumbnail: string | null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

async function json<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
  if (!res.ok)
    throw new ApiError(
      body.message ?? `Request failed (${res.status})`,
      res.status,
      body.error ?? 'error',
    );
  return body as T;
}

/** Returns null when there is no local server at all (e.g. deployed static demo). */
export async function fetchHealth(timeoutMs = 2500): Promise<Health | null> {
  try {
    const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok || !res.headers.get('content-type')?.includes('json')) return null;
    return (await res.json()) as Health;
  } catch {
    return null;
  }
}

export async function readSign(
  imageBase64: string,
  thumbnailBase64?: string,
): Promise<ReadResponse> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/read-sign`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ imageBase64, thumbnailBase64 }),
      signal: AbortSignal.timeout(200_000),
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new ApiError('The model is taking too long.', 504, 'timeout');
    }
    throw new ApiError('Can’t reach the local ParkSense server.', 0, 'network');
  }
  return json<ReadResponse>(res);
}

export async function fetchHistory(): Promise<HistoryScan[]> {
  const res = await fetch(`${BASE}/api/history`);
  return (await json<{ scans: HistoryScan[] }>(res)).scans;
}

export async function deleteHistory(id: number): Promise<void> {
  await json(await fetch(`${BASE}/api/history/${id}`, { method: 'DELETE' }));
}
