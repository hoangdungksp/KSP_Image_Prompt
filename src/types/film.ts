/**
 * KSP Image v0.9.3 — Film Mode Schema (rebuild from scratch)
 *
 * Replaces deprecated FilmCharacterV2 (CastSectionV09) with cleaner schema
 * following MOCKUPS_FILM.md design spec May 11, 2026.
 *
 * Key concepts (Q1-Q6 locked May 11):
 *   - Cast: multi-character cards stack vertical full-width (Q1)
 *   - Each character: 4 roles dropdown free, no constraint (Q2)
 *   - Face refs 1-4 + Body refs 1-3, NO outfit slot riêng (Q3)
 *   - AI Generate stub: modal description prose, no API call r2 (Q4)
 *   - Project Setting extend: Dialog toggle, Genre/Animation/Aspect/Duration (Q5)
 *   - Strategy: atomic build + delete CastSectionV09 trong r2 (Q6)
 *
 * Storage: Film data lives under `project.filmV093` field.
 * Image refs stored as base64 dataURL (heavy but functional cho v0.9.3 — IndexedDB v0.9.4).
 */

// ============================================================================
// CHARACTER ROLES (Q2 — 4 options, dropdown free, no constraint)
// ============================================================================

export type FilmCharacterRole = "protagonist" | "antagonist" | "companion" | "extra";

export const ROLE_LABELS: Record<FilmCharacterRole, { vi: string; en: string; emoji: string }> = {
  protagonist: { vi: "Nhân vật chính", en: "Protagonist", emoji: "⭐" },
  antagonist: { vi: "Phản diện", en: "Antagonist", emoji: "😈" },
  companion: { vi: "Bạn đồng hành", en: "Companion", emoji: "🤝" },
  extra: { vi: "Phụ", en: "Extra", emoji: "👤" },
};

// ============================================================================
// IMAGE REF
// ============================================================================

/**
 * Single image reference (face or body).
 * Inline base64 dataURL — heavy but survives reload via Zustand persist.
 * v0.9.4 will migrate to IndexedDB blob storage.
 */
export interface FilmImageRef {
  id: string;
  /** Optional anchor label ("front" / "3/4 L" / "profile" for face; "front" / "side" / "back" for body) */
  label?: string;
  /** Filename for display + ZIP export */
  filename: string;
  /** MIME type */
  mimeType: string;
  /** Optional dimensions (validate ≥1024×1024 recommended) */
  width?: number;
  height?: number;
  /** Inline base64 data URL */
  dataUrl: string;
}

// ============================================================================
// FILM CHARACTER (Q1 + Q3 + Q4)
// ============================================================================

/**
 * Single character in Film project Cast.
 *
 * Layout: vertical full-width card stack
 * Schema: single concept sheet (1 image) — user generates via ChatGPT/Banana Pro
 * using AI Concept Prompt button, then uploads the resulting character sheet
 * (front + 3/4 + back + details + palette in one image).
 *
 * Legacy faceRefs/bodyRefs preserved for backward-compat with existing user
 * projects in IndexedDB. New UI does not display them; they are read-only.
 * Migration auto-copies faceRefs[0] → conceptSheet on first load if conceptSheet
 * is empty.
 */
export interface FilmCharacter {
  id: string;
  order: number;
  /** Display name (e.g. "Robot A-17", "Chim sẻ rừng") */
  name: string;
  /** 4 roles: protagonist / antagonist / companion / extra */
  role: FilmCharacterRole;
  /** Free-text prose description (Vietnamese OK — feed AI prompt) */
  description: string;

  /**
   * Character concept sheet — single reference image containing multiple views
   * (front / 3-4 right / 3-4 left / back) + detail close-ups + color palette.
   * Recommended workflow: click "AI Concept Prompt" → copy prompt → paste into
   * ChatGPT/Banana Pro/Imagen → download generated sheet → upload here.
   *
   * Storyboard engine reads this for cast injection (replaces old faceRef-per-slot model).
   */
  conceptSheet?: FilmImageRef;

  /**
   * @deprecated Replaced by `conceptSheet` (single image). Kept for backward-compat
   * with existing user projects. Will not be displayed in new UI but data is
   * preserved on disk. Migration copies `faceRefs[0]` → `conceptSheet` on load
   * if `conceptSheet` is undefined.
   */
  faceRefs: FilmImageRef[];

  /**
   * @deprecated Replaced by `conceptSheet`. Kept for backward-compat.
   */
  bodyRefs: FilmImageRef[];

  /**
   * AI-generated character description draft.
   * If set, user has clicked "AI Generate Description" to derive a prose description
   * from idea + script context. User can still edit the text after.
   */
  aiGenDescription?: string;

  /**
   * Timestamp when AI last generated the description.
   * Used to detect stale descriptions when script is regenerated.
   * If `descriptionGeneratedAt < script.createdAt` → description is stale.
   */
  descriptionGeneratedAt?: number;
}

// ============================================================================
// FILM V0.9.3 PROJECT DATA
// ============================================================================

/**
 * All Film-mode-specific data in one bundle.
 * Lives at `project.filmV093`.
 *
 * Default values (created via createDefaultFilmV093):
 *   - characters: []
 *   - selectedCharacterId: undefined
 *
 * Project Setting fields (Dialog/Genre/AnimationStyle/AspectRatio/Duration)
 * live in `project.settingV2`, NOT here — those are top-level project metadata.
 */
export interface FilmData {
  schemaVersion: "v0.9.3-film";
  /** Multi-character cast (Q1 — vertical card list) */
  characters: FilmCharacter[];
  /** Currently selected character id (for editing focus). */
  selectedCharacterId?: string;

  /**
   * r3 (Mockup 2): generated film script.
   * Reuses existing FilmScript type from v0_9_0.ts for backward-compat with engine/aiRuntime.
   * Stage 5 quick path (1-cú generation) for r3. Multi-stage (Structure → Beats → Twists → Scenes → Dialogues)
   * lands in r7.
   *
   * Versions: last-10 kept inside script.versions[] (FilmScript native field).
   */
  script?: import("./project").FilmScript;

  /**
   * r4 (Mockup 3): shots per scene.
   * Map sceneId → FilmShot[].
   * Each shot has its own grid (2x2/2x3/3x2/3x3/4x3) + status badge.
   * Script.scenes is the source of truth for scene IDs; shots derived AI or manual.
   */
  shotsBySceneId?: Record<string, import("./project").FilmShot[]>;

  /**
   * r3: AI provider preference for script generation (Gemini Flash vs OpenAI 4o).
   * Lives at FilmData level (not settingV2.aiProviders) for per-project override.
   */
  scriptProvider?: "gemini-flash" | "openai-4o";

  /**
   * r5 (Mockup 4): currently expanded shot id (drill-down drawer).
   * Singleton — only one shot expanded at a time across all scenes.
   * Toggling: click same shot collapses; click another auto-collapses old.
   */
  expandedShotId?: string;

  /**
   * r5 (Mockup 4): user-defined custom video providers (Grok et al).
   * 4 defaults (Seedance/Veo3/Kling/Sora) live in DEFAULT_VIDEO_PROVIDERS constant — NOT here.
   * Custom providers persist per-project.
   */
  customVideoProviders?: FilmVideoProvider[];

  /**
   * r6 (Mockup 5): per-character voice provider assignment (when dialog="has_dialog").
   * Map characterId → provider id ("elevenlabs" | "google-tts" | null).
   * null means "skip voice for this character" (e.g., silent extra).
   */
  voiceAssignments?: Record<string, FilmVoiceProvider | null>;

  /**
   * r6 (Mockup 5): fallback voice provider for characters without per-char assignment.
   * Default "elevenlabs" — ElevenLabs has the best quality but pricier.
   */
  voiceProviderGlobal?: FilmVoiceProvider;

  /**
   * r6 (Mockup 5): SFX source provider (project-level — applies across all scenes).
   * - "freesound" → auto-generate search URLs in Bundle Export's freesound_links.txt
   * - "epidemic" → manual search hints (Epidemic Sound paid)
   * - "suno-sfx" → generate Suno SFX-mode prompts
   */
  sfxProvider?: FilmSfxProvider;

  // ====================================================================
  // r7 — MULTI-STAGE SCRIPT WIZARD (Stages 1-4 + revert logic)
  // ====================================================================
  /**
   * r7: Script generation mode (Q2 r7 lock).
   * - "quick" (default): r3 Stage 5 1-call generation. UI hides wizard breadcrumb.
   * - "multi-stage": full wizard Structure → Beats → Twists → Scenes → Dialogues.
   */
  scriptMode?: FilmScriptMode;
  /** r7: Current active stage in multi-stage wizard. */
  scriptStage?: FilmScriptStage;
  /** r7 Stage 1 output: chosen framework + content overview. */
  scriptStructure?: FilmScriptStructure;
  /** r7 Stage 2 output: 7-9 beats (editable). */
  scriptBeats?: FilmScriptBeat[];
  /** r7 Stage 3 output: 1-3 twists (accept/reject toggles). */
  scriptTwists?: FilmScriptTwist[];
  /**
   * explicit lock flag for Stage 3.
   * - undefined/false: user is still picking accept/reject on twist cards
   *   → isStageDone("twists") returns false → ActiveStage3 renders with cards visible
   * - true: user clicked "Tiếp: ④ Phân cảnh →" to confirm twist selections
   *   → isStageDone("twists") returns true → stage shows green ✓ in stepper
   * Reset to false when setScriptTwists runs (AI regen → user must re-confirm).
   * Cleared when revertToStage("twists") or revertToStage upstream.
   * Backward-compat: projects without this field are treated as locked if
   * any downstream stage (scenes/script) already has data — see isStageDone.
   */
  scriptTwistsLocked?: boolean;
  /** r7 Stage 4 output: preliminary scenes (before Stage 5 dialogues). */
  scriptIntermediateScenes?: FilmScriptIntermediateScene[];
  /**
   * (parallel Twist lock pattern): explicit lock flag for Stage 4.
   * - undefined/false: user is still reviewing Stage 4 scenes (may want to split or dismiss warnings)
   *   → isStageDone("scenes") returns false → ActiveStage4 renders with warning badges visible
   * - true: user clicked "Tiếp: ⑤ Lời thoại →" to confirm scene structure
   *   → isStageDone("scenes") returns true → stage shows green ✓ in stepper
   * Reset to false when setScriptIntermediateScenes runs (AI regen → user must re-confirm).
   * Cleared when revertToStage("scenes" or upstream).
   * Backward-compat: projects without this field are treated as locked if
   * downstream script (Stage 5 dialogues) is set — see isStageDone.
   */
  scriptScenesLocked?: boolean;
  /**
   * Optional user-specified scene count for Stage 4.
   * If unset, AI decides (default ~4-7 for 5-min films).
   * User adjusts to force more/fewer scenes for richer storytelling.
   */
  scriptTargetSceneCount?: number;

  /**
   * Per-project default crop settings. Used as pre-fill in Preview & Crop
   * modal when shot has no per-shot cropSettings override. User sets default
   * 1 time (vd Nano Banana 2752×1536) → modal pre-fills for all shots; when
   * generating a single shot from ChatGPT, user overrides per-shot.
   */
  defaultCropSettings?: import("./project").ShotCropSettings;

  /**
   * Sprint 1.0 r5 (Phase 2B): detected setup → payoff pairs across scenes.
   * AI scans full script via `runSetupPayoffDetect` engine function.
   * Pairs persisted so user doesn't re-run AI every dashboard open.
   * UI shows pairs as labeled arcs in pacing dashboard with scene anchors.
   */
  setupPayoffPairs?: import("./project").SetupPayoffPair[];

  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// r6 — VOICE + SFX PROVIDER TYPES (Mockup 5)
// ============================================================================

export type FilmVoiceProvider = "elevenlabs" | "google-tts";
export type FilmSfxProvider = "freesound" | "epidemic" | "suno-sfx";

export const VOICE_PROVIDER_LABELS: Record<FilmVoiceProvider, { name: string; pricing: string }> = {
  elevenlabs: { name: "ElevenLabs", pricing: "$0.18/1k chars" },
  "google-tts": { name: "Google TTS", pricing: "$4/1M chars" },
};

export const SFX_PROVIDER_LABELS: Record<FilmSfxProvider, { name: string; description: string }> = {
  freesound: { name: "Freesound.org", description: "Free CC-licensed, auto search URLs" },
  epidemic: { name: "Epidemic Sound", description: "Paid subscription, manual search" },
  "suno-sfx": { name: "Suno SFX", description: "AI generate sound effects via prompts" },
};

// ============================================================================
// r5 — VIDEO PROVIDER (Mockup 4)
// ============================================================================

/**
 * Video AI provider config — for animation prompt generation + char count.
 * 4 defaults (isCustom: false) are NOT user-editable.
 * Custom providers (isCustom: true) — user can add/edit/delete (e.g., Grok Video).
 *
 * Required: id + name. All other fields optional (Hướng A — Jason confirmed Q5 r5).
 * If charLimit missing → char count badge hidden (no color logic).
 */
export interface FilmVideoProvider {
  id: string;
  name: string;
  pricingPerSec?: string;     // Free-text display, e.g. "$0.15/s"
  maxDurationSec?: number;
  charLimit?: number;
  isCustom: boolean;
}

/**
 * 4 default providers seeded per MOCKUPS_FILM.md r5 spec.
 * Hard-coded — NEVER user-editable.
 * Custom providers (e.g., Grok Video) live in FilmData.customVideoProviders.
 */
export const DEFAULT_VIDEO_PROVIDERS: FilmVideoProvider[] = [
  {
    id: "seedance-2-pro",
    name: "Seedance 2.0 Pro",
    pricingPerSec: "$0.15/s",
    maxDurationSec: 12,
    charLimit: 4000,
    isCustom: false,
  },
  {
    id: "veo-3",
    name: "Veo 3",
    pricingPerSec: "$0.30/s",
    maxDurationSec: 8,
    charLimit: 2500,
    isCustom: false,
  },
  {
    id: "kling-2",
    name: "Kling 2.0",
    pricingPerSec: "$0.10/s",
    maxDurationSec: 10,
    charLimit: 2500,
    isCustom: false,
  },
  {
    id: "sora",
    name: "Sora",
    pricingPerSec: "$0.50/s",
    maxDurationSec: 20,
    charLimit: 4000,
    isCustom: false,
  },
  {
    id: "gemini-omni",
    name: "Gemini Omni",
    maxDurationSec: 10,
    isCustom: false,
  },
];

/**
 * Resolve provider by id — checks defaults first then customs.
 * Returns undefined if not found (shouldn't normally happen — auto-fallback to first default).
 */
export function resolveVideoProvider(
  id: string | undefined,
  customs: FilmVideoProvider[] | undefined
): FilmVideoProvider {
  if (!id) return DEFAULT_VIDEO_PROVIDERS[0];
  const fromDefault = DEFAULT_VIDEO_PROVIDERS.find((p) => p.id === id);
  if (fromDefault) return fromDefault;
  const fromCustom = (customs ?? []).find((p) => p.id === id);
  if (fromCustom) return fromCustom;
  return DEFAULT_VIDEO_PROVIDERS[0]; // fallback
}

// ============================================================================
// r5 — SHOT FRAME (auto-cropped placeholder)
// ============================================================================

/**
 * One auto-cropped frame slot in r5 Image Gen.
 * Derived from grid format (2×2 → 4 frames, 3×3 → 9 frames, etc.).
 * dataUrl optional — empty if user hasn't uploaded/cropped that cell yet.
 * locked: prevent regen of this specific frame.
 */
export interface ShotR5Frame {
  id: string;
  order: number;            // 1-based, left-to-right top-to-bottom
  dataUrl?: string;         // base64 cropped cell
  locked?: boolean;
}

export function createShotR5Frames(gridFormat: string): ShotR5Frame[] {
  const [rows, cols] = gridFormat.split("x").map(Number);
  const n = (rows || 3) * (cols || 3);
  return Array.from({ length: n }, (_, i) => ({
    id: `frame_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 5)}`,
    order: i + 1,
  }));
}

// ============================================================================
// DIALOG MODE (Q5 — project-wide property, NOT per-character)
// ============================================================================

/**
 * Project-wide dialog mode (Q5 lock).
 * Lives in project.settingV2.dialog (added to ProjectSettingV2 in this sprint).
 *
 * Q5: 2-way (Có thoại / Không thoại) — NOT 3-way.
 * Phim "Có thoại" vẫn có thể add Narrator (configurable in Voice section).
 */
export type FilmDialogMode = "has_dialog" | "no_dialog";

// ============================================================================
// FACTORIES
// ============================================================================

export function createDefaultFilmV093(): FilmData {
  const now = Date.now();
  return {
    schemaVersion: "v0.9.3-film",
    characters: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createFilmCharacter(
  order: number,
  role: FilmCharacterRole = "protagonist"
): FilmCharacter {
  return {
    id: `char_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    order,
    name: "",
    role,
    description: "",
    faceRefs: [],
    bodyRefs: [],
  };
}

export function createFilmImageRef(
  filename: string,
  mimeType: string,
  dataUrl: string,
  label?: string,
  width?: number,
  height?: number
): FilmImageRef {
  return {
    id: `imgref_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    filename,
    mimeType,
    dataUrl,
    label,
    width,
    height,
  };
}

// ============================================================================
// CONSTRAINTS (Q3 lock)
// ============================================================================

export const MAX_FACE_REFS_FILM = 4;
export const MAX_BODY_REFS = 3;
export const MIN_IMAGE_DIMENSION = 1024;

/**
 * Default labels for face refs by slot index (Film mode).
 * Slot 0 anchor "front", subsequent user-editable.
 */
export const DEFAULT_FACE_LABELS_FILM: string[] = ["front", "3/4 L", "3/4 R", "profile"];

/**
 * Default labels for body refs by slot index (Film mode).
 * Front/side/back recommended for full coverage.
 */
export const DEFAULT_BODY_LABELS: string[] = ["front", "side", "back"];

// ============================================================================
// r7 — MULTI-STAGE SCRIPT WIZARD TYPES (Stages 1-4)
// ============================================================================

export type FilmScriptMode = "quick" | "multi-stage";

export type FilmScriptStage =
  | "structure"
  | "beats"
  | "twists"
  | "scenes"
  | "dialogues";

/** Stage 1 — narrative framework chosen by AI or user.
 * expanded from 4 → 6 frameworks. Mystery thriller + Tragedy doom
 * added to match Preview Flow Step 1 default archetype options.
 */
export type FilmStoryFramework =
  | "three-act"
  | "hero-journey"
  | "save-the-cat"
  | "kishotenketsu"
  | "mystery-thriller"
  | "tragedy-doom";

export const FRAMEWORK_LABELS: Record<FilmStoryFramework, { name: string; description: string; defaultBeatCount: number }> = {
  "three-act": {
    name: "3-Act Structure (Cấu trúc 3 hồi)",
    description: "Setup → Confrontation → Resolution. Phù hợp đa số phim ngắn.",
    defaultBeatCount: 7,
  },
  "hero-journey": {
    name: "Hero's Journey (Hành trình Anh hùng)",
    description: "12 chặng Campbell monomyth. Phù hợp phim epic/fantasy/phiêu lưu.",
    defaultBeatCount: 12,
  },
  "save-the-cat": {
    name: "Save the Cat (Snyder)",
    description: "15 beat blueprint. Phù hợp phim commercial/genre cụ thể.",
    defaultBeatCount: 15,
  },
  kishotenketsu: {
    name: "Kishōtenketsu (Khởi Thừa Chuyển Kết)",
    description: "4 hồi kiểu Nhật (起承転結): Mở → Phát triển → Bước ngoặt → Kết. Phù hợp phim ngắn.",
    defaultBeatCount: 4,
  },
  "mystery-thriller": {
    name: "Mystery Thriller (Bí ẩn ly kỳ)",
    description: "Clue planting → red herring → mid reveal → final twist. Phù hợp phim noir/detective/suspense.",
    defaultBeatCount: 8,
  },
  "tragedy-doom": {
    name: "Tragedy Doom (Bi kịch định mệnh)",
    description: "Hubris → recognition → catastrophe. Protagonist có fatal flaw → tự huỷ. Phù hợp phim drama bi kịch.",
    defaultBeatCount: 5,
  },
};

export interface FilmScriptStructure {
  framework: FilmStoryFramework;
  /** English overview — used for image/video AI prompts downstream. */
  contentEn: string;
  /* * Vietnamese overview — displayed in UI for Jason to read & edit. */
  contentVi?: string;
}

export interface FilmScriptBeat {
  id: string;
  order: number;
  title: string;          // "Opening Image", "Inciting Incident", etc.
  description: string;    // What happens at this beat (user-editable)
  /**
   * When a twist is locked at this beat position (from Preview Flow Step 4
   * or AI placement), this field links beat → twist.id. Allows UI to show "Beat N (chứa twist X)".
   * AI Stage Beats prompt receives pre-locked twists list and fills this field per beat.
   */
  containsTwistId?: string;
}

export interface FilmScriptTwist {
  id: string;
  /**
   * beatId is now OPTIONAL. When twist comes from Preview Flow Step 4
   * (skip AI path), beatId is undefined initially — filled later by Stage Beats AI
   * via the `containsTwistId` field on the assigned beat. Sanitizer in autoChain
   * matches beat.containsTwistId → twist.id and fills twist.beatId post-hoc.
   */
  beatId?: string;
  description: string;
  /** undefined = not yet decided; true = accepted; false = rejected. */
  accepted?: boolean;
  /**
   * Track origin of this twist.
   * - "preview-flow"   : locked from Preview Flow Step 4 multi-pick (skip AI)
   * - "ai-suggested"   : generated by AI Stage 3 (legacy, when no Preview Flow used)
   */
  source?: "preview-flow" | "ai-suggested";
  /**
   * optional metadata tag from Preview Flow Step 4 option metaEn
   * (e.g. "twist:audio-trigger-ptsd"). Used to display archetype label in UI.
   */
  archetypeTag?: string;
}

/**
 * Stage 4 output: preliminary scenes with setting + action + estimated duration,
 * before Stage 5 fills dialogues + SFX + music briefs + transitions.
 */
export interface FilmScriptIntermediateScene {
  id: string;
  order: number;
  titleEn: string;
  titleVi?: string;
  settings: string;
  /** English action description — used for image/video AI prompts downstream. */
  actionLinesEn: string;
  /* * Vietnamese action description — used for display in UI (so Jason can read & edit). */
  actionLinesVi?: string;
  durationSeconds: number;
  /** Which beats from Stage 2 this scene covers (1-3 typically). */
  beatIds: string[];
  /**
   * User has explicitly dismissed the "scene too complex" warning
   * (estimated shots > 9 sweet spot). When true, UI hides the warning badge for
   * this scene. User accepts the larger grid (4x3 or 4x4) that auto-pick will
   * produce in Storyboard.
   */
  complexityWarningDismissed?: boolean;

  /**
   * Sprint 1.0 r1 (Phase 1A): per-scene pacing annotations.
   * AI fills when Stage 4 generates. Carries through to final FilmSceneScript
   * via runStage5FromStages post-process copy by order.
   * User edits via badge popup on SceneCardWithWarning.
   *
   * tensionLevel — 0-10 expectation density.
   * emotionalTone — see project.ts EmotionalTone.
   */
  tensionLevel?: number;
  emotionalTone?: import("./project").EmotionalTone;
}
