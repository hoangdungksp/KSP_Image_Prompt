/**
 * KSP Image v0.9.0 — Chunk planner + animation prompt builder
 *
 * Calculates how to split N frames across video provider chunks based on:
 * - Provider max duration (Seedance 12s, Veo3 8s, Kling 10s, etc.)
 * - Total target duration
 * - Frame count
 *
 * Builds animation prompt strings with:
 * - Time format (decimal/integer/timecode)
 * - Reference image numbering
 * - Cast continuity
 * - Camera movement
 */

import type {
  FilmShot,
  FilmCharacterV2,
  AnimationStyleV2,
  AspectRatioV2,
  AnimationChunk,
  TimeFormat,
  ShotFrame,
} from "../types/project";
import { formatTimeRange } from "../types/project";

// ============================================================================
// PROVIDER CONFIGS
// ============================================================================

export type VideoProvider =
  | "seedance-2-pro"
  | "veo3"
  | "kling-2"
  | "runway-aleph"
  | "pika-2.1"
  | "sora-2"
  | "higgsfield";

interface ProviderConfig {
  id: VideoProvider;
  label: string;
  maxDurationSeconds: number;
  charLimit: number;
  costPerSecond: number; // USD
  supports: AspectRatioV2[];
  syntax: "seedance-multishot" | "single-prompt" | "per-pair";
}

export const VIDEO_PROVIDERS: Record<VideoProvider, ProviderConfig> = {
  "seedance-2-pro": {
    id: "seedance-2-pro",
    label: "Seedance 2.0 Pro",
    maxDurationSeconds: 12,
    charLimit: 4000,
    costPerSecond: 0.15,
    supports: ["9:16", "1:1", "16:9", "21:9"],
    syntax: "seedance-multishot",
  },
  veo3: {
    id: "veo3",
    label: "Veo3",
    maxDurationSeconds: 8,
    charLimit: 2500,
    costPerSecond: 0.30,
    supports: ["9:16", "16:9", "21:9"],
    syntax: "single-prompt",
  },
  "kling-2": {
    id: "kling-2",
    label: "Kling 2.0",
    maxDurationSeconds: 10,
    charLimit: 2500,
    costPerSecond: 0.10,
    supports: ["9:16", "1:1", "16:9"],
    syntax: "per-pair",
  },
  "runway-aleph": {
    id: "runway-aleph",
    label: "Runway Aleph",
    maxDurationSeconds: 16,
    charLimit: 2000,
    costPerSecond: 0.10,
    supports: ["9:16", "16:9", "21:9"],
    syntax: "single-prompt",
  },
  "pika-2.1": {
    id: "pika-2.1",
    label: "Pika 2.1",
    maxDurationSeconds: 10,
    charLimit: 1500,
    costPerSecond: 0.08,
    supports: ["9:16", "1:1", "16:9"],
    syntax: "single-prompt",
  },
  "sora-2": {
    id: "sora-2",
    label: "Sora 2",
    maxDurationSeconds: 20,
    charLimit: 2500,
    costPerSecond: 0.40,
    supports: ["9:16", "16:9", "21:9"],
    syntax: "single-prompt",
  },
  higgsfield: {
    id: "higgsfield",
    label: "Higgsfield",
    maxDurationSeconds: 8,
    charLimit: 1500,
    costPerSecond: 0.12,
    supports: ["9:16", "16:9"],
    syntax: "per-pair",
  },
};

// ============================================================================
// CHUNK PLANNING
// ============================================================================

export interface ChunkPlan {
  totalChunks: number;
  framesPerChunk: number;
  durationPerChunk: number;
  chunks: ChunkSpec[];
  warning?: string;
}

export interface ChunkSpec {
  index: number;
  frameStart: number;
  frameEnd: number; // exclusive
  durationSeconds: number;
  startSeconds: number;
  endSeconds: number;
}

/**
 * Plan chunks for a shot given total duration and provider.
 */
export function planChunks(
  totalSeconds: number,
  totalFrames: number,
  provider: VideoProvider
): ChunkPlan {
  const cfg = VIDEO_PROVIDERS[provider];
  const maxChunkSec = cfg.maxDurationSeconds;

  // If shot fits in 1 chunk, simple
  if (totalSeconds <= maxChunkSec) {
    return {
      totalChunks: 1,
      framesPerChunk: totalFrames,
      durationPerChunk: totalSeconds,
      chunks: [
        {
          index: 0,
          frameStart: 0,
          frameEnd: totalFrames,
          durationSeconds: totalSeconds,
          startSeconds: 0,
          endSeconds: totalSeconds,
        },
      ],
    };
  }

  // Multi-chunk: split evenly, but each chunk <= maxChunkSec
  const numChunks = Math.ceil(totalSeconds / maxChunkSec);
  const chunkDuration = totalSeconds / numChunks;
  const framesPerChunk = Math.ceil(totalFrames / numChunks);

  const chunks: ChunkSpec[] = [];
  for (let i = 0; i < numChunks; i++) {
    const frameStart = i * framesPerChunk;
    const frameEnd = Math.min(frameStart + framesPerChunk, totalFrames);
    chunks.push({
      index: i,
      frameStart,
      frameEnd,
      durationSeconds: chunkDuration,
      startSeconds: i * chunkDuration,
      endSeconds: (i + 1) * chunkDuration,
    });
  }

  let warning: string | undefined;
  if (numChunks > 4) {
    warning = `${numChunks} chunks for one shot is a lot. Consider splitting into separate shots in Storyboard.`;
  }

  return {
    totalChunks: numChunks,
    framesPerChunk,
    durationPerChunk: chunkDuration,
    chunks,
    warning,
  };
}

// ============================================================================
// ANIMATION PROMPT BUILDER (per chunk)
// ============================================================================

export interface BuildChunkPromptInput {
  chunk: ChunkSpec;
  shot: FilmShot;
  frames: ShotFrame[];
  cast: FilmCharacterV2[];
  animationStyle: AnimationStyleV2;
  aspectRatio: AspectRatioV2;
  provider: VideoProvider;
  timeFormat: TimeFormat;
  sceneTransition?: string;
}

export function buildChunkPrompt(input: BuildChunkPromptInput): string {
  const { chunk, shot, frames, cast, animationStyle, aspectRatio, provider, timeFormat } = input;
  const cfg = VIDEO_PROVIDERS[provider];

  // Cast description
  const castDesc = cast.length
    ? `\nCAST CONTINUITY (must remain consistent):\n${cast
        .map((c) => `- ${c.name}: ${c.description.slice(0, 150)}. Markers: ${c.uniqueIdentifiers}`)
        .join("\n")}`
    : "";

  // Style line
  const styleLine = `Visual style: ${animationStyle.replace(/_/g, " ")}, cinematic ${aspectRatio} aspect, ${shot.cameraMovement.replace(/_/g, " ")}.`;

  // Frame breakdown for this chunk
  const chunkFrames = frames.slice(chunk.frameStart, chunk.frameEnd);
  const frameLines = chunkFrames.map((f, i) => {
    // Adjust timing relative to chunk start
    const frameStart = f.timingSeconds.start - chunk.startSeconds;
    const frameEnd = f.timingSeconds.end - chunk.startSeconds;
    const timing = formatTimeRange(frameStart, frameEnd, timeFormat);
    return `${timing}: ${f.actionEn || "(no action description)"}`;
  });

  if (cfg.syntax === "seedance-multishot") {
    // Seedance native multi-shot syntax
    return [
      `// ${cfg.label} multi-shot — Chunk ${chunk.index + 1} (${formatTimeRange(0, chunk.durationSeconds, timeFormat)})`,
      ``,
      `Subject: ${shot.titleEn}`,
      castDesc.trim(),
      ``,
      styleLine,
      ``,
      `Camera: ${shot.cameraMovement.replace(/_/g, " ")}.`,
      ``,
      ...frameLines,
      ``,
      `Avoid: text overlays, dialogue boxes, frame numbers, watermarks, abrupt style changes between frames.`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  // Single-prompt syntax (Veo3, Pika, Runway, Sora)
  return [
    `// ${cfg.label} — Chunk ${chunk.index + 1} of shot "${shot.titleEn}"`,
    ``,
    `${chunkFrames.map((f) => f.actionEn).join(" Then ")}`,
    ``,
    styleLine,
    castDesc.trim(),
    ``,
    `Duration: ${chunk.durationSeconds.toFixed(1)}s. Reference grid storyboard image.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Build all chunk prompts for a shot at once.
 */
export function buildAllChunkPrompts(input: Omit<BuildChunkPromptInput, "chunk">): AnimationChunk[] {
  const plan = planChunks(input.shot.durationSeconds, input.frames.length, input.provider);
  const cfg = VIDEO_PROVIDERS[input.provider];

  return plan.chunks.map((chunkSpec) => {
    const prompt = buildChunkPrompt({ ...input, chunk: chunkSpec });
    const refs: string[] = [];
    // Cast refs
    input.cast.forEach((c) => {
      c.faceRefs.forEach((r) => refs.push(r.id));
      c.bodyRefs.forEach((r) => refs.push(r.id));
    });
    // Cropped frame refs for this chunk
    if (input.shot.croppedFrameIds) {
      input.shot.croppedFrameIds
        .slice(chunkSpec.frameStart, chunkSpec.frameEnd)
        .forEach((id) => refs.push(id));
    }

    return {
      id: `${input.shot.id}_chunk${chunkSpec.index + 1}`,
      order: chunkSpec.index,
      frameRange: { start: chunkSpec.frameStart, end: chunkSpec.frameEnd },
      timingSeconds: { start: chunkSpec.startSeconds, end: chunkSpec.endSeconds },
      prompt,
      charCount: prompt.length,
      charLimit: cfg.charLimit,
      copyableReferences: refs,
    };
  });
}
