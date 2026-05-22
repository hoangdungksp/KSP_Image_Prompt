/**
 * KSP Image Preview Flow Synthesizer + Cache Key Helpers
 *
 * Pure functions to:
 * 1. Generate cache keys from step picks (for previewCache lookup)
 * 2. Synthesize NarrativeDirection.synthesizedDirectionEn from 5 picks
 *    (consumed by AI Stage 1 + Stage 4 as context block)
 * 3. Build PreviewStepPick from raw user input (option click or free text)
 */

import type {
  PreviewOption,
  PreviewStepPick,
  PreviewCache,
  NarrativeDirection,
} from "../types/project";

// ============================================================================
// Cache key derivation
// ============================================================================

/**
 * Cache key for step 2 = step 1 pick id.
 * If pick is option E (free text), key is "E" (no further subkeying — free text
 * is unique per project, won't share across users).
 */
export function cacheKeyForStep2(step1Pick: PreviewStepPick): string {
  return step1Pick.optionId;
}

/**
 * Cache key for step 3 = "step1Id-step2Id".
 */
export function cacheKeyForStep3(step1Pick: PreviewStepPick, step2Pick: PreviewStepPick): string {
  return `${step1Pick.optionId}-${step2Pick.optionId}`;
}

/**
 * Cache key for step 4 = "step1Id-step2Id-step3Id".
 */
export function cacheKeyForStep4(
  step1Pick: PreviewStepPick,
  step2Pick: PreviewStepPick,
  step3Pick: PreviewStepPick
): string {
  return `${step1Pick.optionId}-${step2Pick.optionId}-${step3Pick.optionId}`;
}

/**
 * Cache key for step 5 = "step1Id-step2Id-step3Id-step4Id".
 */
export function cacheKeyForStep5(
  step1Pick: PreviewStepPick,
  step2Pick: PreviewStepPick,
  step3Pick: PreviewStepPick,
  step4Pick: PreviewStepPick
): string {
  return `${step1Pick.optionId}-${step2Pick.optionId}-${step3Pick.optionId}-${step4Pick.optionId}`;
}

// ============================================================================
// Cache lookup (returns cached options or undefined if miss)
// ============================================================================

export function getCachedStep1(cache: PreviewCache | undefined): PreviewOption[] | undefined {
  return cache?.step1Options;
}

export function getCachedStep2(
  cache: PreviewCache | undefined,
  step1Pick: PreviewStepPick
): PreviewOption[] | undefined {
  if (!cache?.step2OptionsByStep1) return undefined;
  return cache.step2OptionsByStep1[cacheKeyForStep2(step1Pick)];
}

export function getCachedStep3(
  cache: PreviewCache | undefined,
  step1Pick: PreviewStepPick,
  step2Pick: PreviewStepPick
): PreviewOption[] | undefined {
  if (!cache?.step3OptionsByStep12) return undefined;
  return cache.step3OptionsByStep12[cacheKeyForStep3(step1Pick, step2Pick)];
}

export function getCachedStep4(
  cache: PreviewCache | undefined,
  step1Pick: PreviewStepPick,
  step2Pick: PreviewStepPick,
  step3Pick: PreviewStepPick
): PreviewOption[] | undefined {
  if (!cache?.step4OptionsByStep123) return undefined;
  return cache.step4OptionsByStep123[cacheKeyForStep4(step1Pick, step2Pick, step3Pick)];
}

export function getCachedStep5(
  cache: PreviewCache | undefined,
  step1Pick: PreviewStepPick,
  step2Pick: PreviewStepPick,
  step3Pick: PreviewStepPick,
  step4Pick: PreviewStepPick
): PreviewOption[] | undefined {
  if (!cache?.step5OptionsByStep1234) return undefined;
  return cache.step5OptionsByStep1234[cacheKeyForStep5(step1Pick, step2Pick, step3Pick, step4Pick)];
}

// ============================================================================
// Cache update (immutable — returns new PreviewCache with options added)
// ============================================================================

export function setCachedStep1(cache: PreviewCache | undefined, options: PreviewOption[]): PreviewCache {
  return { ...(cache ?? {}), step1Options: options };
}

export function setCachedStep2(
  cache: PreviewCache | undefined,
  step1Pick: PreviewStepPick,
  options: PreviewOption[]
): PreviewCache {
  const existing = cache?.step2OptionsByStep1 ?? {};
  return {
    ...(cache ?? {}),
    step2OptionsByStep1: { ...existing, [cacheKeyForStep2(step1Pick)]: options },
  };
}

export function setCachedStep3(
  cache: PreviewCache | undefined,
  step1Pick: PreviewStepPick,
  step2Pick: PreviewStepPick,
  options: PreviewOption[]
): PreviewCache {
  const existing = cache?.step3OptionsByStep12 ?? {};
  return {
    ...(cache ?? {}),
    step3OptionsByStep12: { ...existing, [cacheKeyForStep3(step1Pick, step2Pick)]: options },
  };
}

export function setCachedStep4(
  cache: PreviewCache | undefined,
  step1Pick: PreviewStepPick,
  step2Pick: PreviewStepPick,
  step3Pick: PreviewStepPick,
  options: PreviewOption[]
): PreviewCache {
  const existing = cache?.step4OptionsByStep123 ?? {};
  return {
    ...(cache ?? {}),
    step4OptionsByStep123: {
      ...existing,
      [cacheKeyForStep4(step1Pick, step2Pick, step3Pick)]: options,
    },
  };
}

export function setCachedStep5(
  cache: PreviewCache | undefined,
  step1Pick: PreviewStepPick,
  step2Pick: PreviewStepPick,
  step3Pick: PreviewStepPick,
  step4Pick: PreviewStepPick,
  options: PreviewOption[]
): PreviewCache {
  const existing = cache?.step5OptionsByStep1234 ?? {};
  return {
    ...(cache ?? {}),
    step5OptionsByStep1234: {
      ...existing,
      [cacheKeyForStep5(step1Pick, step2Pick, step3Pick, step4Pick)]: options,
    },
  };
}

/**
 * r7.29 Feature 2A: Invalidate cache entry for a specific step.
 * Removes the cached options so next loadOptionsForStep() will call AI
 * to gen fresh 4 options. Used when user clicks "🔄 Regen" icon.
 *
 * For step 1: clears step1Options field.
 * For steps 2-5: removes ONLY the cache entry matching current picks (other
 *   pick combinations preserved — useful when user is exploring branches).
 */
export function invalidateCacheForStep(
  cache: PreviewCache | undefined,
  step: 1 | 2 | 3 | 4 | 5,
  picks: {
    step1?: PreviewStepPick;
    step2?: PreviewStepPick;
    step3?: PreviewStepPick;
    step4?: PreviewStepPick;
  }
): PreviewCache {
  if (!cache) return {};
  if (step === 1) {
    const { step1Options: _, ...rest } = cache;
    return rest;
  }
  if (step === 2 && picks.step1) {
    const key = cacheKeyForStep2(picks.step1);
    const map = { ...(cache.step2OptionsByStep1 ?? {}) };
    delete map[key];
    return { ...cache, step2OptionsByStep1: map };
  }
  if (step === 3 && picks.step1 && picks.step2) {
    const key = cacheKeyForStep3(picks.step1, picks.step2);
    const map = { ...(cache.step3OptionsByStep12 ?? {}) };
    delete map[key];
    return { ...cache, step3OptionsByStep12: map };
  }
  if (step === 4 && picks.step1 && picks.step2 && picks.step3) {
    const key = cacheKeyForStep4(picks.step1, picks.step2, picks.step3);
    const map = { ...(cache.step4OptionsByStep123 ?? {}) };
    delete map[key];
    return { ...cache, step4OptionsByStep123: map };
  }
  if (step === 5 && picks.step1 && picks.step2 && picks.step3 && picks.step4) {
    const key = cacheKeyForStep5(picks.step1, picks.step2, picks.step3, picks.step4);
    const map = { ...(cache.step5OptionsByStep1234 ?? {}) };
    delete map[key];
    return { ...cache, step5OptionsByStep1234: map };
  }
  return cache;
}

// ============================================================================
// Pick construction (from option click or free text)
// ============================================================================

/**
 * Build PreviewStepPick from a clicked option (A/B/C/D).
 *
 * Carries frameworkCode (Step 1) and archetypeTag (derived from
 * metaEn) for downstream "skip AI" use in Stage Structure + Stage Twists.
 */
export function buildPickFromOption(option: PreviewOption): PreviewStepPick {
  // Derive archetype tag from metaEn (e.g. "twist:audio-trigger-ptsd" → "audio-trigger-ptsd")
  const archetypeTag = option.metaEn?.includes(":")
    ? option.metaEn.split(":").slice(1).join(":")
    : option.metaEn;

  return {
    optionId: option.id,
    resolvedTitleEn: option.titleEn,
    resolvedDescriptionVi: option.descriptionVi,
    frameworkCode: option.frameworkCode,
    archetypeTag,
  };
}

/**
 * (Step 4 multi-pick only): Build PreviewStepPick from multiple
 * checkbox-selected options. Primary pick is the first option in `options[]`,
 * remaining options become `additionalPicks` entries.
 *
 * Caller must pass 1-3 options (UI enforces min 1 max 3). Empty array throws.
 */
export function buildPickFromMultipleOptions(options: PreviewOption[]): PreviewStepPick {
  if (options.length === 0) {
    throw new Error("buildPickFromMultipleOptions: requires at least 1 option");
  }
  if (options.length > 3) {
    throw new Error("buildPickFromMultipleOptions: max 3 options allowed (Step 4 limit)");
  }

  const [primary, ...rest] = options;
  const primaryArchetype = primary.metaEn?.includes(":")
    ? primary.metaEn.split(":").slice(1).join(":")
    : primary.metaEn;

  return {
    optionId: primary.id,
    resolvedTitleEn: primary.titleEn,
    resolvedDescriptionVi: primary.descriptionVi,
    archetypeTag: primaryArchetype,
    additionalPicks: rest.map((o) => ({
      optionId: o.id,
      resolvedTitleEn: o.titleEn,
      resolvedDescriptionVi: o.descriptionVi,
      archetypeTag: o.metaEn?.includes(":")
        ? o.metaEn.split(":").slice(1).join(":")
        : o.metaEn,
    })),
  };
}

/**
 * Build PreviewStepPick from free text input (Option E).
 * customTextVi is user's raw Vietnamese description.
 *
 * free text Step 1 falls back to frameworkCode = "three-act"
 * (most flexible default). Caller can override via second arg if needed.
 */
export function buildPickFromFreeText(customTextVi: string, frameworkFallback?: string): PreviewStepPick {
  return {
    optionId: "E",
    customTextVi: customTextVi.trim(),
    resolvedTitleEn: "Custom user direction (free text)",
    resolvedDescriptionVi: customTextVi.trim(),
    frameworkCode: frameworkFallback,
  };
}

// ============================================================================
// Narrative direction synthesis (consumed by AI Stage 1 + Stage 4)
// ============================================================================

/**
 * Synthesize NarrativeDirection.synthesizedDirectionEn from 5 picks.
 * This text is injected into AI Stage prompts as context block.
 *
 * Format: structured paragraph in English with 5 labeled sections,
 * each explaining the picked option's title + short description.
 * AI Stage 1/4 uses this to generate aligned content.
 *
 * Step 4 multi-pick — when `additionalPicks` present, lists all
 * 2-3 twists in the Midpoint Twist section so AI Beats knows to place all of them.
 */
export function synthesizeNarrativeDirection(picks: {
  step1: PreviewStepPick;
  step2: PreviewStepPick;
  step3: PreviewStepPick;
  step4: PreviewStepPick;
  step5: PreviewStepPick;
}): string {
  const { step1, step2, step3, step4, step5 } = picks;

  const fmt = (label: string, pick: PreviewStepPick): string => {
    const title = pick.resolvedTitleEn || (pick.optionId === "E" ? "custom direction" : `Option ${pick.optionId}`);
    const desc = pick.resolvedDescriptionVi || pick.customTextVi || "(no description)";
    // Compress description to 1-2 sentences for AI consumption (full desc stored separately)
    const compressedDesc = desc.split("\n").slice(0, 4).join(" ").substring(0, 400);
    return `${label}: ${title}\n  Direction: ${compressedDesc}`;
  };

  // Step 4 multi-pick rendering
  const fmtStep4 = (pick: PreviewStepPick): string => {
    const allPicks = [
      { title: pick.resolvedTitleEn, desc: pick.resolvedDescriptionVi || pick.customTextVi, tag: pick.archetypeTag },
      ...(pick.additionalPicks ?? []).map((p) => ({ title: p.resolvedTitleEn, desc: p.resolvedDescriptionVi, tag: p.archetypeTag })),
    ];
    if (allPicks.length === 1) {
      return fmt("Midpoint Twist", pick);
    }
    // Multi-twist case
    const lines = [`Locked Twists (${allPicks.length} total, all MUST be placed at appropriate beat positions):`];
    allPicks.forEach((p, i) => {
      const compressedDesc = (p.desc || "(no description)").split("\n").slice(0, 3).join(" ").substring(0, 300);
      lines.push(`  Twist ${i + 1}: ${p.title}${p.tag ? ` [${p.tag}]` : ""}`);
      lines.push(`    Direction: ${compressedDesc}`);
    });
    return lines.join("\n");
  };

  return `NARRATIVE DIRECTION:

${fmt("Story Structure", step1)}

${fmt("Opening Scene", step2)}

${fmt("Character Introduction", step3)}

${fmtStep4(step4)}

${fmt("Ending", step5)}

All AI-generated content (structure, beats, scenes, shots) must align faithfully with these locked directions.`;
}

/**
 * Build final NarrativeDirection object from 5 completed picks.
 *
 * r7.19: Pass `ideaSnapshot` (the project.idea text at confirmation time)
 * so the direction can later detect when user has changed their idea
 * and warn that the locked direction may be stale.
 */
export function buildNarrativeDirection(picks: {
  step1: PreviewStepPick;
  step2: PreviewStepPick;
  step3: PreviewStepPick;
  step4: PreviewStepPick;
  step5: PreviewStepPick;
}, ideaSnapshot?: string): NarrativeDirection {
  return {
    step1_storyStructure: picks.step1,
    step2_openingScene: picks.step2,
    step3_characterIntro: picks.step3,
    step4_midpointTwist: picks.step4,
    step5_ending: picks.step5,
    completedAt: Date.now(),
    synthesizedDirectionEn: synthesizeNarrativeDirection(picks),
    ideaSnapshot: ideaSnapshot?.trim() || undefined,
  };
}
