/**
 * Character Sheet Prompt Builder.
 *
 * Generates a prompt string that the user copies and pastes into ChatGPT,
 * Banana Pro, Imagen, Midjourney, etc. to produce a character reference sheet
 * image. The generated sheet is then uploaded back into the extension as the
 * character's conceptSheet.
 *
 * Workflow:
 * 1. User fills name + role + brief description
 * 2. User clicks "AI Concept Prompt" → modal shows generated prompt + Copy button
 * 3. User pastes into external AI image generator
 * 4. User downloads the generated sheet → uploads to extension
 *
 * Why prompt-only (not direct API call):
 * - Banana Pro / Imagen / Midjourney quality > Gemini multimodal for character sheets
 * - User can iterate the prompt in their preferred tool
 * - No multimodal Gemini dependency (works when only OpenAI key is present)
 */

import type { FilmCharacter, FilmCharacterRole } from "../types/film";
import type { ProjectSettingV2 } from "../types/project";

/**
 * Detect the likely entity type from the character's description.
 * Used to tune the prompt — robots get "model name" + "data core" annotations,
 * animals get "species traits", humans get "wardrobe" notes, etc.
 *
 * Heuristic: keyword match on description (Vietnamese + English).
 * Falls back to "creature" (neutral) when no signal.
 */
export type EntityType = "robot" | "animal" | "human" | "creature";

export function detectEntityType(description: string): EntityType {
  const lower = description.toLowerCase();

  // Robot/mecha keywords
  const robotKeywords = [
    "robot", "android", "mecha", "cyborg", "ai",
    "rô-bốt", "rô bốt", "máy", "kim loại", "vỏ thép",
    "circuit", "servo", "synthetic", "artificial",
  ];
  // Animal keywords
  const animalKeywords = [
    "gấu", "chó", "mèo", "chim", "thỏ", "cáo", "sóc", "voi", "hổ",
    "sư tử", "khỉ", "lợn", "heo", "trâu", "bò", "ngựa", "cừu",
    "bear", "dog", "cat", "bird", "rabbit", "fox", "squirrel", "elephant",
    "tiger", "lion", "monkey", "pig", "horse", "wolf", "deer",
    "animal", "creature", "beast", "lông", "lông thú", "móng vuốt",
  ];
  // Human keywords
  const humanKeywords = [
    "người", "cô gái", "chàng trai", "phụ nữ", "đàn ông", "em bé", "trẻ em",
    "ông", "bà", "cụ", "anh", "chị", "em",
    "human", "man", "woman", "girl", "boy", "child", "baby", "elder",
    "warrior", "soldier", "priest", "merchant", "queen", "king",
  ];

  for (const kw of robotKeywords) if (lower.includes(kw)) return "robot";
  for (const kw of animalKeywords) if (lower.includes(kw)) return "animal";
  for (const kw of humanKeywords) if (lower.includes(kw)) return "human";
  return "creature";
}

/**
 * Map project animation style → cinematic render style descriptor.
 */
function renderStyleFor(animationStyle: string | undefined): string {
  switch (animationStyle) {
    case "live_action":
      return "photorealistic live-action cinema, natural lighting";
    case "anime":
      return "anime illustration style, clean line art, vibrant cel-shading";
    case "pixar":
    case "3d_animation":
      return "Pixar/3D animated film style, soft global illumination, expressive";
    case "3d_render":
      return "3D rendered, octane-style realism, detailed materials";
    case "stop_motion":
      return "stop-motion craft style, handmade tactile materials";
    case "watercolor":
      return "watercolor illustration, soft washes, paper texture";
    case "comic":
    case "graphic_novel":
      return "graphic novel illustration, inked line art, painterly color";
    default:
      return "cinematic concept art, professional character design";
  }
}

/**
 * Per-entity prompt blocks. Each adds extra annotations that match the
 * archetype (robots get model numbers + data core, humans get wardrobe, etc.).
 */
const ENTITY_BLOCKS: Record<EntityType, string> = {
  robot: `Additional visual study panels (purely visual, no text/labels/numbers):
- Optical/sensor close-up (head detail panel)
- Hand or limb mechanism close-up (joint detail panel)
- Faded emblem or insignia shape (if mentioned in description, draw only the shape — no letters)
- Color palette swatches (5 sampled color squares from the design — pure colors, no hex codes)

Include subtle weathering/aging if hinted in description (rust patches, moss overgrowth, dust, scratches).`,

  animal: `Additional visual study panels (purely visual, no text/labels):
- Species traits panel (distinguishing features close-up)
- Expression studies (3 small head sketches: calm / alert / playful or similar)
- Fur/scale/feather texture close-up
- Color palette swatches (5 sampled color squares from the design)

Show the animal in a natural neutral stance — not action-pose, not anthropomorphized unless description specifies.`,

  human: `Additional visual study panels (purely visual, no text/labels):
- Wardrobe detail close-up (one signature garment or accessory)
- Hand or pose study (gesture detail panel)
- Face/expression study (3 small head sketches with subtle emotion variations)
- Color palette swatches (5 sampled color squares from the design — clothing + skin + hair)

Render the character in neutral standing pose, fully visible head-to-toe, hands relaxed.`,

  creature: `Additional visual study panels (purely visual, no text/labels):
- Distinguishing feature close-up (the most memorable physical trait)
- Scale reference (small silhouette next to a known object for size context, optional)
- Texture/surface close-up
- Color palette swatches (5 sampled color squares from the design)`,
};

export interface BuildCharacterSheetPromptInput {
  character: Pick<FilmCharacter, "name" | "role" | "description">;
  /** Project idea text (provides story context for the AI image generator) */
  ideaText?: string;
  setting: Pick<ProjectSettingV2, "animationStyle" | "genre" | "aspectRatio">;
  /** Optional entity type override — when omitted, auto-detected from description. */
  entityTypeOverride?: EntityType;
}

/**
 * Build a copy-pasteable prompt for external AI image generators.
 * Output is plain English (Banana Pro / Imagen / Midjourney all parse English well).
 */
export function buildCharacterSheetPrompt(input: BuildCharacterSheetPromptInput): string {
  const { character, ideaText, setting, entityTypeOverride } = input;
  const entityType = entityTypeOverride ?? detectEntityType(character.description || "");
  const renderStyle = renderStyleFor(setting.animationStyle);
  const entityBlock = ENTITY_BLOCKS[entityType];

  const roleLabel = ROLE_LABEL_EN[character.role] || character.role;
  const charName = character.name?.trim() || "Unnamed character";
  const desc = character.description?.trim() || "(no description provided)";

  // Aspect — sheets are landscape (16:9 or 21:9) for multi-view layout
  const sheetAspect = "16:9 horizontal";

  const storyContext = ideaText?.trim()
    ? `\n\nStory context (for tonal reference only — do not depict story scenes):\n"${ideaText.trim().slice(0, 400)}"`
    : "";

  return `CHARACTER REFERENCE SHEET — generate a single high-detail image.

Subject: ${charName} (${roleLabel})
Description: ${desc}${storyContext}

Layout: Single ${sheetAspect} composition on a clean white/cream background. Multiple views of the same character arranged as a professional concept art sheet:

PRIMARY VIEWS (top row, large):
- FRONT VIEW — fully visible head-to-toe, neutral standing pose
- 3/4 RIGHT VIEW — same character, same scale, same lighting
- 3/4 LEFT VIEW — same character, same scale, same lighting

SUPPORTING DETAILS (bottom row, smaller):
- BACK VIEW
${entityBlock}

Style: ${renderStyle}. ${setting.genre ? `Genre: ${setting.genre}. ` : ""}Composition feels like a film production design document — clean, informative, no dramatic background.

CRITICAL consistency rules:
- Same character in ALL views (identical proportions, materials, color, accessories)
- Same lighting direction across all views (soft, even, no harsh shadows)
- Neutral expression in primary views (no laughing, screaming, action)
- Background: pure white or very light cream, NO scene, NO landscape
- Aspect ratio: ${sheetAspect}
- ABSOLUTELY NO TEXT, NO LETTERS, NO LABELS, NO ANNOTATIONS, NO WATERMARKS, NO LOGOS, NO CAPTIONS, NO UI ELEMENTS, NO NUMBERS anywhere in the image. Pure visual artwork only — no written language of any kind, in any script (Latin, Cyrillic, Arabic, Chinese, etc.). If you would add a label, omit it.
- The character must look like a single coherent design, not 3 different interpretations

Goal: this image will be uploaded as a reference into a Storyboard generation pipeline. Visual consistency is the highest priority — every frame later will copy details from this sheet.`;
}

// Role labels for English prompt output
const ROLE_LABEL_EN: Record<FilmCharacterRole, string> = {
  protagonist: "Protagonist / main character",
  antagonist: "Antagonist",
  companion: "Companion / supporting character",
  extra: "Extra / background role",
};
