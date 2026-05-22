/**
 * KSP Image — Grid Image Crop Engine
 *
 * Splits an uploaded grid PNG into N cells based on grid format + gutter.
 *
 * gutter-aware crop. Workflow:
 *   1. User uploads grid → modal preview opens
 *   2. User selects AI provider (auto-fills default size) or custom (auto-detect)
 *   3. User adjusts gutter slider (0-20px) — live preview overlay
 *   4. User clicks "Approve & Crop" → engine runs with (size, gutter, gridFormat)
 *
 * Crop math (with gutter):
 *   gutterTotalW = gutterPx * (cols - 1)
 *   cellW = (totalW - gutterTotalW) / cols
 *   sx = c * (cellW + gutterPx)
 *
 * The user-specified W/H may differ from image.naturalWidth (e.g. if AI
 * provider gen-rendered at higher DPI than expected). We scale image to fit
 * the user-stated dimensions before cropping.
 *
 * No "auto-detect gutter" — user controls via slider for accuracy.
 */

export interface CropGridResult {
  /** Total cells produced (rows × cols) */
  count: number;
  /** Cell aspect ratio width/height (e.g. 1.7778 for 16:9 per cell) */
  cellAspectRatio: number;
  /** Per-cell base64 dataURL (PNG), order left-to-right top-to-bottom */
  frameDataUrls: string[];
  /** Cell dimensions in pixels (for debug/toast) */
  cellW: number;
  cellH: number;
}

export interface CropGridOptions {
  /** Total grid width in pixels (user-stated, may differ from image.naturalWidth) */
  totalWidth: number;
  /** Total grid height in pixels (user-stated, may differ from image.naturalHeight) */
  totalHeight: number;
  /** Gutter between cells in pixels (0 = no gutter) */
  gutterPx: number;
  /**
   * hotfix: Optional target cell aspect ratio (cell_width / cell_height).
   * Examples: 16/9 ≈ 1.778, 9/16 ≈ 0.5625, 1/1 = 1.
   *
   * Workflow:
   * - Source cell = slice from image (cellW × cellH from grid math).
   * - If targetCellAspect provided AND differs from source → center-crop cell to target.
   * - If undefined → save raw slice (legacy behavior).
   *
   * Use case: AI generators tạo total image với ratio = project (vd 16:9). Khi chia
   * 3×2 grid, mỗi cell source = 904×758 (ratio 1.19). Để cells final đúng 16:9
   * (project aspect), em crop center mỗi cell xuống 904×508. Final saved cells
   * khớp với Storyboard display aspect-ratio (fix).
   */
  targetCellAspect?: number;
}

/**
 * Crop a grid image into N cells with gutter support.
 *
 * @param gridDataUrl Source grid image (base64 dataURL)
 * @param gridFormat  "CxR" e.g. "3x3", "4x2" (cols × rows)
 * @param options     totalWidth, totalHeight, gutterPx
 * @returns Array of cropped cell dataURLs + metadata
 *
 * @throws Error if image fails to load, gridFormat is invalid, or canvas op fails
 */
export async function cropGridIntoFrames(
  gridDataUrl: string,
  gridFormat: string,
  options: CropGridOptions
): Promise<CropGridResult> {
  // Parse grid format "CxR" (Cols × Rows)
  const parts = gridFormat.toLowerCase().split("x").map(Number);
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid grid format "${gridFormat}". Expected "CxR" (e.g. "3x3", "4x2").`);
  }
  const [cols, rows] = parts;
  const total = rows * cols;

  const { totalWidth, totalHeight, gutterPx, targetCellAspect } = options;
  if (totalWidth < cols * 8 || totalHeight < rows * 8) {
    throw new Error(
      `Image quá nhỏ (${totalWidth}×${totalHeight}) — không đủ pixels để chia ${rows}×${cols}.`
    );
  }
  if (gutterPx < 0 || gutterPx > 200) {
    throw new Error(`Gutter ${gutterPx}px ngoài khoảng hợp lý (0-200).`);
  }

  // Load image
  const img = await loadImage(gridDataUrl);

  // Cell dimensions with gutter:
  // total = cols * cellW + (cols - 1) * gutterPx
  // cellW = (total - (cols - 1) * gutter) / cols
  const gutterTotalW = gutterPx * (cols - 1);
  const gutterTotalH = gutterPx * (rows - 1);
  const cellW = Math.floor((totalWidth - gutterTotalW) / cols);
  const cellH = Math.floor((totalHeight - gutterTotalH) / rows);

  if (cellW < 4 || cellH < 4) {
    throw new Error(
      `Cell quá nhỏ sau khi trừ gutter (${cellW}×${cellH}). Giảm gutter hoặc grid format thưa hơn.`
    );
  }

  // hotfix: compute target output cell dimensions.
  // If targetCellAspect provided, center-crop source cell to target aspect.
  // Otherwise output = source cell (legacy behavior).
  const sourceCellAspect = cellW / cellH;
  let outputW = cellW;
  let outputH = cellH;
  let cropOffsetX = 0;
  let cropOffsetY = 0;
  if (targetCellAspect && Math.abs(targetCellAspect - sourceCellAspect) > 0.01) {
    if (targetCellAspect > sourceCellAspect) {
      // Target wider than source → keep width, crop height (top + bottom symmetric)
      outputW = cellW;
      outputH = Math.floor(cellW / targetCellAspect);
      cropOffsetY = Math.floor((cellH - outputH) / 2);
    } else {
      // Target taller than source → keep height, crop width (left + right symmetric)
      outputH = cellH;
      outputW = Math.floor(cellH * targetCellAspect);
      cropOffsetX = Math.floor((cellW - outputW) / 2);
    }
  }

  // Scale factor: image may be rendered at different size than user-stated.
  // Map user-coordinates (totalWidth × totalHeight) onto actual image pixels.
  const scaleX = img.naturalWidth / totalWidth;
  const scaleY = img.naturalHeight / totalHeight;

  // Reuse one canvas for all crops (sized to OUTPUT cell, post target-aspect adjustment)
  const canvas = document.createElement("canvas");
  canvas.width = outputW;
  canvas.height = outputH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context not available — browser may not support it.");
  }

  const frameDataUrls: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // User-coordinate position of this cell (with gutter offset)
      // + center-crop offset to reach target aspect
      const userSx = c * (cellW + gutterPx) + cropOffsetX;
      const userSy = r * (cellH + gutterPx) + cropOffsetY;

      // Map to actual image coordinates via scale factor
      const sx = userSx * scaleX;
      const sy = userSy * scaleY;
      const sw = outputW * scaleX;
      const sh = outputH * scaleY;

      ctx.clearRect(0, 0, outputW, outputH);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outputW, outputH);
      const dataUrl = canvas.toDataURL("image/png");
      frameDataUrls.push(dataUrl);
    }
  }

  return {
    count: total,
    cellAspectRatio: outputW / outputH,
    frameDataUrls,
    cellW: outputW,
    cellH: outputH,
  };
}

/**
 * Async image loader (FileReader/blob URL/base64 all accepted).
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("Image decode failed — file may be corrupt or unsupported format."));
    img.src = src;
  });
}
