/**
 * Shrinks a meal photo before it is uploaded.
 *
 * A photo straight off a modern phone is 3-6 MB. Sending that over mobile data
 * is by far the slowest part of a plate scan — several seconds before the
 * model has even seen the image — and the vision model gains nothing from
 * detail beyond about 1500px on the long edge. Re-encoding to a ~1024px JPEG
 * typically cuts a 4 MB photo to under 200 KB, so the scan starts almost
 * immediately.
 *
 * It also keeps a large photo from bouncing off the server's request body
 * limit, which is a confusing failure right at the moment you want to log.
 */

export const MAX_EDGE = 1024;
export const JPEG_QUALITY = 0.82;

/**
 * Dimensions to draw at: scaled so the long edge is at most `maxEdge`, and
 * never scaled *up* — enlarging a small photo adds bytes and no detail.
 */
export function targetDimensions(
  width: number,
  height: number,
  maxEdge = MAX_EDGE
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge || longest === 0) return { width, height };

  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Rough byte size of a data URL's payload, for logging and size checks. */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  if (comma === -1) return 0;
  const b64 = dataUrl.slice(comma + 1);
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.readAsDataURL(file);
  });
}

export interface PreparedImage {
  /** data: URL ready to send to the API. */
  dataUrl: string;
  mediaType: string;
  bytes: number;
  originalBytes: number;
}

/**
 * Loads, downscales and re-encodes an image file. If anything goes wrong
 * (an exotic format the canvas cannot decode, for instance) it falls back to
 * the original file rather than blocking the scan — a slow scan beats none.
 */
export async function prepareImage(file: File, maxEdge = MAX_EDGE): Promise<PreparedImage> {
  const originalDataUrl = await readAsDataUrl(file);
  const originalBytes = dataUrlBytes(originalDataUrl);
  const fallback: PreparedImage = {
    dataUrl: originalDataUrl,
    mediaType: file.type || 'image/jpeg',
    bytes: originalBytes,
    originalBytes,
  };

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not decode that image'));
      img.src = originalDataUrl;
    });

    const { width, height } = targetDimensions(image.naturalWidth, image.naturalHeight, maxEdge);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return fallback;
    ctx.drawImage(image, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    const bytes = dataUrlBytes(dataUrl);

    // A tiny or already-compressed photo can come out bigger after re-encoding.
    if (bytes >= originalBytes) return fallback;

    return { dataUrl, mediaType: 'image/jpeg', bytes, originalBytes };
  } catch {
    return fallback;
  }
}
