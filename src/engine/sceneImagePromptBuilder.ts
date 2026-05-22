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
import { getEnglishTerm } from "../types/cameraMovement";

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
 * Sprint G1e2 Phase 2A — Visual Arc mapping (Pixar pacing model).
 *
 * Each shot's rhythm role implies a lens focal length + emotional distance from viewer.
 * This is DETERMINISTIC (no schema change, derived read-time).
 *
 * Pixar Visual Arc principle: shots progress through emotional distance arc within scene:
 *   Discovery (wide)    → viewer absorbs space, scale, context
 *   Curiosity (medium)  → viewer engages with subject's action
 *   Connection (close)  → viewer reads subject's emotion
 *   Intimacy (insert)   → viewer feels subject's interiority
 *
 * Mapping:
 *   establish → Discovery (24-35mm wide)
 *   build     → Curiosity (50mm medium)
 *   peak      → Intimacy (85mm close, shallow DOF)
 *   release   → Curiosity pullback (35mm)
 *
 * For shot types that override (e.g. shot.shotType=insert with rhythmRole=peak),
 * insert overrides to macro 100mm regardless of role.
 */
export const VISUAL_ARC_HINT: Record<RhythmRole, { lens: string; distance: string }> = {
  establish: {
    lens: "24-35mm wide-angle, deep depth of field, full environment visible",
    distance: "discovery (Pixar Visual Arc — viewer absorbs space + scale)",
  },
  build: {
    lens: "50mm natural focal length, medium DOF, balanced subject/environment",
    distance: "curiosity (Pixar Visual Arc — viewer engages with action)",
  },
  peak: {
    lens: "85mm cinematic portrait, shallow DOF, subject pops from background bokeh",
    distance: "intimacy (Pixar Visual Arc — viewer feels subject's interiority)",
  },
  release: {
    lens: "35mm pullback, medium-wide DOF, breathing space around resolved subject",
    distance: "curiosity-pullback (Pixar Visual Arc — viewer settles for next cut)",
  },
};

/**
 * Sprint G1e2 Phase 2A — Resolve lens + emotional distance for a shot.
 * Insert shots always get macro lens regardless of rhythm role.
 */
export function resolveVisualArc(
  rhythmRole: RhythmRole | undefined,
  shotType: string
): { lens: string; distance: string } {
  // Insert shots always macro
  if (shotType === "insert") {
    return {
      lens: "100mm macro, extreme shallow DOF, subject fills frame with texture detail",
      distance: "insert (Pixar Visual Arc — viewer studies the detail)",
    };
  }
  if (rhythmRole) return VISUAL_ARC_HINT[rhythmRole];
  // Default fallback: medium engagement
  return VISUAL_ARC_HINT.build;
}

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
  const tensionLabel = sceneTension !== undefined ? `${sceneTension}/10` : "neutral baseline";
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

  // Sprint 1.0 r7: Physical consistency lock from scene (now inlined in Tier 1)
  const physicalLockBody = ((scene as any).physicalConsistencyLockEn as string | undefined)?.trim();

  // Per-cell descriptions with rhythm-aware composition + per-shot lighting hint
  // G1e2 Phase 1: lighting hint compressed — only show when shot has explicit override,
  //   else omit entirely (Tier 2 CINEMATIC INTENT covers it). Reduces token noise.
  // G1e2 Phase 2A: add LENS (Visual Arc) per cell — derived from rhythmRole + shotType
  const cellDescriptions = grid.cells
    .map((cell) => {
      if (!cell.shotId) {
        return `  Cell ${cell.order}: EMPTY (solid black).`;
      }
      const shot = shots.find((s) => s.id === cell.shotId);
      if (!shot) {
        return `  Cell ${cell.order}: EMPTY (shot ref missing).`;
      }
      const shotTitle = shot.titleEn || shot.titleVi || `Shot ${shot.order}`;
      const shotAction =
        (shot as any).actionEn?.trim() ||
        (shot as any).actionVi?.trim() ||
        "static framing — no specific action, hold composition only";
      const shotType = SHOT_TYPE_LABEL[shot.shotType] ?? shot.shotType;
      // r7.21: use getEnglishTerm to render proper labels (e.g. "oner" → "one continuous shot",
      // "smartphone_zoom" → "natural smartphone zoom"). Falls back gracefully for legacy values.
      const cameraMovement = getEnglishTerm(shot.cameraMovement || "static");
      const rhythmRole = (shot as any).rhythmRole as RhythmRole | undefined;
      const compositionHint = rhythmRole
        ? RHYTHM_COMPOSITION_HINT[rhythmRole]
        : "balanced framing per shot type";
      // G1e2 Phase 1: only show lighting hint line when shot has explicit override
      const explicitLighting = (shot as any).lightingHintEn?.trim();
      const lightingLine = explicitLighting
        ? `\n    LIGHTING: ${explicitLighting}`
        : "";
      // G1e2 Phase 2A: Visual Arc — lens + emotional distance per cell
      const visualArc = resolveVisualArc(rhythmRole, shot.shotType);
      // G1e2 Phase 2A: Shot Purpose — pull from purposeEn (may have 4-category prefix after Stage update)
      const purposeEn = (shot as any).purposeEn?.trim();
      const purposeLine = purposeEn
        ? `\n    PURPOSE: ${purposeEn}`
        : "";
      // G1e2 Phase 2B: Inner State — what character feels AT THIS EXACT FRAME (Pixar core)
      const innerStateVi = (shot as any).innerStateVi?.trim();
      const innerStateLine = innerStateVi
        ? `\n    INNER STATE: ${innerStateVi}`
        : "";
      return `  Cell ${cell.order} [${shotType}, ${cameraMovement}, ${shot.durationSeconds}s${rhythmRole ? `, ${rhythmRole}` : ""}]
    TITLE: ${shotTitle}
    ACTION: ${shotAction}${purposeLine}${innerStateLine}${lightingLine}
    LENS: ${visualArc.lens}
    DISTANCE: ${visualArc.distance}
    COMPOSITION: ${compositionHint}`;
    })
    .join("\n\n");

  // BUG #6 fix (r6): clean ref block. r7: conditional cast subblock + multi-grid ref insertion
  let refImageBlock = `REFERENCE IMAGES (in this exact order):
- Image #1: image-01_grid-template.png — blank ${cols}×${rows} grid layout (locks cell positions)`;
  if (previousGridRef) {
    refImageBlock += `
- Image #2: grid-${String(grid.order - 1).padStart(2, "0")}-generated.png — Grid ${grid.order - 1} visual style anchor (match exact appearance + lighting + palette)`;
  }
  if (castBlock) {
    refImageBlock += `
- Image #${castStartIdx}+: cast references
${castBlock}`;
  }

  // G1e2 Phase 2B: filmReferencesEn — Pixar mood anchor references
  const filmRefs = ((scene as any).filmReferencesEn as string[] | undefined) ?? [];
  const filmRefsBlock = filmRefs.length > 0
    ? `\n\nREFERENCES (mood anchor — AI must lean toward these established cinematic atmospheres):\n${filmRefs.map((r) => `- ${r}`).join("\n")}`
    : "";

  // G1e2 Phase 3: colorScript — Pixar Production Design 101 (1 dominant + 2 accents)
  const colorScript = (scene as any).colorScript as
    | { dominantEn: string; accent1En: string; accent2En: string }
    | undefined;
  const colorScriptBlock = colorScript
    ? `\n\nCOLOR SCRIPT (STRICT palette — locked across ALL cells, no drift):\n- Dominant: ${colorScript.dominantEn}\n- Accent 1: ${colorScript.accent1En}\n- Accent 2: ${colorScript.accent2En}`
    : "";

  // G1e2 Phase 1: setupPayoff slim — only inject if there are hints (no header noise when empty)
  const setupPayoffBlock = setupPayoffHints.length > 0
    ? `\n\nNarrative continuity anchors:\n${setupPayoffHints.map((h) => `- ${h}`).join("\n")}`
    : "";

  // G1e2 Phase 1: multi-grid continuity compressed (was 4 redundant lines → 1 line + ref to attached image)
  const continuityDirectives = previousGridRef
    ? `\n\nGrid ${grid.order} continuity: visual style + lighting + character appearance MUST match Grid ${grid.order - 1} image (Image #2) exactly. Same scene continuing.`
    : "";

  return `Cinematic storyboard panel — single scene only${gridLabel}: ${cols}×${rows} = ${totalCells} cells (${filledCount} filled${emptyCount > 0 ? `, ${emptyCount} empty` : ""}). ${aspect} aspect per cell.
Style: ${styleHint}.

═══════════════════════════════════════════════════════════════
TIER 1 — ABSOLUTE LOCK (do NOT alter under any circumstance)
═══════════════════════════════════════════════════════════════
GRID LAYOUT: EXACTLY ${cols}×${rows} cells. Reading order L→R, T→B. Empty cells = solid black, no subject.${emptyCount > 0 ? `\nEMPTY CELLS: ${grid.cells.filter((c) => !c.shotId).map((c) => `Cell ${c.order}`).join(", ")} — solid black.` : ""}

SCENE BOUNDARY (CRITICAL — prevent cross-scene hallucination):
- ALL ${filledCount} filled cells depict events WITHIN ONE SINGLE SCENE only.
- Setting locked: "${sceneSettings}". EVERY cell takes place in this exact location.
- DO NOT depict any setting outside "${sceneSettings}" — no other locations from any larger story arc.
- DO NOT add narrative progression beyond this scene's action — no cells showing future events, no cells showing past events.
- If a cell's described action seems to require a different location, REINTERPRET it within "${sceneSettings}" instead.

CHARACTER IDENTITY: identical face/body/outfit across all ${filledCount} filled cells per cast reference images.${physicalLockBody ? `

PHYSICAL CONSISTENCY (locked across ALL cells — appearance details NEVER vary):
${physicalLockBody}` : ""}

NO TEXT / NO LOGOS / NO WATERMARKS: ABSOLUTELY no written language anywhere in the image — no captions, no subtitles, no cell numbers, no labels, no UI overlays, no signs with readable text in the scene, no brand logos, no watermarks, no numbers, no letters in any script (Latin, Cyrillic, Arabic, Chinese, etc.). Pure visual cinematography only. If a sign or screen would normally have text, draw it blank or with abstract shapes.

${refImageBlock}

═══════════════════════════════════════════════════════════════
TIER 2 — SCENE LOCK (unified visual language for this scene)
═══════════════════════════════════════════════════════════════
SCENE: ${sceneTitle} — ${sceneSettings}
${sceneAction ? `This scene's action (ALL cells stay within these events, NO events from other scenes): ${sceneAction.slice(0, 280)}` : ""}

CINEMATIC INTENT (unified across all cells — same lighting quality, same color palette, same mood):
- Emotion: ${sceneTone} · Tension: ${tensionLabel}
- Lighting: ${moodHints.lighting}
- Palette: ${moodHints.palette}
- Atmosphere: ${moodHints.atmosphere}
- Framing scale: ${tensionHint}${characterEmotionPhrase ? `\n- ${characterEmotionPhrase}` : ""}${filmRefsBlock}${colorScriptBlock}${continuityDirectives}${beatsCoverageBlock}${setupPayoffBlock}

═══════════════════════════════════════════════════════════════
TIER 3 — SHOT-SPECIFIC (per-cell variation within scene mood)
═══════════════════════════════════════════════════════════════
Per cell: vary INTENSITY (gentle/moderate/strong), FOCUS AREA (full/subject/face/eye/hands), and COMPOSITION (per rhythm role). Lighting QUALITY stays unified per Tier 2. LOCATION stays "${sceneSettings}" — NEVER drifts to another setting.

${cellDescriptions}

═══════════════════════════════════════════════════════════════
TIER 4 — SOFT PREFERENCES (apply where natural, do not force)
═══════════════════════════════════════════════════════════════
- Each cell = self-contained key frame for that shot's peak moment within this scene.
- Cinematic ${aspect} framing.
- Subtle motifs from setting (textures, light play) welcome — must not override Tier 2 unified lighting or Tier 1 scene boundary.

AVOID: text/captions/cell numbers inside cells · logos/watermarks · style drift between cells · cells depicting any location other than "${sceneSettings}" · contradicting Tier 1 locks.

OUTPUT: high-resolution single image, ${cols}×${rows} grid layout. Each cell = finished cinematic frame WITHIN THIS SINGLE SCENE.`;
}
