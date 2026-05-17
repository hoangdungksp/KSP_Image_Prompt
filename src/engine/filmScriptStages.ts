/**
 * KSP Image v0.9.3-r3 — Film Script Stages Engine
 *
 * Wrapper around existing `aiRuntime.generateFilmScript()` to bridge the new
 * Film v0.9.3 schema (FilmCharacter, FilmData) with the legacy ScriptWriterInput
 * (FilmCharacterV2 shape).
 *
 * r3 ships Stage 5 quick path (1-cú generation full script).
 * Multi-stage wizard (Stage 1-4: Structure → Beats → Twists → Scenes) lands in r7.
 *
 * Reference: MOCKUPS_FILM.md Q2 (Multi-stage 5 stages) + scriptWriter.ts existing.
 */

import { generateFilmScript } from "./aiRuntime";
import type { ScriptWriterInput } from "./ai_prompts/scriptWriter";
import type { FilmScript, FilmCharacterV2, CharacterRef, ProjectSettingV2, FilmSceneScript } from "../types/project";
import {
  type FilmCharacter,
  type FilmStoryFramework,
  type FilmScriptStructure,
  type FilmScriptBeat,
  type FilmScriptTwist,
  type FilmScriptIntermediateScene,
  FRAMEWORK_LABELS,
} from "../types/film";
import { useGlobalStore } from "../store/useGlobalStore";
import type { EmotionalTone } from "../types/project";
import { clampTension } from "../types/project";

/**
 * Sprint 1.0 r1 (Phase 1A): valid enum values for AI prompt + sanitizer.
 * Keep in sync with EMOTIONAL_TONE_LABELS in project.ts.
 */
const EMOTIONAL_TONE_VALUES: EmotionalTone[] = [
  "tender", "tense", "funny", "sad", "shocking", "triumphant", "neutral",
];

/**
 * Sanitize AI-returned tension level — clamp 0-10, default 0 if invalid.
 */
function sanitizeTension(v: any): number {
  if (typeof v !== "number" || isNaN(v)) return 0;
  return Math.max(0, Math.min(10, Math.round(v)));
}

/**
 * Sanitize AI-returned emotional tone — fallback to "neutral" if invalid.
 */
function sanitizeEmotion(v: any): EmotionalTone {
  if (typeof v === "string" && (EMOTIONAL_TONE_VALUES as string[]).includes(v)) {
    return v as EmotionalTone;
  }
  return "neutral";
}

export type FilmScriptProvider = "gemini-flash" | "openai-4o";

const GEMINI_FLASH_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

/**
 * Adapt new v0.9.3 FilmCharacter → legacy FilmCharacterV2 shape so existing
 * scriptWriter.ts prompts continue to work without rewrite.
 * AI uses cast for narrative context (name + description) — refs not consumed
 * by script writer, so we pass minimal shape.
 */
function adaptCharacter(c: FilmCharacter, hasDialog: boolean): FilmCharacterV2 {
  // Map new roles to legacy enum (legacy doesn't have "companion" — use "supporting")
  const legacyRole: FilmCharacterV2["role"] =
    c.role === "companion" ? "supporting" : (c.role as FilmCharacterV2["role"]);

  return {
    id: c.id,
    order: c.order,
    name: c.name || `Character ${c.order}`,
    role: legacyRole,
    description: c.description,
    uniqueIdentifiers: c.aiGenDescription ?? "",
    hasDialog,
    faceRefs: [] as CharacterRef[],
    bodyRefs: [] as CharacterRef[],
  };
}

// ============================================================================
// LOW-LEVEL: shared text generator for r7 stage prompts
// ============================================================================

/**
 * Resolve the effective provider, falling back to whichever API key is present.
 * qc9: If user's preferred provider has no key, auto-fallback to the other.
 * Returns the actual provider to use + a flag whether fallback happened.
 */
export function resolveProvider(preferred: FilmScriptProvider): {
  effective: FilmScriptProvider;
  didFallback: boolean;
  fallbackReason?: string;
} {
  const apiKeys = useGlobalStore.getState().apiKeys;
  const hasGemini = !!apiKeys.gemini;
  const hasOpenAI = !!apiKeys.openai;

  if (preferred === "gemini-flash" && hasGemini) {
    return { effective: "gemini-flash", didFallback: false };
  }
  if (preferred === "openai-4o" && hasOpenAI) {
    return { effective: "openai-4o", didFallback: false };
  }
  // Preferred provider missing key — try fallback
  if (hasGemini) {
    return {
      effective: "gemini-flash",
      didFallback: true,
      fallbackReason: `Provider "${preferred}" thiếu API key — auto-fallback Gemini Flash.`,
    };
  }
  if (hasOpenAI) {
    return {
      effective: "openai-4o",
      didFallback: true,
      fallbackReason: `Provider "${preferred}" thiếu API key — auto-fallback OpenAI 4o.`,
    };
  }
  // No keys at all
  throw new Error(
    "Chưa có API key nào (Gemini hoặc OpenAI). Vào Project Setting → API Keys để thêm ít nhất 1 key."
  );
}

/**
 * Shared text generation helper (exported for reuse in filmCastGeneration.ts).
 *
 * qc9 changes:
 * - Auto-fallback if preferred provider lacks API key (resolveProvider)
 * - maxOutputTokens raised 2048 → 8192 (Stage 4 was getting truncated mid-JSON)
 * - Detect truncated response (finishReason === MAX_TOKENS even if text non-empty)
 */
export async function callAi(
  provider: FilmScriptProvider,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  // qc9: Resolve effective provider — auto-fallback if preferred provider's key missing
  const { effective, didFallback, fallbackReason } = resolveProvider(provider);
  if (didFallback && fallbackReason) {
    console.warn("[KSP qc9 AI fallback]", fallbackReason);
  }

  const apiKeys = useGlobalStore.getState().apiKeys;

  if (effective === "openai-4o") {
    let response: Response;
    try {
      response = await fetch(OPENAI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKeys.openai}` },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 8192, // qc9: 2048 → 8192 (Stage 4 was truncated)
          temperature: 0.75,
          response_format: { type: "json_object" },
        }),
      });
    } catch (err) {
      throw new Error(`Network lỗi khi gọi OpenAI: ${(err as Error).message}`);
    }
    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 401) {
        throw new Error("OpenAI API key không hợp lệ. Vui lòng check lại trong Project Setting.");
      }
      if (response.status === 429) {
        throw new Error("OpenAI rate limit (429). Hãy thử lại sau vài giây.");
      }
      throw new Error(`OpenAI error (${response.status}): ${errText.slice(0, 200)}`);
    }
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    const finishReason = data.choices?.[0]?.finish_reason;
    if (!text) {
      throw new Error("OpenAI trả empty response. Hãy thử regen.");
    }
    // qc9: Detect truncation — finish_reason === "length" means hit max_tokens
    if (finishReason === "length") {
      throw new Error(
        "OpenAI response bị cắt do max_tokens. Thử giảm số scenes hoặc simplify idea/beats."
      );
    }
    return text;
  }

  // Gemini Flash
  let response: Response;
  try {
    response = await fetch(`${GEMINI_FLASH_ENDPOINT}?key=${apiKeys.gemini}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
        ],
        generationConfig: {
          temperature: 0.75,
          maxOutputTokens: 8192, // qc9: 2048 → 8192 (Stage 4 was truncated)
          responseMimeType: "application/json",
        },
      }),
    });
  } catch (err) {
    throw new Error(`Network lỗi khi gọi Gemini: ${(err as Error).message}`);
  }
  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 400) {
      throw new Error(`Gemini API key hoặc request không hợp lệ (400). Check key trong Project Setting.\n\nDetails: ${errText.slice(0, 150)}`);
    }
    if (response.status === 403) {
      throw new Error("Gemini API key bị từ chối (403). Key có thể đã expired hoặc thiếu permission.");
    }
    if (response.status === 429) {
      throw new Error("Gemini rate limit (429). Hãy thử lại sau vài giây.");
    }
    if (response.status === 503) {
      throw new Error("Gemini service tạm thời không khả dụng (503). Thử lại sau.");
    }
    throw new Error(`Gemini error (${response.status}): ${errText.slice(0, 200)}`);
  }
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  const finishReason = data.candidates?.[0]?.finishReason;
  if (!text) {
    if (finishReason === "SAFETY") {
      throw new Error("Gemini từ chối generate do safety filter. Thử đổi idea hoặc cast description.");
    }
    if (finishReason === "MAX_TOKENS") {
      throw new Error("Gemini hit max tokens. Thử simplify input.");
    }
    throw new Error(`Gemini trả empty response (finishReason: ${finishReason ?? "unknown"})`);
  }
  // qc9: Detect truncation even when text exists but JSON was cut mid-string
  if (finishReason === "MAX_TOKENS") {
    throw new Error(
      "Gemini response bị cắt do max tokens. Thử giảm số scenes hoặc simplify idea/beats."
    );
  }
  return text;
}

function parseJsonStrict<T>(raw: string): T {
  // Strip markdown fences if present
  const cleaned = raw.replace(/```json\s*|\s*```/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    // qc9: Detect truncation patterns for friendlier error message
    const isLikelyTruncated =
      cleaned.length > 1500 &&
      (!cleaned.trim().endsWith("}") && !cleaned.trim().endsWith("]"));
    const hint = isLikelyTruncated
      ? "\n\n💡 Response có vẻ bị cắt giữa chừng. Thử giảm số scenes hoặc simplify idea."
      : "";
    throw new Error(
      `AI returned invalid JSON: ${(err as Error).message}${hint}\n\nRaw (${cleaned.length} chars): ${cleaned.slice(0, 200)}...`
    );
  }
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// ============================================================================
// STAGE 1 — STRUCTURE
// ============================================================================

export interface RunStage1Input {
  idea: string;
  setting: ProjectSettingV2;
  characters: FilmCharacter[];
  preferredFramework?: FilmStoryFramework; // Optional user override
  provider?: FilmScriptProvider;
}

export async function runStage1Structure(input: RunStage1Input): Promise<FilmScriptStructure> {
  const { idea, setting, characters, preferredFramework, provider = "gemini-flash" } = input;

  const castSummary = characters
    .map((c) => `- ${c.name || `Character ${c.order}`} (${c.role}): ${c.description}`)
    .join("\n") || "(no characters yet)";

  const frameworkContext = preferredFramework
    ? `The user has chosen the "${FRAMEWORK_LABELS[preferredFramework].name}" framework. Apply it to this idea.`
    : `Choose the BEST framework from: 3-act, hero-journey, save-the-cat, kishotenketsu. Default to 3-act unless the idea strongly suggests another.`;

  const systemPrompt = `You are an experienced screenwriter and story structurist. Pick a narrative framework that fits the user's idea, and write a 3-5 sentence overview explaining how the framework will apply to their story.

OUTPUT: Reply in strict JSON with BOTH languages:
- "contentVi": overview in VIETNAMESE (displayed in UI for the user to read & edit)
- "contentEn": same overview in ENGLISH (used downstream for image/video AI prompts)

JSON format: { "framework": "three-act"|"hero-journey"|"save-the-cat"|"kishotenketsu", "contentVi": "...", "contentEn": "..." }`;

  const userPrompt = `IDEA: ${idea}

GENRE: ${setting.genre ?? "drama"}
DURATION: ${setting.durationMinutes ?? 5} minutes
DIALOG: ${setting.dialog === "has_dialog" ? "Yes" : "No (visual storytelling only)"}

CAST:
${castSummary}

${frameworkContext}

Return the chosen framework + overview (both Vietnamese & English) as JSON.`;

  const raw = await callAi(provider, systemPrompt, userPrompt);
  const parsed = parseJsonStrict<{
    framework: FilmStoryFramework;
    contentEn: string;
    contentVi?: string;
  }>(raw);

  return {
    framework: parsed.framework,
    contentEn: parsed.contentEn,
    contentVi: parsed.contentVi,
  };
}

// ============================================================================
// STAGE 2 — BEATS
// ============================================================================

export interface RunStage2Input {
  idea: string;
  setting: ProjectSettingV2;
  characters: FilmCharacter[];
  structure: FilmScriptStructure;
  provider?: FilmScriptProvider;
}

export async function runStage2Beats(input: RunStage2Input): Promise<FilmScriptBeat[]> {
  const { idea, setting, characters, structure, provider = "gemini-flash" } = input;

  const targetCount = FRAMEWORK_LABELS[structure.framework].defaultBeatCount;
  const castSummary = characters
    .map((c) => `- ${c.name || `Character ${c.order}`} (${c.role}): ${c.description}`)
    .join("\n") || "(no characters yet)";

  const systemPrompt = `You are an experienced screenwriter. Generate ${targetCount} narrative beats for the user's story using the "${FRAMEWORK_LABELS[structure.framework].name}" framework.

Each beat has:
- "title": canonical beat name in VIETNAMESE (e.g. "Hình ảnh mở đầu", "Sự kiện kích hoạt", "Cao trào")
- "description": 1-2 sentences in VIETNAMESE describing what happens at this beat (so user can read & edit)

OUTPUT: Reply in strict JSON: { "beats": [ { "title": "...", "description": "..." } ] }

All text MUST be in Vietnamese (user-facing). DO NOT use English in beat titles or descriptions.`;

  const userPrompt = `IDEA: ${idea}

GENRE: ${setting.genre ?? "drama"}
DURATION: ${setting.durationMinutes ?? 5} minutes

CAST:
${castSummary}

STRUCTURE: ${FRAMEWORK_LABELS[structure.framework].name}
OVERVIEW (English reference): ${structure.contentEn}
${structure.contentVi ? `OVERVIEW (Vietnamese): ${structure.contentVi}` : ""}

Generate ${targetCount} beats in order from opening to closing IN VIETNAMESE. Beats should escalate dramatic tension toward the climax. Return as JSON.`;

  const raw = await callAi(provider, systemPrompt, userPrompt);
  const parsed = parseJsonStrict<{ beats: Array<{ title: string; description: string }> }>(raw);

  return parsed.beats.map((b, i) => ({
    id: genId("beat"),
    order: i + 1,
    title: b.title,
    description: b.description,
  }));
}

// ============================================================================
// STAGE 3 — TWISTS
// ============================================================================

export interface RunStage3Input {
  idea: string;
  setting: ProjectSettingV2;
  characters: FilmCharacter[];
  structure: FilmScriptStructure;
  beats: FilmScriptBeat[];
  provider?: FilmScriptProvider;
}

export async function runStage3Twists(input: RunStage3Input): Promise<FilmScriptTwist[]> {
  const { idea, setting, characters, beats, provider = "gemini-flash" } = input;

  const beatsList = beats
    .map((b) => `[${b.id}] Beat ${b.order} — ${b.title}: ${b.description}`)
    .join("\n");
  const castSummary = characters
    .map((c) => `- ${c.name || `Character ${c.order}`}: ${c.description}`)
    .join("\n") || "(no characters yet)";

  const systemPrompt = `You are an experienced screenwriter. Suggest 1-3 plot twists that would make the user's story more compelling. Each twist must be attached to a specific beat (use the beat id from the BEATS list). The twist subverts viewer expectation while still serving the story arc.

Each twist description MUST be in VIETNAMESE (user-facing).

OUTPUT: Reply in strict JSON: { "twists": [ { "beatId": "<beat id>", "description": "<Vietnamese description>" } ] }`;

  const userPrompt = `IDEA: ${idea}

GENRE: ${setting.genre ?? "drama"}

CAST:
${castSummary}

BEATS (use beatId to attach twists):
${beatsList}

Suggest 1-3 twists that strengthen the narrative. Return as JSON.`;

  const raw = await callAi(provider, systemPrompt, userPrompt);
  const parsed = parseJsonStrict<{ twists: Array<{ beatId: string; description: string }> }>(raw);

  return parsed.twists.map((t) => ({
    id: genId("twist"),
    beatId: t.beatId,
    description: t.description,
    // accepted is intentionally undefined — user must explicitly accept/reject in UI
  }));
}

// ============================================================================
// STAGE 4 — SCENES (preliminary, before Stage 5 dialogues)
// ============================================================================

export interface RunStage4Input {
  idea: string;
  setting: ProjectSettingV2;
  characters: FilmCharacter[];
  structure: FilmScriptStructure;
  beats: FilmScriptBeat[];
  acceptedTwists: FilmScriptTwist[];
  provider?: FilmScriptProvider;
  /**
   * Optional user-specified target scene count. If not set, AI decides
   * (typically 4-7 scenes for 5-min films, more for longer).
   */
  targetSceneCount?: number;
}

export async function runStage4Scenes(
  input: RunStage4Input
): Promise<FilmScriptIntermediateScene[]> {
  const { idea, setting, characters, beats, acceptedTwists, provider = "gemini-flash", targetSceneCount } = input;

  const beatsList = beats
    .map((b) => `[${b.id}] Beat ${b.order} — ${b.title}: ${b.description}`)
    .join("\n");
  const twistsList =
    acceptedTwists.length === 0
      ? "(no accepted twists)"
      : acceptedTwists.map((t) => `- attached to beat [${t.beatId}]: ${t.description}`).join("\n");
  const castSummary = characters
    .map((c) => `- ${c.name || `Character ${c.order}`}: ${c.description}`)
    .join("\n") || "(no characters yet)";

  const totalSeconds = (setting.durationMinutes ?? 5) * 60;
  const sceneCountInstruction = targetSceneCount && targetSceneCount > 0
    ? `Produce EXACTLY ${targetSceneCount} scenes — the user explicitly requested this count for richer storytelling.`
    : `Produce a natural scene count (typically ${Math.max(4, Math.round(totalSeconds / 75))} scenes for ${totalSeconds}s total).`;

  const systemPrompt = `You are an experienced screenwriter. Group the beats (and accepted twists) into concrete scenes. ${sceneCountInstruction}

Each scene has:
- "titleVi" + "titleEn": short scene title in both languages
- "settings": setting in format "INT./EXT. LOCATION — TIME" (English, technical screenplay convention)
- "actionLinesVi": action description in VIETNAMESE (~2-4 sentences, displayed in UI for user to read & edit)
- "actionLinesEn": same action description in ENGLISH (used downstream for image/video AI prompts)
- "durationSeconds": duration estimate (number)
- "beatIds": which beat ids this scene covers (1-3 typically)
- "tensionLevel": integer 0-10 expectation density per Hitchcock suspense scale (PACING annotation):
    * 0-2 → calm/baseline (opening establishing, exposition, dialogue between allies)
    * 3-4 → mild interest (setup beats, exploration, normal dialogue with subtext)
    * 5-6 → rising stakes (conflict introduced, mystery deepens, midpoint twist)
    * 7-8 → high stakes (all-is-lost moments, antagonist peak, confrontation)
    * 9-10 → climax (final showdown, sacrifice, ultimate revelation)
    Phim hay có curve leo dốc dần với 1-2 peak phụ + peak chính cuối phim.
- "emotionalTone": ONE of these 7 categorical values describing scene mood:
    * "tender"     — dịu dàng, tình cảm, ấm áp (mẹ con, người yêu, bạn bè)
    * "tense"      — căng thẳng, lo âu, threat đang gần (trước đối đầu)
    * "funny"      — vui nhộn, hài hước (comic relief, tình huống ngộ nghĩnh)
    * "sad"        — buồn, mất mát, tiếc nuối (chia ly, qua đời, thất bại)
    * "shocking"   — sốc, bất ngờ (reveal, twist, tai nạn)
    * "triumphant" — chiến thắng, giải toả (vượt qua, được cứu, kết phim hạnh phúc)
    * "neutral"    — trung tính (transition, info delivery thuần)

Total scene durations should sum to about ${totalSeconds}s.

OUTPUT: Reply in strict JSON: { "scenes": [ { "titleVi": "...", "titleEn": "...", "settings": "...", "actionLinesVi": "...", "actionLinesEn": "...", "durationSeconds": N, "beatIds": ["beat_id_1", ...], "tensionLevel": N, "emotionalTone": "..." } ] }

Keep descriptions CONCISE (2-4 sentences each). Avoid overly long prose to stay within token budget.`;

  const userPrompt = `IDEA: ${idea}

GENRE: ${setting.genre ?? "drama"}
DURATION TARGET: ${totalSeconds} seconds total
${targetSceneCount && targetSceneCount > 0 ? `SCENE COUNT REQUESTED: ${targetSceneCount} scenes (user wants this exact number for detailed coverage)` : ""}

CAST:
${castSummary}

BEATS:
${beatsList}

ACCEPTED TWISTS:
${twistsList}

Group beats into scenes with concrete setting + action (Vietnamese for UI + English for AI prompts) + duration. Return as JSON.`;

  const raw = await callAi(provider, systemPrompt, userPrompt);
  const parsed = parseJsonStrict<{
    scenes: Array<{
      titleEn: string;
      titleVi?: string;
      settings: string;
      actionLinesEn: string;
      actionLinesVi?: string;
      durationSeconds: number;
      beatIds: string[];
      tensionLevel?: number;
      emotionalTone?: string;
    }>;
  }>(raw);

  return parsed.scenes.map((s, i) => ({
    id: genId("scene"),
    order: i + 1,
    titleEn: s.titleEn,
    titleVi: s.titleVi,
    settings: s.settings,
    actionLinesEn: s.actionLinesEn,
    actionLinesVi: s.actionLinesVi,
    durationSeconds: s.durationSeconds,
    beatIds: s.beatIds ?? [],
    // Sprint 1.0 r1 (Phase 1A): pacing annotations
    tensionLevel: sanitizeTension(s.tensionLevel),
    emotionalTone: sanitizeEmotion(s.emotionalTone),
  }));
}

// ============================================================================
// qc20 — STAGE 4 SCENE SPLIT (Hướng F-9 sweet-spot enforcement)
// ============================================================================

export interface RunSplitSceneInput {
  scene: FilmScriptIntermediateScene;
  beats: FilmScriptBeat[]; // all beats (for resolving scene.beatIds → titles)
  provider?: FilmScriptProvider;
}

export interface SceneSplitSuggestion {
  /** Reason explanation in Vietnamese for the user. */
  reasonVi: string;
  /** Two sub-scenes that together replace the original. */
  subScenes: [
    {
      titleVi: string;
      titleEn: string;
      settings: string;
      actionLinesVi: string;
      actionLinesEn: string;
      durationSeconds: number;
      beatIds: string[];
    },
    {
      titleVi: string;
      titleEn: string;
      settings: string;
      actionLinesVi: string;
      actionLinesEn: string;
      durationSeconds: number;
      beatIds: string[];
    }
  ];
}

/**
 * qc20 Q20.4 Hướng C: AI suggest a split point for a complex scene.
 *
 * Returns 2 sub-scenes that together cover the same beats + duration as the original.
 * Caller (UI) displays preview, user confirms or cancels. On confirm, store action
 * replaces 1 scene with 2 sub-scenes.
 *
 * Goal: Each sub-scene should land in Hướng F-9 sweet spot (≤ 9 shots estimated).
 * Split logic preference: by beats (clean narrative boundary), then by mid-duration
 * if scene has only 1 beat.
 */
export async function runSplitSceneSuggestion(
  input: RunSplitSceneInput
): Promise<SceneSplitSuggestion> {
  const { scene, beats, provider = "gemini-flash" } = input;

  const sceneBeats = scene.beatIds
    .map((id) => beats.find((b) => b.id === id))
    .filter((b): b is FilmScriptBeat => !!b);
  const beatsList =
    sceneBeats.length > 0
      ? sceneBeats.map((b) => `[${b.id}] ${b.title}: ${b.description}`).join("\n")
      : "(no beats linked — split by action mid-point)";

  const systemPrompt = `You are an experienced screenwriter. The user has a scene that's too complex (would generate too many shots for the storyboard grid). Your task: SUGGEST splitting this 1 scene into 2 sub-scenes.

SPLIT STRATEGY:
1. PREFER splitting by beat boundaries — if scene has 2+ beats, divide them between sub-scenes (sub-scene 1 gets first half of beats, sub-scene 2 gets second half).
2. If only 1 beat: split the action narrative at a natural mid-point.
3. Each sub-scene must:
   - Have its own coherent micro-arc (setup → action → micro-resolution)
   - Cover ~half the original duration (sum must equal original durationSeconds)
   - Use SAME settings (location/time) unless action clearly changes location
   - Have a NEW concise title reflecting its sub-action
   - Have action lines short enough to land in 4-9 shots estimated

OUTPUT FORMAT (strict JSON):
{
  "reasonVi": "Lý do tách bằng tiếng Việt (1-2 câu giải thích)",
  "subScenes": [
    {
      "titleVi": "Title VN sub-scene 1",
      "titleEn": "Title EN sub-scene 1",
      "settings": "INT./EXT. LOCATION — TIME",
      "actionLinesVi": "Action VN ngắn 2-3 câu",
      "actionLinesEn": "Action EN short 2-3 sentences",
      "durationSeconds": N,
      "beatIds": ["beat_id_1", ...]
    },
    {
      "titleVi": "Title VN sub-scene 2",
      "titleEn": "Title EN sub-scene 2",
      "settings": "...",
      "actionLinesVi": "...",
      "actionLinesEn": "...",
      "durationSeconds": M,
      "beatIds": ["beat_id_2", ...]
    }
  ]
}

Sum of durationSeconds MUST equal original ${scene.durationSeconds}.
Together, beatIds of both sub-scenes MUST equal original beatIds (no beat lost, no beat duplicated).`;

  const userPrompt = `ORIGINAL SCENE TO SPLIT:
Title VN: ${scene.titleVi || scene.titleEn}
Title EN: ${scene.titleEn}
Settings: ${scene.settings}
Duration: ${scene.durationSeconds}s
Beat IDs: [${scene.beatIds.join(", ")}]

Action VN:
${scene.actionLinesVi || "(none)"}

Action EN:
${scene.actionLinesEn}

LINKED BEATS:
${beatsList}

Suggest the 2-way split as JSON.`;

  const raw = await callAi(provider, systemPrompt, userPrompt);
  const parsed = parseJsonStrict<SceneSplitSuggestion>(raw);

  // Defensive: ensure 2 sub-scenes
  if (!parsed.subScenes || parsed.subScenes.length !== 2) {
    throw new Error("AI did not return exactly 2 sub-scenes — try regenerating.");
  }
  return parsed;
}

// ============================================================================
// STAGE 5 — DIALOGUES (the existing r3 path, now also called when Stage 4 done)
// ============================================================================

export interface RunStage5QuickInput {
  idea: string;
  setting: ProjectSettingV2;
  characters: FilmCharacter[];
  provider?: FilmScriptProvider;
}

/**
 * Stage 5 quick path: 1-cú AI generation of full script with scenes containing
 * SFX/MUSIC/TRANSITION/DIALOG inline. Used when user picks "quick" mode (r3 default).
 */
export async function runStage5Quick(
  input: RunStage5QuickInput
): Promise<FilmScript> {
  const { idea, setting, characters, provider = "gemini-flash" } = input;
  const hasDialog = (setting.dialog ?? "no_dialog") === "has_dialog";

  const cast: FilmCharacterV2[] = characters.map((c) => adaptCharacter(c, hasDialog));

  const writerInput: ScriptWriterInput = {
    ideaRaw: idea.trim(),
    genre: setting.genre ?? "drama",
    animationStyle: setting.animationStyle ?? "live_action",
    durationMinutes: setting.durationMinutes ?? 5,
    aspectRatio: setting.aspectRatio,
    cast,
  };

  const { script } = await generateFilmScript(writerInput, provider);

  if (!hasDialog) {
    script.scenes = script.scenes.map((s) => ({ ...s, dialog: [] }));
  }

  return script;
}

// ============================================================================
// STAGE 5 — FROM PRIOR STAGES (multi-stage path)
// ============================================================================

export interface RunStage5FromStagesInput {
  idea: string;
  setting: ProjectSettingV2;
  characters: FilmCharacter[];
  structure: FilmScriptStructure;
  beats: FilmScriptBeat[];
  acceptedTwists: FilmScriptTwist[];
  intermediateScenes: FilmScriptIntermediateScene[];
  provider?: FilmScriptProvider;
}

/**
 * Stage 5 multi-stage path: enrich pre-built intermediate scenes (from Stage 4)
 * with dialogue + SFX + music brief + transition per scene.
 *
 * Uses the same generateFilmScript pipeline but feeds richer context so AI
 * produces dialogues consistent with the beats/twists user already approved.
 */
export async function runStage5FromStages(
  input: RunStage5FromStagesInput
): Promise<FilmScript> {
  const { idea, setting, characters, structure, beats, acceptedTwists, intermediateScenes, provider = "gemini-flash" } = input;
  const hasDialog = (setting.dialog ?? "no_dialog") === "has_dialog";

  // Build a richer idea string injecting the pre-built structure so the legacy
  // scriptWriter prompt produces dialogues aligned with what user already locked in.
  const enrichedIdea = `${idea}

STRUCTURE (locked by user via multi-stage wizard):
Framework: ${FRAMEWORK_LABELS[structure.framework].name}
Overview: ${structure.contentEn}

BEATS (in order):
${beats.map((b) => `${b.order}. ${b.title} — ${b.description}`).join("\n")}

ACCEPTED TWISTS:
${acceptedTwists.length === 0 ? "(none)" : acceptedTwists.map((t) => `- on beat [${t.beatId}]: ${t.description}`).join("\n")}

PRE-PLANNED SCENES (use exactly these scenes, only fill in dialog + SFX + music + transition):
${intermediateScenes
    .map(
      (s) =>
        `Scene ${s.order} — ${s.titleEn} (${s.durationSeconds}s)
  Setting: ${s.settings}
  Action: ${s.actionLinesEn}`
    )
    .join("\n\n")}`;

  const cast: FilmCharacterV2[] = characters.map((c) => adaptCharacter(c, hasDialog));

  const writerInput: ScriptWriterInput = {
    ideaRaw: enrichedIdea,
    genre: setting.genre ?? "drama",
    animationStyle: setting.animationStyle ?? "live_action",
    durationMinutes: setting.durationMinutes ?? 5,
    aspectRatio: setting.aspectRatio,
    cast,
  };

  const { script } = await generateFilmScript(writerInput, provider);

  // Defensive: if AI ignored the pre-planned scene count, keep its output.
  // r7 doesn't try to force exact scene match — trust user to spot mismatches
  // and re-run if needed.
  if (!hasDialog) {
    script.scenes = script.scenes.map((s) => ({ ...s, dialog: [] }));
  }

  // Sprint 1.0 r1 (Phase 1A): copy tension + emotion from intermediate scenes
  // to final scenes by order index. Stage 5 (legacy scriptWriter) doesn't know
  // about pacing — we propagate them post-process here so user sees their
  // Stage 4 annotations in Storyboard + Shot list without re-annotating.
  script.scenes = script.scenes.map((s, i) => {
    const inter = intermediateScenes[i];
    if (!inter) return s;
    return {
      ...s,
      tensionLevel: inter.tensionLevel,
      emotionalTone: inter.emotionalTone,
    };
  });

  return script;
}

// ============================================================================
// Sprint 1.0 r1 (Phase 1A) — RE-ANNOTATE EMOTIONS
// ============================================================================

/**
 * Re-annotate tension + emotionalTone for existing scenes WITHOUT regenerating
 * script. Lightweight AI call — only reads titles + action lines + duration,
 * returns 2 values per scene.
 *
 * Use case: user manually edited action lines after Stage 4 → emotion stale →
 * click "Re-annotate emotions" button to refresh annotations.
 *
 * Cost: 1 Gemini Flash call total (~$0). Input ~200 tokens per scene, output
 * ~20 tokens per scene.
 *
 * Returns map sceneId → { tensionLevel, emotionalTone }. Caller merges into
 * scenes via store action (updateSceneInScript or setScriptIntermediateScenes).
 */
export async function runReannotateEmotions(input: {
  scenes: Array<{
    id: string;
    order: number;
    titleVi?: string;
    titleEn: string;
    actionLinesVi?: string;
    actionLinesEn: string;
    durationSeconds: number;
  }>;
  provider?: FilmScriptProvider;
}): Promise<Record<string, { tensionLevel: number; emotionalTone: EmotionalTone }>> {
  const { scenes, provider = "gemini-flash" } = input;
  if (scenes.length === 0) return {};

  const sceneList = scenes
    .map(
      (s) =>
        `[${s.id}] Scene ${s.order} (${s.durationSeconds}s) — ${s.titleVi || s.titleEn}
  Action: ${s.actionLinesVi || s.actionLinesEn}`
    )
    .join("\n\n");

  const systemPrompt = `You are a film pacing analyst. For each scene given, assign 2 annotations:

- "tensionLevel": integer 0-10 (Hitchcock expectation density scale):
    * 0-2 calm/baseline · 3-4 mild interest · 5-6 rising stakes · 7-8 high stakes · 9-10 climax
- "emotionalTone": ONE of: "tender" | "tense" | "funny" | "sad" | "shocking" | "triumphant" | "neutral"

Good film has curve climbing with 1-2 minor peaks before main climax. Don't flatten all to mid values.

OUTPUT strict JSON: { "annotations": [ { "sceneId": "<id>", "tensionLevel": N, "emotionalTone": "..." } ] }`;

  const userPrompt = `Scenes to annotate:

${sceneList}

Return JSON with one annotation per scene id.`;

  const raw = await callAi(provider, systemPrompt, userPrompt);
  const parsed = parseJsonStrict<{
    annotations: Array<{ sceneId: string; tensionLevel?: number; emotionalTone?: string }>;
  }>(raw);

  const result: Record<string, { tensionLevel: number; emotionalTone: EmotionalTone }> = {};
  for (const a of parsed.annotations ?? []) {
    if (!a.sceneId) continue;
    result[a.sceneId] = {
      tensionLevel: sanitizeTension(a.tensionLevel),
      emotionalTone: sanitizeEmotion(a.emotionalTone),
    };
  }
  return result;
}

// ============================================================================
// SPRINT 1.0 r3 — AI DIRECTOR (Phase 3 auto-apply pacing adjustments)
// ============================================================================

/**
 * Per-scene change proposed by AI Director.
 * Only includes fields that actually changed (others left undefined).
 */
export interface AiDirectorSceneChange {
  sceneId: string;
  sceneOrder: number;
  /** Before snapshot (for undo per-scene + diff display). */
  before: {
    tensionLevel?: number;
    emotionalTone?: EmotionalTone;
    durationSeconds: number;
  };
  /** After values AI proposes. */
  after: {
    tensionLevel: number;
    emotionalTone: EmotionalTone;
    durationSeconds: number;
  };
  /** Short Vietnamese explanation of why AI changed this scene. */
  rationaleVi: string;
  /** Which fields actually differ from before. */
  fieldsChanged: Array<"tension" | "emotion" | "duration">;
}

export interface AiDirectorResult {
  /** Per-scene proposed changes (only scenes that need adjustment). */
  changes: AiDirectorSceneChange[];
  /** Top-level Vietnamese summary of what AI did. */
  summaryVi: string;
  /** Detected strengths (cảnh nào nhịp tốt) — for review panel. */
  strengthsVi: string[];
  /** Detected weaknesses — what could be better. */
  weaknessesVi: string[];
  /** Total film duration before vs after (for over/under target warning). */
  totalDurationBefore: number;
  totalDurationAfter: number;
}

/**
 * AI Director — analyzes all scenes' pacing and proposes adjustments to
 * tension + emotion + duration to make the film's curve more cinematic.
 *
 * Does NOT touch description text, dialogue, or shots — those layers are
 * preserved verbatim. User can still see their content untouched; only the
 * "shape" of the pacing curve changes.
 *
 * Default mode in UI: auto-apply changes immediately, then show review panel
 * with Undo all / per-scene review / Keep buttons. User has full control to
 * reject any change.
 *
 * Cost: 1 Gemini Flash call (~$0). Input ~scene count × 200 tokens; output
 * ~scene count × 100 tokens.
 */
export async function runAiDirector(input: {
  scenes: Array<{
    id: string;
    order: number;
    titleVi?: string;
    titleEn: string;
    actionLinesVi?: string;
    actionLinesEn: string;
    durationSeconds: number;
    tensionLevel?: number;
    emotionalTone?: EmotionalTone;
  }>;
  /** Project target duration in minutes (for compress/extend recommendations). */
  targetDurationMinutes?: number;
  /** Story framework if known — informs curve expectations. */
  framework?: import("../types/film").FilmStoryFramework;
  provider?: FilmScriptProvider;
}): Promise<AiDirectorResult> {
  const { scenes, targetDurationMinutes, framework, provider = "gemini-flash" } = input;
  if (scenes.length === 0) {
    return {
      changes: [],
      summaryVi: "Không có scene nào để phân tích.",
      strengthsVi: [],
      weaknessesVi: [],
      totalDurationBefore: 0,
      totalDurationAfter: 0,
    };
  }

  const sceneList = scenes
    .map(
      (s) =>
        `[${s.id}] Scene ${s.order} (${s.durationSeconds}s, tension ${s.tensionLevel ?? "?"}/10, emotion ${s.emotionalTone ?? "?"}) — ${s.titleVi || s.titleEn}
  Action: ${s.actionLinesVi || s.actionLinesEn}`
    )
    .join("\n\n");

  const totalSecondsBefore = scenes.reduce((sum, s) => sum + s.durationSeconds, 0);
  const targetSeconds = (targetDurationMinutes ?? 5) * 60;
  const frameworkContext = framework
    ? `\n\nFRAMEWORK: ${framework} — adjust curve to fit this framework's typical beat structure.`
    : "";

  const systemPrompt = `You are an experienced film director acting as an AI pacing optimizer. Analyze the entire film's scenes and propose tension + emotion + duration adjustments to make the pacing more cinematic per professional theory (Walter Murch, Pixar emotional valence, Hitchcock suspense).

PRINCIPLES:
- Phim hay có curve climbing với 1-2 minor peaks before main climax (peak chính ở 70-90% phim)
- Avoid flat midpoint (cảnh giữa < 5/10 = tẻ nhạt)
- Avoid early peak (climax in first half = anticlimactic ending)
- Climax should hit ≥7/10 to give audience catharsis
- Compress low-tension scenes (<3/10) if total film duration exceeds target
- Extend climax scene by 10-25% if tension change is dramatic

CONSTRAINTS:
- DO NOT change scene description, action lines, dialogue, or character details — only tension + emotion + duration
- Keep total film duration within ±10% of target
- Only propose changes where there's a clear pacing benefit; leave good scenes alone
- "rationaleVi" must be 1 short sentence (≤20 words) explaining WHY this change improves pacing
- "tensionLevel": integer 0-10
- "emotionalTone": one of "tender" | "tense" | "funny" | "sad" | "shocking" | "triumphant" | "neutral"

OUTPUT strict JSON:
{
  "summaryVi": "<1-2 sentence overall summary in Vietnamese>",
  "strengthsVi": ["<sentence>", ...],
  "weaknessesVi": ["<sentence>", ...],
  "scenes": [
    {
      "sceneId": "<id>",
      "tensionLevel": <int 0-10>,
      "emotionalTone": "<one of 7 values>",
      "durationSeconds": <int>,
      "rationaleVi": "<short Vietnamese sentence>"
    },
    ...
  ]
}

Include ALL scenes in "scenes" array, even unchanged ones (use same values as before for those). UI will filter to show only diff.`;

  const userPrompt = `TARGET DURATION: ${targetSeconds}s (${targetDurationMinutes ?? 5} phút). Current total: ${totalSecondsBefore}s.${frameworkContext}

SCENES:
${sceneList}

Propose adjustments per principles above. Return JSON.`;

  const raw = await callAi(provider, systemPrompt, userPrompt);
  const parsed = parseJsonStrict<{
    summaryVi?: string;
    strengthsVi?: string[];
    weaknessesVi?: string[];
    scenes: Array<{
      sceneId: string;
      tensionLevel?: number;
      emotionalTone?: string;
      durationSeconds?: number;
      rationaleVi?: string;
    }>;
  }>(raw);

  const sceneMap = new Map(scenes.map((s) => [s.id, s]));
  const changes: AiDirectorSceneChange[] = [];
  let totalDurationAfter = totalSecondsBefore;

  for (const proposed of parsed.scenes ?? []) {
    const before = sceneMap.get(proposed.sceneId);
    if (!before) continue;

    const newTension = sanitizeTension(proposed.tensionLevel ?? before.tensionLevel ?? 0);
    const newEmotion = sanitizeEmotion(proposed.emotionalTone ?? before.emotionalTone ?? "neutral");
    const newDuration =
      typeof proposed.durationSeconds === "number" && proposed.durationSeconds > 0
        ? Math.max(5, Math.min(600, Math.round(proposed.durationSeconds)))
        : before.durationSeconds;

    const fieldsChanged: Array<"tension" | "emotion" | "duration"> = [];
    const beforeT = clampTension(before.tensionLevel);
    const beforeE = before.emotionalTone ?? "neutral";
    if (newTension !== beforeT) fieldsChanged.push("tension");
    if (newEmotion !== beforeE) fieldsChanged.push("emotion");
    if (newDuration !== before.durationSeconds) fieldsChanged.push("duration");

    if (fieldsChanged.length === 0) continue; // skip unchanged

    totalDurationAfter += newDuration - before.durationSeconds;

    changes.push({
      sceneId: before.id,
      sceneOrder: before.order,
      before: {
        tensionLevel: before.tensionLevel,
        emotionalTone: before.emotionalTone,
        durationSeconds: before.durationSeconds,
      },
      after: {
        tensionLevel: newTension,
        emotionalTone: newEmotion,
        durationSeconds: newDuration,
      },
      rationaleVi: (proposed.rationaleVi ?? "").trim() || "Điều chỉnh nhịp.",
      fieldsChanged,
    });
  }

  return {
    changes,
    summaryVi: (parsed.summaryVi ?? "").trim() || "AI Director đã phân tích nhịp phim.",
    strengthsVi: (parsed.strengthsVi ?? []).filter((s) => typeof s === "string" && s.trim()),
    weaknessesVi: (parsed.weaknessesVi ?? []).filter((s) => typeof s === "string" && s.trim()),
    totalDurationBefore: totalSecondsBefore,
    totalDurationAfter,
  };
}

// ============================================================================
// SPRINT 1.0 r4 — DRAG REWRITE (Phase 4: drag tension on curve → AI rewrite)
// ============================================================================

/**
 * Suggestion returned when user drags a scene's tension to a new value.
 * Includes proposed scene rewrites + rationale.
 *
 * Unlike AI Director, drag-rewrite IS allowed to modify description text
 * because user explicitly opted in via direct gesture. UI must show preview
 * modal before applying (no auto-apply for destructive edits).
 */
export interface DragRewriteSuggestion {
  sceneId: string;
  /** Target tension user dragged to (clamped 0-10). */
  newTension: number;
  /** AI-proposed emotion that matches new tension. */
  newEmotion: EmotionalTone;
  /** AI-proposed duration (may extend for peak, compress for low tension). */
  newDurationSeconds: number;
  /** AI rewrite of scene action lines (Vietnamese). */
  newActionLinesVi: string;
  /** AI rewrite of scene action lines (English — for downstream image/video prompts). */
  newActionLinesEn: string;
  /** 1-2 sentence Vietnamese rationale. */
  rationaleVi: string;
  /** Before snapshot for undo. */
  before: {
    tensionLevel?: number;
    emotionalTone?: EmotionalTone;
    durationSeconds: number;
    actionLinesVi?: string;
    actionLinesEn: string;
  };
}

/**
 * When user drags a tension point, ask AI how to rewrite that scene to match
 * the new tension. AI proposes new description + duration + emotion + rationale.
 *
 * User sees modal preview BEFORE applying — destructive edits never auto-apply.
 *
 * Cost: 1 Gemini Flash call (~$0). Smaller than AI Director (single scene).
 */
export async function runDragRewriteSuggest(input: {
  scene: {
    id: string;
    order: number;
    titleVi?: string;
    titleEn: string;
    actionLinesVi?: string;
    actionLinesEn: string;
    durationSeconds: number;
    tensionLevel?: number;
    emotionalTone?: EmotionalTone;
  };
  newTension: number;
  provider?: FilmScriptProvider;
}): Promise<DragRewriteSuggestion> {
  const { scene, newTension, provider = "gemini-flash" } = input;
  const oldTension = clampTension(scene.tensionLevel);
  const targetTension = clampTension(newTension);
  const delta = targetTension - oldTension;
  const direction = delta > 0 ? "UP" : delta < 0 ? "DOWN" : "SAME";

  const directionGuide =
    direction === "UP"
      ? "User wants HIGHER tension → add stakes, conflict, physical action, escalation, urgency. Consider extending duration by 10-25% if tension increases dramatically (≥3 levels)."
      : direction === "DOWN"
      ? "User wants LOWER tension → ease the scene, add reflection/breath beats, calm. Consider compressing duration by 10-20%."
      : "Tension unchanged — only adjust emotion/duration if needed.";

  const systemPrompt = `User dragged a scene's tension from ${oldTension}/10 to ${targetTension}/10 on the pacing curve. Rewrite the scene's action lines to match the new tension level. PRESERVE: setting, characters, location, key plot beats. CHANGE: stakes, intensity, pace, sensory detail.

DIRECTION: ${directionGuide}

CONSTRAINTS:
- Preserve narrative continuity — this scene's role in the larger story must remain intact
- Vietnamese action lines should be 2-4 sentences (display in UI)
- English action lines should mirror Vietnamese (downstream AI image/video prompts)
- "newDurationSeconds": integer 5-600 (clamp). For tension peaks (≥7/10), prefer slightly longer for hold beats. For low tension (≤3/10), prefer compressed.
- "newEmotion": one of "tender" | "tense" | "funny" | "sad" | "shocking" | "triumphant" | "neutral" — should match new tension intuitively
- "rationaleVi": ≤25 words Vietnamese explaining the rewrite philosophy

OUTPUT strict JSON:
{
  "newActionLinesVi": "<Vietnamese 2-4 sentences>",
  "newActionLinesEn": "<English equivalent>",
  "newDurationSeconds": <int 5-600>,
  "newEmotion": "<one of 7 values>",
  "rationaleVi": "<short Vietnamese>"
}`;

  const userPrompt = `Scene ${scene.order}: ${scene.titleVi || scene.titleEn}
Current tension: ${oldTension}/10 → target ${targetTension}/10
Current emotion: ${scene.emotionalTone ?? "neutral"}
Current duration: ${scene.durationSeconds}s

Current action (Vietnamese):
${scene.actionLinesVi || scene.actionLinesEn}

Current action (English):
${scene.actionLinesEn}

Rewrite per the direction above. Return JSON.`;

  const raw = await callAi(provider, systemPrompt, userPrompt);
  const parsed = parseJsonStrict<{
    newActionLinesVi?: string;
    newActionLinesEn?: string;
    newDurationSeconds?: number;
    newEmotion?: string;
    rationaleVi?: string;
  }>(raw);

  const newDuration =
    typeof parsed.newDurationSeconds === "number" && parsed.newDurationSeconds > 0
      ? Math.max(5, Math.min(600, Math.round(parsed.newDurationSeconds)))
      : scene.durationSeconds;

  return {
    sceneId: scene.id,
    newTension: targetTension,
    newEmotion: sanitizeEmotion(parsed.newEmotion),
    newDurationSeconds: newDuration,
    newActionLinesVi: (parsed.newActionLinesVi ?? "").trim() || scene.actionLinesVi || scene.actionLinesEn,
    newActionLinesEn: (parsed.newActionLinesEn ?? "").trim() || scene.actionLinesEn,
    rationaleVi: (parsed.rationaleVi ?? "").trim() || "Điều chỉnh nhịp theo direction.",
    before: {
      tensionLevel: scene.tensionLevel,
      emotionalTone: scene.emotionalTone,
      durationSeconds: scene.durationSeconds,
      actionLinesVi: scene.actionLinesVi,
      actionLinesEn: scene.actionLinesEn,
    },
  };
}

// ============================================================================
// SPRINT 1.0 r4 — SHOT RE-PROMPT (per-shot AI re-prompt for new duration)
// ============================================================================

export interface ShotRepromptSuggestion {
  shotId: string;
  newImagePrompt: string;
  newAnimationPrompt: string;
  /** Vietnamese rationale (1-2 sentences) about why prompt changes. */
  rationaleVi: string;
  /** Suggestion: should this shot become "still image + audio overlay" instead of AI video clip? */
  useStillImage: boolean;
}

/**
 * Re-prompt a shot's image + animation prompts based on new duration intent.
 *
 * Use case: user drags shot duration from 4s → 8s. AI re-prompts:
 * - Image: same composition but cinematic enough for hold beat
 * - Animation: intent emphasis on hold + micro-expression
 * - Suggests using still image (Ken Burns) if duration > 8s (AI video provider limit)
 *
 * Cost: 1 Gemini Flash call (~$0).
 */
export async function runShotReprompt(input: {
  shot: {
    id: string;
    titleVi?: string;
    titleEn: string;
    shotType: string;
    cameraMovement: string;
    durationSeconds: number; // new target duration
    actionVi?: string;
    actionEn?: string;
    rhythmRole?: import("../types/project").RhythmRole;
    imagePromptR5?: string;
    animationPromptR5?: string;
  };
  /** Previous duration before the user's drag. */
  previousDuration: number;
  /** Scene's current tension to inform prompt mood. */
  sceneTension?: number;
  provider?: FilmScriptProvider;
}): Promise<ShotRepromptSuggestion> {
  const { shot, previousDuration, sceneTension, provider = "gemini-flash" } = input;
  const newDuration = shot.durationSeconds;
  const delta = newDuration - previousDuration;
  const tension = clampTension(sceneTension);

  // Suggest still image if duration > 8s (AI video provider limit)
  const useStillImage = newDuration > 8;

  const systemPrompt = `User dragged a shot duration from ${previousDuration}s to ${newDuration}s. Re-prompt the shot's image + animation prompts to match the new duration intent.

CONTEXT:
- Shot type: ${shot.shotType}, camera: ${shot.cameraMovement}
- Rhythm role: ${shot.rhythmRole ?? "build"}
- Scene tension: ${tension}/10
- Duration delta: ${delta > 0 ? "+" : ""}${delta}s

DIRECTION:
${
  delta > 0
    ? `Shot getting LONGER → emphasize hold beats, micro-expression evolution, slow burn. ${useStillImage ? "DURATION > 8s exceeds AI video provider limit (Veo/Kling/Sora cap 5-8s) → recommend STILL IMAGE + audio overlay + slow zoom (Ken Burns)." : "Add subtle motion for hold."}`
    : delta < 0
    ? `Shot getting SHORTER → tighten action, cut superfluous beats, increase pace.`
    : `Duration unchanged — refresh prompt only if needed.`
}

CONSTRAINTS:
- Image prompt: ENGLISH, single-paragraph, focus on composition + lighting + mood + key visual elements (≤500 chars)
- Animation prompt: ENGLISH, describe camera motion + character action + timing (≤400 chars)
- Both prompts must reflect rhythm role + duration intent
- Preserve subject matter — don't change WHAT the shot shows, only HOW it's captured

OUTPUT strict JSON:
{
  "newImagePrompt": "<English image prompt>",
  "newAnimationPrompt": "<English animation prompt>",
  "useStillImage": <boolean — true if duration > 8s>,
  "rationaleVi": "<Vietnamese 1-2 sentences about the prompt change>"
}`;

  const userPrompt = `Shot: ${shot.titleVi || shot.titleEn}
Type: ${shot.shotType}, camera: ${shot.cameraMovement}, role: ${shot.rhythmRole ?? "build"}
Action (Vietnamese): ${shot.actionVi ?? "(none)"}
Action (English): ${shot.actionEn ?? "(none)"}

Current image prompt: ${shot.imagePromptR5 ?? "(none — generate from scratch)"}
Current animation prompt: ${shot.animationPromptR5 ?? "(none — generate from scratch)"}

Re-prompt for ${newDuration}s duration. Return JSON.`;

  const raw = await callAi(provider, systemPrompt, userPrompt);
  const parsed = parseJsonStrict<{
    newImagePrompt?: string;
    newAnimationPrompt?: string;
    useStillImage?: boolean;
    rationaleVi?: string;
  }>(raw);

  return {
    shotId: shot.id,
    newImagePrompt: (parsed.newImagePrompt ?? "").trim() || shot.imagePromptR5 || "",
    newAnimationPrompt: (parsed.newAnimationPrompt ?? "").trim() || shot.animationPromptR5 || "",
    rationaleVi: (parsed.rationaleVi ?? "").trim() || "Điều chỉnh prompt theo duration mới.",
    useStillImage: parsed.useStillImage ?? useStillImage,
  };
}

// ============================================================================
// SPRINT 1.0 r5 — MULTI-CHARACTER EMOTION ARCS (Phase 2B)
// ============================================================================

/**
 * Per-character per-scene emotion. Map characterId → EmotionalTone.
 * Result keyed by sceneId to allow bulk update.
 */
export type CharacterEmotionsMap = Record<string, Record<string, EmotionalTone>>; // sceneId → characterId → tone

/**
 * AI annotates per-character emotion for each scene. Only relevant when 2+
 * characters in cast — single-character films collapse to scene-level emotion.
 *
 * Uses dialog presence + action lines to infer each character's emotion in scene.
 * Cheap call (~1 Gemini Flash request).
 */
export async function runReannotateCharacterEmotions(input: {
  scenes: Array<{
    id: string;
    order: number;
    titleVi?: string;
    titleEn: string;
    actionLinesVi?: string;
    actionLinesEn: string;
    dialog?: Array<{ characterId: string; characterName: string; lineVi?: string; lineEn: string }>;
  }>;
  characters: Array<{ id: string; name: string; description: string }>;
  provider?: FilmScriptProvider;
}): Promise<CharacterEmotionsMap> {
  const { scenes, characters, provider = "gemini-flash" } = input;
  if (scenes.length === 0 || characters.length < 2) return {};

  const charSummary = characters
    .map((c) => `[${c.id}] ${c.name}: ${c.description || "(no description)"}`)
    .join("\n");

  const sceneList = scenes
    .map((s) => {
      const dialogText =
        s.dialog && s.dialog.length > 0
          ? "\n  Dialog: " +
            s.dialog
              .map((d) => `${d.characterName}: "${d.lineVi || d.lineEn}"`)
              .join(" | ")
          : "";
      return `[${s.id}] Scene ${s.order} — ${s.titleVi || s.titleEn}
  Action: ${s.actionLinesVi || s.actionLinesEn}${dialogText}`;
    })
    .join("\n\n");

  const systemPrompt = `You are a film emotion analyst. For each scene, infer the emotional state of EACH character present in that scene. A character is "present" if they have dialog OR appear in action lines.

EMOTION VALUES (use exactly these 7):
"tender" | "tense" | "funny" | "sad" | "shocking" | "triumphant" | "neutral"

PRINCIPLES:
- Different characters in same scene often feel DIFFERENT emotions (protagonist tense, antagonist triumphant, observer shocked)
- If a character is NOT in scene, omit them from that scene's annotation
- If a character is in scene but their emotion is unclear, use "neutral"

OUTPUT strict JSON:
{
  "scenes": [
    {
      "sceneId": "<id>",
      "characterEmotions": {
        "<characterId>": "<emotion>",
        ...
      }
    },
    ...
  ]
}`;

  const userPrompt = `CHARACTERS:
${charSummary}

SCENES:
${sceneList}

Return per-scene per-character emotion JSON.`;

  const raw = await callAi(provider, systemPrompt, userPrompt);
  const parsed = parseJsonStrict<{
    scenes: Array<{ sceneId: string; characterEmotions?: Record<string, string> }>;
  }>(raw);

  const result: CharacterEmotionsMap = {};
  const charIds = new Set(characters.map((c) => c.id));

  for (const s of parsed.scenes ?? []) {
    if (!s.sceneId || !s.characterEmotions) continue;
    const sanitized: Record<string, EmotionalTone> = {};
    for (const [charId, tone] of Object.entries(s.characterEmotions)) {
      if (!charIds.has(charId)) continue;
      sanitized[charId] = sanitizeEmotion(tone);
    }
    if (Object.keys(sanitized).length > 0) {
      result[s.sceneId] = sanitized;
    }
  }
  return result;
}

// ============================================================================
// SPRINT 1.0 r5 — SETUP-PAYOFF DETECTION (Phase 2B)
// ============================================================================

import type { SetupPayoffPair } from "../types/project";

export interface SetupPayoffDetectResult {
  pairs: SetupPayoffPair[];
  /** Top-level Vietnamese summary of how well setups are paid off. */
  summaryVi: string;
  /** Setups detected but with no matching payoff (dangling). */
  danglingSetupsVi: string[];
}

/**
 * AI scans full script and identifies setup → payoff pairs.
 * Setup: element/promise/skill/object introduced early.
 * Payoff: later scene where setup is fulfilled or referenced.
 *
 * Cost: 1 Gemini Flash call (~$0). Returns up to ~10 strong pairs.
 */
export async function runSetupPayoffDetect(input: {
  scenes: Array<{
    id: string;
    order: number;
    titleVi?: string;
    titleEn: string;
    actionLinesVi?: string;
    actionLinesEn: string;
  }>;
  provider?: FilmScriptProvider;
}): Promise<SetupPayoffDetectResult> {
  const { scenes, provider = "gemini-flash" } = input;
  if (scenes.length < 2) {
    return {
      pairs: [],
      summaryVi: "Phim cần ít nhất 2 scenes để phân tích setup-payoff.",
      danglingSetupsVi: [],
    };
  }

  const sceneList = scenes
    .map(
      (s) =>
        `[${s.id}] Scene ${s.order} — ${s.titleVi || s.titleEn}
  Action: ${s.actionLinesVi || s.actionLinesEn}`
    )
    .join("\n\n");

  const systemPrompt = `You are a story analyst. Scan the entire script and detect SETUP → PAYOFF pairs across scenes.

SETUP = element planted early (object, skill, promise, mystery, character trait, world detail)
PAYOFF = later scene where that element is fulfilled, used, or referenced meaningfully

TYPE categories:
- "object": physical item (gun, key, photo, gadget)
- "skill": character ability shown
- "promise": verbal/implied commitment
- "mystery": question raised that gets answered
- "character": trait revealed that gets tested
- "world": world-building element that becomes plot-relevant

RULES:
- payoffSceneId MUST be a LATER scene than setupSceneId (order strictly greater)
- Only report STRONG, intentional setups (don't reach for incidental references)
- "labelVi" should be 3-6 words Vietnamese, evocative (e.g., "Mật mã 3-5 nhịp", "Cảm biến quang học", "Hệ thống cảnh báo")
- "labelEn" MUST be the English equivalent (3-6 words), used in EN AI prompts. Example matching: "3-5 tap code", "Optical sensor", "Warning system". REQUIRED — never skip.
- "rationaleVi" 1-2 sentences Vietnamese explaining the connection
- "confidence" 0-1 (>0.7 strong / 0.4-0.7 moderate / <0.4 speculative — only include if ≥0.4)
- Also list "danglingSetupsVi" — setups you see but no matching payoff (story craft warning)

OUTPUT strict JSON:
{
  "summaryVi": "<1-2 sentence Vietnamese summary>",
  "pairs": [
    {
      "setupSceneId": "<id>",
      "payoffSceneId": "<later id>",
      "type": "<one of 6 types>",
      "labelVi": "<3-6 words Vietnamese>",
      "labelEn": "<3-6 words English equivalent>",
      "rationaleVi": "<1-2 sentences Vietnamese>",
      "confidence": <number 0-1>
    },
    ...
  ],
  "danglingSetupsVi": ["<warning sentence>", ...]
}`;

  const userPrompt = `SCENES:
${sceneList}

Detect setup → payoff pairs. Return JSON.`;

  const raw = await callAi(provider, systemPrompt, userPrompt);
  const parsed = parseJsonStrict<{
    summaryVi?: string;
    pairs?: Array<{
      setupSceneId?: string;
      payoffSceneId?: string;
      type?: string;
      labelVi?: string;
      labelEn?: string;
      rationaleVi?: string;
      confidence?: number;
    }>;
    danglingSetupsVi?: string[];
  }>(raw);

  const sceneOrderMap = new Map(scenes.map((s) => [s.id, s.order]));
  const validTypes = new Set(["object", "skill", "promise", "mystery", "character", "world"]);

  const pairs: SetupPayoffPair[] = [];
  const now = Date.now();
  for (const p of parsed.pairs ?? []) {
    if (!p.setupSceneId || !p.payoffSceneId) continue;
    const setupOrder = sceneOrderMap.get(p.setupSceneId);
    const payoffOrder = sceneOrderMap.get(p.payoffSceneId);
    if (setupOrder === undefined || payoffOrder === undefined) continue;
    if (payoffOrder <= setupOrder) continue; // payoff must be later
    const type = validTypes.has(p.type ?? "")
      ? (p.type as SetupPayoffPair["type"])
      : "object";
    const confidence = typeof p.confidence === "number"
      ? Math.max(0, Math.min(1, p.confidence))
      : 0.5;
    if (confidence < 0.4) continue; // skip weak

    pairs.push({
      id: `sp_${now}_${pairs.length}_${Math.random().toString(36).slice(2, 6)}`,
      setupSceneId: p.setupSceneId,
      payoffSceneId: p.payoffSceneId,
      type,
      labelVi: (p.labelVi ?? "").trim() || "(không có nhãn)",
      labelEn: (p.labelEn ?? "").trim() || undefined, // r7: undefined if AI didn't provide; UI shows stale badge
      rationaleVi: (p.rationaleVi ?? "").trim() || "",
      confidence,
      detectedAt: now,
    });
  }

  return {
    pairs,
    summaryVi: (parsed.summaryVi ?? "").trim() || `Phát hiện ${pairs.length} cặp setup-payoff.`,
    danglingSetupsVi: (parsed.danglingSetupsVi ?? []).filter((s) => typeof s === "string" && s.trim()),
  };
}

// ============================================================================
// SPRINT 1.0 r7 — BEATS DETECTION + PHYSICAL CONSISTENCY LOCK (Phase 3)
// ============================================================================

import type { Beat } from "../types/project";

/**
 * Result of beats detection — beats array per scene + optional EN physical consistency lock.
 * Both produced in one AI call to save tokens.
 */
export interface DetectBeatsAndLockResult {
  /** Beats array, ordered by appearance in scene action. */
  beats: Beat[];
  /** AI-derived physical consistency lock (English, multi-line). undefined if none detected. */
  physicalConsistencyLockEn?: string;
}

/**
 * Single-scene beats detection. AI parses scene action lines into atomic narrative beats.
 * Each beat = 1 discrete moment that cannot split smaller without losing meaning.
 *
 * Also extracts PHYSICAL CONSISTENCY LOCK from description — appearance details that
 * must stay identical across all shots of this scene.
 *
 * Use case:
 * - Auto-trigger when Stage 5 finalizes (1 call per scene, bulk batched)
 * - Auto re-trigger when user edits actionLines (J3)
 *
 * Cost: ~1 Gemini Flash call per scene. For 6-scene film: ~6 calls (~$0).
 */
export async function runDetectBeatsForScene(input: {
  scene: {
    id: string;
    order: number;
    titleVi?: string;
    titleEn: string;
    actionLinesVi?: string;
    actionLinesEn: string;
    settings?: string;
  };
  provider?: FilmScriptProvider;
}): Promise<DetectBeatsAndLockResult> {
  const { scene, provider = "gemini-flash" } = input;
  // Prefer VI action if exists (richer detail, user-authored), else EN
  const sourceAction =
    (scene as any).actionLinesVi?.trim() || scene.actionLinesEn?.trim() || "";
  const sourceLang = (scene as any).actionLinesVi?.trim() ? "Vietnamese" : "English";

  if (!sourceAction) {
    return { beats: [] };
  }

  const systemPrompt = `You are a film story analyst. Two tasks:

TASK 1 — Identify atomic NARRATIVE BEATS in the scene description.

A beat = 1 discrete unit that cannot be split smaller without losing meaning, AND cannot be merged with neighbor without losing detail. Examples:
- "Wide forest sweep" (camera intent, atmosphere)
- "Tilt down reveals robot" (camera intent, subject reveal)
- "Woodpecker lands on head" (subject action)
- "Pecks 3 times, pause, 5 times" (action with rhythm)
- "Blue light flickers" (state change)
- "Light fades" (state change)

Beat types (5 categories):
- "camera": camera movement/framing intent (wide sweep, tilt down, dolly in)
- "subject": new subject enters/leaves (woodpecker arrives, robot revealed)
- "action": discrete action verb (peck, fall, jump)
- "sensory": ambient sensory detail (sunlight dappling, scent of earth)
- "state-change": transition state (light flicker → fade, dormant → active)

RULES:
- Label: 3-7 words ${sourceLang}, evocative, match source language of scene description
- sourcePhrase: exact quote from scene description (helps user verify)
- order: 1-based, sequential as beats appear in description
- Aim for 6-12 beats per scene typically. Compress only if scene very short.

TASK 2 — Extract PHYSICAL CONSISTENCY LOCK (English).

What visual elements MUST remain identical across all shots of this scene?
- Character appearance details (outfit, body coverage, distinctive marks)
- Environment markers (specific objects, plants, lighting source)
- Scale/proportion locks (subject size relative to environment)

Output as multi-line text (5-8 bullet points), pure English, ready to inject into AI prompt.

Example output for "robot covered by moss in ancient forest":
"- Subject body: completely covered by thick green moss, hanging ivy, weathered rust patches
- Left optical sensor: obscured by ivy curtain
- Coloration: weathered grey-green with patches of orange rust
- Scale: massive 3-4m humanoid, prone among ferns
- Environment: ancient forest with dappled sunlight, fern bed, mossy trees"

OUTPUT strict JSON:
{
  "beats": [
    {
      "order": 1,
      "label": "<3-7 word ${sourceLang} label>",
      "type": "<one of 5 types>",
      "sourcePhrase": "<exact quote from description>"
    },
    ...
  ],
  "physicalConsistencyLockEn": "<multi-line English lock, or empty string if scene has no specific visual elements to lock>"
}`;

  const userPrompt = `Scene ${scene.order}: ${scene.titleVi || scene.titleEn}
Setting: ${scene.settings ?? "unspecified"}

DESCRIPTION (${sourceLang}):
${sourceAction}

Parse beats + extract physical consistency lock. Return JSON.`;

  const raw = await callAi(provider, systemPrompt, userPrompt);
  const parsed = parseJsonStrict<{
    beats?: Array<{
      order?: number;
      label?: string;
      type?: string;
      sourcePhrase?: string;
    }>;
    physicalConsistencyLockEn?: string;
  }>(raw);

  const validTypes = new Set<Beat["type"]>(["camera", "subject", "action", "sensory", "state-change"]);
  const now = Date.now();
  const beats: Beat[] = (parsed.beats ?? [])
    .filter((b) => typeof b.label === "string" && b.label.trim().length > 0)
    .map((b, i) => ({
      id: `beat_${now}_${i}_${Math.random().toString(36).slice(2, 5)}`,
      order: typeof b.order === "number" ? b.order : i + 1,
      label: b.label!.trim(),
      type: validTypes.has(b.type as Beat["type"]) ? (b.type as Beat["type"]) : "action",
      sourcePhrase: b.sourcePhrase?.trim() || undefined,
      detectedAt: now,
    }))
    .sort((a, b) => a.order - b.order)
    .map((b, i) => ({ ...b, order: i + 1 })); // re-number to ensure contiguous 1-N

  const lockEn = (parsed.physicalConsistencyLockEn ?? "").trim();
  return {
    beats,
    physicalConsistencyLockEn: lockEn.length > 0 ? lockEn : undefined,
  };
}

/**
 * Bulk version: detect beats + physical lock for ALL scenes in script.
 * Auto-triggered when Stage 5 finalizes (Q-A: no user click required).
 *
 * Strategy: parallel calls per scene (1 call each), aggregate results.
 * Sprint 1.0 r7.1: tracks failed scene IDs separately so UI can show retry per scene.
 * Cost: ~N Gemini Flash calls for N scenes. Typical 6-scene film: ~$0 cost.
 */
export interface BulkBeatsResult {
  /** Successful results map (scene ID → beats + lock) */
  results: Record<string, DetectBeatsAndLockResult>;
  /** Scene IDs that failed (caller can retry individually) */
  failedSceneIds: string[];
  /** Scene IDs that succeeded but returned 0 beats (suspicious, may need retry) */
  emptySceneIds: string[];
}

export async function runDetectBeatsForAllScenes(input: {
  scenes: Array<{
    id: string;
    order: number;
    titleVi?: string;
    titleEn: string;
    actionLinesVi?: string;
    actionLinesEn: string;
    settings?: string;
  }>;
  provider?: FilmScriptProvider;
}): Promise<BulkBeatsResult> {
  const { scenes, provider } = input;
  const failedSceneIds: string[] = [];
  const emptySceneIds: string[] = [];
  // Run in parallel — Gemini Flash handles concurrent requests
  const results = await Promise.all(
    scenes.map((scene) =>
      runDetectBeatsForScene({ scene, provider })
        .then((result) => {
          if (result.beats.length === 0) {
            emptySceneIds.push(scene.id);
          }
          return result;
        })
        .catch((err) => {
          console.error(`Beat detection failed for scene ${scene.order}:`, err);
          failedSceneIds.push(scene.id);
          return { beats: [] } as DetectBeatsAndLockResult;
        })
    )
  );
  const map: Record<string, DetectBeatsAndLockResult> = {};
  scenes.forEach((scene, i) => {
    map[scene.id] = results[i];
  });
  return {
    results: map,
    failedSceneIds,
    emptySceneIds,
  };
}
