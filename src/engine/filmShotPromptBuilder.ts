/**
 * KSP Image v0.9.3-r5 — Film Shot Prompt Builder (Mockup 4)
 *
 * Builds 2 EN prompts per shot:
 *   1. Image prompt → Banana Pro / Nano Banana / Imagen 4
 *      Generates the storyboard grid (2×2 / 2×3 / 3×2 / 3×3 / 4×3 cells).
 *   2. Animation prompt → Seedance / Veo 3 / Kling / Sora / custom (Grok et al)
 *      Provider-specific tone + char budget.
 *
 * Inputs come from:
 *   - FilmShot (title, type, grid format, duration, optional purpose)
 *   - FilmSceneScript (action lines, settings, dialog, sfx)
 *   - FilmCharacter[] (ALL project cast — Hướng A confirmed, refs ZIP scope)
 *   - ProjectSettingV2 (genre, animation style, aspect ratio, dialog mode)
 *   - FilmVideoProvider (only for animation prompt — provider tone + char limit)
 *
 * Both functions are PURE (no fetch, no AI call). They return raw EN strings
 * ready for textarea display + Copy → external tool.
 */

import type {
  FilmShot,
  FilmSceneScript,
  ProjectSettingV2,
  EmotionalTone,
  RhythmRole,
  SetupPayoffPair,
} from "../types/project";
import type { FilmCharacter, FilmVideoProvider } from "../types/film";
import {
  EMOTION_CINEMA_HINTS,
  RHYTHM_COMPOSITION_HINT,
  tensionFramingHint,
  buildCharacterEmotionPhrase,
  buildSetupPayoffHints,
  castRefsBlockFiltered,
} from "./sceneImagePromptBuilder";

// ============================================================================
// SHARED HELPERS
// ============================================================================

const SHOT_TYPE_LABEL: Record<FilmShot["shotType"], string> = {
  wide_establishing: "wide / establishing shot",
  medium: "medium shot",
  close_up: "close-up",
  insert: "insert shot",
  over_shoulder: "over-the-shoulder shot",
  two_shot: "two-shot",
  pov: "POV shot",
};

const ANIMATION_STYLE_HINT: Record<string, string> = {
  live_action: "live-action cinematic, photoreal lighting, 35mm film grain",
  anime_2d: "high-quality anime 2D, hand-drawn line art, expressive frame composition",
  cgi_3d_cinematic: "3D CGI cinematic, Pixar-grade rendering, soft global illumination",
  film_noir: "black-and-white film noir, high-contrast chiaroscuro, deep shadows",
  cartoon_2d: "stylized 2D cartoon, bold outlines, flat color shading",
  stop_motion: "stop-motion animation, claymation-style tactile surfaces",
};

function gridDims(gridFormat: string): { rows: number; cols: number; frames: number } {
  const [rows, cols] = gridFormat.split("x").map(Number);
  return { rows: rows || 3, cols: cols || 3, frames: (rows || 3) * (cols || 3) };
}

function castSummary(cast: FilmCharacter[]): string {
  if (cast.length === 0) return "no characters specified";
  return cast
    .map((c, i) => {
      const refs = `${c.faceRefs.length} face ref${c.faceRefs.length !== 1 ? "s" : ""} + ${c.bodyRefs.length} body ref${c.bodyRefs.length !== 1 ? "s" : ""}`;
      const desc = c.description ? ` — ${c.description}` : "";
      return `  Image #${i + 1}: ${c.name || `Character ${c.order}`} (${c.role}) [${refs}]${desc}`;
    })
    .join("\n");
}

// ============================================================================
// SINGLE SHOT IMAGE PROMPT (qc22c — per-cell standalone generation)
// ============================================================================
// Generates ONE image for ONE shot (single cell), not a grid. Used by
// FilmFrameEditModal so user can regenerate or perfect a single frame in
// isolation from the grid.

export interface BuildSingleShotImagePromptInput {
  shot: FilmShot;
  scene?: FilmSceneScript;
  cast: FilmCharacter[];
  setting: ProjectSettingV2;
  /** r6: Optional pacing context — when caller has it, prompt enriches accordingly. */
  allScenes?: FilmSceneScript[];
  setupPayoffPairs?: SetupPayoffPair[];
}

export function buildSingleShotImagePrompt(
  input: BuildSingleShotImagePromptInput
): string {
  const { shot, scene, cast, setting, allScenes, setupPayoffPairs } = input;
  const styleHint =
    ANIMATION_STYLE_HINT[setting.animationStyle ?? "live_action"] ??
    ANIMATION_STYLE_HINT["live_action"];
  const aspect = setting.aspectRatio;

  const shotTitle = shot.titleEn || shot.titleVi || `Shot ${shot.order}`;
  const shotType = SHOT_TYPE_LABEL[shot.shotType] ?? shot.shotType;
  const cameraMovement = (shot.cameraMovement || "static").replace(/_/g, " ");
  const sceneTitle = scene?.titleEn || scene?.titleVi || "—";
  const sceneSettings = scene?.settings || "unspecified location";
  // BUG #2 fix: actionEn priority everywhere
  const actionEn =
    (shot as any).actionEn?.trim() ||
    (shot as any).actionVi?.trim() ||
    scene?.actionLinesEn?.trim() ||
    (scene as any)?.actionLinesVi?.trim() ||
    "(action to be filled by director)";
  // Sprint 1.0 r7 (Q1 VI leak fix): prefer purposeEn, fallback purpose (legacy VI)
  const purposeEn = (shot as any).purposeEn?.trim();
  const purposeFallback = shot.purpose?.trim();
  const purpose = purposeEn
    ? `Narrative purpose: ${purposeEn}`
    : purposeFallback
    ? `Narrative purpose: ${purposeFallback}` // legacy VI — user warned via UI migration flag
    : "";

  // Sprint 1.0 r7: Cast refs filtered
  const refBlock = castRefsBlockFiltered(cast, 1); // single-shot: cast refs start at Image #1

  // Pacing resolution order (Sprint 1.0 r7 D3 priority):
  //   1. shot.lightingHintEn (user manual or AI auto) — highest
  //   2. shot.shotMoodOverride + shotMoodIntensity — middle
  //   3. scene.emotionalTone + scene.tensionLevel — fallback
  const overrideTone = (shot as any).shotMoodOverride as EmotionalTone | undefined;
  const overrideIntensity = (shot as any).shotMoodIntensity as number | undefined;
  const sceneTone: EmotionalTone = overrideTone ?? (scene?.emotionalTone as EmotionalTone) ?? "neutral";
  const sceneTension =
    overrideIntensity ?? (scene ? ((scene as any).tensionLevel as number | undefined) : undefined);
  const moodHints = EMOTION_CINEMA_HINTS[sceneTone];
  const tensionHint = tensionFramingHint(sceneTension);
  const tensionLabel = sceneTension !== undefined ? `${sceneTension}/10` : "unset";
  const rhythmRole = (shot as any).rhythmRole as RhythmRole | undefined;
  const compositionHint = rhythmRole
    ? RHYTHM_COMPOSITION_HINT[rhythmRole]
    : `balanced framing for ${shotType}`;
  const characterEmotionPhrase = scene
    ? buildCharacterEmotionPhrase(scene, cast)
    : "";
  const setupPayoffHints = scene
    ? buildSetupPayoffHints(scene.id, setupPayoffPairs, allScenes)
    : [];

  // Sprint 1.0 r7: per-shot lighting hint (user override or AI auto-fill)
  const lightingHint = (shot as any).lightingHintEn?.trim() || moodHints.lighting;

  // Sprint 1.0 r7: Physical consistency lock from scene
  const physicalLockBody = scene
    ? ((scene as any).physicalConsistencyLockEn as string | undefined)?.trim()
    : undefined;
  const physicalLockBlock = physicalLockBody
    ? `

PHYSICAL CONSISTENCY LOCK (must match other shots in this scene):
${physicalLockBody}`
    : "";

  // CINEMATIC INTENT block — per-shot, with override-aware values
  const overrideNote = overrideTone || overrideIntensity ? " — per-shot override active" : "";
  const cinematicMoodBlock = `CINEMATIC INTENT (per-shot, derived from pacing analysis${overrideNote}):
- Scene emotion: ${sceneTone} · Tension: ${tensionLabel}${rhythmRole ? ` · Shot rhythm role: ${rhythmRole}` : ""}
- Lighting: ${lightingHint}
- Color palette: ${moodHints.palette}
- Atmosphere: ${moodHints.atmosphere}
- Framing intensity: ${tensionHint}
- Composition direction: ${compositionHint}${characterEmotionPhrase ? `\n- ${characterEmotionPhrase}` : ""}`;

  const setupPayoffBlock = setupPayoffHints.length > 0
    ? `\n\nNARRATIVE CONTINUITY:
${setupPayoffHints.map((h) => `- ${h}`).join("\n")}`
    : "";

  // Sprint 1.0 r7: REFERENCE IMAGES block — only include cast subblock if any refs uploaded
  const refImageBlock = refBlock
    ? `REFERENCE IMAGES (use for character consistency — filenames from Refs ZIP):
${refBlock}`
    : `REFERENCE IMAGES: (no cast references uploaded — AI must render character from description text alone)`;

  return `Cinematic single-frame storyboard image. ${aspect} aspect ratio.
Style: ${styleHint}.

${refImageBlock}

SHOT: ${shotTitle}
Type: ${shotType}
Camera framing: ${cameraMovement}
Duration: ${shot.durationSeconds}s
Scene: ${sceneTitle} — ${sceneSettings}
${purpose}

${cinematicMoodBlock}${physicalLockBlock}${setupPayoffBlock}

ACTION IN THIS FRAME:
${actionEn}

FRAMING:
- Single image (NOT a grid, NOT a collage). One coherent cinematic frame.
- Capture the EXACT moment described in the action above — peak of the beat.
- Maintain character identity (face, body, outfit) per reference images${refBlock ? "" : " (description only — no refs)"}.
- Cinematic ${aspect} framing with appropriate depth of field for shot type.
- Honor the CINEMATIC INTENT block above — lighting, color, atmosphere, composition must match.${physicalLockBody ? "\n- Match PHYSICAL CONSISTENCY LOCK — appearance details locked across all shots of this scene." : ""}

AVOID:
- Multiple panels, frames, or split-screen.
- Text overlays, dialogue captions, frame numbers.
- Branded logos, watermarks, timestamps.
- Generic neutral lighting that ignores the emotional intent above.${physicalLockBody ? "\n- Varying physical appearance details listed in PHYSICAL CONSISTENCY LOCK." : ""}

OUTPUT: one high-resolution still image of the described shot.`;
}

// ============================================================================
// IMAGE PROMPT (legacy — kept for backward-compat with qc11 callers)
// ============================================================================

export interface BuildImagePromptInput {
  shot: FilmShot;
  scene?: FilmSceneScript;            // Optional — scene context if linked to a Script scene
  cast: FilmCharacter[];              // All project characters (Hướng A: full refs scope)
  setting: ProjectSettingV2;
}

export function buildImagePrompt(input: BuildImagePromptInput): string {
  const { shot, scene, cast, setting } = input;
  const { rows, cols, frames } = gridDims(shot.gridFormat);
  const styleHint =
    ANIMATION_STYLE_HINT[setting.animationStyle ?? "live_action"] ??
    ANIMATION_STYLE_HINT["live_action"];
  const aspect = setting.aspectRatio;

  const shotTitle = shot.titleEn || shot.titleVi || `Shot ${shot.order}`;
  const sceneTitle = scene?.titleEn || scene?.titleVi || "—";
  const sceneSettings = scene?.settings || "unspecified location";
  const actionLines = scene?.actionLinesEn?.trim() || "(action to be filled by director)";
  const purpose = shot.purpose ? `Narrative purpose: ${shot.purpose}` : "";

  const refBlock = castSummary(cast);

  return `Cinematic storyboard ${rows}×${cols} = ${frames} cells, ${aspect} aspect ratio per cell.
Style: ${styleHint}.

REFERENCE IMAGES (use for character consistency across ALL ${frames} cells):
${refBlock}

SCENE: ${sceneTitle}
Setting: ${sceneSettings}
Action: ${actionLines}

SHOT: ${shotTitle}
Type: ${SHOT_TYPE_LABEL[shot.shotType]}
Duration in final cut: ${shot.durationSeconds}s
${purpose}

FRAMING:
- Each cell = one beat of action progression (left-to-right, top-to-bottom).
- Maintain identical character identity (face, body, outfit) across all ${frames} cells.
- Consistent lighting and color grade within the grid.
- Cinematic ${aspect} framing per cell.

AVOID:
- Text overlays, dialogue captions, frame numbers inside cells.
- Inconsistent character appearance between cells.
- Branded logos, watermarks, timestamps.
- Abrupt style shift between cells.

OUTPUT: high-resolution storyboard grid as a single image, cells arranged in ${rows} rows × ${cols} columns.`;
}

// ============================================================================
// ANIMATION PROMPT (for Seedance / Veo / Kling / Sora / custom)
// ============================================================================

export interface BuildAnimationPromptInput {
  shot: FilmShot;
  scene?: FilmSceneScript;
  cast: FilmCharacter[];
  setting: ProjectSettingV2;
  provider: FilmVideoProvider;
  /** Time format for TIMING BREAKDOWN block (default "timecode"). */
  timeFormat?: TimeFormat;
  /** r6: Optional pacing context for prompt enrichment. */
  allScenes?: FilmSceneScript[];
  setupPayoffPairs?: SetupPayoffPair[];
}

/**
 * Generate camera movement direction text per the cameraMovement value.
 * AI needs concrete spatial verbs, not abstract labels like "tracking".
 */
function cameraMovementDirection(cameraMovement: string, duration: number): string {
  const cm = (cameraMovement || "static").toLowerCase().replace(/_/g, " ");
  const speedHint = duration <= 4 ? "quick" : duration <= 8 ? "moderate" : "slow, deliberate";
  const map: Record<string, string> = {
    "static":
      "Static lock-off. Camera does NOT move. Only subject animates within frame.",
    "handheld":
      `Subtle handheld sway — small, organic micro-movement (1-2 cm drift). ${speedHint} pace. Do not overcrank.`,
    "handheld documentary":
      `Documentary handheld — slight breath-like sway, no whip movements. ${speedHint} pace.`,
    "dolly in":
      `Dolly-in toward subject. Smooth linear forward push, ${speedHint} speed. End closer than start by ~20%.`,
    "dolly out":
      `Dolly-out away from subject. Smooth linear backward pull, ${speedHint} speed. End wider by ~25%.`,
    "tracking":
      `Tracking shot — lateral camera follow at subject's pace. ${speedHint} lateral motion. Subject stays roughly centered in frame.`,
    "pan left":
      `Pan-left — camera pivots horizontally left from fixed pivot. ${speedHint} sweep. Subject may exit or stay in frame depending on action.`,
    "pan right":
      `Pan-right — camera pivots horizontally right from fixed pivot. ${speedHint} sweep.`,
    "tilt up":
      `Tilt-up — camera pivots vertically up from fixed pivot. ${speedHint} reveal.`,
    "tilt down":
      `Tilt-down — camera pivots vertically down from fixed pivot. ${speedHint} reveal.`,
    "crane up":
      `Crane-up — camera ascends vertically. ${speedHint} rise.`,
    "zoom in":
      `Zoom-in (lens only, NOT dolly). ${speedHint} focal-length push. Background compresses.`,
    "zoom out":
      `Zoom-out. ${speedHint} pull. Reveal more context.`,
    "orbit":
      `Orbit / arc around subject. ${speedHint} circular motion at constant radius.`,
  };
  return map[cm] ?? `${cm} — ${speedHint} pace, natural cinematic motion.`;
}

/**
 * Generate timing breakdown for the shot duration (3 acts: open / peak / close).
 */
/**
 * Time format options for TIMING BREAKDOWN block.
 * Different AI providers parse time references differently — Seedance handles
 * decimal seconds well, Veo3/Kling/Grok understand timecode better, etc.
 */
export type TimeFormat =
  | "decimal_seconds"  // "0–1.2s"
  | "timecode"         // "0:00–0:01.2"   (default, most universal)
  | "integer_seconds"  // "0–1s"          (rounded)
  | "percentage";      // "0%–20%"        (no absolute time)

export const TIME_FORMAT_LABELS: Record<TimeFormat, string> = {
  decimal_seconds: "Decimal seconds (0–1.2s)",
  timecode: "Timecode (0:00–0:01.2)",
  integer_seconds: "Integer seconds (0–1s)",
  percentage: "Percentage (0%–20%)",
};

/** Convert seconds to a single timecode string like "0:01.2". */
function toTimecode(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds - mins * 60;
  // Use 1 decimal if fractional, else integer
  const secStr =
    Number.isInteger(secs) ? `0${secs}`.slice(-2) : secs.toFixed(1).padStart(4, "0");
  return `${mins}:${secStr}`;
}

/** Format a single time value per the chosen TimeFormat. */
function formatTimeValue(
  seconds: number,
  totalDuration: number,
  format: TimeFormat
): string {
  switch (format) {
    case "decimal_seconds":
      return `${seconds % 1 === 0 ? seconds : seconds.toFixed(1)}s`;
    case "timecode":
      return toTimecode(seconds);
    case "integer_seconds":
      return `${Math.round(seconds)}s`;
    case "percentage": {
      const pct = totalDuration > 0 ? (seconds / totalDuration) * 100 : 0;
      return `${Math.round(pct)}%`;
    }
  }
}

/** Format a time range "A–B" per format. Suffix unit only at end for seconds formats. */
function formatTimeRange(
  start: number,
  end: number,
  totalDuration: number,
  format: TimeFormat
): string {
  if (format === "decimal_seconds" || format === "integer_seconds") {
    // "0–1.2s" — strip unit from start, keep at end
    const startStr = formatTimeValue(start, totalDuration, format).replace(/s$/, "");
    return `${startStr}–${formatTimeValue(end, totalDuration, format)}`;
  }
  return `${formatTimeValue(start, totalDuration, format)}–${formatTimeValue(end, totalDuration, format)}`;
}

function timingBreakdown(
  duration: number,
  action: string,
  format: TimeFormat = "timecode"
): string {
  if (duration <= 2) {
    return `TIMING (${duration}s — flash shot): single continuous beat, full ${duration}s on the action.`;
  }
  // Split into 3 parts: ~20% open, ~60% peak, ~20% close
  const openEnd = Math.max(0.5, +(duration * 0.2).toFixed(1));
  const peakEnd = +(duration * 0.8).toFixed(1);
  return `TIMING BREAKDOWN (${duration}s shot):
- ${formatTimeRange(0, openEnd, duration, format)} (OPEN): hold the reference-image pose. Subtle entry into motion.
- ${formatTimeRange(openEnd, peakEnd, duration, format)} (PEAK): the action unfolds — ${action.slice(0, 140)}${action.length > 140 ? "..." : ""}
- ${formatTimeRange(peakEnd, duration, duration, format)} (CLOSE): action resolves to its natural endpoint. Frame settles for the cut.`;
}

export function buildAnimationPrompt(input: BuildAnimationPromptInput): string {
  const { shot, scene, cast, setting, provider, timeFormat = "timecode", allScenes, setupPayoffPairs } = input;
  const styleHint =
    ANIMATION_STYLE_HINT[setting.animationStyle ?? "live_action"] ??
    ANIMATION_STYLE_HINT["live_action"];
  const aspect = setting.aspectRatio;
  const duration = shot.durationSeconds;

  const shotTitle = shot.titleEn || shot.titleVi || `Shot ${shot.order}`;
  const sceneTitle = scene?.titleEn || scene?.titleVi || "—";
  const shotAction = (shot as any).actionEn?.trim() || (shot as any).actionVi?.trim();
  const actionLines =
    shotAction || shot.purpose?.trim() || "(action to be filled by director)";
  const settingHint = scene?.settings || "—";

  // Sprint 1.0 r7 (Q1 VI leak fix): purposeEn priority
  const purposeEn = (shot as any).purposeEn?.trim();
  const purposeFallback = shot.purpose?.trim();
  const purpose = purposeEn
    ? `Narrative purpose: ${purposeEn}`
    : purposeFallback
    ? `Narrative purpose: ${purposeFallback}`
    : "";

  const cameraDirection = cameraMovementDirection(
    shot.cameraMovement ?? "static",
    duration
  );
  const timing = timingBreakdown(duration, actionLines, timeFormat);

  const castNames =
    cast.length > 0
      ? cast.map((c) => c.name || `Character ${c.order}`).join(", ")
      : "(no characters specified)";

  // Sprint 1.0 r7: Per-shot mood override resolution (D3 priority order)
  const overrideTone = (shot as any).shotMoodOverride as EmotionalTone | undefined;
  const overrideIntensity = (shot as any).shotMoodIntensity as number | undefined;
  const sceneTone: EmotionalTone = overrideTone ?? (scene?.emotionalTone as EmotionalTone) ?? "neutral";
  const sceneTension =
    overrideIntensity ?? (scene ? ((scene as any).tensionLevel as number | undefined) : undefined);
  const moodHints = EMOTION_CINEMA_HINTS[sceneTone];
  const tensionLabel = sceneTension !== undefined ? `${sceneTension}/10` : "unset";
  const rhythmRole = (shot as any).rhythmRole as RhythmRole | undefined;
  const characterEmotionPhrase = scene
    ? buildCharacterEmotionPhrase(scene, cast)
    : "";
  const setupPayoffHints = scene
    ? buildSetupPayoffHints(scene.id, setupPayoffPairs, allScenes)
    : [];

  // Per-rhythm motion intent (different from composition — describes HOW motion unfolds)
  const rhythmMotionHint: Record<RhythmRole, string> = {
    establish: "calm, deliberate motion. Let the eye absorb the space before anything happens.",
    build: "motion ramps gradually — small actions build into larger ones, energy accumulates.",
    peak: "intense, focused motion. This is the emotional pinnacle — every gesture must land with weight.",
    release: "motion winds down, releases tension. Action resolves, frame settles into stillness.",
  };
  const motionIntent = rhythmRole ? rhythmMotionHint[rhythmRole] : "natural, story-appropriate motion pace.";

  // Sprint 1.0 r7: Per-shot lighting hint override
  const lightingHint = (shot as any).lightingHintEn?.trim() || moodHints.lighting;

  // Sprint 1.0 r7: Physical consistency lock from scene
  const physicalLockBody = scene
    ? ((scene as any).physicalConsistencyLockEn as string | undefined)?.trim()
    : undefined;
  const physicalLockBlock = physicalLockBody
    ? `

PHYSICAL CONSISTENCY LOCK (must hold across entire shot duration):
${physicalLockBody}`
    : "";

  const overrideNote = overrideTone || overrideIntensity ? " — per-shot override active" : "";
  const cinematicMoodBlock = `EMOTIONAL & MOTION INTENT (from pacing analysis${overrideNote}):
- Scene emotion: ${sceneTone} · Tension: ${tensionLabel}${rhythmRole ? ` · Shot role: ${rhythmRole}` : ""}
- Lighting consistency target: ${lightingHint}
- Atmosphere maintained throughout shot: ${moodHints.atmosphere}
- Motion intent: ${motionIntent}${characterEmotionPhrase ? `\n- ${characterEmotionPhrase}` : ""}`;

  const setupPayoffBlock = setupPayoffHints.length > 0
    ? `\n\nNARRATIVE CONTINUITY: ${setupPayoffHints[0]}`
    : "";

  // Provider hints — ALL aligned to ONE CONTINUOUS SHOT (no multi-shot syntax).
  const providerHints: Record<string, string> = {
    "seedance-2-pro":
      "Provider: Seedance 2.0 Pro. ONE continuous shot (no cuts inside). Up to 12s. Strong character/motion fidelity.",
    "veo-3":
      "Provider: Veo 3. ONE continuous shot, max 8s. Photoreal motion, no edits.",
    "kling-2":
      "Provider: Kling 2.0. ONE continuous shot, 5-10s. Strong character motion fidelity, no internal cuts.",
    sora:
      "Provider: Sora. ONE continuous take. Strong physics. No internal cuts.",
  };
  const providerHint =
    providerHints[provider.id] ??
    `Provider: ${provider.name}${provider.maxDurationSec ? ` (max ${provider.maxDurationSec}s)` : ""}. ONE continuous shot, no internal cuts.`;

  const base = `You are an experienced film director instructing a video AI to animate ONE shot.

SHOT: ${shotTitle}  (Scene: ${sceneTitle})
Cast: ${castNames}
Style: ${styleHint}
Aspect ratio: ${aspect}
Setting: ${settingHint}
Duration: ${duration}s
${purpose}

REFERENCE IMAGE — filename: first-frame_shot-${shot.order}.png.
A single keyframe of THIS shot (the starting/anchor frame). Animate motion that BEGINS from this exact image. Do not redraw, recompose, or restyle the reference.

${cinematicMoodBlock}${physicalLockBlock}${setupPayoffBlock}

ACTION (this shot ONLY):
${actionLines}

${timing}

CAMERA:
${cameraDirection}

KEY DIRECTIONS:
- ONE continuous shot, NO internal cuts or scene transitions.
- Preserve character identity across the whole shot (face, outfit, body proportion) per reference.
- Smooth motion arc only. Frame begins EXACTLY at reference image.
- Lighting matches the EMOTIONAL & MOTION INTENT above. No style drift mid-shot.
- ${aspect} framing throughout.
- Motion pace and emotional weight match the rhythm role specified above.${physicalLockBody ? "\n- Physical appearance details (PHYSICAL CONSISTENCY LOCK) MUST stay identical frame-to-frame." : ""}

AVOID:
- Adding actions outside the listed ACTION (no extra characters appearing, no new locations).
- Cuts, transitions, or split-screens inside the shot.
- Style/lighting drift.
- Generic neutral motion — the rhythm role + emotion above are authoritative.${physicalLockBody ? "\n- Drift in physical appearance details listed in PHYSICAL CONSISTENCY LOCK." : ""}

${providerHint}`;

  // Char budget warning baked into prompt itself
  if (provider.charLimit) {
    const estimated = base.length;
    if (estimated > provider.charLimit) {
      const trimmed = base.slice(0, provider.charLimit - 100);
      return `${trimmed}\n\n[... auto-trimmed to fit ${provider.charLimit} chars]`;
    }
  }
  return base;
}

// ============================================================================
// ADVANCED ANIMATION PROMPT (qc22c — first frame + last frame mode)
// ============================================================================
// User picks a "last frame" cell from the same scene grid. Prompt instructs
// video AI to interpolate from current cell's image (first frame) to picked
// cell's image (last frame). Useful for smooth shot-to-shot transitions or
// camera move sweeps where both endpoints exist as reference frames.

export interface BuildAnimationPromptAdvancedInput {
  /** Current cell's shot — provides first-frame reference image */
  shot: FilmShot;
  /** Other shot whose image will be the last-frame reference */
  lastFrameShot: FilmShot;
  scene?: FilmSceneScript;
  cast: FilmCharacter[];
  setting: ProjectSettingV2;
  provider: FilmVideoProvider;
  /** Time format for TIMING block (default "timecode"). */
  timeFormat?: TimeFormat;
  /**
   * If true, swap roles: shot becomes LAST frame, lastFrameShot becomes FIRST.
   * User can drag-swap panes in UI to flip interpolation direction.
   */
  swapped?: boolean;
}

export function buildAnimationPromptAdvanced(
  input: BuildAnimationPromptAdvancedInput
): string {
  const {
    shot: rawShot,
    lastFrameShot: rawLastFrameShot,
    scene,
    cast,
    setting,
    provider,
    timeFormat = "timecode",
    swapped = false,
  } = input;
  // After swap: "first frame" = original lastFrameShot, "last frame" = original shot
  const shot = swapped ? rawLastFrameShot : rawShot;
  const lastFrameShot = swapped ? rawShot : rawLastFrameShot;

  const styleHint =
    ANIMATION_STYLE_HINT[setting.animationStyle ?? "live_action"] ??
    ANIMATION_STYLE_HINT["live_action"];
  const aspect = setting.aspectRatio;
  const duration = shot.durationSeconds;

  const shotTitle = shot.titleEn || shot.titleVi || `Shot ${shot.order}`;
  const lastTitle =
    lastFrameShot.titleEn || lastFrameShot.titleVi || `Shot ${lastFrameShot.order}`;
  const sceneTitle = scene?.titleEn || scene?.titleVi || "—";
  const firstAction =
    (shot as any).actionEn?.trim() ||
    (shot as any).actionVi?.trim() ||
    shot.purpose?.trim() ||
    "(action to be filled by director)";
  const lastAction =
    (lastFrameShot as any).actionEn?.trim() ||
    (lastFrameShot as any).actionVi?.trim() ||
    lastFrameShot.purpose?.trim() ||
    "(end state described by first→last frame interpolation)";
  const settingHint = scene?.settings || "—";
  const cameraDirection = cameraMovementDirection(
    shot.cameraMovement ?? "static",
    duration
  );
  const castNames =
    cast.length > 0
      ? cast.map((c) => c.name || `Character ${c.order}`).join(", ")
      : "(no characters specified)";

  // Provider hints aligned to one continuous interpolation (no internal cuts)
  const providerHints: Record<string, string> = {
    "seedance-2-pro":
      "Provider: Seedance 2.0 Pro. First-frame + last-frame anchor mode. ONE continuous interpolation. Up to 12s.",
    "veo-3":
      "Provider: Veo 3. First-frame + last-frame interpolation. ONE continuous motion. Max 8s, photoreal.",
    "kling-2":
      "Provider: Kling 2.0. Built-in first-last frame interpolation. 5-10s, ONE continuous motion.",
    sora:
      "Provider: Sora. First-last frame mode. ONE continuous smooth interpolation.",
  };
  const providerHint =
    providerHints[provider.id] ??
    `Provider: ${provider.name}. First-frame + last-frame mode. ONE continuous interpolation.`;

  // Timing breakdown for interpolation: open → midway → close
  let timingBlock = "";
  if (duration > 2) {
    const midPoint = +(duration * 0.5).toFixed(1);
    const startStr = formatTimeValue(0, duration, timeFormat);
    const midStr = formatTimeValue(midPoint, duration, timeFormat);
    const endStr = formatTimeValue(duration, duration, timeFormat);
    timingBlock = `TIMING (${duration}s interpolation):
- ${startStr}: EXACTLY the first-frame image.
- ${formatTimeRange(0, midPoint, duration, timeFormat)}: smooth interpolation begins. Action: ${firstAction.slice(0, 120)}${firstAction.length > 120 ? "..." : ""}
- ${formatTimeRange(midPoint, duration, duration, timeFormat)}: continued motion toward end state.
- ${endStr}: EXACTLY the last-frame image.`;
  } else {
    timingBlock = `TIMING (${duration}s flash interpolation): single continuous tween from first-frame to last-frame.`;
  }

  const base = `You are an experienced film director instructing a video AI to animate ONE shot using FIRST-FRAME and LAST-FRAME reference images.

SHOT: ${shotTitle}  (Scene: ${sceneTitle})
Cast: ${castNames}
Style: ${styleHint}
Aspect ratio: ${aspect}
Setting: ${settingHint}
Duration: ${duration}s

REFERENCE IMAGES (attach in this exact order):
- IMAGE #1 (FIRST FRAME) — filename: first-frame_shot-${shot.order}.png. The starting state of this shot.
- IMAGE #2 (LAST FRAME) — filename: last-frame_shot-${lastFrameShot.order}.png. The end state ("${lastTitle}") to interpolate toward.

INTERPOLATION RULES:
- Begin EXACTLY at IMAGE #1 (do not redraw or restyle).
- End EXACTLY at IMAGE #2 (do not redraw or restyle).
- The intermediate motion is a SMOOTH NATURAL TRANSITION from IMAGE #1 to IMAGE #2.

ACTION CONTEXT:
- Start state action: ${firstAction}
- End state action: ${lastAction}

${timingBlock}

CAMERA:
${cameraDirection}

KEY DIRECTIONS:
- ONE continuous shot, NO internal cuts or transitions.
- Preserve character identity across the whole shot per IMAGE #1 / IMAGE #2.
- Lighting transitions naturally between IMAGE #1 and IMAGE #2 references.
- ${aspect} framing throughout.

AVOID:
- Adding actions outside the start→end interpolation.
- Cuts or transitions inside the shot.
- Style/lighting drift mid-shot.

${providerHint}`;

  if (provider.charLimit) {
    const estimated = base.length;
    if (estimated > provider.charLimit) {
      const trimmed = base.slice(0, provider.charLimit - 100);
      return `${trimmed}\n\n[... auto-trimmed to fit ${provider.charLimit} chars]`;
    }
  }
  return base;
}

// ============================================================================
// CHAR COUNT COLOR (r5 spec: green <70%, yellow 70-95%, red >95%)
// ============================================================================

export type CharCountColor = "green" | "yellow" | "red" | "none";

export function charCountColor(
  charCount: number,
  charLimit: number | undefined
): CharCountColor {
  if (!charLimit || charLimit <= 0) return "none"; // No limit → no color logic
  const ratio = charCount / charLimit;
  if (ratio < 0.7) return "green";
  if (ratio <= 0.95) return "yellow";
  return "red";
}
