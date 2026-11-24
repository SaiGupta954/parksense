import { ApiError, readSign } from '../api';
import { sampleDataUrl, sampleSvg, type Sample } from '../samples/samples';
import { useStore, type AppError } from '../store';
import { prepareFile, prepareSvg, type PreparedImage } from './image';

const DEMO_DELAY_MS = 2400;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function errorFor(err: unknown): AppError {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'timeout':
        return {
          title: 'The model is too slow',
          detail:
            'Reading took too long. Try a closer photo, or a lighter model: `ollama pull gemma3:4b`.',
          action: 'retry',
        };
      case 'unparseable':
        return { title: 'Couldn’t read those signs', detail: err.message, action: 'manual' };
      case 'too_large':
        return { title: 'Photo too large', detail: err.message, action: 'upload' };
      case 'ollama_unreachable':
      case 'no_vision_model':
      case 'network':
        return { title: 'Local AI unavailable', detail: err.message, action: 'samples' };
      default:
        return { title: 'Something went wrong', detail: err.message, action: 'retry' };
    }
  }
  return {
    title: 'Something went wrong',
    detail: err instanceof Error ? err.message : 'Please try again.',
    action: 'retry',
  };
}

async function runAi(prepared: PreparedImage, label: string) {
  const store = useStore.getState();
  store.startScan(prepared.dataUrl);
  try {
    const res = await readSign(prepared.base64, prepared.thumbBase64);
    useStore
      .getState()
      .loadResult(res, { kind: 'photo', label, model: res.model }, prepared.dataUrl);
    if (!res.readable || res.signs.length === 0) {
      useStore.getState().failScan({
        title: 'No readable signs',
        detail:
          res.notes ||
          'I couldn’t find a parking sign in that photo. Get closer, avoid glare, and keep the whole pole in frame.',
        action: 'manual',
      });
    }
  } catch (err) {
    useStore.getState().failScan(errorFor(err));
  }
}

export let lastRetry: (() => void) | null = null;

export async function scanSample(sample: Sample, viaAi: boolean) {
  lastRetry = () => void scanSample(sample, viaAi);
  if (viaAi && useStore.getState().mode === 'ai') {
    const prepared = await prepareSvg(sampleSvg(sample));
    await runAi(prepared, `${sample.title} (read by AI)`);
    return;
  }
  const url = sampleDataUrl(sample);
  useStore.getState().startScan(url);
  await wait(DEMO_DELAY_MS);
  useStore.getState().loadResult(sample.expected, { kind: 'sample', label: sample.title }, url);
}

export async function scanBlob(file: Blob, label = 'Your photo') {
  lastRetry = () => void scanBlob(file, label);
  if (!file.type.startsWith('image/')) {
    useStore.getState().failScan({
      title: 'That isn’t an image',
      detail: 'Drop a JPEG or PNG photo of the sign pole.',
      action: 'upload',
    });
    return;
  }
  let prepared: PreparedImage;
  try {
    prepared = await prepareFile(file);
  } catch {
    useStore.getState().failScan({
      title: 'Couldn’t open that photo',
      detail: 'Try a JPEG or PNG.',
      action: 'upload',
    });
    return;
  }
  if (useStore.getState().mode !== 'ai') {
    useStore.getState().failScan({
      title: 'Demo mode can’t read photos',
      detail:
        'Reading your own photos needs the local AI (Ollama). Pick a sample to try it, or set up Ollama — it’s free.',
      action: 'samples',
    });
    return;
  }
  await runAi(prepared, label);
}

export async function scanPrepared(prepared: PreparedImage, label: string) {
  lastRetry = () => void scanPrepared(prepared, label);
  if (useStore.getState().mode !== 'ai') {
    useStore.getState().failScan({
      title: 'Demo mode can’t read photos',
      detail:
        'Reading your own photos needs the local AI (Ollama). Pick a sample to try it, or set up Ollama — it’s free.',
      action: 'samples',
    });
    return;
  }
  await runAi(prepared, label);
}
