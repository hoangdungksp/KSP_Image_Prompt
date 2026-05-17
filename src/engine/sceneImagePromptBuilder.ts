/**
 * KSP Image v0.9.4-r7 — Scene Grid Image Prompt Builder
 *
 * Builds a SINGLE prompt that asks Banana Pro / Imagen 4 / Nano Banana
 * to generate ONE grid image containing N shots from a scene.
 *
 * r7 changes (Sprint G1ab):
 *   - PHYSICAL CONSISTENCY LOCK block (from scene.physicalConsistencyLockEn)
 *   - BEATS COVERAGE list (from scene.beats — which beats this grid captures)
 *   - Per-cell SHOT TITLE + LIGHTING HINT + PER-CHARACTER MOOD blocks
 *   - Cast refs FILTERED — chỉ list characters có upload ref
 *   - Cast refs format conditional — không show "0 body refs" nếu không có
 *   - SetupPayoff labelEn priority (BUG VI leak fix)
 *   - Grid 2+ auto-reference Grid 1 generated image when available
 *
 * r6 retained:
 *   - actionLinesEn priority (no Vietnamese leak)
 *   - CINEMATIC INTENT block from pacing data
 *   - Image #1 = grid template, Image #2+ = cast refs
 *
 * Pure function. No fetch, no AI call.
 */

import type {
  FilmShot,
  FilmSceneScript,
  SceneGrid,
  ProjectSettingV2,
  EmotionalTone,
  RhythmRole,
  SetupPayoffPair,
  Beat,
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

// ============================================================================
// PACING → CINEMATIC HINTS (Sprint 1.0 r6, retained for r7)
// ============================================================================

export const EMOTION_CINEMA_HINTS: Record<EmotionalTone, {
  lighting: string;
  palette: string;
  atmosphere: string;
}> = {
  tender: {
    lighting: "warm soft golden-hour key light, low-angle backlight rim, gentle shadow fall-off",
    palette: "warm amber + soft pink + cream highlights, low saturation midtones",
    atmosphere: "intimate, contemplative, breathing room around subject",
  },
  tense: {
    lighting: "cool blue key light from one side, hard shadow boundaries, vignette toward edges",
    palette: "desaturated teal + steel grey + cold cyan shadows, harsh contrast on faces",
    atmosphere: "tight, urgent, claustrophobic — shallow depth of field crushing the background",
  },
  funny: {
    lighting: "bright even daylight or sitcom-style flat lighting, no harsh shadows",
    palette: "saturated primary colors, warm yellow highlights, no muddy midtones",
    atmosphere: "open, light, comedic timing-friendly with clear sight lines",
  },
  sad: {
    lighting: "overcast diffuse top light, no rim, muted shadows, slight haze",
    palette: "desaturated blue-grey, washed-out skin tones, dust particles in air",
    atmosphere: "still, weighty, downward gaze allowed, isolated subject within wide negative space",
  },
  shocking: {
    lighting: "harsh top-light or flashbulb-style hard key, deep blacks, no fill",
    palette: "high-contrast monochromatic with one accent color (red or amber), crushed shadows",
    atmosphere: "frozen moment, motion blur trails on peripheral elements, subject sharp",
  },
  triumphant: {
    lighting: "backlit silhouette with warm rim, godrays through atmosphere, low-angle hero shot",
    palette: "warm gold + bronze + deep saturated sky color, glowing highlights",
    atmosphere: "elevated, expansive, sky-dominant composition, subject lifted into frame",
  },
  neutral: {
    lighting: "balanced three-point lighting, even key + fill ratio, soft shadows",
    palette: "naturalistic skin tones, location-grounded color from setting",
    atmosphere: "observational, mid-distance framing, story-neutral",
  },
};

export function tensionFramingHint(tension: number | undefined): string {
  if (tension === undefined) return "balanced framing, story-neutral composition";
  if (tension <= 2) return "wide breathing room, subject small within frame, contemplative pace";
  if (tension <= 4) return "comfortable medium framing, gentle subject focus";
  if (tension <= 6) return "engaged medium-close framing, subject prominent, building energy";
  if (tension <= 8) return "tight close framing, shallow depth of field, subject dominant, urgent";
  return "extreme close intensity, frame-crushing, shallow DOF, peak emotional weight";
}

export const RHYTHM_COMPOSITION_HINT: Record<RhythmRole, string> = {
  establish: "wide context establishing shot — show the SPACE, set geographic/temporal anchor",
  build: "medium framing with subject focus, energy ramping, lead the eye into the action",
  peak: "tight close-up with maximum emotional weight, peak of the beat — capture micro-expression",
  release: "pulled-back wide with breathing space, action resolved, frame settles for next cut",
};

/**
 * Per-character emotion phrase from scene's characterEmotions map.
 * Sprint 1.0 r7: filter to characters with refs uploaded only (consistent with cast filter).
 */
export function buildCharacterEmotionPhrase(
  scene: FilmSceneScript,
  cast: FilmCharacter[]
): string {
  const charEmotions = (scene as any).characterEmotions as Record<string, EmotionalTone> | undefined;
  if (!charEmotions || Object.keys(charEmotions).length === 0) return "";
  const phrases: string[] = [];
  for (const c of cast) {
    const tone = charEmotions[c.id];
    if (!tone) continue;
    const hint = EMOTION_CINEMA_HINTS[tone];
    const name = c.name || `Character ${c.order}`;
    phrases.push(`${name} feels ${tone} (${hint.atmosphere.split(",")[0]})`);
  }
  if (phrases.length === 0) return "";
  return `Per-character emotional state: ${phrases.join("; ")}.`;
}

/**
 * Find setup-payoff pairs that include this scene + format anchor markers.
 * Sprint 1.0 r7: PREFER labelEn over labelVi (Q1 VI leak fix).
 */
export function buildSetupPayoffHints(
  sceneId: string,
  pairs: SetupPayoffPair[] | undefined,
  allScenes: FilmSceneScript[] | undefined
): string[] {
  if (!pairs || pairs.length === 0 || !allScenes) return [];
  const hints: string[] = [];
  const scenesById = new Map(allScenes.map((s) => [s.id, s]));
  for (const p of pairs) {
    // Sprint 1.0 r7: labelEn priority, labelVi fallback (will leak Vietnamese if AI didn't sinh EN)
    const label = p.labelEn?.trim() || p.labelVi || "(unlabeled)";
    if (p.setupSceneId === sceneId) {
      const payoffScene = scenesById.get(p.payoffSceneId);
      hints.push(
        `SETUP for "${label}" — visually anchor this element (frame it prominently, deliberate composition) so payoff in scene ${payoffScene?.order ?? "?"} can callback.`
      );
    }
    if (p.payoffSceneId === sceneId) {
      const setupScene = scenesById.get(p.setupSceneId);
      hints.push(
        `PAYOFF of "${label}" — callback to scene ${setupScene?.order ?? "?"}. Use matching framing/angle for visual continuity.`
      );
    }
  }
  return hints;
}

/**
 * Build cast refs block — FILTERED (Sprint 1.0 r7).
 * Only includes characters with at least 1 face OR body ref uploaded.
 * Returns empty string if no characters have refs → caller omits the cast subblock entirely.
 *
 * Per-character format adapts to refs uploaded:
 *   [1 face ref]               (no body refs uploaded → omit "0 body refs")
 *   [2 face refs + 1 body ref] (both kinds)
 *   [1 body ref]               (face refs not uploaded)
 *
 * @param castStartIndex Starting image number for cast (default 2 — Image #1 = grid template).
 */
export function castRefsBlockFiltered(
  cast: FilmCharacter[],
  castStartIndex: number = 2
): string {
  const withRefs = cast.filter(
    (c) => (c.faceRefs?.length ?? 0) > 0 || (c.bodyRefs?.length ?? 0) > 0
  );
  if (withRefs.length === 0) return "";
  return withRefs
    .map((c, i) => {
      const faceCount = c.faceRefs?.length ?? 0;
      const bodyCount = c.bodyRefs?.length ?? 0;
      const parts: string[] = [];
      if (faceCount > 0) parts.push(`${faceCount} face ref${faceCount !== 1 ? "s" : ""}`);
      if (bodyCount > 0) parts.push(`${bodyCount} body ref${bodyCount !== 1 ? "s" : ""}`);
      const refs = parts.join(" + ");
      const shortDesc = c.description
        ? ` — ${c.description.slice(0, 180).trim()}${c.description.length > 180 ? "..." : ""}`
        : "";
      return `  Image #${castStartIndex + i}: ${c.name || `Character ${c.order}`} (${c.role}) [${refs}]${shortDesc}`;
    })
    .join("\n");
}

export interface BuildSceneGridImagePromptInput {
  grid: SceneGrid;
  scene: FilmSceneScript;
  shots: FilmShot[];
  cast: FilmCharacter[];
  setting: ProjectSettingV2;
  /** Optional pacing context. */
  allScenes?: FilmSceneScript[];
  setupPayoffPairs?: SetupPayoffPair[];
  /**
   * Sprint 1.0 r7: if multi-grid scene, pass all grids so this grid knows its order
   * + whether to reference earlier grid's generated image. Auto-derived if not provided.
   */
  allGrids?: SceneGrid[];
  /**
   * Sprint 1.0 r7: whether earlier grid's generated image is available in Refs ZIP.
   * Used for Grid 2+ continuity prompt block.
   */
  previousGridGenerated?: boolean;
}

export function buildSceneGridImagePrompt(
  input: BuildSceneGridImagePromptInput
): string {
  const {
    grid,
    scene,
    shots,
    cast,
    setting,
    allScenes,
    setupPayoffPairs,
    allGrids,
    previousGridGenerated,
  } = input;
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
  // BUG #2 fix (Sprint F): EN priority
  const sceneAction =
    scene.actionLinesEn?.trim() ||
    (scene as any).actionLinesVi?.trim() ||
    "";

  // Sprint 1.0 r7: Multi-grid logic — Grid 2+ references Grid 1 generated image
  const totalGrids = allGrids?.length ?? 1;
  const isMultiGrid = totalGrids > 1;
  const gridLabel = isMultiGrid ? ` (GRID ${grid.order} of ${totalGrids})` : "";
  const previousGridRef = isMultiGrid && grid.order > 1 && previousGridGenerated;

  // Sprint 1.0 r7: Pacing injection
  const sceneTone: EmotionalTone = (scene.emotionalTone as EmotionalTone) ?? "neutral";
  const sceneTension = (scene as any).tensionLevel as number | undefined;
  const moodHints = EMOTION_CINEMA_HINTS[sceneTone];
  const tensionHint = tensionFramingHint(sceneTension);
  const tensionLabel = sceneTension !== undefined ? `${sceneTension}/10` : "unset";
  const characterEmotionPhrase = buildCharacterEmotionPhrase(scene, cast);
  const setupPayoffHints = buildSetupPayoffHints(scene.id, setupPayoffPairs, allScenes);

  // Sprint 1.0 r7: Cast refs filtered
  // Image #1 = grid template; Image #2 = Grid 1 generated (if multi-grid Grid 2+); cast starts after
  const castStartIdx = previousGridRef ? 3 : 2;
  const castBlock = castRefsBlockFiltered(cast, castStartIdx);

  // Sprint 1.0 r7: Beats coverage list (which beats are captured in this specific grid)
  const allBeats = (scene as any).beats as Beat[] | undefined;
  let beatsCoverageBlock = "";
  if (allBeats && allBeats.length > 0) {
    const beatsCoveredHere = new Set<string>();
    for (const cell of grid.cells) {
      if (!cell.shotId) continue;
      const shot = shots.find((s) => s.id === cell.shotId);
      if (!shot) continue;
      const covered = (shot as any).coveredBeatIds as string[] | undefined;
      if (covered) {
        for (const bid of covered) beatsCoveredHere.add(bid);
      }
    }
    const beatsInThisGrid = allBeats.filter((b) => beatsCoveredHere.has(b.id));
    if (beatsInThisGrid.length > 0) {
      beatsCoverageBlock = `

BEATS COVERAGE (which scene beats are captured in this grid):
${beatsInThisGrid.map((b) => `- Beat ${b.order}: ${b.label}`).join("\n")}`;
    }
  }

  // Sprint 1.0 r7: Physical consistency lock from scene
  const physicalLockBody = ((scene as any).physicalConsistencyLockEn as string | undefined)?.trim();
  const physicalLockBlock = physicalLockBody
    ? `

PHYSICAL CONSISTENCY LOCK (do NOT vary across cells):
${physicalLockBody}`
    : "";

  // Per-cell descriptions with rhythm-aware composition + per-shot lighting hint
  const cellDescriptions = grid.cells
    .map((cell) => {
      if (!cell.shotId) {
        return `  Cell ${cell.order}: EMPTY — solid black, no subject, no detail.`;
      }
      const shot = shots.find((s) => s.id === cell.shotId);
      if (!shot) {
        return `  Cell ${cell.order}: EMPTY — shot reference missing.`;
      }
      const shotTitle = shot.titleEn || shot.titleVi || `Shot ${shot.order}`;
      const shotAction =
        (shot as any).actionEn?.trim() ||
        (shot as any).actionVi?.trim() ||
        "(no specific action — show shot framing only)";
      const shotType = SHOT_TYPE_LABEL[shot.shotType] ?? shot.shotType;
      const cameraMovement = (shot.cameraMovement || "static").replace(/_/g, " ");
      const rhythmRole = (shot as any).rhythmRole as RhythmRole | undefined;
      const compositionHint = rhythmRole
        ? RHYTHM_COMPOSITION_HINT[rhythmRole]
        : "balanced framing per shot type";
      // Sprint 1.0 r7: per-shot lighting hint override
      const lightingHint =
        (shot as any).lightingHintEn?.trim() ||
        `derived from scene CINEMATIC INTENT above`;
      return `  Cell ${cell.order}: [${shotType}, ${cameraMovement}, ${shot.durationSeconds}s${rhythmRole ? `, role=${rhythmRole}` : ""}]
    SHOT TITLE: ${shotTitle}
    ACTION: ${shotAction}
    LIGHTING HINT: ${lightingHint}
    COMPOSITION: ${compositionHint}`;
    })
    .join("\n\n");

  // BUG #6 fix (r6): clean ref block. r7: conditional cast subblock + multi-grid ref insertion
  let refImageBlock = `REFERENCE IMAGES (attach in this exact order — filenames from Refs ZIP):
- Image #1 — image-01_grid-template.png — blank ${cols}×${rows} grid layout (locks cell positions + empty cells)`;
  if (previousGridRef) {
    refImageBlock += `
- Image #2 — grid-${String(grid.order - 1).padStart(2, "0")}-generated.png — GRID ${grid.order - 1} previously generated. USE AS VISUAL STYLE ANCHOR:
  · Match exact moss/ivy/rust/outfit pattern on all characters from previous grid
  · Match exact lighting tone, color palette, atmospheric depth
  · This is the SAME scene continuing — must blend seamlessly with previous grid`;
  }
  if (castBlock) {
    refImageBlock += `
- Image #${castStartIdx}+ — cast references (face + body per character):
${castBlock}`;
  }

  // CINEMATIC INTENT block
  const cinematicMoodBlock = `CINEMATIC INTENT (derived from pacing analysis — emotional tone + tension):
- Dominant emotion: ${sceneTone} · Tension: ${tensionLabel}
- Lighting: ${moodHints.lighting}
- Color palette: ${moodHints.palette}
- Atmosphere: ${moodHints.atmosphere}
- Framing intensity: ${tensionHint}${characterEmotionPhrase ? `\n- ${characterEmotionPhrase}` : ""}`;

  const setupPayoffBlock = setupPayoffHints.length > 0
    ? `\n\nNARRATIVE CONTINUITY (Setup → Payoff anchors for this scene):
${setupPayoffHints.map((h) => `- ${h}`).join("\n")}`
    : "";

  // Multi-grid continuity directives (only for Grid 2+)
  const continuityDirectives = previousGridRef
    ? `\n\nMULTI-GRID CONTINUITY DIRECTIVES (this is GRID ${grid.order}):
- Cell content MUST visually flow from previous grid — same composition logic, same character pose continuity
- Lighting must match previous grid EXACTLY: same time-of-day, same dappled patterns, same color grade
- All characters MUST have identical appearance to previous grid (same outfit, body coverage, distinctive marks)
- Do not introduce new style elements, color tones, or visual treatments`
    : "";

  return `Cinematic storyboard grid${gridLabel}: ${cols} columns × ${rows} rows = ${totalCells} cells (${filledCount} filled${emptyCount > 0 ? `, ${emptyCount} empty` : ""}). ${aspect} aspect ratio per cell.
Style: ${styleHint}.

STRICT LAYOUT REQUIREMENT (do NOT change):
- Output image MUST contain EXACTLY ${cols} columns and ${rows} rows of cells.
- DO NOT add cells. DO NOT remove cells. DO NOT fill empty cells with new content.
- Empty cells MUST stay solid black, no subject, no detail.
- Reading order: left to right, top to bottom (cell 1 = top-left, cell ${totalCells} = bottom-right).

${refImageBlock}

SCENE: ${sceneTitle}
Setting: ${sceneSettings}
Scene action overview: ${sceneAction.slice(0, 400)}

${cinematicMoodBlock}${physicalLockBlock}${setupPayoffBlock}${beatsCoverageBlock}${continuityDirectives}

SHOTS IN THIS GRID (left-to-right, top-to-bottom):
${cellDescriptions}

FRAMING & CONSISTENCY:
- Maintain identical character identity (face, body, outfit) across all ${filledCount} filled cells per the cast reference images.
- Consistent lighting + color grade per the CINEMATIC INTENT above. Same time-of-day, same weather, same emotional register throughout the grid.${physicalLockBody ? "\n- Honor PHYSICAL CONSISTENCY LOCK above — appearance details locked across ALL cells." : ""}
- Each cell is a self-contained key frame — the moment captured for that shot.
- Cinematic ${aspect} framing per cell.
- Honor each cell's COMPOSITION + LIGHTING HINT (rhythm-role + per-shot variation within unified scene mood).

EMPTY CELLS:
${emptyCount > 0
  ? `- Empty cells (${grid.cells.filter((c) => !c.shotId).map((c) => `Cell ${c.order}`).join(", ")}): render as solid black with no subject, no text, no detail.`
  : "- All cells filled — no empty placeholder needed."}

AVOID:
- Text overlays, dialogue captions, frame numbers, cell numbers inside any cell.
- Inconsistent character appearance between cells.
- Branded logos, watermarks, timestamps.
- Style drift between cells.
- Generic neutral lighting — the CINEMATIC INTENT + per-cell LIGHTING HINT are authoritative.${physicalLockBody ? "\n- Varying physical appearance details that are listed in PHYSICAL CONSISTENCY LOCK." : ""}

OUTPUT: high-resolution single image, ${cols} columns × ${rows} rows grid layout. Each cell rendered as a finished cinematic frame.`;
}
