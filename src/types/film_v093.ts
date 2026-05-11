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
export interface FilmV093Data {
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
  script?: import("./v0_9_0").FilmScript;

  /**
   * r4 (Mockup 3): shots per scene.
   * Map sceneId → FilmShot[].
   * Each shot has its own grid (2x2/2x3/3x2/3x3/4x3) + status badge.
   * Script.scenes is the source of truth for scene IDs; shots derived AI or manual.
   */
  shotsBySceneId?: Record<string, import("./v0_9_0").FilmShot[]>;

  /**
   * r3: AI provider preference for script generation (Gemini Flash vs OpenAI 4o).
   * Lives at FilmV093Data level (not settingV2.aiProviders) for per-project override.
   */
  scriptProvider?: "gemini-flash" | "openai-4o";

  createdAt: number;
  updatedAt: number;
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

export function createDefaultFilmV093(): FilmV093Data {
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
