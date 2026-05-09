/**
 * KSP Image v0.9.0 — Voice AI Section (Step 6)
 *
 * Per-character voice config + optional Narrator.
 * For Film no-dialog: skip-able with banner.
 * Supports: ElevenLabs (best Vietnamese) / Google Cloud TTS (cheaper).
 *
 * Phase 4 ships:
 * - UI for voice config per character
 * - Skip toggle for no-dialog films
 * - Add Narrator option
 * - Voice characteristics description (free text)
 *
 * TTS API integration ships in Phase 5 wire-up.
 */

import React, { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { migrateProjectToV09 } from "../store/migration_v09";
import { ConfirmButton } from "./ConfirmButton";
import type { ProjectModeV2, VoiceSection, VoiceConfig, NarratorConfig } from "../types/v0_9_0";

export function VoiceSectionV09() {
  const project = useAppStore((s) => s.currentProject);
  const updateProject = useAppStore((s) => s.updateCurrentProject);
  const showToast = useAppStore((s) => s.showToast);

  if (!project) return null;
  const migrated = migrateProjectToV09(project);
  const mode = (migrated.settingV2?.mode ?? "photos") as ProjectModeV2;
  if (mode !== "film" && mode !== "tvc_commercial") return null;

  const cast = migrated.filmCharactersV2 ?? [];
  const dialogCast = cast.filter((c) => c.hasDialog);
  const voice = migrated.voice;
  const provider = migrated.settingV2?.aiProviders.voiceTts ?? "elevenlabs";

  function patch(updates: Partial<typeof migrated>) {
    updateProject(updates as any);
  }

  function setVoice(v: VoiceSection) {
    patch({ voice: v });
  }

  function initVoice() {
    setVoice({
      enabled: true,
      provider,
      characterVoices: {},
      narratorEnabled: false,
    });
  }

  function disableVoice() {
    patch({ voice: undefined } as any);
    showToast("Voice AI disabled", "info");
  }

  if (!voice) {
    // Initial state — show enable/skip
    return (
      <section className="ksp-section ksp-voice-section">
        <header className="ksp-section-header">
          <span className="ksp-section-icon">🎙</span>
          <h2 className="ksp-section-title">6. VOICE AI</h2>
        </header>
        <div className="ksp-voice-enable">
          <p className="ksp-voice-info">
            {dialogCast.length > 0
              ? `${dialogCast.length} characters có dialog. Click để setup voice cho từng character.`
              : "Phim không có dialog. Voice AI optional — chỉ dùng cho Narrator giọng kể."}
          </p>
          <div className="ksp-form-row">
            <button className="ksp-btn ksp-btn-secondary" onClick={initVoice}>
              ✓ Enable Voice AI
            </button>
            <button className="ksp-btn ksp-btn-ghost" onClick={() => showToast("Voice AI skipped", "info")}>
              ○ Skip (silent film)
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="ksp-section ksp-voice-section">
      <header className="ksp-section-header">
        <span className="ksp-section-icon">🎙</span>
        <h2 className="ksp-section-title">6. VOICE AI</h2>
        <span className="ksp-script-meta">
          Provider: {provider} · {Object.keys(voice.characterVoices).length} configured
        </span>
      </header>

      <div className="ksp-voice-content">
        <div className="ksp-form-row">
          <Label text="TTS Provider">
            <select
              className="ksp-select"
              value={voice.provider}
              onChange={(e) => setVoice({ ...voice, provider: e.target.value as any })}
            >
              <option value="elevenlabs">ElevenLabs · best VN, $0.18/1k chars</option>
              <option value="google-tts">Google Cloud TTS · $4/1M chars</option>
            </select>
          </Label>
        </div>

        {/* Per-character voice configs */}
        {dialogCast.length > 0 && (
          <div className="ksp-voice-cast-list">
            <h4 className="ksp-form-group-title">Per-character voice config</h4>
            {dialogCast.map((c) => (
              <CharacterVoiceCard
                key={c.id}
                characterId={c.id}
                characterName={c.name}
                config={voice.characterVoices[c.id]}
                onUpdate={(cfg) =>
                  setVoice({
                    ...voice,
                    characterVoices: { ...voice.characterVoices, [c.id]: cfg },
                  })
                }
              />
            ))}
          </div>
        )}

        {/* Narrator section */}
        <div className="ksp-narrator-section">
          <div className="ksp-form-row">
            <label className="ksp-checkbox-label">
              <input
                type="checkbox"
                checked={voice.narratorEnabled ?? false}
                onChange={(e) => setVoice({ ...voice, narratorEnabled: e.target.checked })}
              />
              <span>Add Narrator (giọng kể)</span>
            </label>
          </div>
          {voice.narratorEnabled && (
            <NarratorConfigForm
              config={voice.narratorConfig}
              onUpdate={(cfg) => setVoice({ ...voice, narratorConfig: cfg })}
            />
          )}
        </div>

        <div className="ksp-info-banner">
          ℹ️ Phase 4 ships voice config UI. TTS audio generation API integration ships in Phase 5.
          Currently: copy voice characteristics → use ElevenLabs UI manually.
        </div>

        <ConfirmButton className="ksp-btn ksp-btn-danger-ghost" onConfirm={disableVoice} confirmText="Disable Voice AI?">
          🗑 Disable Voice AI
        </ConfirmButton>
      </div>
    </section>
  );
}

function CharacterVoiceCard({
  characterId,
  characterName,
  config,
  onUpdate,
}: {
  characterId: string;
  characterName: string;
  config?: VoiceConfig;
  onUpdate: (cfg: VoiceConfig) => void;
}) {
  const cfg: VoiceConfig = config ?? {
    voiceId: "",
    voiceName: "",
    language: "vi",
    characteristics: "",
    speed: 1.0,
  };

  return (
    <div className="ksp-voice-card">
      <div className="ksp-voice-card-header">
        <span className="ksp-voice-card-name">{characterName}</span>
      </div>
      <div className="ksp-voice-card-body">
        <div className="ksp-form-row ksp-form-row-2">
          <Label text="Voice ID (ElevenLabs)">
            <input
              className="ksp-input"
              value={cfg.voiceId}
              onChange={(e) => onUpdate({ ...cfg, voiceId: e.target.value })}
              placeholder="e.g. 21m00Tcm4TlvDq8ikWAM"
            />
          </Label>
          <Label text="Language">
            <select
              className="ksp-select"
              value={cfg.language}
              onChange={(e) => onUpdate({ ...cfg, language: e.target.value as any })}
            >
              <option value="vi">Vietnamese</option>
              <option value="en">English</option>
              <option value="multi">Multilingual</option>
            </select>
          </Label>
        </div>
        <Label text="Voice characteristics (description)">
          <textarea
            className="ksp-input ksp-textarea"
            rows={2}
            value={cfg.characteristics}
            onChange={(e) => onUpdate({ ...cfg, characteristics: e.target.value })}
            placeholder="e.g. deep male synth, slow speed, slight reverb, robotic undertone"
          />
        </Label>
      </div>
    </div>
  );
}

function NarratorConfigForm({
  config,
  onUpdate,
}: {
  config?: NarratorConfig;
  onUpdate: (cfg: NarratorConfig) => void;
}) {
  const cfg: NarratorConfig = config ?? {
    scriptEn: "",
    scriptVi: "",
    voiceConfig: {
      voiceId: "",
      voiceName: "",
      language: "vi",
      characteristics: "deep, calm, contemplative — documentary style",
    },
  };

  return (
    <div className="ksp-narrator-form">
      <Label text="Narrator characteristics">
        <input
          className="ksp-input"
          value={cfg.voiceConfig.characteristics}
          onChange={(e) =>
            onUpdate({
              ...cfg,
              voiceConfig: { ...cfg.voiceConfig, characteristics: e.target.value },
            })
          }
          placeholder="e.g. deep male, slow, contemplative, documentary tone"
        />
      </Label>
      <Label text="Narration script (EN)">
        <textarea
          className="ksp-input ksp-textarea"
          rows={4}
          value={cfg.scriptEn}
          onChange={(e) => onUpdate({ ...cfg, scriptEn: e.target.value })}
          placeholder="Narrator voiceover text aligned to film scenes..."
        />
      </Label>
    </div>
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
