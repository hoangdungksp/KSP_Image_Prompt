/**
 * KSP Image — Gemini Omni multi-shot scene prompt builder (r7.34 — Hybrid mode)
 *
 * HISTORY:
 *   - r7.22: verbose timeline pattern
 *   - r7.26: rewrite → minimal storyboard-driven (DeepMind 18-word)
 *   - r7.34: HYBRID — add per-cell timestamps + per-cell lighting override
 *            theo Tip #4 community github (Anil-matcha 293★):
 *            "Use explicit durations and timestamps — 0–4s wide shot,
 *             4–8s push-in, 8–12s close-up gives Omni a cut list to follow"
 *
 * Pattern KSP (r7.34):
 *   - Identity anchor: <image_N> refs + "preserve face EXACTLY"
 *   - Storyboard reference statement: "Show this story in <image_N>"
 *   - Cell-by-cell cut list: "N) X-Ys: <camera>, <action>. [lighting override]"
 *   - Audio cues inline (gộp cuối)
 *   - Closing: total duration + style
 *
 * Triết lý: middle ground giữa DeepMind 18-word strict (Pattern B nút riêng)
 * và Veo3 verbose Tier 1/2/3/4. ~600-1200 chars total cho scene 9 shots.
 *
 * KHI scene KHÔNG có storyboard grid (hasStoryboardImage=false):
 *   Fallback xuống mô tả timeline ngắn — vì Omni không có visual reference.
 *
 * Function signature KHÔNG đổi → UI không cần thay đổi.
 */

import type { FilmShot, FilmSceneScript, ProjectSettingV2 } from "../types/project";
import type { FilmCharacter } from "../types/film";
import { getEnglishTerm } from "../types/cameraMovement";

export interface BuildOmniMultiShotPromptInput {
  scene: FilmSceneScript;
  shots: FilmShot[]; // ordered shots in this scene
  cast: FilmCharacter[];
  setting: ProjectSettingV2;
  /** Whether a merged storyboard grid PNG is available — affects prompt strategy */
  hasStoryboardImage?: boolean;
}

export interface OmniMultiShotReferenceSpec {
  slot: number;
  filename: string;
  description: string;
  dataUrl?: string;
}

export interface OmniMultiShotResult {
  promptText: string;
  references: OmniMultiShotReferenceSpec[];
  totalDurationSeconds: number;
}

// Animation style → mood adjective (mirrors omniShotPromptBuilder)
const STYLE_ADJ: Record<string, string> = {
  live_action: "cinematic",
  cgi_3d_cinematic: "Pixar-style 3D cinematic",
  anime_2d: "Studio Ghibli-style anime",
  cartoon_2d: "stylised 2D cartoon",
  stop_motion: "claymation stop-motion",
  film_noir: "noir black-and-white cinematic",
  // Legacy
  pixar_3d: "Pixar 3D animated",
  ghibli: "Studio Ghibli anime",
  anime: "anime",
  comic_book: "comic-book illustrated",
  watercolor: "watercolour-painted",
  claymation: "claymation stop-motion",
  noir: "noir black-and-white",
  documentary: "documentary photorealistic",
};

function getStyleAdjective(style?: string): string {
  if (!style) return "cinematic";
  return STYLE_ADJ[style] ?? style.replace(/_/g, " ");
}

function article(adj: string): string {
  if (!adj) return "a";
  return /^[aeiouAEIOU]/.test(adj.trim()) ? "an" : "a";
}

function asContinuation(text: string): string {
  if (!text) return "";
  return text.trim().replace(/\.$/, "");
}

// ============================================================================
// MAIN BUILDER
// ============================================================================

export function buildOmniMultiShotPrompt(input: BuildOmniMultiShotPromptInput): OmniMultiShotResult {
  const { scene, shots, cast, setting, hasStoryboardImage } = input;

  // -------- IDENTIFY characters across the scene (union of all shots) --------
  const sceneActionText = (
    scene.actionLinesEn || (scene as any).actionLinesVi || ""
  ).toLowerCase();
  const allActions = shots
    .map((s) => ((s as any).actionEn || (s as any).actionVi || "").toLowerCase())
    .join(" ");
  const fullText = sceneActionText + " " + allActions;

  const presentChars = cast.filter((c) => {
    if ((c as any).isProtagonist) return true;
    return fullText.includes((c.name || "").toLowerCase());
  });

  // -------- BUILD reference manifest --------
  // r7.22-fix1: conceptSheet is FilmImageRef object with .dataUrl field.
  const references: OmniMultiShotReferenceSpec[] = [];
  let slot = 0;

  presentChars.forEach((char) => {
    const conceptSheetRef = (char as any).conceptSheet;
    const faceRef = (char as any).faceRefs?.[0];
    const conceptDataUrl: string | undefined =
      (typeof conceptSheetRef === "string" ? conceptSheetRef : conceptSheetRef?.dataUrl) ||
      (typeof faceRef === "string" ? faceRef : faceRef?.dataUrl);
    if (conceptDataUrl && typeof conceptDataUrl === "string") {
      const safeName = (char.name || `char${slot}`).replace(/\s+/g, "_").toLowerCase();
      references.push({
        slot,
        filename: `image_${slot}_${safeName}.png`,
        description: `${char.name} (${(char as any).role || "character"}) concept sheet`,
        dataUrl: conceptDataUrl,
      });
      slot++;
    }
  });

  let storyboardSlot: number | null = null;
  if (hasStoryboardImage) {
    storyboardSlot = slot;
    references.push({
      slot,
      filename: `image_${slot}_storyboard.png`,
      description: `Scene ${scene.order} merged storyboard grid (all ${shots.length} shots, ordered top-left to bottom-right)`,
      // dataUrl filled by caller from merged grid PNG
    });
    slot++;
  }

  // -------- COMPUTE total duration --------
  const totalDurationSeconds = shots.reduce((acc, s) => acc + (s.durationSeconds || 5), 0);

  // -------- BUILD prompt prose --------
  const sentences: string[] = [];

  // (A) IDENTITY ANCHOR — character preserve clause (KSP-specific, not in guide)
  if (presentChars.length > 0 && references.length > 0) {
    const charRefs = references
      .slice(0, presentChars.length)
      .map((r) => `<image_${r.slot}>`)
      .join(", ");
    const charNames = presentChars
      .slice(0, presentChars.length)
      .map((c) => c.name)
      .join(" and ");
    const plural = presentChars.length > 1 ? "faces, hair, and wardrobes" : "face, hair, and wardrobe";
    sentences.push(
      `${charNames} as shown in ${charRefs} — preserve ${plural} EXACTLY across all shots.`
    );
  }

  // (B) STORYBOARD-DRIVEN CORE — official DeepMind 18-word pattern (augmented)
  // When storyboard image is available, this is the PRIMARY mechanism for ordering.
  // When NOT available, fall back to per-shot timeline list.
  const sceneSettings = scene.settings?.trim();
  const sceneLighting = (scene as any).lightingHintEn?.trim();
  const styleAdj = getStyleAdjective((setting as any).animationStyle);

  if (storyboardSlot !== null) {
    // ---- WITH storyboard grid ----
    const settingParts: string[] = [];
    if (sceneSettings) settingParts.push(`set in ${asContinuation(sceneSettings)}`);
    if (sceneLighting) settingParts.push(`lit by ${asContinuation(sceneLighting)}`);
    const settingClause = settingParts.length > 0 ? `, ${settingParts.join(", ")}` : "";

    sentences.push(
      `Show this story in <image_${storyboardSlot}> — follow the visual progression exactly in order, starting top-left${settingClause}.`
    );

    // r7.34: per-cell explicit timestamps + lighting override (Tip #4 community github 293★)
    // "Use explicit durations and timestamps — 0–4s wide shot, 4–8s push-in, 8–12s close-up
    //  gives Omni a cut list to follow."
    // Lighting override ONLY when shot.lightingHintEn !== scene.lightingHintEn (avoid noise).
    const cellDescs: string[] = [];
    let cursorSeconds = 0;
    shots.forEach((shot, idx) => {
      const startSec = cursorSeconds;
      const endSec = cursorSeconds + (shot.durationSeconds || 5);
      cursorSeconds = endSec;
      const cameraEn = getEnglishTerm(shot.cameraMovement || "static");
      const action =
        (shot as any).actionEn?.trim() ||
        (shot as any).actionVi?.trim() ||
        "(action TBD)";
      const cameraPart = cameraEn === "static" ? "static" : cameraEn;
      // Lighting override: only inject if differs from scene global (avoid noise per DeepMind philosophy)
      const shotLighting = (shot as any).lightingHintEn?.trim();
      const lightingPart =
        shotLighting && shotLighting !== sceneLighting
          ? ` [lighting: ${asContinuation(shotLighting)}]`
          : "";
      cellDescs.push(`${idx + 1}) ${startSec}-${endSec}s: ${cameraPart}, ${asContinuation(action)}${lightingPart}.`);
    });
    if (cellDescs.length > 0) {
      sentences.push(`Cell-by-cell cut list:\n${cellDescs.join("\n")}`);
    }
  } else {
    // ---- WITHOUT storyboard grid: fallback timeline ----
    // Build compact per-shot list with cumulative timestamps (similar to r7.22 but more concise)
    const setupParts: string[] = [];
    if (sceneSettings) setupParts.push(`set in ${asContinuation(sceneSettings)}`);
    if (sceneLighting) setupParts.push(`lit by ${asContinuation(sceneLighting)}`);
    if (setupParts.length > 0) {
      sentences.push(`The scene unfolds ${setupParts.join(", ")}.`);
    }

    const shotDescs: string[] = [];
    let cursorSeconds = 0;
    shots.forEach((shot, idx) => {
      const startSec = cursorSeconds;
      const endSec = cursorSeconds + (shot.durationSeconds || 5);
      cursorSeconds = endSec;
      const cameraEn = getEnglishTerm(shot.cameraMovement || "static");
      const action =
        (shot as any).actionEn?.trim() ||
        (shot as any).actionVi?.trim() ||
        "(action TBD)";
      const cameraPart = cameraEn === "static" ? "static" : cameraEn;
      shotDescs.push(`shot ${idx + 1} (${startSec}-${endSec}s, ${cameraPart}): ${asContinuation(action)}`);
    });
    if (shotDescs.length > 0) {
      sentences.push(`Sequence: ${shotDescs.join("; ")}.`);
    }
  }

  // (C) AUDIO CUES — per-shot audio direction, gộp inline (nếu có)
  const audioCues = shots
    .map((s, idx) => {
      const audio = (s as any).audioDirection?.trim();
      return audio ? `shot ${idx + 1}: ${audio}` : null;
    })
    .filter((s): s is string => s !== null);
  if (audioCues.length > 0) {
    sentences.push(`Audio cues — ${audioCues.join("; ")}.`);
  }

  // (D) CLOSING — total duration + style (per DeepMind official 18-word example:
  //     "Entire story in 10 seconds. Cinematic")
  const styleSuffix = styleAdj.charAt(0).toUpperCase() + styleAdj.slice(1);
  sentences.push(`Entire story in ${totalDurationSeconds} seconds. ${styleSuffix}.`);

  const promptText = sentences.join("\n\n");

  return {
    promptText,
    references,
    totalDurationSeconds,
  };
}

/**
 * Format reference manifest for human reading (README header).
 * Unchanged from r7.22 — UI relies on this signature.
 */
export function formatMultiShotReferenceManifest(
  references: OmniMultiShotReferenceSpec[]
): string {
  if (references.length === 0) return "No reference images required.";
  return references
    .map((r) => `  <image_${r.slot}> — ${r.filename}: ${r.description}`)
    .join("\n");
}
