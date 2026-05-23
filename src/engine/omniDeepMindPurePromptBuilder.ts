/**
 * KSP Image — Gemini Omni DeepMind Pure prompt builder (r7.34)
 *
 * STRICT interpretation của DeepMind official guide:
 *   https://deepmind.google/models/gemini-omni/prompt-guide/?tab=3-reference-anything
 *
 * Official 18-word example (Pattern "Add a storyboard"):
 *   "Show me in this story. Follow the story exactly in order starting top left.
 *    Entire story in 10 seconds. Cinematic"
 *
 * Plus Pattern "Keep your scene consistent":
 *   "Want to keep a character, object, or environment consistent? Add a reference
 *    – from real-life or created through Nano Banana – and Gemini Omni will use it
 *    across your scene."
 *
 * PHILOSOPHY (DeepMind):
 *   "With Veo, you need to share precise instructions. But with Gemini Omni,
 *    you don't have to be as prescriptive — tell Omni what you want, and watch
 *    the model's reasoning and world knowledge bring the details to life."
 *
 * KSP Strict interpretation:
 *   - NO per-cell descriptions (Omni reads grid PNG to derive timeline)
 *   - NO camera movement vocab per cell (Omni infers from composition)
 *   - NO audio cues per shot (DeepMind audio = global mood, not per-cell)
 *   - NO timestamps per cell (Omni distributes time across cells)
 *   - NO lighting hints (visible in grid)
 *   - YES identity anchor with <image_N> refs (DeepMind has explicit pattern for this)
 *   - YES storyboard reference statement
 *   - YES total duration + style suffix (per 18-word example)
 *
 * Trade-off: ~32 từ vs ~600-1200 chars của KSP Hybrid.
 * Use case: A/B compare to test if DeepMind philosophy holds for KSP storyboard quality.
 *
 * Function signature CÙNG SHAPE với omniMultiShotPromptBuilder để parent code dùng chung
 * pattern (chỉ swap function name).
 */

import type { FilmShot, FilmSceneScript, ProjectSettingV2 } from "../types/project";
import type { FilmCharacter } from "../types/film";
import { planOmniChunks, buildChunkSeparator } from "./omniChunkPlanner";
import type { OmniChunk } from "./omniChunkPlanner";

export interface BuildOmniDeepMindPurePromptInput {
  scene: FilmSceneScript;
  shots: FilmShot[];
  cast: FilmCharacter[];
  setting: ProjectSettingV2;
  /** Whether a merged storyboard grid PNG is available — affects prompt strategy */
  hasStoryboardImage?: boolean;
}

export interface OmniDeepMindPureReferenceSpec {
  slot: number;
  filename: string;
  description: string;
  dataUrl?: string;
}

export interface OmniDeepMindPureResult {
  /**
   * Full clipboard text. If chunkCount > 1, contains `=== CHUNK X of N (Ys) ===`
   * separators between independent ≤10s prompts.
   */
  promptText: string;
  references: OmniDeepMindPureReferenceSpec[];
  totalDurationSeconds: number;
  /**
   * r7.39: 1 if scene fits in single Omni clip; >1 if scene was chunked
   * along shot boundaries to respect Omni Flash's 10s cap.
   */
  chunkCount: number;
}

// Style adjective mapping — same as omniMultiShotPromptBuilder for consistency.
const STYLE_ADJ: Record<string, string> = {
  live_action: "Cinematic",
  cgi_3d_cinematic: "Pixar-style 3D cinematic",
  anime_2d: "Studio Ghibli-style anime",
  cartoon_2d: "Stylised 2D cartoon",
  stop_motion: "Claymation stop-motion",
  film_noir: "Noir black-and-white cinematic",
  pixar_3d: "Pixar 3D animated",
  ghibli: "Studio Ghibli anime",
  anime: "Anime",
  comic_book: "Comic-book illustrated",
  watercolor: "Watercolour-painted",
  claymation: "Claymation stop-motion",
  noir: "Noir black-and-white",
  documentary: "Documentary photorealistic",
};

function getStyleAdjective(style?: string): string {
  if (!style) return "Cinematic";
  return STYLE_ADJ[style] ?? style.replace(/_/g, " ");
}

// ============================================================================
// MAIN BUILDER
// ============================================================================

export function buildOmniDeepMindPurePrompt(
  input: BuildOmniDeepMindPurePromptInput
): OmniDeepMindPureResult {
  const { scene, shots, cast, setting, hasStoryboardImage } = input;

  // -------- IDENTIFY characters across the scene --------
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
  const references: OmniDeepMindPureReferenceSpec[] = [];
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
      description: `Scene ${scene.order} storyboard grid (${shots.length} cells, ordered top-left to bottom-right)`,
      // dataUrl filled by caller from merged grid PNG
    });
    slot++;
  }

  // -------- COMPUTE total duration --------
  const totalDurationSeconds = shots.reduce((acc, s) => acc + (s.durationSeconds || 5), 0);

  // -------- r7.39: PLAN CHUNKS (Omni Flash hard cap = 10s/clip) --------
  // Strict DeepMind philosophy means each chunk gets the same 18-word minimal
  // prompt with its own duration — no per-cell elaboration even when chunked.
  const chunks = planOmniChunks(shots);

  const styleAdj = getStyleAdjective((setting as any).animationStyle);
  const sceneSettings = scene.settings?.trim();

  // Build the identity-anchor sentence once (reused per chunk).
  let identityAnchor: string | null = null;
  if (presentChars.length > 0 && presentChars.length === references.filter(r => !r.filename.includes("storyboard")).length) {
    const charRefs = presentChars
      .map((_, i) => `<image_${i}>`)
      .join(", ");
    const charNames = presentChars.map((c) => c.name).join(" and ");
    const plural = presentChars.length > 1 ? "faces, hair, and wardrobes" : "face, hair, and wardrobe";
    identityAnchor = `${charNames} as shown in ${charRefs}. Preserve ${plural} exactly across the video.`;
  }

  // Build single-chunk prompt text (DeepMind strict — minimal per chunk).
  const buildChunkText = (chunk: OmniChunk): string => {
    const sentences: string[] = [];

    // (A) IDENTITY ANCHOR — repeat per chunk (independent Omni runs).
    if (identityAnchor) sentences.push(identityAnchor);

    // (B) STORYBOARD-DRIVEN CORE — DeepMind 18-word pattern, per-chunk duration.
    if (storyboardSlot !== null) {
      sentences.push(
        `Show me in this story shown in <image_${storyboardSlot}>. Follow the story exactly in order starting top-left. Entire story in ${chunk.durationSeconds} seconds. ${styleAdj}.`
      );
    } else {
      // No storyboard fallback — minimal scene description with chunk duration.
      if (sceneSettings) {
        sentences.push(`A ${styleAdj.toLowerCase()} scene set in ${sceneSettings}, ${chunk.durationSeconds} seconds.`);
      } else {
        sentences.push(`A ${styleAdj.toLowerCase()} scene, ${chunk.durationSeconds} seconds.`);
      }
    }

    return sentences.join("\n\n");
  };

  // -------- ASSEMBLE final clipboard text --------
  let promptText: string;
  if (chunks.length <= 1) {
    promptText = chunks.length === 1 ? buildChunkText(chunks[0]) : "";
  } else {
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
 */
export function formatDeepMindPureReferenceManifest(
  references: OmniDeepMindPureReferenceSpec[]
): string {
  if (references.length === 0) return "No reference images required.";
  return references
    .map((r) => `  <image_${r.slot}> — ${r.filename}: ${r.description}`)
    .join("\n");
}
