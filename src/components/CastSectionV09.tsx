/**
 * KSP Image v0.9.0 — Cast Section (Mockup B)
 *
 * Multi-character cast management:
 * - Character cards: name + role + description + uniqueIdentifiers + dialog flag
 * - Face refs: 1:1 aspect, multiple angles
 * - Body refs: 3:4 aspect, full body / torso variants
 * - AI Generate Hybrid: API call (Imagen 4) OR copy prompt → user uploads
 * - Add / edit / delete characters with confirmation
 *
 * Used in TVC + Film modes. Hidden in Photos / Product modes.
 */

import React, { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { useGlobalStore } from "../store/useGlobalStore";
import { migrateProjectToV09 } from "../store/migration_v09";
import * as actions from "../store/v09_actions";
import { ConfirmButton } from "./ConfirmButton";
import { buildCharacterRefImagePrompt } from "../engine/ai_prompts/musicVoiceImage";
import type {
  FilmCharacterV2,
  CharacterRef,
  ProjectModeV2,
} from "../types/v0_9_0";

const ROLES: { value: FilmCharacterV2["role"]; label: string; emoji: string }[] = [
  { value: "protagonist", label: "Protagonist", emoji: "⭐" },
  { value: "supporting", label: "Supporting", emoji: "👥" },
  { value: "antagonist", label: "Antagonist", emoji: "🦹" },
  { value: "extra", label: "Extra", emoji: "👤" },
];

const CHARACTER_TYPES: { value: NonNullable<FilmCharacterV2["characterType"]>; label: string; emoji: string }[] = [
  { value: "human", label: "Human", emoji: "🧑" },
  { value: "robot", label: "Robot / AI", emoji: "🤖" },
  { value: "creature", label: "Creature / Fantasy", emoji: "🐉" },
  { value: "animal", label: "Animal", emoji: "🦊" },
  { value: "object", label: "Object / Vehicle", emoji: "🚗" },
];

export function CastSectionV09() {
  const project = useAppStore((s) => s.currentProject);
  const updateProject = useAppStore((s) => s.updateCurrentProject);
  const showToast = useAppStore((s) => s.showToast);
  const focusedCharacterId = useGlobalStore((s) => s.focusedCharacterId);
  const setFocusedCharacter = useGlobalStore((s) => s.setFocusedCharacter);

  if (!project) return null;
  const migrated = migrateProjectToV09(project);
  const cast = migrated.filmCharactersV2 ?? [];
  const mode = (migrated.settingV2?.mode ?? "photos") as ProjectModeV2;

  // Cast section hidden for photos/product modes
  if (mode === "photos" || mode === "product_photo") return null;

  function patch(updates: Partial<typeof migrated>) {
    updateProject(updates as any);
  }

  function handleAddCharacter() {
    const newCharData: Omit<FilmCharacterV2, "id" | "order"> = {
      name: `Character ${cast.length + 1}`,
      role: cast.length === 0 ? "protagonist" : "supporting",
      description: "",
      uniqueIdentifiers: "",
      hasDialog: true,
      faceRefs: [],
      bodyRefs: [],
      characterType: "human",
    };
    patch(actions.addCharacter(migrated, newCharData));
  }

  function handleDeleteCharacter(characterId: string) {
    patch(actions.deleteCharacter(migrated, characterId));
    if (focusedCharacterId === characterId) setFocusedCharacter(null);
  }

  const sectionLabel = mode === "film" ? "CAST" : "CHARACTERS";
  const sectionEmoji = mode === "film" ? "🎭" : "👤";

  return (
    <section className="ksp-section ksp-cast-section" data-mode={mode}>
      <header className="ksp-section-header">
        <span className="ksp-section-icon">{sectionEmoji}</span>
        <h2 className="ksp-section-title">{sectionLabel}</h2>
        <span className="ksp-cast-count">
          {cast.length} {mode === "film" ? "characters" : "characters"}
          {mode === "film" && " (multi-character)"}
        </span>
      </header>

      <div className="ksp-cast-list">
        {cast.length === 0 && (
          <div className="ksp-cast-empty">
            <p>Chưa có character nào. Thêm character đầu tiên để AI có context.</p>
          </div>
        )}

        {cast.map((char) => (
          <CharacterCard
            key={char.id}
            character={char}
            isFocused={focusedCharacterId === char.id}
            onFocus={() => setFocusedCharacter(char.id === focusedCharacterId ? null : char.id)}
            onDelete={() => handleDeleteCharacter(char.id)}
            onUpdate={(p) => patch(actions.updateCharacter(migrated, char.id, p))}
            onAddRef={(refType, ref) => patch(actions.addCharacterRef(migrated, char.id, refType, ref))}
            onDeleteRef={(refType, refId) =>
              patch(actions.deleteCharacterRef(migrated, char.id, refType, refId))
            }
          />
        ))}

        <div className="ksp-cast-actions">
          <button className="ksp-btn ksp-btn-secondary" onClick={handleAddCharacter}>
            + Add Character
          </button>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// CHARACTER CARD
// ============================================================================

function CharacterCard({
  character,
  isFocused,
  onFocus,
  onDelete,
  onUpdate,
  onAddRef,
  onDeleteRef,
}: {
  character: FilmCharacterV2;
  isFocused: boolean;
  onFocus: () => void;
  onDelete: () => void;
  onUpdate: (patch: Partial<FilmCharacterV2>) => void;
  onAddRef: (refType: "face" | "body", ref: Omit<CharacterRef, "id">) => void;
  onDeleteRef: (refType: "face" | "body", refId: string) => void;
}) {
  const charType = CHARACTER_TYPES.find((t) => t.value === character.characterType);
  const role = ROLES.find((r) => r.value === character.role);

  return (
    <div className={`ksp-character-card ${isFocused ? "ksp-character-card-focused" : ""}`}>
      {/* Header (always visible) */}
      <button className="ksp-character-card-header" onClick={onFocus} type="button">
        <div className="ksp-character-avatar">{charType?.emoji ?? "🧑"}</div>
        <div className="ksp-character-summary">
          <div className="ksp-character-name">{character.name || "Untitled"}</div>
          <div className="ksp-character-role">
            {role?.emoji} {role?.label} · order {character.order + 1}
            {!character.hasDialog && " · no dialog"}
          </div>
        </div>
        <div className="ksp-character-counts">
          <span title="Face refs">📷 {character.faceRefs.length}</span>
          <span title="Body refs">👗 {character.bodyRefs.length}</span>
        </div>
        <span className="ksp-character-expand-icon">{isFocused ? "▲" : "▼"}</span>
      </button>

      {/* Expanded detail (Mockup B full) */}
      {isFocused && (
        <div className="ksp-character-detail">
          <CharacterBasicInfo character={character} onUpdate={onUpdate} />
          <CharacterRefsSection
            character={character}
            refType="face"
            onAddRef={onAddRef}
            onDeleteRef={onDeleteRef}
          />
          <CharacterRefsSection
            character={character}
            refType="body"
            onAddRef={onAddRef}
            onDeleteRef={onDeleteRef}
          />

          <div className="ksp-character-detail-actions">
            <ConfirmButton
              className="ksp-btn ksp-btn-danger-ghost"
              onConfirm={onDelete}
              confirmText="Xóa character?"
            >
              🗑 Delete character
            </ConfirmButton>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CHARACTER BASIC INFO
// ============================================================================

function CharacterBasicInfo({
  character,
  onUpdate,
}: {
  character: FilmCharacterV2;
  onUpdate: (patch: Partial<FilmCharacterV2>) => void;
}) {
  return (
    <div className="ksp-form-group">
      <h4 className="ksp-form-group-title">Basic Info</h4>

      <div className="ksp-form-row ksp-form-row-2">
        <Label text="Name">
          <input
            className="ksp-input"
            value={character.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="e.g. Robot, Linh, Captain Marlow"
          />
        </Label>
        <Label text="Character type">
          <select
            className="ksp-select"
            value={character.characterType ?? "human"}
            onChange={(e) =>
              onUpdate({ characterType: e.target.value as FilmCharacterV2["characterType"] })
            }
          >
            {CHARACTER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.emoji} {t.label}
              </option>
            ))}
          </select>
        </Label>
      </div>

      <div className="ksp-form-row ksp-form-row-2">
        <Label text="Role">
          <select
            className="ksp-select"
            value={character.role}
            onChange={(e) => onUpdate({ role: e.target.value as FilmCharacterV2["role"] })}
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.emoji} {r.label}
              </option>
            ))}
          </select>
        </Label>
        <Label text="Has dialog?">
          <select
            className="ksp-select"
            value={character.hasDialog ? "yes" : "no"}
            onChange={(e) => onUpdate({ hasDialog: e.target.value === "yes" })}
          >
            <option value="yes">✓ Has dialog</option>
            <option value="no">○ No dialog (visual only)</option>
          </select>
        </Label>
      </div>

      <Label text="Description (for AI consistency across all shots)">
        <textarea
          className="ksp-input ksp-textarea"
          rows={3}
          value={character.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="e.g. Bipedal robot 1.8m tall, weathered silver metal body covered in green moss, glowing soft blue LED eyes, retrofuturist 1970s design..."
        />
      </Label>

      <Label text="Unique identifiers (concrete visual markers AI must always render)">
        <input
          className="ksp-input"
          value={character.uniqueIdentifiers}
          onChange={(e) => onUpdate({ uniqueIdentifiers: e.target.value })}
          placeholder="e.g. glowing blue LED eyes, moss on shoulders, dust on joints"
        />
      </Label>
    </div>
  );
}

// ============================================================================
// CHARACTER REFS (face / body)
// ============================================================================

const FACE_ANGLES: { value: CharacterRef["angle"]; label: string }[] = [
  { value: "front", label: "Front view" },
  { value: "three_quarter_left", label: "3/4 Left" },
  { value: "three_quarter_right", label: "3/4 Right" },
  { value: "side", label: "Side profile" },
  { value: "back", label: "Back view" },
];

const BODY_ANGLES: { value: CharacterRef["angle"]; label: string }[] = [
  { value: "full_body", label: "Full body" },
  { value: "torso", label: "Torso" },
  { value: "macro", label: "Macro detail" },
];

function CharacterRefsSection({
  character,
  refType,
  onAddRef,
  onDeleteRef,
}: {
  character: FilmCharacterV2;
  refType: "face" | "body";
  onAddRef: (refType: "face" | "body", ref: Omit<CharacterRef, "id">) => void;
  onDeleteRef: (refType: "face" | "body", refId: string) => void;
}) {
  const showToast = useAppStore((s) => s.showToast);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const refs = refType === "face" ? character.faceRefs : character.bodyRefs;
  const angles = refType === "face" ? FACE_ANGLES : BODY_ANGLES;
  const title = refType === "face" ? "Face / Head references" : "Body / Outfit references";
  const emoji = refType === "face" ? "📷" : "👗";

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    files.forEach((file) => {
      const url = URL.createObjectURL(file);
      onAddRef(refType, {
        angle: angles[0].value,
        generatedByAi: false,
        prompt: `Uploaded: ${file.name}`,
        // Store blob URL temporarily — IndexedDB integration in v0.9.1
        ...({ blobUrl: url } as any),
      });
    });
    showToast(`✓ Uploaded ${files.length} file(s)`, "success");
    e.target.value = ""; // reset
  }

  return (
    <div className="ksp-form-group">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={handleFileSelected}
      />
      <div className="ksp-form-group-header">
        <h4 className="ksp-form-group-title">
          {emoji} {title} ({refs.length})
        </h4>
        <div className="ksp-form-group-actions">
          <button
            className="ksp-btn ksp-btn-ghost ksp-btn-sm"
            onClick={handleUploadClick}
          >
            + Upload
          </button>
          <button
            className={`ksp-btn ksp-btn-sm ${showAiPanel ? "ksp-btn-active" : "ksp-btn-orange-ghost"}`}
            onClick={() => setShowAiPanel(!showAiPanel)}
          >
            ✨ AI Generate
          </button>
        </div>
      </div>

      {/* Refs grid */}
      <div className="ksp-refs-grid" data-ref-type={refType}>
        {refs.map((ref) => (
          <RefCard
            key={ref.id}
            ref={ref}
            characterEmoji={CHARACTER_TYPES.find((t) => t.value === character.characterType)?.emoji ?? "🧑"}
            onDelete={() => onDeleteRef(refType, ref.id)}
          />
        ))}
        {/* Empty slot */}
        {refs.length < 6 && (
          <div className="ksp-ref-card ksp-ref-card-empty">
            <span className="ksp-ref-card-plus">+</span>
            <span className="ksp-ref-card-label">Empty slot</span>
          </div>
        )}
      </div>

      {/* AI Generate panel (collapsed by default, toggled by button above) */}
      {showAiPanel && (
        <AiGeneratePanel
          character={character}
          refType={refType}
          angles={angles}
          onGenerated={(ref) => {
            onAddRef(refType, ref);
            setShowAiPanel(false);
          }}
        />
      )}
    </div>
  );
}

function RefCard({
  ref,
  characterEmoji,
  onDelete,
}: {
  ref: CharacterRef;
  characterEmoji: string;
  onDelete: () => void;
}) {
  // Defensive (v0.9.2-r1): legacy data from v0.9.0 phase34 may not have `angle` field.
  // Fallback to "front" to prevent crash. Will be removed when Cast section is split
  // into CastTvcSection + CastFilmSection (Sprint 0.9.2-r2+).
  const angleLabel = (ref.angle ?? "front").replace(/_/g, " ");
  return (
    <div className="ksp-ref-card">
      <div className="ksp-ref-card-preview">{characterEmoji}</div>
      <div className="ksp-ref-card-info">
        <div className="ksp-ref-card-angle">{angleLabel}</div>
        {ref.generatedByAi && <div className="ksp-ref-card-badge">✨ AI</div>}
      </div>
      <button className="ksp-ref-card-delete" onClick={onDelete} title="Delete">
        ×
      </button>
    </div>
  );
}

// ============================================================================
// AI GENERATE PANEL (Hybrid: API or prompt copy)
// ============================================================================

function AiGeneratePanel({
  character,
  refType,
  angles,
  onGenerated,
}: {
  character: FilmCharacterV2;
  refType: "face" | "body";
  angles: { value: CharacterRef["angle"]; label: string }[];
  onGenerated: (ref: Omit<CharacterRef, "id">) => void;
}) {
  const showToast = useAppStore((s) => s.showToast);
  const apiKeys = useGlobalStore((s) => s.apiKeys);
  const hasApiKey = !!(apiKeys.gemini && apiKeys.gemini.length > 8);

  const [angle, setAngle] = useState<CharacterRef["angle"]>(angles[0].value);
  const [variations, setVariations] = useState(3);
  const [generating, setGenerating] = useState(false);

  const prompt = buildCharacterRefImagePrompt({
    character,
    refType,
    angle,
    variations,
  });

  async function handleGenerateApi() {
    if (!hasApiKey) {
      showToast("Chưa có Gemini API key. Vào Project Setting → API Keys.", "error");
      return;
    }
    setGenerating(true);
    try {
      // Try real Imagen 4 API call
      const { generateImage } = await import("../engine/imagenApi");
      const results = await generateImage({
        prompt,
        variations: variations as 1 | 2 | 3 | 4,
        aspectRatio: refType === "face" ? "1:1" : "3:4",
      });
      if (results.length > 0) {
        // Save first variation as ref (multi-variation save in v0.9.1)
        const blob = new Blob(
          [Uint8Array.from(atob(results[0].base64), (c) => c.charCodeAt(0))],
          { type: "image/png" }
        );
        const url = URL.createObjectURL(blob);
        onGenerated({
          angle,
          generatedByAi: true,
          prompt,
          ...({ blobUrl: url } as any),
        });
        showToast(`✓ Generated ${results.length} image(s) via Imagen 4`, "success");
      } else {
        showToast("Imagen returned no images. Try copy prompt → Banana Pro manual.", "error");
      }
    } catch (err: any) {
      // API call failed — fall back to saving prompt only
      console.error("Imagen API error:", err);
      showToast(
        `API lỗi: ${err.message?.slice(0, 60) ?? "unknown"}. Đã lưu prompt — copy ra Banana Pro.`,
        "error"
      );
      onGenerated({
        angle,
        generatedByAi: true,
        prompt,
      });
    } finally {
      setGenerating(false);
    }
  }

  function handleCopyPrompt() {
    navigator.clipboard.writeText(prompt);
    showToast("✓ Prompt copied. Paste vào Banana Pro / Imagen → upload lại.", "success");
  }

  return (
    <div className="ksp-ai-generate-panel">
      <div className="ksp-ai-panel-header">
        ✨ AI Generate {refType === "face" ? "Face" : "Body"} — Hybrid mode
      </div>

      <div className="ksp-ai-panel-prompt">
        <div className="ksp-ai-panel-prompt-label">Generated prompt:</div>
        <pre className="ksp-ai-panel-prompt-text">{prompt}</pre>
      </div>

      <div className="ksp-form-row ksp-form-row-2">
        <Label text="Angle">
          <select
            className="ksp-select"
            value={angle}
            onChange={(e) => setAngle(e.target.value as CharacterRef["angle"])}
          >
            {angles.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </Label>
        <Label text="Variations">
          <select
            className="ksp-select"
            value={variations}
            onChange={(e) => setVariations(parseInt(e.target.value))}
          >
            <option value={1}>1 image</option>
            <option value={3}>3 variations</option>
            <option value={5}>5 variations</option>
          </select>
        </Label>
      </div>

      <div className="ksp-form-row ksp-form-row-2">
        <button
          className={`ksp-btn ${hasApiKey ? "ksp-btn-orange" : "ksp-btn-disabled"}`}
          onClick={handleGenerateApi}
          disabled={!hasApiKey || generating}
        >
          {generating ? "⚙ Generating..." : "⚡ Generate qua API ($0.04)"}
        </button>
        <button className="ksp-btn ksp-btn-orange-ghost" onClick={handleCopyPrompt}>
          📋 Copy → Banana Pro → Upload
        </button>
      </div>

      {!hasApiKey && (
        <div className="ksp-info-banner">
          ℹ️ Chưa có Gemini API key — chỉ dùng được copy prompt mode. Setup key trong Project
          Setting để 1-click API.
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="ksp-label">
      <span className="ksp-label-text">{text}</span>
      {children}
    </label>
  );
}
