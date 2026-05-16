/**
 * KSP Image qc10 — Film Shot List Generation Engine
 *
 * Text-only AI generation. Given a scene from Script (Stage 5 output),
 * AI breaks the scene's action into 3-6 concrete shots with:
 *   - shotType (wide/medium/close-up/insert/over-shoulder/two-shot/POV)
 *   - cameraMovement (static/pan/tilt/zoom/dolly/handheld)
 *   - duration estimate
 *   - purpose (1-line narrative reason)
 *   - title (VN + EN)
 *
 * Cost: ~1 Gemini Flash call per scene (~$0 with free tier).
 * Pipeline position: SCRIPT → SHOT LIST → STORYBOARD (visual)
 *
 * This is the TEXT planning phase. Visual storyboard generation
 * (Imagen 4 grid PNGs) happens AFTER user reviews shot list and clicks
 * generate in the Storyboard section.
 */

import { callAi, type FilmScriptProvider } from "./filmScriptStages";
import type {
  FilmShot,
  FilmSceneScript,
  ProjectSettingV2,
} from "../types/project";
import {
  formatDurationsForPrompt,
  getSupportedDurations,
  clampDurationToProvider,
} from "./providerDurations";
import type { FilmCharacter } from "../types/film";

const SHOT_TYPE_VALUES: FilmShot["shotType"][] = [
  "wide_establishing",
  "medium",
  "close_up",
  "insert",
  "over_shoulder",
  "two_shot",
  "pov",
];

const CAMERA_MOVEMENT_VALUES = [
  "static",
  "pan_left",
  "pan_right",
  "tilt_up",
  "tilt_down",
  "zoom_in",
  "zoom_out",
  "dolly_in",
  "dolly_out",
  "handheld",
  "tracking",
] as const;

// ============================================================================
// PER-SCENE GENERATION
// ============================================================================

export interface RunShotListForSceneInput {
  scene: FilmSceneScript;
  characters: FilmCharacter[];
  setting: ProjectSettingV2;
  provider?: FilmScriptProvider;
  /**
   * qc17 → qc19: DEPRECATED — no longer injected into AI prompt.
   * AI now sinh shot count theo narrative (sweet spot 4-9, hard cap 16).
   * Storyboard auto-picks grid format from shot count (sceneGridPacker.pickOptimalGridFormat).
   * Kept here for backward-compat (callers passing this won't crash).
   */
  gridFormat?: string;
  /**
   * qc17: Default video provider ID — AI constrains shot durations to supported
   * values for this provider (e.g. Veo3 only 8s, Kling only 5/10s).
   * If undefined, AI uses default 1-15s range freely.
   */
  videoProviderId?: string;
}

export interface GeneratedShot {
  titleVi: string;
  titleEn: string;
  shotType: FilmShot["shotType"];
  cameraMovement: string;
  durationSeconds: number;
  purposeVi: string;
  actionVi: string;
  actionEn: string;
}

/**
 * Generate a shot list for a single scene using cinematic breakdown formula.
 * Returns array of GeneratedShot (raw AI output) — caller maps to FilmShot
 * via store action `setShotsForScene`.
 *
 * Target: 4-16 shots per scene depending on scene complexity (NOT duration).
 * 4 corresponds to a 2x2 storyboard grid; 16 corresponds to a 4x4 grid.
 *
 * Cinematic breakdown formula (per scene):
 *  - 1 ESTABLISHING shot (wide_establishing)
 *  - 2-4 ACTION shots (medium, two_shot, over_shoulder)
 *  - 2-3 DETAIL shots (insert, close_up)
 *  - 1-2 EMOTION shots (close_up)
 *  - 1 REVEAL/PAYOFF shot
 */
export async function runShotListForScene(
  input: RunShotListForSceneInput
): Promise<GeneratedShot[]> {
  const { scene, characters, setting, provider = "gemini-flash", videoProviderId } = input;
  // qc19 note: input.gridFormat still exists in type for backward-compat but is NO LONGER used.
  // Storyboard auto-picks grid format from shot count (see sceneGridPacker.pickOptimalGridFormat).

  const castSummary =
    characters
      .map((c) => `- ${c.name || `Character ${c.order}`}: ${c.description || "(no description)"}`)
      .join("\n") || "(no cast)";

  // qc19 Hướng F-9: narrative-driven shot count guidance.
  // Sweet spot 4-9 shots/scene (per AI filmmaking 2026 industry data + Jason intuition).
  // Hard cap 16 → Stage 4 wizard warns to break scene if exceeded.
  // gridFormat param kept for backward-compat but NO LONGER injected into prompt.
  // Storyboard auto-picks optimal grid format from shot count (see sceneGridPacker.pickOptimalGridFormat).
  const gridConstraint = `🎬 SHOT COUNT GUIDANCE (Hướng F-9 — narrative-driven):
- SWEET SPOT: 4-9 shots/scene (90% scenes in short AI films land here)
- HARD CAP: 16 shots/scene maximum
- Scene > 16 shots = quá phức tạp → AI nên TRẢ ÍT shots hơn, hoặc Stage 4 sẽ tự đề xuất tách thành sub-scenes

Chọn shot count theo NARRATIVE NEED (không phải grid constraint):
- Scene dialogue đơn giản, 1 location → 3-5 shots
- Scene action vừa, 1-2 locations → 6-9 shots
- Scene phức tạp (action set-piece, multi-location) → 10-16 shots (rare)

Storyboard sẽ TỰ ĐỘNG pick grid format optimal theo shot count (3×3 cho 9 shots, 4×3 cho 12, v.v.). Bạn KHÔNG cần lo grid lẻ.`;

  // qc17: Compute duration constraint instruction (Jason Q2 — Hướng D)
  let durationConstraint = `- "durationSeconds": integer 1-15`;
  if (videoProviderId) {
    const durationDesc = formatDurationsForPrompt(videoProviderId);
    const supportedList = getSupportedDurations(videoProviderId);
    if (durationDesc && supportedList.length > 0) {
      durationConstraint = `- "durationSeconds": MUST be ${durationDesc} (video provider ${videoProviderId} only supports these). Valid values: [${supportedList.join(", ")}]`;
    }
  }

  const systemPrompt = `Bạn là Director of Photography (DP) kinh nghiệm. Phân chia một SCENE thành danh sách SHOTS cụ thể theo công thức cinematic.

📐 CINEMATIC SHOT BREAKDOWN (per scene):
- 1 ESTABLISHING shot (wide_establishing) — set up location, time, mood
- 2-4 ACTION shots — show what's happening (medium, two_shot, over_shoulder)
- 2-3 DETAIL shots — show meaningful objects/textures (insert, close_up)
- 1-2 EMOTION shots — show character feelings (close_up)
- 1 REVEAL/PAYOFF shot — final moment that resolves the scene

${gridConstraint}

Adjust shot count based on:
- Scene complexity (more events/locations → more shots)
- Number of characters present (more characters → more coverage)
- Emotional weight (intimate moments need close-ups)

KHÔNG bị giới hạn bởi durationSeconds — đó chỉ là tham khảo tổng thời lượng.
Mỗi shot có thể chỉ 0.5-3 giây trong final cut.
Mục tiêu: kể chuyện CINEMATIC, truyền cảm xúc, rõ hành động.

Mỗi shot có:
- "titleVi": tiêu đề ngắn TIẾNG VIỆT (vd: "Robot tỉnh dậy", "Mắt LED sáng dần", "Tay rỉ sét cử động")
- "titleEn": same title in ENGLISH (for AI image/video prompts downstream)
- "shotType": MUST be exactly one of: ${SHOT_TYPE_VALUES.join(" | ")}
- "cameraMovement": MUST be exactly one of: ${CAMERA_MOVEMENT_VALUES.join(" | ")}
${durationConstraint}
- "purposeVi": 1 câu TIẾNG VIỆT giải thích mục đích shot (vd: "Establish setting + thời gian", "Reveal robot's consciousness")
- "actionVi": 1-2 câu TIẾNG VIỆT mô tả hành động cụ thể trong shot
- "actionEn": same action in ENGLISH (for downstream AI image prompts)

QUY TẮC:
- Shot ĐẦU TIÊN thường là wide_establishing để introduce scene
- Shot CUỐI cùng thường là reveal/payoff (medium/close_up tùy emotional intent)
- Mix shot types để không buồn chán
- camera movement = "static" cho dialogue + intimate moments
- camera movement = "pan/tilt/dolly/tracking" cho action + reveals

OUTPUT JSON: { "shots": [ {...}, {...} ] }

Tất cả title/purpose/action: TIẾNG VIỆT cho user đọc; titleEn + actionEn: TIẾNG ANH cho AI prompts downstream.`;

  const userPrompt = `SCENE ${scene.order}: ${scene.titleVi || scene.titleEn}
SETTING: ${scene.settings}
DURATION (reference only): ${scene.durationSeconds}s
ACTION (English): ${scene.actionLinesEn ?? "(no action lines)"}
${(scene as any).actionLinesVi ? `ACTION (Vietnamese): ${(scene as any).actionLinesVi}` : ""}

GENRE: ${setting.genre ?? "drama"}
ANIMATION STYLE: ${setting.animationStyle ?? "live_action"}

CAST:
${castSummary}

Generate 4-16 shots theo cinematic breakdown formula above. Aim for richer coverage — phim hay cần nhiều góc quay để kể chuyện. Return as JSON.`;

  const raw = await callAi(provider, systemPrompt, userPrompt);

  // Parse + validate
  let parsed: { shots: Array<Partial<GeneratedShot>> };
  try {
    const cleaned = raw.replace(/```json\s*|\s*```/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(
      `AI returned invalid JSON for shot list: ${(err as Error).message}\n\nRaw (first 200 chars): ${raw.slice(0, 200)}`
    );
  }

  if (!parsed.shots || !Array.isArray(parsed.shots) || parsed.shots.length === 0) {
    throw new Error("AI returned no shots. Hãy thử lại với scene action chi tiết hơn.");
  }

  // Validate min 4 shots (cinematic minimum)
  if (parsed.shots.length < 4) {
    throw new Error(
      `AI sinh chỉ ${parsed.shots.length} shots (minimum 4 cho cinematic coverage). Hãy thử regen — AI cần chia scene thành nhiều góc quay hơn.`
    );
  }

  // Cap at 16 shots (4x4 grid maximum)
  const shotsToReturn = parsed.shots.slice(0, 16);

  // Sanitize + validate each shot
  return shotsToReturn.map((s, i) => sanitizeShot(s, i, videoProviderId));
}

// ============================================================================
// REGEN SINGLE SHOT — replace 1 shot's content while keeping its id
// ============================================================================

export interface RegenSingleShotInput {
  scene: FilmSceneScript;
  allShots: FilmShot[];
  /** Index in allShots of the shot to regen (0-based) */
  indexToRegen: number;
  characters: FilmCharacter[];
  setting: ProjectSettingV2;
  provider?: FilmScriptProvider;
  /** qc17: Clamp regenerated duration to provider's supported values */
  videoProviderId?: string;
}

/**
 * Regenerate content for a SINGLE shot in the context of the entire scene.
 * AI gets scene + all current shots + which index to regen, and must produce
 * a different shot (different shotType OR cameraMovement OR action focus).
 *
 * Returns ONE GeneratedShot — caller wraps via updateShot(sceneId, shotId, ...)
 * keeping the original shot's id.
 */
export async function regenSingleShot(
  input: RegenSingleShotInput
): Promise<GeneratedShot> {
  const { scene, allShots, indexToRegen, characters, setting, provider = "gemini-flash", videoProviderId } = input;

  if (indexToRegen < 0 || indexToRegen >= allShots.length) {
    throw new Error(`Invalid shot index ${indexToRegen} (have ${allShots.length} shots).`);
  }

  const targetShot = allShots[indexToRegen];
  const castSummary =
    characters
      .map((c) => `- ${c.name || `Character ${c.order}`}: ${c.description || "(no description)"}`)
      .join("\n") || "(no cast)";

  const shotsContext = allShots
    .map((sh, i) => {
      const marker = i === indexToRegen ? " ← REGEN THIS" : "";
      return `  ${i + 1}. [${sh.shotType}/${sh.cameraMovement}] ${sh.titleVi || sh.titleEn} — ${(sh as any).actionVi || sh.actionEn || ""}${marker}`;
    })
    .join("\n");

  const systemPrompt = `Bạn là Director of Photography (DP). User không hài lòng với 1 shot cụ thể trong shot list, muốn REGEN shot đó.

INPUT: cả scene + danh sách shots hiện tại + index shot cần regen
OUTPUT: 1 shot MỚI thay thế (KHÁC với shot cũ về shotType / cameraMovement / hoặc action focus)

QUY TẮC:
- Shot mới phải hợp lý với position trong scene (đầu/giữa/cuối)
- KHÔNG copy 100% shot cũ — phải khác về ít nhất 1 trong: shotType, cameraMovement, action focus
- Vẫn theo cinematic formula tổng thể của scene (establishing/action/detail/emotion/reveal)
- Giữ continuity với shots trước + sau

Format output JSON (chỉ 1 shot, không wrap trong "shots" array):
{
  "titleVi": "...",
  "titleEn": "...",
  "shotType": "wide_establishing|medium|close_up|insert|over_shoulder|two_shot|pov",
  "cameraMovement": "static|pan_left|pan_right|tilt_up|tilt_down|zoom_in|zoom_out|dolly_in|dolly_out|handheld|tracking",
  "durationSeconds": <number>,
  "purposeVi": "<Vietnamese>",
  "actionVi": "<Vietnamese>",
  "actionEn": "<English>"
}

Tất cả VN cho user đọc; titleEn + actionEn: EN cho AI prompts downstream.`;

  const userPrompt = `SCENE ${scene.order}: ${scene.titleVi || scene.titleEn}
SETTING: ${scene.settings}
ACTION: ${(scene as any).actionLinesVi || scene.actionLinesEn || ""}

GENRE: ${setting.genre ?? "drama"}
ANIMATION STYLE: ${setting.animationStyle ?? "live_action"}

CAST:
${castSummary}

CURRENT SHOTS (shot ${indexToRegen + 1} cần regen):
${shotsContext}

SHOT CẦN REGEN (số ${indexToRegen + 1}):
- titleVi: ${targetShot.titleVi || targetShot.titleEn}
- shotType: ${targetShot.shotType}
- cameraMovement: ${targetShot.cameraMovement}
- actionVi: ${(targetShot as any).actionVi || ""}

Sinh shot MỚI thay thế shot này. Phải khác về ít nhất 1 trong: shotType / cameraMovement / action focus. Return JSON object (không wrap trong "shots" array).`;

  const raw = await callAi(provider, systemPrompt, userPrompt);

  let parsed: Partial<GeneratedShot>;
  try {
    const cleaned = raw.replace(/```json\s*|\s*```/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(
      `AI returned invalid JSON for shot regen: ${(err as Error).message}\n\nRaw (first 200 chars): ${raw.slice(0, 200)}`
    );
  }

  return sanitizeShot(parsed, indexToRegen, videoProviderId);
}

// ============================================================================
// HELPERS
// ============================================================================

function sanitizeShot(
  s: Partial<GeneratedShot>,
  fallbackIndex: number,
  videoProviderId?: string
): GeneratedShot {
  const shotType = SHOT_TYPE_VALUES.includes(s.shotType as any)
    ? (s.shotType as FilmShot["shotType"])
    : "medium";
  const cameraMovement = CAMERA_MOVEMENT_VALUES.includes(s.cameraMovement as any)
    ? (s.cameraMovement as string)
    : "static";

  // qc17: Clamp duration. Two pass:
  //   1. Generic 1-15 clamp (fallback if AI returns out-of-bounds value)
  //   2. Provider-specific clamp (Veo3 → 8, Kling → 5/10, etc.)
  let duration =
    typeof s.durationSeconds === "number" && s.durationSeconds > 0
      ? Math.min(15, Math.max(1, Math.round(s.durationSeconds)))
      : 4;
  if (videoProviderId) {
    duration = clampDurationToProvider(duration, videoProviderId);
  }

  return {
    titleVi: s.titleVi?.trim() || `Shot ${fallbackIndex + 1}`,
    titleEn: s.titleEn?.trim() || `Shot ${fallbackIndex + 1}`,
    shotType,
    cameraMovement,
    durationSeconds: duration,
    purposeVi: s.purposeVi?.trim() || "",
    actionVi: s.actionVi?.trim() || "",
    actionEn: s.actionEn?.trim() || "",
  };
}
