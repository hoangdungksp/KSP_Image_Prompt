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
  setScriptProvider,
  addEmptyScene,
  removeScene,
  updateSceneInScript,
} from "../store/film_actions";
import { runStage5Quick, type FilmScriptProvider } from "../engine/filmScriptStages";
import type { FilmScript, FilmSceneScript } from "../types/v0_9_0";

// ============================================================================
// MAIN SECTION
// ============================================================================

export function FilmIdeaScriptSection() {
  const project = useAppStore((s) => s.currentProject);
  const updateProject = useAppStore((s) => s.updateCurrentProject);
  const showToast = useAppStore((s) => s.showToast);

  if (!project) return null;
  const film = ensureFilmData(project);
  const setting = (project as any).settingV2 as import("../types/v0_9_0").ProjectSettingV2 | undefined;
  const idea = project.idea?.raw ?? "";

  const [isGenerating, setIsGenerating] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);

  const provider: FilmScriptProvider = film.scriptProvider ?? "gemini-flash";

  async function handleGenerateScript() {
    if (!project) return;
    if (!setting) {
      showToast("Project setting missing — vui lòng load lại project", "error");
      return;
    }
    if (!idea.trim()) {
      showToast("Hãy nhập Idea trước khi tạo Script", "info");
      return;
    }
    if (film.characters.length === 0) {
      showToast("Hãy add ít nhất 1 character vào Cast trước", "info");
      return;
    }

    setIsGenerating(true);
    try {
      const newScript = await runStage5Quick({
        idea,
        setting,
        characters: film.characters,
        provider,
      });
      updateProject(setScript(project, newScript));
      showToast(
        `Đã tạo script ${newScript.scenes.length} scenes (${provider})`,
        "success"
      );
    } catch (err) {
      const msg = (err as Error).message ?? "Unknown error";
      showToast(`Tạo script failed: ${msg}`, "error");
    } finally {
      setIsGenerating(false);
    }
  }

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

      {/* SCRIPT SECTION (Mockup 2 — orange border) */}
      <section className="ksp-section ksp-script-film">
        <header className="ksp-section-header">
          <span className="ksp-section-icon">📜</span>
          <h2 className="ksp-section-title">2. SCRIPT (Kịch bản)</h2>
          {film.script && (
            <span className="ksp-section-meta">
              {film.script.scenes.length} scenes · ~{setting?.durationMinutes ?? "?"} phút
            </span>
          )}
        </header>

        {/* 5-stage breadcrumb stub (r3 placeholder, full wizard ở r7) */}
        <div className="ksp-script-film-breadcrumb">
          <div className="ksp-script-film-breadcrumb-label">5-STAGE BREADCRUMB <span style={{ color: "#888" }}>(r7)</span></div>
          <div className="ksp-script-film-breadcrumb-pills">
            <span className="ksp-stage-pill ksp-stage-pending" title="Defer r7">① Structure</span>
            <span className="ksp-stage-pill ksp-stage-pending" title="Defer r7">② Beats</span>
            <span className="ksp-stage-pill ksp-stage-pending" title="Defer r7">③ Twists</span>
            <span className="ksp-stage-pill ksp-stage-pending" title="Defer r7">④ Scenes</span>
            <span className="ksp-stage-pill ksp-stage-active">⑤ Dialogues ●</span>
          </div>
          <div className="ksp-script-film-breadcrumb-status">
            {film.script
              ? `${film.script.scenes.length} scenes generated`
              : "r3 — Stage 5 quick path active. r7 sẽ add wizard Structure→Beats→Twists→Scenes."}
          </div>
        </div>

        {/* Provider toggle 50/50 split, no label */}
        <div className="ksp-segmented ksp-script-film-provider">
          <button
            type="button"
            className={`ksp-segmented-btn ${provider === "gemini-flash" ? "active" : ""}`}
            onClick={() => updateProject(setScriptProvider(project, "gemini-flash"))}
          >
            ✦ Gemini Flash
          </button>
          <button
            type="button"
            className={`ksp-segmented-btn ${provider === "openai-4o" ? "active" : ""}`}
            onClick={() => updateProject(setScriptProvider(project, "openai-4o"))}
          >
            ◯ OpenAI 4o
          </button>
        </div>

        {/* Primary action: generate — orange filled */}
        <div className="ksp-script-film-actions">
          <button
            type="button"
            className="ksp-btn ksp-script-film-generate-btn"
            disabled={isGenerating || !idea.trim() || film.characters.length === 0}
            onClick={handleGenerateScript}
          >
            {isGenerating ? "⏳ Đang viết script..." : film.script ? "✨ Variation (regen)" : "✨ AI viết Script từ idea"}
          </button>

          {film.script && (
            <>
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
              >
                📥 Export
              </button>
            </>
          )}
        </div>

        {/* Versions panel */}
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

        {/* Script content */}
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
