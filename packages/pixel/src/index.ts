import sharp from "sharp";

export interface PixelOptions {
  /** Pixel block size (1–50). Higher = blockier. Default: 8 */
  scale?: number;
  /** Optional color palette [[r,g,b], ...]. Snaps each pixel to the nearest palette color. */
  palette?: [number, number, number][];
  /** Constrain output width (preserves aspect ratio) */
  maxWidth?: number;
  /** Constrain output height (preserves aspect ratio) */
  maxHeight?: number;
}

/**
 * Pixelizes an image using the scale-down/scale-up nearest-neighbor technique.
 * Optionally snaps colors to a palette (Euclidean distance in RGB space).
 *
 * @param input - Path to image file or raw image Buffer
 * @param output - Path to write the output PNG, or omit to get a Buffer back
 * @param options - Pixelation options
 */
export async function pixelize(
  input: string | Buffer,
  output: string,
  options?: PixelOptions
): Promise<void>;
export async function pixelize(
  input: string | Buffer,
  options?: PixelOptions
): Promise<Buffer>;
export async function pixelize(
  input: string | Buffer,
  outputOrOptions?: string | PixelOptions,
  options?: PixelOptions
): Promise<Buffer | void> {
  const outputPath =
    typeof outputOrOptions === "string" ? outputOrOptions : undefined;
  const opts: PixelOptions =
    (typeof outputOrOptions === "object" ? outputOrOptions : options) ?? {};

  const scale = Math.max(1, Math.min(50, opts.scale ?? 8));
  const workScaleFactor = 1 - scale * 0.02; // 0.98 at scale=1 down to 0.02 at scale=49

  const img = sharp(input);
  const meta = await img.metadata();

  let { width = 0, height = 0 } = meta;

  // Apply maxWidth / maxHeight constraints
  if (opts.maxWidth || opts.maxHeight) {
    const aspectRatio = width / height;
    if (opts.maxWidth && width > opts.maxWidth) {
      width = opts.maxWidth;
      height = Math.round(width / aspectRatio);
    }
    if (opts.maxHeight && height > opts.maxHeight) {
      height = opts.maxHeight;
      width = Math.round(height * aspectRatio);
    }
    img.resize(width, height, { fit: "inside" });
  }

  // Scale down then back up — this produces the blocky pixel look
  const smallWidth = Math.max(1, Math.round(width * workScaleFactor));
  const smallHeight = Math.max(1, Math.round(height * workScaleFactor));

  let pipeline = img
    .resize(smallWidth, smallHeight, { kernel: "nearest" })
    .resize(width, height, { kernel: "nearest" });

  if (opts.palette && opts.palette.length >= 2) {
    // Apply palette mapping: snap each pixel to the nearest palette color
    const { data, info } = await pipeline
      .raw()
      .toBuffer({ resolveWithObject: true });

    const channels = info.channels; // 3 (RGB) or 4 (RGBA)
    for (let i = 0; i < data.length; i += channels) {
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const [pr, pg, pb] = nearestPaletteColor(r, g, b, opts.palette);
      data[i] = pr;
      data[i + 1] = pg;
      data[i + 2] = pb;
    }

    const result = sharp(data, {
      raw: { width: info.width, height: info.height, channels },
    }).png();

    if (outputPath) {
      await result.toFile(outputPath);
      return;
    }
    return result.toBuffer();
  }

  pipeline = pipeline.png();

  if (outputPath) {
    await pipeline.toFile(outputPath);
    return;
  }
  return pipeline.toBuffer();
}

function nearestPaletteColor(
  r: number,
  g: number,
  b: number,
  palette: [number, number, number][]
): [number, number, number] {
  let best = palette[0]!;
  let bestDist = Infinity;

  for (const color of palette) {
    const dist =
      (r - color[0]) ** 2 + (g - color[1]) ** 2 + (b - color[2]) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = color;
    }
  }

  return best;
}
