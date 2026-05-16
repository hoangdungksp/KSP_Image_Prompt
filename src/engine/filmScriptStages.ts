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

Total scene durations should sum to about ${totalSeconds}s.

OUTPUT: Reply in strict JSON: { "scenes": [ { "titleVi": "...", "titleEn": "...", "settings": "...", "actionLinesVi": "...", "actionLinesEn": "...", "durationSeconds": N, "beatIds": ["beat_id_1", ...] } ] }

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

  return script;
}
