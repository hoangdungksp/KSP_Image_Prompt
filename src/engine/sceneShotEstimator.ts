/**
 * KSP Image Scene Shot Count Estimator
 *
 * Estimates how many shots an AI Shot List would generate for a scene,
 * BEFORE actual shot list generation. Used by Stage 4 wizard to warn user
 * when a scene will exceed Hướng F-9 sweet spot (9 shots).
 *
 * Q20.1 chốt: Hybrid heuristic — max(duration_based, sentence_based).
 *   - duration_based: ceil(durationSeconds / 8) — industry avg ~8s/shot AI
 *   - sentence_based: count sentences in actionLinesEn — reflects narrative complexity
 *
 * Pure function, no AI call. Cheap to recompute on every wizard render.
 */

import type { FilmScriptIntermediateScene } from "../types/film";
import { SHOT_COUNT_SWEET_SPOT, SHOT_COUNT_HARD_CAP } from "./sceneGridPacker";

/**
 * Estimate shot count for a single scene.
 *
 * Formula: max(ceil(duration/8), sentence_count, MIN_FLOOR)
 * - 8s/shot is the AI filmmaking 2026 industry average (Seedance 8s, Veo3 8s, Kling 5/10s).
 * - sentence_count counts non-empty sentences in actionLinesEn.
 * - MIN_FLOOR = 3 ensures even very short scenes get the minimum cinematic breakdown
 *   (establishing + action + reveal = 3 shots).
 *
 * @returns Integer estimate, minimum 3, no upper cap (caller checks against SWEET_SPOT/HARD_CAP).
 */
export function estimateSceneShotCount(scene: FilmScriptIntermediateScene): number {
  const duration = scene.durationSeconds || 0;
  const durationBased = Math.ceil(duration / 8);

  const actionText = (scene.actionLinesEn || "").trim();
  const sentences = actionText
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const sentenceBased = sentences.length;

  const MIN_FLOOR = 3;
  return Math.max(durationBased, sentenceBased, MIN_FLOOR);
}

/**
 * Classify scene complexity for UI warning logic.
 *
 * - "ok": ≤ SWEET_SPOT (9). No warning, normal flow.
 * - "over_sweet": > SWEET_SPOT but ≤ HARD_CAP (10-16). Soft warning, suggest 3 actions.
 * - "over_hard": > HARD_CAP (17+). Strong warning, strongly suggest break.
 */
export type SceneComplexity = "ok" | "over_sweet" | "over_hard";

export function classifySceneComplexity(estimatedShots: number): SceneComplexity {
  if (estimatedShots <= SHOT_COUNT_SWEET_SPOT) return "ok";
  if (estimatedShots <= SHOT_COUNT_HARD_CAP) return "over_sweet";
  return "over_hard";
}

/**
 * Convenience: returns true if a scene needs Stage 4 warning UI.
 */
export function sceneNeedsWarning(scene: FilmScriptIntermediateScene): boolean {
  return classifySceneComplexity(estimateSceneShotCount(scene)) !== "ok";
}
