/**
 * AI Video Provider Configurations v0.7.0
 *
 * Source: Research conducted May 2026.
 * Limits/capabilities verified against official docs and recent comparisons.
 */

export type VideoProvider =
  | "seedance_2"
  | "veo_3"
  | "grok_imagine"
  | "kling_3"
  | "sora_2"
  | "runway_gen3"
  | "luma_dream";

export interface ProviderConfig {
  id: VideoProvider;
  /** Display name */
  name: string;
  /** Short marketing description */
  tagline: string;
  /** Maximum single-clip duration in seconds */
  maxClipDuration: number;
  /** Minimum clip duration in seconds */
  minClipDuration: number;
  /** Recommended clip duration for best quality */
  recommendedDuration: number;
  /** Supports native audio in single generation */
  hasNativeAudio: boolean;
  /** Supports image-to-video (start frame) */
  supportsImageInput: boolean;
  /** Supports start-frame + end-frame (frame interpolation) */
  supportsStartEndFrame: boolean;
  /** Supports grid storyboard image as reference (multi-shot in single generation) */
  supportsGridReference: boolean;
  /** Supports clip extension for longer videos */
  supportsExtension: boolean;
  /** Aspect ratios supported */
  aspectRatios: string[];
  /** Approximate cost per second in USD */
  costPerSecond?: number;
  /** Direct URL to access this provider */
  url: string;
  /** Notes for users */
  notes?: string;
}

export const PROVIDERS: Record<VideoProvider, ProviderConfig> = {
  seedance_2: {
    id: "seedance_2",
    name: "Seedance 2.0",
    tagline: "ByteDance's flagship — multimodal with native audio, best for character-driven TVC",
    maxClipDuration: 15,
    minClipDuration: 4,
    recommendedDuration: 12,
    hasNativeAudio: true,
    supportsImageInput: true,
    supportsStartEndFrame: false,
    supportsGridReference: true,
    supportsExtension: true,
    aspectRatios: ["9:16", "16:9", "4:3", "1:1", "21:9", "3:4"],
    costPerSecond: 0.10,
    url: "https://jimeng.jianying.com/",
    notes: "Recommend cho TVC. Hỗ trợ grid storyboard reference + extension cho video dài.",
  },

  veo_3: {
    id: "veo_3",
    name: "Veo 3.1",
    tagline: "Google premium — 4K + cinematic quality, best for product close-ups",
    maxClipDuration: 8,
    minClipDuration: 4,
    recommendedDuration: 8,
    hasNativeAudio: true,
    supportsImageInput: true,
    supportsStartEndFrame: true,
    supportsGridReference: false,
    supportsExtension: true,
    aspectRatios: ["9:16", "16:9"],
    costPerSecond: 0.40,
    url: "https://gemini.google.com/",
    notes: "8s tối đa nhưng chất lượng tốt nhất. Hỗ trợ start+end frame interpolation.",
  },

  grok_imagine: {
    id: "grok_imagine",
    name: "Grok Imagine",
    tagline: "xAI — 15s clips with native audio, budget-friendly for social media",
    maxClipDuration: 15,
    minClipDuration: 1,
    recommendedDuration: 10,
    hasNativeAudio: true,
    supportsImageInput: true,
    supportsStartEndFrame: false,
    supportsGridReference: false,
    supportsExtension: false,
    aspectRatios: ["9:16", "16:9", "1:1", "4:3", "3:4", "3:2", "2:3"],
    costPerSecond: 0.05,
    url: "https://grok.com/",
    notes: "Rẻ nhất ($0.05/s). Phù hợp Reels/TikTok. 720p only.",
  },

  kling_3: {
    id: "kling_3",
    name: "Kling 3.0",
    tagline: "Strong character consistency, motion coherence specialist",
    maxClipDuration: 10,
    minClipDuration: 5,
    recommendedDuration: 10,
    hasNativeAudio: false,
    supportsImageInput: true,
    supportsStartEndFrame: true,
    supportsGridReference: false,
    supportsExtension: true,
    aspectRatios: ["9:16", "16:9", "1:1"],
    costPerSecond: 0.20,
    url: "https://klingai.com/",
    notes: "Per-pair workflow tốt. Hỗ trợ start+end frame.",
  },

  sora_2: {
    id: "sora_2",
    name: "Sora 2",
    tagline: "OpenAI flagship — cinematic storytelling, longer clips",
    maxClipDuration: 20,
    minClipDuration: 4,
    recommendedDuration: 12,
    hasNativeAudio: true,
    supportsImageInput: true,
    supportsStartEndFrame: false,
    supportsGridReference: false,
    supportsExtension: false,
    aspectRatios: ["9:16", "16:9", "1:1"],
    costPerSecond: 0.50,
    url: "https://openai.com/sora",
    notes: "Có thể restricted access — requires ChatGPT Plus/Pro.",
  },

  runway_gen3: {
    id: "runway_gen3",
    name: "Runway Gen-3",
    tagline: "Cinematic look, frame-accurate control",
    maxClipDuration: 10,
    minClipDuration: 5,
    recommendedDuration: 10,
    hasNativeAudio: false,
    supportsImageInput: true,
    supportsStartEndFrame: true,
    supportsGridReference: false,
    supportsExtension: true,
    aspectRatios: ["9:16", "16:9", "1:1"],
    costPerSecond: 0.25,
    url: "https://runwayml.com/",
    notes: "Per-pair workflow. Cinematic output cao.",
  },

  luma_dream: {
    id: "luma_dream",
    name: "Luma Dream Machine",
    tagline: "Fast turnaround, good for previews",
    maxClipDuration: 5,
    minClipDuration: 5,
    recommendedDuration: 5,
    hasNativeAudio: false,
    supportsImageInput: true,
    supportsStartEndFrame: true,
    supportsGridReference: false,
    supportsExtension: true,
    aspectRatios: ["9:16", "16:9", "1:1"],
    costPerSecond: 0.10,
    url: "https://lumalabs.ai/",
    notes: "5s/clip, nhưng generate nhanh — tốt cho preview/iteration.",
  },
};

/**
 * v0.7.2: Pure target durations (without use-case context).
 * User picks duration + aspect ratio independently for full flexibility.
 */
export const TARGET_DURATIONS = [
  { value: 6, label: "6s" },
  { value: 8, label: "8s" },
  { value: 10, label: "10s" },
  { value: 12, label: "12s" },
  { value: 15, label: "15s" },
  { value: 18, label: "18s" },
  { value: 20, label: "20s" },
  { value: 24, label: "24s" },
  { value: 27, label: "27s" },
  { value: 30, label: "30s" },
  { value: 36, label: "36s" },
  { value: 45, label: "45s" },
  { value: 60, label: "60s" },
] as const;

/**
 * v0.7.2: Aspect ratios with use-case context.
 */
export type AspectRatioOption = "9:16" | "16:9" | "1:1" | "4:5" | "21:9";

export const ASPECT_RATIOS: Array<{
  value: AspectRatioOption;
  label: string;
  description: string;
  emoji: string;
}> = [
  {
    value: "9:16",
    label: "9:16 Vertical",
    description: "TikTok / Reels / Shorts / Stories — mobile-first",
    emoji: "📱",
  },
  {
    value: "16:9",
    label: "16:9 Horizontal",
    description: "YouTube / Web / TV — landscape cinematic",
    emoji: "🖥",
  },
  {
    value: "1:1",
    label: "1:1 Square",
    description: "Instagram feed / Facebook / LinkedIn",
    emoji: "⬜",
  },
  {
    value: "4:5",
    label: "4:5 Portrait",
    description: "Instagram feed portrait — chiếm nhiều màn hình hơn",
    emoji: "📐",
  },
  {
    value: "21:9",
    label: "21:9 Cinematic",
    description: "Cinematic ultra-wide — phim ảnh, montage",
    emoji: "🎬",
  },
];

/**
 * Get aspect ratios supported by a given provider.
 */
export function getProviderAspectRatios(provider: VideoProvider): AspectRatioOption[] {
  const config = PROVIDERS[provider];
  return config.aspectRatios.filter((r): r is AspectRatioOption =>
    ["9:16", "16:9", "1:1", "4:5", "21:9"].includes(r)
  );
}

/**
 * Get list of providers that can handle a given target duration in 1 chunk.
 */
export function getSingleShotProviders(targetDuration: number): VideoProvider[] {
  return (Object.keys(PROVIDERS) as VideoProvider[])
    .filter((id) => PROVIDERS[id].maxClipDuration >= targetDuration);
}

/**
 * Calculate cost estimate for a given provider + duration.
 */
export function estimateCost(provider: VideoProvider, totalDuration: number): number | null {
  const config = PROVIDERS[provider];
  if (!config.costPerSecond) return null;
  return config.costPerSecond * totalDuration;
}
