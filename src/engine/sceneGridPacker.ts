/**
 * KSP Image Scene Grid Packer
 *
 * Packs N shots into M grids per Option A (Jason confirmed):
 *   - User chooses grid format (e.g. "3x3" = 9 cells)
 *   - Engine fills cells sequentially; if shot count > cells, creates next grid
 *   - Final grid may have empty cells (leftover from packing)
 *
 * Example: Scene 1 has 11 shots, grid format "3x3":
 *   Grid 1 (3x3): cells 1-9 = shots 1-9
 *   Grid 2 (3x3): cells 1-2 = shots 10-11, cells 3-9 = empty
 *
 * Pure function — no side effects, no AI. Called whenever:
 *   - User picks/changes grid format for a scene
 *   - Shot list is regenerated
 *   - Initial scene grid creation
 */

import type {
  FilmShot,
  FilmSceneScript,
  SceneGrid,
  SceneGridCell,
  SceneGridFormat,
  AspectRatioV2,
} from "../types/project";

/**
 * Parse "3x2" → { rows: 2, cols: 3, cells: 6 }
 *
 * IMPORTANT CONVENTION: Grid format string is "ColsxRows" (CxR).
 * "3x2" = 3 columns × 2 rows = horizontal layout (6 cells).
 * "2x3" = 2 columns × 3 rows = vertical layout (6 cells).
 * "3x3" / "4x4" are symmetric.
 *
 * This matches storyboard industry convention "4×3 grid" = 4 wide × 3 tall.
 */
export function parseGridFormat(format: SceneGridFormat): {
  rows: number;
  cols: number;
  cells: number;
} {
  const [cols, rows] = format.split("x").map(Number);
  return { rows, cols, cells: rows * cols };
}

// ============================================================================
// 9 — Auto-Adapt Grid Format
// ============================================================================

/**
 * Pick optimal grid format based on shot count + aspect ratio.
 *
 * Sweet spot logic (per Jason chốt + AI filmmaking 2026 industry data):
 * - 90% phim AI ngắn có scene 2-9 shots → grid 3×3 default
 * - Cap default soft = 9 (sweet spot, cell 917×512 cinematic)
 * - Cap absolute = 16 (4×4, cell 688×384 acceptable)
 * - Shot count > 16: caller must handle warning/split-scene logic
 *
 * Convention: format string is "ColsxRows" (CxR). E.g. "3x2" = 3 cols × 2 rows.
 *
 * Orientation rules:
 * - Vertical aspects (9:16, 4:5): taller grids (rows > cols) for portrait reels
 * - Landscape/square (16:9, 4:3, 1:1, 21:9, 2.39:1): wider grids (cols > rows)
 *
 * Mapping (landscape default — CxR convention):
 *   ≤ 4 shots  → "2x2"  (2 cols × 2 rows = 4 cells, sym)
 *   ≤ 6 shots  → "3x2"  (3 cols × 2 rows = 6 cells, wide)
 *   ≤ 8 shots  → "4x2"  (4 cols × 2 rows = 8 cells, wide)
 *   ≤ 9 shots  → "3x3"  (3 cols × 3 rows = 9 cells, sym — sweet spot)
 *   ≤ 12 shots → "4x3"  (4 cols × 3 rows = 12 cells, wide)
 *   ≤ 16 shots → "4x4"  (4 cols × 4 rows = 16 cells, sym — hard cap)
 *   > 16       → "4x4" capped (caller warns)
 *
 * Mapping (vertical aspect 9:16, 4:5): flip to tall grids.
 *   ≤ 6 shots  → "2x3"  (2 cols × 3 rows = 6 cells, tall)
 *   ≤ 8 shots  → "2x4"  (2 cols × 4 rows = 8 cells, tall)
 *   ≤ 12 shots → "3x4"  (3 cols × 4 rows = 12 cells, tall)
 */
export function pickOptimalGridFormat(
  shotCount: number,
  aspectRatio: AspectRatioV2 = "16:9"
): SceneGridFormat {
  const isVertical = aspectRatio === "9:16" || aspectRatio === "4:5";

  if (shotCount <= 0) return "2x2"; // safety default for empty scene
  if (shotCount <= 4) return "2x2";
  if (shotCount <= 6) return isVertical ? "2x3" : "3x2";
  if (shotCount <= 8) return isVertical ? "2x4" : "4x2";
  if (shotCount <= 9) return "3x3"; // sweet spot — sym across orientations
  if (shotCount <= 12) return isVertical ? "3x4" : "4x3";
  if (shotCount <= 16) return "4x4"; // hard cap symmetric
  // > 16: cap at 4x4 — caller must warn or split scene
  return "4x4";
}

/**
 * Soft cap (sweet spot) for "scene complexity" warning in Stage 4 wizard.
 * Beyond this, UI should suggest break scene or auto-bump grid format.
 */
export const SHOT_COUNT_SWEET_SPOT = 9;

/**
 * Absolute cap. Shot count > this → MUST split scene (no single grid fits cinematically).
 */
export const SHOT_COUNT_HARD_CAP = 16;

/**
 * Pack shots into scene grids (Option A).
 *
 * update: `gridFormat` now optional. If undefined, auto-picks via
 * `pickOptimalGridFormat(shots.length, aspectRatio)`. Existing scenes with
 * gridFormat already set continue to honor user's manual choice.
 *
 * @param shots - Shots in the scene (already ordered)
 * @param gridFormat - User-chosen format (or undefined → auto-pick)
 * @param existingGrids - Optional: preserve cropped frames + cropSettings + locked
 *                       from existing grids when re-packing (e.g. shot count changed)
 * @param aspectRatio - Scene aspect (only used when gridFormat undefined)
 * @returns Array of SceneGrid (1 or more depending on shot count)
 */
export function packShotsIntoGrids(
  shots: FilmShot[],
  gridFormat: SceneGridFormat | undefined,
  existingGrids?: SceneGrid[],
  aspectRatio: AspectRatioV2 = "16:9"
): SceneGrid[] {
  // auto-pick if user hasn't overridden
  const resolvedFormat: SceneGridFormat =
    gridFormat ?? pickOptimalGridFormat(shots.length, aspectRatio);
  const { cells: cellsPerGrid } = parseGridFormat(resolvedFormat);
  if (cellsPerGrid <= 0) return [];

  // At minimum, create 1 grid (even if 0 shots — user may upload grid first)
  const gridCount = Math.max(1, Math.ceil(shots.length / cellsPerGrid));

  const result: SceneGrid[] = [];
  for (let g = 0; g < gridCount; g++) {
    const existing = existingGrids?.[g];
    const startShotIdx = g * cellsPerGrid;
    const endShotIdx = startShotIdx + cellsPerGrid;

    const cells: SceneGridCell[] = [];
    for (let i = 0; i < cellsPerGrid; i++) {
      const shotIdx = startShotIdx + i;
      const shot = shots[shotIdx];
      const existingCell = existing?.cells[i];

      const cell: SceneGridCell = {
        order: i + 1,
        shotId: shot?.id,                       // undefined if empty
        // Preserve existing dataUrl/locked only if shotId matches
        dataUrl:
          existingCell?.shotId === shot?.id ? existingCell?.dataUrl : undefined,
        locked:
          existingCell?.shotId === shot?.id ? existingCell?.locked : undefined,
        promptOverride:
          existingCell?.shotId === shot?.id ? existingCell?.promptOverride : undefined,
      };
      cells.push(cell);
    }

    result.push({
      id: existing?.id ?? `grid_${Date.now().toString(36)}_${g}`,
      order: g + 1,
      gridFormat: resolvedFormat,
      // Preserve user-set fields if existing
      imagePrompt: existing?.imagePrompt,
      gridImageDataUrl:
        // Only preserve gridImage if all shotIds in cells still match
        cellsMatchShots(existing?.cells, cells) ? existing?.gridImageDataUrl : undefined,
      cropSettings:
        cellsMatchShots(existing?.cells, cells) ? existing?.cropSettings : undefined,
      cells,
    });
  }

  return result;
}

/**
 * Check if all shotIds in two cell arrays match (used to determine if grid image
 * is still valid after re-pack, e.g. shot was deleted/reordered).
 */
function cellsMatchShots(
  oldCells: SceneGridCell[] | undefined,
  newCells: SceneGridCell[]
): boolean {
  if (!oldCells || oldCells.length !== newCells.length) return false;
  for (let i = 0; i < oldCells.length; i++) {
    if (oldCells[i].shotId !== newCells[i].shotId) return false;
  }
  return true;
}

/**
 * Get all shots assigned to a SceneGrid (for prompt building / display).
 * Returns shots in cell order, excludes empty cells.
 */
export function getShotsInGrid(
  grid: SceneGrid,
  allShots: FilmShot[]
): FilmShot[] {
  return grid.cells
    .map((cell) => allShots.find((s) => s.id === cell.shotId))
    .filter((s): s is FilmShot => !!s);
}

/**
 * Count summary for a scene's grids (for display "5 grids · 45 shots filled · 5 empty").
 */
export function gridStats(grids: SceneGrid[]): {
  gridCount: number;
  filledCells: number;
  emptyCells: number;
  totalCells: number;
} {
  let filled = 0;
  let empty = 0;
  for (const g of grids) {
    for (const cell of g.cells) {
      if (cell.shotId) filled++;
      else empty++;
    }
  }
  return {
    gridCount: grids.length,
    filledCells: filled,
    emptyCells: empty,
    totalCells: filled + empty,
  };
}
