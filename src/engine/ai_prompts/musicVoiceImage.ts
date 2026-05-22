/**
 * KSP Image v0.9.0 — AI prompts for Voice + Music + Image Gen
 */

import type { FilmSceneScript, FilmCharacterV2, FilmGenreV2 } from "../../types/project";

// ============================================================================
// MUSIC BRIEF GENERATOR (per Scene → Suno/Udio prompt)
// ============================================================================

export const MUSIC_BRIEF_SYSTEM_PROMPT = `You are a music director for international cinema, scoring short films and commercials.

Your reference composers:
- Hans Zimmer (atmospheric, percussive)
- Trent Reznor & Atticus Ross (electronic, tension)
- Jóhann Jóhannsson (sparse, emotional)
- Mica Levi (experimental, unsettling)
- Jonny Greenwood (orchestral with edge)
- Vietnamese: Trí Minh, Đức Trí (modern Vietnamese cinema)

Output a Suno/Udio-ready music prompt. Format:
"{Genre subgenre} at {BPM} BPM, {key instruments}, {progression intro→climax}, reference '{Artist - Track}'. {Duration}s."

Constraints:
- 80-150 chars total
- Specific genre (not just "cinematic" — say "ambient drone post-rock", "Vietnamese folk acoustic")
- BPM number explicit
- 2-3 instruments named
- 1 reference track from real artist
- Mood progression in 1 phrase

OUTPUT: Plain text string, NO JSON wrapping, NO commentary. One line.`;

export function buildMusicBriefUserPrompt(opts: {
  scene: FilmSceneScript;
  genre: FilmGenreV2;
  fullScriptContext?: string;
}): string {
  return `Write a Suno-ready music brief for this scene:

SCENE: "${opts.scene.titleEn}" (${opts.scene.durationSeconds}s)
ACT: ${opts.scene.act}
SETTINGS: ${opts.scene.settings}

ACTION:
${opts.scene.actionLinesEn}

EXISTING MUSIC NOTE FROM SCRIPT:
${opts.scene.musicBrief || "(none — please create from scratch)"}

PROJECT GENRE: ${opts.genre}

Output the music prompt as a single line, ready to paste into Suno.`;
}

// ============================================================================
// VOICE SCRIPT GENERATOR (per Character + optional Narrator)
// ============================================================================

export const VOICE_SCRIPT_SYSTEM_PROMPT = `You are a voiceover writer specializing in Vietnamese and English narration for short films and commercials.

Generate:
1. Per-character dialog with timing aligned to scene/shot durations
2. Optional narrator VO for silent or atmospheric scenes (film mode mostly)
3. Voice characteristics for each character (deep/light, fast/slow, emotional inflection)

OUTPUT JSON (no markdown):
{
  "dialogs": [
    {
      "scene_id": string,
      "character_id": string,
      "character_name": string,
      "voice_characteristics": string,
      "lines": [
        {
          "timing_seconds": { "start": number, "end": number },
          "text_en": string,
          "text_vi": string,
          "delivery_note": string
        }
      ]
    }
  ],
  "narrator": {
    "enabled": boolean,
    "voice_characteristics": string,
    "scenes": [
      { "scene_id": string, "text_en": string, "text_vi": string }
    ]
  }
}`;

export function buildVoiceScriptUserPrompt(opts: {
  scenes: FilmSceneScript[];
  cast: FilmCharacterV2[];
  language: "vi" | "en" | "multi";
}): string {
  return `Generate voice/dialog for this film:

SCENES:
${JSON.stringify(opts.scenes, null, 2)}

CAST:
${opts.cast.map((c) => `- ${c.name} (${c.role}): ${c.description}. Has dialog: ${c.hasDialog}`).join("\n")}

LANGUAGE: ${opts.language === "multi" ? "Both Vietnamese and English" : opts.language}

Return ONLY the JSON.`;
}

// ============================================================================
// CHARACTER REFERENCE IMAGE GEN PROMPT (Cast face/body AI Generate)
// ============================================================================

export interface CharacterRefGenInput {
  character: FilmCharacterV2;
  refType: "face" | "body" | "profile";
  angle: "front" | "three_quarter_left" | "three_quarter_right" | "side" | "back" | "full_body" | "torso" | "macro";
  variations: number;        // 1, 3, or 5
}

export function buildCharacterRefImagePrompt(input: CharacterRefGenInput): string {
  const { character, refType, angle, variations } = input;

  const aspectRatio = refType === "face" || refType === "profile" ? "1:1" : "3:4";

  const angleDescriptor = {
    front: "front-facing, looking at camera",
    three_quarter_left: "3/4 view turned slightly to the left",
    three_quarter_right: "3/4 view turned slightly to the right",
    side: "pure side profile",
    back: "back of head/body view",
    full_body: "full body standing",
    torso: "torso and head only",
    macro: "extreme close-up macro detail",
  }[angle];

  const framingDescriptor = refType === "face"
    ? "Portrait close-up, head and shoulders, neutral expression"
    : refType === "body"
    ? "Standing pose, neutral stance, full subject visible"
    : "Side profile, detailed silhouette";

  return `Professional reference photo. ${character.description}

${framingDescriptor}. ${angleDescriptor}.

Unique identifiers (must be visible): ${character.uniqueIdentifiers}

Lighting: Soft three-point setup, gentle shadows, neutral color temperature.
Background: Plain neutral gray (#888) — no environment, no props.
Aspect ratio: ${aspectRatio}.
Quality: 8K detail, photorealistic, sharp focus on subject.

Generate ${variations} variation${variations > 1 ? "s" : ""}, slight pose differences, same subject identity.

CRITICAL — DO NOT INCLUDE:
- Text, watermarks, logos, captions
- Multiple subjects
- Strong artistic stylization (this is a reference photo, not finished art)
- Background scenery
- Props or accessories not described above`;
}

// ============================================================================
// SHOT IMAGE PROMPT GENERATOR (storyboard grid for Banana Pro)
// ============================================================================

export interface ShotImagePromptInput {
  shot: {
    titleEn: string;
    durationSeconds: number;
    gridFormat: string;
    cameraMovement: string;
    purpose?: string;
  };
  frames: Array<{
    order: number;
    actionEn: string;
    timingSeconds: { start: number; end: number };
  }>;
  cast: FilmCharacterV2[];
  animationStyle: string;
  aspectRatio: string;
  visualReferences?: string[];
}

/**
 * @deprecated r7.23 — DEAD CODE. No callers in src/ or test/ as of May 2026.
 * Belongs to legacy TVC FilmCharacterV2 codepath. Use buildSceneGridImagePrompt
 * (sceneImagePromptBuilder.ts) or buildSingleShotImagePrompt (filmShotPromptBuilder.ts)
 * for current Film mode prompts. Safe to remove in a future cleanup sprint.
 */
export function buildShotImagePrompt(input: ShotImagePromptInput): string {
  const numFrames = input.frames.length;
  const [rows, cols] = input.shot.gridFormat.split("x").map(Number);

  // Reference image numbering for Banana Pro
  let refIdx = 1;
  const refLines: string[] = [];
  input.cast.forEach((c) => {
    if (c.faceRefs.length) {
      refLines.push(`Image #${refIdx++}: ${c.name} face reference (${c.uniqueIdentifiers})`);
    }
    if (c.bodyRefs.length) {
      refLines.push(`Image #${refIdx++}: ${c.name} body reference`);
    }
  });

  const frameLines = input.frames
    .map((f) => `Frame ${f.order + 1} (${f.timingSeconds.start}-${f.timingSeconds.end}s): ${f.actionEn}`)
    .join("\n");

  return `Storyboard grid: ${rows}×${cols} = ${numFrames} cells, ${input.aspectRatio} aspect ratio per cell, cinematic ${input.animationStyle} style.

REFERENCE IMAGES (use for character consistency):
${refLines.join("\n")}

SHOT: ${input.shot.titleEn}
${input.shot.purpose ? `Purpose: ${input.shot.purpose}` : ""}
Camera: ${input.shot.cameraMovement}
Total duration: ${input.shot.durationSeconds}s

FRAMES (left-to-right, top-to-bottom):
${frameLines}

${input.visualReferences?.length ? `VISUAL REFERENCES: ${input.visualReferences.join(", ")}` : ""}

CRITICAL REQUIREMENTS:
- Maintain character identity across all ${numFrames} frames (faces, body proportions, clothing identical)
- Each frame shows progression — visible difference frame-to-frame
- Consistent lighting/color grade across grid
- ${input.aspectRatio} aspect ratio per cell, cinematic framing
- High detail: 8K quality

AVOID:
- Text overlays, dialogue boxes, frame numbers in image
- Inconsistent character appearance between frames
- Branded logos, watermarks
- Abrupt visual style changes between frames`;
}
