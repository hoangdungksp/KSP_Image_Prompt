/**
 * KSP Image — Pipeline Cost Actions (r7.20a)
 *
 * Mutators for `project.pipelineCost`. Hook into AI runtime cost events
 * (text + image emitters in costTracker.ts) to live-update the running
 * total during a pipeline.
 */

import type { PromptProject } from "../types/index";
import type { ProjectV09Extensions, PipelineCostRun } from "../types/project";
import type { CostEvent } from "../engine/costTracker";

type ProjectWithExt = PromptProject & ProjectV09Extensions;

function genRunId(): string {
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Start a new pipeline run. Replaces any existing record (single-slot history).
 * Reset textCostUsd/imageCostUsd/counts to zero.
 */
export function startPipelineCostRun(project: PromptProject): Partial<ProjectV09Extensions> {
  const run: PipelineCostRun = {
    runId: genRunId(),
    startedAt: Date.now(),
    status: "running",
    textCostUsd: 0,
    imageCostUsd: 0,
    textCalls: 0,
    imageCalls: 0,
  };
  return { pipelineCost: run };
}

/**
 * Accumulate a single cost event into the current run.
 * Returns the updated PipelineCostRun. If no run exists, creates a synthetic
 * one (for regen calls outside a fresh pipeline — they still get tracked).
 *
 * Pure — does NOT mutate the input project. Caller persists via updateProject.
 */
export function accumulateCostEvent(
  project: ProjectWithExt,
  event: CostEvent
): PipelineCostRun {
  // No run yet → make a synthetic one. Regen-after-completion still tracks.
  const base: PipelineCostRun = project.pipelineCost ?? {
    runId: genRunId(),
    startedAt: Date.now(),
    status: "done",
    textCostUsd: 0,
    imageCostUsd: 0,
    textCalls: 0,
    imageCalls: 0,
  };

  if (event.kind === "text") {
    return {
      ...base,
      textCostUsd: base.textCostUsd + event.costUsd,
      textCalls: base.textCalls + 1,
    };
  } else {
    return {
      ...base,
      imageCostUsd: base.imageCostUsd + event.costUsd,
      imageCalls: base.imageCalls + 1,
    };
  }
}

/**
 * Mark the current run as completed (Storyboard reached).
 */
export function completePipelineCostRun(project: ProjectWithExt): Partial<ProjectV09Extensions> {
  if (!project.pipelineCost) return {};
  return {
    pipelineCost: {
      ...project.pipelineCost,
      completedAt: Date.now(),
      status: "done",
      currentStage: undefined,
    },
  };
}

/**
 * Mark the current run as aborted (user clicked Cancel or pipeline errored
 * with no recovery). The accumulated cost is kept — those API calls were
 * still spent.
 */
export function abortPipelineCostRun(project: ProjectWithExt): Partial<ProjectV09Extensions> {
  if (!project.pipelineCost) return {};
  return {
    pipelineCost: {
      ...project.pipelineCost,
      completedAt: Date.now(),
      status: "aborted",
      currentStage: undefined,
    },
  };
}

/**
 * Update the "currentStage" label for live display (e.g. "Stage 3 Beats",
 * "Shot List · Scene 5 of 8"). Cheap — only updates the label field.
 */
export function setCurrentStage(
  project: ProjectWithExt,
  stage: string | undefined
): Partial<ProjectV09Extensions> {
  if (!project.pipelineCost) return {};
  return {
    pipelineCost: {
      ...project.pipelineCost,
      currentStage: stage,
    },
  };
}

/**
 * Manually reset the cost record (user clicks "Reset" button).
 */
export function resetPipelineCost(): Partial<ProjectV09Extensions> {
  return { pipelineCost: undefined };
}
