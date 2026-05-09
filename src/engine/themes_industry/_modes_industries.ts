/**
 * KSP Image v0.5 — Mode & Industry definitions
 *
 * Two orthogonal axes that filter themes and adapt engine behavior:
 *   - Mode: How is this shot styled? (Lifestyle, TVC, Product Photography, Editorial)
 *   - Industry: What sector/category? (Mỹ phẩm, F&B, Tech, Fashion, Travel)
 */

// ============================================================================
// MODES — 4 styles of photography
// ============================================================================

export type ShotMode =
  | "lifestyle"          // Subject sống cuộc sống bình thường, product là phụ (default)
  | "tvc_commercial"     // Subject pose chính diện, giơ product, focus brand
  | "product_photo"      // Không subject, chỉ product trên background đẹp
  | "editorial_fashion"  // High-fashion magazine style
  | "film";              // v0.8.0: Film/Short film mode (multi-character, no product)

// v0.8.0: Film genres (replaces industry for film mode)
export type FilmGenre =
  | "action"
  | "drama"
  | "romance"
  | "comedy"
  | "horror"
  | "sci_fi";

// v0.8.0: Animation style for film output
export type AnimationStyle =
  | "live_action"
  | "anime_2d"
  | "cgi_3d"
  | "stop_motion"
  | "cartoon_2d"
  | "film_noir";

export interface FilmGenreConfig {
  id: FilmGenre;
  name: string;
  emoji: string;
  description: string;
  /** Style references that AI should match */
  styleReferences: string[];
  hintVi: string;
}

export const FILM_GENRES: FilmGenreConfig[] = [
  {
    id: "action",
    name: "Action / Adventure",
    emoji: "💥",
    description: "Hành động, phiêu lưu, kịch tính",
    styleReferences: ["John Wick", "Mad Max: Fury Road", "Mission Impossible", "The Raid"],
    hintVi: "Pacing nhanh, camera dynamic, fight choreography, explosions, chase sequences.",
  },
  {
    id: "drama",
    name: "Drama / Slice-of-life",
    emoji: "🎭",
    description: "Cảm xúc sâu, nhân vật phát triển",
    styleReferences: ["Manchester by the Sea", "Lost in Translation", "Marriage Story", "Past Lives"],
    hintVi: "Pacing chậm, close-ups intimate, lighting tự nhiên, focus vào emotion + dialog.",
  },
  {
    id: "romance",
    name: "Romance",
    emoji: "💕",
    description: "Tình cảm, chemistry giữa nhân vật",
    styleReferences: ["La La Land", "Before Sunrise", "Call Me By Your Name", "In the Mood for Love"],
    hintVi: "Warm lighting, soft focus, eye contact, body language, tender moments.",
  },
  {
    id: "comedy",
    name: "Comedy",
    emoji: "😄",
    description: "Hài hước, light-hearted",
    styleReferences: ["Wes Anderson films", "The Grand Budapest Hotel", "Superbad", "Bridesmaids"],
    hintVi: "Bright lighting, symmetrical composition, character expressions, comedic timing.",
  },
  {
    id: "horror",
    name: "Horror / Thriller",
    emoji: "😱",
    description: "Sợ hãi, suspense, atmospheric",
    styleReferences: ["Hereditary", "The Shining", "It Follows", "Get Out"],
    hintVi: "Dark moody lighting, slow tension build, unsettling angles, dread atmosphere.",
  },
  {
    id: "sci_fi",
    name: "Sci-fi / Fantasy",
    emoji: "🚀",
    description: "Tương lai, fantasy, world-building",
    styleReferences: ["Blade Runner 2049", "Dune", "Interstellar", "Studio Ghibli films"],
    hintVi: "World-building cinematic, futuristic/magical elements, epic scale, imaginative visuals.",
  },
];

export interface AnimationStyleConfig {
  id: AnimationStyle;
  name: string;
  emoji: string;
  description: string;
  /** Style descriptors injected into prompt */
  promptStyle: string;
  hintVi: string;
}

export const ANIMATION_STYLES: AnimationStyleConfig[] = [
  {
    id: "live_action",
    name: "Live Action",
    emoji: "🎥",
    description: "Realistic, cinematic film",
    promptStyle: "live action cinematography, photorealistic, 35mm film aesthetic, ARRI Alexa camera, professional color grading, cinematic depth of field",
    hintVi: "Phim thực tế, quay bằng camera, photorealistic.",
  },
  {
    id: "anime_2d",
    name: "2D Anime",
    emoji: "🎨",
    description: "Studio Ghibli, Makoto Shinkai style",
    promptStyle: "2D anime style, hand-drawn aesthetic, Studio Ghibli inspiration, vibrant colors, expressive character design, Makoto Shinkai-style backgrounds, anime cel shading",
    hintVi: "Phong cách anime Nhật, Ghibli, Makoto Shinkai.",
  },
  {
    id: "cgi_3d",
    name: "3D CGI",
    emoji: "🎮",
    description: "Pixar, DreamWorks, Disney 3D",
    promptStyle: "3D CGI animation, Pixar/DreamWorks style, polished rendering, expressive character animation, vibrant colors, cinematic lighting in 3D space",
    hintVi: "Phong cách Pixar, DreamWorks, Disney 3D.",
  },
  {
    id: "stop_motion",
    name: "Stop-motion",
    emoji: "🖌",
    description: "Wes Anderson, Aardman, Laika",
    promptStyle: "stop-motion animation style, handcrafted puppet aesthetic, Wes Anderson Isle of Dogs / Aardman / Laika Studios inspiration, tactile texture, slight choppy frame quality (12fps feel)",
    hintVi: "Phim hoạt hình con rối, Wes Anderson Isle of Dogs.",
  },
  {
    id: "cartoon_2d",
    name: "2D Cartoon",
    emoji: "📚",
    description: "Western 2D animation, flat style",
    promptStyle: "2D cartoon style, flat colors, Western animation aesthetic (Disney classic / Adventure Time / Avatar TLA influence), bold outlines, expressive character design",
    hintVi: "Hoạt hình 2D phương Tây, Disney cổ điển.",
  },
  {
    id: "film_noir",
    name: "Film Noir",
    emoji: "🌑",
    description: "Black & white classic noir",
    promptStyle: "film noir style, black and white cinematography, high-contrast chiaroscuro lighting, 1940s-1950s aesthetic, dramatic shadows, venetian blind shadow patterns, smoke atmosphere",
    hintVi: "Phim đen trắng cổ điển, ánh sáng kịch tính.",
  },
];

// v0.8.0: Character for film mode (multi-character support)
export interface FilmCharacter {
  /** Stable ID */
  id: string;
  /** Character name (vd: "Linh", "Tuấn", "Detective Lee") */
  name: string;
  /** Role: protagonist / antagonist / supporting / extra */
  role: "protagonist" | "antagonist" | "supporting" | "extra";
  /** Face reference image IDs (1-6 angles) */
  faceImageIds: string[];
  /** Outfit reference image IDs */
  outfitImageIds: string[];
  /** Brief description (age, ethnicity, build, demeanor) */
  description?: string;
  /** Unique features for face fidelity */
  uniqueIdentifiers?: string;
  /** Order in cast list */
  order: number;
}

export interface ModeConfig {
  id: ShotMode;
  name: string;
  emoji: string;
  description: string;
  /** When user picks this mode, default these settings */
  defaults: {
    /** Default product placement when user doesn't specify */
    productPlacement?: "auto" | "held_in_hand" | "displayed_held_high" | "placed_foreground" | "subject_using" | "next_to_subject" | "background_styled";
    /** Default camera style */
    cameraStyle?: "BOKEH" | "DOCUMENTARY";
    /** Skip subject DNA section (only for product_photo) */
    skipSubject?: boolean;
  };
  /** Hint shown in UI */
  hintVi: string;
}

export const SHOT_MODES: ModeConfig[] = [
  {
    id: "lifestyle",
    name: "Lifestyle",
    emoji: "☕",
    description: "Cuộc sống bình thường, product là phụ",
    defaults: { productPlacement: "next_to_subject", cameraStyle: "DOCUMENTARY" },
    hintVi: "Phù hợp content organic, influencer, daily life moment. Product xuất hiện tự nhiên.",
  },
  {
    id: "tvc_commercial",
    name: "TVC Commercial",
    emoji: "🎬",
    description: "Subject pose chính diện, giơ product, focus brand",
    defaults: { productPlacement: "displayed_held_high", cameraStyle: "BOKEH" },
    hintVi: "Phù hợp branded content, paid ads, product launch. Subject là model + brand ambassador.",
  },
  {
    id: "product_photo",
    name: "Product Photography",
    emoji: "📦",
    description: "Chỉ product trên background đẹp",
    defaults: { productPlacement: "placed_foreground", cameraStyle: "BOKEH", skipSubject: true },
    hintVi: "Phù hợp catalog, e-commerce, packshot. Không có người, focus 100% vào product.",
  },
  {
    id: "editorial_fashion",
    name: "Editorial Fashion",
    emoji: "✨",
    description: "High-fashion magazine, dramatic",
    defaults: { productPlacement: "auto", cameraStyle: "BOKEH" },
    hintVi: "Phù hợp fashion brand, magazine spread, editorial campaign. Pose dramatic, lighting cinematic.",
  },
  {
    id: "film",
    name: "Film / Short film",
    emoji: "🎞",
    description: "Multi-character storytelling, no product",
    defaults: { cameraStyle: "BOKEH", skipSubject: false },
    hintVi: "Phim ngắn, music video, narrative content. Multi-character cast + animation style (live/anime/3D/...).",
  },
];

// ============================================================================
// INDUSTRIES — 5 ngành ưu tiên
// ============================================================================

export type Industry =
  | "skincare"     // Mỹ phẩm + Skincare
  | "fnb"          // F&B (đồ ăn, đồ uống)
  | "tech"         // Tech / điện tử / smart glasses
  | "fashion"     // Thời trang
  | "travel"       // Du lịch / lifestyle (themes cũ)
  | "general";     // Catch-all

export interface IndustryConfig {
  id: Industry;
  name: string;
  emoji: string;
  description: string;
  /** Which modes are typically used for this industry */
  supportedModes: ShotMode[];
  hintVi: string;
}

export const INDUSTRIES: IndustryConfig[] = [
  {
    id: "skincare",
    name: "Mỹ phẩm",
    emoji: "💄",
    description: "Skincare, makeup, beauty",
    supportedModes: ["lifestyle", "tvc_commercial", "product_photo"],
    hintVi: "Serum, kem dưỡng, lipstick, sheet mask, sunscreen...",
  },
  {
    id: "fnb",
    name: "F&B",
    emoji: "🍔",
    description: "Đồ ăn, đồ uống, beverage",
    supportedModes: ["lifestyle", "tvc_commercial", "product_photo"],
    hintVi: "Cà phê, nước ép, bia, bánh, pizza, sushi, juice...",
  },
  {
    id: "tech",
    name: "Tech",
    emoji: "📱",
    description: "Smart glasses, phone, gadget",
    supportedModes: ["lifestyle", "tvc_commercial", "product_photo"],
    hintVi: "iPhone, smart glasses, AirPods, headphones, smartwatch, gadgets...",
  },
  {
    id: "fashion",
    name: "Thời trang",
    emoji: "👗",
    description: "Áo, túi xách, giày, phụ kiện",
    supportedModes: ["lifestyle", "tvc_commercial", "product_photo", "editorial_fashion"],
    hintVi: "Áo dài, áo polo, denim, sneakers, túi xách, jewelry...",
  },
  {
    id: "travel",
    name: "Du lịch / Lifestyle",
    emoji: "🌴",
    description: "Travel, locations, lifestyle moments",
    supportedModes: ["lifestyle"],
    hintVi: "Bao gồm 227 themes cũ — địa điểm VN, mùa, lễ hội, đồng quê, đời thường",
  },
  {
    id: "general",
    name: "Tất cả",
    emoji: "📁",
    description: "All industries / general use",
    supportedModes: ["lifestyle", "tvc_commercial", "product_photo", "editorial_fashion"],
    hintVi: "Hiển thị tất cả themes",
  },
];

// ============================================================================
// HELPERS
// ============================================================================

export function getModeById(id: ShotMode): ModeConfig | undefined {
  return SHOT_MODES.find((m) => m.id === id);
}

export function getIndustryById(id: Industry): IndustryConfig | undefined {
  return INDUSTRIES.find((i) => i.id === id);
}

/**
 * Returns true if this mode/industry combination is sensible.
 * E.g., editorial_fashion + fnb doesn't really make sense.
 */
export function isModeSupportedForIndustry(mode: ShotMode, industry: Industry): boolean {
  const config = getIndustryById(industry);
  return config?.supportedModes.includes(mode) ?? true;
}
