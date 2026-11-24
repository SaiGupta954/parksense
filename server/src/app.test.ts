import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import { openHistory, type HistoryStore } from './db.js';
import { OllamaError, pickModel, PREFERRED_MODELS, type OllamaClient } from './ollama.js';
import { normalizeTime, ReadSchema } from './schema.js';

const IMG = Buffer.from('fake-jpeg-bytes-for-testing').toString('base64');

const goodSign = {
  order: 1,
  rawText: 'NO PARKING\n10AM-12PM TUE',
  type: 'street_cleaning',
  days: ['TUE'],
  anytime: false,
  start: '10:00',
  end: '12:00',
  maxMinutes: null,
  permitZone: null,
  exceptText: null,
  arrow: 'none',
  confidence: 0.92,
};
const goodReply = JSON.stringify({ readable: true, signs: [goodSign], notes: '' });

let stores: HistoryStore[] = [];
afterEach(() => {
  stores.forEach((s) => s.close());
  stores = [];
});

function setup(client: Partial<OllamaClient>) {
  const history = openHistory(':memory:');
  stores.push(history);
  const ollama: OllamaClient = {
    url: 'http://ollama.test',
    listModels: async () => ['llama3.1:8b', 'gemma3:4b'],
    chat: async () => goodReply,
    ...client,
  };
  const logs: string[] = [];
  const { app } = createApp({
    ollama,
    history,
    preferredModels: PREFERRED_MODELS,
    healthTtlMs: 0,
    log: (l) => logs.push(l),
  });
  return { app, history, logs };
}

describe('pickModel', () => {
  it('picks the first preferred model that is installed', () => {
    expect(pickModel(['gemma3:4b', 'qwen2.5vl:7b'], PREFERRED_MODELS)).toBe('qwen2.5vl:7b');
    expect(pickModel(['llama3.1:8b', 'gemma3:4b'], PREFERRED_MODELS)).toBe('gemma3:4b');
    expect(pickModel(['llama3.2-vision:latest'], PREFERRED_MODELS)).toBe('llama3.2-vision:latest');
    expect(pickModel(['llama3.2-vision:11b'], PREFERRED_MODELS)).toBe('llama3.2-vision:11b');
    expect(pickModel(['llama3.1:8b', 'qwen2.5:14b'], PREFERRED_MODELS)).toBeNull();
  });
});

describe('schema normalization', () => {
  it('normalizes common time spellings', () => {
    expect(normalizeTime('4PM')).toBe('16:00');
    expect(normalizeTime('12 AM')).toBe('00:00');
    expect(normalizeTime('8:30 a.m.')).toBe('08:30');
    expect(normalizeTime('noon')).toBe('12:00');
    expect(normalizeTime('7:05')).toBe('07:05');
  });

  it('accepts slightly off model output (full day names, % confidence)', () => {
    const parsed = ReadSchema.parse({
      readable: true,
      notes: '',
      signs: [{ ...goodSign, days: ['Tuesday'], start: '10AM', end: '12 PM', confidence: 88 }],
    });
    expect(parsed.signs[0]).toMatchObject({
      days: ['TUE'],
      start: '10:00',
      end: '12:00',
      confidence: 0.88,
    });
  });
});

describe('GET /api/health', () => {
  it('reports the selected model', async () => {
    const { app } = setup({});
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ollama).toMatchObject({ reachable: true, model: 'gemma3:4b' });
    expect(res.body.pullCommand).toBe('ollama pull qwen2.5vl:7b');
  });

  it('reports unreachable Ollama', async () => {
    const { app } = setup({
      listModels: async () => {
        throw new OllamaError('down', 'unreachable');
      },
    });
    const res = await request(app).get('/api/health');
    expect(res.body.ollama).toMatchObject({ reachable: false, model: null });
  });
});

describe('POST /api/read-sign', () => {
  it('returns validated rules and saves the scan to history', async () => {
    const chat = vi.fn(async () => goodReply);
    const { app } = setup({ chat });
    const res = await request(app)
      .post('/api/read-sign')
      .send({ imageBase64: IMG, thumbnailBase64: 'thumb' });
    expect(res.status).toBe(200);
    expect(res.body.model).toBe('gemma3:4b');
    expect(res.body.signs[0].type).toBe('street_cleaning');
    expect(chat).toHaveBeenCalledTimes(1);
    const [model, messages] = chat.mock.calls[0] as unknown as [
      string,
      Array<{ images?: string[] }>,
    ];
    expect(model).toBe('gemma3:4b');
    expect(messages[1]?.images?.[0]).toBe(IMG);

    const hist = await request(app).get('/api/history');
    expect(hist.body.scans).toHaveLength(1);
    expect(hist.body.scans[0]).toMatchObject({ model: 'gemma3:4b', thumbnail: 'thumb' });
  });

  it('retries once with a stricter reminder when JSON is invalid', async () => {
    const chat = vi
      .fn()
      .mockResolvedValueOnce('Sure! Here are the signs: ...')
      .mockResolvedValueOnce(goodReply);
    const { app } = setup({ chat });
    const res = await request(app).post('/api/read-sign').send({ imageBase64: IMG });
    expect(res.status).toBe(200);
    expect(res.body.attempts).toBe(2);
    expect(chat).toHaveBeenCalledTimes(2);
  });

  it('returns 422 with a friendly message after two bad replies', async () => {
    const chat = vi.fn(async () => '{"nope": true}');
    const { app, history } = setup({ chat });
    const res = await request(app).post('/api/read-sign').send({ imageBase64: IMG });
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/couldn’t make sense/);
    expect(history.list()).toHaveLength(0);
  });

  it('rejects images over 8 MB', async () => {
    const { app } = setup({});
    const big = Buffer.alloc(8 * 1024 * 1024 + 10, 1).toString('base64');
    const res = await request(app).post('/api/read-sign').send({ imageBase64: big });
    expect(res.status).toBe(413);
  });

  it('rejects a missing image', async () => {
    const { app } = setup({});
    const res = await request(app).post('/api/read-sign').send({});
    expect(res.status).toBe(400);
  });

  it('returns 503 with the pull command when no vision model is installed', async () => {
    const { app } = setup({ listModels: async () => ['llama3.1:8b'] });
    const res = await request(app).post('/api/read-sign').send({ imageBase64: IMG });
    expect(res.status).toBe(503);
    expect(res.body.message).toContain('ollama pull qwen2.5vl:7b');
  });

  it('maps a model timeout to 504', async () => {
    const { app } = setup({
      chat: async () => {
        throw new OllamaError('slow', 'timeout');
      },
    });
    const res = await request(app).post('/api/read-sign').send({ imageBase64: IMG });
    expect(res.status).toBe(504);
  });

  it('never logs image data', async () => {
    const { app, logs } = setup({});
    await request(app).post('/api/read-sign').send({ imageBase64: IMG });
    expect(logs.join('\n')).not.toContain(IMG);
    expect(logs.some((l) => l.startsWith('POST /api/read-sign 200'))).toBe(true);
  });
});

describe('DELETE /api/history/:id', () => {
  it('deletes a scan', async () => {
    const { app, history } = setup({});
    const rec = history.insert({
      model: 'm',
      result: { readable: true, signs: [], notes: '' },
      thumbnail: null,
    });
    expect((await request(app).delete(`/api/history/${rec.id}`)).status).toBe(200);
    expect((await request(app).delete(`/api/history/${rec.id}`)).status).toBe(404);
    expect(history.list()).toHaveLength(0);
  });
});
