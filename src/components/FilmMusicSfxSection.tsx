/**
 * KSP Image v0.9.3-r6 — Film Music + SFX Section (Mockup 5)
 *
 * Per-scene music briefs (Hans Zimmer "Time" style refs) + SFX list per scene
 * + project-level SFX provider toggle (Freesound / Epidemic Sound / Suno SFX).
 *
 * Hướng A confirmed:
 *   - Q1 Music Regen brief → stub toast (defer 0.9.4 wire AI)
 *   - Q3 Full score arc → auto-derived in Bundle Export (not editable here)
 *
 * Replaces deprecated MusicSfxSectionV09.tsx (atomic Q6).
 */

import React, { useEffect, useRef, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import {
  ensureFilmData,
  setSfxProvider,
  setSceneMusicBrief,
  setSceneSfx,
} from "../store/film_actions";
import {
  SFX_PROVIDER_LABELS,
  type FilmSfxProvider,
} from "../types/film";
import type { FilmSceneScript } from "../types/project";

export function FilmMusicSfxSection() {
  const project = useAppStore((s) => s.currentProject);
  const updateProject = useAppStore((s) => s.updateCurrentProject);
  const showToast = useAppStore((s) => s.showToast);
  // r7.6: default collapse on first mount. Editor handles toggle via header click.
  const sectionRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (sectionRef.current && !sectionRef.current.classList.contains("ksp-section-collapsed")) {
      sectionRef.current.classList.add("ksp-section-collapsed");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!project) return null;
  const film = ensureFilmData(project);
  const script = film.script;
  const sfxProvider: FilmSfxProvider = film.sfxProvider ?? "freesound";

  return (
    <section ref={sectionRef} className="ksp-section ksp-music-sfx-film">
      <header className="ksp-section-header">
        <span className="ksp-section-icon">🎵</span>
        <h2 className="ksp-section-title">7. MUSIC + SFX</h2>
        {script && (
          <span className="ksp-section-meta">
            {script.scenes.length} scenes
          </span>
        )}
      </header>

      <div className="ksp-music-sfx-film-body">
        {!script && (
          <div className="ksp-music-sfx-empty">
            <p>
              ⚠ Chưa có Script. Generate script ở section trên trước, music
              briefs + SFX list sẽ tự xuất hiện per scene.
            </p>
          </div>
        )}

        {script && (
          <>
            <div className="ksp-music-sfx-block">
              <h3 className="ksp-music-sfx-h3">🎼 Music briefs per-scene</h3>
              <p className="ksp-music-sfx-hint">
                Mỗi brief là 80-120 chars Suno-ready. Click Copy → paste vào
                Suno/Udio để generate music track.
              </p>
              {script.scenes.map((scene) => (
                <MusicBriefCard
                  key={scene.id}
                  scene={scene}
                  onUpdateBrief={(brief) =>
                    updateProject(setSceneMusicBrief(project, scene.id, brief))
                  }
                  onCopyBrief={() => {
                    navigator.clipboard?.writeText(scene.musicBrief ?? "");
                    showToast("Copied → paste vào Suno", "success");
                  }}
                  onRegenBrief={() =>
                    showToast(
                      "🔄 Regen music brief AI — defer Sprint 0.9.4 (Gemini Flash)",
                      "info"
                    )
                  }
                />
              ))}
              <div className="ksp-music-sfx-arc-note">
                ⓘ Full score arc (concat all briefs) auto-derived khi export bundle ZIP.
              </div>
            </div>

            <div className="ksp-music-sfx-block">
              <h3 className="ksp-music-sfx-h3">🔊 SFX list per-scene</h3>
              <div className="ksp-music-sfx-provider-row">
                <label className="ksp-voice-film-tiny-label">SFX Provider:</label>
                <select
                  className="ksp-select ksp-select-sm"
                  value={sfxProvider}
                  onChange={(e) =>
                    updateProject(setSfxProvider(project, e.target.value as FilmSfxProvider))
                  }
                >
                  {(Object.keys(SFX_PROVIDER_LABELS) as FilmSfxProvider[]).map((p) => (
                    <option key={p} value={p}>
                      {SFX_PROVIDER_LABELS[p].name} — {SFX_PROVIDER_LABELS[p].description}
                    </option>
                  ))}
                </select>
              </div>

              {script.scenes.map((scene) => (
                <SfxListCard
                  key={scene.id}
                  scene={scene}
                  provider={sfxProvider}
                  onUpdateSfx={(sfx) =>
                    updateProject(setSceneSfx(project, scene.id, sfx))
                  }
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// ============================================================================
// MUSIC BRIEF CARD (per scene)
// ============================================================================

function MusicBriefCard({
  scene,
  onUpdateBrief,
  onCopyBrief,
  onRegenBrief,
}: {
  scene: FilmSceneScript;
  onUpdateBrief: (brief: string) => void;
  onCopyBrief: () => void;
  onRegenBrief: () => void;
}) {
  const brief = scene.musicBrief ?? "";
  const charCount = brief.length;
  const idealMin = 80;
  const idealMax = 120;
  const isIdeal = charCount >= idealMin && charCount <= idealMax;

  return (
    <div className="ksp-music-brief-card">
      <div className="ksp-music-brief-header">
        <strong>Scene {scene.order}</strong>
        <span className="ksp-music-brief-scene-title">
          {scene.titleVi || scene.titleEn || ""}
        </span>
        <span className="ksp-music-brief-duration">
          {scene.durationSeconds}s
        </span>
      </div>
      <textarea
        className="ksp-input ksp-textarea ksp-music-brief-textarea"
        rows={3}
        value={brief}
        onChange={(e) => onUpdateBrief(e.target.value)}
        placeholder="Brief Suno-ready (80-120 chars). E.g. Ambient drone, Hans Zimmer 'Time' style, 50bpm, swelling strings..."
      />
      <div className="ksp-music-brief-meta">
        <span
          className={`ksp-music-brief-count ${isIdeal ? "ksp-music-brief-count-ideal" : ""}`}
        >
          {charCount} chars {isIdeal ? "✓ ideal" : `(target ${idealMin}-${idealMax})`}
        </span>
      </div>
      <div className="ksp-music-brief-actions">
        <button
          type="button"
          className="ksp-btn ksp-btn-sm ksp-btn-primary"
          onClick={onCopyBrief}
          disabled={!brief.trim()}
        >
          📋 Copy → Suno
        </button>
        <button
          type="button"
          className="ksp-btn ksp-btn-sm ksp-btn-ghost"
          onClick={onRegenBrief}
        >
          🔄 Regen
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// SFX LIST CARD (per scene)
// ============================================================================

function SfxListCard({
  scene,
  provider,
  onUpdateSfx,
}: {
  scene: FilmSceneScript;
  provider: FilmSfxProvider;
  onUpdateSfx: (sfx: string[]) => void;
}) {
  const [newCue, setNewCue] = useState("");
  const sfx = scene.sfx ?? [];

  function addCue() {
    if (!newCue.trim()) return;
    onUpdateSfx([...sfx, newCue.trim()]);
    setNewCue("");
  }

  function removeCue(idx: number) {
    onUpdateSfx(sfx.filter((_, i) => i !== idx));
  }

  function buildProviderLink(cue: string): string {
    const cleanCue = cue.replace(/[^\w\s]/g, "").trim();
    if (provider === "freesound") {
      return `https://freesound.org/search/?q=${encodeURIComponent(cleanCue)}`;
    }
    return ""; // epidemic + suno-sfx have no direct URL — handled in Bundle Export
  }

  return (
    <div className="ksp-sfx-card">
      <div className="ksp-sfx-card-header">
        <strong>Scene {scene.order}</strong>
        <span className="ksp-sfx-card-count">{sfx.length} cues</span>
      </div>
      {sfx.length === 0 && (
        <p className="ksp-sfx-empty">Chưa có SFX cue. Add manual hoặc generate khi viết script.</p>
      )}
      {sfx.map((cue, i) => {
        const link = buildProviderLink(cue);
        return (
          <div key={i} className="ksp-sfx-row">
            <span className="ksp-sfx-cue">• {cue}</span>
            {link && (
              <a
                href={link}
                target="_blank"
                rel="noreferrer"
                className="ksp-sfx-link"
                title="Open in Freesound.org"
              >
                🔗
              </a>
            )}
            <button
              type="button"
              className="ksp-btn ksp-btn-icon ksp-btn-ghost ksp-btn-tiny"
              onClick={() => removeCue(i)}
              title="Remove cue"
            >
              ×
            </button>
          </div>
        );
      })}
      <div className="ksp-sfx-add-row">
        <input
          type="text"
          className="ksp-input ksp-input-sm"
          value={newCue}
          onChange={(e) => setNewCue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCue();
            }
          }}
          placeholder="e.g. wind in forest, footsteps on gravel..."
        />
        <button
          type="button"
          className="ksp-btn ksp-btn-sm ksp-btn-ghost"
          onClick={addCue}
          disabled={!newCue.trim()}
        >
          + Add
        </button>
      </div>
    </div>
  );
}
