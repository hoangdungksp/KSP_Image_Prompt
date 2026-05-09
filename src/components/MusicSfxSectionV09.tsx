/**
 * KSP Image v0.9.0 — Music + SFX Section (Step 7)
 *
 * Per-scene music briefs (Suno/Udio-ready prompts).
 * Per-scene SFX list (specific cues).
 * AI generate music brief from scene context.
 * Optional Suno API integration (when key provided).
 *
 * Phase 4 ships UI + AI generation. Suno API integration deferred.
 */

import React, { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { migrateProjectToV09 } from "../store/migration_v09";
import { generateMusicBrief } from "../engine/aiRuntime";
import type {
  ProjectModeV2,
  MusicSfxSection,
  SceneMusicBrief,
  SceneSfx,
} from "../types/v0_9_0";

export function MusicSfxSectionV09() {
  const project = useAppStore((s) => s.currentProject);
  const updateProject = useAppStore((s) => s.updateCurrentProject);
  const showToast = useAppStore((s) => s.showToast);

  if (!project) return null;
  const migrated = migrateProjectToV09(project);
  const mode = (migrated.settingV2?.mode ?? "photos") as ProjectModeV2;
  if (mode !== "film" && mode !== "tvc_commercial") return null;

  const script = migrated.script;
  const setting = migrated.settingV2!;
  const aiProvider = setting.aiProviders.scriptWriter; // Reuse for music too
  const musicSfx = migrated.musicSfx;

  // Auto-init from script scenes
  const scenes = script?.scenes ?? [];

  function patch(updates: Partial<typeof migrated>) {
    updateProject(updates as any);
  }

  function setMusicSfx(ms: MusicSfxSection) {
    patch({ musicSfx: ms });
  }

  function ensureSection(): MusicSfxSection {
    return (
      musicSfx ?? {
        perSceneMusic: scenes.map((s) => ({
          sceneId: s.id,
          brief: s.musicBrief ?? "",
          durationSeconds: s.durationSeconds,
          mood: [],
        })),
        sfxByScene: scenes.map((s) => ({
          sceneId: s.id,
          sfx: s.sfx ?? [],
        })),
        sfxProvider: "freesound",
      }
    );
  }

  async function regenerateMusicBrief(sceneId: string) {
    const scene = script?.scenes.find((s) => s.id === sceneId);
    if (!scene) return;
    try {
      showToast("⚙ Generating music brief...", "info");
      const brief = await generateMusicBrief(
        scene,
        setting.genre ?? "drama",
        aiProvider
      );
      const current = ensureSection();
      const updated: MusicSfxSection = {
        ...current,
        perSceneMusic: current.perSceneMusic.map((m) =>
          m.sceneId === sceneId ? { ...m, brief } : m
        ),
      };
      setMusicSfx(updated);
      showToast(`✓ Music brief regenerated`, "success");
    } catch (err: any) {
      showToast(`Lỗi AI: ${err.message}`, "error");
    }
  }

  const section = ensureSection();

  if (scenes.length === 0) {
    return (
      <section className="ksp-section ksp-music-section">
        <header className="ksp-section-header">
          <span className="ksp-section-icon">🎵</span>
          <h2 className="ksp-section-title">7. MUSIC + SFX</h2>
        </header>
        <div className="ksp-script-empty">
          <p>Cần Script trước. Music + SFX briefs được generate từ scenes của Script.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="ksp-section ksp-music-section">
      <header className="ksp-section-header">
        <span className="ksp-section-icon">🎵</span>
        <h2 className="ksp-section-title">7. MUSIC + SFX</h2>
        <span className="ksp-script-meta">
          {scenes.length} scenes · per-scene briefs
        </span>
      </header>

      <div className="ksp-music-content">
        {scenes.map((scene, i) => {
          const musicEntry = section.perSceneMusic.find((m) => m.sceneId === scene.id);
          const sfxEntry = section.sfxByScene.find((m) => m.sceneId === scene.id);

          return (
            <div key={scene.id} className="ksp-scene-music-card">
              <div className="ksp-scene-music-header">
                <span className="ksp-scene-music-num">Scene {i + 1}</span>
                <span className="ksp-scene-music-title">{scene.titleEn}</span>
                <span className="ksp-scene-music-duration">{scene.durationSeconds}s</span>
              </div>

              <Label text="🎵 Music brief (Suno-ready)">
                <textarea
                  className="ksp-input ksp-textarea"
                  rows={2}
                  value={musicEntry?.brief ?? ""}
                  onChange={(e) => {
                    const updated: MusicSfxSection = {
                      ...section,
                      perSceneMusic: section.perSceneMusic.map((m) =>
                        m.sceneId === scene.id ? { ...m, brief: e.target.value } : m
                      ),
                    };
                    setMusicSfx(updated);
                  }}
                  placeholder="Cinematic ambient drone at 50 BPM, synth pad + cello..."
                />
              </Label>
              <div className="ksp-form-row">
                <button
                  className="ksp-btn ksp-btn-sm ksp-btn-orange-ghost"
                  onClick={() => regenerateMusicBrief(scene.id)}
                >
                  ✨ AI regen brief
                </button>
                <button
                  className="ksp-btn ksp-btn-sm ksp-btn-secondary"
                  onClick={() => {
                    if (musicEntry?.brief) {
                      navigator.clipboard.writeText(musicEntry.brief);
                      showToast("✓ Copied to clipboard. Paste in Suno.", "success");
                    }
                  }}
                >
                  📋 Copy → Suno
                </button>
              </div>

              <Label text="🔊 SFX list (comma separated)">
                <input
                  className="ksp-input"
                  value={(sfxEntry?.sfx ?? []).join(", ")}
                  onChange={(e) => {
                    const sfxList = e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    const updated: MusicSfxSection = {
                      ...section,
                      sfxByScene: section.sfxByScene.map((m) =>
                        m.sceneId === scene.id ? { ...m, sfx: sfxList } : m
                      ),
                    };
                    setMusicSfx(updated);
                  }}
                  placeholder="wind through trees, distant bird calls, metal creaking"
                />
              </Label>
            </div>
          );
        })}

        <div className="ksp-form-row">
          <Label text="SFX source">
            <select
              className="ksp-select"
              value={section.sfxProvider}
              onChange={(e) =>
                setMusicSfx({ ...section, sfxProvider: e.target.value as any })
              }
            >
              <option value="freesound">Freesound.org links</option>
              <option value="epidemic_sound">Epidemic Sound</option>
              <option value="suno_sfx">Suno SFX prompts</option>
              <option value="manual">Manual sourcing</option>
            </select>
          </Label>
        </div>
      </div>
    </section>
  );
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="ksp-label">
      <span className="ksp-label-text">{text}</span>
      {children}
    </label>
  );
}
