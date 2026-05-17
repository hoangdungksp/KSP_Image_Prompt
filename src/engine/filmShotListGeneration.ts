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
  RhythmRole,
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

/**
 * Sprint 1.0 r1 (Phase 1B): valid rhythm role values for AI prompt + sanitizer.
 * Keep in sync with RHYTHM_ROLE_LABELS in project.ts.
 */
const RHYTHM_ROLE_VALUES: RhythmRole[] = ["establish", "build", "peak", "release"];

/**
 * Sanitize AI-returned rhythm role.
 * Default by position if invalid: first → "establish", last → "release", middle → "build".
 */
function sanitizeRhythmRole(v: any, index: number, total: number): RhythmRole {
  if (typeof v === "string" && (RHYTHM_ROLE_VALUES as string[]).includes(v)) {
    return v as RhythmRole;
  }
  if (index === 0) return "establish";
  if (index === total - 1) return "release";
  if (index >= Math.floor(total * 0.6) && index < total - 1) return "peak";
  return "build";
}

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
  /**
   * Sprint 1.0 r7: Scene's atomic beats (auto-detected at Stage 5 finalize).
   * If provided, AI shot list MUST cover ALL beats (1 shot can cover 1-2 beats
   * via G2 soft mapping). AI returns coveredBeatIds per shot for Coverage indicator.
   */
  beats?: import("../types/project").Beat[];
}

export interface GeneratedShot {
  titleVi: string;
  titleEn: string;
  shotType: FilmShot["shotType"];
  cameraMovement: string;
  durationSeconds: number;
  purposeVi: string;
  /** Sprint 1.0 r7 (Q1 VI leak fix): EN equivalent of purposeVi. AI MUST sinh both. */
  purposeEn: string;
  actionVi: string;
  actionEn: string;
  /** Sprint 1.0 r1 (Phase 1B): cinematic micro-arc role within scene. */
  rhythmRole: RhythmRole;
  /** Sprint 1.0 r7 (Q2 per-shot mood): English lighting hint specific to this shot.
   *  AI auto-fills based on action + rhythm role. User can manually override. */
  lightingHintEn?: string;
  /** Sprint 1.0 r7: AI maps this shot to beat IDs in scene.beats (D2 mapping).
   *  Used for Coverage indicator in Shot List section. */
  coveredBeatIds?: string[];
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
  const { scene, characters, setting, provider = "gemini-flash", videoProviderId, beats } = input;
  // qc19 note: input.gridFormat still exists in type for backward-compat but is NO LONGER used.
  // Storyboard auto-picks grid format from shot count (see sceneGridPacker.pickOptimalGridFormat).

  const castSummary =
    characters
      .map((c) => `- ${c.name || `Character ${c.order}`}: ${c.description || "(no description)"}`)
      .join("\n") || "(no cast)";

  // Sprint 1.0 r7: Beats injection if available
  // Sprint 1.0 r7.1 (Bug fix): Strengthen instructions — AI was producing 7 shots
  // for 10 beats by defaulting to "sweet spot 4-9". Now beat count drives shot count.
  const beatsBlock = beats && beats.length > 0
    ? `\n\n🎯 SCENE BEATS (${beats.length} atomic narrative units AI MUST cover):
${beats.map((b) => `[${b.id}] Beat ${b.order} [${b.type}]: ${b.label}${b.sourcePhrase ? ` — quote: "${b.sourcePhrase}"` : ""}`).join("\n")}

⚠️ CRITICAL BEAT COVERAGE RULES (override any other shot count guidance):
- This scene has ${beats.length} beats. Target shot count = ${beats.length} (1 shot per beat ideal).
- HARD MINIMUM: ${Math.max(4, Math.ceil(beats.length * 0.8))} shots (no fewer, even if "sweet spot" rules suggest less).
- HARD MAXIMUM: ${beats.length + 2} shots (avoid over-coverage).
- EVERY beat MUST be covered by at least 1 shot — DO NOT skip beats.
- 1 shot CAN cover 1-2 ADJACENT beats only if they are tightly similar (e.g., merge "claws on moss" + "tiny grip texture"). DO NOT merge across rhythm changes.
- DO NOT merge beats of different types (camera + state-change = always separate shots).
- For EACH shot, return "coveredBeatIds": NON-EMPTY array of beat IDs (copy exact beat IDs from list above like "${beats[0].id}"). EVERY beat ID must appear in at least one shot's coveredBeatIds.
- If you cannot cover all ${beats.length} beats, you MUST sinh more shots. Beat coverage takes priority over the 4-9 "sweet spot" rule.`
    : "";

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

${gridConstraint}${beatsBlock}

Adjust shot count based on:
- Scene complexity (more events/locations → more shots)
- Number of characters present (more characters → more coverage)
- Emotional weight (intimate moments need close-ups)

KHÔNG bị giới hạn bởi durationSeconds — đó chỉ là tham khảo tổng thời lượng.
Mỗi shot có thể chỉ 0.5-3 giây trong final cut.
Mục tiêu: kể chuyện CINEMATIC, truyền cảm xúc, rõ hành động.

⚡ Sprint 1.0 r7 — CAMERA MOVEMENT VARIETY (CRITICAL):
- DO NOT default to "static" for every shot — visual variety is essential
- ESTABLISHING shots: use pan/tilt to reveal SPACE (pan_right reveal, tilt_down reveal)
- BUILD shots: use tracking/dolly to follow character motion
- PEAK shots: use static OR slow dolly_in for emotional weight + micro-expression
- DETAIL/INSERT shots: zoom_in or static (intimate macro feel)
- ACTION shots: handheld/tracking for energy
- DIALOGUE shots: static lock-off for stability
- Aim for AT LEAST 3 different camera movements across the shot list (don't pick same value for all)

Mỗi shot có:
- "titleVi": tiêu đề ngắn TIẾNG VIỆT (vd: "Robot tỉnh dậy", "Mắt LED sáng dần", "Tay rỉ sét cử động")
- "titleEn": same title in ENGLISH (for AI image/video prompts downstream)
- "shotType": MUST be exactly one of: ${SHOT_TYPE_VALUES.join(" | ")}
- "cameraMovement": MUST be exactly one of: ${CAMERA_MOVEMENT_VALUES.join(" | ")} — VARY across shots per rules above
${durationConstraint}
- "purposeVi": 1 câu TIẾNG VIỆT giải thích mục đích shot (vd: "Establish setting + thời gian", "Reveal robot's consciousness")
- "purposeEn": 1 sentence ENGLISH equivalent of purposeVi — REQUIRED, used in AI prompts downstream (Sprint 1.0 r7 Q1 fix — prevent VI leak)
- "actionVi": 1-2 câu TIẾNG VIỆT mô tả hành động cụ thể trong shot
- "actionEn": same action in ENGLISH (for downstream AI image prompts)
- "rhythmRole": MUST be exactly one of: ${RHYTHM_ROLE_VALUES.join(" | ")} — cinematic micro-arc role within scene:
    * "establish" — shot đầu set baseline (location, time, mood) — thường wide
    * "build"     — leo dốc tension (action chính, dialogue exchange, tension build) — medium/2-shot
    * "peak"      — đỉnh cảm xúc của scene's micro-arc — CU/ECU dày
    * "release"   — pull back kết scene, transition — wide hoặc cut
    Quy tắc phân bổ: shot 1 thường "establish"; 60% giữa "build"; 1-2 shots cuối-giữa "peak"; shot cuối "release"
- "lightingHintEn": short ENGLISH lighting direction specific to THIS shot (Sprint 1.0 r7 Q2 — per-shot mood variety). Example: "golden-hour key light through canopy, atmospheric haze" / "tight shallow DOF, single blue accent on subject's eye" / "harsh top-light, deep shadows" / "macro detail lighting, sharp focus on textures". REQUIRED — never empty. Vary across shots to match action context.${beats && beats.length > 0 ? `
- "coveredBeatIds": array of beat IDs from SCENE BEATS list this shot captures. Use [] if AI cannot map to any specific beat. EVERY beat MUST appear in at least one shot's coveredBeatIds.` : ""}

QUY TẮC:
- Shot ĐẦU TIÊN thường là wide_establishing để introduce scene
- Shot CUỐI cùng thường là reveal/payoff (medium/close_up tùy emotional intent)
- Mix shot types để không buồn chán
- camera movement = "static" cho dialogue + intimate moments (NHƯNG không phải tất cả — VARY!)
- camera movement = "pan/tilt/dolly/tracking" cho action + reveals

OUTPUT JSON: { "shots": [ {...}, {...} ] }

Tất cả title/purpose/action: TIẾNG VIỆT cho user đọc; titleEn + actionEn + purposeEn + lightingHintEn: TIẾNG ANH cho AI prompts downstream.`;

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
  const totalCount = shotsToReturn.length;
  const sanitized = shotsToReturn.map((s, i) => sanitizeShot(s, i, videoProviderId, totalCount));

  // Sprint 1.0 r7.1 (Bug 5 fix): Fallback heuristic — if AI returned empty/incomplete
  // coveredBeatIds despite beats being passed, do fuzzy keyword match between shot
  // actionEn/titleEn and beat labels to auto-link. Better than 0/N coverage display.
  if (beats && beats.length > 0) {
    return autoFillCoveredBeatIds(sanitized, beats);
  }
  return sanitized;
}

/**
 * Sprint 1.0 r7.1 fallback: when AI doesn't return coveredBeatIds (or returns invalid IDs),
 * fuzzy-match shot's actionEn + titleEn against beat labels.
 *
 * Heuristic per shot:
 *   1. Tokenize shot text (action + title) into lowercase keywords (skip stopwords)
 *   2. Tokenize each beat label same way
 *   3. Compute overlap count: shot↔beat keyword Jaccard-like score
 *   4. Assign shot to beat(s) with highest score (≥1 keyword match)
 *
 * Beats with multiple shots: keep all matching shot IDs.
 * Shots with no clear match: assigned to nearest unassigned beat by order.
 */
function autoFillCoveredBeatIds(shots: GeneratedShot[], beats: import("../types/project").Beat[]): GeneratedShot[] {
  // Skip if AI already filled correctly (every beat has coverage AND every shot has coveredBeatIds)
  const validBeatIds = new Set(beats.map((b) => b.id));
  const allShotsHaveCoverage = shots.every(
    (s) => s.coveredBeatIds && s.coveredBeatIds.length > 0 && s.coveredBeatIds.some((id) => validBeatIds.has(id))
  );
  if (allShotsHaveCoverage) return shots;

  // Stopwords (Vietnamese + English) to skip from tokenization
  const STOPWORDS = new Set([
    "the", "a", "an", "of", "in", "on", "at", "to", "for", "and", "or", "but",
    "with", "from", "by", "as", "is", "are", "was", "were", "be", "been",
    "shot", "scene", "the", "this", "that", "these", "those",
    "của", "và", "là", "có", "không", "cho", "với", "trong", "tại", "đã", "sẽ",
    "một", "các", "những", "thì", "mà", "ở", "khi", "đến", "vào", "ra", "nó",
  ]);
  const tokenize = (text: string): Set<string> => {
    const tokens = text
      .toLowerCase()
      .replace(/[^a-zà-ỹ0-9\s]/gi, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
    return new Set(tokens);
  };

  const beatTokensByID = new Map<string, Set<string>>();
  for (const beat of beats) {
    beatTokensByID.set(
      beat.id,
      tokenize(beat.label + " " + (beat.sourcePhrase ?? ""))
    );
  }

  // For each shot, score against each beat, pick top matches
  return shots.map((shot, shotIdx) => {
    // If AI already provided valid coverage, keep it
    if (shot.coveredBeatIds && shot.coveredBeatIds.some((id) => validBeatIds.has(id))) {
      return shot;
    }

    const shotTokens = tokenize(
      (shot.actionEn ?? "") + " " + (shot.titleEn ?? "") + " " + (shot.actionVi ?? "") + " " + (shot.titleVi ?? "")
    );

    // Score against each beat
    const scores: Array<{ beatId: string; score: number; beatOrder: number }> = [];
    for (const beat of beats) {
      const beatTokens = beatTokensByID.get(beat.id) ?? new Set();
      let overlap = 0;
      for (const t of beatTokens) {
        if (shotTokens.has(t)) overlap += 1;
      }
      if (overlap > 0) {
        scores.push({ beatId: beat.id, score: overlap, beatOrder: beat.order });
      }
    }

    // Pick top 2 matches (allow shot to cover 2 adjacent beats)
    scores.sort((a, b) => b.score - a.score);
    const topMatches = scores.slice(0, 2).map((s) => s.beatId);

    // Fallback: if no keyword match, distribute shot to nearest beat by position
    // (shotIdx / shots.length) → beatIdx position
    const fallbackBeatIdx = Math.min(
      beats.length - 1,
      Math.floor((shotIdx / shots.length) * beats.length)
    );
    const fallbackBeatId = beats[fallbackBeatIdx].id;

    return {
      ...shot,
      coveredBeatIds: topMatches.length > 0 ? topMatches : [fallbackBeatId],
    };
  });
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
  "purposeVi": "<Vietnamese 1 sentence>",
  "purposeEn": "<English 1 sentence>",
  "actionVi": "<Vietnamese 1-2 sentences>",
  "actionEn": "<English 1-2 sentences>",
  "rhythmRole": "establish|build|peak|release",
  "lightingHintEn": "<short English lighting hint specific to this shot>"
}

Tất cả VN cho user đọc; titleEn + actionEn + purposeEn + lightingHintEn: EN cho AI prompts downstream.`;

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

  return sanitizeShot(parsed, indexToRegen, videoProviderId, allShots.length);
}

// ============================================================================
// HELPERS
// ============================================================================

function sanitizeShot(
  s: Partial<GeneratedShot>,
  fallbackIndex: number,
  videoProviderId?: string,
  totalCount: number = 1
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
    // Sprint 1.0 r7: Q1 VI leak fix — AI must sinh purposeEn
    purposeEn: s.purposeEn?.trim() || "",
    actionVi: s.actionVi?.trim() || "",
    actionEn: s.actionEn?.trim() || "",
    // Sprint 1.0 r1 (Phase 1B)
    rhythmRole: sanitizeRhythmRole(s.rhythmRole, fallbackIndex, Math.max(1, totalCount)),
    // Sprint 1.0 r7: Q2 per-shot mood — AI fills lighting hint
    lightingHintEn: s.lightingHintEn?.trim() || undefined,
    // Sprint 1.0 r7: D2 beat mapping
    coveredBeatIds: Array.isArray(s.coveredBeatIds)
      ? s.coveredBeatIds.filter((id) => typeof id === "string" && id.length > 0)
      : undefined,
  };
}
