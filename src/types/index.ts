/**
 * KSP Image - Core Types v0.4
 *
 * Schema for the prompt assembly engine.
 * Now supports 5 subject types: female, male, couple, family, friends_group.
 */

// ============================================================================
// CAMERA STYLE — bifurcated based on 18-doc analysis
// ============================================================================

export type CameraStyle = "BOKEH" | "DOCUMENTARY";
export type AspectRatio = "9:16" | "3:4" | "2:3" | "1:1" | "16:9";

// ============================================================================
// SUBJECT TYPE — NEW in v0.4
// ============================================================================

export type SubjectType =
  | "female"        // Nữ (default, từ 18 docs gốc)
  | "male"          // Nam
  | "couple"        // Cặp đôi (1 nam + 1 nữ)
  | "family"        // Gia đình (cha mẹ + con)
  | "friends_group"; // Nhóm bạn (3-5 người cùng giới hoặc mix)

// ============================================================================
// SUBJECT DNA — locked across all shots in a project
// ============================================================================

export interface SubjectDNA {
  /** NEW: Type of subject(s) in the photo */
  subjectType: SubjectType;

  /** Default: "Vietnamese" - Vietnam-first */
  ethnicity:
    | "Vietnamese"
    | "Asian"
    | "Korean"
    | "Japanese"
    | "Chinese"
    | "Mixed";

  /** Age range hint */
  ageRange?: "18-25" | "25-35" | "35-45" | "45+" | "child" | "mixed";

  // ===== FEMALE-specific (existing fields) =====
  figureBuild?: "slender" | "hourglass" | "balanced" | "model-like";
  bust?: "petite" | "full" | "voluptuous";
  waist?: "small" | "natural" | "defined";
  hair?: HairConfig;
  makeup?: MakeupConfig;
  nails?: NailsConfig;

  // ===== MALE-specific (NEW in v0.4) =====
  maleStyle?: MaleStyleConfig;

  // ===== GROUP-specific (NEW in v0.4) =====
  groupComposition?: GroupComposition;

  /** Skin tone */
  skinTone:
    | "milky_white"
    | "porcelain"
    | "fair"
    | "vietnamese_warm"
    | "tan";

  /** Optional facial features */
  eyes?: {
    shape: "round" | "almond" | "default";
    color: "dark_brown" | "brown" | "default";
  };

  /**
   * v0.6.2: Unique identifying features that boost face similarity.
   * Examples: "small mole on left cheek", "freckles across nose bridge",
   * "double eyelid", "dimple when smiling", "small scar above right eyebrow"
   *
   * Research shows specific identifiers can boost face fidelity 4x in Banana Pro.
   */
  uniqueIdentifiers?: string;
}

export interface HairConfig {
  length: "shoulder" | "waist" | "hip" | "floor";
  color: string;
  style: "straight" | "wavy" | "braided" | "ponytail" | "bun" | "pigtails";
  movement: "static" | "wind_blowing" | "damp";
  bangs?: boolean;
  parting?: "middle" | "side" | "none";
}

export interface MakeupConfig {
  style:
    | "korean_wonyoung"
    | "douyin"
    | "natural_no_makeup"
    | "korean_glass_skin"
    | "fresh_dewy"
    | "vietnamese_traditional";
  blushColor?: string;
  lipsType?: string;
}

export interface NailsConfig {
  shape: "almond" | "oval" | "pointed" | "square";
  color: string;
  decoration?: string;
}

// ============================================================================
// MALE STYLE (NEW v0.4)
// ============================================================================

export interface MaleStyleConfig {
  hair:
    | "short_neat"          // Tóc ngắn gọn gàng
    | "undercut"            // Undercut hiện đại
    | "messy"               // Bù xù phong cách
    | "long_tied"           // Tóc dài cột đuôi ngựa
    | "side_parted_classic" // Rẽ ngôi cổ điển
    | "buzz_cut";           // Cắt sát đầu
  beard:
    | "clean_shaven"  // Cạo sạch
    | "stubble"       // Râu lún phún
    | "short_beard"   // Râu ngắn gọn
    | "full_beard";   // Râu rậm
  build:
    | "slim"        // Mảnh
    | "athletic"    // Thể thao
    | "muscular"    // Cơ bắp
    | "average";    // Trung bình
  /** Style của trang phục */
  styleVibe:
    | "korean_idol"     // Phong cách Hàn idol
    | "vintage"         // Cổ điển
    | "modern_business" // Doanh nhân hiện đại
    | "casual_streetwear" // Streetwear
    | "rugged_outdoor";  // Phong trần
}

// ============================================================================
// GROUP COMPOSITION (NEW v0.4)
// ============================================================================

export interface GroupComposition {
  /** Tổng số người trong khung hình */
  count: number;
  /** Mô tả chi tiết về từng thành viên */
  members: string;
  /** Vibe chung của group */
  vibe?: string;
}

// ============================================================================
// REFERENCE IMAGES
// ============================================================================

export interface ReferenceImagesInput {
  /** Whether at least one face reference is present */
  hasFace: boolean;
  /** NEW v0.4.2: Number of face reference images (for multi-face support) */
  faceCount?: number;
  hasOutfit: boolean;
  outfitTextDescription?: string;
  productCount: number;
  productDescriptions?: string[];
  /** NEW v0.4.5: How each product is integrated into the scene */
  productPlacements?: ProductPlacement[];
}

/** How a product is positioned/used in the scene */
export type ProductPlacement =
  | "held_in_hand"          // Subject cầm trên tay tự nhiên
  | "displayed_held_high"   // Giơ cao trước mặt (TVC style)
  | "placed_foreground"     // Đặt phía trước, là foreground element
  | "subject_using"         // Subject đang sử dụng (vd: bôi kem, uống nước)
  | "next_to_subject"       // Đặt cạnh subject
  | "background_styled"     // Background styled, product placement nhẹ
  | "auto";                 // Để AI quyết

// ============================================================================
// IDEA INPUT
// ============================================================================

export interface IdeaInput {
  raw: string;
  language: "vi" | "en";
  translatedEn?: string;
  hints?: IdeaHints;
}

export interface IdeaHints {
  location?: string;
  time?:
    | "golden_hour"
    | "blue_hour"
    | "midday"
    | "afternoon"
    | "night"
    | "overcast"
    | "indoor";
  mood?: string[];
  props?: string[];
  vietnameseText?: VietnameseTextSpec[];
}

export interface VietnameseTextSpec {
  text: string;
  style: string;
  placement: string;
}

// ============================================================================
// SHOT
// ============================================================================

export interface Shot {
  id: string;
  order: number;
  name: string;
  pose: PoseConfig;
  anglePresetId?: string;
  cameraOverride?: Partial<CameraConfig>;
}

export interface PoseConfig {
  position: string;
  hands?: string;
  lookingAt: "camera" | "away" | "down" | "object" | "side" | "up";
  expression: string;
  framing: "close-up" | "medium" | "full-body" | "wide" | "selfie";
  cameraAngle: "eye_level" | "low" | "bird_eye" | "slight_high" | "slight_low";
  notes?: string;
}

export interface CameraConfig {
  style: CameraStyle;
  angle: PoseConfig["cameraAngle"];
  framing: PoseConfig["framing"];
  aspectRatio: AspectRatio;
}

// ============================================================================
// MODE & INDUSTRY (NEW v0.5)
// ============================================================================

export type ShotMode =
  | "lifestyle"          // Default — themes cũ (227)
  | "tvc_commercial"
  | "product_photo"
  | "editorial_fashion"
  | "film";              // v0.8.0: Multi-character film/short film

export type Industry =
  | "skincare"
  | "fnb"
  | "tech"
  | "fashion"
  | "travel"     // Map themes cũ vào đây
  | "general";   // Catch-all

// v0.8.0: Film-specific types
export type FilmGenre =
  | "action"
  | "drama"
  | "romance"
  | "comedy"
  | "horror"
  | "sci_fi";

export type AnimationStyle =
  | "live_action"
  | "anime_2d"
  | "cgi_3d"
  | "stop_motion"
  | "cartoon_2d"
  | "film_noir";

export interface FilmCharacter {
  id: string;
  name: string;
  role: "protagonist" | "antagonist" | "supporting" | "extra";
  faceImageIds: string[];
  outfitImageIds: string[];
  description?: string;
  uniqueIdentifiers?: string;
  order: number;
}

// ============================================================================
// PROJECT
// ============================================================================

export interface PromptProject {
  id: string;
  name: string;
  description?: string;
  /** NEW v0.5: shot mode (lifestyle/tvc/product/editorial/film) */
  mode?: ShotMode;
  /** NEW v0.5: industry filter (for non-film modes) */
  industry?: Industry;
  /** v0.8.0: Film genre (replaces industry when mode=film) */
  filmGenre?: FilmGenre;
  /** v0.8.0: Animation style for film output */
  animationStyle?: AnimationStyle;
  /** v0.8.0: Film characters (when mode=film, can have multiple) */
  filmCharacters?: FilmCharacter[];
  /** v0.8.0: Film mode subject management - "simple" uses Subject Type, "characters" uses character cards */
  filmSubjectMode?: "simple" | "characters";
  /** NEW v0.6: storyboard data for TVC mode */
  storyboard?: {
    enabled: boolean;
    /**
     * v0.7.1: Format is now AUTO-DETECTED based on frame count.
     * Kept for backward compat but no longer user-selectable.
     */
    format: "1x1" | "2x1" | "3x1" | "2x2" | "3x2" | "3x3" | "4x3" | "4x4" | "5x3" | "5x4" | "auto";
    /**
     * v0.7.1: Frames now have stable id + locked + per-frame image ref.
     * - id: Stable identifier survives reorders/inserts
     * - locked: When true, AI regeneration won't change this frame
     * - imageRefId: Reference to cropped frame image (after grid render)
     * - version: Tracks regeneration count for this frame
     */
    frames?: Array<{
      /** v0.7.1: Stable ID (UUID-like) */
      id?: string;
      num: number;
      timing: string;
      role: string;
      action: string;
      actionVi?: string;
      actionEn?: string;
      /** v0.7.1: Lock status — locked frames won't be regenerated */
      locked?: boolean;
      /** v0.7.1: Cropped image reference (set after Tab 2 crop) */
      imageRefId?: string;
      /** v0.7.1: Regeneration count for this specific frame */
      regenCount?: number;
    }>;
    /** Brand info for logo frame */
    brandName?: string;
    tagline?: string;
    /** Animation camera style */
    cameraMovement?: "static" | "subtle" | "dynamic" | "cinematic";
    /** Uploaded grid image ID (after user generates grid externally) */
    gridImageId?: string;
    /** Cropped frames after auto-crop */
    croppedFrameIds?: string[];
    /** v0.6.5: AI provider used to generate the arc (for audit/comparison) */
    aiProvider?: "gemini" | "openai" | "template";
    /** v0.6.5: AI's reasoning explanation */
    aiReasoning?: string;
    /**
     * v0.7.1: Version history for revert.
     * Each version is a snapshot taken after major actions.
     */
    versions?: Array<{
      id: string;
      timestamp: number;
      label: string;
      /** Frames at this version */
      frames: Array<{
        id?: string;
        num: number;
        timing: string;
        role: string;
        action: string;
        actionVi?: string;
        actionEn?: string;
        locked?: boolean;
        imageRefId?: string;
        regenCount?: number;
      }>;
      /** Format at this version */
      format: string;
      /** What changed (e.g., "Added frame after #3", "Regenerated frame #5") */
      changeDescription?: string;
    }>;
  };
  idea: IdeaInput;
  references: ReferenceImagesInput;
  subject: SubjectDNA;
  cameraStyle: CameraStyle;
  aspectRatio: AspectRatio;
  shots: Shot[];
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// ASSEMBLER OUTPUT
// ============================================================================

export interface AssembledPrompt {
  prompt: string;
  blocks: {
    faceLock: string;
    body: string;
    hair: string;
    makeup: string;
    skinParadox: string;
    nails: string;
    outfit: string;
    productIntegration: string;
    pose: string;
    location: string;
    lighting: string;
    camera: string;
    style: string;
    negative: string;
  };
  estimatedTokens: number;
}

// ============================================================================
// v0.9.0 EXTENSIONS — Re-export new types
// ============================================================================
// New types are defined in ./v0_9_0.ts to keep index.ts manageable.
// PromptProject is augmented via intersection: PromptProject & ProjectV09Extensions
// ============================================================================

export * from "./v0_9_0";
export * from "./photos_v091";

