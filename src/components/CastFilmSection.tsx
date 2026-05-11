/**
 * KSP Image v0.9.3 — Cast Film Section (Mockup 1 implementation)
 *
 * Film mode Cast UI (replaces deprecated CastSectionV09 when project.settingV2.mode === "film").
 *
 * Spec from MOCKUPS_FILM.md Q1-Q6 lock:
 *   Q1 — Vertical full-width cards stack dọc
 *   Q2 — Role dropdown 4 options, no constraint
 *   Q3 — Face refs 1-4 + Body refs 1-3, NO outfit slot
 *   Q4 — AI Generate stub: modal description prose, no API call
 *
 * Per character card:
 *   - Avatar circle (role-colored)
 *   - Name input + Role dropdown
 *   - Description textarea (prose VN)
 *   - Face refs grid (1-4 slots, click to upload)
 *   - Body refs grid (1-3 slots, click to upload)
 *   - AI Generate button → opens modal (Q4)
 *   - Remove button
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
  setAiGenDescription,
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
} from "../types/film_v093";

// ============================================================================
// MAIN SECTION
// ============================================================================

export function CastFilmSection() {
  const project = useAppStore((s) => s.currentProject);
  const updateProject = useAppStore((s) => s.updateCurrentProject);
  const showToast = useAppStore((s) => s.showToast);

  if (!project) return null;
  const film = ensureFilmData(project);

  return (
    <section className="ksp-section ksp-cast-film">
      <header className="ksp-section-header">
        <span className="ksp-section-icon">🎭</span>
        <h2 className="ksp-section-title">CAST</h2>
        <span style={{ fontSize: 11, color: "#888", marginLeft: 8 }}>
          (nhất quán toàn phim)
        </span>
        <button
          className="ksp-btn ksp-btn-sm ksp-btn-ghost"
          style={{ marginLeft: "auto" }}
          onClick={() => updateProject(addCharacter(project, "protagonist"))}
          type="button"
        >
          + Thêm
        </button>
      </header>

      {film.characters.length === 0 && (
        <div className="ksp-empty-state">
          <p style={{ fontSize: 12, color: "#888", padding: "12px 14px", margin: 0 }}>
            Chưa có character. Nhấn <strong>+ Thêm</strong> để tạo nhân vật mới.
            Mỗi nhân vật có Face refs (1-4) + Body refs (1-3) shared toàn project.
          </p>
        </div>
      )}

      {film.characters.map((char) => (
        <CastFilmCard
          key={char.id}
          character={char}
          onUpdate={(updates) =>
            updateProject(updateCharacter(project, char.id, updates))
          }
          onRemove={() => {
            if (confirm(`Xóa character "${char.name || `Character ${char.order}`}"?`)) {
              updateProject(removeCharacter(project, char.id));
              showToast("Đã xóa character", "info");
            }
          }}
          onAddFaceRef={(ref) => updateProject(addFaceRef(project, char.id, ref))}
          onRemoveFaceRef={(refId) =>
            updateProject(removeFaceRef(project, char.id, refId))
          }
          onAddBodyRef={(ref) => updateProject(addBodyRef(project, char.id, ref))}
          onRemoveBodyRef={(refId) =>
            updateProject(removeBodyRef(project, char.id, refId))
          }
          onSetAiGenDescription={(desc) =>
            updateProject(setAiGenDescription(project, char.id, desc))
          }
          showToast={showToast}
        />
      ))}
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
  onSetAiGenDescription: (desc: string) => void;
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
  onSetAiGenDescription,
  showToast,
}: CastFilmCardProps) {
  const [aiGenModalOpen, setAiGenModalOpen] = useState(false);
  const [aiGenDraft, setAiGenDraft] = useState(character.aiGenDescription ?? "");

  // Avatar display: initial letter của name nếu có, fallback order number
  const avatarText = character.name.trim().charAt(0).toUpperCase() || String(character.order);

  return (
    <div className="ksp-cast-film-card" data-role={character.role}>
      <div className="ksp-cast-film-card-row">
        <div className="ksp-cast-film-body">
          {/* Name + Role row */}
          <div className="ksp-form-row ksp-form-row-2" style={{ marginBottom: 8 }}>
            <input
              type="text"
              className="ksp-input ksp-input-sm"
              placeholder={`Character ${character.order} (e.g. Robot, Chim sẻ rừng)`}
              value={character.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
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

          {/* Description */}
          <textarea
            className="ksp-textarea ksp-textarea-sm"
            placeholder="Mô tả character (VD: Robot bipedal cao 1m8, vỏ kim loại bạc cũ kỹ phủ rêu xanh, mắt LED xanh dịu...)"
            value={character.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            rows={2}
            style={{ width: "100%", marginBottom: 8 }}
          />

          {/* Face refs */}
          <RefsRow
            label={`Face refs · ${character.faceRefs.length}/${MAX_FACE_REFS_FILM}`}
            refs={character.faceRefs}
            maxRefs={MAX_FACE_REFS_FILM}
            defaultLabels={DEFAULT_FACE_LABELS_FILM}
            onAdd={onAddFaceRef}
            onRemove={onRemoveFaceRef}
            colorAccent="#4f7cd4"
            showToast={showToast}
          />

          {/* Body refs */}
          <RefsRow
            label={`Body refs · ${character.bodyRefs.length}/${MAX_BODY_REFS}`}
            refs={character.bodyRefs}
            maxRefs={MAX_BODY_REFS}
            defaultLabels={DEFAULT_BODY_LABELS}
            onAdd={onAddBodyRef}
            onRemove={onRemoveBodyRef}
            colorAccent="#7b89d4"
            showToast={showToast}
          />

          {/* AI Generate stub */}
          <div className="ksp-cast-film-aigen-row">
            <button
              type="button"
              className="ksp-btn ksp-btn-sm ksp-btn-aigen"
              onClick={() => {
                setAiGenDraft(character.aiGenDescription ?? "");
                setAiGenModalOpen(true);
              }}
            >
              ✨ AI Generate
              {character.aiGenDescription && (
                <span className="ksp-cast-film-aigen-badge">đã có mô tả</span>
              )}
            </button>
          </div>
        </div>

        <button
          type="button"
          className="ksp-btn ksp-btn-icon ksp-btn-ghost ksp-cast-film-remove"
          onClick={onRemove}
          title="Xóa character"
        >
          ×
        </button>
      </div>

      {/* AI Generate Modal (Q4 — save description, no API call) */}
      {aiGenModalOpen && (
        <AiGenerateModal
          characterName={character.name || `Character ${character.order}`}
          initialDescription={aiGenDraft}
          onSave={(desc) => {
            onSetAiGenDescription(desc);
            setAiGenModalOpen(false);
            showToast(
              "Đã lưu mô tả AI Generate (API wire ở Sprint 0.9.4)",
              "success"
            );
          }}
          onCancel={() => setAiGenModalOpen(false)}
        />
      )}
    </div>
  );
}

// ============================================================================
// REFS ROW (Face or Body)
// ============================================================================

interface RefsRowProps {
  label: string;
  refs: FilmImageRef[];
  maxRefs: number;
  defaultLabels: string[];
  onAdd: (ref: FilmImageRef) => void;
  onRemove: (refId: string) => void;
  colorAccent: string;
  showToast: (message: string, type?: "info" | "success" | "error") => void;
}

function RefsRow({
  label,
  refs,
  maxRefs,
  defaultLabels,
  onAdd,
  onRemove,
  colorAccent,
  showToast,
}: RefsRowProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await readFileAsDataURL(file);
      const dim = await getImageDimensions(dataUrl);
      const newRef = createFilmImageRef(
        file.name,
        file.type,
        dataUrl,
        defaultLabels[refs.length] ?? undefined,
        dim.width,
        dim.height
      );
      onAdd(newRef);
      showToast(
        `Đã upload ${file.name}${dim.width < 1024 ? " (⚠ dưới 1024px)" : ""}`,
        dim.width < 1024 ? "info" : "success"
      );
    } catch (err) {
      showToast(`Upload failed: ${(err as Error).message}`, "error");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="ksp-cast-film-refs-row" style={{ borderLeftColor: colorAccent }}>
      <div className="ksp-cast-film-refs-label">{label}</div>
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
        {refs.length < maxRefs && (
          <button
            type="button"
            className="ksp-cast-film-ref-add"
            onClick={() => fileInputRef.current?.click()}
            title={`Thêm ${label.split(" ")[0].toLowerCase()} ref`}
          >
            +
          </button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={handleFileSelect}
      />
    </div>
  );
}

// ============================================================================
// AI GENERATE MODAL (Q4 stub)
// ============================================================================

interface AiGenerateModalProps {
  characterName: string;
  initialDescription: string;
  onSave: (desc: string) => void;
  onCancel: () => void;
}

function AiGenerateModal({
  characterName,
  initialDescription,
  onSave,
  onCancel,
}: AiGenerateModalProps) {
  const [desc, setDesc] = useState(initialDescription);

  return (
    <div className="ksp-modal-backdrop" onClick={onCancel}>
      <div
        className="ksp-modal ksp-modal-aigen"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ksp-modal-header">
          <h3>✨ AI Generate — {characterName}</h3>
          <button type="button" className="ksp-btn-close" onClick={onCancel}>
            ×
          </button>
        </div>
        <div className="ksp-modal-body">
          <p style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
            Mô tả character chi tiết để AI generate face/body refs ở Sprint 0.9.4
            (Imagen 4 wire). Hiện tại chỉ lưu mô tả vào schema — chưa call API.
          </p>
          <textarea
            className="ksp-textarea"
            placeholder="VD: Robot bipedal cao 1m8, vỏ kim loại bạc, mắt LED xanh dịu, thiết kế retrofuturist 1970s, vai vuông vức, ngực có panel năng lượng phát sáng nhẹ..."
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={6}
            style={{ width: "100%" }}
          />
        </div>
        <div className="ksp-modal-footer">
          <button
            type="button"
            className="ksp-btn ksp-btn-ghost"
            onClick={onCancel}
          >
            Hủy
          </button>
          <button
            type="button"
            className="ksp-btn ksp-btn-primary"
            onClick={() => onSave(desc.trim())}
            disabled={desc.trim().length === 0}
          >
            Lưu mô tả
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
