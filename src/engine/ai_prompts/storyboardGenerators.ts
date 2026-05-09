/**
 * KSP Image v0.9.0 — AI Storyboard generators (3 sub-templates)
 *
 * 1. shotsForScene: Break 1 scene into 2-4 shots
 * 2. framesForShot: Auto-derive N frames text from 1 shot
 * 3. singleFrameRegen: Regenerate 1 frame with continuity
 */

import type { FilmSceneScript, FilmShot, FilmCharacterV2, AnimationStyleV2, AspectRatioV2 } from "../../types/v0_9_0";

// ============================================================================
// 1. SHOTS FOR SCENE
// ============================================================================

export const SHOTS_FOR_SCENE_SYSTEM_PROMPT = `You are a director of photography (DP) for international cinema.

Your reference DPs:
- Roger Deakins (composition, naturalistic light)
- Hoyte van Hoytema (atmospheric handheld, Dunkirk/Interstellar)
- Robert Yeoman (Wes Anderson — symmetry, dolly)
- Christopher Doyle (Wong Kar-wai — handheld intimacy)
- Bradford Young (low-light, anamorphic)

Break each scene into 2-4 shots that:
- Cover the scene's narrative beats
- Vary visual scale: wide → medium → close-up rhythm
- Use varied camera movements (locked-off / steadicam / dolly / aerial)
- Mix grid sizes for storyboard fidelity:
  * 2x2 (4 frames): macro detail, insert close-ups
  * 3x3 (9 frames): default for most shots
  * 4x3 (12 frames): action, dynamic movement
  * 2x3 / 3x2: medium complexity

OUTPUT JSON (no markdown):
{
  "shots": [
    {
      "id": "scene{N}_shot{M}",
      "order": number,
      "title_en": string,
      "title_vi": string,
      "shot_type": "wide_establishing|medium|close_up|insert|over_shoulder|two_shot|pov",
      "duration_seconds": number,
      "grid_format": "2x2|2x3|3x2|3x3|4x3",
      "camera_movement": "handheld_documentary|steadicam_smooth|dolly_tracking|drone_aerial|crane_shot|locked_off",
      "purpose": string,
      "action_summary_en": string
    }
  ]
}`;

export function buildShotsForSceneUserPrompt(
  scene: FilmSceneScript,
  animationStyle: AnimationStyleV2,
  aspectRatio: AspectRatioV2,
  cast: FilmCharacterV2[]
): string {
  return `Break this scene into 2-4 shots:

SCENE:
${JSON.stringify(scene, null, 2)}

PROJECT:
- Animation style: ${animationStyle}
- Aspect ratio: ${aspectRatio}
- Cast in this scene: ${cast.map((c) => c.name).join(", ") || "(none specified)"}

Return ONLY the JSON.`;
}

// ============================================================================
// 2. FRAMES FOR SHOT (auto-derive from Script + grid format)
// ============================================================================

export const FRAMES_FOR_SHOT_SYSTEM_PROMPT = `You are a storyboard artist breaking down 1 shot into N frame moments.

Your job: Take a single shot description + scene action lines, output N frames that show micro-progression.

PRINCIPLES:
- Frame 1 = entry point (establishes situation, often static or pre-movement)
- Frame N = exit point (leads to next shot, often resolution/transition)
- Frames between = micro-progression (motion, expression change, lighting shift, blocking change)
- Each frame = 1-2 sentences focused on VISIBLE visual change (what camera sees differently)
- Reference cast by NAME + their unique identifiers (e.g. "Robot with glowing blue LED eyes")
- Avoid abstract emotions ("feels sad") — show physical manifestation ("shoulders sink, hand grips chair edge")

OUTPUT JSON (no markdown):
{
  "frames": [
    {
      "id": "frame_{N}",
      "order": number,
      "timing_seconds": { "start": number, "end": number },
      "role": "establishing|stillness|motion|climax|resolution|transition",
      "action_en": string,
      "action_vi": string
    }
  ]
}`;

export function buildFramesForShotUserPrompt(
  shot: FilmShot,
  sceneActionLines: string,
  cast: FilmCharacterV2[]
): string {
  const numFrames = parseGridSize(shot.gridFormat);
  const castWithIds = cast
    .map((c) => `${c.name} (${c.uniqueIdentifiers || c.description})`)
    .join("; ");

  return `Break this shot into ${numFrames} frames:

SHOT:
${JSON.stringify(shot, null, 2)}

SCENE CONTEXT (action lines):
"""
${sceneActionLines}
"""

CAST (with unique identifiers):
${castWithIds}

GRID FORMAT: ${shot.gridFormat} = ${numFrames} frames over ${shot.durationSeconds}s.

Distribute timing evenly across ${shot.durationSeconds} seconds. Each frame should be:
- ${(shot.durationSeconds / numFrames).toFixed(2)}s long
- Show 1 specific visual change

Return ONLY the JSON.`;
}

function parseGridSize(format: string): number {
  const [r, c] = format.split("x").map((n) => parseInt(n, 10));
  return r * c;
}

// ============================================================================
// 3. SINGLE FRAME REGEN (Film-aware)
// ============================================================================

export const SINGLE_FRAME_REGEN_SYSTEM_PROMPT = `You regenerate 1 frame of a storyboard based on a user change request, while maintaining narrative continuity with surrounding frames.

Output BOTH:
- Updated frame text (action description, English + Vietnamese)
- Standalone image gen prompt (for Banana Pro / Imagen — single image, NOT a grid)

The image prompt must:
- Be self-contained (no reference to "frame N" or grid)
- Match the project's aspect ratio and animation style
- Reference cast face/body refs by image number (#1 = face front, #2 = body, etc.)
- Include specific visual details for AI consistency
- Avoid: text overlays, dialogue boxes, watermarks

OUTPUT JSON (no markdown):
{
  "frame_en": string,
  "frame_vi": string,
  "image_prompt": string
}`;

export function buildSingleFrameRegenUserPrompt(opts: {
  currentFrameText: string;
  prevFrameText?: string;
  nextFrameText?: string;
  userChangeRequest: string;
  animationStyle: AnimationStyleV2;
  aspectRatio: AspectRatioV2;
  cast: FilmCharacterV2[];
  sceneSettings?: string;
}): string {
  const castDesc = opts.cast
    .map(
      (c, i) =>
        `Image #${i * 2 + 1}: ${c.name} face — ${c.uniqueIdentifiers}\nImage #${i * 2 + 2}: ${c.name} body — ${c.description}`
    )
    .join("\n");

  return `Regenerate this frame:

CURRENT FRAME:
"""
${opts.currentFrameText}
"""

USER CHANGE REQUEST:
"""
${opts.userChangeRequest}
"""

CONTINUITY (do not break):
- Previous frame: "${opts.prevFrameText || "(this is the first frame)"}"
- Next frame: "${opts.nextFrameText || "(this is the last frame)"}"
${opts.sceneSettings ? `- Scene setting: ${opts.sceneSettings}` : ""}

PROJECT:
- Animation style: ${opts.animationStyle}
- Aspect ratio: ${opts.aspectRatio}

CAST REFERENCES (image numbers):
${castDesc}

Return ONLY the JSON.`;
}
