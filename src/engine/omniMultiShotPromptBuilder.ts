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
import { planOmniChunks, buildChunkSeparator } from "./omniChunkPlanner";
import type { OmniChunk } from "./omniChunkPlanner";

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
  /**
   * Full prompt text ready for clipboard. If chunkCount > 1, contains all
   * chunks joined with `=== CHUNK X of N (Ys) ===` separators so the user
   * can paste-and-split into N separate Gemini Omni sessions.
   */
  promptText: string;
  references: OmniMultiShotReferenceSpec[];
  totalDurationSeconds: number;
  /**
   * r7.39: number of ≤10s chunks the scene was split into. 1 = scene fits
   * in a single Omni clip (no chunking applied, output looks identical to
   * pre-r7.39 behaviour). >1 = scene exceeds Omni Flash's 10s cap and was
   * chunked along shot boundaries.
   */
  chunkCount: number;
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

  // -------- r7.39: PLAN CHUNKS (Omni Flash hard cap = 10s/clip) --------
  // Greedy pack along shot boundaries. If totalDurationSeconds ≤ 10, returns a
  // single chunk and downstream output is identical to pre-r7.39 (no separator,
  // no "CHUNK 1 of 1" header) — backward compat guaranteed.
  const chunks = planOmniChunks(shots);

  // Common context shared across all chunks (identity + style + setting).
  const sceneSettings = scene.settings?.trim();
  const sceneLighting = (scene as any).lightingHintEn?.trim();
  const styleAdj = getStyleAdjective((setting as any).animationStyle);
  const styleSuffix = styleAdj.charAt(0).toUpperCase() + styleAdj.slice(1);

  // Build identity-anchor sentence ONCE (shared across chunks — repeated per
  // chunk because each chunk = separate Omni session with no shared context).
  let identityAnchor: string | null = null;
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
    identityAnchor = `${charNames} as shown in ${charRefs} — preserve ${plural} EXACTLY across all shots.`;
  }

  // Build single-chunk prompt text. Called once per chunk; the inter-chunk
  // separator + join happens in the main loop below.
  const buildChunkText = (chunk: OmniChunk): string => {
    const sentences: string[] = [];

    // (A) IDENTITY ANCHOR — repeat per chunk (each chunk = independent Omni run).
    if (identityAnchor) sentences.push(identityAnchor);

    // (B) STORYBOARD-DRIVEN CORE — official DeepMind pattern w/ per-cell timestamps.
    if (storyboardSlot !== null) {
      const settingParts: string[] = [];
      if (sceneSettings) settingParts.push(`set in ${asContinuation(sceneSettings)}`);
      if (sceneLighting) settingParts.push(`lit by ${asContinuation(sceneLighting)}`);
      const settingClause = settingParts.length > 0 ? `, ${settingParts.join(", ")}` : "";

      sentences.push(
        `Show this story in <image_${storyboardSlot}> — follow the visual progression exactly in order, starting top-left${settingClause}.`
      );

      // r7.34: per-cell explicit timestamps (Tip #4 community github 293★).
      // r7.39: timestamps RESET to 0 per chunk because each chunk is a separate
      // Omni clip starting at 0s. Shot numbering stays GLOBAL (no reset) so the
      // user can map shot N in clipboard back to shot N in the storyboard grid.
      const cellDescs: string[] = [];
      let cursorSeconds = 0;
      chunk.shots.forEach((shot, localIdx) => {
        const globalShotNum = chunk.globalStartShotNumber + localIdx;
        const startSec = cursorSeconds;
        const endSec = cursorSeconds + (shot.durationSeconds || 5);
        cursorSeconds = endSec;
        const cameraEn = getEnglishTerm(shot.cameraMovement || "static");
        const action =
          (shot as any).actionEn?.trim() ||
          (shot as any).actionVi?.trim() ||
          "(action TBD)";
        const cameraPart = cameraEn === "static" ? "static" : cameraEn;
        // Lighting override: only when shot differs from scene global (avoid noise).
        const shotLighting = (shot as any).lightingHintEn?.trim();
        const lightingPart =
          shotLighting && shotLighting !== sceneLighting
            ? ` [lighting: ${asContinuation(shotLighting)}]`
            : "";
        cellDescs.push(`${globalShotNum}) ${startSec}-${endSec}s: ${cameraPart}, ${asContinuation(action)}${lightingPart}.`);
      });
      if (cellDescs.length > 0) {
        sentences.push(`Cell-by-cell cut list:\n${cellDescs.join("\n")}`);
      }
    } else {
      // ---- WITHOUT storyboard grid: fallback timeline (per-chunk) ----
      const setupParts: string[] = [];
      if (sceneSettings) setupParts.push(`set in ${asContinuation(sceneSettings)}`);
      if (sceneLighting) setupParts.push(`lit by ${asContinuation(sceneLighting)}`);
      if (setupParts.length > 0) {
        sentences.push(`The scene unfolds ${setupParts.join(", ")}.`);
      }

      const shotDescs: string[] = [];
      let cursorSeconds = 0;
      chunk.shots.forEach((shot, localIdx) => {
        const globalShotNum = chunk.globalStartShotNumber + localIdx;
        const startSec = cursorSeconds;
        const endSec = cursorSeconds + (shot.durationSeconds || 5);
        cursorSeconds = endSec;
        const cameraEn = getEnglishTerm(shot.cameraMovement || "static");
        const action =
          (shot as any).actionEn?.trim() ||
          (shot as any).actionVi?.trim() ||
          "(action TBD)";
        const cameraPart = cameraEn === "static" ? "static" : cameraEn;
        shotDescs.push(`shot ${globalShotNum} (${startSec}-${endSec}s, ${cameraPart}): ${asContinuation(action)}`);
      });
      if (shotDescs.length > 0) {
        sentences.push(`Sequence: ${shotDescs.join("; ")}.`);
      }
    }

    // (C) AUDIO CUES — only those belonging to shots in THIS chunk.
    const audioCues = chunk.shots
      .map((s, localIdx) => {
        const globalShotNum = chunk.globalStartShotNumber + localIdx;
        const audio = (s as any).audioDirection?.trim();
        return audio ? `shot ${globalShotNum}: ${audio}` : null;
      })
      .filter((s): s is string => s !== null);
    if (audioCues.length > 0) {
      sentences.push(`Audio cues — ${audioCues.join("; ")}.`);
    }

    // (D) CLOSING — chunk duration (NOT scene total), per DeepMind 18-word pattern.
    sentences.push(`Entire story in ${chunk.durationSeconds} seconds. ${styleSuffix}.`);

    return sentences.join("\n\n");
  };

  // -------- ASSEMBLE final clipboard text --------
  let promptText: string;
  if (chunks.length <= 1) {
    // Single chunk path: no separator, no chunk header — output identical to
    // pre-r7.39 when scene already fits in 10s.
    promptText = chunks.length === 1 ? buildChunkText(chunks[0]) : "";
  } else {
    // Multi-chunk path: prepend each chunk text with its separator, join with
    // a blank line + separator between blocks. Visible to user; teaches the
    // user to paste each chunk into a separate Omni session.
    promptText = chunks
      .map((chunk) => `${buildChunkSeparator(chunk)}\n\n${buildChunkText(chunk)}`)
      .join("\n\n");
  }

  return {
    promptText,
    references,
    totalDurationSeconds,
    chunkCount: chunks.length,
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
