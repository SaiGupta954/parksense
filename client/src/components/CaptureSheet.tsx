import { useCallback, useEffect, useRef, useState } from 'react';
import { prepareVideoFrame } from '../lib/image';
import { scanBlob, scanPrepared, scanSample } from '../lib/scan';
import { SAMPLES, sampleDataUrl } from '../samples/samples';
import { useStore } from '../store';
import { Sheet } from './Sheet';

type CamState = 'off' | 'starting' | 'on' | 'error';

function cameraError(err: unknown): string {
  const name = err instanceof Error ? err.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'Camera permission is blocked. Allow camera access for this site in your browser settings — or upload a photo instead.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError')
    return 'No camera found on this device. Upload a photo instead.';
  if (name === 'NotReadableError')
    return 'The camera is busy in another app. Close it and try again, or upload a photo.';
  return 'Couldn’t start the camera. Upload a photo instead.';
}

export function CaptureSheet() {
  const open = useStore((s) => s.captureOpen);
  const setOpen = useStore((s) => s.setCaptureOpen);
  const mode = useStore((s) => s.mode);
  const [cam, setCam] = useState<CamState>('off');
  const [camErr, setCamErr] = useState('');
  const [viaAi, setViaAi] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCam('off');
  }, []);

  useEffect(() => {
    if (!open) stopCamera();
  }, [open, stopCamera]);

  const close = useCallback(() => setOpen(false), [setOpen]);

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCam('error');
      setCamErr(
        'This browser can’t open the camera here (it needs HTTPS or localhost). Upload a photo instead.',
      );
      return;
    }
    setCam('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      setCam('on');
      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      }, 0);
    } catch (err) {
      setCam('error');
      setCamErr(cameraError(err));
    }
  };

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const prepared = prepareVideoFrame(v);
    stopCamera();
    void scanPrepared(prepared, 'Camera photo');
  };

  return (
    <Sheet open={open} onClose={close} title="Scan" wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          {cam === 'on' || cam === 'starting' ? (
            <div className="flex flex-col gap-3">
              <video
                ref={videoRef}
                playsInline
                muted
                className="aspect-[3/4] w-full rounded-xl bg-black object-cover"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={capture}
                  disabled={cam !== 'on'}
                  className="flex-1 rounded-full bg-sodium py-2 font-sign font-black text-asphalt disabled:opacity-50"
                >
                  CAPTURE
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="rounded-full px-3 text-sm text-white/60"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="font-sign font-black text-signwhite">📷 Camera</p>
              <button
                type="button"
                onClick={() => void startCamera()}
                className="mt-3 w-full rounded-full bg-sodium py-2 font-sign text-sm font-black text-asphalt"
              >
                OPEN CAMERA
              </button>
              {cam === 'error' && (
                <p className="mt-2 text-xs text-[#ff7b73]" role="alert">
                  {camErr}
                </p>
              )}
            </>
          )}
        </div>
        <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-4">
          <p className="font-sign font-black text-signwhite">🖼 Photo</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void scanBlob(file, file.name);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-3 w-full rounded-full border border-white/15 py-2 font-sign text-sm font-black text-signwhite hover:bg-white/5"
          >
            CHOOSE PHOTO
          </button>
          {mode !== 'ai' && <p className="mt-2 text-[11px] text-yellow-200/70">Needs local AI</p>}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-sign text-sm font-black tracking-widest text-white/80">SAMPLES</h3>
        {mode === 'ai' && (
          <label className="flex items-center gap-2 text-[11px] text-white/60">
            <input
              type="checkbox"
              checked={viaAi}
              onChange={(e) => setViaAi(e.target.checked)}
              className="accent-[#FFB347]"
            />
            Read with AI
          </label>
        )}
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {SAMPLES.map((sample) => (
          <li key={sample.id}>
            <button
              type="button"
              onClick={() => void scanSample(sample, viaAi)}
              title={sample.blurb}
              className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/30 text-left hover:border-sodium/50"
            >
              <div className="h-28 w-full overflow-hidden bg-asphalt-700">
                <img
                  src={sampleDataUrl(sample)}
                  alt=""
                  className="h-full w-full object-cover object-top transition group-hover:scale-105"
                />
              </div>
              <div className="p-2.5">
                <p className="font-sign text-sm font-black text-signwhite">{sample.title}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
