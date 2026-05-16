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
 * Q1 — Layout: vertical full-width card stack dọc
 * Q3 — Schema: face 1-4 + body 1-3, NO outfit slot riêng
 * Q4 — AI Generate: aiGenDescription field saves prose, API call deferred Sprint 0.9.4
 */
export interface FilmCharacter {
  id: string;
  order: number;
  /** Display name (vd "Robot", "Chim sẻ rừng") */
  name: string;
  /** Q2 — 4 roles dropdown free, no constraint */
  role: FilmCharacterRole;
  /** Free-text prose description (Vietnamese OK — feed AI prompt) */
  description: string;

  /**
   * Face references — 1-4 ảnh (Q3 lock).
   * - First slot is anchor "front" view (recommended label).
   * - Subsequent slots user-labeled (3/4 L, 3/4 R, profile, etc.).
   * Engine reads .length to decide single-face vs multi-face prompt logic.
   */
  faceRefs: FilmImageRef[];

  /**
   * Body references — 1-3 ảnh (Q3 lock).
   * - front / side / back recommended for full outfit + body proportion coverage.
   * - NO outfit slot riêng — body refs đã chứa outfit (Q3).
   */
  bodyRefs: FilmImageRef[];

  /**
   * AI-generated character description (Q4 — stub for Imagen 4 wire Sprint 0.9.4).
   * If set, user has filled the "AI Generate" modal but actual face/body refs
   * are STILL upload-based for now. When Imagen 4 wire lands in 0.9.4, this
   * field feeds the image generation prompt.
   */
  aiGenDescription?: string;

  /**
   * qc13: Timestamp when AI last generated the description.
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
   * qc18 Hướng B: explicit lock flag for Stage 3.
   * - undefined/false: user is still picking accept/reject on twist cards
   *   → isStageDone("twists") returns false → ActiveStage3 renders with cards visible
   * - true: user clicked "Tiếp: ④ Phân cảnh →" to confirm twist selections
   *   → isStageDone("twists") returns true → stage shows green ✓ in stepper
   * Reset to false when setScriptTwists runs (AI regen → user must re-confirm).
   * Cleared when revertToStage("twists") or revertToStage upstream.
   * Backward-compat: qc17 projects without this field are treated as locked if
   * any downstream stage (scenes/script) already has data — see isStageDone.
   */
  scriptTwistsLocked?: boolean;
  /** r7 Stage 4 output: preliminary scenes (before Stage 5 dialogues). */
  scriptIntermediateScenes?: FilmScriptIntermediateScene[];
  /**
   * qc20 (parallel qc18 Twist lock pattern): explicit lock flag for Stage 4.
   * - undefined/false: user is still reviewing Stage 4 scenes (may want to split or dismiss warnings)
   *   → isStageDone("scenes") returns false → ActiveStage4 renders with warning badges visible
   * - true: user clicked "Tiếp: ⑤ Lời thoại →" to confirm scene structure
   *   → isStageDone("scenes") returns true → stage shows green ✓ in stepper
   * Reset to false when setScriptIntermediateScenes runs (AI regen → user must re-confirm).
   * Cleared when revertToStage("scenes" or upstream).
   * Backward-compat: qc19 projects without this field are treated as locked if
   * downstream script (Stage 5 dialogues) is set — see isStageDone.
   */
  scriptScenesLocked?: boolean;
  /**
   * qc6: Optional user-specified scene count for Stage 4.
   * If unset, AI decides (default ~4-7 for 5-min films).
   * User adjusts to force more/fewer scenes for richer storytelling.
   */
  scriptTargetSceneCount?: number;

  /**
   * qc15: Per-project default crop settings. Used as pre-fill in Preview & Crop
   * modal when shot has no per-shot cropSettings override. User sets default
   * 1 time (vd Nano Banana 2752×1536) → modal pre-fills for all shots; when
   * generating a single shot from ChatGPT, user overrides per-shot.
   */
  defaultCropSettings?: import("./project").ShotCropSettings;

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

/** Stage 1 — narrative framework chosen by AI or user. */
export type FilmStoryFramework =
  | "three-act"
  | "hero-journey"
  | "save-the-cat"
  | "kishotenketsu";

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
};

export interface FilmScriptStructure {
  framework: FilmStoryFramework;
  /** English overview — used for image/video AI prompts downstream. */
  contentEn: string;
  /** qc9: Vietnamese overview — displayed in UI for Jason to read & edit. */
  contentVi?: string;
}

export interface FilmScriptBeat {
  id: string;
  order: number;
  title: string;          // "Opening Image", "Inciting Incident", etc.
  description: string;    // What happens at this beat (user-editable)
}

export interface FilmScriptTwist {
  id: string;
  beatId: string;         // Which beat this twist is attached to
  description: string;
  /** undefined = not yet decided; true = accepted; false = rejected. */
  accepted?: boolean;
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
  /** qc9: Vietnamese action description — used for display in UI (so Jason can read & edit). */
  actionLinesVi?: string;
  durationSeconds: number;
  /** Which beats from Stage 2 this scene covers (1-3 typically). */
  beatIds: string[];
  /**
   * qc20 Q20.5: User has explicitly dismissed the "scene too complex" warning
   * (estimated shots > 9 sweet spot). When true, UI hides the warning badge for
   * this scene. User accepts the larger grid (4x3 or 4x4) that auto-pick will
   * produce in Storyboard.
   */
  complexityWarningDismissed?: boolean;
}
