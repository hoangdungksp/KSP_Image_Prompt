/**
 * Story Arc Templates v0.6
 * 
 * Pre-defined 9-cell TVC narratives per industry.
 * Each arc has 9 frames with timing + role + suggested action.
 */

import type { Industry } from "../themes_industry/_modes_industries";

// v0.7.1: Expanded GridFormat for flexible frame counts (1-16)
export type GridFormat = "1x1" | "2x1" | "3x1" | "2x2" | "3x2" | "3x3" | "4x3" | "4x4" | "5x3" | "5x4";

export interface FrameTemplate {
  /** v0.7.1: Stable ID for frame operations */
  id?: string;
  /** Frame number 1-16 */
  num: number;
  /** Timing label e.g. "0:00-0:03s" */
  timing: string;
  /** Role: Hook / Problem / Product / Apply / Result / Hero / Logo */
  role: string;
  /** Action description in English (used in final prompt) */
  action: string;
  /** v0.6.5: Vietnamese version - what user sees and edits */
  actionVi?: string;
  /** v0.6.5: English action used in prompt */
  actionEn?: string;
  /** Vietnamese hint shown to user (optional, for pre-built templates) */
  hintVi?: string;
  /** v0.7.1: Lock status */
  locked?: boolean;
  /** v0.7.1: Cropped image reference */
  imageRefId?: string;
  /** v0.7.1: Regeneration count */
  regenCount?: number;
}

export interface StoryArc {
  industry: Industry | "general";
  format: GridFormat;
  /** Total duration in seconds */
  duration: number;
  frames: FrameTemplate[];
}

// ============================================================================
// FORMAT CONFIGS — number of cells, default duration per cell
// ============================================================================

export const FORMAT_CONFIGS: Record<GridFormat, { cells: number; cellDuration: number; totalDuration: number; label: string }> = {
  "1x1": { cells: 1, cellDuration: 3, totalDuration: 3, label: "1×1 (1 cảnh, ~3s)" },
  "2x1": { cells: 2, cellDuration: 3, totalDuration: 6, label: "2×1 (2 cảnh, ~6s)" },
  "3x1": { cells: 3, cellDuration: 3, totalDuration: 9, label: "3×1 (3 cảnh, ~9s)" },
  "2x2": { cells: 4, cellDuration: 3, totalDuration: 12, label: "2×2 (4 cảnh, ~12s) - TikTok ngắn" },
  "3x2": { cells: 6, cellDuration: 3, totalDuration: 18, label: "3×2 (6 cảnh, ~18s) - Reels vừa" },
  "3x3": { cells: 9, cellDuration: 3, totalDuration: 27, label: "3×3 (9 cảnh, ~27s) - TVC chuẩn" },
  "4x3": { cells: 12, cellDuration: 3, totalDuration: 36, label: "4×3 (12 cảnh, ~36s) - TVC dài" },
  "4x4": { cells: 16, cellDuration: 3, totalDuration: 48, label: "4×4 (16 cảnh, ~48s) - TVC rất dài" },
  "5x3": { cells: 15, cellDuration: 3, totalDuration: 45, label: "5×3 (15 cảnh, ~45s)" },
  "5x4": { cells: 20, cellDuration: 3, totalDuration: 60, label: "5×4 (20 cảnh, ~60s)" },
};

function makeTimings(cellCount: number, secPerCell = 3): string[] {
  return Array.from({ length: cellCount }, (_, i) => {
    const start = i * secPerCell;
    const end = (i + 1) * secPerCell;
    const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    return `${fmt(start)}-${fmt(end)}s`;
  });
}

// ============================================================================
// ARC TEMPLATES PER INDUSTRY (3x3 default)
// ============================================================================

const SKINCARE_3x3: FrameTemplate[] = [
  { num: 1, timing: "0:00-0:03s", role: "Hook", action: "Woman gently waking up in soft morning light, eyes opening peacefully, intimate close-up", hintVi: "Mở đầu - thức dậy buổi sáng" },
  { num: 2, timing: "0:03-0:06s", role: "Problem", action: "Looking in vanity mirror, gentle concerned expression noticing skin condition, neutral observation", hintVi: "Vấn đề - soi gương thấy da" },
  { num: 3, timing: "0:06-0:09s", role: "Product Reveal", action: "Hand reaching for skincare product on vanity, product clearly visible with brand label facing camera", hintVi: "Phát hiện sản phẩm" },
  { num: 4, timing: "0:09-0:12s", role: "Apply 1", action: "Pouring serum drops into palm, golden droplets in slow-motion freeze, focused intent expression", hintVi: "Bôi sản phẩm bước 1" },
  { num: 5, timing: "0:12-0:15s", role: "Apply 2", action: "Gently patting product onto cheeks with fingertips, eyes closed in serene enjoyment, dewy skin texture", hintVi: "Bôi sản phẩm bước 2" },
  { num: 6, timing: "0:15-0:18s", role: "Result", action: "Looking back at mirror with radiant glowing dewy skin, soft confident smile of satisfaction", hintVi: "Kết quả - da glowing" },
  { num: 7, timing: "0:18-0:21s", role: "Confidence", action: "Walking out of bathroom with new confidence, fresh styled hair, natural smile, lifestyle moment", hintVi: "Tự tin lifestyle" },
  { num: 8, timing: "0:21-0:24s", role: "Hero Shot", action: "Holding product elegantly at chest level facing camera, bright confident smile, brand ambassador pose", hintVi: "Hero shot TVC" },
  { num: 9, timing: "0:24-0:27s", role: "Logo End", action: "Product shot on minimalist background with brand logo and tagline, no person, clean commercial close-up", hintVi: "Logo + tagline cuối" },
];

const FNB_3x3: FrameTemplate[] = [
  { num: 1, timing: "0:00-0:03s", role: "Hook", action: "Person looking thirsty/hungry, slight craving expression, intimate close-up of face", hintVi: "Mở đầu - cảm giác thèm" },
  { num: 2, timing: "0:03-0:06s", role: "Sees Product", action: "Eyes widen as product comes into view, anticipation expression, soft focus background", hintVi: "Phát hiện sản phẩm" },
  { num: 3, timing: "0:06-0:09s", role: "Open/Pour", action: "Opening product packaging or pouring beverage, splash droplets frozen mid-air, sensory detail", hintVi: "Mở/Rót sản phẩm" },
  { num: 4, timing: "0:09-0:12s", role: "First Sip/Bite", action: "First taste with eyes closed in pure enjoyment, sensual savoring expression", hintVi: "Nếm thử lần đầu" },
  { num: 5, timing: "0:12-0:15s", role: "Reaction", action: "Eyes opening with delighted surprise, bright smile of satisfaction, joyful moment", hintVi: "Phản ứng tích cực" },
  { num: 6, timing: "0:15-0:18s", role: "Sharing", action: "Sharing product with friend/partner, both laughing together, social warm atmosphere", hintVi: "Chia sẻ với người khác" },
  { num: 7, timing: "0:18-0:21s", role: "Lifestyle", action: "Group enjoying product together in natural setting, candid happy moment, brand experience", hintVi: "Lifestyle moment" },
  { num: 8, timing: "0:21-0:24s", role: "Hero Shot", action: "Holding product proudly toward camera with confident smile, classic TVC commercial pose", hintVi: "Hero shot TVC" },
  { num: 9, timing: "0:24-0:27s", role: "Logo End", action: "Product shot with brand logo, tagline visible, mouthwatering commercial product close-up", hintVi: "Logo cuối" },
];

const TECH_3x3: FrameTemplate[] = [
  { num: 1, timing: "0:00-0:03s", role: "Hook", action: "Person in daily life moment, busy or distracted, modern urban setting", hintVi: "Mở đầu - cuộc sống thường" },
  { num: 2, timing: "0:03-0:06s", role: "Pain Point", action: "Frustrated expression with current limitation, slight struggle or inefficiency moment", hintVi: "Pain point" },
  { num: 3, timing: "0:06-0:09s", role: "Discover Product", action: "Eyes lighting up upon seeing the product, intrigued expression, hands reaching to interact", hintVi: "Phát hiện sản phẩm" },
  { num: 4, timing: "0:09-0:12s", role: "Setup/Wear", action: "Putting on / setting up the product, focused careful interaction, hands on device", hintVi: "Đeo/Setup sản phẩm" },
  { num: 5, timing: "0:12-0:15s", role: "Use Case 1", action: "First impression of using the product, amazed expression, immersed in experience", hintVi: "Trải nghiệm 1" },
  { num: 6, timing: "0:15-0:18s", role: "Use Case 2", action: "Active use in real situation, confident operation, demonstrating capability", hintVi: "Trải nghiệm 2" },
  { num: 7, timing: "0:18-0:21s", role: "Achievement", action: "Successful result moment, satisfied smile, sense of accomplishment", hintVi: "Thành tựu" },
  { num: 8, timing: "0:21-0:24s", role: "Hero Shot", action: "Wearing/holding product proudly, side profile, confident pose toward camera", hintVi: "Hero shot TVC" },
  { num: 9, timing: "0:24-0:27s", role: "Logo End", action: "Tech product on dramatic gradient background with brand logo, premium product shot", hintVi: "Logo cuối" },
];

const FASHION_3x3: FrameTemplate[] = [
  { num: 1, timing: "0:00-0:03s", role: "Hook", action: "Person standing before closet or mirror, contemplating outfit choice, intimate moment", hintVi: "Mở đầu - chuẩn bị" },
  { num: 2, timing: "0:03-0:06s", role: "Choose Outfit", action: "Picking up clothing item from rack, fabric flowing, decision moment", hintVi: "Chọn outfit" },
  { num: 3, timing: "0:06-0:09s", role: "Get Dressed", action: "Putting on the outfit, full body shot in mirror reflection, transformation moment", hintVi: "Mặc đồ" },
  { num: 4, timing: "0:09-0:12s", role: "Walk Out", action: "Walking out the door confidently, outfit in motion, dynamic stride", hintVi: "Bước ra ngoài" },
  { num: 5, timing: "0:12-0:15s", role: "On Street", action: "Walking down street with confidence, outfit catching natural light, urban backdrop", hintVi: "Trên phố" },
  { num: 6, timing: "0:15-0:18s", role: "Confidence Pose", action: "Stopping for confident pose, hands on hips or hair, fashion editorial moment", hintVi: "Pose tự tin" },
  { num: 7, timing: "0:18-0:21s", role: "Detail Shot", action: "Close-up detail of outfit accessories or fabric, premium quality showcase", hintVi: "Detail close-up" },
  { num: 8, timing: "0:21-0:24s", role: "Hero Shot", action: "Full body fashion shot toward camera, signature pose, magazine cover energy", hintVi: "Hero shot magazine" },
  { num: 9, timing: "0:24-0:27s", role: "Logo End", action: "Brand logo with elegant typography on minimalist background, fashion brand identity", hintVi: "Logo cuối" },
];

const TRAVEL_3x3: FrameTemplate[] = [
  { num: 1, timing: "0:00-0:03s", role: "Hook", action: "Person at airport with suitcase, anticipation in eyes, travel moment beginning", hintVi: "Mở đầu - sân bay" },
  { num: 2, timing: "0:03-0:06s", role: "Arrival", action: "Arriving at destination, taking in scenic view, sense of wonder", hintVi: "Đến nơi" },
  { num: 3, timing: "0:06-0:09s", role: "Explore", action: "Walking through local area, exploring street life, immersive experience", hintVi: "Khám phá" },
  { num: 4, timing: "0:09-0:12s", role: "Local Food", action: "Trying local cuisine with delighted reaction, sensory enjoyment", hintVi: "Ẩm thực địa phương" },
  { num: 5, timing: "0:12-0:15s", role: "Iconic Spot", action: "At iconic landmark, taking in the view, memorable travel moment", hintVi: "Địa điểm nổi tiếng" },
  { num: 6, timing: "0:15-0:18s", role: "Activity", action: "Engaging in local activity, joyful action shot, adventure energy", hintVi: "Hoạt động" },
  { num: 7, timing: "0:18-0:21s", role: "Sunset Moment", action: "Watching sunset in scenic location, peaceful contemplation, golden hour magic", hintVi: "Hoàng hôn đẹp" },
  { num: 8, timing: "0:21-0:24s", role: "Hero Shot", action: "Confident pose with destination as backdrop, jubilant smile, achievement feeling", hintVi: "Hero shot du lịch" },
  { num: 9, timing: "0:24-0:27s", role: "Brand End", action: "Brand logo with destination name, tagline 'Discover...' or similar, travel brand identity", hintVi: "Logo brand" },
];

const GENERAL_3x3: FrameTemplate[] = [
  { num: 1, timing: "0:00-0:03s", role: "Hook", action: "Opening hook scene, attention-grabbing moment, intimate close-up", hintVi: "Mở đầu" },
  { num: 2, timing: "0:03-0:06s", role: "Context", action: "Establishing context or situation, scene-setting moment", hintVi: "Bối cảnh" },
  { num: 3, timing: "0:06-0:09s", role: "Tension", action: "Building tension or interest, expression of curiosity", hintVi: "Tình huống" },
  { num: 4, timing: "0:09-0:12s", role: "Reveal", action: "Product or solution reveal moment, hero product shot", hintVi: "Reveal sản phẩm" },
  { num: 5, timing: "0:12-0:15s", role: "Use", action: "Using or interacting with product, engaged demonstration", hintVi: "Sử dụng" },
  { num: 6, timing: "0:15-0:18s", role: "Reaction", action: "Positive emotional reaction to product, satisfaction moment", hintVi: "Phản ứng tích cực" },
  { num: 7, timing: "0:18-0:21s", role: "Lifestyle", action: "Product in real-life lifestyle context, integrated naturally", hintVi: "Lifestyle moment" },
  { num: 8, timing: "0:21-0:24s", role: "Hero Shot", action: "Definitive hero shot with product, brand ambassador pose", hintVi: "Hero shot" },
  { num: 9, timing: "0:24-0:27s", role: "Logo End", action: "Brand logo and tagline reveal, clean commercial close", hintVi: "Logo cuối" },
];

const ARC_BY_INDUSTRY: Record<string, FrameTemplate[]> = {
  skincare: SKINCARE_3x3,
  fnb: FNB_3x3,
  tech: TECH_3x3,
  fashion: FASHION_3x3,
  travel: TRAVEL_3x3,
  general: GENERAL_3x3,
};

/**
 * Get story arc for industry + format.
 * For non-3x3 formats, slice or extend frames intelligently.
 */
export function getStoryArc(industry: Industry | "general", format: GridFormat): StoryArc {
  const config = FORMAT_CONFIGS[format];
  const baseFrames = ARC_BY_INDUSTRY[industry] || GENERAL_3x3;

  let frames: FrameTemplate[];
  if (config.cells === 9) {
    frames = baseFrames;
  } else if (config.cells < 9) {
    // Pick most important frames: Hook, Reveal, Use, Hero, Logo
    const importantIndices = config.cells === 4
      ? [0, 2, 7, 8]  // Hook, Reveal, Hero, Logo
      : config.cells === 6
      ? [0, 1, 2, 4, 7, 8]  // Hook, Context, Reveal, Use, Hero, Logo
      : [0, 1, 2, 4, 5, 7, 8].slice(0, config.cells);
    frames = importantIndices.map((idx, i) => ({
      ...baseFrames[idx],
      num: i + 1,
      timing: makeTimings(config.cells, config.cellDuration)[i],
    }));
  } else {
    // 12 cells: extend with Apply 3, Use Case 3 etc.
    frames = [
      ...baseFrames.slice(0, 7),
      { ...baseFrames[5], num: 8, timing: makeTimings(12, 3)[7], role: "Lifestyle 2", action: baseFrames[5].action + " (variation 2)" },
      ...baseFrames.slice(7),
      { ...baseFrames[7], num: 11, timing: makeTimings(12, 3)[10], role: "Hero 2", action: "Alternative hero pose with product" },
      { ...baseFrames[8], num: 12, timing: makeTimings(12, 3)[11] },
    ];
    frames = frames.slice(0, 12).map((f, i) => ({ ...f, num: i + 1, timing: makeTimings(12, 3)[i] }));
  }

  return {
    industry,
    format,
    duration: config.totalDuration,
    frames,
  };
}

export function getAvailableArcsForIndustry(industry: Industry | "general"): GridFormat[] {
  return ["2x2", "3x2", "3x3", "4x3"];
}

// ============================================================================
// v0.8.0 — FILM ARCS (3-act structure, 12 frames standard)
// ============================================================================

import type { FilmGenre } from "../themes_industry/_modes_industries";

/**
 * Standard 3-act structure for short films:
 * Act 1 (Setup, 3 frames): Establish world, introduce character, inciting incident
 * Act 2 (Conflict, 6 frames): Rising action, obstacles, climax
 * Act 3 (Resolution, 3 frames): Aftermath, resolution, new status quo
 */
const FILM_ARCS_12: Record<FilmGenre, FrameTemplate[]> = {
  action: [
    // Act 1 - Setup
    { num: 1, timing: "0:00-0:03s", role: "World", action: "Establishing wide shot of the action setting (urban rooftops, desert highway, futuristic cityscape)", actionVi: "Khung cảnh hành động (mái nhà, đường cao tốc, thành phố)" },
    { num: 2, timing: "0:03-0:06s", role: "Hero Intro", action: "Protagonist appears in confident hero pose, weapons or skills displayed", actionVi: "Nhân vật chính xuất hiện với pose tự tin" },
    { num: 3, timing: "0:06-0:09s", role: "Inciting Incident", action: "Threat appears or mission begins, character reacts with determination", actionVi: "Đe dọa xuất hiện, nhân vật quyết tâm" },
    // Act 2 - Conflict
    { num: 4, timing: "0:09-0:12s", role: "Rising Action", action: "Character begins pursuit/combat, dynamic motion shot", actionVi: "Nhân vật bắt đầu rượt đuổi/giao chiến" },
    { num: 5, timing: "0:12-0:15s", role: "Obstacle 1", action: "First major obstacle or enemy encounter, intense action sequence", actionVi: "Trở ngại đầu tiên, action căng thẳng" },
    { num: 6, timing: "0:15-0:18s", role: "Setback", action: "Character faces difficulty, briefly overwhelmed", actionVi: "Nhân vật gặp khó, bị áp đảo tạm thời" },
    { num: 7, timing: "0:18-0:21s", role: "Comeback", action: "Hero rallies, finds inner strength, prepares final attack", actionVi: "Nhân vật vực dậy, chuẩn bị đòn cuối" },
    { num: 8, timing: "0:21-0:24s", role: "Climax Build", action: "Tension peaks, slow-motion preparation for final blow", actionVi: "Đỉnh điểm tension, slow-mo chuẩn bị" },
    { num: 9, timing: "0:24-0:27s", role: "Climax", action: "Peak action moment, final confrontation impact", actionVi: "Khoảnh khắc đỉnh điểm, va chạm cuối" },
    // Act 3 - Resolution
    { num: 10, timing: "0:27-0:30s", role: "Aftermath", action: "Dust settles, character stands victorious or contemplative", actionVi: "Bụi tan, nhân vật đứng chiến thắng/suy tư" },
    { num: 11, timing: "0:30-0:33s", role: "Resolution", action: "Character walks away into new horizon, mission accomplished", actionVi: "Nhân vật bước về phía chân trời mới" },
    { num: 12, timing: "0:33-0:36s", role: "Final Frame", action: "Iconic closing shot, character silhouette against epic sky", actionVi: "Khung hình đóng iconic, silhouette nhân vật" },
  ],
  drama: [
    { num: 1, timing: "0:00-0:03s", role: "World", action: "Quiet establishing shot of intimate setting (home, café, street)", actionVi: "Khung cảnh thân mật, yên tĩnh" },
    { num: 2, timing: "0:03-0:06s", role: "Character", action: "Close-up on protagonist in everyday moment, capturing their inner world", actionVi: "Cận cảnh nhân vật trong khoảnh khắc đời thường" },
    { num: 3, timing: "0:06-0:09s", role: "Inciting Moment", action: "Something significant happens — a phone call, encounter, or realization", actionVi: "Sự kiện quan trọng — cuộc gọi, gặp gỡ, nhận thức" },
    { num: 4, timing: "0:09-0:12s", role: "Rising Tension", action: "Character processes news, internal conflict shows on face", actionVi: "Nhân vật xử lý thông tin, xung đột nội tâm" },
    { num: 5, timing: "0:12-0:15s", role: "Decision Point", action: "Character must make choice, weight of decision visible", actionVi: "Điểm quyết định, gánh nặng lựa chọn" },
    { num: 6, timing: "0:15-0:18s", role: "Confrontation", action: "Difficult conversation or face-to-face moment with another character", actionVi: "Đối thoại khó khăn, đối mặt nhân vật khác" },
    { num: 7, timing: "0:18-0:21s", role: "Vulnerability", action: "Emotional breakthrough, tears or quiet revelation", actionVi: "Khoảnh khắc dễ tổn thương, nước mắt hoặc tiết lộ" },
    { num: 8, timing: "0:21-0:24s", role: "Reflection", action: "Character alone, processing what happened", actionVi: "Nhân vật một mình, suy ngẫm" },
    { num: 9, timing: "0:24-0:27s", role: "Climax", action: "Emotional peak — the truth spoken, the choice made", actionVi: "Đỉnh điểm cảm xúc — nói ra sự thật" },
    { num: 10, timing: "0:27-0:30s", role: "Aftermath", action: "Stillness, character changed by what occurred", actionVi: "Tĩnh lặng, nhân vật đã thay đổi" },
    { num: 11, timing: "0:30-0:33s", role: "Acceptance", action: "Subtle smile or peaceful expression, finding new peace", actionVi: "Nụ cười nhẹ, tìm thấy bình yên mới" },
    { num: 12, timing: "0:33-0:36s", role: "Final Frame", action: "Lingering shot of character moving forward into life", actionVi: "Khung hình cuối, nhân vật bước tiếp" },
  ],
  romance: [
    { num: 1, timing: "0:00-0:03s", role: "World", action: "Atmospheric setting — Paris café, Tokyo street, beach sunset", actionVi: "Khung cảnh lãng mạn — quán cà phê, đường phố, biển" },
    { num: 2, timing: "0:03-0:06s", role: "Meet Cute", action: "First encounter between two characters, eyes meet", actionVi: "Gặp gỡ đầu tiên, ánh mắt giao nhau" },
    { num: 3, timing: "0:06-0:09s", role: "Spark", action: "Smile, light touch, shared moment that ignites attraction", actionVi: "Nụ cười, chạm tay, khoảnh khắc khơi gợi" },
    { num: 4, timing: "0:09-0:12s", role: "Connection", action: "Walking together, conversation flowing, getting closer", actionVi: "Đi cùng nhau, trò chuyện, gần gũi hơn" },
    { num: 5, timing: "0:12-0:15s", role: "Intimacy", action: "Quiet shared moment — laughing, exchanging stories", actionVi: "Khoảnh khắc thân mật — cười, kể chuyện" },
    { num: 6, timing: "0:15-0:18s", role: "Conflict", action: "Misunderstanding or external obstacle threatens to separate them", actionVi: "Hiểu lầm hoặc trở ngại đe dọa chia cắt" },
    { num: 7, timing: "0:18-0:21s", role: "Separation", action: "Brief separation, both characters feel the absence", actionVi: "Chia cách tạm thời, cả hai cảm thấy thiếu vắng" },
    { num: 8, timing: "0:21-0:24s", role: "Realization", action: "One character realizes they must act, sets off to find the other", actionVi: "Một nhân vật nhận ra phải hành động, đi tìm" },
    { num: 9, timing: "0:24-0:27s", role: "Climax", action: "The grand romantic moment — a chase, a confession, a kiss", actionVi: "Khoảnh khắc lãng mạn lớn — đuổi theo, tỏ tình, hôn" },
    { num: 10, timing: "0:27-0:30s", role: "Embrace", action: "Tender embrace, all is forgiven", actionVi: "Ôm nhau, mọi thứ được tha thứ" },
    { num: 11, timing: "0:30-0:33s", role: "Joy", action: "Happy moment together, new beginning", actionVi: "Khoảnh khắc hạnh phúc, khởi đầu mới" },
    { num: 12, timing: "0:33-0:36s", role: "Final Frame", action: "Iconic romantic shot — silhouettes against sunset", actionVi: "Khung hình iconic — silhouette dưới hoàng hôn" },
  ],
  comedy: [
    { num: 1, timing: "0:00-0:03s", role: "World", action: "Quirky symmetrical establishing shot, Wes Anderson style", actionVi: "Khung cảnh đối xứng, kiểu Wes Anderson" },
    { num: 2, timing: "0:03-0:06s", role: "Character", action: "Protagonist introduced with deadpan expression, distinctive wardrobe", actionVi: "Nhân vật xuất hiện biểu cảm tĩnh, trang phục đặc trưng" },
    { num: 3, timing: "0:06-0:09s", role: "Setup", action: "Mundane situation that's about to go absurd", actionVi: "Tình huống bình thường sắp trở nên vô lý" },
    { num: 4, timing: "0:09-0:12s", role: "First Beat", action: "First comedic beat — an unexpected reaction or visual gag", actionVi: "Tình huống hài đầu tiên — phản ứng bất ngờ" },
    { num: 5, timing: "0:12-0:15s", role: "Escalation", action: "Situation escalates, character's plan starts unraveling", actionVi: "Tình huống leo thang, kế hoạch đổ vỡ" },
    { num: 6, timing: "0:15-0:18s", role: "Complication", action: "Another character enters, makes things worse with deadpan reaction", actionVi: "Nhân vật khác xuất hiện, làm tình hình tệ hơn" },
    { num: 7, timing: "0:18-0:21s", role: "Peak Chaos", action: "Maximum absurdity — multiple things going wrong at once", actionVi: "Đỉnh điểm hỗn loạn — nhiều thứ sai cùng lúc" },
    { num: 8, timing: "0:21-0:24s", role: "Beat", action: "Beat moment — character's stunned reaction to the chaos", actionVi: "Khoảnh khắc lặng — phản ứng sững sờ" },
    { num: 9, timing: "0:24-0:27s", role: "Punchline", action: "Visual punchline that resolves or amplifies the absurdity", actionVi: "Punchline visual — giải quyết hoặc khuếch đại" },
    { num: 10, timing: "0:27-0:30s", role: "Aftermath", action: "Awkward calm after chaos, characters try to compose themselves", actionVi: "Yên tĩnh ngại sau hỗn loạn, cố lấy lại bình tĩnh" },
    { num: 11, timing: "0:30-0:33s", role: "Resolution", action: "Anti-climactic resolution — life goes on as if nothing happened", actionVi: "Giải quyết phản đỉnh điểm — cuộc sống tiếp diễn" },
    { num: 12, timing: "0:33-0:36s", role: "Final Frame", action: "Symmetrical final shot, character with subtle smile", actionVi: "Khung hình đối xứng cuối, nhân vật cười nhẹ" },
  ],
  horror: [
    { num: 1, timing: "0:00-0:03s", role: "World", action: "Eerie establishing shot — empty house, dark forest, abandoned hospital", actionVi: "Khung cảnh ám ảnh — nhà trống, rừng tối, bệnh viện bỏ hoang" },
    { num: 2, timing: "0:03-0:06s", role: "Character", action: "Character explores space, vaguely uneasy", actionVi: "Nhân vật khám phá không gian, lờ mờ bất an" },
    { num: 3, timing: "0:06-0:09s", role: "First Hint", action: "Subtle wrong detail — a shadow, a sound, an out-of-place object", actionVi: "Chi tiết sai tinh tế — bóng đen, âm thanh, đồ vật lạ" },
    { num: 4, timing: "0:09-0:12s", role: "Tension Build", action: "Character grows alarmed, looks around for source of unease", actionVi: "Nhân vật cảnh giác, nhìn quanh tìm nguyên nhân" },
    { num: 5, timing: "0:12-0:15s", role: "Discovery", action: "Discovers something that confirms danger — a body, a clue, a presence", actionVi: "Phát hiện điều xác nhận nguy hiểm — xác, dấu vết, hiện diện" },
    { num: 6, timing: "0:15-0:18s", role: "Encounter", action: "First glimpse of the threat — partially obscured, terrifying", actionVi: "Nhìn thoáng đe dọa — che khuất một phần, đáng sợ" },
    { num: 7, timing: "0:18-0:21s", role: "Pursuit", action: "Character tries to escape, threat closes in", actionVi: "Nhân vật cố thoát, đe dọa áp sát" },
    { num: 8, timing: "0:21-0:24s", role: "Trapped", action: "Cornered, no way out, dread fills the frame", actionVi: "Bị dồn vào chân tường, không lối thoát" },
    { num: 9, timing: "0:24-0:27s", role: "Reveal", action: "Full reveal of horror — the monster, the truth, the worst case", actionVi: "Tiết lộ đầy đủ — quái vật, sự thật, tệ nhất" },
    { num: 10, timing: "0:27-0:30s", role: "Aftermath", action: "Survivor or victim — silence, blood, distant scream", actionVi: "Sống sót hoặc nạn nhân — im lặng, máu, tiếng hét xa" },
    { num: 11, timing: "0:30-0:33s", role: "Twist", action: "Final unsettling beat — the horror isn't over", actionVi: "Tình tiết bất ngờ cuối — kinh hoàng chưa kết thúc" },
    { num: 12, timing: "0:33-0:36s", role: "Final Frame", action: "Lingering creepy shot, ambiguous fate", actionVi: "Khung hình rợn người cuối, kết thúc mơ hồ" },
  ],
  sci_fi: [
    { num: 1, timing: "0:00-0:03s", role: "World", action: "Epic establishing shot of futuristic/fantasy world", actionVi: "Khung cảnh thế giới tương lai/fantasy hoành tráng" },
    { num: 2, timing: "0:03-0:06s", role: "Character", action: "Protagonist introduced — futuristic suit, magical artifact, or unique abilities", actionVi: "Nhân vật chính — bộ đồ tương lai, vật phẩm phép thuật" },
    { num: 3, timing: "0:06-0:09s", role: "World Element", action: "Show signature world element — flying car, floating island, alien creature", actionVi: "Yếu tố thế giới đặc trưng — xe bay, đảo bay, sinh vật ngoài hành tinh" },
    { num: 4, timing: "0:09-0:12s", role: "Mission", action: "Character's mission or quest is revealed", actionVi: "Nhiệm vụ/chuyến đi của nhân vật được tiết lộ" },
    { num: 5, timing: "0:12-0:15s", role: "Journey", action: "Character travels — through portal, across stars, into the unknown", actionVi: "Nhân vật du hành — qua portal, băng qua các vì sao" },
    { num: 6, timing: "0:15-0:18s", role: "Encounter", action: "Encounter with another being — alien, magical creature, AI", actionVi: "Gặp gỡ thực thể khác — alien, sinh vật phép, AI" },
    { num: 7, timing: "0:18-0:21s", role: "Conflict", action: "Faces opposition — battle, puzzle, moral dilemma", actionVi: "Đối mặt thử thách — chiến đấu, câu đố, lưỡng nan đạo đức" },
    { num: 8, timing: "0:21-0:24s", role: "Power Moment", action: "Uses signature power or ability at full strength", actionVi: "Dùng sức mạnh đặc trưng đỉnh điểm" },
    { num: 9, timing: "0:24-0:27s", role: "Climax", action: "Epic final confrontation, fate of world hangs in balance", actionVi: "Đối đầu cuối hoành tráng, vận mệnh treo trên cân" },
    { num: 10, timing: "0:27-0:30s", role: "Resolution", action: "Outcome decided, world saved/changed", actionVi: "Kết quả được quyết định, thế giới được cứu/thay đổi" },
    { num: 11, timing: "0:30-0:33s", role: "Aftermath", action: "Character contemplates new reality, possibly bittersweet", actionVi: "Nhân vật suy ngẫm thực tại mới, có thể ngọt ngào pha cay đắng" },
    { num: 12, timing: "0:33-0:36s", role: "Final Frame", action: "Iconic closing — character against epic sci-fi backdrop", actionVi: "Khung hình cuối iconic — nhân vật trên nền sci-fi hoành tráng" },
  ],
};

/**
 * v0.8.0: Get film story arc for genre + format.
 */
export function getFilmStoryArc(
  genre: FilmGenre,
  format: GridFormat
): StoryArc {
  const config = FORMAT_CONFIGS[format];
  const baseFrames = FILM_ARCS_12[genre] || FILM_ARCS_12.drama;

  let frames: FrameTemplate[];
  if (config.cells === 12) {
    frames = baseFrames;
  } else if (config.cells < 12) {
    // Pick frames that preserve 3-act structure
    const importantIndices =
      config.cells === 4
        ? [0, 4, 8, 11] // World, Mid-conflict, Climax, Final
        : config.cells === 6
        ? [0, 2, 4, 6, 8, 11] // World, Inciting, Rising, Setback, Climax, Final
        : config.cells === 9
        ? [0, 1, 2, 3, 4, 6, 8, 10, 11] // 3-act compressed to 9
        : Array.from({ length: config.cells }, (_, i) =>
            Math.floor((i * 12) / config.cells)
          );
    frames = importantIndices.slice(0, config.cells).map((idx, i) => ({
      ...baseFrames[idx],
      num: i + 1,
      timing: makeTimings(config.cells, config.cellDuration)[i],
    }));
  } else {
    // 12+ cells: extend by adding variations
    const extraNeeded = config.cells - 12;
    const extras: FrameTemplate[] = Array.from({ length: extraNeeded }, (_, i) => ({
      ...baseFrames[Math.min(7 + i, 11)],
      num: 13 + i,
      timing: makeTimings(config.cells, config.cellDuration)[12 + i],
      role: `${baseFrames[Math.min(7 + i, 11)].role} (variation)`,
    }));
    frames = [...baseFrames, ...extras]
      .slice(0, config.cells)
      .map((f, i) => ({ ...f, num: i + 1, timing: makeTimings(config.cells, config.cellDuration)[i] }));
  }

  return {
    industry: "general",
    format,
    duration: config.totalDuration,
    frames,
  };
}
