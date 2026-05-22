/**
 * KSP Image — Pipeline Cost Tracker UI (r7.20a)
 *
 * Renders below "Analyze Idea" button in FilmIdeaScriptSection.
 * Two states:
 *   - status === "running": Variant C (live progress dot + cost ticking up)
 *   - status === "done" or "aborted": Variant B (snapshot + text/image split)
 *
 * Subscribes to costTracker emitter on mount; accumulates into
 * project.pipelineCost via store action. Unsubscribes on unmount.
 */

import { useEffect } from "react";
import { useAppStore } from "../store/useAppStore";
import { subscribeCost, formatUsd, formatVnd } from "../engine/costTracker";
import type { PromptProject } from "../types/index";
import type { ProjectV09Extensions } from "../types/project";
import { accumulateCostEvent } from "../store/pipelineCost_actions";

export function PipelineCostTracker() {
  const project = useAppStore((s) => s.currentProject) as (PromptProject & ProjectV09Extensions) | null;
  const updateProject = useAppStore((s) => s.updateCurrentProject);

  // Wire up cost event subscription once per mount. The listener pulls the
  // latest project from the store inside the callback (avoids stale closure).
  useEffect(() => {
    const unsubscribe = subscribeCost((event) => {
      const proj = useAppStore.getState().currentProject as (PromptProject & ProjectV09Extensions) | null;
      if (!proj) return;
      const updatedRun = accumulateCostEvent(proj, event);
      updateProject(() => ({ pipelineCost: updatedRun } as Partial<PromptProject>));
    });
    return unsubscribe;
  }, [updateProject]);

  const run = project?.pipelineCost;
  if (!run) return null;

  const totalUsd = run.textCostUsd + run.imageCostUsd;
  const textPct = totalUsd > 0 ? Math.round((run.textCostUsd / totalUsd) * 100) : 0;
  const imagePct = totalUsd > 0 ? 100 - textPct : 0;

  const isRunning = run.status === "running";
  const isAborted = run.status === "aborted";

  function handleReset() {
    if (!confirm("Reset cost tracker về 0?")) return;
    updateProject(() => ({ pipelineCost: undefined } as Partial<PromptProject>));
  }

  return (
    <div
      className={`ksp-pipeline-cost-tracker${isRunning ? " running" : ""}${isAborted ? " aborted" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="ksp-pipeline-cost-header">
        <div className="ksp-pipeline-cost-label-group">
          <span className="ksp-pipeline-cost-icon" aria-hidden="true">💰</span>
          <div>
            <div className="ksp-pipeline-cost-label">
              {isRunning ? (
                <>
                  <span className="ksp-pipeline-cost-running-dot" aria-hidden="true"></span>
                  Pipeline running…
                </>
              ) : isAborted ? (
                "Pipeline cost (aborted)"
              ) : (
                "Pipeline cost"
              )}
            </div>
            <div className="ksp-pipeline-cost-total">
              <span className="ksp-pipeline-cost-usd">{formatUsd(totalUsd)}</span>
              <span className="ksp-pipeline-cost-vnd">· ~{formatVnd(totalUsd)}</span>
            </div>
          </div>
        </div>
        {!isRunning && (
          <button
            type="button"
            className="ksp-pipeline-cost-reset"
            onClick={handleReset}
            title="Reset cost tracker về 0"
          >
            ↻ Reset
          </button>
        )}
      </div>

      {isRunning && run.currentStage && (
        <div className="ksp-pipeline-cost-current-stage">
          Currently: {run.currentStage}
        </div>
      )}

      <div className="ksp-pipeline-cost-split">
        <div className="ksp-pipeline-cost-split-item">
          <span className="ksp-pipeline-cost-split-label">Text AI</span>
          <span className="ksp-pipeline-cost-split-value">{formatUsd(run.textCostUsd)}</span>
          <span className="ksp-pipeline-cost-split-pct">({textPct}%)</span>
        </div>
        <div className="ksp-pipeline-cost-split-divider" aria-hidden="true"></div>
        <div className="ksp-pipeline-cost-split-item">
          <span className="ksp-pipeline-cost-split-label">Image AI</span>
          <span className={`ksp-pipeline-cost-split-value${imagePct > 80 ? " warn" : ""}`}>
            {formatUsd(run.imageCostUsd)}
          </span>
          <span className="ksp-pipeline-cost-split-pct">({imagePct}%)</span>
        </div>
      </div>

      <div className="ksp-pipeline-cost-meta">
        <span>{run.textCalls} text + {run.imageCalls} image calls</span>
      </div>
    </div>
  );
}
