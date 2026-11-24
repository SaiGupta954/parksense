import express, { type NextFunction, type Request, type Response } from 'express';
import type { HistoryStore } from './db.js';
import { OllamaError, pickModel, readSignWithModel, type OllamaClient } from './ollama.js';
import { ReadRequestSchema } from './schema.js';

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export interface AppDeps {
  ollama: OllamaClient;
  history: HistoryStore;
  preferredModels: readonly string[];
  /** Force a specific model (OLLAMA_MODEL). */
  modelOverride?: string;
  /** How long a model lookup stays cached. */
  healthTtlMs?: number;
  log?: (line: string) => void;
}

interface ModelState {
  reachable: boolean;
  installed: string[];
  model: string | null;
  checkedAt: number;
}

export function createApp(deps: AppDeps) {
  const { ollama, history, preferredModels } = deps;
  const ttl = deps.healthTtlMs ?? 10_000;
  const log = deps.log ?? (() => {});
  let state: ModelState | null = null;

  async function refreshModel(force = false): Promise<ModelState> {
    if (!force && state && Date.now() - state.checkedAt < ttl) return state;
    try {
      const installed = await ollama.listModels();
      const prefs = deps.modelOverride ? [deps.modelOverride, ...preferredModels] : preferredModels;
      state = {
        reachable: true,
        installed,
        model: pickModel(installed, prefs),
        checkedAt: Date.now(),
      };
    } catch {
      state = { reachable: false, installed: [], model: null, checkedAt: Date.now() };
    }
    return state;
  }

  const app = express();
  app.disable('x-powered-by');

  // Request log: method, path, status and duration only. Never bodies — they contain images.
  app.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () =>
      log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - started}ms`),
    );
    next();
  });

  app.use(express.json({ limit: '13mb' }));

  app.get('/api/health', async (_req, res) => {
    const s = await refreshModel();
    res.json({
      ok: true,
      ollama: { url: ollama.url, reachable: s.reachable, model: s.model, installed: s.installed },
      preferredModels,
      pullCommand: `ollama pull ${preferredModels[0]}`,
    });
  });

  app.post('/api/read-sign', async (req, res) => {
    const body = ReadRequestSchema.safeParse(req.body);
    if (!body.success) {
      res
        .status(400)
        .json({ error: 'bad_request', message: 'Send { imageBase64 } with a JPEG or PNG photo.' });
      return;
    }
    const imageBase64 = body.data.imageBase64.replace(/^data:image\/[a-z+]+;base64,/, '');
    if (Buffer.byteLength(imageBase64, 'base64') > MAX_IMAGE_BYTES) {
      res
        .status(413)
        .json({ error: 'too_large', message: 'That photo is over 8 MB. Try a smaller one.' });
      return;
    }

    const s = await refreshModel();
    if (!s.reachable) {
      res.status(503).json({
        error: 'ollama_unreachable',
        message:
          'Ollama isn’t running. Start it with `ollama serve`, then try again — or use Demo mode.',
      });
      return;
    }
    if (!s.model) {
      res.status(503).json({
        error: 'no_vision_model',
        message: `No vision model installed. Run \`ollama pull ${preferredModels[0]}\` and try again.`,
      });
      return;
    }

    try {
      const outcome = await readSignWithModel(ollama, s.model, imageBase64);
      if (!outcome.ok) {
        res.status(422).json({
          error: 'unparseable',
          message:
            'I couldn’t make sense of those signs. Try a closer, straighter photo — or enter the rules by hand.',
        });
        return;
      }
      const record = history.insert({
        model: s.model,
        result: outcome.result,
        thumbnail: body.data.thumbnailBase64 ?? null,
      });
      res.json({
        ...outcome.result,
        model: s.model,
        scanId: record.id,
        attempts: outcome.attempts,
      });
    } catch (err) {
      if (err instanceof OllamaError && err.code === 'timeout') {
        res.status(504).json({
          error: 'timeout',
          message:
            'The model is taking too long. Try a smaller photo, or a lighter model like gemma3:4b.',
        });
        return;
      }
      await refreshModel(true);
      res.status(502).json({
        error: 'ollama_failed',
        message: 'Ollama stopped responding while reading. Check that it’s running and try again.',
      });
    }
  });

  app.get('/api/history', (_req, res) => {
    res.json({ scans: history.list() });
  });

  app.delete('/api/history/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({ error: 'bad_request', message: 'Invalid id.' });
      return;
    }
    const removed = history.remove(id);
    res.status(removed ? 200 : 404).json({ ok: removed });
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'not_found', message: 'Unknown endpoint.' });
  });

  app.use(
    (
      err: Error & { type?: string; status?: number },
      _req: Request,
      res: Response,
      _next: NextFunction,
    ) => {
      if (err.type === 'entity.too.large') {
        res
          .status(413)
          .json({ error: 'too_large', message: 'That photo is over 8 MB. Try a smaller one.' });
        return;
      }
      if (err.type === 'entity.parse.failed') {
        res.status(400).json({ error: 'bad_request', message: 'Request body must be JSON.' });
        return;
      }
      log(`error: ${err.message}`);
      res
        .status(500)
        .json({ error: 'internal', message: 'Something went wrong on this device’s server.' });
    },
  );

  return { app, refreshModel };
}
