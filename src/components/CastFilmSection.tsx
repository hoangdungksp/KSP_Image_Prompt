/**
 * KSP Image Cast Film Section
 *
 * Per Jason spec:
 * - Header has `+` icon button at top-right corner (border-dashed, hover tooltip)
 * - Removed: footer + "AI gợi ý cast" stub + dialog mode info banner
 * - Inside each character card:
 *   - Name + Role inline edit
 *   - Description textarea
 *   - 3 buttons row: [Face refs · N ảnh]  [Body refs · N ảnh]  [✨ icon-only AI Gen Description]
 *   - Click [Face refs] / [Body refs] → expand panel BELOW with grid + 2 buttons:
 *       [img...] [+ upload] [✨ AI gen image]
 *     [✨] auto-fills NEXT missing slot per ordered angle labels.
 *   - Click expanded button again → collapse
 *
 * AI Generate Description:
 *   - Reads character.name, character.role, project.idea, film.script (if exists — Hướng B)
 *   - Provider from setting.aiProviders.scriptWriter (Gemini Flash / OpenAI 4o)
 *   - Cache confirm if description already exists
 *
 * AI Generate Ref Image:
 *   - Imagen 4 Standard (Jason confirmed) — $0.04/image
 *   - Auto-detect next missing label (front → 3/4 L → 3/4 R → profile)
 *   Cache confirm dialog before each call (Jason cache request)
 */

import React, { useRef, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import {
  addCharacter,
  updateCharacter,
  removeCharacter,
  addFaceRef,
  removeFaceRef,
  addBodyRef,
  removeBodyRef,
  ensureFilmData,
} from "../store/film_actions";
import {
  ROLE_LABELS,
  MAX_FACE_REFS_FILM,
  MAX_BODY_REFS,
  DEFAULT_FACE_LABELS_FILM,
  DEFAULT_BODY_LABELS,
  createFilmImageRef,
  type FilmCharacter,
  type FilmCharacterRole,
  type FilmImageRef,
} from "../types/film";
import {
  generateCharacterDescription,
  generateCharacterRefImage,
  findNextMissingLabel,
  runGenerateCastPromptSet,
  type RefKind,
  type CastPromptSet,
} from "../engine/filmCastGeneration";
import type { FilmScriptProvider } from "../engine/filmScriptStages";

// Role → emoji avatar mapping
const ROLE_EMOJI: Record<FilmCharacterRole, string> = {
  protagonist: "🤖",
  antagonist: "😈",
  companion: "🐦",
  extra: "🎭",
};

// ============================================================================
// MAIN SECTION
// ============================================================================

export function CastFilmSection() {
  const project = useAppStore((s) => s.currentProject);
  const updateProject = useAppStore((s) => s.updateCurrentProject);
  const showToast = useAppStore((s) => s.showToast);

  if (!project) return null;
  const film = ensureFilmData(project);

  // Detect stale Cast — script regenerated AFTER character descriptions
  const scriptCreatedAt = film.script?.createdAt;
  const hasStaleDescriptions =
    !!scriptCreatedAt &&
    film.characters.some(
      (c) =>
        c.description.trim().length > 0 &&
        (!c.descriptionGeneratedAt || c.descriptionGeneratedAt < scriptCreatedAt)
    );

  return (
    <section className="ksp-section ksp-cast-film">
      <header className="ksp-section-header">
        <span className="ksp-section-icon">🎭</span>
        <h2 className="ksp-section-title">CAST</h2>
        <span className="ksp-cast-film-subtitle">(nhất quán toàn phim)</span>
        {/* Add button at header top-right — dashed square */}
        <button
          type="button"
          className="ksp-cast-film-add-corner"
          onClick={() => updateProject((p) => addCharacter(p, "protagonist"))}
          title="Thêm character"
          aria-label="Thêm character mới"
        >
          +
        </button>
      </header>

      {/* Stale Cast warning — descriptions predate the current Script */}
      {hasStaleDescriptions && (
        <div className="ksp-cast-film-stale-banner">
          ⚠ Một số character có mô tả CŨ hơn Script hiện tại. Cast có thể không khớp với câu chuyện. Click <strong>✨</strong> trên từng character để regen mô tả theo Script mới.
        </div>
      )}

      {film.characters.length === 0 && (
        <div className="ksp-cast-film-empty">
          <p>
            Chưa có character. Nhấn nút <strong>+</strong> ở góc phải trên cùng để tạo.
            Mỗi nhân vật có Face refs (1-4) + Body refs (1-3) shared toàn project.
          </p>
        </div>
      )}

      <div className="ksp-cast-film-list">
        {film.characters.map((char) => (
          <CastFilmCard
            key={char.id}
            character={char}
            onUpdate={(updates) =>
              updateProject((p) => updateCharacter(p, char.id, updates))
            }
            onRemove={() => {
              if (confirm(`Xóa character "${char.name || `Character ${char.order}`}"?`)) {
                updateProject((p) => removeCharacter(p, char.id));
                showToast("Đã xóa character", "info");
              }
            }}
            onAddFaceRef={(ref) => updateProject((p) => addFaceRef(p, char.id, ref))}
            onRemoveFaceRef={(refId) =>
              updateProject((p) => removeFaceRef(p, char.id, refId))
            }
            onAddBodyRef={(ref) => updateProject((p) => addBodyRef(p, char.id, ref))}
            onRemoveBodyRef={(refId) =>
              updateProject((p) => removeBodyRef(p, char.id, refId))
            }
            showToast={showToast}
          />
        ))}
      </div>
    </section>
  );
}

// ============================================================================
// CHARACTER CARD
// ============================================================================

interface CastFilmCardProps {
  character: FilmCharacter;
  onUpdate: (updates: Partial<FilmCharacter>) => void;
  onRemove: () => void;
  onAddFaceRef: (ref: FilmImageRef) => void;
  onRemoveFaceRef: (refId: string) => void;
  onAddBodyRef: (ref: FilmImageRef) => void;
  onRemoveBodyRef: (refId: string) => void;
  showToast: (message: string, type?: "info" | "success" | "error") => void;
}

function CastFilmCard({
  character,
  onUpdate,
  onRemove,
  onAddFaceRef,
  onRemoveFaceRef,
  onAddBodyRef,
  onRemoveBodyRef,
  showToast,
}: CastFilmCardProps) {
  const [editMode, setEditMode] = useState(!character.name);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  // Concept Sheet workflow state
  const [conceptPromptText, setConceptPromptText] = useState<string | null>(null);
  const sheetFileInputRef = useRef<HTMLInputElement | null>(null);
  // GPT Image 2 in-app generation state
  const [isGeneratingSheet, setIsGeneratingSheet] = useState(false);
  const project = useAppStore((s) => s.currentProject);

  // Avatar — always emoji based on role (no longer derived from conceptSheet image)
  const initialLetter = character.name.trim().charAt(0).toUpperCase();
  const avatarContent = ROLE_EMOJI[character.role] ?? initialLetter ?? String(character.order);

  /**
   * Build the AI Concept Prompt and open modal.
   * The user copies the prompt + pastes into ChatGPT/Banana Pro/Imagen
   * to generate a character reference sheet image.
   */
  async function handleShowConceptPrompt() {
    if (!project) return;
    const setting = (project as any).settingV2 as
      | import("../types/project").ProjectSettingV2
      | undefined;
    if (!setting) {
      showToast("Project setting missing — vào Project Setting để cấu hình", "error");
      return;
    }
    const ideaText = (project as any).idea?.raw as string | undefined;
    const { buildCharacterSheetPrompt } = await import("../engine/characterSheetPrompt");
    const prompt = buildCharacterSheetPrompt({
      character: { name: character.name, role: character.role, description: character.description },
      ideaText,
      setting: {
        animationStyle: setting.animationStyle,
        genre: setting.genre,
        aspectRatio: setting.aspectRatio,
      },
    });
    setConceptPromptText(prompt);
  }

  /**
   * Trigger file picker for concept sheet upload.
   */
  function handleUploadConceptSheet() {
    sheetFileInputRef.current?.click();
  }

  /**
   * Handle file selected from picker — read as dataURL + store as conceptSheet.
   */
  async function handleSheetFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected
    e.target.value = "";

    if (!file.type.startsWith("image/")) {
      showToast("File phải là ảnh (PNG / JPG / WEBP)", "error");
      return;
    }
    // Size guard ~8MB (concept sheets are usually 1-4 MB)
    if (file.size > 8 * 1024 * 1024) {
      showToast("Ảnh quá lớn (>8MB). Giảm dung lượng trước khi upload.", "error");
      return;
    }

    try {
      const dataUrl = await readFileAsDataURL(file);
      onUpdate({
        conceptSheet: {
          id: `sheet_${Date.now().toString(36)}`,
          label: "concept sheet",
          filename: file.name,
          mimeType: file.type,
          dataUrl,
        },
      } as Partial<FilmCharacter>);
      showToast("Concept sheet đã upload", "success");
    } catch (err) {
      showToast(`Upload lỗi: ${(err as Error).message}`, "error");
    }
  }

  /**
   * Generate concept sheet in-app via GPT Image 2 API.
   * User can click this directly OR fall back to the copy-paste flow
   * (handleShowConceptPrompt) which paste into ChatGPT/Banana Pro manually.
   */
  async function handleGenerateSheetInApp() {
    if (!project) return;
    const setting = (project as any).settingV2 as
      | import("../types/project").ProjectSettingV2
      | undefined;
    if (!setting) {
      showToast("Project setting missing — vào Project Setting để cấu hình", "error");
      return;
    }
    if (!character.description.trim()) {
      showToast("Cần điền description trước khi sinh sheet (click ✨ Generate Character Description)", "info");
      return;
    }
    // Cache confirm if sheet exists
    if (character.conceptSheet) {
      const ok = confirm(
        `Concept sheet đã có. Sinh mới sẽ ghi đè ảnh hiện tại và tốn ~$0.21 (GPT Image 2 high).\n\nClick OK để tiếp tục, Cancel để giữ ảnh hiện tại.`
      );
      if (!ok) return;
    }

    const ideaText = (project as any).idea?.raw as string | undefined;
    const { buildCharacterSheetPrompt } = await import("../engine/characterSheetPrompt");
    const prompt = buildCharacterSheetPrompt({
      character: { name: character.name, role: character.role, description: character.description },
      ideaText,
      setting: {
        animationStyle: setting.animationStyle,
        genre: setting.genre,
        aspectRatio: setting.aspectRatio,
      },
    });

    setIsGeneratingSheet(true);
    try {
      const { generateCharacterSheet } = await import("../engine/gptImageApi");
      const quality = (setting as any).imageGenQuality ?? "high";
      const result = await generateCharacterSheet({
        prompt,
        size: "1536x1024",
        quality,
      });
      onUpdate({
        conceptSheet: {
          id: `sheet_${Date.now().toString(36)}`,
          label: "concept sheet",
          filename: `${character.name || "character"}-sheet.png`,
          mimeType: "image/png",
          dataUrl: result.dataUrl,
        },
      } as Partial<FilmCharacter>);
      const costStr = result.costEstimateUsd != null ? ` · ~$${result.costEstimateUsd.toFixed(3)}` : "";
      showToast(`Concept sheet đã sinh xong (GPT Image 2 ${quality})${costStr}`, "success");
    } catch (err) {
      showToast(`Generate Concept Image lỗi: ${(err as Error).message}`, "error");
    } finally {
      setIsGeneratingSheet(false);
    }
  }

  async function handleAIGenerateDescription() {
    if (!project) return;
    const setting = (project as any).settingV2 as import("../types/project").ProjectSettingV2 | undefined;
    if (!setting) {
      showToast("Project setting missing", "error");
      return;
    }
    const film = ensureFilmData(project);

    // Cache confirm
    if (character.description.trim().length > 0) {
      const ok = confirm(
        `Mô tả đã có ${character.description.trim().length} ký tự. Sinh lại sẽ tốn 1 AI call và ghi đè mô tả hiện tại.\n\nClick OK để tiếp tục, Cancel để giữ nguyên.`
      );
      if (!ok) return;
    }

    setIsGeneratingDesc(true);
    try {
      const idea = project.idea?.raw ?? "";
      if (!idea.trim() && !character.name.trim()) {
        showToast("Cần có Name hoặc Idea để AI sinh mô tả", "info");
        return;
      }
      const provider: FilmScriptProvider =
        (setting.aiProviders?.scriptWriter ?? "gemini-flash") as FilmScriptProvider;
      const desc = await generateCharacterDescription({
        character,
        idea,
        script: film.script,
        setting,
        provider,
      });
      onUpdate({ description: desc, descriptionGeneratedAt: Date.now() });
      const scriptHint = film.script ? " (đã dùng script context)" : "";
      showToast(`Đã tạo mô tả ${desc.length} ký tự${scriptHint}`, "success");
    } catch (err) {
      showToast(`AI sinh mô tả lỗi: ${(err as Error).message}`, "error");
    } finally {
      setIsGeneratingDesc(false);
    }
  }

  return (
    <div className="ksp-cast-film-card" data-role={character.role}>
      <div className="ksp-cast-film-body">
        {/* Header row: emoji avatar + name/role + edit/remove */}
        <div className="ksp-cast-film-header-row">
          <div className="ksp-cast-film-avatar">
            <span className="ksp-cast-film-avatar-emoji">{avatarContent}</span>
          </div>

          {editMode ? (
            <div className="ksp-cast-film-header-edit">
              <input
                type="text"
                className="ksp-input ksp-input-sm"
                placeholder={`Character ${character.order} (e.g. Robot, Chim sẻ rừng)`}
                value={character.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                autoFocus
              />
              <select
                className="ksp-select ksp-select-sm"
                value={character.role}
                onChange={(e) =>
                  onUpdate({ role: e.target.value as FilmCharacterRole })
                }
              >
                {(["protagonist", "antagonist", "companion", "extra"] as FilmCharacterRole[]).map(
                  (r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r].vi}
                    </option>
                  )
                )}
              </select>
            </div>
          ) : (
            <div className="ksp-cast-film-header-view">
              <div className="ksp-cast-film-name">
                {character.name || `Character ${character.order}`}
              </div>
              <div className="ksp-cast-film-role">
                {ROLE_LABELS[character.role]?.vi ?? character.role}
              </div>
            </div>
          )}

          <div className="ksp-cast-film-actions">
            <button
              type="button"
              className="ksp-btn ksp-cast-film-edit-btn"
              onClick={() => setEditMode(!editMode)}
              title={editMode ? "Xong" : "Sửa name + role"}
            >
              {editMode ? "✓" : "edit"}
            </button>
            <button
              type="button"
              className="ksp-btn ksp-cast-film-remove-btn"
              onClick={onRemove}
              title="Xóa character"
            >
              ×
            </button>
          </div>
        </div>

        {/* Concept Sheet display — always visible, red warning if empty */}
        <ConceptSheetPanel
          character={character}
          onUpdate={onUpdate}
          showToast={showToast}
        />

        {/* Manual workflow row — Copy Prompt + Upload */}
        <div className="ksp-cast-film-sheet-actions">
          <button
            type="button"
            className="ksp-cast-film-action-btn primary"
            onClick={() => handleShowConceptPrompt()}
            title="📋 Sinh prompt copy-paste ra ChatGPT / Banana Pro / Imagen / Midjourney để tạo character sheet (free, manual)"
          >
            📋 Copy Prompt
          </button>
          <button
            type="button"
            className="ksp-cast-film-action-btn"
            onClick={() => handleUploadConceptSheet()}
            title="Upload concept sheet PNG/JPG/WEBP từ máy"
          >
            📤 Upload
          </button>
        </div>

        {/* Description */}
        <div className="ksp-cast-film-desc-label">Mô tả nhân vật</div>
        <textarea
          className="ksp-cast-film-description"
          placeholder="Mô tả character (VD: Robot bipedal cao 1m8, vỏ kim loại bạc cũ phủ rêu, mắt LED xanh dịu...)."
          value={character.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          rows={4}
        />

        {/* AI generation row — Generate Concept Image + Generate Character Description */}
        <div className="ksp-cast-film-ai-actions">
          <button
            type="button"
            className="ksp-cast-film-action-btn"
            onClick={() => handleGenerateSheetInApp()}
            disabled={isGeneratingSheet}
            title="🎨 Sinh ngay bằng GPT Image 2 API (~$0.21 high quality, ~30s)"
          >
            {isGeneratingSheet ? "⏳ Đang sinh..." : "🎨 Generate Concept Image"}
          </button>
          <button
            type="button"
            className="ksp-cast-film-action-btn"
            onClick={handleAIGenerateDescription}
            disabled={isGeneratingDesc}
            title="✨ AI sinh description từ Name + Role + Idea + Script"
          >
            {isGeneratingDesc ? "⏳ Đang sinh..." : "✨ Generate Character Description"}
          </button>
        </div>

        {/* Concept prompt modal — shows copyable prompt for external AI image gen */}
        {conceptPromptText && (
          <ConceptPromptModal
            promptText={conceptPromptText}
            onClose={() => setConceptPromptText(null)}
            showToast={showToast}
          />
        )}

        {/* Hidden file input for sheet upload */}
        <input
          type="file"
          ref={sheetFileInputRef}
          accept="image/png,image/jpeg,image/webp"
          style={{ display: "none" }}
          onChange={handleSheetFileSelected}
        />
      </div>
    </div>
  );
}

// ============================================================================
// REFS EXPANDED PANEL — grid + [+] upload + [✨] AI generate
// ============================================================================

interface RefsExpandedPanelProps {
  kind: RefKind;
  label: string;
  colorAccent: string;
  refs: FilmImageRef[];
  maxRefs: number;
  defaultLabels: readonly string[];
  character: FilmCharacter;
  onAdd: (ref: FilmImageRef) => void;
  onRemove: (refId: string) => void;
  showToast: (message: string, type?: "info" | "success" | "error") => void;
}

function RefsExpandedPanel({
  kind,
  label,
  colorAccent,
  refs,
  maxRefs,
  defaultLabels,
  character,
  onAdd,
  onRemove,
  showToast,
}: RefsExpandedPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const project = useAppStore((s) => s.currentProject);

  const nextMissingLabel = findNextMissingLabel(refs, defaultLabels);
  const canAdd = refs.length < maxRefs;
  const canAIGen = canAdd && !!nextMissingLabel;

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataURL(file);
      const dim = await getImageDimensions(dataUrl);
      // Use next missing label if available, otherwise blank
      const labelToUse = nextMissingLabel ?? defaultLabels[refs.length] ?? undefined;
      const newRef = createFilmImageRef(
        file.name,
        file.type,
        dataUrl,
        labelToUse,
        dim.width,
        dim.height
      );
      onAdd(newRef);
      showToast(
        `Đã upload ${file.name}${dim.width < 1024 ? " (⚠ <1024px)" : ""}`,
        dim.width < 1024 ? "info" : "success"
      );
    } catch (err) {
      showToast(`Upload failed: ${(err as Error).message}`, "error");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleAIGenerate() {
    if (!project || !nextMissingLabel) return;
    const setting = (project as any).settingV2 as import("../types/project").ProjectSettingV2 | undefined;
    if (!setting) {
      showToast("Project setting missing", "error");
      return;
    }

    if (!character.description.trim()) {
      showToast("Cần có mô tả character trước. Nhấn ✨ ở row buttons để AI sinh mô tả.", "info");
      return;
    }

    // Cost confirmation
    const ok = confirm(
      `Sinh ${label.toLowerCase()} cho góc "${nextMissingLabel}" bằng Imagen 4 Standard.\nCost: ~$0.04 / ảnh.\n\nClick OK để tiếp tục, Cancel để hủy.`
    );
    if (!ok) return;

    setIsGenerating(true);
    try {
      const newRef = await generateCharacterRefImage({
        character,
        kind,
        angle: nextMissingLabel,
        setting,
      });
      onAdd(newRef);
      showToast(`Đã sinh ${label} (${nextMissingLabel}) bằng Imagen 4`, "success");
    } catch (err) {
      showToast(`AI sinh ảnh lỗi: ${(err as Error).message}`, "error");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="ksp-cast-film-refs-expanded" style={{ borderLeftColor: colorAccent }}>
      <div className="ksp-cast-film-refs-expanded-label">
        {label} ({refs.length}/{maxRefs})
        {nextMissingLabel && (
          <span className="ksp-cast-film-refs-next-hint">
            · ✨ sẽ sinh: <strong>{nextMissingLabel}</strong>
          </span>
        )}
      </div>
      <div className="ksp-cast-film-refs-grid">
        {refs.map((ref) => (
          <div key={ref.id} className="ksp-cast-film-ref-slot">
            <img src={ref.dataUrl} alt={ref.label ?? ref.filename} />
            <span className="ksp-cast-film-ref-label">{ref.label ?? ""}</span>
            <button
              type="button"
              className="ksp-cast-film-ref-remove"
              onClick={() => onRemove(ref.id)}
              title="Xóa ref"
            >
              ×
            </button>
          </div>
        ))}
        {canAdd && (
          <>
            <button
              type="button"
              className="ksp-cast-film-ref-add"
              onClick={() => fileInputRef.current?.click()}
              title="Upload ảnh từ máy"
              aria-label="Upload ảnh"
            >
              +
            </button>
            <button
              type="button"
              className="ksp-cast-film-ref-aigen"
              onClick={handleAIGenerate}
              disabled={isGenerating || !canAIGen}
              title={
                isGenerating
                  ? "Đang sinh..."
                  : nextMissingLabel
                  ? `✨ AI sinh ${label.toLowerCase()} cho góc "${nextMissingLabel}" (Imagen 4 Standard, $0.04/ảnh)`
                  : "Đã đủ ảnh, không còn slot trống"
              }
              aria-label="AI sinh ảnh"
            >
              {isGenerating ? "⏳" : "✨"}
            </button>
          </>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={handleFileUpload}
      />
    </div>
  );
}

// ============================================================================
// CONCEPT SHEET PANEL — displays the uploaded character reference sheet
// ============================================================================

interface ConceptSheetPanelProps {
  character: FilmCharacter;
  onUpdate: (updates: Partial<FilmCharacter>) => void;
  showToast: (msg: string, type?: "info" | "success" | "error") => void;
}

function ConceptSheetPanel({ character, onUpdate, showToast }: ConceptSheetPanelProps) {
  const sheet = character.conceptSheet;

  function handleRemove() {
    if (!confirm("Xóa concept sheet?")) return;
    onUpdate({ conceptSheet: undefined } as Partial<FilmCharacter>);
    showToast("Đã xóa concept sheet", "info");
  }

  if (!sheet) {
    return (
      <div className="ksp-cast-film-sheet-empty" role="alert">
        <div className="ksp-cast-film-sheet-empty-icon">⚠</div>
        <div className="ksp-cast-film-sheet-empty-text">
          Chưa có concept sheet. Click <strong>📋 Copy Prompt</strong> để sinh prompt copy-paste,{" "}
          hoặc <strong>📤 Upload</strong> để tải ảnh lên,{" "}
          hoặc <strong>🎨 Generate Concept Image</strong> để sinh ngay bằng AI.
        </div>
      </div>
    );
  }

  return (
    <div className="ksp-cast-film-sheet-display">
      <img
        className="ksp-cast-film-sheet-img"
        src={sheet.dataUrl}
        alt={`${character.name || "Character"} concept sheet`}
      />
      <button
        type="button"
        className="ksp-cast-film-sheet-remove"
        onClick={handleRemove}
        title="Xóa concept sheet"
        aria-label="Xóa concept sheet"
      >
        ×
      </button>
    </div>
  );
}

// ============================================================================
// CONCEPT PROMPT MODAL — shows copy-pasteable prompt for external AI image gen
// ============================================================================

interface ConceptPromptModalProps {
  promptText: string;
  onClose: () => void;
  showToast: (msg: string, type?: "info" | "success" | "error") => void;
}

function ConceptPromptModal({ promptText, onClose, showToast }: ConceptPromptModalProps) {
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(promptText);
      showToast("Prompt đã copy. Paste vào ChatGPT / Banana Pro / Imagen để sinh ảnh.", "success");
    } catch (err) {
      showToast(`Copy lỗi: ${(err as Error).message}`, "error");
    }
  }

  return (
    <div className="ksp-cast-film-prompt-modal-backdrop" onClick={onClose}>
      <div className="ksp-cast-film-prompt-modal" onClick={(e) => e.stopPropagation()}>
        <header className="ksp-cast-film-prompt-modal-header">
          <h3>🤖 AI Concept Prompt</h3>
          <button
            type="button"
            className="ksp-cast-film-prompt-modal-close"
            onClick={onClose}
            aria-label="Đóng"
          >
            ×
          </button>
        </header>

        <p className="ksp-cast-film-prompt-modal-hint">
          Copy prompt dưới đây → paste vào <strong>ChatGPT</strong> /{" "}
          <strong>Banana Pro</strong> / <strong>Imagen</strong> / <strong>Midjourney</strong>{" "}
          → tải ảnh sinh ra → click <strong>📤 Upload sheet</strong> để lưu làm reference.
        </p>

        <textarea
          className="ksp-cast-film-prompt-modal-textarea"
          value={promptText}
          readOnly
          rows={18}
          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
        />

        <div className="ksp-cast-film-prompt-modal-actions">
          <button
            type="button"
            className="ksp-btn ksp-btn-primary"
            onClick={handleCopy}
          >
            📋 Copy prompt
          </button>
          <button type="button" className="ksp-btn" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.readAsDataURL(file);
  });
}

function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Image decode failed"));
    img.src = dataUrl;
  });
}
