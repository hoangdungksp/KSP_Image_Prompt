/**
 * KSP Image v0.9.3-r6 — Film Voice Section (Mockup 5)
 *
 * Context-aware logic based on Project Setting `dialog`:
 *   - "no_dialog" → "Skip / Add Narrator" buttons (both stubs Hướng A)
 *   - "has_dialog" → per-character voice list with line preview + voice provider assign
 *
 * Voice provider toggle (global default): ElevenLabs vs Google TTS
 * Per-character override: stored in filmV093.voiceAssignments
 *
 * API wires (Generate Audio) defer Sprint 0.9.4.
 * Replaces deprecated VoiceSectionV09.tsx (atomic Q6).
 */

import React, { useEffect, useRef } from "react";
import { useAppStore } from "../store/useAppStore";
import {
  ensureFilmData,
  setVoiceAssignment,
  clearVoiceAssignment,
  setVoiceProviderGlobal,
} from "../store/film_actions";
import {
  VOICE_PROVIDER_LABELS,
  type FilmVoiceProvider,
} from "../types/film";
import type { ScriptDialog, FilmSceneScript } from "../types/project";

export function FilmVoiceSection() {
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
  const setting = (project as any).settingV2;
  const dialogMode = setting?.dialog ?? "no_dialog";
  const script = film.script;
  const globalProvider: FilmVoiceProvider = film.voiceProviderGlobal ?? "elevenlabs";

  return (
    <section ref={sectionRef} className="ksp-section ksp-voice-film">
      <header className="ksp-section-header">
        <span className="ksp-section-icon">🎙</span>
        <h2 className="ksp-section-title">6. VOICE AI</h2>
        <span className="ksp-section-meta">
          {dialogMode === "has_dialog" ? "Có thoại" : "Không thoại"}
        </span>
      </header>

      <div className="ksp-voice-film-body">
        {/* Global provider toggle (always shown — applies to dialog mode + future narrator) */}
        <div className="ksp-voice-film-global">
          <label className="ksp-voice-film-label">Voice provider (default)</label>
          <div className="ksp-voice-film-provider-toggle">
            {(["elevenlabs", "google-tts"] as FilmVoiceProvider[]).map((p) => (
              <button
                key={p}
                type="button"
                className={`ksp-voice-film-provider-btn ${globalProvider === p ? "ksp-voice-film-provider-btn-active" : ""}`}
                onClick={() => updateProject(setVoiceProviderGlobal(project, p))}
              >
                <strong>{VOICE_PROVIDER_LABELS[p].name}</strong>
                <span className="ksp-voice-film-provider-pricing">
                  {VOICE_PROVIDER_LABELS[p].pricing}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Context-aware body */}
        {dialogMode === "no_dialog" && (
          <NoDialogPanel
            onSkip={() => showToast("Voice skipped — bundle export sẽ rỗng folder voice/", "info")}
            onAddNarrator={() =>
              showToast("Add Narrator — defer Sprint 0.9.4 (sẽ add character + ElevenLabs poetic preset)", "info")
            }
          />
        )}

        {dialogMode === "has_dialog" && !script && (
          <div className="ksp-voice-film-empty">
            <p>
              ⚠ Chưa có Script. Generate script ở section trên (Idea + Script) trước, dialog
              lines sẽ tự xuất hiện ở đây.
            </p>
          </div>
        )}

        {dialogMode === "has_dialog" && script && (
          <HasDialogPanel
            scenes={script.scenes}
            characters={film.characters}
            voiceAssignments={film.voiceAssignments ?? {}}
            globalProvider={globalProvider}
            onAssignVoice={(charId, provider) =>
              updateProject(setVoiceAssignment(project, charId, provider))
            }
            onClearAssignment={(charId) =>
              updateProject(clearVoiceAssignment(project, charId))
            }
            onGenerateAudio={() =>
              showToast("Generate audio — ElevenLabs/Google TTS wire defer Sprint 0.9.4", "info")
            }
          />
        )}

        <div className="ksp-voice-film-footer-note">
          ⓘ API wires (Generate Audio) defer Sprint 0.9.4 — r6 chỉ build UI hoàn chỉnh.
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// NO DIALOG PANEL
// ============================================================================

function NoDialogPanel({
  onSkip,
  onAddNarrator,
}: {
  onSkip: () => void;
  onAddNarrator: () => void;
}) {
  return (
    <div className="ksp-voice-film-no-dialog">
      <p className="ksp-voice-film-message">
        Phim này không có dialog. Anh có thể bỏ qua Voice section hoặc thêm
        Narrator (giọng kể chuyện) để voice-over kể chuyện trên action.
      </p>
      <div className="ksp-voice-film-actions">
        <button
          type="button"
          className="ksp-btn ksp-btn-sm ksp-btn-primary"
          onClick={onSkip}
        >
          Skip Voice
        </button>
        <button
          type="button"
          className="ksp-btn ksp-btn-sm ksp-btn-ghost"
          onClick={onAddNarrator}
        >
          + Add Narrator
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// HAS DIALOG PANEL
// ============================================================================

function HasDialogPanel({
  scenes,
  characters,
  voiceAssignments,
  globalProvider,
  onAssignVoice,
  onClearAssignment,
  onGenerateAudio,
}: {
  scenes: FilmSceneScript[];
  characters: Array<{ id: string; name: string; role: string }>;
  voiceAssignments: Record<string, FilmVoiceProvider | null>;
  globalProvider: FilmVoiceProvider;
  onAssignVoice: (charId: string, provider: FilmVoiceProvider) => void;
  onClearAssignment: (charId: string) => void;
  onGenerateAudio: () => void;
}) {
  // Aggregate dialog lines per character
  const linesByChar: Record<string, { name: string; lines: ScriptDialog[] }> = {};
  for (const scene of scenes) {
    for (const d of scene.dialog ?? []) {
      if (!linesByChar[d.characterId]) {
        linesByChar[d.characterId] = { name: d.characterName, lines: [] };
      }
      linesByChar[d.characterId].lines.push(d);
    }
  }
  const charIds = Object.keys(linesByChar);

  if (charIds.length === 0) {
    return (
      <div className="ksp-voice-film-empty">
        <p>
          Script chưa có dialog nào. Add dialog vào scenes trong Script section
          trước, rồi quay lại đây để assign voice provider per-character.
        </p>
      </div>
    );
  }

  const totalLines = charIds.reduce((sum, id) => sum + linesByChar[id].lines.length, 0);

  return (
    <div className="ksp-voice-film-has-dialog">
      <div className="ksp-voice-film-summary">
        {charIds.length} characters với dialog · {totalLines} lines total
      </div>

      {charIds.map((charId) => {
        const { name, lines } = linesByChar[charId];
        const assignment = voiceAssignments[charId];
        const effectiveProvider =
          assignment === null
            ? "skipped"
            : (assignment ?? globalProvider);

        return (
          <div key={charId} className="ksp-voice-film-char-card">
            <div className="ksp-voice-film-char-header">
              <strong>{name}</strong>
              <span className="ksp-voice-film-char-meta">{lines.length} lines</span>
            </div>

            <div className="ksp-voice-film-char-provider">
              <span className="ksp-voice-film-tiny-label">Provider:</span>
              <select
                className="ksp-select ksp-select-sm"
                value={assignment === null ? "__skip__" : (assignment ?? "__default__")}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "__default__") onClearAssignment(charId);
                  else if (val === "__skip__") onAssignVoice(charId, null as any);
                  else onAssignVoice(charId, val as FilmVoiceProvider);
                }}
              >
                <option value="__default__">Default ({VOICE_PROVIDER_LABELS[globalProvider].name})</option>
                <option value="elevenlabs">ElevenLabs</option>
                <option value="google-tts">Google TTS</option>
                <option value="__skip__">Skip (no voice)</option>
              </select>
            </div>

            <div className="ksp-voice-film-line-preview">
              {lines.slice(0, 2).map((d, i) => (
                <div key={i} className="ksp-voice-film-line">
                  <span className="ksp-voice-film-line-prefix">
                    {d.parenthetical ? `(${d.parenthetical}) ` : ""}
                  </span>
                  {d.lineEn}
                </div>
              ))}
              {lines.length > 2 && (
                <div className="ksp-voice-film-line-more">
                  + {lines.length - 2} more lines
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div className="ksp-voice-film-actions">
        <button
          type="button"
          className="ksp-btn ksp-btn-sm ksp-btn-primary"
          onClick={onGenerateAudio}
        >
          🎤 Generate Audio (all chars)
        </button>
      </div>
    </div>
  );
}
