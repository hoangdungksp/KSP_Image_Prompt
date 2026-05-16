/**
 * KSP Image qc16 — Scene Grid Image Prompt Builder
 *
 * Builds a SINGLE prompt that asks Banana Pro / Imagen 4 / Nano Banana
 * to generate ONE grid image containing N shots from a scene.
 *
 * Differs from legacy per-shot prompt (filmShotPromptBuilder.ts) where each
 * shot had its own grid of 9 motion beats. NEW concept: each cell = 1 shot
 * snapshot (key frame), grid contains the whole scene's shot sequence.
 *
 * Output is for user to:
 *   - Copy → paste into Banana Pro / Imagen 4
 *   - Attach Cast face/body refs as reference images (#1, #2, ...)
 *   - Generate 1 grid PNG (e.g. 3×3 = 9 cells)
 *   - Upload back to KSP → modal crop → cells fill into Storyboard
 *
 * Pure function. No fetch, no AI call.
 */

import type {
  FilmShot,
  FilmSceneScript,
  SceneGrid,
  ProjectSettingV2,
} from "../types/project";
import type { FilmCharacter } from "../types/film";
import { parseGridFormat, getShotsInGrid } from "./sceneGridPacker";

const SHOT_TYPE_LABEL: Record<FilmShot["shotType"], string> = {
  wide_establishing: "wide / establishing",
  medium: "medium",
  close_up: "close-up",
  insert: "insert",
  over_shoulder: "over-the-shoulder",
  two_shot: "two-shot",
  pov: "POV",
};

const ANIMATION_STYLE_HINT: Record<string, string> = {
  live_action: "live-action cinematic, photoreal lighting, 35mm film grain",
  anime_2d: "high-quality anime 2D, hand-drawn line art, expressive frame composition",
  cgi_3d_cinematic: "3D CGI cinematic, Pixar-grade rendering, soft global illumination",
  film_noir: "black-and-white film noir, high-contrast chiaroscuro, deep shadows",
  cartoon_2d: "stylized 2D cartoon, bold outlines, flat color shading",
  stop_motion: "stop-motion animation, claymation-style tactile surfaces",
};

function castRefsBlock(cast: FilmCharacter[]): string {
  if (cast.length === 0) return "no characters specified";
  return cast
    .map((c, i) => {
      const refs = `${c.faceRefs.length} face ref${c.faceRefs.length !== 1 ? "s" : ""} + ${c.bodyRefs.length} body ref${c.bodyRefs.length !== 1 ? "s" : ""}`;
      const shortDesc = c.description
        ? ` — ${c.description.slice(0, 180).trim()}${c.description.length > 180 ? "..." : ""}`
        : "";
      return `  Image #${i + 1}: ${c.name || `Character ${c.order}`} (${c.role}) [${refs}]${shortDesc}`;
    })
    .join("\n");
}

export interface BuildSceneGridImagePromptInput {
  grid: SceneGrid;
  scene: FilmSceneScript;
  shots: FilmShot[];           // All shots in the scene (engine extracts ones in this grid)
  cast: FilmCharacter[];       // All project characters
  setting: ProjectSettingV2;
}

/**
 * Build the EN image prompt for a single SceneGrid.
 *
 * The prompt instructs the AI image gen to produce an NxM grid image where:
 *   - Each cell = one shot key frame from the scene
 *   - Cast identity is consistent across all cells
 *   - Empty cells are explicitly marked as "empty / black"
 */
export function buildSceneGridImagePrompt(
  input: BuildSceneGridImagePromptInput
): string {
  const { grid, scene, shots, cast, setting } = input;
  const { rows, cols, cells: totalCells } = parseGridFormat(grid.gridFormat);
  const styleHint =
    ANIMATION_STYLE_HINT[setting.animationStyle ?? "live_action"] ??
    ANIMATION_STYLE_HINT["live_action"];
  const aspect = setting.aspectRatio;

  const shotsInGrid = getShotsInGrid(grid, shots);
  const filledCount = shotsInGrid.length;
  const emptyCount = totalCells - filledCount;

  const sceneTitle = scene.titleEn || scene.titleVi || `Scene ${scene.order}`;
  const sceneSettings = scene.settings || "unspecified location";
  const sceneAction =
    (scene as any).actionLinesVi || scene.actionLinesEn || "";
  const refBlock = castRefsBlock(cast);

  // Build per-cell descriptions (Cell 1: ..., Cell 2: ..., empty: "empty/black")
  const cellDescriptions = grid.cells
    .map((cell) => {
      if (!cell.shotId) {
        return `  Cell ${cell.order}: EMPTY — solid black, no subject, no detail (leftover from shot packing).`;
      }
      const shot = shots.find((s) => s.id === cell.shotId);
      if (!shot) {
        return `  Cell ${cell.order}: EMPTY — shot reference missing.`;
      }
      const shotTitle = shot.titleVi || shot.titleEn || `Shot ${shot.order}`;
      const shotAction =
        shot.actionEn ||
        (shot as any).actionVi ||
        "(no specific action — show shot framing only)";
      const shotType = SHOT_TYPE_LABEL[shot.shotType] ?? shot.shotType;
      return `  Cell ${cell.order}: [${shotType}] ${shotTitle} — ${shotAction}`;
    })
    .join("\n");

  return `Cinematic storyboard grid: ${cols} columns × ${rows} rows = ${totalCells} cells (${filledCount} filled${emptyCount > 0 ? `, ${emptyCount} empty` : ""}). ${aspect} aspect ratio per cell.
Style: ${styleHint}.

STRICT LAYOUT REQUIREMENT (do NOT change):
- Output image MUST contain EXACTLY ${cols} columns and ${rows} rows of cells.
- DO NOT add cells. DO NOT remove cells. DO NOT fill empty cells with new content.
- Empty cells MUST stay solid black, no subject, no detail.
- Reading order: left to right, top to bottom (cell 1 = top-left, cell ${totalCells} = bottom-right).

REFERENCE IMAGES (attach in this order):
REFERENCE IMAGES (attach in this exact order — filenames from Refs ZIP for clarity):
- IMAGE #1 (grid template) — filename: image-01_grid-template.png. A blank ${cols}×${rows} grid layout reference — use this image to LOCK the cell arrangement. Each cell labeled "CELL N" must contain the corresponding shot below. Cells labeled "EMPTY" must remain solid black in output.
- IMAGE #2+ (cast refs) — filenames: image-02_cast-{name}_face-NN.png, image-03_cast-{name}_body-NN.png, etc. Character reference photos for consistency across ALL ${filledCount} filled cells.

${refBlock}

SCENE: ${sceneTitle}
Setting: ${sceneSettings}
Scene action overview: ${sceneAction.slice(0, 400)}

SHOTS IN THIS GRID (left-to-right, top-to-bottom):
${cellDescriptions}

FRAMING & CONSISTENCY:
- Maintain identical character identity (face, body, outfit) across all ${filledCount} filled cells.
- Consistent lighting + color grade within the grid (same time-of-day, same weather).
- Each cell is a self-contained key frame — the moment captured for that shot.
- Cinematic ${aspect} framing per cell.

EMPTY CELLS:
${emptyCount > 0
  ? `- Empty cells (${grid.cells.filter((c) => !c.shotId).map((c) => `Cell ${c.order}`).join(", ")}): render as solid black with no subject, no text, no detail. Reserved for unused slots.`
  : "- All cells filled — no empty placeholder needed."}

AVOID:
- Text overlays, dialogue captions, frame numbers, cell numbers inside any cell.
- Inconsistent character appearance between cells.
- Branded logos, watermarks, timestamps.
- Style drift between cells.

OUTPUT: high-resolution single image, ${cols} columns × ${rows} rows grid layout. Each cell rendered as a finished cinematic frame.`;
}
