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
  promptText: string;
  references: OmniDeepMindPureReferenceSpec[];
  totalDurationSeconds: number;
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

  // -------- BUILD prompt — DeepMind strict pattern --------
  const sentences: string[] = [];
  const styleAdj = getStyleAdjective((setting as any).animationStyle);

  // (A) IDENTITY ANCHOR — per DeepMind Pattern "Keep your scene consistent"
  // "Want to keep a character... Add a reference – Gemini Omni will use it across your scene."
  // KSP add this clause minimally (1 sentence) to lock identity.
  if (presentChars.length > 0 && presentChars.length === references.filter(r => !r.filename.includes("storyboard")).length) {
    const charRefs = presentChars
      .map((_, i) => `<image_${i}>`)
      .join(", ");
    const charNames = presentChars.map((c) => c.name).join(" and ");
    const plural = presentChars.length > 1 ? "faces, hair, and wardrobes" : "face, hair, and wardrobe";
    sentences.push(
      `${charNames} as shown in ${charRefs}. Preserve ${plural} exactly across the video.`
    );
  }

  // (B) STORYBOARD-DRIVEN CORE — DeepMind official 18-word pattern
  if (storyboardSlot !== null) {
    sentences.push(
      `Show me in this story shown in <image_${storyboardSlot}>. Follow the story exactly in order starting top-left. Entire story in ${totalDurationSeconds} seconds. ${styleAdj}.`
    );
  } else {
    // ---- WITHOUT storyboard grid: skeleton fallback ----
    // DeepMind has no specific pattern for "no storyboard" — use minimal scene description.
    const sceneSettings = scene.settings?.trim();
    if (sceneSettings) {
      sentences.push(`A ${styleAdj.toLowerCase()} scene set in ${sceneSettings}, ${totalDurationSeconds} seconds.`);
    } else {
      sentences.push(`A ${styleAdj.toLowerCase()} scene, ${totalDurationSeconds} seconds.`);
    }
  }

  const promptText = sentences.join("\n\n");

  return {
    promptText,
    references,
    totalDurationSeconds,
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
