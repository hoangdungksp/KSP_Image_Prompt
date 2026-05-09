/**
 * KSP Image v0.9.0 — Film Script Section (Mockup 2)
 *
 * Industry-standard screenplay editor for Film mode:
 * - 7 fields per scene: settings, action, dialog, parentheticals, sfx, music, transitions
 * - AI generate full script from idea
 * - Variation regeneration with versioning
 * - Inline edit (click → edit → blur autosave)
 * - Scenes expandable/collapsible
 *
 * Used in Film mode only.
 */

import React, { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { migrateProjectToV09 } from "../store/migration_v09";
import * as actions from "../store/v09_actions";
import { generateFilmScript } from "../engine/aiRuntime";
import { ConfirmButton } from "./ConfirmButton";
import type {
  FilmScript,
  FilmSceneScript,
  ProjectModeV2,
  ScriptDialog,
} from "../types/v0_9_0";

export function FilmScriptSection() {
  const project = useAppStore((s) => s.currentProject);
  const updateProject = useAppStore((s) => s.updateCurrentProject);
  const showToast = useAppStore((s) => s.showToast);

  if (!project) return null;
  const migrated = migrateProjectToV09(project);
  const mode = (migrated.settingV2?.mode ?? "photos") as ProjectModeV2;
  if (mode !== "film") return null;

  const script = migrated.script;
  const setting = migrated.settingV2!;
  const cast = migrated.filmCharactersV2 ?? [];
  const idea = (project as any).idea ?? "";

  const [generating, setGenerating] = useState(false);
  const [showVersions, setShowVersions] = useState(false);

  function patch(updates: Partial<typeof migrated>) {
    updateProject(updates as any);
  }

  async function handleGenerateScript(asVariation = false) {
    if (!idea.trim()) {
      showToast("Anh nhập ý tưởng (Idea) trước khi AI viết Script", "error");
      return;
    }
    if (cast.length === 0) {
      showToast("Anh thêm ít nhất 1 character vào Cast trước", "error");
      return;
    }

    // Snapshot current script before regenerating (variation)
    if (asVariation && script) {
      patch(actions.snapshotScriptVersion(migrated, "Before variation"));
    }

    setGenerating(true);
    try {
      const { script: newScript, reasoning } = await generateFilmScript(
        {
          ideaRaw: idea,
          genre: setting.genre ?? "drama",
          animationStyle: setting.animationStyle ?? "live_action",
          durationMinutes: setting.durationMinutes ?? 5,
          aspectRatio: setting.aspectRatio,
          cast,
        },
        setting.aiProviders.scriptWriter
      );

      patch(actions.setScript(migrated, newScript));
      patch(actions.syncFilmStructureFromScript({ ...migrated, script: newScript }));

      showToast(
        `✓ Script generated: ${newScript.scenes.length} scenes${reasoning ? ` · ${reasoning.slice(0, 60)}...` : ""}`,
        "success"
      );
    } catch (err: any) {
      showToast(`Lỗi AI: ${err.message}`, "error");
    } finally {
      setGenerating(false);
    }
  }

  function handleRevertVersion(versionId: string) {
    if (!script) return;
    patch(actions.snapshotScriptVersion(migrated, "Before revert"));
    patch(actions.revertScriptToVersion(migrated, versionId));
    setShowVersions(false);
    showToast("✓ Reverted to selected version (current saved as new version)", "success");
  }

  return (
    <section className="ksp-section ksp-script-section" data-mode={mode}>
      <header className="ksp-section-header">
        <span className="ksp-section-icon">📝</span>
        <h2 className="ksp-section-title">2. SCRIPT (Kịch bản)</h2>
        {script && (
          <span className="ksp-script-meta">
            {script.scenes.length} scenes · {totalDurationMinutes(script)} min
          </span>
        )}
      </header>

      {/* AI Generate buttons */}
      <div className="ksp-script-actions">
        <button
          className="ksp-btn ksp-btn-orange"
          onClick={() => handleGenerateScript(false)}
          disabled={generating}
        >
          {generating ? "⚙ Generating..." : script ? "✨ AI viết lại Script" : "✨ AI viết Script từ idea"}
        </button>
        {script && (
          <button
            className="ksp-btn ksp-btn-orange-ghost"
            onClick={() => handleGenerateScript(true)}
            disabled={generating}
            title="Generate variation, save current as version"
          >
            ↻ Variation
          </button>
        )}
        {script && (script.versions?.length ?? 0) > 0 && (
          <button
            className="ksp-btn ksp-btn-ghost"
            onClick={() => setShowVersions(!showVersions)}
          >
            📜 Versions ({script.versions?.length ?? 0})
          </button>
        )}
      </div>

      {/* Versions dropdown */}
      {showVersions && script && (
        <div className="ksp-script-versions">
          <div className="ksp-script-versions-title">Version history:</div>
          {(script.versions ?? []).slice().reverse().map((v) => (
            <div key={v.id} className="ksp-script-version-item">
              <span className="ksp-script-version-label">{v.label}</span>
              <span className="ksp-script-version-time">
                {new Date(v.timestamp).toLocaleString("vi")}
              </span>
              <button
                className="ksp-btn ksp-btn-sm ksp-btn-ghost"
                onClick={() => handleRevertVersion(v.id)}
              >
                Revert
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Script content */}
      {!script && !generating && (
        <div className="ksp-script-empty">
          <p>Chưa có Script. Nhập Idea + Cast → click "✨ AI viết Script từ idea" để bắt đầu.</p>
        </div>
      )}

      {script && (
        <div className="ksp-script-content">
          <ScriptHeader script={script} onUpdate={(p) => patch(actions.updateScriptField(migrated, p))} />

          <div className="ksp-script-scenes">
            {script.scenes.map((scene, i) => (
              <SceneCard
                key={scene.id}
                scene={scene}
                expanded={i === 0}
                onUpdate={(p) => patch(actions.updateScriptScene(migrated, scene.id, p))}
                onDelete={() => patch(actions.deleteScriptScene(migrated, scene.id))}
              />
            ))}
          </div>

          <div className="ksp-script-add-scene">
            <button
              className="ksp-btn ksp-btn-secondary"
              onClick={() => {
                const newScene: Omit<FilmSceneScript, "id" | "order"> = {
                  titleEn: `Scene ${script.scenes.length + 1}`,
                  settings: "INT. LOCATION - TIME",
                  durationSeconds: 60,
                  act: "rising",
                  actionLinesEn: "",
                  dialog: [],
                  sfx: [],
                  musicBrief: "",
                };
                patch(actions.addScriptScene(migrated, newScene));
              }}
            >
              + Add Scene
            </button>
          </div>
        </div>
      )}

      <div className="ksp-info-banner">
        💡 Script feed: <strong>Storyboard</strong> (action lines → frames) ·{" "}
        <strong>Voice AI</strong> (dialog) · <strong>Music AI</strong> (briefs) ·{" "}
        <strong>SFX list</strong>
      </div>
    </section>
  );
}

// ============================================================================
// SCRIPT HEADER (logline + synopsis)
// ============================================================================

function ScriptHeader({
  script,
  onUpdate,
}: {
  script: FilmScript;
  onUpdate: (patch: Partial<FilmScript>) => void;
}) {
  return (
    <div className="ksp-script-header">
      <Label text="Title (EN)">
        <input
          className="ksp-input"
          value={script.titleEn}
          onChange={(e) => onUpdate({ titleEn: e.target.value })}
        />
      </Label>
      <Label text="Title (VN)">
        <input
          className="ksp-input"
          value={script.titleVi}
          onChange={(e) => onUpdate({ titleVi: e.target.value })}
        />
      </Label>
      <Label text="Logline">
        <textarea
          className="ksp-input ksp-textarea"
          rows={2}
          value={script.logline}
          onChange={(e) => onUpdate({ logline: e.target.value })}
        />
      </Label>
      <Label text="Synopsis (EN)">
        <textarea
          className="ksp-input ksp-textarea"
          rows={3}
          value={script.synopsisEn}
          onChange={(e) => onUpdate({ synopsisEn: e.target.value })}
        />
      </Label>
    </div>
  );
}

// ============================================================================
// SCENE CARD (Mockup 2 - 7 fields)
// ============================================================================

function SceneCard({
  scene,
  expanded: defaultExpanded,
  onUpdate,
  onDelete,
}: {
  scene: FilmSceneScript;
  expanded: boolean;
  onUpdate: (patch: Partial<FilmSceneScript>) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <article className="ksp-scene-card">
      <header className="ksp-scene-card-header" onClick={() => setExpanded(!expanded)}>
        <span className="ksp-scene-expand-icon">{expanded ? "▼" : "▶"}</span>
        <div className="ksp-scene-title-block">
          <div className="ksp-scene-title">
            {scene.order + 1}. {scene.titleEn || "(untitled)"}
          </div>
          <div className="ksp-scene-meta">
            {scene.settings} · {scene.durationSeconds}s ·{" "}
            <span className={`ksp-scene-act ksp-scene-act-${scene.act}`}>{scene.act}</span>
          </div>
        </div>
        <ConfirmButton
          className="ksp-btn ksp-btn-sm ksp-btn-danger-ghost"
          onConfirm={onDelete}
          confirmText="Xóa scene?"
          title="Delete scene"
        >
          🗑
        </ConfirmButton>
      </header>

      {expanded && (
        <div className="ksp-scene-card-body">
          {/* 7 fields */}
          <Label text="Title">
            <input
              className="ksp-input"
              value={scene.titleEn}
              onChange={(e) => onUpdate({ titleEn: e.target.value })}
            />
          </Label>

          <div className="ksp-form-row ksp-form-row-3">
            <Label text="Settings (1)">
              <input
                className="ksp-input"
                value={scene.settings}
                onChange={(e) => onUpdate({ settings: e.target.value })}
                placeholder="INT./EXT. LOCATION - TIME"
              />
            </Label>
            <Label text="Duration (s)">
              <input
                type="number"
                className="ksp-input"
                value={scene.durationSeconds}
                onChange={(e) => onUpdate({ durationSeconds: parseInt(e.target.value) || 0 })}
                min={5}
              />
            </Label>
            <Label text="Act">
              <select
                className="ksp-select"
                value={scene.act}
                onChange={(e) => onUpdate({ act: e.target.value as FilmSceneScript["act"] })}
              >
                <option value="setup">Setup</option>
                <option value="inciting">Inciting incident</option>
                <option value="rising">Rising action</option>
                <option value="climax">Climax</option>
                <option value="resolution">Resolution</option>
              </select>
            </Label>
          </div>

          <Label text="Action lines (2) — visual description for AI">
            <textarea
              className="ksp-input ksp-textarea"
              rows={4}
              value={scene.actionLinesEn}
              onChange={(e) => onUpdate({ actionLinesEn: e.target.value })}
              placeholder="Concrete visual description: what camera sees..."
            />
          </Label>

          <DialogList
            dialogs={scene.dialog}
            onUpdate={(dialog) => onUpdate({ dialog })}
          />

          <Label text="SFX list (5)">
            <input
              className="ksp-input"
              value={scene.sfx.join(", ")}
              onChange={(e) =>
                onUpdate({
                  sfx: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="wind through trees, distant bird calls, metal creaking"
            />
          </Label>

          <Label text="Music brief (6) — Suno-ready prompt">
            <textarea
              className="ksp-input ksp-textarea"
              rows={2}
              value={scene.musicBrief}
              onChange={(e) => onUpdate({ musicBrief: e.target.value })}
              placeholder="Cinematic ambient drone at 50 BPM, synth pad + cello, slow crescendo, reference 'Hans Zimmer - Time'. 80s."
            />
          </Label>

          <Label text="Transition to next (7)">
            <input
              className="ksp-input"
              value={scene.transitionToNext ?? ""}
              onChange={(e) => onUpdate({ transitionToNext: e.target.value })}
              placeholder="Cut to | Match cut | Fade to black"
            />
          </Label>
        </div>
      )}
    </article>
  );
}

// ============================================================================
// DIALOG LIST (3 + 4: dialog + parentheticals)
// ============================================================================

function DialogList({
  dialogs,
  onUpdate,
}: {
  dialogs: ScriptDialog[];
  onUpdate: (dialog: ScriptDialog[]) => void;
}) {
  function addLine() {
    onUpdate([
      ...dialogs,
      { characterId: "", characterName: "", lineEn: "", lineVi: "", parenthetical: "" },
    ]);
  }

  function removeLine(idx: number) {
    onUpdate(dialogs.filter((_, i) => i !== idx));
  }

  function updateLine(idx: number, patch: Partial<ScriptDialog>) {
    onUpdate(dialogs.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  }

  return (
    <div className="ksp-form-group">
      <div className="ksp-form-group-header">
        <h4 className="ksp-form-group-title">Dialog (3 + 4 parentheticals)</h4>
        <button className="ksp-btn ksp-btn-sm ksp-btn-ghost" onClick={addLine}>
          + Add line
        </button>
      </div>

      {dialogs.length === 0 && (
        <div className="ksp-dialog-empty">
          No dialog. Phim visual-only? Skip — chỉ rely on action + music + SFX.
        </div>
      )}

      {dialogs.map((d, i) => (
        <div key={i} className="ksp-dialog-line">
          <input
            className="ksp-input ksp-dialog-character"
            value={d.characterName}
            onChange={(e) => updateLine(i, { characterName: e.target.value })}
            placeholder="Character name"
          />
          <input
            className="ksp-input ksp-dialog-parenthetical"
            value={d.parenthetical ?? ""}
            onChange={(e) => updateLine(i, { parenthetical: e.target.value })}
            placeholder="(emotion)"
          />
          <textarea
            className="ksp-input ksp-dialog-line-text"
            rows={2}
            value={d.lineEn}
            onChange={(e) => updateLine(i, { lineEn: e.target.value })}
            placeholder="Dialog line (EN)"
          />
          <button
            className="ksp-btn ksp-btn-sm ksp-btn-danger-ghost"
            onClick={() => removeLine(i)}
            title="Remove line"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function totalDurationMinutes(script: FilmScript): number {
  const totalSec = script.scenes.reduce((sum, s) => sum + s.durationSeconds, 0);
  return Math.round((totalSec / 60) * 10) / 10;
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="ksp-label">
      <span className="ksp-label-text">{text}</span>
      {children}
    </label>
  );
}
