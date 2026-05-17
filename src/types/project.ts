/**
 * KSP Image v0.9.0 — Extended type definitions
 *
 * Adds:
 * - Script (Film mode) replacing Concept-style 8-fields
 * - Concept (TVC mode) treatment document
 * - FilmStructure: Film → Scenes → Shots hierarchy
 * - 4 modes restructure: Photos / TVC / Product / Film
 * - API Keys management
 * - Per-task AI provider config
 * - TimeFormat: decimal / integer / timecode
 * - Bundle export config
 *
 * Backward compatibility: Old fields on PromptProject remain optional.
 * Migration logic in store handles v0.8.x → v0.9.0 silent upgrade.
 */

// ============================================================================
// MODES (redefined for v0.9.0)
// ============================================================================

/**
 * 4 active modes in v0.9.0 (Music deferred to v1.0+).
 * v0.8.x had 5 modes: lifestyle/tvc_commercial/product_photo/editorial_fashion/film.
 * v0.9.0:
 *   - "photos" replaces "lifestyle" + "editorial_fashion" (single image generation)
 *   - "tvc_commercial" kept (with new Concept step)
 *   - "product_photo" kept (lighter focus)
 *   - "film" rewritten with Script + Scene/Shot hierarchy
 */
export type ProjectModeV2 = "photos" | "tvc_commercial" | "product_photo" | "film";

// ============================================================================
// TIME FORMAT (Q5 — 3 options)
// ============================================================================

/**
 * Display format for frame/chunk timing in UI.
 * Internal storage always uses seconds (number).
 * UI rendering depends on this setting.
 *
 * Examples for chunk 6s with 4 frames:
 * - decimal:  "0–1.5s", "1.5–3s", ...
 * - integer:  "0–2s", "2–4s", ... (rounded for readability)
 * - timecode: "0:00–0:01.5", "0:01.5–0:03", ...
 */
export type TimeFormat = "decimal" | "integer" | "timecode";

// ============================================================================
// API KEYS MANAGEMENT
// ============================================================================

export interface ApiKeys {
  gemini?: string;       // Google Gemini API (Imagen 4 + Flash + Nano Banana)
  openai?: string;       // OpenAI (ChatGPT 4o for fallback)
  elevenlabs?: string;   // ElevenLabs TTS (best Vietnamese voice quality)
  googleTts?: string;    // Google Cloud TTS (cheaper alternative)
  suno?: string;         // Suno AI (music gen) - optional, often manual
}

export interface ApiKeysStatus {
  gemini: "connected" | "invalid" | "empty";
  openai: "connected" | "invalid" | "empty";
  elevenlabs: "connected" | "invalid" | "empty";
  googleTts: "connected" | "invalid" | "empty";
  suno: "connected" | "invalid" | "empty";
}

// ============================================================================
// PER-TASK AI PROVIDER CONFIG
// ============================================================================

/**
 * Different AI tasks can use different providers.
 * User configures once in Project Setting, applied throughout project.
 */
export interface AiTaskProviders {
  scriptWriter: "gemini-flash" | "gemini-pro" | "openai-4o";
  conceptWriter: "gemini-flash" | "gemini-pro" | "openai-4o";
  storyboardFrames: "gemini-flash" | "gemini-pro" | "openai-4o";
  imageGen: "imagen-4-standard" | "imagen-4-fast" | "nano-banana" | "nano-banana-pro";
  voiceTts: "elevenlabs" | "google-tts";
  // Music gen typically prompt-only (Suno/Udio are manual)
}

// ============================================================================
// PACING — Sprint 1.0 r1 (Phase 1A scene + Phase 1B shot rhythm)
// ============================================================================

/**
 * Per-scene emotional tone (Phase 1A — 7 values).
 * AI auto-assigns when Stage 4 generates intermediate scenes.
 * User can edit via badge popup on scene card.
 * Backward-compat: undefined treated as "neutral" in UI.
 *
 * `melancholy` intentionally omitted (overlap with `sad` — Jason chốt 16/5/2026).
 */
export type EmotionalTone =
  | "tender"
  | "tense"
  | "funny"
  | "sad"
  | "shocking"
  | "triumphant"
  | "neutral";

export const EMOTIONAL_TONE_LABELS: Record<EmotionalTone, { vi: string; en: string; emoji: string; color: string; bg: string }> = {
  tender:     { vi: "dịu dàng",   en: "Tender",     emoji: "💗", color: "#993556", bg: "#FBEAF0" },
  tense:      { vi: "căng thẳng", en: "Tense",      emoji: "⚡", color: "#A32D2D", bg: "#FCEBEB" },
  funny:      { vi: "vui nhộn",   en: "Funny",      emoji: "😄", color: "#854F0B", bg: "#FAEEDA" },
  sad:        { vi: "buồn",       en: "Sad",        emoji: "💧", color: "#0C447C", bg: "#E6F1FB" },
  shocking:   { vi: "sốc",        en: "Shocking",   emoji: "💥", color: "#993C1D", bg: "#FAECE7" },
  triumphant: { vi: "giải toả",   en: "Triumphant", emoji: "🏆", color: "#3B6D11", bg: "#EAF3DE" },
  neutral:    { vi: "trung tính", en: "Neutral",    emoji: "·",  color: "#5F5E5A", bg: "#F1EFE8" },
};

/**
 * Per-shot rhythm role (Phase 1B — 4 values).
 * AI auto-assigns when shot list generates, based on shot position + scene tension.
 * User edits via dropdown pill in ShotRow.
 *
 * Maps to cinematic micro-arc within a scene (Walter Murch + Pixar pacing theory):
 *   - establish: first shot, sets baseline (usually WS)
 *   - build: rising action (MS, 2-shot, OS)
 *   - peak: climax of scene's micro-arc (CU, ECU)
 *   - release: pull back, scene exit (WS or transition)
 */
export type RhythmRole = "establish" | "build" | "peak" | "release";

export const RHYTHM_ROLE_LABELS: Record<RhythmRole, { vi: string; en: string; emoji: string; color: string; bg: string }> = {
  establish: { vi: "mở",  en: "Establish", emoji: "◇", color: "#5F5E5A", bg: "#F1EFE8" },
  build:     { vi: "leo", en: "Build",     emoji: "↗", color: "#854F0B", bg: "#FAEEDA" },
  peak:      { vi: "đỉnh", en: "Peak",     emoji: "★", color: "#A32D2D", bg: "#FCEBEB" },
  release:   { vi: "thả", en: "Release",   emoji: "◇", color: "#3B6D11", bg: "#EAF3DE" },
};

/**
 * Clamp tension value to 0-10 range, default 0 if undefined or invalid.
 * Used by UI badges and AI sanitizer.
 */
export function clampTension(v: number | undefined): number {
  if (typeof v !== "number" || isNaN(v)) return 0;
  return Math.max(0, Math.min(10, Math.round(v)));
}

/**
 * Color a tension badge based on 0-10 scale.
 * 0-3 → green (low/calm) · 4-6 → amber (building) · 7-10 → red (high/climax).
 * Returns CSS color + bg pair matching app's existing 4-color status badge palette.
 */
export function getTensionColor(level: number): { color: string; bg: string } {
  const t = clampTension(level);
  if (t <= 3) return { color: "#3B6D11", bg: "#EAF3DE" }; // low — green
  if (t <= 6) return { color: "#854F0B", bg: "#FAEEDA" }; // mid — amber
  return { color: "#A32D2D", bg: "#FCEBEB" }; // high — red
}

/**
 * Sprint 1.0 r5 (Phase 2B): detected setup → payoff pair.
 * AI scans full script and identifies story promises planted early (setup)
 * and their later fulfillment (payoff). Used for narrative completeness analysis.
 *
 * Type field categorizes the pair:
 * - "object": physical item introduced and later used (gun, key, photo)
 * - "skill": character ability shown and later applied
 * - "promise": verbal or implied commitment that's later fulfilled or broken
 * - "mystery": question raised early that's later answered
 * - "character": character trait shown and later tested
 * - "world": world-building element that becomes plot-relevant
 */
export interface SetupPayoffPair {
  id: string;
  /** Scene where the setup is planted */
  setupSceneId: string;
  /** Scene where the payoff happens (must be later than setup) */
  payoffSceneId: string;
  /** Category of the setup-payoff (drives icon + color) */
  type: "object" | "skill" | "promise" | "mystery" | "character" | "world";
  /** Short Vietnamese label for the pair (3-6 words, e.g., "Mật mã 3-5 nhịp") */
  labelVi: string;
  /** Sprint 1.0 r7: English equivalent label (used in EN prompts to prevent VI leak).
   *  Optional for backward-compat — old pairs only have labelVi; UI shows badge stale
   *  prompting user to re-detect. */
  labelEn?: string;
  /** Longer Vietnamese explanation of what's set up and how it pays off */
  rationaleVi: string;
  /** Strength of the pairing per AI confidence (0-1 normalized). >0.7 strong, 0.4-0.7 moderate, <0.4 weak/speculative */
  confidence: number;
  /** When AI detected this pair (for stale-check) */
  detectedAt: number;
}

export const SETUP_PAYOFF_TYPE_LABELS: Record<SetupPayoffPair["type"], { vi: string; emoji: string; color: string }> = {
  object:    { vi: "Vật thể",       emoji: "🎯", color: "#854F0B" },
  skill:     { vi: "Kỹ năng",       emoji: "💪", color: "#0C447C" },
  promise:   { vi: "Lời hứa",       emoji: "🤝", color: "#3B6D11" },
  mystery:   { vi: "Bí ẩn",         emoji: "❓", color: "#993556" },
  character: { vi: "Tính cách",     emoji: "🎭", color: "#993C1D" },
  world:     { vi: "Thế giới quan", emoji: "🌍", color: "#5F5E5A" },
};

/**
 * Sprint 1.0 r7 (Phase 2B+): atomic "beat" detected from scene description.
 * AI scans scene action lines and identifies discrete narrative units —
 * each one a single moment that cannot be split smaller without losing meaning.
 *
 * Used for:
 * - Coverage indicator (Shot List shows X/Y beats covered)
 * - AI shot list generation receives beats array → ensures each beat captured
 * - Click missing beat → AI generates a shot for that beat
 *
 * Beat types drive Shot list AI decisions on framing:
 * - "camera": camera intent (wide sweep, tilt down, dolly-in)
 * - "subject": new subject enters/leaves (woodpecker arrives, robot revealed)
 * - "action": discrete action verb (peck, fall, jump)
 * - "sensory": ambient sensory detail (sunlight dappling, scent of earth)
 * - "state-change": transition state (light flicker → fade, dormant → active)
 */
export interface Beat {
  id: string;
  /** 1-based order within scene */
  order: number;
  /** 3-7 word label in source language (VI or EN, matching scene description) */
  label: string;
  /** Category — drives icon + Shot list AI's framing decisions */
  type: "camera" | "subject" | "action" | "sensory" | "state-change";
  /** Exact phrase from scene description (for user verification + AI re-mapping) */
  sourcePhrase?: string;
  /** Shot IDs that cover this beat (AI auto-maps when generating shot list) */
  coveredByShotIds?: string[];
  /** Timestamp when detected (for stale check) */
  detectedAt: number;
}

export const BEAT_TYPE_LABELS: Record<Beat["type"], { vi: string; emoji: string; color: string }> = {
  camera:         { vi: "Máy quay",   emoji: "🎥", color: "#534AB7" },
  subject:        { vi: "Chủ thể",    emoji: "👤", color: "#D85A30" },
  action:         { vi: "Hành động",  emoji: "⚡", color: "#993C1D" },
  sensory:        { vi: "Cảm quan",   emoji: "🌿", color: "#3B6D11" },
  "state-change": { vi: "Chuyển biến", emoji: "✨", color: "#854F0B" },
};

// ============================================================================
// FILM SCRIPT (replaces Concept for Film mode)
// ============================================================================

/**
 * Industry-standard screenplay structure with 7 fields per scene.
 * AI-generated initially, fully editable inline by user.
 * Feeds: Storyboard frames + Voice AI dialog + Music AI brief + SFX list.
 */
export interface FilmScript {
  titleEn: string;
  titleVi: string;
  logline: string;          // 1-sentence hook (English-first; AI generated)
  loglineVi?: string;       // Optional Vietnamese translation
  synopsisEn: string;
  synopsisVi?: string;
  scenes: FilmSceneScript[];

  // Metadata
  aiProvider?: "gemini-flash" | "gemini-pro" | "openai-4o" | "manual";
  aiReasoning?: string;
  versions?: ScriptVersion[];
  createdAt: number;
  updatedAt: number;
}

export interface FilmSceneScript {
  id: string;
  order: number;
  titleEn: string;
  titleVi?: string;
  settings: string;         // "INT./EXT. LOCATION - TIME"
  durationSeconds: number;
  act: "setup" | "inciting" | "rising" | "climax" | "resolution";
  actionLinesEn: string;    // For AI image gen (English, descriptive)
  actionLinesVi?: string;   // For user editing reference
  dialog: ScriptDialog[];
  sfx: string[];            // Specific SFX cues
  musicBrief: string;       // 80-120 char Suno-ready prompt
  transitionToNext?: string; // "Cut to" / "Match cut" / "Fade to"
  // Linkage
  shotIds?: string[];       // FilmShot.id derived from this scene

  /**
   * Sprint 1.0 r1 (Phase 1A): per-scene pacing annotations.
   * Auto-filled by AI Stage 4, carried into Stage 5 via post-process copy by order.
   * User edits via badge popup on SceneCard.
   *
   * tensionLevel — 0-10 expectation density (Hitchcock suspense scale).
   *                undefined = not annotated yet, UI shows "·" placeholder.
   * emotionalTone — categorical mood. undefined = treated as "neutral" in UI.
   */
  tensionLevel?: number;
  emotionalTone?: EmotionalTone;

  /**
   * Sprint 1.0 r5 (Phase 2B): per-character emotion in this scene.
   * Map characterId → EmotionalTone. Only meaningful for characters present in scene.
   * AI fills via `runReannotateCharacterEmotions` engine function.
   * UI: multi-line curve in pacing dashboard when 2+ characters have non-empty arcs.
   * Backward-compat: undefined = no multi-character data, dashboard falls back to scene-level emotion.
   */
  characterEmotions?: Record<string, EmotionalTone>;

  /**
   * Sprint 1.0 r7 (Phase 3): atomic narrative beats detected from scene description.
   * AI scans actionLines and produces discrete units that Shot list AI must cover.
   * Auto-detected when Stage 5 finalizes; auto re-detected when actionLines change (J3).
   * UI: badge `🎯 N beats` on Scene Card with click-to-popover; Coverage indicator in Shot List.
   */
  beats?: Beat[];

  /**
   * Sprint 1.0 r7: AI-detected PHYSICAL CONSISTENCY LOCK in English.
   * Multi-line text describing appearance details that MUST remain identical
   * across all shots of this scene (outfit, body coverage, environment markers).
   * Injected into all 3 prompts (grid image + single shot + animation).
   * User editable via Scene Card collapsible section.
   *
   * Example for "Robot Thức tỉnh" Scene 1:
   *   "G.N.U.D body: thick green moss + hanging ivy + rust patches.
   *    Left optical sensor: obscured by ivy curtain.
   *    Scale: 3-4m massive humanoid prone among ferns."
   */
  physicalConsistencyLockEn?: string;

  // qc16 — Scene-level visual storyboard grids (replaces per-shot grid concept)
  /** qc16: Grids that pack shots into visual cells. Each grid = one Banana Pro upload. */
  grids?: SceneGrid[];
  /** qc16 → qc21: Grid format for this scene.
   * - undefined: scene mới, packer will auto-pick from shot count + aspect.
   * - set: either persisted from auto-pick (gridFormatManual !== true) OR user override (gridFormatManual === true).
   * - qc21 Storyboard UI shows "(auto)" badge or "Reset to Auto" button based on gridFormatManual flag.
   */
  gridFormat?: SceneGridFormat;
  /**
   * qc21 Q21.4: Tracks whether scene.gridFormat is auto-picked or user-overridden.
   * - undefined/false: auto-resolved by pickOptimalGridFormat (re-evaluates on shot count change)
   * - true: user explicitly chose via "⚙ Advanced" dropdown → preserve as-is
   * Note: Pre-qc21 projects with manually-set gridFormat (qc17 era) appear as
   * gridFormatManual undefined (legacy). Storyboard UI shows migration hint
   * "🔧 Manual · Reset to Auto?" to give user option.
   */
  gridFormatManual?: boolean;
}

// ============================================================================
// qc16 — Scene-level visual grids (paradigm shift from per-shot grids)
// ============================================================================

export type SceneGridFormat = "2x2" | "2x3" | "3x2" | "2x4" | "4x2" | "3x3" | "4x3" | "3x4" | "4x4";

/**
 * One grid that packs N shots from a scene into a single Banana Pro / Imagen image.
 * Multiple grids per scene if shot count > grid cells (Option A pack).
 */
export interface SceneGrid {
  id: string;
  order: number;             // 1-indexed within scene
  gridFormat: SceneGridFormat;
  /** AI-generated EN prompt for the entire grid (all cells together). */
  imagePrompt?: string;
  /** User-uploaded grid PNG (after Banana Pro generates). Base64 dataURL inline. */
  gridImageDataUrl?: string;
  /** qc15-style crop settings (provider + dimensions + gutter). */
  cropSettings?: ShotCropSettings;
  /** Cells in this grid (cells.length === rows × cols). Some cells may be empty. */
  cells: SceneGridCell[];
}

/**
 * One cell in a SceneGrid = one shot snapshot.
 * Cells with no shotId are "empty" placeholders (when shots count doesn't fill grid).
 */
export interface SceneGridCell {
  /** 1-indexed within grid (left-to-right, top-to-bottom). */
  order: number;
  /** Link to FilmShot.id. Undefined if cell is empty (leftover from packing). */
  shotId?: string;
  /** Cropped frame PNG (from grid upload + crop engine). Base64 dataURL. */
  dataUrl?: string;
  /** Lock to prevent regen overwriting user-approved frame. */
  locked?: boolean;
  /** Per-cell prompt override (user fine-tunes single frame regen). */
  promptOverride?: string;
  /**
   * Optional video asset uploaded by user for this cell (after generating via
   * Veo3/Kling/Seedance externally). Used by Animatic Player to render
   * actual motion instead of static keyframe.
   */
  video?: {
    /** Base64 dataURL of the video file (mp4 / webm). */
    dataUrl: string;
    /** Original filename (for display + download). */
    filename: string;
    /** Actual duration of uploaded video in seconds. May differ from shot.durationSeconds. */
    durationSeconds?: number;
  };
}

export interface ScriptDialog {
  characterId: string;      // FilmCharacter.id
  characterName: string;    // Snapshot for display (cast may change)
  lineEn: string;
  lineVi?: string;
  parenthetical?: string;   // "(emotion or micro-action)"
  timingSeconds?: { start: number; end: number };
}

export interface ScriptVersion {
  id: string;
  timestamp: number;
  label: string;            // "first AI gen", "darker tone variation", etc.
  scriptSnapshot: Omit<FilmScript, "versions">;
}

// ============================================================================
// FILM STRUCTURE (Film → Scenes → Shots → Frames)
// ============================================================================

export interface FilmStructure {
  totalDurationMinutes: number;
  scenes: FilmSceneShot[]; // Container linking Script scenes with rendered shots
}

export interface FilmSceneShot {
  id: string;               // Same as FilmSceneScript.id (linked)
  order: number;
  shots: FilmShot[];
}

/**
 * Single shot = single grid storyboard.
 * 1 shot has its own:
 * - Frames text (auto-derived from Script action lines, editable)
 * - Image prompt for Banana Pro
 * - Animation prompt for Seedance/Veo3
 * - Uploaded grid image + cropped frames
 */
export interface FilmShot {
  id: string;
  order: number;
  titleEn: string;
  titleVi?: string;
  shotType: "wide_establishing" | "medium" | "close_up" | "insert" | "over_shoulder" | "two_shot" | "pov";
  durationSeconds: number;
  gridFormat: "2x2" | "2x3" | "3x2" | "3x3" | "4x3" | "3x4";
  cameraMovement: FilmCameraMovement;
  purpose?: string;          // English narrative purpose (legacy, kept for downstream prompts)

  // qc10 — Shot List section (text planning before storyboard visual)
  /** Vietnamese narrative purpose — displayed in UI for Jason. */
  purposeVi?: string;
  /** Vietnamese action description — what happens in this shot. */
  actionVi?: string;
  /** English action — used for downstream image/video AI prompts. */
  actionEn?: string;

  // Frames (auto-derived from Script + grid format)
  frames?: ShotFrame[];

  // Asset state
  gridImageId?: string;      // Reference ID in IndexedDB
  croppedFrameIds?: string[];// 1 ID per cell
  imagePrompt?: string;      // Generated for Banana Pro
  animationPrompts?: AnimationChunk[];

  // Per-shot status
  status: "draft" | "frames_ready" | "prompt_ready" | "rendered" | "animated";

  // Lock
  locked?: boolean;

  // ====================================================================
  // r5 (Mockup 4 Shot Detail) — additive fields, optional, backward-compat
  // ====================================================================
  /** r5 image prompt EN (separate from legacy `imagePrompt` to avoid mixing) */
  imagePromptR5?: string;
  /** r5 animation prompt EN (flat single string, not legacy AnimationChunk[]) */
  animationPromptR5?: string;
  /** r5 selected video provider id (default "seedance-2-pro") */
  videoProviderId?: string;
  /** r5 uploaded grid image base64 (inline, will migrate IDB v0.9.4) */
  gridImageDataUrl?: string;
  /** r5 auto-cropped frames per grid format (derived count) */
  framesR5?: import("./film").ShotR5Frame[];

  /**
   * qc15: User-confirmed crop settings used when last cropping the grid.
   * Persisted so user can re-crop with same settings, or override project default.
   */
  cropSettings?: ShotCropSettings;

  /**
   * Sprint 1.0 r1 (Phase 1B): per-shot rhythm role.
   * Auto-filled by AI shot list generation based on position + scene tension.
   * User edits via dropdown pill in ShotRow.
   * undefined = legacy shot pre-Sprint-1.0, UI shows "·" placeholder.
   */
  rhythmRole?: RhythmRole;

  /**
   * Sprint 1.0 r7 (Q1 VI leak fix): English-language narrative purpose.
   * Backward-compat: existing `purpose` field stays as VI fallback. Old projects
   * have only `purpose` (Vietnamese) which leaks into EN prompt → user re-generates.
   * Prompt builders prefer `purposeEn` if set, fallback to `purpose`.
   */
  purposeEn?: string;

  /**
   * Sprint 1.0 r7 (Q2 per-shot mood override): custom lighting hint for this shot.
   * If set, overrides scene-level lighting derived from emotionalTone.
   * AI shot list auto-fills based on action + rhythm role.
   * User can manually edit via Edit Frame modal "Override per-shot mood" section.
   */
  lightingHintEn?: string;

  /**
   * Sprint 1.0 r7: per-shot emotion override (use case: scene tone=neutral but
   * shot has peak emotional moment that warrants different mood).
   * Resolution priority: lightingHintEn > shotMoodOverride > scene.emotionalTone.
   */
  shotMoodOverride?: EmotionalTone;

  /**
   * Sprint 1.0 r7: per-shot tension intensity override (0-10).
   * Use case: scene tension=3 (calm) but this specific shot is peak moment
   * within the scene, deserves tension=8 framing intensity.
   */
  shotMoodIntensity?: number;
}

/**
 * qc15: Crop settings — per-shot override + per-project default fallback.
 *
 * Workflow:
 *   1. User uploads grid → Preview & Crop modal opens
 *   2. Modal pre-fills from shot.cropSettings (if exists) OR project default
 *      OR provider defaults
 *   3. User adjusts (provider, totalWidth, totalHeight, gutterPx)
 *   4. Clicks "Approve & Crop" → saves to shot.cropSettings + runs crop
 */
export interface ShotCropSettings {
  /** AI provider ID (from gridProviders.ts) — "nano-banana" | "chatgpt" | etc. */
  provider: string;
  /** User-confirmed total grid width in pixels */
  totalWidth: number;
  /** User-confirmed total grid height in pixels */
  totalHeight: number;
  /** Gutter between cells in pixels */
  gutterPx: number;
}

export interface ShotFrame {
  id: string;
  order: number;
  timingSeconds: { start: number; end: number };
  role: "establishing" | "stillness" | "motion" | "climax" | "resolution" | "transition";
  actionEn: string;
  actionVi?: string;
  locked?: boolean;
}

export interface AnimationChunk {
  id: string;
  order: number;
  frameRange: { start: number; end: number }; // Frame indices
  timingSeconds: { start: number; end: number };
  prompt: string;
  charCount: number;
  charLimit: number;          // Provider-specific (Seedance 4000)
  copyableReferences: string[]; // Cropped frame IDs + cast ref IDs
}

export type FilmCameraMovement =
  | "handheld_documentary"
  | "steadicam_smooth"
  | "dolly_tracking"
  | "drone_aerial"
  | "crane_shot"
  | "locked_off"
  | "auto_per_genre";

// ============================================================================
// FILM CHARACTER (multi-character with AI Generate Hybrid)
// ============================================================================

export interface FilmCharacterV2 {
  id: string;
  order: number;
  name: string;
  role: "protagonist" | "supporting" | "antagonist" | "extra";
  description: string;
  uniqueIdentifiers: string;  // Concrete visual markers AI must match
  hasDialog: boolean;

  // References (Hybrid: user uploads OR AI generates)
  faceRefs: CharacterRef[];
  bodyRefs: CharacterRef[];

  // For non-human characters (Robot, Animal, Object)
  characterType?: "human" | "robot" | "creature" | "animal" | "object";
}

export interface CharacterRef {
  id: string;                 // Reference ID in IndexedDB
  angle: "front" | "three_quarter_left" | "three_quarter_right" | "side" | "back" | "full_body" | "torso" | "macro";
  generatedByAi?: boolean;    // True if AI Imagen 4 generated, false if user upload
  prompt?: string;            // If AI generated, the prompt used
}

// ============================================================================
// CONCEPT (TVC mode — 8 fields treatment)
// ============================================================================

export interface TvcConcept {
  loglineEn: string;
  loglineVi?: string;
  synopsisEn: string;
  synopsisVi?: string;
  tone: string[];             // ["aspirational", "premium", "warm"]
  audience: {
    demographic: string;
    psychographic: string;
    platform: string;         // "Reels|TikTok|Web|TV"
  };
  keyMessages: string[];
  visualReferences: string[];
  brandVoice: string;
  ctaLogoEnd: string;

  // Metadata
  aiProvider?: "gemini-flash" | "gemini-pro" | "openai-4o" | "manual";
  aiReasoning?: string;
  versions?: ConceptVersion[];
  createdAt: number;
  updatedAt: number;
}

export interface ConceptVersion {
  id: string;
  timestamp: number;
  label: string;
  conceptSnapshot: Omit<TvcConcept, "versions">;
}

// ============================================================================
// MUSIC + SFX (Step 7)
// ============================================================================

export interface MusicSfxSection {
  perSceneMusic: SceneMusicBrief[];
  fullScoreArc?: string;      // Overall progression suggestion
  sfxByScene: SceneSfx[];
  sfxProvider: "freesound" | "epidemic_sound" | "suno_sfx" | "manual";
}

export interface SceneMusicBrief {
  sceneId: string;
  brief: string;              // 80-120 char Suno-ready
  durationSeconds: number;
  mood: string[];
}

export interface SceneSfx {
  sceneId: string;
  sfx: string[];
  freesoundLinks?: string[];
}

// ============================================================================
// VOICE AI (Step 6)
// ============================================================================

export interface VoiceSection {
  enabled: boolean;
  provider: "elevenlabs" | "google-tts";
  characterVoices: Record<string, VoiceConfig>; // characterId → config
  narratorEnabled?: boolean;
  narratorConfig?: NarratorConfig;
  generatedAudioFiles?: VoiceAudioFile[];
}

export interface VoiceConfig {
  voiceId: string;            // Provider-specific voice ID
  voiceName: string;          // Display name
  language: "vi" | "en" | "multi";
  characteristics: string;    // "deep male synth, slow speed, slight reverb"
  speed?: number;             // 0.5-2.0
  stability?: number;         // ElevenLabs 0-1
  similarityBoost?: number;   // ElevenLabs 0-1
}

export interface NarratorConfig {
  scriptEn: string;
  scriptVi?: string;
  voiceConfig: VoiceConfig;
}

export interface VoiceAudioFile {
  id: string;                 // IndexedDB blob ID
  characterId: string;
  sceneId: string;
  filename: string;           // "scene1_robot.mp3"
}

// ============================================================================
// PROJECT SETTING (consolidated)
// ============================================================================

export interface ProjectSettingV2 {
  // Basic
  name: string;
  mode: ProjectModeV2;
  industry?: string;          // Only for tvc_commercial / product_photo
  genre?: FilmGenreV2;        // Only for film
  animationStyle?: AnimationStyleV2; // Only for film
  aspectRatio: AspectRatioV2;
  durationMinutes?: number;   // For film/tvc; not applicable for photos
  timeFormat: TimeFormat;

  /**
   * v0.9.3 Film mode (Q5 lock): project-wide dialog mode.
   * "has_dialog" — characters speak lines (Voice section shows dialog assignment per character).
   * "no_dialog" — narrative qua hình ảnh + nhạc + SFX (Voice section shows Skip/Add Narrator).
   * Default: "no_dialog" (anchor on Mockup 1 Robot demo).
   * Only meaningful when mode === "film". Other modes ignore.
   */
  dialog?: import("./film").FilmDialogMode;

  /**
   * qc16/qc17: Default video generation provider for Film mode.
   * AI Shot List generation uses this provider's supported durations as constraints.
   * Per-shot override is still possible (shot.videoProviderId).
   * Default: "seedance-2-pro" (most flexible — 4-15s).
   * Full wire in qc17 (validate + clamp on copy animation prompt).
   */
  defaultVideoProvider?: string;

  // AI providers
  aiProviders: AiTaskProviders;

  // Storage / autosave
  autosaveIntervalSeconds?: number; // Default 30s
  versioningEnabled?: boolean;       // Default true

  // UI prefs
  uiTheme?: "dark" | "darker"; // Default dark
  defaultLanguage?: "vi" | "en"; // Default vi

  // Metadata
  createdAt: number;
  updatedAt: number;
}

export type FilmGenreV2 =
  | "drama"
  | "sci_fi"
  | "action"
  | "romance"
  | "comedy"
  | "horror"
  | "thriller"
  | "fantasy"
  | "documentary";

export type AnimationStyleV2 =
  | "live_action"
  | "cgi_3d_cinematic"
  | "anime_2d"
  | "cartoon_2d"
  | "stop_motion"
  | "film_noir";

export type AspectRatioV2 =
  | "9:16"        // Vertical (TikTok, Reels, Shorts)
  | "1:1"         // Square (Instagram feed)
  | "4:5"         // Portrait (Instagram feed)
  | "4:3"         // Classic TV / retro film (added v0.9.3-r2 for Film mode)
  | "16:9"        // Landscape (YouTube, TV)
  | "21:9"        // Cinemascope (Cinema)
  | "2.39:1";     // Anamorphic widescreen

// ============================================================================
// BUNDLE EXPORT CONFIG
// ============================================================================

export interface BundleExportConfig {
  includeScript?: boolean;       // Default true (film) / false (tvc)
  includeConcept?: boolean;      // Default true (tvc) / false (film)
  includeCastRefs?: boolean;     // Default true
  includeShotsAssets?: boolean;  // Default true
  includeVoiceAudio?: boolean;   // Default true if generated
  includeMusicBriefs?: boolean;  // Default true
  includeSfxList?: boolean;      // Default true
  includeReadme?: boolean;       // Default true
  filenameFormat?: "snake_case" | "kebab-case"; // Default snake
}

// ============================================================================
// PROJECT v0.9.0 EXTENSIONS (added to existing PromptProject)
// ============================================================================

/**
 * Fields added to PromptProject in v0.9.0.
 * Use intersection type when accessing project state:
 *   const p = project as PromptProject & ProjectV09Extensions;
 */
export interface ProjectV09Extensions {
  // Schema version marker
  schemaVersion?: "v0.8" | "v0.9";

  // Consolidated settings (replaces scattered top-level fields in v0.8.x)
  settingV2?: ProjectSettingV2;

  // Step 2: Concept (TVC) or Script (Film) — mutually exclusive based on mode
  concept?: TvcConcept;       // Only set when mode === "tvc_commercial"
  script?: FilmScript;        // Only set when mode === "film"

  // Film hierarchy
  filmStructureV2?: FilmStructure;
  filmCharactersV2?: FilmCharacterV2[];

  // Step 6 + 7
  voice?: VoiceSection;
  musicSfx?: MusicSfxSection;

  // Bundle config
  bundleConfig?: BundleExportConfig;

  /**
   * v0.9.1: Photos mode data (cast, theme, shots, camera style).
   * Only populated when settingV2.mode === "photos".
   * See ./photos_v091.ts for PhotosData type.
   */
  photosV091?: import("./photos").PhotosData;

  /**
   * v0.9.3: Film mode data (multi-character cast).
   * Only populated when settingV2.mode === "film".
   * See ./film_v093.ts for FilmData type.
   */
  filmV093?: import("./film").FilmData;
}

// ============================================================================
// HELPER: Time format utilities
// ============================================================================

export function formatTime(seconds: number, format: TimeFormat): string {
  if (format === "decimal") {
    return seconds % 1 === 0 ? `${seconds}s` : `${seconds.toFixed(1)}s`;
  }
  if (format === "integer") {
    return `${Math.round(seconds)}s`;
  }
  // timecode mm:ss
  const minutes = Math.floor(seconds / 60);
  const secs = seconds - minutes * 60;
  const secsStr = secs % 1 === 0
    ? `${Math.floor(secs).toString().padStart(2, "0")}`
    : secs.toFixed(1).padStart(4, "0");
  return `${minutes}:${secsStr}`;
}

export function formatTimeRange(
  startSec: number,
  endSec: number,
  format: TimeFormat
): string {
  return `${formatTime(startSec, format)}–${formatTime(endSec, format)}`;
}
