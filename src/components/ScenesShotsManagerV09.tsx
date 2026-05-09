/**
 * KSP Image v0.9.0 — Scenes & Shots Manager (Mockup 3)
 *
 * Hierarchy: Scenes → Shots, mỗi shot = 1 grid storyboard.
 * Used in Film mode (block 3. STORYBOARD).
 *
 * Features:
 * - Scene cards expandable, listing their shots
 * - Shot cards with status indicator (✓ rendered / ⚙ rendering / ○ pending)
 * - Add shot manually OR AI sinh từ Script
 * - Click shot → focus shot detail in right rail
 */

import React, { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { useGlobalStore } from "../store/useGlobalStore";
import { migrateProjectToV09 } from "../store/migration_v09";
import * as actions from "../store/v09_actions";
import { generateShotsForScene } from "../engine/aiRuntime";
import { ConfirmButton } from "./ConfirmButton";
import type {
  FilmShot,
  FilmSceneShot,
  FilmSceneScript,
  ProjectModeV2,
} from "../types/v0_9_0";

const SHOT_TYPES: { value: FilmShot["shotType"]; label: string; emoji: string }[] = [
  { value: "wide_establishing", label: "Wide establishing", emoji: "🌄" },
  { value: "medium", label: "Medium shot", emoji: "🎬" },
  { value: "close_up", label: "Close-up", emoji: "🔍" },
  { value: "insert", label: "Insert (macro)", emoji: "✨" },
  { value: "over_shoulder", label: "Over shoulder", emoji: "👤" },
  { value: "two_shot", label: "Two-shot", emoji: "👥" },
  { value: "pov", label: "POV", emoji: "👁" },
];

const GRID_FORMATS = ["2x2", "2x3", "3x2", "3x3", "4x3"] as const;

export function ScenesShotsManagerV09() {
  const project = useAppStore((s) => s.currentProject);
  const updateProject = useAppStore((s) => s.updateCurrentProject);
  const showToast = useAppStore((s) => s.showToast);
  const focusedShotId = useGlobalStore((s) => s.focusedShotId);
  const setFocusedShot = useGlobalStore((s) => s.setFocusedShot);
  const setFocusedStep = useGlobalStore((s) => s.setFocusedStep);

  if (!project) return null;
  const migrated = migrateProjectToV09(project);
  const mode = (migrated.settingV2?.mode ?? "photos") as ProjectModeV2;
  if (mode !== "film") return null;

  const script = migrated.script;
  const filmStructure = migrated.filmStructureV2;
  const setting = migrated.settingV2!;
  const cast = migrated.filmCharactersV2 ?? [];

  function patch(updates: Partial<typeof migrated>) {
    updateProject(updates as any);
  }

  if (!script || script.scenes.length === 0) {
    return (
      <section className="ksp-section ksp-storyboard-section" data-mode={mode}>
        <header className="ksp-section-header">
          <span className="ksp-section-icon">🎬</span>
          <h2 className="ksp-section-title">3. STORYBOARD</h2>
        </header>
        <div className="ksp-script-empty">
          <p>Cần Script trước. Hoàn thành Script ở Step 2 → quay lại đây để tạo Shots.</p>
        </div>
      </section>
    );
  }

  // Sync filmStructure scenes from script if not synced
  if (!filmStructure || filmStructure.scenes.length !== script.scenes.length) {
    const synced = actions.syncFilmStructureFromScript(migrated);
    if (synced.filmStructureV2) {
      patch(synced);
    }
  }

  const scenes = filmStructure?.scenes ?? [];
  const totalShots = scenes.reduce((sum, s) => sum + s.shots.length, 0);
  const totalFrames = scenes.reduce(
    (sum, s) =>
      sum +
      s.shots.reduce((acc, sh) => {
        const [r, c] = sh.gridFormat.split("x").map(Number);
        return acc + r * c;
      }, 0),
    0
  );

  return (
    <section className="ksp-section ksp-storyboard-section" data-mode={mode}>
      <header className="ksp-section-header">
        <span className="ksp-section-icon">🎬</span>
        <h2 className="ksp-section-title">3. STORYBOARD</h2>
        <span className="ksp-script-meta">
          {scenes.length} scenes · {totalShots} shots · {totalFrames} frames
        </span>
      </header>

      <div className="ksp-scenes-list">
        {scenes.map((sceneShot, i) => {
          const scriptScene = script.scenes.find((s) => s.id === sceneShot.id);
          if (!scriptScene) return null;
          return (
            <SceneShotsCard
              key={sceneShot.id}
              sceneShot={sceneShot}
              scriptScene={scriptScene}
              expanded={i === 0}
              cast={cast}
              animationStyle={setting.animationStyle ?? "live_action"}
              aspectRatio={setting.aspectRatio}
              focusedShotId={focusedShotId}
              onFocusShot={(shotId) => {
                setFocusedShot(shotId);
                setFocusedStep("storyboard");
              }}
              onAddShotManual={(shot) => patch(actions.addShotToScene(migrated, sceneShot.id, shot))}
              onUpdateShot={(shotId, p) => patch(actions.updateShot(migrated, shotId, p))}
              onDeleteShot={(shotId) => {
                patch(actions.deleteShot(migrated, shotId));
                if (focusedShotId === shotId) setFocusedShot(null);
              }}
              onAiGenerateShots={async () => {
                try {
                  showToast(`⚙ AI sinh shots cho Scene ${i + 1}...`, "info");
                  const shots = await generateShotsForScene(
                    scriptScene,
                    setting.animationStyle ?? "live_action",
                    setting.aspectRatio,
                    cast,
                    setting.aiProviders.storyboardFrames
                  );
                  patch(actions.addMultipleShotsToScene(migrated, sceneShot.id, shots));
                  showToast(`✓ Generated ${shots.length} shots`, "success");
                } catch (err: any) {
                  showToast(`Lỗi AI: ${err.message}`, "error");
                }
              }}
            />
          );
        })}
      </div>

      <div className="ksp-info-banner">
        💡 Click shot title → focus shot detail (Image Gen / Video AI tabs).
        AI sinh shots gợi ý camera + grid size phù hợp narrative beat của scene.
      </div>
    </section>
  );
}

// ============================================================================
// SCENE-SHOTS CARD (1 scene, list its shots)
// ============================================================================

function SceneShotsCard({
  sceneShot,
  scriptScene,
  expanded: defaultExpanded,
  cast,
  animationStyle,
  aspectRatio,
  focusedShotId,
  onFocusShot,
  onAddShotManual,
  onUpdateShot,
  onDeleteShot,
  onAiGenerateShots,
}: {
  sceneShot: FilmSceneShot;
  scriptScene: FilmSceneScript;
  expanded: boolean;
  cast: any[];
  animationStyle: string;
  aspectRatio: string;
  focusedShotId: string | null;
  onFocusShot: (id: string) => void;
  onAddShotManual: (shot: Omit<FilmShot, "id" | "order">) => void;
  onUpdateShot: (id: string, patch: Partial<FilmShot>) => void;
  onDeleteShot: (id: string) => void;
  onAiGenerateShots: () => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [aiBusy, setAiBusy] = useState(false);

  const handleAi = async () => {
    setAiBusy(true);
    await onAiGenerateShots();
    setAiBusy(false);
  };

  const handleAddManual = () => {
    onAddShotManual({
      titleEn: `Shot ${sceneShot.shots.length + 1}`,
      shotType: "medium",
      durationSeconds: 6,
      gridFormat: "3x3",
      cameraMovement: "auto_per_genre",
      status: "draft",
    });
  };

  return (
    <article className="ksp-scene-shots-card">
      <header className="ksp-scene-shots-header" onClick={() => setExpanded(!expanded)}>
        <span className="ksp-scene-expand-icon">{expanded ? "▼" : "▶"}</span>
        <div className="ksp-scene-title-block">
          <div className="ksp-scene-title">
            Scene {scriptScene.order + 1}: {scriptScene.titleEn}
          </div>
          <div className="ksp-scene-meta">
            {scriptScene.durationSeconds}s ·{" "}
            <span className={`ksp-scene-act ksp-scene-act-${scriptScene.act}`}>
              {scriptScene.act}
            </span>{" "}
            · {sceneShot.shots.length} shots
          </div>
        </div>
        <button
          className="ksp-btn ksp-btn-sm ksp-btn-orange-ghost"
          onClick={(e) => {
            e.stopPropagation();
            handleAi();
          }}
          disabled={aiBusy}
        >
          {aiBusy ? "⚙" : "✨"} AI sinh shots
        </button>
      </header>

      {expanded && (
        <div className="ksp-scene-shots-body">
          {sceneShot.shots.length === 0 && (
            <div className="ksp-shots-empty">
              Chưa có shot. Click "✨ AI sinh shots" để tự động chia scene thành shots.
            </div>
          )}

          {sceneShot.shots.map((shot) => (
            <ShotCard
              key={shot.id}
              shot={shot}
              isFocused={focusedShotId === shot.id}
              onFocus={() => onFocusShot(shot.id)}
              onUpdate={(p) => onUpdateShot(shot.id, p)}
              onDelete={() => onDeleteShot(shot.id)}
            />
          ))}

          <div className="ksp-shots-actions">
            <button className="ksp-btn ksp-btn-sm ksp-btn-secondary" onClick={handleAddManual}>
              + Add Shot manually
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

// ============================================================================
// SHOT CARD (Mockup 3 inner card)
// ============================================================================

function ShotCard({
  shot,
  isFocused,
  onFocus,
  onUpdate,
  onDelete,
}: {
  shot: FilmShot;
  isFocused: boolean;
  onFocus: () => void;
  onUpdate: (patch: Partial<FilmShot>) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const shotType = SHOT_TYPES.find((t) => t.value === shot.shotType);

  const statusEmoji = {
    draft: "○",
    frames_ready: "◔",
    prompt_ready: "◑",
    rendered: "✓",
    animated: "✓✓",
  }[shot.status];

  const statusLabel = {
    draft: "draft",
    frames_ready: "frames",
    prompt_ready: "prompt",
    rendered: "rendered",
    animated: "animated",
  }[shot.status];

  const statusClass = {
    draft: "ksp-status-pending",
    frames_ready: "ksp-status-in_progress",
    prompt_ready: "ksp-status-in_progress",
    rendered: "ksp-status-done",
    animated: "ksp-status-done",
  }[shot.status];

  return (
    <div
      className={`ksp-shot-card ${isFocused ? "ksp-shot-card-focused" : ""}`}
      onClick={onFocus}
    >
      <div className="ksp-shot-card-row">
        <span className="ksp-shot-emoji">{shotType?.emoji}</span>
        {!editing ? (
          <div className="ksp-shot-card-info" onDoubleClick={() => setEditing(true)}>
            <div className="ksp-shot-card-title">{shot.titleEn}</div>
            <div className="ksp-shot-card-meta">
              {shot.gridFormat} grid · {parseFrames(shot.gridFormat)} frames ·{" "}
              {shot.durationSeconds}s · {shot.cameraMovement.replace(/_/g, " ")}
            </div>
          </div>
        ) : (
          <div className="ksp-shot-card-edit">
            <input
              className="ksp-input"
              value={shot.titleEn}
              onChange={(e) => onUpdate({ titleEn: e.target.value })}
              onBlur={() => setEditing(false)}
              autoFocus
            />
          </div>
        )}
        <span className={`ksp-shot-status ${statusClass}`}>
          {statusEmoji} {statusLabel}
        </span>
        <ConfirmButton
          className="ksp-btn ksp-btn-xs ksp-btn-danger-ghost"
          onConfirm={onDelete}
          confirmText="Xóa?"
          title="Delete shot"
        >
          🗑
        </ConfirmButton>
      </div>

      {isFocused && (
        <div className="ksp-shot-card-quick-edit">
          <div className="ksp-form-row ksp-form-row-3">
            <select
              className="ksp-select"
              value={shot.shotType}
              onChange={(e) => onUpdate({ shotType: e.target.value as FilmShot["shotType"] })}
              onClick={(e) => e.stopPropagation()}
            >
              {SHOT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.emoji} {t.label}
                </option>
              ))}
            </select>
            <select
              className="ksp-select"
              value={shot.gridFormat}
              onChange={(e) => onUpdate({ gridFormat: e.target.value as FilmShot["gridFormat"] })}
              onClick={(e) => e.stopPropagation()}
            >
              {GRID_FORMATS.map((g) => (
                <option key={g} value={g}>
                  {g} grid ({parseFrames(g)} frames)
                </option>
              ))}
            </select>
            <input
              type="number"
              className="ksp-input"
              value={shot.durationSeconds}
              onChange={(e) => onUpdate({ durationSeconds: parseInt(e.target.value) || 0 })}
              onClick={(e) => e.stopPropagation()}
              placeholder="Duration (s)"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function parseFrames(gridFormat: string): number {
  const [r, c] = gridFormat.split("x").map(Number);
  return r * c;
}
