/**
 * KSP Image qc15 — AI Provider Grid Presets
 *
 * Default grid dimensions per AI image-gen provider, used to pre-fill the
 * Preview & Crop modal when user uploads a grid PNG.
 *
 * Sizes verified from Jason real-world tests (May 2026):
 *   - Nano Banana 16:9: 2752×1536 (sample provided by Jason)
 *   - ChatGPT (DALL-E 3) 16:9: 1672×941 (sample provided by Jason)
 *
 * Other sizes estimated from public documentation + community reports.
 * User can override the textbox value if provider gen-renders differently.
 */

export interface GridProviderPreset {
  id: string;
  label: string;
  defaultSize16x9: { w: number; h: number } | null;
  defaultSize9x16: { w: number; h: number } | null;
  defaultSize1x1: { w: number; h: number } | null;
  /** Typical gutter in pixels (user can adjust slider) */
  defaultGutterPx: number;
}

/**
 * Default provider list. "custom" entry signals auto-detect from
 * image.naturalWidth × image.naturalHeight (no preset).
 */
export const GRID_PROVIDERS: GridProviderPreset[] = [
  {
    id: "nano-banana",
    label: "Nano Banana (Gemini 2.5 Flash Image)",
    defaultSize16x9: { w: 2752, h: 1536 },
    defaultSize9x16: { w: 1536, h: 2752 },
    defaultSize1x1: { w: 2048, h: 2048 },
    defaultGutterPx: 0,
  },
  {
    id: "banana-pro",
    label: "Banana Pro (Gemini 2.5 Pro Image)",
    defaultSize16x9: { w: 2752, h: 1536 },
    defaultSize9x16: { w: 1536, h: 2752 },
    defaultSize1x1: { w: 2048, h: 2048 },
    defaultGutterPx: 2,
  },
  {
    id: "chatgpt",
    label: "ChatGPT (DALL-E 3)",
    defaultSize16x9: { w: 1672, h: 941 },
    defaultSize9x16: { w: 1024, h: 1820 },
    defaultSize1x1: { w: 1024, h: 1024 },
    defaultGutterPx: 4,
  },
  {
    id: "imagen-4",
    label: "Imagen 4 (Google)",
    defaultSize16x9: { w: 2048, h: 1152 },
    defaultSize9x16: { w: 1152, h: 2048 },
    defaultSize1x1: { w: 2048, h: 2048 },
    defaultGutterPx: 0,
  },
  {
    id: "grok",
    label: "Grok / xAI",
    defaultSize16x9: { w: 2048, h: 1152 },
    defaultSize9x16: { w: 1152, h: 2048 },
    defaultSize1x1: { w: 1024, h: 1024 },
    defaultGutterPx: 0,
  },
  {
    id: "custom",
    label: "Custom (auto-detect từ ảnh)",
    defaultSize16x9: null,
    defaultSize9x16: null,
    defaultSize1x1: null,
    defaultGutterPx: 0,
  },
];

/**
 * Pick the appropriate default size for a provider based on aspect bias.
 * Returns null if provider has no preset (custom) or no size for that aspect.
 */
export function getProviderDefaultSize(
  providerId: string,
  aspect: "16:9" | "9:16" | "1:1"
): { w: number; h: number } | null {
  const provider = GRID_PROVIDERS.find((p) => p.id === providerId);
  if (!provider) return null;
  if (aspect === "16:9") return provider.defaultSize16x9;
  if (aspect === "9:16") return provider.defaultSize9x16;
  if (aspect === "1:1") return provider.defaultSize1x1;
  return null;
}

/**
 * Get gutter default for a provider.
 */
export function getProviderDefaultGutter(providerId: string): number {
  return GRID_PROVIDERS.find((p) => p.id === providerId)?.defaultGutterPx ?? 0;
}
