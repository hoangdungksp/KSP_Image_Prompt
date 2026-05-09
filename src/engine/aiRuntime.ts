/**
 * KSP Image v0.9.0 — AI Runtime client
 *
 * Bridges 7 prompt templates (engine/ai_prompts) → actual API calls.
 * Reads API keys from useGlobalStore.
 * Returns typed responses or throws with user-friendly messages.
 *
 * Supports: Gemini Flash / Gemini Pro / OpenAI 4o
 */

import { useGlobalStore } from "../store/useGlobalStore";
import {
  SCRIPT_WRITER_SYSTEM_PROMPT,
  buildScriptWriterUserPrompt,
  type ScriptWriterInput,
} from "./ai_prompts/scriptWriter";
import {
  CONCEPT_WRITER_SYSTEM_PROMPT,
  buildConceptWriterUserPrompt,
  type ConceptWriterInput,
} from "./ai_prompts/conceptWriter";
import {
  SHOTS_FOR_SCENE_SYSTEM_PROMPT,
  buildShotsForSceneUserPrompt,
  FRAMES_FOR_SHOT_SYSTEM_PROMPT,
  buildFramesForShotUserPrompt,
  SINGLE_FRAME_REGEN_SYSTEM_PROMPT,
  buildSingleFrameRegenUserPrompt,
} from "./ai_prompts/storyboardGenerators";
import {
  MUSIC_BRIEF_SYSTEM_PROMPT,
  buildMusicBriefUserPrompt,
  VOICE_SCRIPT_SYSTEM_PROMPT,
  buildVoiceScriptUserPrompt,
} from "./ai_prompts/musicVoiceImage";
import type {
  FilmScript,
  TvcConcept,
  FilmSceneScript,
  FilmShot,
  FilmCharacterV2,
  AnimationStyleV2,
  AspectRatioV2,
  FilmGenreV2,
  ShotFrame,
} from "../types/v0_9_0";

// ============================================================================
// PROVIDER ENDPOINTS
// ============================================================================

const GEMINI_FLASH_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const GEMINI_PRO_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent";
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

export type AiProvider = "gemini-flash" | "gemini-pro" | "openai-4o";

// ============================================================================
// LOW-LEVEL: Generate JSON from any prompt
// ============================================================================

interface GenerateOptions {
  provider: AiProvider;
  systemPrompt: string;
  userPrompt: string;
  expectJson?: boolean;       // Default true
  maxTokens?: number;         // Default 4096
  temperature?: number;       // Default 0.7
}

async function generateText(opts: GenerateOptions): Promise<string> {
  const apiKeys = useGlobalStore.getState().apiKeys;
  const { provider, systemPrompt, userPrompt, expectJson = true, maxTokens = 4096, temperature = 0.7 } = opts;

  if (provider === "openai-4o") {
    if (!apiKeys.openai) {
      throw new Error("Chưa có OpenAI API key. Vào Project Setting → API Keys để thêm.");
    }

    const response = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKeys.openai}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: maxTokens,
        temperature,
        ...(expectJson ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${err.slice(0, 200)}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? "";
  }

  // Gemini Flash or Pro
  if (!apiKeys.gemini) {
    throw new Error("Chưa có Gemini API key. Vào Project Setting → API Keys để thêm.");
  }

  const endpoint = provider === "gemini-pro" ? GEMINI_PRO_ENDPOINT : GEMINI_FLASH_ENDPOINT;
  const url = `${endpoint}?key=${apiKeys.gemini}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }],
        },
      ],
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        ...(expectJson ? { responseMimeType: "application/json" } : {}),
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  if (!text) {
    throw new Error("Gemini returned empty response. Try again or switch provider.");
  }

  return text;
}

/**
 * Parse JSON output, stripping markdown code fences if present.
 */
function parseJsonOutput<T>(text: string): T {
  // Strip ```json ... ``` if AI ignored instruction
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    throw new Error(
      `AI returned invalid JSON. First 200 chars: "${cleaned.slice(0, 200)}". Try regenerating.`
    );
  }
}

// ============================================================================
// HIGH-LEVEL: Typed AI generators
// ============================================================================

export interface ScriptWriterRawOutput {
  title_en: string;
  title_vi: string;
  logline: string;
  logline_vi?: string;
  synopsis_en: string;
  synopsis_vi?: string;
  scenes: Array<{
    id: string;
    order: number;
    title_en: string;
    title_vi?: string;
    settings: string;
    duration_seconds: number;
    act: string;
    action_lines_en: string;
    action_lines_vi?: string;
    dialog: Array<{
      character_name: string;
      line_en: string;
      line_vi?: string;
      parenthetical?: string;
    }>;
    sfx: string[];
    music_brief: string;
    transition_to_next?: string;
  }>;
  reasoning?: string;
}

/**
 * Generate full Film Script from idea.
 */
export async function generateFilmScript(
  input: ScriptWriterInput,
  provider: AiProvider = "gemini-flash"
): Promise<{ script: FilmScript; reasoning?: string }> {
  const userPrompt = buildScriptWriterUserPrompt(input);
  const text = await generateText({
    provider,
    systemPrompt: SCRIPT_WRITER_SYSTEM_PROMPT,
    userPrompt,
    expectJson: true,
    maxTokens: 8192,  // Long output expected
  });

  const raw = parseJsonOutput<ScriptWriterRawOutput>(text);

  // Map raw → FilmScript with proper IDs and metadata
  const now = Date.now();
  const script: FilmScript = {
    titleEn: raw.title_en,
    titleVi: raw.title_vi,
    logline: raw.logline,
    loglineVi: raw.logline_vi,
    synopsisEn: raw.synopsis_en,
    synopsisVi: raw.synopsis_vi,
    scenes: raw.scenes.map((s, i): FilmSceneScript => ({
      id: s.id || `scene_${i + 1}_${now}`,
      order: s.order ?? i,
      titleEn: s.title_en,
      titleVi: s.title_vi,
      settings: s.settings,
      durationSeconds: s.duration_seconds,
      act: (s.act as FilmSceneScript["act"]) ?? "rising",
      actionLinesEn: s.action_lines_en,
      actionLinesVi: s.action_lines_vi,
      dialog: (s.dialog ?? []).map((d) => ({
        characterId: input.cast.find((c) => c.name === d.character_name)?.id ?? "",
        characterName: d.character_name,
        lineEn: d.line_en,
        lineVi: d.line_vi,
        parenthetical: d.parenthetical,
      })),
      sfx: s.sfx ?? [],
      musicBrief: s.music_brief ?? "",
      transitionToNext: s.transition_to_next,
    })),
    aiProvider: provider as any,
    aiReasoning: raw.reasoning,
    versions: [],
    createdAt: now,
    updatedAt: now,
  };

  return { script, reasoning: raw.reasoning };
}

// ----------------------------------------------------------------------------

export interface ConceptWriterRawOutput {
  logline_en: string;
  logline_vi?: string;
  synopsis_en: string;
  synopsis_vi?: string;
  tone: string[];
  audience: { demographic: string; psychographic: string; platform: string };
  key_messages: string[];
  visual_references: string[];
  brand_voice: string;
  cta_logo_end: string;
  reasoning?: string;
}

/**
 * Generate TVC Concept treatment.
 */
export async function generateTvcConcept(
  input: ConceptWriterInput,
  provider: AiProvider = "gemini-flash"
): Promise<{ concept: TvcConcept; reasoning?: string }> {
  const userPrompt = buildConceptWriterUserPrompt(input);
  const text = await generateText({
    provider,
    systemPrompt: CONCEPT_WRITER_SYSTEM_PROMPT,
    userPrompt,
    expectJson: true,
  });

  const raw = parseJsonOutput<ConceptWriterRawOutput>(text);
  const now = Date.now();

  const concept: TvcConcept = {
    loglineEn: raw.logline_en,
    loglineVi: raw.logline_vi,
    synopsisEn: raw.synopsis_en,
    synopsisVi: raw.synopsis_vi,
    tone: raw.tone ?? [],
    audience: raw.audience,
    keyMessages: raw.key_messages ?? [],
    visualReferences: raw.visual_references ?? [],
    brandVoice: raw.brand_voice ?? "",
    ctaLogoEnd: raw.cta_logo_end ?? "",
    aiProvider: provider as any,
    aiReasoning: raw.reasoning,
    versions: [],
    createdAt: now,
    updatedAt: now,
  };

  return { concept, reasoning: raw.reasoning };
}

// ----------------------------------------------------------------------------

export interface ShotsRawOutput {
  shots: Array<{
    id?: string;
    order: number;
    title_en: string;
    title_vi?: string;
    shot_type: string;
    duration_seconds: number;
    grid_format: string;
    camera_movement: string;
    purpose?: string;
    action_summary_en: string;
  }>;
}

export async function generateShotsForScene(
  scene: FilmSceneScript,
  animationStyle: AnimationStyleV2,
  aspectRatio: AspectRatioV2,
  cast: FilmCharacterV2[],
  provider: AiProvider = "gemini-flash"
): Promise<FilmShot[]> {
  const userPrompt = buildShotsForSceneUserPrompt(scene, animationStyle, aspectRatio, cast);
  const text = await generateText({
    provider,
    systemPrompt: SHOTS_FOR_SCENE_SYSTEM_PROMPT,
    userPrompt,
    expectJson: true,
  });

  const raw = parseJsonOutput<ShotsRawOutput>(text);
  const now = Date.now();

  return raw.shots.map((s, i): FilmShot => ({
    id: s.id ?? `${scene.id}_shot${i + 1}_${now}`,
    order: s.order ?? i,
    titleEn: s.title_en,
    titleVi: s.title_vi,
    shotType: (s.shot_type as FilmShot["shotType"]) ?? "medium",
    durationSeconds: s.duration_seconds,
    gridFormat: (s.grid_format as FilmShot["gridFormat"]) ?? "3x3",
    cameraMovement: (s.camera_movement as FilmShot["cameraMovement"]) ?? "auto_per_genre",
    purpose: s.purpose,
    status: "draft",
  }));
}

// ----------------------------------------------------------------------------

export interface FramesRawOutput {
  frames: Array<{
    id?: string;
    order: number;
    timing_seconds: { start: number; end: number };
    role: string;
    action_en: string;
    action_vi?: string;
  }>;
}

export async function generateFramesForShot(
  shot: FilmShot,
  sceneActionLines: string,
  cast: FilmCharacterV2[],
  provider: AiProvider = "gemini-flash"
): Promise<ShotFrame[]> {
  const userPrompt = buildFramesForShotUserPrompt(shot, sceneActionLines, cast);
  const text = await generateText({
    provider,
    systemPrompt: FRAMES_FOR_SHOT_SYSTEM_PROMPT,
    userPrompt,
    expectJson: true,
  });

  const raw = parseJsonOutput<FramesRawOutput>(text);
  const now = Date.now();

  return raw.frames.map((f, i): ShotFrame => ({
    id: f.id ?? `${shot.id}_frame${i + 1}_${now}`,
    order: f.order ?? i,
    timingSeconds: f.timing_seconds,
    role: (f.role as ShotFrame["role"]) ?? "motion",
    actionEn: f.action_en,
    actionVi: f.action_vi,
    locked: false,
  }));
}

// ----------------------------------------------------------------------------

export async function regenerateSingleFrame(opts: {
  currentFrameText: string;
  prevFrameText?: string;
  nextFrameText?: string;
  userChangeRequest: string;
  animationStyle: AnimationStyleV2;
  aspectRatio: AspectRatioV2;
  cast: FilmCharacterV2[];
  sceneSettings?: string;
  provider?: AiProvider;
}): Promise<{ frameEn: string; frameVi: string; imagePrompt: string }> {
  const userPrompt = buildSingleFrameRegenUserPrompt(opts);
  const text = await generateText({
    provider: opts.provider ?? "gemini-flash",
    systemPrompt: SINGLE_FRAME_REGEN_SYSTEM_PROMPT,
    userPrompt,
    expectJson: true,
  });

  const raw = parseJsonOutput<{ frame_en: string; frame_vi: string; image_prompt: string }>(text);

  return {
    frameEn: raw.frame_en,
    frameVi: raw.frame_vi,
    imagePrompt: raw.image_prompt,
  };
}

// ----------------------------------------------------------------------------

export async function generateMusicBrief(
  scene: FilmSceneScript,
  genre: FilmGenreV2,
  provider: AiProvider = "gemini-flash"
): Promise<string> {
  const userPrompt = buildMusicBriefUserPrompt({ scene, genre });
  const text = await generateText({
    provider,
    systemPrompt: MUSIC_BRIEF_SYSTEM_PROMPT,
    userPrompt,
    expectJson: false,    // Music brief is plain text
    maxTokens: 200,
  });

  return text.trim().replace(/^["']|["']$/g, "");
}

// ----------------------------------------------------------------------------

export interface VoiceScriptRawOutput {
  dialogs: Array<{
    scene_id: string;
    character_id?: string;
    character_name: string;
    voice_characteristics: string;
    lines: Array<{
      timing_seconds: { start: number; end: number };
      text_en: string;
      text_vi?: string;
      delivery_note?: string;
    }>;
  }>;
  narrator?: {
    enabled: boolean;
    voice_characteristics: string;
    scenes: Array<{ scene_id: string; text_en: string; text_vi?: string }>;
  };
}

export async function generateVoiceScript(
  scenes: FilmSceneScript[],
  cast: FilmCharacterV2[],
  language: "vi" | "en" | "multi",
  provider: AiProvider = "gemini-flash"
): Promise<VoiceScriptRawOutput> {
  const userPrompt = buildVoiceScriptUserPrompt({ scenes, cast, language });
  const text = await generateText({
    provider,
    systemPrompt: VOICE_SCRIPT_SYSTEM_PROMPT,
    userPrompt,
    expectJson: true,
  });

  return parseJsonOutput<VoiceScriptRawOutput>(text);
}
