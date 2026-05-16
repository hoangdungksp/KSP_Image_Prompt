/**
 * KSP Image qc8 — Film Cast Generation Engine
 *
 * Two AI operations:
 *  1. generateCharacterDescription() — text gen via Gemini Flash / OpenAI 4o
 *     Context-aware: reads idea + script (if available) for rich description.
 *  2. generateCharacterRefImage() — image gen via Imagen 4 Standard
 *     For a specific angle (face: front / 3/4 L / 3/4 R / profile, or body: front / side / back).
 *
 * Both functions return promises with structured output ready to save into FilmCharacter schema.
 */

import { callAi, type FilmScriptProvider } from "./filmScriptStages";
import { generateImage } from "./imagenApi";
import type { FilmCharacter, FilmImageRef } from "../types/film";
import type { ProjectSettingV2, FilmScript } from "../types/project";
import { createFilmImageRef } from "../types/film";

// ============================================================================
// CHARACTER DESCRIPTION GENERATION (Hướng B — context-aware)
// ============================================================================

export interface GenerateDescriptionInput {
  character: FilmCharacter;
  idea: string;
  /** If script exists, AI extracts character context for richer description */
  script?: FilmScript;
  setting: ProjectSettingV2;
  provider?: FilmScriptProvider;
}

const ROLE_VN: Record<FilmCharacter["role"], string> = {
  protagonist: "Nhân vật chính",
  antagonist: "Phản diện",
  companion: "Bạn đồng hành",
  extra: "Phụ",
};

/**
 * Generate a detailed VN visual description for a character.
 * Returns ~150-300 words plain text (no JSON wrapper).
 *
 * qc13 fix: Pass FULL script context (title + logline + 5 first scenes) to AI
 * to anchor character description in the actual story. Previously a filter
 * tried to match character name against EN action lines, which failed for
 * Vietnamese names ("Sóc" vs "squirrel") → AI fell back to generic
 * hallucinations (e.g. "robot") regardless of actual story.
 */
export async function generateCharacterDescription(
  input: GenerateDescriptionInput
): Promise<string> {
  const { character, idea, script, setting, provider = "gemini-flash" } = input;
  const charName = character.name.trim() || `Character ${character.order}`;

  // qc13: Always inject script context if script exists — no filtering.
  // Include title + logline + first 5 scenes so AI understands the actual story
  // setting and other characters, even if this character isn't yet named in scenes.
  let scriptContext = "";
  if (script && script.scenes.length > 0) {
    const scriptTitle = (script as any).titleVi || script.titleEn || "(untitled)";
    const scriptLogline = (script as any).loglineVi || script.logline || "";
    const scenesSummary = script.scenes
      .slice(0, 5)
      .map((s) => {
        const sceneTitle = s.titleVi || s.titleEn;
        const sceneAction = (s as any).actionLinesVi || s.actionLinesEn || "";
        return `Scene ${s.order}: ${sceneTitle}\n  Setting: ${s.settings}\n  Action: ${sceneAction.slice(0, 200)}`;
      })
      .join("\n\n");

    scriptContext = `

FULL STORY CONTEXT (đây là phim character này tham gia — anchor description theo bối cảnh này, KHÔNG bịa nhân vật khác):
TITLE: ${scriptTitle}
LOGLINE: ${scriptLogline}

SCENES (first ${Math.min(5, script.scenes.length)} of ${script.scenes.length} total):
${scenesSummary}`;
  }

  const systemPrompt = `Bạn là character designer cho phim ${setting.genre ?? "drama"} (${setting.animationStyle ?? "live_action"}). Viết mô tả VISUAL chi tiết cho nhân vật, phục vụ cho việc generate face refs + body refs bằng Imagen 4. Mô tả phải:
- Bằng TIẾNG VIỆT, ngắn gọn ~150-250 từ
- Tập trung VISUAL: ngoại hình, tuổi, trang phục, biểu cảm, đặc điểm distinctive
- Cụ thể (không generic): màu tóc, kiểu tóc, màu da, dáng người, phong cách trang phục
- KHÔNG đề cập câu chuyện / plot — chỉ visual properties
- KHÔNG dùng markdown / bullet — viết liền 1-2 đoạn prose

🚨 QUAN TRỌNG: Nếu user cung cấp STORY CONTEXT bên dưới, character phải PHÙ HỢP với bối cảnh đó (vd: nếu story về "Chú Sóc Lạc Lõng" trong rừng tuyết → character là sóc thật, không bịa "robot" / "human"). KHÔNG hallucinate visual không phù hợp với genre + setting + story context. Nếu character là động vật (sóc, chim, chó...) → mô tả ngoại hình động vật đó, KHÔNG mô tả như con người.

Reply with PLAIN TEXT (không JSON, không markdown fences).`;

  const userPrompt = `IDEA: ${idea}

CHARACTER:
- Name: ${charName}
- Role: ${ROLE_VN[character.role]}
${character.description ? `- Existing description: ${character.description}` : ""}
${scriptContext}

GENRE: ${setting.genre ?? "drama"}
ANIMATION STYLE: ${setting.animationStyle ?? "live_action"}

Generate visual description in Vietnamese for this character.`;

  const raw = await callAi(provider, systemPrompt, userPrompt);
  // Strip any accidental markdown / JSON wrapping
  const cleaned = raw
    .replace(/```\w*\s*/g, "")
    .replace(/```/g, "")
    .replace(/^["']|["']$/g, "")
    .trim();

  if (cleaned.length < 20) {
    throw new Error(`AI returned too-short description (${cleaned.length} chars). Try regen.`);
  }

  return cleaned;
}

// ============================================================================
// CHARACTER REF IMAGE GENERATION (Imagen 4 Standard)
// ============================================================================

export type RefKind = "face" | "body";

/** Angle descriptors for image prompts */
const ANGLE_PROMPT_EN: Record<string, string> = {
  // Face refs (4 angles)
  front: "front-facing portrait, looking directly at camera",
  "3/4 L": "three-quarter view from the left side, head turned slightly to the right",
  "3/4 R": "three-quarter view from the right side, head turned slightly to the left",
  profile: "side profile view, head turned 90 degrees to one side",
  // Body refs (3 angles)
  // 'front' shared above
  side: "full-body side view, standing pose, profile orientation",
  back: "full-body back view, character facing away from camera",
};

export interface GenerateRefImageInput {
  character: FilmCharacter;
  kind: RefKind;
  /** Angle label, e.g. "front" / "3/4 L" / "profile" / "side" / "back" */
  angle: string;
  setting: ProjectSettingV2;
  /** Use Imagen 4 Fast (~50% cheaper) instead of Standard */
  fast?: boolean;
}

/**
 * Generate ONE ref image for a character at a specific angle.
 * Uses Imagen 4 Standard (default) — $0.04/image.
 *
 * Returns a complete FilmImageRef ready to push to character.faceRefs[] / bodyRefs[].
 */
export async function generateCharacterRefImage(
  input: GenerateRefImageInput
): Promise<FilmImageRef> {
  const { character, kind, angle, setting, fast = false } = input;
  const angleDirection = ANGLE_PROMPT_EN[angle] ?? `${angle} view`;

  // Build descriptive prompt for Imagen 4
  const charName = character.name.trim() || `Character ${character.order}`;
  const desc = character.description.trim() || "no detailed description provided";
  const animationStyle = setting.animationStyle ?? "live_action";
  const styleHint =
    animationStyle === "anime_2d"
      ? "anime art style, 2D illustration"
      : animationStyle === "cgi_3d_cinematic"
      ? "3D CGI cinematic render, photorealistic shading"
      : animationStyle === "film_noir"
      ? "black and white film noir, high contrast lighting"
      : "live action photography, natural lighting, photorealistic";

  // Scope: face refs are headshots, body refs are full-body
  const scopeHint =
    kind === "face"
      ? "headshot reference photo, head and shoulders framing, neutral expression"
      : "full-body reference photo, full figure visible head to toe, neutral pose";

  const prompt = `${scopeHint} of ${charName}. Character description: ${desc}. View angle: ${angleDirection}. Studio quality reference image, neutral grey backdrop, soft even lighting, sharp focus, high detail, character reference sheet style. ${styleHint}. No text, no watermarks, no graphics overlay.`;

  // Aspect ratio: face refs = 1:1 (square portrait), body refs = 3:4 (tall portrait)
  const aspectRatio: "1:1" | "3:4" = kind === "face" ? "1:1" : "3:4";

  const results = await generateImage({
    prompt,
    variations: 1,
    aspectRatio,
    fast,
  });

  if (results.length === 0 || !results[0].base64) {
    throw new Error("Imagen 4 returned empty result. Prompt có thể bị filter.");
  }

  const dataUrl = `data:image/png;base64,${results[0].base64}`;
  const filename = `${charName.replace(/\s+/g, "_").toLowerCase()}_${kind}_${angle.replace(/\s+/g, "_").replace(/\//g, "")}.png`;

  // Estimate dimensions (Imagen 4 default = 1024×1024 for 1:1, 768×1024 for 3:4)
  const width = aspectRatio === "1:1" ? 1024 : 768;
  const height = aspectRatio === "1:1" ? 1024 : 1024;

  return createFilmImageRef(filename, "image/png", dataUrl, angle, width, height);
}

// ============================================================================
// MISSING SLOT DETECTION
// ============================================================================

/**
 * Given existing refs + ordered label list, find the FIRST label that isn't filled yet.
 * Returns undefined if all slots filled.
 *
 * Example: refs labeled ["front", "3/4 L"], labels = ["front", "3/4 L", "3/4 R", "profile"]
 *   → returns "3/4 R" (first missing)
 */
export function findNextMissingLabel(
  filledRefs: FilmImageRef[],
  labelOrder: readonly string[]
): string | undefined {
  const filled = new Set(filledRefs.map((r) => r.label).filter((l): l is string => !!l));
  return labelOrder.find((label) => !filled.has(label));
}
