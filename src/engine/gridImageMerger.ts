/**
 * KSP Image — Grid Image Merger (r7.22b)
 *
 * Merges multiple storyboard grid PNGs into a single vertical-stacked image.
 * Used when a scene has 2+ grids (e.g. 9 shots split into 4 + 5 grid cells)
 * and Omni needs a single image input that shows the full narrative top-to-bottom.
 *
 * Strategy: Smart auto-stack vertical
 *   - All grids have similar widths (KSP renders same aspect ratio per project)
 *   - Stack top → bottom with 8px gap between grids
 *   - Output PNG width = max(input widths), height = sum + gaps
 *   - Background fill: transparent (PNG alpha) or black (more compatible)
 *
 * Returns a dataURL ready for download / bundle inclusion.
 */

/**
 * Load an image dataURL into an HTMLImageElement.
 * Promisified for sequential merge processing.
 */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load grid image (data URL ${dataUrl.length} chars)`));
    img.src = dataUrl;
  });
}

/**
 * Merge an array of grid PNG dataURLs into one vertically-stacked PNG.
 *
 * @param gridDataUrls Array of dataURLs (each is one grid PNG). Order preserved
 *                    top-to-bottom in output.
 * @param gapPx       Vertical gap between grids in pixels. Default 8.
 * @returns Single dataURL PNG containing all grids stacked. If only 1 grid,
 *          returns it unchanged. Throws if empty array.
 */
export async function mergeGridsVertical(
  gridDataUrls: string[],
  gapPx: number = 8
): Promise<string> {
  if (gridDataUrls.length === 0) {
    throw new Error("mergeGridsVertical: empty input array");
  }
  // Fast path: single grid → no merge needed
  if (gridDataUrls.length === 1) {
    return gridDataUrls[0];
  }

  // Load all images sequentially (parallel could OOM for 5+ large grids)
  const images: HTMLImageElement[] = [];
  for (const url of gridDataUrls) {
    images.push(await loadImage(url));
  }

  // Compute output canvas dimensions
  const maxWidth = Math.max(...images.map((i) => i.naturalWidth));
  const totalHeight =
    images.reduce((acc, i) => acc + i.naturalHeight, 0) + gapPx * (images.length - 1);

  // Create canvas + draw
  const canvas = document.createElement("canvas");
  canvas.width = maxWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("mergeGridsVertical: failed to acquire 2D context");

  // Black background fill — more compatible with Omni than transparent
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, maxWidth, totalHeight);

  // Stack images top-to-bottom, centered horizontally
  let cursorY = 0;
  for (const img of images) {
    const xOffset = Math.floor((maxWidth - img.naturalWidth) / 2);
    ctx.drawImage(img, xOffset, cursorY);
    cursorY += img.naturalHeight + gapPx;
  }

  // Export PNG. Quality is irrelevant for PNG (lossless).
  return canvas.toDataURL("image/png");
}

/**
 * Convenience: download a merged grid PNG as a file.
 */
export function downloadDataUrlAsFile(dataUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
