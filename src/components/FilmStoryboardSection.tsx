/**
 * KSP Image v0.9.3-r4 — Film Storyboard Section (Mockup 3 implementation)
 *
 * Scenes × Shots hierarchy.
 * Each scene from Script.scenes has its own shots[] (manual hoặc AI sinh).
 * Each shot has grid size (2x2/2x3/3x2/3x3/4x3) + status badge (rendered/rendering/pending/locked).
 *
 * Click shot → open drill-down (Mockup 4 ShotDetailPanel, defer r5).
 *
 * Replaces deprecated ScenesShotsManagerV09.tsx (atomic Q6).
 */

import React, { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import {
  ensureFilmData,
  getShotsForScene,
  addShot,
  removeShot,
  updateShot,
  toggleShotLocked,
} from "../store/film_actions";
import type { FilmShot, FilmSceneScript } from "../types/v0_9_0";

const GRID_FORMATS: { value: FilmShot["gridFormat"]; label: string; frames: number }[] = [
  { value: "2x2", label: "2×2", frames: 4 },
  { value: "2x3", label: "2×3", frames: 6 },
  { value: "3x2", label: "3×2", frames: 6 },
  { value: "3x3", label: "3×3", frames: 9 },
  { value: "4x3", label: "4×3", frames: 12 },
];

const SHOT_TYPES: { value: FilmShot["shotType"]; label: string }[] = [
  { value: "wide_establishing", label: "Wide / Establishing" },
  { value: "medium", label: "Medium" },
  { value: "close_up", label: "Close-up" },
  { value: "insert", label: "Insert" },
  { value: "over_shoulder", label: "Over shoulder" },
  { value: "two_shot", label: "Two-shot" },
  { value: "pov", label: "POV" },
];

// ============================================================================
// MAIN SECTION
// ============================================================================

export function FilmStoryboardSection() {
  const project = useAppStore((s) => s.currentProject);
  const updateProject = useAppStore((s) => s.updateCurrentProject);
  const showToast = useAppStore((s) => s.showToast);

  if (!project) return null;
  const film = ensureFilmData(project);
  const script = film.script;

  const totalShots = script?.scenes
    ? script.scenes.reduce(
        (sum, sc) => sum + (film.shotsBySceneId?.[sc.id]?.length ?? 0),
        0
      )
    : 0;

  const totalFrames = script?.scenes
    ? script.scenes.reduce((sum, sc) => {
        const shots = film.shotsBySceneId?.[sc.id] ?? [];
        return (
          sum +
          shots.reduce((s, shot) => {
            const fmt = GRID_FORMATS.find((g) => g.value === shot.gridFormat);
            return s + (fmt?.frames ?? 9);
          }, 0)
        );
      }, 0)
    : 0;

  return (
    <section className="ksp-section ksp-storyboard-film">
      <header className="ksp-section-header">
        <span className="ksp-section-icon">🎬</span>
        <h2 className="ksp-section-title">3. STORYBOARD</h2>
        {script && (
          <span className="ksp-section-meta">
            {totalShots} shots · {totalFrames} frames
          </span>
        )}
      </header>

      {!script && (
        <div className="ksp-storyboard-film-empty">
          <p>
            ⚠ Chưa có Script. Hãy generate Script ở section trên trước, rồi quay
            lại đây để add shots cho từng scene.
          </p>
        </div>
      )}

      {script &&
        script.scenes.map((scene) => (
          <SceneStoryboardCard
            key={scene.id}
            scene={scene}
            shots={getShotsForScene(project, scene.id)}
            onAddShot={(override) =>
              updateProject(addShot(project, scene.id, override))
            }
            onUpdateShot={(shotId, updates) =>
              updateProject(updateShot(project, scene.id, shotId, updates))
            }
            onRemoveShot={(shotId) =>
              updateProject(removeShot(project, scene.id, shotId))
            }
            onToggleLock={(shotId) =>
              updateProject(toggleShotLocked(project, scene.id, shotId))
            }
            onAIGenerateShots={() => {
              showToast(
                "AI sinh shots cho scene — sẽ wire ở Sprint 0.9.4 (Gemini Flash)",
                "info"
              );
            }}
          />
        ))}

      <div className="ksp-storyboard-film-footer">
        <span style={{ fontSize: 10, color: "#888", fontStyle: "italic" }}>
          ⓘ Grid size khác nhau per shot: 2×2 insert · 3×3 default · 4×3 action
        </span>
      </div>
    </section>
  );
}

// ============================================================================
// SCENE CARD — chứa shots
// ============================================================================

interface SceneStoryboardCardProps {
  scene: FilmSceneScript;
  shots: FilmShot[];
  onAddShot: (override?: Partial<FilmShot>) => void;
  onUpdateShot: (shotId: string, updates: Partial<FilmShot>) => void;
  onRemoveShot: (shotId: string) => void;
  onToggleLock: (shotId: string) => void;
  onAIGenerateShots: () => void;
}

function SceneStoryboardCard({
  scene,
  shots,
  onAddShot,
  onUpdateShot,
  onRemoveShot,
  onToggleLock,
  onAIGenerateShots,
}: SceneStoryboardCardProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="ksp-storyboard-scene">
      <div
        className="ksp-storyboard-scene-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="ksp-storyboard-arrow">{expanded ? "▼" : "▶"}</span>
        <strong>Scene {scene.order}</strong>
        <span className="ksp-storyboard-scene-title">
          {scene.titleVi || scene.titleEn}
        </span>
        <span className="ksp-storyboard-scene-meta">
          {shots.length} shots
        </span>
      </div>

      {expanded && (
        <div className="ksp-storyboard-scene-body">
          {shots.length === 0 && (
            <p className="ksp-storyboard-empty-row">
              Chưa có shot nào. Add manual hoặc AI sinh shots cho scene này.
            </p>
          )}

          {shots.map((shot) => (
            <ShotRow
              key={shot.id}
              shot={shot}
              onUpdate={(updates) => onUpdateShot(shot.id, updates)}
              onRemove={() => {
                if (confirm(`Xóa shot ${shot.order}?`)) onRemoveShot(shot.id);
              }}
              onToggleLock={() => onToggleLock(shot.id)}
            />
          ))}

          <div className="ksp-storyboard-scene-actions">
            <button
              type="button"
              className="ksp-btn ksp-btn-sm ksp-btn-ghost"
              onClick={() => onAddShot()}
            >
              + Add Shot
            </button>
            <button
              type="button"
              className="ksp-btn ksp-btn-sm ksp-storyboard-ai-btn"
              onClick={onAIGenerateShots}
            >
              ✨ AI sinh shots
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SHOT ROW — title + grid format + status badge
// ============================================================================

interface ShotRowProps {
  shot: FilmShot;
  onUpdate: (updates: Partial<FilmShot>) => void;
  onRemove: () => void;
  onToggleLock: () => void;
}

function ShotRow({ shot, onUpdate, onRemove, onToggleLock }: ShotRowProps) {
  const fmt = GRID_FORMATS.find((g) => g.value === shot.gridFormat);
  const frames = fmt?.frames ?? 9;

  return (
    <div className="ksp-storyboard-shot">
      <div className="ksp-storyboard-shot-row">
        <input
          type="text"
          className="ksp-input ksp-input-sm ksp-storyboard-shot-title"
          value={shot.titleVi || shot.titleEn}
          onChange={(e) => onUpdate({ titleVi: e.target.value })}
          placeholder={`Shot ${shot.order}`}
        />
        <StatusBadge status={shot.status} locked={shot.locked} />
      </div>

      <div className="ksp-storyboard-shot-row" style={{ marginTop: 6 }}>
        <select
          className="ksp-select ksp-select-sm"
          value={shot.gridFormat}
          onChange={(e) =>
            onUpdate({ gridFormat: e.target.value as FilmShot["gridFormat"] })
          }
        >
          {GRID_FORMATS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label} ({g.frames} frames)
            </option>
          ))}
        </select>
        <select
          className="ksp-select ksp-select-sm"
          value={shot.shotType}
          onChange={(e) =>
            onUpdate({ shotType: e.target.value as FilmShot["shotType"] })
          }
        >
          {SHOT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="ksp-storyboard-shot-actions">
        <span className="ksp-storyboard-shot-meta">
          {fmt?.label} · {frames} frames · {shot.durationSeconds}s
        </span>
        <button
          type="button"
          className="ksp-btn ksp-btn-icon ksp-btn-ghost"
          onClick={onToggleLock}
          title={shot.locked ? "Unlock" : "Lock"}
        >
          {shot.locked ? "🔒" : "🔓"}
        </button>
        <button
          type="button"
          className="ksp-btn ksp-btn-icon ksp-btn-ghost"
          onClick={onRemove}
          title="Remove shot"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// STATUS BADGE (4 states per Mockup 3 spec)
// ============================================================================

function StatusBadge({
  status,
  locked,
}: {
  status: FilmShot["status"];
  locked?: boolean;
}) {
  if (locked) {
    return <span className="ksp-status-badge ksp-status-locked">🔒 locked</span>;
  }
  if (status === "rendered" || status === "animated") {
    return <span className="ksp-status-badge ksp-status-rendered">✓ rendered</span>;
  }
  if (status === "frames_ready" || status === "prompt_ready") {
    return <span className="ksp-status-badge ksp-status-rendering">⚙ rendering</span>;
  }
  return <span className="ksp-status-badge ksp-status-pending">○ pending</span>;
}
