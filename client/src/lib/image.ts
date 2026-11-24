export interface PreparedImage {
  /** JPEG base64 without the data: prefix. */
  base64: string;
  dataUrl: string;
  thumbBase64: string;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not open that image.'));
    img.src = src;
  });
}

function toJpeg(
  source: CanvasImageSource,
  w: number,
  h: number,
  max: number,
  quality: number,
): string {
  const scale = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available.');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

function finish(source: CanvasImageSource, w: number, h: number): PreparedImage {
  const dataUrl = toJpeg(source, w, h, 1280, 0.85);
  const thumb = toJpeg(source, w, h, 160, 0.7);
  return {
    dataUrl,
    base64: dataUrl.slice(dataUrl.indexOf(',') + 1),
    thumbBase64: thumb.slice(thumb.indexOf(',') + 1),
  };
}

/** Resize a photo to max 1280px on the long side, JPEG @ 0.85. Everything stays in this browser. */
export async function prepareFile(file: Blob): Promise<PreparedImage> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return finish(img, img.naturalWidth, img.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Render an SVG string (sample sign stack) to a JPEG, so it can be sent through the real AI path. */
export async function prepareSvg(svg: string): Promise<PreparedImage> {
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const img = await loadImage(url);
  return finish(img, img.naturalWidth || 640, img.naturalHeight || 900);
}

export function prepareVideoFrame(video: HTMLVideoElement): PreparedImage {
  return finish(video, video.videoWidth, video.videoHeight);
}
