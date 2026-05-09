/**
 * Chunk Planner v0.7.0
 *
 * Given a story arc + provider + target duration, calculates how to split
 * frames across multiple AI generation clips that fit within provider limits.
 *
 * Strategy:
 * - Single-clip: When target_duration <= provider.maxClipDuration, output 1 chunk
 * - Multi-chunk: When target > max, divide into N chunks
 * - Uniform clip duration: Each chunk is ~equal duration for natural pacing
 */

import type { FrameTemplate } from "./arcs";
import { PROVIDERS, type VideoProvider, type ProviderConfig } from "./providers";

export interface ChunkPlan {
  /** Chunk number (1-indexed) */
  chunkNum: number;
  /** Total chunks in this plan */
  totalChunks: number;
  /** Frames in this chunk (subset of original arc) */
  frames: FrameTemplate[];
  /** Duration of this chunk in seconds */
  duration: number;
  /** Time-per-frame in this chunk (= duration / frames.length) */
  secondsPerFrame: number;
  /** Frame number this chunk starts at (1-indexed in original arc) */
  startFrameNum: number;
  /** Frame number this chunk ends at (inclusive, 1-indexed) */
  endFrameNum: number;
  /** Cumulative time at start of this chunk in the full TVC (for narrative context) */
  cumulativeStartSec: number;
}

export interface PlanResult {
  provider: ProviderConfig;
  targetDuration: number;
  /** Actual final duration (may differ slightly from target due to chunk math) */
  actualDuration: number;
  /** All chunks in order */
  chunks: ChunkPlan[];
  /** Whether this fits in single shot */
  isSingleShot: boolean;
  /** Workflow recommendation */
  workflowNote: string;
}

/**
 * Plan how to chunk frames across multi-clip generation.
 *
 * @param frames All frames from the story arc (e.g., 9 frames for 3x3 grid)
 * @param provider Selected video AI provider
 * @param targetDuration Desired total TVC duration in seconds
 */
export function planChunks(
  frames: FrameTemplate[],
  provider: VideoProvider,
  targetDuration: number
): PlanResult {
  const config = PROVIDERS[provider];
  const totalFrames = frames.length;

  // Single-shot case: target fits within max clip duration
  if (targetDuration <= config.maxClipDuration) {
    const secondsPerFrame = targetDuration / totalFrames;
    return {
      provider: config,
      targetDuration,
      actualDuration: targetDuration,
      isSingleShot: true,
      chunks: [
        {
          chunkNum: 1,
          totalChunks: 1,
          frames,
          duration: targetDuration,
          secondsPerFrame,
          startFrameNum: 1,
          endFrameNum: totalFrames,
          cumulativeStartSec: 0,
        },
      ],
      workflowNote: `Single-shot: Generate 1 clip (${targetDuration}s) on ${config.name}, no stitching needed.`,
    };
  }

  // Multi-chunk case: need to split
  // Calculate how many frames per chunk to maximize use of provider limit
  const maxFramesPerChunk = Math.floor(
    (config.maxClipDuration / targetDuration) * totalFrames
  );

  // Ensure at least 1 frame per chunk
  const framesPerChunk = Math.max(1, maxFramesPerChunk);
  const numChunks = Math.ceil(totalFrames / framesPerChunk);

  const chunks: ChunkPlan[] = [];
  let cumulativeSec = 0;
  const secondsPerFrame = targetDuration / totalFrames;

  for (let i = 0; i < numChunks; i++) {
    const startIdx = i * framesPerChunk;
    const endIdx = Math.min(startIdx + framesPerChunk, totalFrames);
    const chunkFrames = frames.slice(startIdx, endIdx);
    const chunkDuration = chunkFrames.length * secondsPerFrame;

    chunks.push({
      chunkNum: i + 1,
      totalChunks: numChunks,
      frames: chunkFrames,
      duration: parseFloat(chunkDuration.toFixed(1)),
      secondsPerFrame,
      startFrameNum: startIdx + 1,
      endFrameNum: endIdx,
      cumulativeStartSec: parseFloat(cumulativeSec.toFixed(1)),
    });

    cumulativeSec += chunkDuration;
  }

  return {
    provider: config,
    targetDuration,
    actualDuration: parseFloat(cumulativeSec.toFixed(1)),
    isSingleShot: false,
    chunks,
    workflowNote: `Multi-chunk: Generate ${numChunks} clips on ${config.name}, then stitch them together in CapCut/Premiere with smooth transitions.`,
  };
}

/**
 * Get a human-readable description of the plan for UI.
 */
export function describePlan(plan: PlanResult): string {
  if (plan.isSingleShot) {
    const c = plan.chunks[0];
    return `1 clip × ${plan.targetDuration}s (${plan.provider.name}, ${c.frames.length} cảnh)`;
  }

  const chunkInfo = plan.chunks
    .map((c) => `${c.duration}s`)
    .join(" + ");
  return `${plan.chunks.length} clips: ${chunkInfo} = ${plan.actualDuration}s total`;
}

/**
 * Validate plan and return warnings.
 */
export function validatePlan(plan: PlanResult): string[] {
  const warnings: string[] = [];
  const config = plan.provider;

  // Warn if any chunk exceeds max
  plan.chunks.forEach((c) => {
    if (c.duration > config.maxClipDuration) {
      warnings.push(
        `⚠️ Chunk ${c.chunkNum} là ${c.duration}s, vượt giới hạn ${config.maxClipDuration}s của ${config.name}`
      );
    }
  });

  // Warn if frames per chunk is too few (single-frame clips feel choppy)
  plan.chunks.forEach((c) => {
    if (c.frames.length === 1 && plan.chunks.length > 1) {
      warnings.push(
        `⚠️ Chunk ${c.chunkNum} chỉ có 1 frame (${c.duration}s) — có thể cảm giác cứng. Thử chọn provider có max cao hơn.`
      );
    }
  });

  // Warn if seconds per frame is too short
  if (plan.chunks[0].secondsPerFrame < 1) {
    warnings.push(
      `⚠️ Mỗi cảnh chỉ ${plan.chunks[0].secondsPerFrame.toFixed(1)}s — quá nhanh. Tăng target duration hoặc giảm số cảnh.`
    );
  }

  return warnings;
}
