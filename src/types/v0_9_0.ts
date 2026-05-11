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
  gridFormat: "2x2" | "2x3" | "3x2" | "3x3" | "4x3";
  cameraMovement: FilmCameraMovement;
  purpose?: string;          // Narrative purpose

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
  dialog?: import("./film_v093").FilmDialogMode;

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
   * See ./photos_v091.ts for PhotosV091Data type.
   */
  photosV091?: import("./photos_v091").PhotosV091Data;

  /**
   * v0.9.3: Film mode data (multi-character cast).
   * Only populated when settingV2.mode === "film".
   * See ./film_v093.ts for FilmV093Data type.
   */
  filmV093?: import("./film_v093").FilmV093Data;
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
