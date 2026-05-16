/**
 * KSP Image v0.9.3-r3 — Film Idea + Script Section (Mockup 2 implementation)
 *
 * Single section combining Idea textarea + Stage 5 quick path Script generation.
 * Replaces deprecated FilmScriptSection.tsx.
 *
 * Spec per MOCKUPS_FILM.md Mockup 2:
 *   - Idea card (green border) — textarea cho idea VN
 *   - Script section (orange border) — AI generated full script
 *   - Provider toggle: Gemini Flash | OpenAI 4o
 *   - "AI viết Script từ idea" primary action
 *   - Scene cards với SFX/MUSIC/TRANSITION inline color-coded
 *   - Variation / Versions / Add Scene / Export PDF
 *   - r3 ships Stage 5 ONLY (1-cú generation). r7 adds multi-stage wizard.
 */

import React, { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { Connector } from "./Editor";
import {
  ensureFilmData,
  setScript,
  clearScript,
  revertScriptToVersion,
  addEmptyScene,
  removeScene,
  updateSceneInScript,
  // r7 + qc4
  setScriptStage,
  setScriptStructure,
  setScriptBeats,
  updateScriptBeat,
  addScriptBeat,
  removeScriptBeat,
  setScriptTwists,
  updateScriptTwist,
  lockScriptTwists,
  setScriptIntermediateScenes,
  setScriptTargetSceneCount,
  revertToStage,
  clearStageData,
  // qc20
  applySceneSplit,
  dismissSceneComplexityWarning,
  lockScriptScenes,
} from "../store/film_actions";
import {
  runStage1Structure,
  runStage2Beats,
  runStage3Twists,
  runStage4Scenes,
  runStage5FromStages,
  // qc20
  runSplitSceneSuggestion,
  type SceneSplitSuggestion,
  type FilmScriptProvider,
} from "../engine/filmScriptStages";
// qc20: Scene shot count estimator + complexity classification
import {
  estimateSceneShotCount,
  classifySceneComplexity,
  type SceneComplexity,
} from "../engine/sceneShotEstimator";
import {
  FRAMEWORK_LABELS,
  type FilmScriptStage,
  type FilmStoryFramework,
  type FilmData,
} from "../types/film";
import type { FilmScript, FilmSceneScript } from "../types/project";

// ============================================================================
// MAIN SECTION
// ============================================================================

export function FilmIdeaScriptSection() {
  const project = useAppStore((s) => s.currentProject);
  const updateProject = useAppStore((s) => s.updateCurrentProject);
  const showToast = useAppStore((s) => s.showToast);

  if (!project) return null;
  const film = ensureFilmData(project);
  const setting = (project as any).settingV2 as import("../types/project").ProjectSettingV2 | undefined;
  const idea = project.idea?.raw ?? "";

  const [isGenerating, setIsGenerating] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);

  function handleSetIdea(newIdea: string) {
    updateProject({ idea: { raw: newIdea } } as any);
  }

  return (
    <>
      {/* IDEA SECTION (Mockup 2 — green border) */}
      <section className="ksp-section ksp-idea-film">
        <header className="ksp-section-header">
          <span className="ksp-section-icon">💡</span>
          <h2 className="ksp-section-title">1. Ý TƯỞNG</h2>
        </header>

        <textarea
          className="ksp-textarea ksp-idea-film-textarea"
          placeholder="VD: Một con robot bị bỏ rơi trong rừng sau chiến tranh, tỉnh dậy sau 50 năm và kết bạn với một chú chim sẻ. Câu chuyện về việc tìm lại ý nghĩa sống..."
          value={idea}
          onChange={(e) => handleSetIdea(e.target.value)}
          rows={4}
        />
      </section>

      {/* Connector Idea → Script (Mockup 2 spec) */}
      <Connector colorFrom="#1D9E75" colorTo="#D85A30" />

      {/* SCRIPT SECTION (Mockup new — orange border, stepper wizard) */}
      <section className="ksp-section ksp-script-film">
        <header className="ksp-section-header">
          <span className="ksp-section-icon">📜</span>
          <h2 className="ksp-section-title">2. SCRIPT</h2>
          <span className="ksp-section-meta-stepper">
            {countCompletedStages(film)}/5 stages
            {film.script && ` · ${film.script.scenes.length} scenes`}
          </span>
        </header>

        {/* NEW: Vertical stepper wizard — 5 stages */}
        <ScriptStepperWizard
          film={film}
          idea={idea}
          setting={setting}
          isGenerating={isGenerating}
          onSetGenerating={setIsGenerating}
          onUpdateProject={updateProject}
          onShowToast={showToast}
          project={project}
        />

        {/* Footer info — progress meta */}
        <div className="ksp-script-stepper-footer">
          <span className="ksp-script-stepper-footer-icon">ⓘ</span>
          <span>Progress: {countCompletedStages(film)}/5 stages · Sau khi xong ⑤ → script feed vào Storyboard</span>
        </div>

        {/* Versions panel (common to both quick + multi-stage modes) */}
        {versionsOpen && film.script?.versions && film.script.versions.length > 0 && (
          <div className="ksp-script-film-versions">
            <h4>Past versions (newest first)</h4>
            <ol>
              {[...film.script.versions].reverse().map((v, revIdx) => {
                const origIdx = (film.script!.versions!.length - 1) - revIdx;
                const snap = v.scriptSnapshot;
                return (
                  <li key={v.id}>
                    <span>{snap.titleVi || snap.titleEn || v.label}</span>
                    <span className="ksp-script-film-versions-meta">
                      {snap.scenes.length} scenes · {new Date(v.timestamp).toLocaleString()}
                    </span>
                    <button
                      type="button"
                      className="ksp-btn ksp-btn-sm ksp-btn-ghost"
                      onClick={() => {
                        if (confirm("Revert to this version? Current script sẽ archived.")) {
                          updateProject(revertScriptToVersion(project, origIdx));
                          showToast("Đã revert", "info");
                        }
                      }}
                    >
                      Revert
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {/* Script content (common to both quick + multi-stage modes — B6 fix) */}
        {film.script && (
          <div className="ksp-script-film-content">
            <div className="ksp-script-film-meta">
              <div><strong>Title:</strong> {film.script.titleVi || film.script.titleEn}</div>
              <div><strong>Logline:</strong> {film.script.loglineVi || film.script.logline}</div>
            </div>

            {film.script.scenes.map((scene, idx) => (
              <SceneCard
                key={scene.id}
                scene={scene}
                index={idx}
                onUpdate={(updates) =>
                  updateProject(updateSceneInScript(project, scene.id, updates))
                }
                onRemove={() => {
                  if (confirm(`Xóa scene ${scene.order}?`)) {
                    updateProject(removeScene(project, scene.id));
                  }
                }}
              />
            ))}

            <div className="ksp-script-film-actions">
              <button
                type="button"
                className="ksp-btn ksp-btn-secondary ksp-btn-sm"
                onClick={() => updateProject(addEmptyScene(project))}
              >
                + Add Scene
              </button>
              <button
                type="button"
                className="ksp-btn ksp-btn-ghost ksp-btn-sm"
                onClick={() => setVersionsOpen(!versionsOpen)}
                disabled={(film.script.versions?.length ?? 0) === 0}
              >
                📚 Versions ({film.script.versions?.length ?? 0})
              </button>
              <button
                type="button"
                className="ksp-btn ksp-btn-ghost ksp-btn-sm"
                onClick={() => {
                  if (film.script) exportScriptAsText(film.script);
                  showToast("Đã download script.txt", "success");
                }}
                title="Export script as plain text (PDF defer 0.9.4)"
              >
                📥 Export .txt
              </button>
              <button
                type="button"
                className="ksp-btn ksp-btn-ghost ksp-btn-sm"
                onClick={() => {
                  if (confirm("Xóa toàn bộ script + versions?")) {
                    updateProject(clearScript(project));
                  }
                }}
              >
                🗑 Clear all
              </button>
            </div>

            <div className="ksp-script-film-feed-note">
              ⓘ Script feed: Storyboard (action lines → frames) · SFX list · Music briefs
            </div>
          </div>
        )}
      </section>
    </>
  );
}

// ============================================================================
// SCENE CARD (collapsible)
// ============================================================================

interface SceneCardProps {
  scene: FilmSceneScript;
  index: number;
  onUpdate: (updates: Partial<FilmSceneScript>) => void;
  onRemove: () => void;
}

function SceneCard({ scene, index, onUpdate, onRemove }: SceneCardProps) {
  const [expanded, setExpanded] = useState(index === 0); // first scene expanded
  const [editingAction, setEditingAction] = useState(false);

  const durationFmt = formatDuration(scene.durationSeconds);

  return (
    <div className="ksp-scene-card" data-expanded={expanded}>
      <div className="ksp-scene-card-header" onClick={() => setExpanded(!expanded)}>
        <span className="ksp-scene-card-arrow">{expanded ? "▼" : "▶"}</span>
        <strong>Scene {scene.order}</strong>
        <span className="ksp-scene-card-settings">{scene.settings} — {durationFmt}</span>
        <button
          type="button"
          className="ksp-scene-card-remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          ×
        </button>
      </div>

      {expanded && (
        <div className="ksp-scene-card-body">
          {/* Title (EN/VI) */}
          <div className="ksp-scene-card-title">
            <em>{scene.titleVi || scene.titleEn}</em>
          </div>

          {/* Action lines (editable) */}
          <div className="ksp-scene-card-block">
            <label className="ksp-scene-card-block-label">Action:</label>
            {editingAction ? (
              <textarea
                className="ksp-textarea ksp-textarea-sm"
                value={scene.actionLinesVi || scene.actionLinesEn}
                onChange={(e) => onUpdate({ actionLinesVi: e.target.value })}
                onBlur={() => setEditingAction(false)}
                autoFocus
                rows={3}
              />
            ) : (
              <p
                className="ksp-scene-card-action"
                onClick={() => setEditingAction(true)}
              >
                {scene.actionLinesVi || scene.actionLinesEn}
              </p>
            )}
          </div>

          {/* Dialog */}
          {scene.dialog && scene.dialog.length > 0 && (
            <div className="ksp-scene-card-block ksp-scene-block-dialog">
              <label className="ksp-scene-card-block-label">Dialog:</label>
              {scene.dialog.map((d, di) => (
                <div key={di} className="ksp-scene-card-dialog-line">
                  <strong>{d.characterName}:</strong> {d.lineVi || d.lineEn}
                  {d.parenthetical && (
                    <span className="ksp-scene-card-paren"> ({d.parenthetical})</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* SFX */}
          {scene.sfx && scene.sfx.length > 0 && (
            <div className="ksp-scene-card-block ksp-scene-block-sfx">
              <label className="ksp-scene-card-block-label">SFX:</label>
              <span>{scene.sfx.join(" · ")}</span>
            </div>
          )}

          {/* Music brief */}
          {scene.musicBrief && (
            <div className="ksp-scene-card-block ksp-scene-block-music">
              <label className="ksp-scene-card-block-label">Music:</label>
              <span>{scene.musicBrief}</span>
            </div>
          )}

          {/* Transition */}
          {scene.transitionToNext && (
            <div className="ksp-scene-card-block ksp-scene-block-transition">
              <label className="ksp-scene-card-block-label">Transition:</label>
              <span>{scene.transitionToNext}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m${s.toString().padStart(2, "0")}s` : `${m}m`;
}

function exportScriptAsText(script: FilmScript) {
  const lines: string[] = [];
  lines.push(`TITLE: ${script.titleVi || script.titleEn}`);
  lines.push(`LOGLINE: ${script.loglineVi || script.logline}`);
  lines.push(`SYNOPSIS: ${script.synopsisVi || script.synopsisEn}`);
  lines.push("");
  lines.push("=".repeat(60));
  lines.push("");
  for (const scene of script.scenes) {
    lines.push(`SCENE ${scene.order}: ${scene.titleVi || scene.titleEn}`);
    lines.push(`Setting: ${scene.settings} — ${formatDuration(scene.durationSeconds)}`);
    lines.push("");
    lines.push(`Action:`);
    lines.push(scene.actionLinesVi || scene.actionLinesEn);
    lines.push("");
    if (scene.dialog && scene.dialog.length > 0) {
      lines.push("Dialog:");
      for (const d of scene.dialog) {
        lines.push(`  ${d.characterName}: ${d.lineVi || d.lineEn}`);
      }
      lines.push("");
    }
    if (scene.sfx && scene.sfx.length > 0) {
      lines.push(`SFX: ${scene.sfx.join(" · ")}`);
    }
    if (scene.musicBrief) {
      lines.push(`Music: ${scene.musicBrief}`);
    }
    if (scene.transitionToNext) {
      lines.push(`Transition: ${scene.transitionToNext}`);
    }
    lines.push("");
    lines.push("-".repeat(40));
    lines.push("");
  }
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(script.titleVi || script.titleEn || "script").replace(/[^a-z0-9]/gi, "_")}.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ============================================================================
// qc4 — STEPPER WIZARD HELPERS
// ============================================================================

const STAGE_ORDER: FilmScriptStage[] = ["structure", "beats", "twists", "scenes", "dialogues"];

const STAGE_LABELS: Record<FilmScriptStage, string> = {
  structure: "Khung kể chuyện (Structure)",
  beats: "Cột mốc câu chuyện (Beats)",
  twists: "Tình tiết bất ngờ (Twists)",
  scenes: "Phân cảnh (Scenes)",
  dialogues: "Lời thoại + SFX + Nhạc",
};

const STAGE_NUMBERS: Record<FilmScriptStage, string> = {
  structure: "1",
  beats: "2",
  twists: "3",
  scenes: "4",
  dialogues: "5",
};

const STAGE_HINTS: Record<FilmScriptStage, string> = {
  structure: "AI chọn khung kể chuyện (3-act, Hero's Journey, Save the Cat, Kishōtenketsu)",
  beats: "AI sinh 4-15 cột mốc narrative (Mở đầu, Khủng hoảng, Cao trào, Kết...)",
  twists: "AI gợi ý 1-3 tình tiết bất ngờ để câu chuyện hấp dẫn hơn",
  scenes: "Gộp các beats + twists đã chọn thành scenes cụ thể",
  dialogues: "AI fill lời thoại, SFX, brief nhạc nền, transition cho từng scene",
};

function countCompletedStages(film: FilmData): number {
  // qc18: use isStageDone as single source of truth so footer count matches
  // stepper green-check display (including Hướng B lock semantics for twists).
  let count = 0;
  if (isStageDone(film, "structure")) count++;
  if (isStageDone(film, "beats")) count++;
  if (isStageDone(film, "twists")) count++;
  if (isStageDone(film, "scenes")) count++;
  if (isStageDone(film, "dialogues")) count++;
  return count;
}

function isStageDone(film: FilmData, stage: FilmScriptStage): boolean {
  if (stage === "structure") return !!film.scriptStructure;
  if (stage === "beats") return !!film.scriptBeats?.length;
  if (stage === "twists") {
    // qc18 Hướng B: explicit lock via "Tiếp: ④ Phân cảnh →" button.
    if (film.scriptTwistsLocked === true) return true;
    // Backward-compat: qc17 projects don't have scriptTwistsLocked. If they
    // have twists data AND any downstream stage has data, the user must have
    // already passed Stage 3 → treat as locked.
    if (
      film.scriptTwists !== undefined &&
      (film.scriptIntermediateScenes !== undefined || film.script !== undefined)
    ) {
      return true;
    }
    return false;
  }
  if (stage === "scenes") {
    // qc20 (parallel qc18 Twist lock): explicit lock via "Tiếp: ⑤ Lời thoại →" button.
    if (film.scriptScenesLocked === true) return true;
    // Backward-compat: qc19 projects don't have scriptScenesLocked. If they
    // have scenes data AND downstream script (dialogues) has data, the user
    // must have already passed Stage 4 → treat as locked.
    if (
      film.scriptIntermediateScenes !== undefined &&
      film.scriptIntermediateScenes.length > 0 &&
      film.script !== undefined
    ) {
      return true;
    }
    return false;
  }
  if (stage === "dialogues") return !!film.script;
  return false;
}

function getCurrentActiveStage(film: FilmData): FilmScriptStage | null {
  // qc12 fix: If user explicitly navigated to a stage AND that stage is not
  // yet done, honor the navigation. If the stage IS done, ignore it (treat
  // as "all done, no active") — handles existing projects where scriptStage
  // was persisted as "dialogues" but Stage 5 is actually complete.
  if (film.scriptStage && !isStageDone(film, film.scriptStage)) {
    return film.scriptStage;
  }
  // Otherwise, first incomplete stage
  for (const s of STAGE_ORDER) {
    if (!isStageDone(film, s)) return s;
  }
  // All done → no active stage (all render done previews including Stage 5)
  return null;
}

function isStageLocked(film: FilmData, stage: FilmScriptStage): boolean {
  // A stage is locked if any upstream stage is not done
  const idx = STAGE_ORDER.indexOf(stage);
  for (let i = 0; i < idx; i++) {
    if (!isStageDone(film, STAGE_ORDER[i])) return true;
  }
  return false;
}

// ============================================================================
// qc4 — MAIN STEPPER WIZARD
// ============================================================================

interface ScriptStepperWizardProps {
  film: FilmData;
  idea: string;
  setting: import("../types/project").ProjectSettingV2 | undefined;
  isGenerating: boolean;
  onSetGenerating: (v: boolean) => void;
  onUpdateProject: ReturnType<typeof useAppStore.getState>["updateCurrentProject"];
  onShowToast: ReturnType<typeof useAppStore.getState>["showToast"];
  project: any;
}

function ScriptStepperWizard({
  film,
  idea,
  setting,
  isGenerating,
  onSetGenerating,
  onUpdateProject,
  onShowToast,
  project,
}: ScriptStepperWizardProps) {
  if (!setting) return <p style={{ padding: 12, color: "#888", fontSize: 11 }}>Project setting missing.</p>;

  const activeStage = getCurrentActiveStage(film);

  // Provider read from global settings.aiProviders.scriptWriter
  const provider: FilmScriptProvider =
    (setting.aiProviders?.scriptWriter ?? "gemini-flash") as FilmScriptProvider;

  // Guard for any AI run
  function guardInputs(): boolean {
    if (!idea.trim()) {
      onShowToast("Hãy nhập Idea trước khi chạy wizard", "info");
      return false;
    }
    if (film.characters.length === 0) {
      onShowToast("Hãy add ít nhất 1 character vào Cast trước", "info");
      return false;
    }
    return true;
  }

  // Revert if downstream has data (with confirm)
  function safeNavToStage(target: FilmScriptStage) {
    const targetIdx = STAGE_ORDER.indexOf(target);
    const downstream = STAGE_ORDER.slice(targetIdx + 1);
    const hasDownstreamData = downstream.some((s) => isStageDone(film, s));
    const targetIsDone = isStageDone(film, target);

    if (hasDownstreamData) {
      // Clicking a done stage that has downstream data → revert + clear downstream
      const ok = confirm(
        `Revert về stage "${STAGE_LABELS[target]}"?\n\nCác stage phía sau (${downstream
          .map((s) => STAGE_LABELS[s])
          .join(", ")}) sẽ bị clear và bạn cần re-run lại.\n\nClick OK để revert, Cancel để stay.`
      );
      if (!ok) return;
      onUpdateProject((p) => revertToStage(p, target));
    } else if (targetIsDone) {
      // qc12 fix: Clicking the LAST stage that is done (no downstream) — e.g., Stage 5
      // when script exists. To re-enter active mode for regen, clear this stage's data.
      const ok = confirm(
        `Regen stage "${STAGE_LABELS[target]}"?\n\nDữ liệu hiện tại của stage này sẽ bị clear để regen lại từ đầu.\n\nClick OK để tiếp tục, Cancel để giữ nguyên.`
      );
      if (!ok) return;
      onUpdateProject((p) => clearStageData(p, target));
    } else {
      onUpdateProject((p) => setScriptStage(p, target));
    }
  }

  return (
    <div className="ksp-script-stepper">
      {STAGE_ORDER.map((stage) => (
        <StepperStageCard
          key={stage}
          stage={stage}
          film={film}
          isActive={stage === activeStage}
          isLocked={isStageLocked(film, stage)}
          isGenerating={isGenerating}
          provider={provider}
          onClick={() => safeNavToStage(stage)}
          renderActiveContent={() => (
            <StageActiveContent
              stage={stage}
              film={film}
              idea={idea}
              setting={setting}
              provider={provider}
              isGenerating={isGenerating}
              onSetGenerating={onSetGenerating}
              onUpdateProject={onUpdateProject}
              onShowToast={onShowToast}
              project={project}
              guardInputs={guardInputs}
            />
          )}
          onUpdateProject={onUpdateProject}
          project={project}
        />
      ))}
    </div>
  );
}

// ============================================================================
// qc4 — STEPPER STAGE CARD (1 row per stage with 3 states: done / active / pending)
// ============================================================================

interface StepperStageCardProps {
  stage: FilmScriptStage;
  film: FilmData;
  isActive: boolean;
  isLocked: boolean;
  isGenerating: boolean;
  provider: FilmScriptProvider;
  onClick: () => void;
  renderActiveContent: () => React.ReactNode;
  onUpdateProject: ReturnType<typeof useAppStore.getState>["updateCurrentProject"];
  project: any;
}

function StepperStageCard({
  stage,
  film,
  isActive,
  isLocked,
  onClick,
  renderActiveContent,
}: StepperStageCardProps) {
  const done = isStageDone(film, stage);

  // State class
  let stateClass = "ksp-step-pending";
  if (done && !isActive) stateClass = "ksp-step-done";
  if (isActive) stateClass = "ksp-step-active";
  if (isLocked && !done && !isActive) stateClass = "ksp-step-locked";

  return (
    <div className={`ksp-step-card ${stateClass}`}>
      {/* Circle indicator */}
      <button
        type="button"
        className="ksp-step-indicator"
        onClick={() => !isLocked && onClick()}
        disabled={isLocked}
        title={isLocked ? "Stage phía trước chưa xong" : `Stage ${STAGE_NUMBERS[stage]}: ${STAGE_LABELS[stage]}`}
      >
        {done && !isActive ? "✓" : STAGE_NUMBERS[stage]}
      </button>

      {/* Content area */}
      <div className="ksp-step-body">
        <div className="ksp-step-header">
          <span className="ksp-step-label">{STAGE_LABELS[stage]}</span>
          {done && !isActive && (
            <span className="ksp-step-status-pill ksp-step-status-done">done</span>
          )}
          {isActive && !done && (
            <span className="ksp-step-status-pill ksp-step-status-active">đang làm</span>
          )}
        </div>

        {/* Active state: full panel — Pending: hint — Done: preview */}
        {isActive ? (
          renderActiveContent()
        ) : done ? (
          <StageDonePreview stage={stage} film={film} onClick={onClick} />
        ) : (
          <div className="ksp-step-hint">{STAGE_HINTS[stage]}</div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// qc4 — DONE PREVIEW (collapsed view per stage)
// ============================================================================

function StageDonePreview({
  stage,
  film,
  onClick,
}: {
  stage: FilmScriptStage;
  film: FilmData;
  onClick: () => void;
}) {
  let preview: React.ReactNode = null;

  if (stage === "structure" && film.scriptStructure) {
    preview = (
      <>
        <span className="ksp-step-preview-pill">
          {FRAMEWORK_LABELS[film.scriptStructure.framework].name}
        </span>
        <div className="ksp-step-preview-text">{film.scriptStructure.contentVi || film.scriptStructure.contentEn}</div>
      </>
    );
  } else if (stage === "beats" && film.scriptBeats?.length) {
    preview = (
      <>
        <span className="ksp-step-preview-pill">{film.scriptBeats.length} milestones</span>
        <ul className="ksp-step-preview-list">
          {film.scriptBeats.slice(0, 3).map((b) => (
            <li key={b.id}>
              <span className="ksp-step-preview-list-num">{b.order}.</span> {b.title}
            </li>
          ))}
          {film.scriptBeats.length > 3 && (
            <li className="ksp-step-preview-list-more">+ {film.scriptBeats.length - 3} beats khác...</li>
          )}
        </ul>
      </>
    );
  } else if (stage === "twists" && film.scriptTwists !== undefined) {
    const accepted = film.scriptTwists.filter((t) => t.accepted === true).length;
    const total = film.scriptTwists.length;
    preview = (
      <>
        <span className="ksp-step-preview-pill">
          {accepted}/{total} accepted
        </span>
        {total === 0 ? (
          <div className="ksp-step-preview-text">No twists generated yet</div>
        ) : (
          <ul className="ksp-step-preview-list">
            {film.scriptTwists.slice(0, 2).map((t, i) => (
              <li key={t.id} className={t.accepted === false ? "ksp-step-preview-list-rejected" : ""}>
                <span className="ksp-step-preview-list-num">{i + 1}.</span> {t.description.slice(0, 60)}
                {t.description.length > 60 ? "..." : ""}
              </li>
            ))}
          </ul>
        )}
      </>
    );
  } else if (stage === "scenes" && film.scriptIntermediateScenes?.length) {
    const totalSec = film.scriptIntermediateScenes.reduce((s, sc) => s + sc.durationSeconds, 0);
    preview = (
      <>
        <span className="ksp-step-preview-pill">
          {film.scriptIntermediateScenes.length} scenes · {totalSec}s
        </span>
        <ul className="ksp-step-preview-list">
          {film.scriptIntermediateScenes.slice(0, 3).map((s) => (
            <li key={s.id}>
              <span className="ksp-step-preview-list-num">{s.order}.</span> {s.titleVi || s.titleEn}
            </li>
          ))}
        </ul>
      </>
    );
  } else if (stage === "dialogues" && film.script) {
    preview = (
      <>
        <span className="ksp-step-preview-pill">{film.script.scenes.length} scenes ready</span>
        <div className="ksp-step-preview-text">
          {film.script.titleVi || film.script.titleEn}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="ksp-step-preview-content">{preview}</div>
      <div className="ksp-step-done-actions">
        <button
          type="button"
          className="ksp-step-done-btn"
          onClick={onClick}
          title="Click để mở lại stage này (downstream stages sẽ clear)"
        >
          🔄 Regen / Edit
        </button>
      </div>
    </>
  );
}

// ============================================================================
// qc4 — ACTIVE STAGE CONTENT (per-stage full UI)
// ============================================================================

interface StageActiveContentProps {
  stage: FilmScriptStage;
  film: FilmData;
  idea: string;
  setting: import("../types/project").ProjectSettingV2;
  provider: FilmScriptProvider;
  isGenerating: boolean;
  onSetGenerating: (v: boolean) => void;
  onUpdateProject: ReturnType<typeof useAppStore.getState>["updateCurrentProject"];
  onShowToast: ReturnType<typeof useAppStore.getState>["showToast"];
  project: any;
  guardInputs: () => boolean;
}

function StageActiveContent(props: StageActiveContentProps) {
  const { stage } = props;
  if (stage === "structure") return <ActiveStage1 {...props} />;
  if (stage === "beats") return <ActiveStage2 {...props} />;
  if (stage === "twists") return <ActiveStage3 {...props} />;
  if (stage === "scenes") return <ActiveStage4 {...props} />;
  return <ActiveStage5 {...props} />;
}

// --- STAGE 1 active: Structure ----------------------------------------------
function ActiveStage1({
  film,
  idea,
  setting,
  provider,
  isGenerating,
  onSetGenerating,
  onUpdateProject,
  onShowToast,
  project,
  guardInputs,
}: StageActiveContentProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [pickedFramework, setPickedFramework] = useState<FilmStoryFramework | undefined>(
    film.scriptStructure?.framework
  );

  async function handleRun(preferred?: FilmStoryFramework) {
    if (!guardInputs()) return;
    // qc6 cache confirm: if data exists, ask before regenerating (costs AI call)
    if (film.scriptStructure) {
      const ok = confirm(
        `Stage 1 đã có data. Sinh lại sẽ tốn 1 AI call và clear các stage phía sau.\n\nClick OK để tiếp tục, Cancel để giữ nguyên.`
      );
      if (!ok) return;
    }
    onSetGenerating(true);
    try {
      const result = await runStage1Structure({
        idea,
        setting,
        characters: film.characters,
        preferredFramework: preferred,
        provider,
      });
      onUpdateProject((p) => setScriptStructure(p, result));
      onShowToast(`Đã chọn khung: ${FRAMEWORK_LABELS[result.framework].name}`, "success");
      onUpdateProject((p) => setScriptStage(p, "beats"));
    } catch (err) {
      onShowToast(`Stage 1 lỗi: ${(err as Error).message}`, "error");
    } finally {
      onSetGenerating(false);
    }
  }

  return (
    <div className="ksp-step-active-body">
      <p className="ksp-step-active-hint">
        AI chọn khung kể chuyện và viết overview 3-5 câu. Mặc định 3-Act. Nhấn "Chọn manual" để tự chọn.
      </p>

      <button
        type="button"
        className="ksp-step-advanced-toggle"
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        {showAdvanced ? "▼" : "▶"} Chọn manual khung kể chuyện
      </button>

      {showAdvanced && (
        <div className="ksp-step-framework-list">
          {(Object.keys(FRAMEWORK_LABELS) as FilmStoryFramework[]).map((fw) => (
            <label key={fw} className="ksp-step-framework-row">
              <input
                type="radio"
                name={`framework-${film.characters[0]?.id ?? "x"}`}
                value={fw}
                checked={pickedFramework === fw}
                onChange={() => setPickedFramework(fw)}
                className="ksp-step-framework-radio"
              />
              <div className="ksp-step-framework-text">
                <strong>{FRAMEWORK_LABELS[fw].name}</strong>
                <p>{FRAMEWORK_LABELS[fw].description}</p>
              </div>
            </label>
          ))}
        </div>
      )}

      <button
        type="button"
        className="ksp-step-primary-btn"
        disabled={isGenerating}
        onClick={() => handleRun(pickedFramework)}
      >
        {isGenerating ? "⏳ Đang chọn khung..." : "✨ AI chọn khung kể chuyện"}
      </button>
    </div>
  );
}

// --- STAGE 2 active: Beats --------------------------------------------------
function ActiveStage2({
  film,
  idea,
  setting,
  provider,
  isGenerating,
  onSetGenerating,
  onUpdateProject,
  onShowToast,
  project,
  guardInputs,
}: StageActiveContentProps) {
  const beats = film.scriptBeats ?? [];

  async function handleRun() {
    if (!guardInputs()) return;
    if (!film.scriptStructure) {
      onShowToast("Stage 1 (Structure) chưa xong", "info");
      return;
    }
    // qc6 cache confirm
    if (beats.length > 0) {
      const ok = confirm(
        `Stage 2 đã có ${beats.length} cột mốc. Sinh lại sẽ tốn 1 AI call và clear các stage phía sau.\n\nClick OK để tiếp tục, Cancel để giữ nguyên.`
      );
      if (!ok) return;
    }
    onSetGenerating(true);
    try {
      const result = await runStage2Beats({
        idea,
        setting,
        characters: film.characters,
        structure: film.scriptStructure,
        provider,
      });
      onUpdateProject((p) => setScriptBeats(p, result));
      onShowToast(`Đã sinh ${result.length} cột mốc`, "success");
    } catch (err) {
      onShowToast(`Stage 2 lỗi: ${(err as Error).message}`, "error");
    } finally {
      onSetGenerating(false);
    }
  }

  return (
    <div className="ksp-step-active-body">
      <p className="ksp-step-active-hint">
        AI sinh các cột mốc câu chuyện theo khung đã chọn. Nhấn vào từng beat để chỉnh sửa.
      </p>

      <button
        type="button"
        className="ksp-step-primary-btn"
        disabled={isGenerating}
        onClick={handleRun}
      >
        {isGenerating
          ? "⏳ Đang sinh các cột mốc..."
          : beats.length
          ? "✨ Sinh lại cột mốc"
          : "✨ AI sinh cột mốc câu chuyện"}
      </button>

      {beats.length > 0 && (
        <>
          <div className="ksp-step-beats-list">
            {beats.map((b) => (
              <div key={b.id} className="ksp-step-beat-row">
                <span className="ksp-step-beat-order">{b.order}</span>
                <div className="ksp-step-beat-content">
                  <input
                    type="text"
                    className="ksp-input ksp-input-sm ksp-step-beat-title"
                    value={b.title}
                    onChange={(e) =>
                      onUpdateProject((p) => updateScriptBeat(p, b.id, { title: e.target.value }))
                    }
                    placeholder="Tiêu đề beat"
                  />
                  <textarea
                    className="ksp-step-beat-desc"
                    value={b.description}
                    onChange={(e) =>
                      onUpdateProject((p) =>
                        updateScriptBeat(p, b.id, { description: e.target.value })
                      )
                    }
                    placeholder="Mô tả những gì xảy ra ở beat này..."
                    rows={2}
                  />
                </div>
                <button
                  type="button"
                  className="ksp-step-beat-remove"
                  onClick={() => {
                    if (confirm("Xóa beat này?"))
                      onUpdateProject((p) => removeScriptBeat(p, b.id));
                  }}
                  title="Xóa beat"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="ksp-step-active-row">
            <button
              type="button"
              className="ksp-step-secondary-btn"
              onClick={() => {
                onUpdateProject((p) =>
                  addScriptBeat(p, {
                    title: "Beat mới",
                    description: "Mô tả những gì xảy ra.",
                  })
                );
              }}
            >
              + Thêm beat
            </button>
            <button
              type="button"
              className="ksp-step-primary-btn ksp-step-primary-btn-sm"
              onClick={() => onUpdateProject((p) => setScriptStage(p, "twists"))}
            >
              Tiếp: ③ Twists →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// --- STAGE 3 active: Twists -------------------------------------------------
function ActiveStage3({
  film,
  idea,
  setting,
  provider,
  isGenerating,
  onSetGenerating,
  onUpdateProject,
  onShowToast,
  project,
  guardInputs,
}: StageActiveContentProps) {
  const twists = film.scriptTwists ?? [];
  const beats = film.scriptBeats ?? [];

  async function handleRun() {
    if (!guardInputs()) return;
    if (!film.scriptStructure || beats.length === 0) {
      onShowToast("Stage 2 (Beats) chưa xong", "info");
      return;
    }
    // qc6 cache confirm
    if (twists.length > 0) {
      const ok = confirm(
        `Stage 3 đã có ${twists.length} tình tiết. Sinh lại sẽ tốn 1 AI call và clear lại accept/reject.\n\nClick OK để tiếp tục, Cancel để giữ nguyên.`
      );
      if (!ok) return;
    }
    onSetGenerating(true);
    try {
      const result = await runStage3Twists({
        idea,
        setting,
        characters: film.characters,
        structure: film.scriptStructure,
        beats,
        provider,
      });
      onUpdateProject((p) => setScriptTwists(p, result));
      onShowToast(`Đã gợi ý ${result.length} tình tiết`, "success");
    } catch (err) {
      onShowToast(`Stage 3 lỗi: ${(err as Error).message}`, "error");
    } finally {
      onSetGenerating(false);
    }
  }

  return (
    <div className="ksp-step-active-body">
      <p className="ksp-step-active-hint">
        AI gợi ý 1-3 tình tiết bất ngờ để câu chuyện hấp dẫn hơn. Chấp nhận ✓ / từ chối ✗ từng cái.
      </p>

      <button
        type="button"
        className="ksp-step-primary-btn"
        disabled={isGenerating}
        onClick={handleRun}
      >
        {isGenerating
          ? "⏳ Đang gợi ý tình tiết..."
          : twists.length
          ? "✨ Gợi ý lại tình tiết"
          : "✨ AI gợi ý tình tiết bất ngờ"}
      </button>

      {twists.length > 0 && (
        <>
          <div className="ksp-step-twists-list">
            {twists.map((t, i) => {
              const beat = beats.find((b) => b.id === t.beatId);
              return (
                <div
                  key={t.id}
                  className={`ksp-step-twist-card ${
                    t.accepted === true ? "accepted" : t.accepted === false ? "rejected" : ""
                  }`}
                >
                  <div className="ksp-step-twist-header">
                    <strong>Tình tiết {i + 1}</strong>
                    <span className="ksp-step-twist-beat">
                      gắn vào Beat {beat?.order ?? "?"}: {beat?.title ?? "(?)"}
                    </span>
                  </div>
                  <p className="ksp-step-twist-desc">{t.description}</p>
                  <div className="ksp-step-twist-actions">
                    <button
                      type="button"
                      className={`ksp-step-twist-btn ${t.accepted === true ? "active-accept" : ""}`}
                      onClick={() => onUpdateProject((p) => updateScriptTwist(p, t.id, { accepted: true }))}
                    >
                      ✓ Chấp nhận
                    </button>
                    <button
                      type="button"
                      className={`ksp-step-twist-btn ${t.accepted === false ? "active-reject" : ""}`}
                      onClick={() => onUpdateProject((p) => updateScriptTwist(p, t.id, { accepted: false }))}
                    >
                      ✗ Từ chối
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="ksp-step-primary-btn"
            onClick={() =>
              onUpdateProject((p) => {
                // qc18 Hướng B: lock twists + advance stage in one update.
                // Compose: apply lock first, then setScriptStage on locked project.
                const lockPatch = lockScriptTwists(p);
                const pLocked = { ...p, ...lockPatch };
                return setScriptStage(pLocked, "scenes");
              })
            }
          >
            Tiếp: ④ Phân cảnh →
          </button>
        </>
      )}
    </div>
  );
}

// --- STAGE 4 active: Scenes (preliminary) ------------------------------------
function ActiveStage4({
  film,
  idea,
  setting,
  provider,
  isGenerating,
  onSetGenerating,
  onUpdateProject,
  onShowToast,
  project,
  guardInputs,
}: StageActiveContentProps) {
  const interScenes = film.scriptIntermediateScenes ?? [];
  const beats = film.scriptBeats ?? [];
  const totalSecondsTarget = (setting.durationMinutes ?? 5) * 60;
  const suggestedSceneCount = Math.max(4, Math.round(totalSecondsTarget / 75));
  const targetSceneCount = film.scriptTargetSceneCount;

  async function handleRun() {
    if (!guardInputs()) return;
    if (!film.scriptStructure || beats.length === 0) {
      onShowToast("Stage 2 (Beats) chưa xong", "info");
      return;
    }
    // qc6 cache confirm
    if (interScenes.length > 0) {
      const ok = confirm(
        `Stage 4 đã có ${interScenes.length} phân cảnh. Sinh lại sẽ tốn 1 AI call và clear Stage 5 (lời thoại).\n\nClick OK để tiếp tục, Cancel để giữ nguyên.`
      );
      if (!ok) return;
    }
    onSetGenerating(true);
    try {
      const acceptedTwists = (film.scriptTwists ?? []).filter((t) => t.accepted === true);
      const result = await runStage4Scenes({
        idea,
        setting,
        characters: film.characters,
        structure: film.scriptStructure,
        beats,
        acceptedTwists,
        provider,
        targetSceneCount,
      });
      onUpdateProject((p) => setScriptIntermediateScenes(p, result));
      onShowToast(`Đã sinh ${result.length} phân cảnh`, "success");
    } catch (err) {
      onShowToast(`Stage 4 lỗi: ${(err as Error).message}`, "error");
    } finally {
      onSetGenerating(false);
    }
  }

  const totalSec = interScenes.reduce((s, sc) => s + sc.durationSeconds, 0);

  return (
    <div className="ksp-step-active-body">
      <p className="ksp-step-active-hint">
        Gộp các beats + tình tiết đã chọn thành phân cảnh cụ thể (bối cảnh + action + thời lượng).
      </p>

      {/* Target scene count control (qc6) */}
      <div className="ksp-step-scene-count-control">
        <label className="ksp-step-scene-count-label">
          Số lượng phân cảnh mong muốn:
        </label>
        <div className="ksp-step-scene-count-row">
          <input
            type="number"
            min={2}
            max={50}
            step={1}
            className="ksp-step-scene-count-input"
            value={targetSceneCount ?? ""}
            placeholder={`Auto (gợi ý ${suggestedSceneCount})`}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "") {
                onUpdateProject((p) => setScriptTargetSceneCount(p, undefined));
              } else {
                const n = parseInt(val, 10);
                if (!isNaN(n) && n >= 2 && n <= 50) {
                  onUpdateProject((p) => setScriptTargetSceneCount(p, n));
                }
              }
            }}
          />
          {targetSceneCount !== undefined && (
            <button
              type="button"
              className="ksp-step-scene-count-clear"
              onClick={() => onUpdateProject((p) => setScriptTargetSceneCount(p, undefined))}
              title="Reset về auto"
            >
              ✕ Auto
            </button>
          )}
        </div>
        <div className="ksp-step-scene-count-hint">
          Phim {setting.durationMinutes ?? 5} phút · AI gợi ý {suggestedSceneCount} phân cảnh.
          {" "}Bỏ trống để AI tự quyết, hoặc nhập số cụ thể để có chi tiết hơn.
        </div>
      </div>

      <button
        type="button"
        className="ksp-step-primary-btn"
        disabled={isGenerating}
        onClick={handleRun}
      >
        {isGenerating
          ? "⏳ Đang sinh phân cảnh..."
          : interScenes.length
          ? "✨ Sinh lại phân cảnh"
          : "✨ AI sinh phân cảnh"}
      </button>

      {interScenes.length > 0 && (
        <>
          <div className="ksp-step-scenes-list">
            {interScenes.map((s) => (
              <SceneCardWithWarning
                key={s.id}
                scene={s}
                beats={beats}
                provider={provider}
                onUpdateProject={onUpdateProject}
                onShowToast={onShowToast}
              />
            ))}
          </div>
          <div className="ksp-step-active-row">
            <span className="ksp-step-scenes-summary">
              Tổng: <strong>{totalSec}s</strong> ({Math.round(totalSec / 60)} phút) · {interScenes.length} phân cảnh
            </span>
            <button
              type="button"
              className="ksp-step-primary-btn ksp-step-primary-btn-sm"
              onClick={() =>
                onUpdateProject((p) => {
                  // qc20 (parallel qc18 Twist lock): lock scenes + advance in one update.
                  const lockPatch = lockScriptScenes(p);
                  const pLocked = { ...p, ...lockPatch };
                  return setScriptStage(pLocked, "dialogues");
                })
              }
            >
              Tiếp: ⑤ Lời thoại →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// --- qc20 Stage 4 Scene Card with complexity warning -------------------------
function SceneCardWithWarning({
  scene,
  beats,
  provider,
  onUpdateProject,
  onShowToast,
}: {
  scene: import("../types/film").FilmScriptIntermediateScene;
  beats: import("../types/film").FilmScriptBeat[];
  provider: FilmScriptProvider;
  onUpdateProject: (fn: (p: any) => any) => void;
  onShowToast: (msg: string, type?: "info" | "success" | "error") => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [splitSuggestion, setSplitSuggestion] = React.useState<SceneSplitSuggestion | null>(null);
  const [isLoadingSplit, setIsLoadingSplit] = React.useState(false);

  const estimatedShots = estimateSceneShotCount(scene);
  const complexity = classifySceneComplexity(estimatedShots);
  const dismissed = scene.complexityWarningDismissed === true;
  const showWarning = complexity !== "ok" && !dismissed;

  async function handleRequestSplit() {
    setIsLoadingSplit(true);
    try {
      const suggestion = await runSplitSceneSuggestion({ scene, beats, provider });
      setSplitSuggestion(suggestion);
    } catch (err) {
      onShowToast(`Lỗi gợi ý tách scene: ${(err as Error).message}`, "error");
    } finally {
      setIsLoadingSplit(false);
    }
  }

  function handleConfirmSplit() {
    if (!splitSuggestion) return;
    onUpdateProject((p) =>
      applySceneSplit(p, scene.id, splitSuggestion.subScenes[0], splitSuggestion.subScenes[1])
    );
    onShowToast(`Đã tách "${scene.titleVi || scene.titleEn}" thành 2 sub-scenes`, "success");
    setSplitSuggestion(null);
    setExpanded(false);
  }

  function handleDismiss() {
    onUpdateProject((p) => dismissSceneComplexityWarning(p, scene.id));
    setExpanded(false);
    onShowToast("Đã giữ nguyên scene. Storyboard sẽ dùng grid lớn hơn (4×3 / 4×4).", "info");
  }

  return (
    <div className="ksp-step-scene-card">
      <div className="ksp-step-scene-header">
        <strong>Cảnh {scene.order}</strong>
        <span className="ksp-step-scene-title">{scene.titleVi || scene.titleEn}</span>
        <span className="ksp-step-scene-duration">{scene.durationSeconds}s</span>
        {showWarning && (
          <button
            type="button"
            className="ksp-step-scene-warn-badge"
            onClick={() => setExpanded((e) => !e)}
            title={
              complexity === "over_hard"
                ? `Ước tính ${estimatedShots} shots — VƯỢT cap 16. Khuyến cáo tách scene.`
                : `Ước tính ${estimatedShots} shots — vượt sweet spot 9.`
            }
          >
            ⚠ ~{estimatedShots} shots {expanded ? "▲" : "▼"}
          </button>
        )}
      </div>
      <div className="ksp-step-scene-settings">{scene.settings}</div>
      <div className="ksp-step-scene-action">{scene.actionLinesVi || scene.actionLinesEn}</div>

      {expanded && showWarning && (
        <div className="ksp-step-scene-warn-panel">
          <p className="ksp-step-scene-warn-hint">
            {complexity === "over_hard"
              ? `Scene này quá phức tạp (${estimatedShots} shots ước tính, cap cứng = 16). Khuyến cáo tách thành 2 sub-scenes để giữ chất lượng cinematic.`
              : `Scene này vượt sweet spot 9 shots (ước tính ${estimatedShots}). Storyboard sẽ phải dùng grid lớn hơn (cell size giảm). Chọn:`}
          </p>

          {!splitSuggestion && (
            <div className="ksp-step-scene-warn-actions">
              <button
                type="button"
                className="ksp-step-primary-btn ksp-step-primary-btn-sm"
                disabled={isLoadingSplit}
                onClick={handleRequestSplit}
              >
                {isLoadingSplit ? "⏳ AI đang gợi ý..." : "🪓 Tách thành 2 scenes"}
              </button>
              <button
                type="button"
                className="ksp-step-secondary-btn ksp-step-secondary-btn-sm"
                onClick={handleDismiss}
              >
                ✔ Giữ nguyên (grid lớn hơn)
              </button>
              <button
                type="button"
                className="ksp-step-secondary-btn ksp-step-secondary-btn-sm"
                onClick={() => setExpanded(false)}
              >
                ✕ Hủy
              </button>
            </div>
          )}

          {splitSuggestion && (
            <div className="ksp-step-scene-split-preview">
              <p className="ksp-step-scene-split-reason">
                <strong>💡 Lý do tách:</strong> {splitSuggestion.reasonVi}
              </p>
              <div className="ksp-step-scene-split-sub">
                <strong>Sub-scene 1 ({splitSuggestion.subScenes[0].durationSeconds}s):</strong>
                <div>{splitSuggestion.subScenes[0].titleVi}</div>
                <div className="ksp-step-scene-split-action">
                  {splitSuggestion.subScenes[0].actionLinesVi}
                </div>
              </div>
              <div className="ksp-step-scene-split-sub">
                <strong>Sub-scene 2 ({splitSuggestion.subScenes[1].durationSeconds}s):</strong>
                <div>{splitSuggestion.subScenes[1].titleVi}</div>
                <div className="ksp-step-scene-split-action">
                  {splitSuggestion.subScenes[1].actionLinesVi}
                </div>
              </div>
              <div className="ksp-step-scene-warn-actions">
                <button
                  type="button"
                  className="ksp-step-primary-btn ksp-step-primary-btn-sm"
                  onClick={handleConfirmSplit}
                >
                  ✓ Đồng ý tách
                </button>
                <button
                  type="button"
                  className="ksp-step-secondary-btn ksp-step-secondary-btn-sm"
                  onClick={() => setSplitSuggestion(null)}
                >
                  ↺ Gợi ý lại
                </button>
                <button
                  type="button"
                  className="ksp-step-secondary-btn ksp-step-secondary-btn-sm"
                  onClick={() => {
                    setSplitSuggestion(null);
                    setExpanded(false);
                  }}
                >
                  ✕ Hủy
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- STAGE 5 active: Dialogues ----------------------------------------------
function ActiveStage5({
  film,
  idea,
  setting,
  provider,
  isGenerating,
  onSetGenerating,
  onUpdateProject,
  onShowToast,
  project,
  guardInputs,
}: StageActiveContentProps) {
  async function handleRun() {
    if (!guardInputs()) return;
    if (
      !film.scriptStructure ||
      !film.scriptBeats?.length ||
      !film.scriptIntermediateScenes?.length
    ) {
      onShowToast("Stage 1-4 chưa xong — vui lòng quay lại stage trước", "info");
      return;
    }
    // qc6 cache confirm
    if (film.script) {
      const ok = confirm(
        `Stage 5 đã có script với ${film.script.scenes.length} cảnh. Sinh lại sẽ tốn 1 AI call và overwrite script hiện tại (version cũ được archive).\n\nClick OK để tiếp tục, Cancel để giữ nguyên.`
      );
      if (!ok) return;
    }
    onSetGenerating(true);
    try {
      const acceptedTwists = (film.scriptTwists ?? []).filter((t) => t.accepted === true);
      const newScript = await runStage5FromStages({
        idea,
        setting,
        characters: film.characters,
        structure: film.scriptStructure,
        beats: film.scriptBeats,
        acceptedTwists,
        intermediateScenes: film.scriptIntermediateScenes,
        provider,
      });
      onUpdateProject((p) => setScript(p, newScript));
      onShowToast(`Đã viết script ${newScript.scenes.length} cảnh — chuyển sang Storyboard`, "success");
    } catch (err) {
      onShowToast(`Stage 5 lỗi: ${(err as Error).message}`, "error");
    } finally {
      onSetGenerating(false);
    }
  }

  return (
    <div className="ksp-step-active-body">
      <p className="ksp-step-active-hint">
        Tầng cuối — AI điền lời thoại, SFX, brief nhạc nền, transition cho từng phân cảnh dựa trên các bước trên.
      </p>

      <button
        type="button"
        className="ksp-step-primary-btn"
        disabled={isGenerating}
        onClick={handleRun}
      >
        {isGenerating
          ? "⏳ Đang viết lời thoại..."
          : film.script
          ? "✨ Viết lại lời thoại"
          : "✨ AI viết lời thoại + SFX + nhạc"}
      </button>
    </div>
  );
}
