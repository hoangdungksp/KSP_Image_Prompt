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

// ============================================================================
// Sprint G1d — Item 6: AI CAST PROMPT SET GENERATION
// ============================================================================

/**
 * Output of runGenerateCastPromptSet — 2 EN prompts (face/body) + anchor tokens
 * that must remain consistent across all shots involving this character.
 */
export interface CastPromptSet {
  /** EN photo prompt for face/head close-up ref (1:1 portrait, slot 0 = "front") */
  facePrompt: string;
  /** EN photo prompt for full-body ref (3:4 portrait, slot 0 = "front") */
  bodyPrompt: string;
  /** 3-7 short tokens that lock the character's appearance — used by user as a
   *  consistency checklist when picking generated images. */
  anchorTokens: string[];
}

export interface GenerateCastPromptSetInput {
  character: FilmCharacter;
  idea: string;
  script?: FilmScript;
  setting: ProjectSettingV2;
  provider?: FilmScriptProvider;
  /** When true AND character.faceRefs[0] exists, send the first face ref as a
   *  multimodal input to Gemini so the output prompt is anchored on the actual
   *  uploaded image (not invented appearance). Falls back to text-only if no refs. */
  useFaceRefForMatch?: boolean;
}

const GEMINI_FLASH_MM_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

/**
 * Generate 2 EN photo prompts (face + body) + anchor tokens for a single character.
 *
 * Use case: user has Cast description in VI + has uploaded refs (or not). Click
 * "📝 Prompt" button → this engine assembles project context + character entry
 * → AI distills into 2 production-ready EN prompts. User copies → pastes into
 * Banana Pro / Imagen / Nano Banana → generates → uploads back into Face/Body refs.
 *
 * Hướng B (Q-ii confirmed): when useFaceRefForMatch=true AND refs exist, sends
 * the image to Gemini Flash multimodal so the AI describes the ACTUAL appearance
 * (no invention drift). When false or no refs: text-only AI call from description.
 */
export async function runGenerateCastPromptSet(
  input: GenerateCastPromptSetInput
): Promise<CastPromptSet> {
  const {
    character,
    idea,
    script,
    setting,
    provider = "gemini-flash",
    useFaceRefForMatch = true,
  } = input;
  const charName = character.name.trim() || `Character ${character.order}`;
  const animationStyle = setting.animationStyle ?? "live_action";

  // Style hint for prompt suffix (same mapping as generateCharacterRefImage)
  const styleHint =
    animationStyle === "anime_2d"
      ? "anime 2D character sheet art style, clean line work, soft cel shading"
      : animationStyle === "cgi_3d_cinematic"
      ? "Pixar 3D render style, cinematic lighting, soft global illumination, character sheet quality"
      : animationStyle === "film_noir"
      ? "black and white film noir reference photo, high-contrast Rembrandt lighting"
      : "photorealistic studio photography, soft cinematic lighting, character sheet quality";

  // Script context (max 3 scenes character appears in, fallback to first 3)
  let scriptContext = "";
  if (script && script.scenes.length > 0) {
    const charRegex = new RegExp(
      charName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i"
    );
    // Filter scenes where action lines OR dialog mention this character.
    const matchingScenes = script.scenes.filter((s) => {
      const action = ((s as any).actionLinesVi || s.actionLinesEn || "") as string;
      const dialogues = (s.dialog ?? []).map((d: any) => d.text ?? "").join(" ");
      return charRegex.test(action) || charRegex.test(dialogues);
    });
    const scenesToInclude = (matchingScenes.length > 0 ? matchingScenes : script.scenes).slice(0, 3);
    if (scenesToInclude.length > 0) {
      scriptContext = scenesToInclude
        .map((s) => {
          const action = ((s as any).actionLinesVi || s.actionLinesEn || "") as string;
          return `Scene ${s.order} (${s.titleVi || s.titleEn}): ${action.slice(0, 220)}`;
        })
        .join("\n");
    }
  }

  // Existing refs note (for AI to know user already has visual reference)
  const hasFaceRef = (character.faceRefs?.length ?? 0) > 0;
  const hasBodyRef = (character.bodyRefs?.length ?? 0) > 0;
  const refsNote =
    hasFaceRef || hasBodyRef
      ? `\n\n[USER HAS UPLOADED REFS: ${hasFaceRef ? character.faceRefs.length + " face" : ""}${
          hasFaceRef && hasBodyRef ? " + " : ""
        }${hasBodyRef ? character.bodyRefs.length + " body" : ""}]. ${
          useFaceRefForMatch && hasFaceRef
            ? "The first face ref is attached below — describe the ACTUAL appearance in that image. Do NOT invent new physical features. Anchor on what you can see."
            : "Match the established visual style — be conservative, do not invent contradictory details."
        }`
      : "";

  const systemPrompt = `You are a character designer for animation/cinema (Pixar / Disney / Studio Ghibli caliber). Your job: distill a character into 2 production-ready EN photo prompts ready to paste into Banana Pro / Nano Banana / Imagen 4 / Midjourney.

OUTPUT STRUCTURE — return ONLY valid JSON, no markdown fences:
{
  "anchorTokens": [3-7 short phrases that lock identity — e.g. "moss-covered grey-green metal body", "single glowing blue right sensor", "rust-streaked chest plates", "3.5m hulking humanoid"],
  "facePrompt": "Single-paragraph EN photo prompt for FACE REFERENCE (head + shoulders close-up, 1:1 portrait, neutral expression, front-facing, character sheet style). 200-350 chars. Include anchor tokens. End with style suffix.",
  "bodyPrompt": "Single-paragraph EN photo prompt for FULL BODY REFERENCE (full figure head to toe, 3:4 portrait, T-pose or neutral standing pose, front-facing). 250-400 chars. Include anchor tokens + body proportions + signature outfit/material. End with style suffix."
}

CRITICAL RULES:
- Anchor tokens are the CONSISTENCY LOCK — these features MUST appear identically in face and body prompts.
- Concrete visual details only: shape, color, material, distinguishing marks. NO plot, NO emotion narrative.
- Sentences not bullet points.
- Style suffix at end of each prompt: "${styleHint}".
- Neutral grey backdrop, soft cinematic lighting, sharp focus, no text/watermark.
- Animal characters → describe as the animal (fur color, body shape, ears, tail), NOT anthropomorphized human.
- If user provides existing refs, anchor on visible features — do NOT invent new appearance.

Return ONLY the JSON object, nothing before or after.`;

  const userPromptText = `IDEA: ${idea || "(no idea provided)"}

CHARACTER:
- Name: ${charName}
- Role: ${ROLE_VN[character.role]}
- Description (VI): ${character.description.trim() || "(no description yet — invent based on idea + role + animation style)"}

GENRE: ${setting.genre ?? "drama"}
ANIMATION STYLE: ${animationStyle}
${scriptContext ? `\nSCRIPT CONTEXT (${Math.min(3, script?.scenes.length ?? 0)} scenes character appears in):\n${scriptContext}` : ""}
${refsNote}

Generate the JSON object now.`;

  // Decide: multimodal or text-only?
  const useMultimodal = useFaceRefForMatch && hasFaceRef && !!character.faceRefs[0]?.dataUrl;

  let raw: string;
  if (useMultimodal && provider === "gemini-flash") {
    // Multimodal Gemini call: attach first face ref as inline_data
    raw = await callGeminiMultimodal({
      systemPrompt,
      userPromptText,
      imageDataUrl: character.faceRefs[0].dataUrl,
    });
  } else {
    // Text-only path: standard callAi
    raw = await callAi(provider, systemPrompt, userPromptText);
  }

  // Parse JSON (Gemini may wrap in markdown despite responseMimeType — be defensive)
  const cleaned = raw.replace(/```json\s*|\s*```/g, "").trim();
  let parsed: CastPromptSet;
  try {
    parsed = JSON.parse(cleaned) as CastPromptSet;
  } catch (err) {
    throw new Error(
      `AI returned invalid JSON for cast prompt: ${(err as Error).message}\n\nRaw (${cleaned.length} chars): ${cleaned.slice(0, 200)}...`
    );
  }
  if (!parsed.facePrompt || !parsed.bodyPrompt) {
    throw new Error(
      `AI response missing facePrompt or bodyPrompt fields. Got keys: ${Object.keys(parsed).join(", ")}`
    );
  }
  if (!Array.isArray(parsed.anchorTokens)) {
    parsed.anchorTokens = [];
  }
  return parsed;
}

/**
 * Lightweight multimodal Gemini Flash call: text + 1 inline image.
 * Reads gemini API key from global store. Returns raw response text (caller parses JSON).
 */
async function callGeminiMultimodal(input: {
  systemPrompt: string;
  userPromptText: string;
  imageDataUrl: string;
}): Promise<string> {
  const { systemPrompt, userPromptText, imageDataUrl } = input;
  const apiKeys = (await import("../store/useGlobalStore")).useGlobalStore.getState().apiKeys;
  // Parse dataUrl → { mimeType, base64 }
  const match = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Face ref dataUrl invalid format — không tách được mime/base64");
  }
  const mimeType = match[1] || "image/png";
  const base64 = match[2];

  let response: Response;
  try {
    response = await fetch(`${GEMINI_FLASH_MM_ENDPOINT}?key=${apiKeys.gemini}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: `${systemPrompt}\n\n${userPromptText}` },
              { inline_data: { mime_type: mimeType, data: base64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
        },
      }),
    });
  } catch (err) {
    throw new Error(`Network lỗi multimodal Gemini: ${(err as Error).message}`);
  }
  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 400)
      throw new Error(`Gemini multimodal request không hợp lệ (400): ${errText.slice(0, 150)}`);
    if (response.status === 403) throw new Error("Gemini key bị từ chối (403)");
    if (response.status === 429) throw new Error("Gemini rate limit (429)");
    throw new Error(`Gemini multimodal error (${response.status}): ${errText.slice(0, 200)}`);
  }
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  const finishReason = data.candidates?.[0]?.finishReason;
  if (!text) {
    if (finishReason === "SAFETY")
      throw new Error("Gemini từ chối multimodal do safety filter. Thử bỏ tick 'Match refs' và regen text-only.");
    throw new Error(`Gemini multimodal empty response (finishReason: ${finishReason ?? "unknown"})`);
  }
  return text;
}
