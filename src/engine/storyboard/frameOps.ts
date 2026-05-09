/**
 * Frame Operations v0.7.1
 *
 * Utilities for frame CRUD, format auto-detect, and frame manipulation.
 */

import type { FrameTemplate, GridFormat } from "./arcs";

/**
 * v0.7.1: Auto-detect grid format based on frame count.
 *
 * Strategy: Find the most "balanced" rectangular layout.
 * Prefer wider grids (more cols than rows) for vertical 9:16 viewing.
 */
export function detectFormat(frameCount: number): GridFormat {
  if (frameCount <= 1) return "2x2"; // 1 frame uses 2x2 layout (with empty cells)
  if (frameCount === 2) return "2x1"; // 2 cols × 1 row
  if (frameCount === 3) return "3x1"; // 3 cols × 1 row
  if (frameCount === 4) return "2x2";
  if (frameCount === 5 || frameCount === 6) return "3x2";
  if (frameCount >= 7 && frameCount <= 9) return "3x3";
  if (frameCount >= 10 && frameCount <= 12) return "4x3";
  if (frameCount >= 13 && frameCount <= 15) return "5x3";
  if (frameCount >= 16) return "4x4";
  return "3x3";
}

/**
 * Get layout dimensions for any format string.
 */
export function getFormatDimensions(format: string): { cols: number; rows: number; cells: number } {
  const match = format.match(/^(\d+)x(\d+)$/);
  if (!match) return { cols: 3, rows: 3, cells: 9 };
  const cols = parseInt(match[1]);
  const rows = parseInt(match[2]);
  return { cols, rows, cells: cols * rows };
}

/**
 * v0.7.1: Generate a stable frame ID.
 */
export function generateFrameId(): string {
  return `f_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * v0.7.1: Renumber frames after insert/delete/reorder.
 * Updates `num` and recalculates `timing` based on position.
 */
export function renumberFrames(
  frames: Array<{ num: number; timing: string; [key: string]: any }>,
  secPerFrame: number = 3
): typeof frames {
  return frames.map((f, idx) => {
    const startSec = idx * secPerFrame;
    const endSec = (idx + 1) * secPerFrame;
    const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    return {
      ...f,
      num: idx + 1,
      timing: `${fmt(startSec)}-${fmt(endSec)}s`,
    };
  });
}

/**
 * v0.7.1: Insert a new blank frame after the given index.
 */
export function insertFrameAfter<T extends { num: number; timing: string; role: string; action: string }>(
  frames: T[],
  afterIdx: number,
  newFrame: Partial<T>
): T[] {
  const newFrames = [...frames];
  const inserted = {
    role: "Scene",
    action: "(New scene — describe action)",
    actionVi: "(Cảnh mới — mô tả hành động)",
    ...newFrame,
    num: 0,  // Will be renumbered
    timing: "0:00-0:03s",  // Will be recalculated
  } as unknown as T;
  newFrames.splice(afterIdx + 1, 0, inserted);
  return renumberFrames(newFrames as any) as T[];
}

/**
 * v0.7.1: Delete a frame by index.
 */
export function deleteFrame<T extends { num: number; timing: string }>(
  frames: T[],
  idx: number
): T[] {
  if (frames.length <= 1) return frames; // Don't delete last frame
  const newFrames = frames.filter((_, i) => i !== idx);
  return renumberFrames(newFrames as any) as T[];
}

/**
 * v0.7.1: Move frame up or down.
 */
export function moveFrame<T extends { num: number; timing: string }>(
  frames: T[],
  idx: number,
  direction: "up" | "down"
): T[] {
  const newFrames = [...frames];
  const targetIdx = direction === "up" ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= newFrames.length) return frames;
  [newFrames[idx], newFrames[targetIdx]] = [newFrames[targetIdx], newFrames[idx]];
  return renumberFrames(newFrames as any) as T[];
}
