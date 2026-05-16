/**
 * KSP Image — Grid Template Image Generator
 *
 * Generates a BLANK GRID TEMPLATE image (white cells with thin borders) used as
 * a visual reference for Banana Pro / Imagen 4 / etc. when generating storyboard
 * grids.
 *
 * Why: AI image generators tend to "auto-fill" or reshape grids (e.g., output a
 * 3×3 perfect square instead of the requested 4×2). By attaching a TEMPLATE
 * image showing the exact cell layout, the AI uses it as a structural reference
 * — the output matches the cols × rows exactly.
 *
 * Workflow:
 *   1. Storyboard builds template image for grid (cols × rows + aspect ratio)
 *   2. Template added to Refs ZIP for user to upload alongside cast refs
 *   3. Prompt instructs AI: "Use template image as grid structure reference"
 *
 * Output:
 *   - PNG dataURL ready for download / attach to prompt
 *   - Dimensions chosen so total grid maintains target aspect ratio
 *   - Each cell is a labeled rectangle ("CELL 1", "CELL 2", ..., "EMPTY")
 *
 * Pure function on top of Canvas API. Browser-side only (uses document.createElement).
 */

import { parseGridFormat } from "./sceneGridPacker";
import type { SceneGridFormat } from "../types/project";

export interface BuildGridTemplateInput {
  /** Format string like "3x3", "4x2" (CxR convention) */
  gridFormat: SceneGridFormat;
  /** Aspect ratio of TARGET output image, e.g. "16:9", "9:16" */
  targetAspect: string;
  /** Which cell indices are filled (1-based, matches Cell N labels). Others = EMPTY. */
  filledCellOrders: number[];
  /** Optional: target total width in pixels (default 1280, will scale height to match aspect) */
  totalWidth?: number;
}

export interface GridTemplateResult {
  /** PNG base64 dataURL of the template image */
  dataUrl: string;
  /** Actual pixel dimensions of the template */
  width: number;
  height: number;
  /** Per-cell pixel dimensions */
  cellW: number;
  cellH: number;
}

/**
 * Build a blank grid template image with labeled cells.
 *
 * @example
 *   buildGridTemplateImage({
 *     gridFormat: "4x2",        // 4 cols × 2 rows
 *     targetAspect: "16:9",
 *     filledCellOrders: [1, 2, 3, 4, 5, 6, 7],  // 7 of 8 cells filled
 *   })
 *   → 1280×720 PNG with 8 cells; cells 1-7 labeled "CELL N", cell 8 labeled "EMPTY"
 */
export function buildGridTemplateImage(
  input: BuildGridTemplateInput
): GridTemplateResult {
  const { gridFormat, targetAspect, filledCellOrders, totalWidth = 1280 } = input;
  const { rows, cols, cells: totalCells } = parseGridFormat(gridFormat);

  // Parse aspect ratio (e.g., "16:9" → 16/9)
  const aspectParts = targetAspect.split(":").map(Number);
  const aspectW = aspectParts[0] || 16;
  const aspectH = aspectParts[1] || 9;
  const aspectValue = aspectW / aspectH;

  // Total dimensions matching target aspect
  const totalHeight = Math.round(totalWidth / aspectValue);
  const cellW = Math.floor(totalWidth / cols);
  const cellH = Math.floor(totalHeight / rows);

  // Create canvas
  const canvas = document.createElement("canvas");
  canvas.width = totalWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context not available");
  }

  // Fill background light gray (visible "blank" cells)
  ctx.fillStyle = "#f0f0f0";
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  // Draw cells with borders + labels
  const filledSet = new Set(filledCellOrders);
  const borderWidth = Math.max(3, Math.round(totalWidth / 400));
  ctx.strokeStyle = "#222";
  ctx.lineWidth = borderWidth;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const order = r * cols + c + 1; // 1-based, left-to-right top-to-bottom
      const x = c * cellW;
      const y = r * cellH;

      // Fill cell: white for filled, dark gray for empty
      const isFilled = filledSet.has(order);
      ctx.fillStyle = isFilled ? "#ffffff" : "#1a1a1a";
      ctx.fillRect(x, y, cellW, cellH);

      // Border
      ctx.strokeStyle = "#222";
      ctx.lineWidth = borderWidth;
      ctx.strokeRect(x, y, cellW, cellH);

      // Label
      const label = isFilled ? `CELL ${order}` : "EMPTY";
      ctx.fillStyle = isFilled ? "#888" : "#666";
      ctx.font = `bold ${Math.round(cellH / 6)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x + cellW / 2, y + cellH / 2);
    }
  }

  // Outer thick border so AI clearly sees grid boundaries
  ctx.strokeStyle = "#000";
  ctx.lineWidth = borderWidth * 2;
  ctx.strokeRect(0, 0, totalWidth, totalHeight);

  // Header text at top: "GRID 4×2 (8 cells) · 16:9"
  // Skip header in image to avoid AI mistakenly rendering text into output.
  // Instead, prompt text describes layout.

  return {
    dataUrl: canvas.toDataURL("image/png"),
    width: totalWidth,
    height: totalHeight,
    cellW,
    cellH,
  };
}
