/**
 * KSP Image — Gemini Omni chunk planner (r7.39)
 *
 * WHY: Gemini Omni Flash caps clips at 10 seconds (Google DeepMind PM Nicole
 * Brichtova, TechCrunch interview May 19 2026 — "deployment decision, not
 * model constraint"). KSP scenes routinely run 30s–2min, so we MUST split
 * multi-shot Omni prompts into ≤10s chunks before sending to the model.
 *
 * Algorithm: greedy packing along shot boundaries (preserves narrative arc,
 * never splits mid-shot). Walks shots in order, accumulates into current
 * chunk until adding the next shot would exceed OMNI_MAX_CHUNK_SECONDS; then
 * closes the chunk and starts a new one.
 *
 * Edge cases handled:
 *   - Single shot ≥ 10s → placed alone in own chunk (caller may want to clamp,
 *     but planner does not modify durationSeconds).
 *   - Empty shot list → returns empty chunks array.
 *   - All shots fit in one chunk → returns single-element array (back-compat).
 *
 * Shared by omniMultiShotPromptBuilder (KSP Hybrid) and
 * omniDeepMindPurePromptBuilder (DeepMind Strict). Pure function, no I/O.
 */

import type { FilmShot } from "../types/project";

/** Gemini Omni Flash hard cap per clip (verified May 2026 against Google source). */
export const OMNI_MAX_CHUNK_SECONDS = 10;

export interface OmniChunk {
  /** 1-indexed chunk number (for separator display). */
  index: number;
  /** Total chunks in the plan (for separator display). */
  total: number;
  /** Shots packed into this chunk, in original scene order. */
  shots: FilmShot[];
  /** Global 1-indexed shot number of `shots[0]` (so cell numbering stays continuous across chunks). */
  globalStartShotNumber: number;
  /** Sum of durationSeconds across `shots`. Always ≤ OMNI_MAX_CHUNK_SECONDS (except solo-shot edge case). */
  durationSeconds: number;
}

/**
 * Plan Omni chunks for a scene's shot list.
 *
 * @param shots Ordered shots from one scene (do NOT reorder — narrative arc depends on it).
 * @returns Array of chunks; never empty if `shots` is non-empty.
 */
export function planOmniChunks(shots: FilmShot[]): OmniChunk[] {
  if (shots.length === 0) return [];

  type PartialChunk = { shots: FilmShot[]; durationSeconds: number; globalStartShotNumber: number };
  const partials: PartialChunk[] = [];

  let current: PartialChunk = { shots: [], durationSeconds: 0, globalStartShotNumber: 1 };
  let globalShotNum = 1;

  for (const shot of shots) {
    const d = shot.durationSeconds || 5;

    // Edge case A: single shot already ≥ cap → flush current + put solo shot in own chunk.
    if (d >= OMNI_MAX_CHUNK_SECONDS) {
      if (current.shots.length > 0) {
        partials.push(current);
        current = { shots: [], durationSeconds: 0, globalStartShotNumber: globalShotNum };
      }
      partials.push({ shots: [shot], durationSeconds: d, globalStartShotNumber: globalShotNum });
      globalShotNum++;
      current.globalStartShotNumber = globalShotNum;
      continue;
    }

    // Normal: try to add to current chunk.
    if (current.durationSeconds + d <= OMNI_MAX_CHUNK_SECONDS) {
      current.shots.push(shot);
      current.durationSeconds += d;
    } else {
      // Adding this shot would overflow → close current, start new chunk with this shot.
      partials.push(current);
      current = {
        shots: [shot],
        durationSeconds: d,
        globalStartShotNumber: globalShotNum,
      };
    }
    globalShotNum++;
  }

  if (current.shots.length > 0) partials.push(current);

  // Attach index/total now that we know `total`.
  return partials.map((p, i) => ({
    index: i + 1,
    total: partials.length,
    shots: p.shots,
    globalStartShotNumber: p.globalStartShotNumber,
    durationSeconds: p.durationSeconds,
  }));
}

/**
 * Build the visual separator that goes between chunks in the clipboard output.
 * Only used when `chunks.length > 1` — single-chunk output has no separator
 * (preserves backward-compat appearance when scene ≤ 10s).
 */
export function buildChunkSeparator(chunk: OmniChunk): string {
  return `=== CHUNK ${chunk.index} of ${chunk.total} (${chunk.durationSeconds}s) ===`;
}
