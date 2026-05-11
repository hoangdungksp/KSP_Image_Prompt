/**
 * KSP Image v0.9.0 — Project Setting block (consolidated)
 *
 * Replaces scattered top-level fields in v0.8.x.
 * Includes: name, mode, genre/industry, aspect, duration, time format,
 *           AI providers, autosave, UI prefs.
 *
 * UI: Collapsible sections matching Mockup D.
 */

import React, { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { useGlobalStore, createDefaultSettingV2 } from "../store/useGlobalStore";
import { migrateProjectToV09 } from "../store/migration_v09";
import type {
  ProjectSettingV2,
  ProjectModeV2,
  FilmGenreV2,
  AnimationStyleV2,
  AspectRatioV2,
  ApiKeysStatus,
  TimeFormat,
} from "../types/v0_9_0";

// v0.9.3-r1: TVC Commercial + Product Photo HIDDEN from Mode dropdown.
// Code giữ trong codebase (gác lại post-v1.0). User chỉ thấy Photos + Film.
// To re-enable later: uncomment 2 entries below.
const MODES: { value: ProjectModeV2; label: string; emoji: string; desc: string }[] = [
  { value: "photos", label: "Photos", emoji: "📷", desc: "Single image generation, 18+ themes, Camera Style" },
  // { value: "tvc_commercial", label: "TVC Commercial", emoji: "🎬", desc: "Branded ads với Concept + Storyboard pipeline" },
  // { value: "product_photo", label: "Product Photo", emoji: "📦", desc: "Product-only, lighting setup" },
  { value: "film", label: "Film / Short Film", emoji: "🎞", desc: "Multi-character narrative với Script + Scenes" },
];

// v0.9.3-r2 Q5 lock: Film mode chỉ show 6 genres (drama/sci_fi/action/romance/thriller/comedy)
// Enum FilmGenreV2 giữ nguyên 9 values cho backward compat (horror/fantasy/documentary archived).
const FILM_GENRES_V093: FilmGenreV2[] = ["drama", "sci_fi", "action", "romance", "thriller", "comedy"];

// v0.9.3-r2 Q5 lock: Film mode v0.9.3 chỉ 4 styles (live_action/cgi_3d_cinematic/anime_2d/film_noir)
// Defer cartoon_2d + stop_motion cho v0.9.4+.
const FILM_ANIMATION_STYLES_V093: AnimationStyleV2[] = ["live_action", "cgi_3d_cinematic", "anime_2d", "film_noir"];

// v0.9.3-r2 Q5 lock: 5 aspect ratios (16:9/9:16/1:1/4:3/21:9) — bỏ 4:5 và 2.39:1
const ASPECT_RATIOS_V093: AspectRatioV2[] = ["16:9", "9:16", "1:1", "4:3", "21:9"];

const GENRES: { value: FilmGenreV2; label: string }[] = [
  { value: "drama", label: "💔 Drama" },
  { value: "sci_fi", label: "🤖 Sci-fi" },
  { value: "action", label: "💥 Action" },
  { value: "romance", label: "❤️ Romance" },
  { value: "comedy", label: "😂 Comedy" },
  { value: "horror", label: "👻 Horror" },
  { value: "thriller", label: "🔪 Thriller" },
  { value: "fantasy", label: "🧙 Fantasy" },
  { value: "documentary", label: "🎙 Documentary" },
];

const ANIMATION_STYLES: { value: AnimationStyleV2; label: string }[] = [
  { value: "live_action", label: "📹 Live Action" },
  { value: "cgi_3d_cinematic", label: "🎮 CGI 3D Cinematic" },
  { value: "anime_2d", label: "🎌 Anime 2D" },
  { value: "cartoon_2d", label: "🎨 Cartoon 2D" },
  { value: "stop_motion", label: "🎭 Stop Motion" },
  { value: "film_noir", label: "🎩 Film Noir" },
];

const ASPECT_RATIOS: { value: AspectRatioV2; label: string }[] = [
  { value: "16:9", label: "16:9 landscape" },
  { value: "9:16", label: "9:16 vertical" },
  { value: "1:1", label: "1:1 square" },
  { value: "4:5", label: "4:5 portrait" },
  { value: "4:3", label: "4:3 classic" },
  { value: "21:9", label: "21:9 cinemascope" },
  { value: "2.39:1", label: "2.39:1 anamorphic" },
];

const TIME_FORMATS: { value: TimeFormat; label: string; example: string }[] = [
  { value: "decimal", label: "Decimal", example: "0–1.5s (Seedance native)" },
  { value: "integer", label: "Integer", example: "0–2s (số chẵn, dễ đọc)" },
  { value: "timecode", label: "Timecode", example: "0:00–0:01.5 (film standard)" },
];

export function ProjectSettingSectionV09() {
  const project = useAppStore((s) => s.currentProject);
  const updateProject = useAppStore((s) => s.updateCurrentProject);
  const apiKeys = useGlobalStore((s) => s.apiKeys);
  const setApiKey = useGlobalStore((s) => s.setApiKey);

  // Compute status from keys (memoized) instead of calling getApiKeysStatus() in selector
  // (calling method in selector creates new object every render → infinite loop)
  const apiKeysStatus = React.useMemo<ApiKeysStatus>(() => {
    const isPresent = (k?: string): "connected" | "invalid" | "empty" =>
      k && k.length > 8 ? "connected" : k ? "invalid" : "empty";
    return {
      gemini: isPresent(apiKeys.gemini),
      openai: isPresent(apiKeys.openai),
      elevenlabs: isPresent(apiKeys.elevenlabs),
      googleTts: isPresent(apiKeys.googleTts),
      suno: isPresent(apiKeys.suno),
    };
  }, [apiKeys]);

  const [expanded, setExpanded] = useState({
    basic: true,
    apiKeys: false,
    aiProviders: false,
    exportDefaults: false,
    storage: false,
    uiPrefs: false,
  });

  if (!project) return null;

  // Ensure migrated
  const migrated = migrateProjectToV09(project);
  const setting = migrated.settingV2 ?? createDefaultSettingV2((project.mode as ProjectModeV2) ?? "photos", project.name);

  function patchSetting(patch: Partial<ProjectSettingV2>) {
    if (!project) return;
    const newSetting: ProjectSettingV2 = {
      ...setting,
      ...patch,
      updatedAt: Date.now(),
    };
    updateProject({
      schemaVersion: "v0.9",
      settingV2: newSetting,
      // Keep legacy fields in sync for backward compat
      name: newSetting.name,
      mode: newSetting.mode === "photos" ? "lifestyle" : newSetting.mode,
      industry: newSetting.industry,
      aspectRatio: newSetting.aspectRatio as any,
    } as any);
  }

  const isFilm = setting.mode === "film";
  const isTvcOrProduct = setting.mode === "tvc_commercial" || setting.mode === "product_photo";

  return (
    <section className="ksp-section ksp-project-setting" data-mode={setting.mode}>
      <header className="ksp-section-header">
        <span className="ksp-section-icon">📁</span>
        <h2 className="ksp-section-title">PROJECT SETTING</h2>
      </header>

      {/* BASIC INFO */}
      <CollapsibleBlock
        title="BASIC INFO"
        expanded={expanded.basic}
        onToggle={() => setExpanded({ ...expanded, basic: !expanded.basic })}
      >
        <div className="ksp-form-row">
          <Label text="Project name">
            <input
              type="text"
              value={setting.name}
              onChange={(e) => patchSetting({ name: e.target.value })}
              className="ksp-input"
            />
          </Label>
        </div>

        <div className="ksp-form-row ksp-form-row-2">
          <Label text="Mode">
            <select
              value={setting.mode}
              onChange={(e) => patchSetting({ mode: e.target.value as ProjectModeV2 })}
              className="ksp-select"
            >
              {MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.emoji} {m.label}
                </option>
              ))}
            </select>
          </Label>

          {isFilm && (
            <Label text="Genre">
              <select
                value={setting.genre ?? "drama"}
                onChange={(e) => patchSetting({ genre: e.target.value as FilmGenreV2 })}
                className="ksp-select"
              >
                {GENRES.filter((g) => FILM_GENRES_V093.includes(g.value)).map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </Label>
          )}

          {isTvcOrProduct && (
            <Label text="Industry">
              <select
                value={setting.industry ?? "general"}
                onChange={(e) => patchSetting({ industry: e.target.value })}
                className="ksp-select"
              >
                <option value="skincare">💄 Skincare</option>
                <option value="fnb">🍔 F&amp;B</option>
                <option value="tech">💻 Tech</option>
                <option value="fashion">👗 Fashion</option>
                <option value="travel">✈️ Travel</option>
                <option value="general">📦 General</option>
              </select>
            </Label>
          )}
        </div>

        {/* v0.9.3-r2: Animation Style + Dialog cùng row (sidebar 380px fit) */}
        {isFilm && (
          <div className="ksp-form-row ksp-form-row-2">
            <Label text="Animation Style">
              <select
                value={setting.animationStyle ?? "live_action"}
                onChange={(e) => patchSetting({ animationStyle: e.target.value as AnimationStyleV2 })}
                className="ksp-select"
              >
                {ANIMATION_STYLES.filter((s) =>
                  FILM_ANIMATION_STYLES_V093.includes(s.value)
                ).map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Label>

            <Label text="Dialog">
              <select
                value={setting.dialog ?? "no_dialog"}
                onChange={(e) => patchSetting({ dialog: e.target.value } as any)}
                className="ksp-select"
              >
                <option value="no_dialog">🔇 Không thoại</option>
                <option value="has_dialog">💬 Có thoại</option>
              </select>
            </Label>
          </div>
        )}

        <div className="ksp-form-row ksp-form-row-2">
          <Label text="Aspect Ratio">
            <select
              value={setting.aspectRatio}
              onChange={(e) => patchSetting({ aspectRatio: e.target.value as AspectRatioV2 })}
              className="ksp-select"
            >
              {(isFilm
                ? ASPECT_RATIOS.filter((a) => ASPECT_RATIOS_V093.includes(a.value))
                : ASPECT_RATIOS
              ).map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </Label>

          {(isFilm || isTvcOrProduct) && (
            <Label text="Duration (phút)">
              <input
                type="number"
                min={1}
                max={60}
                step={1}
                value={setting.durationMinutes ?? 5}
                onChange={(e) => {
                  const num = parseInt(e.target.value, 10);
                  if (!isNaN(num) && num >= 1 && num <= 60) {
                    patchSetting({ durationMinutes: num });
                  }
                }}
                placeholder="5"
                className="ksp-input"
              />
            </Label>
          )}

          {setting.mode !== "photos" && setting.mode !== "film" && (
            <Label text="Time format">
              <select
                value={setting.timeFormat}
                onChange={(e) => patchSetting({ timeFormat: e.target.value as TimeFormat })}
                className="ksp-select"
                title={TIME_FORMATS.find((f) => f.value === setting.timeFormat)?.example}
              >
                {TIME_FORMATS.map((f) => (
                  <option key={f.value} value={f.value} title={f.example}>
                    {f.label} — {f.example}
                  </option>
                ))}
              </select>
            </Label>
          )}
        </div>
      </CollapsibleBlock>

      {/* API KEYS */}
      <CollapsibleBlock
        title="API KEYS"
        badge={`${Object.values(apiKeysStatus).filter((s) => s === "connected").length}/5 connected`}
        expanded={expanded.apiKeys}
        onToggle={() => setExpanded({ ...expanded, apiKeys: !expanded.apiKeys })}
      >
        <div className="ksp-form-row ksp-form-row-2">
          <ApiKeyInput
            provider="gemini"
            label="Gemini (Imagen + Flash + Nano Banana)"
            status={apiKeysStatus.gemini}
            value={apiKeys.gemini ?? ""}
            onChange={(v) => setApiKey("gemini", v)}
          />
          <ApiKeyInput
            provider="openai"
            label="OpenAI (ChatGPT 4o fallback)"
            status={apiKeysStatus.openai}
            value={apiKeys.openai ?? ""}
            onChange={(v) => setApiKey("openai", v)}
          />
          <ApiKeyInput
            provider="elevenlabs"
            label="ElevenLabs (Voice TTS, recommend VN)"
            status={apiKeysStatus.elevenlabs}
            value={apiKeys.elevenlabs ?? ""}
            onChange={(v) => setApiKey("elevenlabs", v)}
          />
          <ApiKeyInput
            provider="googleTts"
            label="Google Cloud TTS (cheaper alternative)"
            status={apiKeysStatus.googleTts}
            value={apiKeys.googleTts ?? ""}
            onChange={(v) => setApiKey("googleTts", v)}
          />
          <ApiKeyInput
            provider="suno"
            label="Suno (Music — optional)"
            status={apiKeysStatus.suno}
            value={apiKeys.suno ?? ""}
            onChange={(v) => setApiKey("suno", v)}
          />
        </div>

        <div className="ksp-info-banner">
          🔒 Keys lưu local IndexedDB (obfuscated), không gửi lên server.
          Không có key → fallback prompt-copy mode (manual qua Banana Pro / Suno).
        </div>
      </CollapsibleBlock>

      {/* AI PROVIDER PER TASK — fields filtered by mode */}
      <CollapsibleBlock
        title="AI PROVIDER PER TASK"
        expanded={expanded.aiProviders}
        onToggle={() => setExpanded({ ...expanded, aiProviders: !expanded.aiProviders })}
      >
        <div className="ksp-form-row ksp-form-row-2">
          {/* Script Writer — only for Film */}
          {isFilm && (
            <Label text="Script Writer (Film)">
              <select
                value={setting.aiProviders.scriptWriter}
                onChange={(e) =>
                  patchSetting({
                    aiProviders: { ...setting.aiProviders, scriptWriter: e.target.value as any },
                  })
                }
                className="ksp-select"
              >
                <option value="gemini-flash">Gemini Flash · fast</option>
                <option value="gemini-pro">Gemini Pro · richer</option>
                <option value="openai-4o">ChatGPT 4o · alternative</option>
              </select>
            </Label>
          )}

          {/* Concept Writer — only for TVC */}
          {setting.mode === "tvc_commercial" && (
            <Label text="Concept Writer (TVC)">
              <select
                value={setting.aiProviders.conceptWriter}
                onChange={(e) =>
                  patchSetting({
                    aiProviders: { ...setting.aiProviders, conceptWriter: e.target.value as any },
                  })
                }
                className="ksp-select"
              >
                <option value="gemini-flash">Gemini Flash</option>
                <option value="gemini-pro">Gemini Pro</option>
                <option value="openai-4o">ChatGPT 4o</option>
              </select>
            </Label>
          )}

          {/* Storyboard frames — Film + TVC */}
          {(isFilm || setting.mode === "tvc_commercial") && (
            <Label text="Storyboard frames">
              <select
                value={setting.aiProviders.storyboardFrames}
                onChange={(e) =>
                  patchSetting({
                    aiProviders: { ...setting.aiProviders, storyboardFrames: e.target.value as any },
                  })
                }
                className="ksp-select"
              >
                <option value="gemini-flash">Gemini Flash</option>
                <option value="openai-4o">ChatGPT 4o</option>
              </select>
            </Label>
          )}

          {/* Image gen — ALL modes (Photos, TVC, Product, Film) */}
          <Label text="Image gen (face/frame)">
            <select
              value={setting.aiProviders.imageGen}
              onChange={(e) =>
                patchSetting({
                  aiProviders: { ...setting.aiProviders, imageGen: e.target.value as any },
                })
              }
              className="ksp-select"
            >
              <option value="imagen-4-standard">Imagen 4 Standard · $0.04</option>
              <option value="imagen-4-fast">Imagen 4 Fast · $0.02</option>
              <option value="nano-banana">Nano Banana · $0.039</option>
              <option value="nano-banana-pro">Nano Banana Pro · $0.13+</option>
            </select>
          </Label>

          {/* Voice TTS — Film + TVC (not Photos / Product) */}
          {(isFilm || setting.mode === "tvc_commercial") && (
            <Label text="Voice TTS">
              <select
                value={setting.aiProviders.voiceTts}
                onChange={(e) =>
                  patchSetting({
                    aiProviders: { ...setting.aiProviders, voiceTts: e.target.value as any },
                  })
                }
                className="ksp-select"
              >
                <option value="elevenlabs">ElevenLabs · best VN</option>
                <option value="google-tts">Google TTS · cheap</option>
              </select>
            </Label>
          )}
        </div>
      </CollapsibleBlock>

      <CollapsibleBlock
        title="STORAGE & AUTOSAVE"
        expanded={expanded.storage}
        onToggle={() => setExpanded({ ...expanded, storage: !expanded.storage })}
      >
        <div className="ksp-form-row ksp-form-row-2">
          <Label text="Autosave interval (seconds)">
            <input
              type="number"
              value={setting.autosaveIntervalSeconds ?? 30}
              onChange={(e) =>
                patchSetting({ autosaveIntervalSeconds: parseInt(e.target.value, 10) })
              }
              className="ksp-input"
              min={10}
              max={300}
            />
          </Label>
          <Label text="Versioning">
            <select
              value={setting.versioningEnabled ? "yes" : "no"}
              onChange={(e) => patchSetting({ versioningEnabled: e.target.value === "yes" })}
              className="ksp-select"
            >
              <option value="yes">✓ Enabled (track history)</option>
              <option value="no">○ Disabled</option>
            </select>
          </Label>
        </div>
      </CollapsibleBlock>
    </section>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function CollapsibleBlock({
  title,
  badge,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  badge?: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="ksp-collapsible">
      <button className="ksp-collapsible-header" onClick={onToggle} type="button">
        <span className="ksp-collapsible-icon">{expanded ? "▼" : "▶"}</span>
        <span className="ksp-collapsible-title">{title}</span>
        {badge && <span className="ksp-collapsible-badge">{badge}</span>}
      </button>
      {expanded && <div className="ksp-collapsible-content">{children}</div>}
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

function ApiKeyInput({
  provider,
  label,
  status,
  value,
  onChange,
}: {
  provider: string;
  label: string;
  status: "connected" | "invalid" | "empty";
  value: string;
  onChange: (v: string) => void;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="ksp-api-key">
      <div className="ksp-api-key-header">
        <span className="ksp-api-key-label">{label}</span>
        <span className={`ksp-api-key-status ksp-api-key-status-${status}`}>
          {status === "connected" && "✓ connected"}
          {status === "invalid" && "⚠ invalid"}
          {status === "empty" && "○ optional"}
        </span>
      </div>
      <div className="ksp-api-key-input-wrap">
        <input
          type={revealed ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={status === "empty" ? `Paste ${provider} API key here` : ""}
          className="ksp-input ksp-api-key-input"
        />
        <button
          type="button"
          className="ksp-api-key-toggle"
          onClick={() => setRevealed(!revealed)}
          title={revealed ? "Hide" : "Show"}
        >
          {revealed ? "🙈" : "👁"}
        </button>
      </div>
    </div>
  );
}
