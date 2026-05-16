/**
 * KSP Image qc17 — Video Provider Duration Constraints
 *
 * Each AI video provider supports specific durations:
 *   - Seedance 2.0 Pro: 4-15s flexible (any integer)
 *   - Veo 3: 8s only (fixed)
 *   - Kling 2: 5s or 10s (two modes)
 *   - Sora: 5s, 10s, or 20s
 *   - Grok Imagine: 6s or 10s
 *
 * Used by:
 *   1. AI Shot List generation — prompt constrains AI to use only supported durations
 *   2. Animation prompt copy — validates shot duration vs provider, offers auto-clamp
 *
 * Jason confirmed Hướng D (qc16 conversation):
 *   - Project Setting `defaultVideoProvider` → AI Shot List uses these durations
 *   - Per-shot override possible (existing schema `shot.videoProviderId`)
 *   - On copy animation prompt → validate + offer clamp if mismatch
 */

export interface ProviderDurationSpec {
  /** Provider ID matching FilmVideoProvider.id */
  providerId: string;
  /** Human label for UI */
  label: string;
  /**
   * Supported durations in seconds.
   * - If "range": all integers in [min, max] are valid
   * - If "discrete": only listed values are valid (e.g. [5, 10] for Kling)
   */
  mode: "range" | "discrete";
  /** For range mode: min duration */
  min?: number;
  /** For range mode: max duration */
  max?: number;
  /** For discrete mode: list of valid durations (sorted ascending) */
  values?: number[];
}

/**
 * Master list of provider duration specs.
 *
 * Sources:
 *   - Seedance: official docs https://seedance.ai (4-15s flexible)
 *   - Veo 3: Google docs (8s fixed)
 *   - Kling 2: Kuaishou docs (5s standard / 10s extended)
 *   - Sora: OpenAI docs (5/10/20s)
 *   - Grok Imagine: xAI docs (6/10s)
 *
 * Verified May 2026. If provider updates supported durations, update here.
 */
export const PROVIDER_DURATIONS: ProviderDurationSpec[] = [
  {
    providerId: "seedance-2-pro",
    label: "Seedance 2.0 Pro",
    mode: "range",
    min: 4,
    max: 15,
  },
  {
    providerId: "veo-3",
    label: "Veo 3",
    mode: "discrete",
    values: [8],
  },
  {
    providerId: "kling-2",
    label: "Kling 2.0",
    mode: "discrete",
    values: [5, 10],
  },
  {
    providerId: "sora",
    label: "Sora",
    mode: "discrete",
    values: [5, 10, 20],
  },
  {
    providerId: "grok-imagine",
    label: "Grok Imagine",
    mode: "discrete",
    values: [6, 10],
  },
];

/**
 * Look up duration spec by provider ID. Returns undefined if unknown
 * (e.g. user custom-added provider — no constraints applied).
 */
export function getProviderDurationSpec(
  providerId: string
): ProviderDurationSpec | undefined {
  return PROVIDER_DURATIONS.find((p) => p.providerId === providerId);
}

/**
 * Get all supported durations as a flat array (for AI prompt + UI display).
 * Range mode: returns [min, min+1, ..., max].
 * Discrete mode: returns sorted values.
 * Unknown provider: returns empty array (no constraint).
 */
export function getSupportedDurations(providerId: string): number[] {
  const spec = getProviderDurationSpec(providerId);
  if (!spec) return [];
  if (spec.mode === "range" && spec.min != null && spec.max != null) {
    const out: number[] = [];
    for (let d = spec.min; d <= spec.max; d++) out.push(d);
    return out;
  }
  return spec.values ?? [];
}

/**
 * Check if a duration is valid for a given provider.
 * Unknown provider returns true (no constraint).
 */
export function isDurationValid(
  duration: number,
  providerId: string
): boolean {
  const spec = getProviderDurationSpec(providerId);
  if (!spec) return true; // No constraint
  if (spec.mode === "range" && spec.min != null && spec.max != null) {
    return duration >= spec.min && duration <= spec.max;
  }
  if (spec.mode === "discrete" && spec.values) {
    return spec.values.includes(duration);
  }
  return true;
}

/**
 * Clamp a duration to the nearest valid value for a provider.
 *
 * Range mode: clamp to [min, max].
 * Discrete mode: pick the value with smallest |delta| from input.
 * Unknown provider: return as-is.
 *
 * Returns the clamped value (may equal input if already valid).
 */
export function clampDurationToProvider(
  duration: number,
  providerId: string
): number {
  const spec = getProviderDurationSpec(providerId);
  if (!spec) return duration;

  if (spec.mode === "range" && spec.min != null && spec.max != null) {
    if (duration < spec.min) return spec.min;
    if (duration > spec.max) return spec.max;
    return Math.round(duration); // ensure integer
  }

  if (spec.mode === "discrete" && spec.values && spec.values.length > 0) {
    // Pick value with smallest absolute delta
    let bestVal = spec.values[0];
    let bestDelta = Math.abs(duration - bestVal);
    for (const v of spec.values) {
      const delta = Math.abs(duration - v);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestVal = v;
      }
    }
    return bestVal;
  }

  return duration;
}

/**
 * Format supported durations for AI prompt instruction.
 *
 * Range: "any integer from 4 to 15 seconds"
 * Discrete: "exactly 5 or 10 seconds"
 * Unknown: "" (no constraint)
 */
export function formatDurationsForPrompt(providerId: string): string {
  const spec = getProviderDurationSpec(providerId);
  if (!spec) return "";

  if (spec.mode === "range" && spec.min != null && spec.max != null) {
    return `any integer from ${spec.min} to ${spec.max} seconds`;
  }

  if (spec.mode === "discrete" && spec.values && spec.values.length > 0) {
    if (spec.values.length === 1) {
      return `exactly ${spec.values[0]} seconds (fixed by provider)`;
    }
    if (spec.values.length === 2) {
      return `either ${spec.values[0]} or ${spec.values[1]} seconds`;
    }
    const last = spec.values[spec.values.length - 1];
    const others = spec.values.slice(0, -1).join(", ");
    return `${others}, or ${last} seconds`;
  }

  return "";
}

/**
 * Format supported durations for UI display.
 *
 * Range: "4-15s flexible"
 * Discrete: "5s / 10s"
 * Unknown: "any duration"
 */
export function formatDurationsForUI(providerId: string): string {
  const spec = getProviderDurationSpec(providerId);
  if (!spec) return "any duration";

  if (spec.mode === "range" && spec.min != null && spec.max != null) {
    return `${spec.min}-${spec.max}s flexible`;
  }

  if (spec.mode === "discrete" && spec.values && spec.values.length > 0) {
    return spec.values.map((v) => `${v}s`).join(" / ");
  }

  return "any duration";
}
