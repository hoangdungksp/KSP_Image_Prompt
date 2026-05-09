/**
 * KSP Image v0.9.1 — Photos Mode Schema
 *
 * Replaces deferred Photos placeholder with full functional pipeline.
 *
 * Key concepts:
 *   - Cast: list of subjects (5 types). Each cast has 1-6 face refs (front first) + 1 outfit ref optional.
 *   - Theme: selected from 200+ catalog (themes.ts) — provides idea + lighting + recommended camera style.
 *   - Camera Style: BOKEH or DOCUMENTARY toggle (HANDOFF Nguyên tắc 1) — top-level pipeline decision.
 *   - Shots: list of 6 by default with auto-picked angle presets (8 presets in angles.ts).
 *   - Engine: reuses existing v0.4 assembler (13-block prompt + Skin Paradox + Identity Lock auto-defer).
 *
 * Dynamic prompt logic (single vs multi-face):
 *   N=1 → "same face as in attached image #1, 100% unchanged..."
 *   N≥2 → "images #1 through #N are ALL FACE REFERENCES of the SAME PERSON..."
 *
 * Storage: Photos data lives under `project.photosV091` field.
 *   Image refs (face/outfit) stored as blob URLs in v0.9.1 (IndexedDB integration deferred).
 */

import type { SubjectType, CameraStyle } from "./index";

// ============================================================================
// CAST MEMBER (Photos mode — simpler than Film FilmCharacterV2)
// ============================================================================

/**
 * Single cast member (subject) in Photos project.
 * Differs from Film mode FilmCharacterV2:
 *   - No role / dialog / voice config (Photos has no audio)
 *   - Face refs only (no body refs separate)
 *   - 1-6 face refs (HANDOFF recommends 3+)
 *   - 1 outfit ref optional
 */
export interface PhotosCastMember {
  id: string;
  order: number;
  /** 5 Subject Types from existing schema (HANDOFF agreed) */
  subjectType: SubjectType;
  /** Display name — empty allowed, falls back to "Model A" / "Cast 1" */
  name: string;

  /**
   * Face references — dynamic 1-6 slots.
   * - Slot 0 (index 0) is always front view (primary anchor).
   * - Slots 1-5 user-labeled (3/4 L, 3/4 R, profile, etc.).
   * Engine reads .length to decide single-face vs multi-face prompt logic.
   */
  faceRefs: PhotosImageRef[];

  /** Outfit reference — single optional slot. */
  outfitRef?: PhotosImageRef;

  /** Free-text note (optional) — useful for "Trang phục cô gái Sài Gòn" style descriptors. */
  note?: string;

  /**
   * Brand specificity — accessories, vehicle, product details
   * Examples: "Apple Watch white strap on left wrist", "Honda Vision 2026 titanium silver scooter",
   * "iPhone 15 Pro in left hand", "white Nike Air Force 1 sneakers".
   * Injected verbatim into the OUTFIT block. Per-shot consistency: written once, applies to all shots.
   */
  brandSpecificity?: string;
}

/**
 * Image reference in v0.9.1.
 * blobUrl is a runtime ObjectURL (lost on reload — IndexedDB integration deferred to v0.9.2).
 * dataUrl is a base64 fallback so images survive reload via Zustand persist (heavy but functional).
 */
export interface PhotosImageRef {
  id: string;
  /** Slot label shown in UI ("front", "3/4 L", "3/4 R", "profile", "smile", custom) */
  label: string;
  /** Filename for display + ZIP export */
  filename: string;
  /** MIME type (image/jpeg | image/png | image/webp) */
  mimeType: string;
  /** Image dimensions (when available — used to validate ≥1024×1024) */
  width?: number;
  height?: number;
  /**
   * Inline base64 data URL — used to render preview + survive reload.
   * Heavy but acceptable for v0.9.1 (typical face ref ~200KB compressed).
   * Migrate to IndexedDB blob storage in v0.9.2.
   */
  dataUrl: string;
}

// ============================================================================
// THEME PICKER STATE
// ============================================================================

/**
 * User's theme selection state.
 * themeId = id from THEMES catalog (themes.ts + themesAdditional.ts).
 * customIdea = free-text override (when no theme matches user's vision).
 */
export interface PhotosThemeState {
  /** Selected theme id from THEMES[] catalog. */
  themeId?: string;
  /** Free-text idea override (Vietnamese, auto-translated when needed). */
  customIdeaVi?: string;
  /** Optional category filter for picker UI persistence. */
  selectedCategoryId?: string;
  /**
   * Custom intent (v0.9.1) — additional user wishes on TOP of the picked theme.
   * E.g., theme = "Áo dài bên cây mai" + customIntentVi = "cô gái cầm bó hoa hồng đỏ thay vì hoa cúc"
   * AI auto-translates Vietnamese → English when user clicks "Dịch", stored in customIntentEn.
   * Engine A+ injects customIntentEn into background/atmosphere block alongside theme.
   */
  customIntentVi?: string;
  customIntentEn?: string;
}

// ============================================================================
// PHOTOS SHOT (lighter than v0.4 Shot — auto-derived from angle preset)
// ============================================================================

/**
 * Single shot in Photos pipeline.
 * Each shot maps to an angle preset (1 of 8 in angles.ts).
 * Engine generates prompt by combining cast + theme + camera style + shot.pose + shot.cameraOverride.
 */
export interface PhotosShot {
  id: string;
  order: number;
  /** Angle preset id (wide_front | medium_low | closeup_side | three_quarter | over_shoulder | bird_eye | back_facing | detail | dutch_tilt | worm_eye | selfie_pov | looking_up_pov). */
  anglePresetId: string;
  /** Pose preset id from POSES[] catalog (100 poses). Null = use angle's default framing only. */
  posePresetId?: string;
  /** Optional camera style override (otherwise uses project.photosV091.cameraStyle). */
  cameraStyleOverride?: CameraStyle;
  /** Free-text pose tweaks ("hand on railing", "looking down at flowers"). */
  poseNote?: string;
  /** Cached generated prompt (for instant copy without re-build). */
  cachedPrompt?: string;
  cachedPromptAt?: number;
}

// ============================================================================
// PHOTOS PROJECT EXTENSION (added to PromptProject in v0.9.1)
// ============================================================================

/**
 * All Photos-mode-specific data in one bundle.
 * Lives at `project.photosV091`.
 *
 * Default values (created via createDefaultPhotosV091):
 *   - cameraStyle: "BOKEH"
 *   - cast: []
 *   - selectedCastId: undefined (until user adds first cast)
 *   - theme: { themeId: undefined, customIdeaVi: "" }
 *   - shots: [] (user clicks Auto-pick to populate 6 shots with varied angles)
 */
export interface PhotosV091Data {
  schemaVersion: "v0.9.1-photos";
  /** BOKEH or DOCUMENTARY (HANDOFF Nguyên tắc 1) — top-level decision. */
  cameraStyle: CameraStyle;
  /** Cast list. Photos v0.9.1 supports multi-cast but single active per project (multi-model in v0.9.2). */
  cast: PhotosCastMember[];
  /** Currently selected cast id (which cast feeds prompts). */
  selectedCastId?: string;
  /** Theme picker state. */
  theme: PhotosThemeState;
  /** Shot list. */
  shots: PhotosShot[];
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// FACTORIES
// ============================================================================

export function createDefaultPhotosV091(): PhotosV091Data {
  const now = Date.now();
  return {
    schemaVersion: "v0.9.1-photos",
    cameraStyle: "BOKEH",
    cast: [],
    theme: { customIdeaVi: "" },
    shots: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createCastMember(
  order: number,
  subjectType: SubjectType = "female"
): PhotosCastMember {
  return {
    id: `cast_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    order,
    subjectType,
    name: "",
    faceRefs: [],
  };
}

export function createPhotosShot(order: number, anglePresetId: string): PhotosShot {
  return {
    id: `pshot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    order,
    anglePresetId,
  };
}

// ============================================================================
// CONSTRAINTS
// ============================================================================

export const MAX_FACE_REFS = 6;
export const RECOMMENDED_FACE_REFS = 3;
export const MIN_FACE_DIMENSION = 1024;
export const DEFAULT_SHOT_COUNT = 6;

/**
 * Default labels for face refs by slot index.
 * Slot 0 always "front" (primary anchor — locked).
 * User can rename slots 1-5.
 */
export const DEFAULT_FACE_LABELS: string[] = [
  "front",
  "3/4 L",
  "3/4 R",
  "profile",
  "smile",
  "natural",
];

/**
 * 5 Subject Types with Vietnamese labels for UI display.
 */
export const SUBJECT_TYPE_LABELS: Record<SubjectType, { vi: string; en: string; emoji: string }> = {
  female: { vi: "Nữ", en: "Female", emoji: "👩" },
  male: { vi: "Nam", en: "Male", emoji: "👨" },
  couple: { vi: "Cặp đôi", en: "Couple", emoji: "👫" },
  family: { vi: "Gia đình", en: "Family", emoji: "👨‍👩‍👧" },
  friends_group: { vi: "Nhóm bạn", en: "Friends Group", emoji: "👥" },
};
