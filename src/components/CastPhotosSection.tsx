/**
 * KSP Image v0.9.1 — Cast Photos Section
 *
 * Photos mode Cast UI (replaces Film mode CastSectionV09 when project.settingV2.mode === "photos").
 *
 * Per cast member:
 *   - Subject Type dropdown (5 types: Female / Male / Couple / Family / Friends Group)
 *   - Display name (optional)
 *   - Face refs grid: dynamic 1-6 slots with progressive disclosure
 *     - Slot 0 always "front" (primary anchor — locked label)
 *     - Slots 1-5: user-editable labels (3/4 L, 3/4 R, profile, ...)
 *     - "+ Thêm face" button enabled only when last slot is filled and count < 6
 *   - 1 outfit slot (optional)
 *   - Remove button
 */

import React, { useRef, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { LibraryPicker } from "./LibraryPicker";
import {
  addCastMember,
  updateCastMember,
  removeCastMember,
  selectCast,
  addFaceRef,
  removeFaceRef,
  relabelFaceRef,
  setOutfitRef,
  ensurePhotosData,
} from "../store/photos_actions";
import {
  MAX_FACE_REFS,
  RECOMMENDED_FACE_REFS,
  MIN_FACE_DIMENSION,
  SUBJECT_TYPE_LABELS,
  type PhotosCastMember,
  type PhotosImageRef,
} from "../types/photos";
import type { SubjectType } from "../types";

export function CastPhotosSection() {
  const project = useAppStore((s) => s.currentProject);
  const updateProject = useAppStore((s) => s.updateCurrentProject);
  const showToast = useAppStore((s) => s.showToast);

  if (!project) return null;
  const photos = ensurePhotosData(project);

  return (
    <section className="ksp-section ksp-cast-photos">
      <header className="ksp-section-header">
        <span className="ksp-section-icon">🎭</span>
        <h2 className="ksp-section-title">CAST</h2>
        <button
          className="ksp-btn ksp-btn-sm ksp-btn-ghost"
          style={{ marginLeft: "auto" }}
          onClick={() => updateProject(addCastMember(project, "female"))}
          type="button"
        >
          + Thêm
        </button>
      </header>

      {photos.cast.length === 0 && (
        <div className="ksp-empty-state">
          <p style={{ fontSize: 12, color: "#888", padding: "12px 14px", margin: 0 }}>
            Chưa có cast. Nhấn <strong>+ Thêm</strong> để tạo subject (Nữ / Nam / Cặp đôi / Gia đình / Nhóm bạn).
          </p>
        </div>
      )}

      {photos.cast.map((cast) => (
        <CastPhotosCard
          key={cast.id}
          cast={cast}
          isSelected={photos.selectedCastId === cast.id}
          onSelect={() => updateProject(selectCast(project, cast.id))}
          onUpdate={(updates) => updateProject(updateCastMember(project, cast.id, updates))}
          onRemove={() => {
            if (confirm(`Xóa cast "${cast.name || `Cast ${cast.order}`}"?`)) {
              updateProject(removeCastMember(project, cast.id));
            }
          }}
          onAddFace={(refData) => {
            updateProject(addFaceRef(project, cast.id, refData));
          }}
          onRemoveFace={(refId) => updateProject(removeFaceRef(project, cast.id, refId))}
          onRelabelFace={(refId, label) =>
            updateProject(relabelFaceRef(project, cast.id, refId, label))
          }
          onSetOutfit={(refData) => {
            updateProject(setOutfitRef(project, cast.id, refData));
          }}
          onClearOutfit={() => updateProject(setOutfitRef(project, cast.id, null))}
        />
      ))}
    </section>
  );
}

// ============================================================================
// CAST CARD
// ============================================================================

function CastPhotosCard({
  cast,
  isSelected,
  onSelect,
  onUpdate,
  onRemove,
  onAddFace,
  onRemoveFace,
  onRelabelFace,
  onSetOutfit,
  onClearOutfit,
}: {
  cast: PhotosCastMember;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<PhotosCastMember>) => void;
  onRemove: () => void;
  onAddFace: (refData: Omit<PhotosImageRef, "id" | "label">) => void;
  onRemoveFace: (refId: string) => void;
  onRelabelFace: (refId: string, label: string) => void;
  onSetOutfit: (refData: Omit<PhotosImageRef, "id" | "label">) => void;
  onClearOutfit: () => void;
}) {
  const showToast = useAppStore((s) => s.showToast);
  const faceInputRef = useRef<HTMLInputElement>(null);
  const outfitInputRef = useRef<HTMLInputElement>(null);
  const canAddFace = cast.faceRefs.length < MAX_FACE_REFS;
  const [pickerCategory, setPickerCategory] = useState<"face" | "outfit" | null>(null);

  // Wrap File upload: convert → refData → callback
  const handleFaceFile = async (file: File) => {
    try {
      const ref = await fileToImageRef(file);
      onAddFace(ref);
    } catch (e: any) {
      showToast(`Upload lỗi: ${e.message}`, "error");
    }
  };
  const handleOutfitFile = async (file: File) => {
    try {
      const ref = await fileToImageRef(file);
      onSetOutfit(ref);
    } catch (e: any) {
      showToast(`Upload lỗi: ${e.message}`, "error");
    }
  };

  // Snip-to-save: send message to background → background injects content script
  // into active tab → user drags region → cropped image lands in Library
  const startSnip = async (category: "face" | "outfit") => {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
      showToast("Snip chỉ hoạt động khi extension đã load (chrome://extensions)", "error");
      return;
    }
    try {
      const response = await chrome.runtime.sendMessage({
        type: "SNIP_START",
        category,
      });
      if (response?.ok === false) {
        showToast(`Snip lỗi: ${response.error || "Không khởi động được"}`, "error");
        return;
      }
      showToast(
        `📷 Sang tab Pinterest/web cần snip → kéo chuột chọn vùng. ESC để hủy.`,
        "success"
      );
    } catch (e: any) {
      showToast(`Snip lỗi: ${e.message}`, "error");
    }
  };

  // Show snip log — debug helper. Reads chrome.storage.local.ksp_snip_log
  const showSnipLog = async () => {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;
    try {
      const response = await chrome.runtime.sendMessage({ type: "SNIP_GET_LOG" });
      const log = response?.log || [];
      if (log.length === 0) {
        alert("Snip log trống. Click 📷 thử trước, rồi xem lại log.");
        return;
      }
      const lines = log.map((e: any) => {
        const time = new Date(e.t).toLocaleTimeString();
        const data = e.data ? " · " + JSON.stringify(e.data).slice(0, 200) : "";
        return `${time}  ${e.step}${data}`;
      });
      alert(`KSP Snip Log (${log.length} steps):\n\n${lines.join("\n")}`);
    } catch (e: any) {
      alert(`Không đọc được log: ${e?.message || e}`);
    }
  };

  const clearSnipLog = async () => {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;
    await chrome.runtime.sendMessage({ type: "SNIP_CLEAR_LOG" });
    showToast("Đã xóa snip log", "success");
  };

  // Listen for SNIP_DONE message from background — shows success toast
  React.useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.runtime?.onMessage) return;
    const handler = (msg: any) => {
      if (msg?.type === "SNIP_DONE") {
        showToast(
          `📷 Đã snip ${msg.width}×${msg.height}px vào Library (${msg.category}). Click 📁 để chọn.`,
          "success"
        );
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => {
      try {
        chrome.runtime.onMessage.removeListener(handler);
      } catch {
        // ignore
      }
    };
  }, [showToast]);

  return (
    <div
      className={`ksp-cast-photos-card ${isSelected ? "ksp-cast-photos-selected" : ""}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
    >
      <div className="ksp-cast-photos-row" onClick={(e) => e.stopPropagation()}>
        <select
          value={cast.subjectType}
          onChange={(e) => onUpdate({ subjectType: e.target.value as SubjectType })}
          className="ksp-select ksp-cast-type-select"
          aria-label="Subject type"
        >
          {Object.entries(SUBJECT_TYPE_LABELS).map(([value, l]) => (
            <option key={value} value={value}>
              {l.emoji} {l.vi}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={cast.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder={`Cast ${cast.order}`}
          className="ksp-input ksp-cast-name-input"
        />
        <button
          type="button"
          className="ksp-btn-icon"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="Remove cast"
          aria-label="Remove cast"
        >
          ✕
        </button>
      </div>

      <div
        className="ksp-cast-photos-block"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ksp-ref-label">
          Face refs · {cast.faceRefs.length}/{MAX_FACE_REFS}
          {cast.faceRefs.length > 0 && cast.faceRefs.length < RECOMMENDED_FACE_REFS && (
            <span className="ksp-hint-warning">
              {" "}· thêm {RECOMMENDED_FACE_REFS - cast.faceRefs.length} ảnh nữa để Identity Lock tốt hơn
            </span>
          )}
        </div>
        <div className="ksp-face-grid">
          {cast.faceRefs.map((ref, idx) => (
            <FaceSlot
              key={ref.id}
              imageRef={ref}
              isFirst={idx === 0}
              onRemove={() => onRemoveFace(ref.id)}
              onRelabel={(label) => onRelabelFace(ref.id, label)}
            />
          ))}
          {canAddFace && (
            <button
              type="button"
              className="ksp-face-slot ksp-face-slot-add"
              onClick={() => faceInputRef.current?.click()}
              title={`Upload face ref ${cast.faceRefs.length + 1}/${MAX_FACE_REFS}`}
            >
              <span className="ksp-face-slot-plus">＋</span>
              <span className="ksp-face-slot-label">add</span>
            </button>
          )}
        </div>
        <input
          type="file"
          accept="image/*"
          ref={faceInputRef}
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFaceFile(file);
            e.target.value = "";
          }}
        />
        {canAddFace && (
          <div className="ksp-ref-action-icons">
            <button
              type="button"
              className="ksp-btn-ref-icon"
              onClick={() => setPickerCategory("face")}
              title="Chọn face từ Library"
              aria-label="Chọn từ Library"
            >
              📁
            </button>
            <button
              type="button"
              className="ksp-btn-ref-icon"
              onClick={() => startSnip("face")}
              title="Snip vùng từ trang web (Pinterest, etc.)"
              aria-label="Snip vùng"
            >
              📷
            </button>
          </div>
        )}
        <p className="ksp-cast-hint">
          Slot 1 = front view (primary). Khuyến nghị {RECOMMENDED_FACE_REFS}+ ảnh: front + 3/4 L + 3/4 R · ≥{MIN_FACE_DIMENSION}×{MIN_FACE_DIMENSION}px
        </p>
      </div>

      <div
        className="ksp-cast-photos-block"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ksp-ref-label">Outfit ref · optional</div>
        <div className="ksp-outfit-row">
          {cast.outfitRef ? (
            <div className="ksp-outfit-preview">
              <img src={cast.outfitRef.dataUrl} alt="Outfit" />
              <button
                type="button"
                className="ksp-btn-icon-overlay"
                onClick={onClearOutfit}
                title="Remove outfit"
                aria-label="Remove outfit"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="ksp-outfit-slot"
              onClick={() => outfitInputRef.current?.click()}
              title="Upload outfit (optional)"
            >
              <span>👗</span>
              <span>outfit</span>
            </button>
          )}
        </div>
        <input
          type="file"
          accept="image/*"
          ref={outfitInputRef}
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleOutfitFile(file);
            e.target.value = "";
          }}
        />
        {!cast.outfitRef && (
          <div className="ksp-ref-action-icons">
            <button
              type="button"
              className="ksp-btn-ref-icon"
              onClick={() => setPickerCategory("outfit")}
              title="Chọn outfit từ Library"
              aria-label="Chọn từ Library"
            >
              📁
            </button>
            <button
              type="button"
              className="ksp-btn-ref-icon"
              onClick={() => startSnip("outfit")}
              title="Snip vùng outfit từ trang web (Pinterest, etc.)"
              aria-label="Snip vùng"
            >
              📷
            </button>
          </div>
        )}
      </div>

      {/* Brand specificity field — KSP A+ improvement (Apple Watch, Honda Vision, accessory products) */}
      <div
        className="ksp-cast-photos-block"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ksp-ref-label">Brand & accessories · optional</div>
        <input
          type="text"
          className="ksp-input ksp-cast-brand-input"
          placeholder="VD: Apple Watch white strap, Honda Vision titanium silver, iPhone 15 Pro"
          value={cast.brandSpecificity || ""}
          onChange={(e) => onUpdate({ brandSpecificity: e.target.value })}
          maxLength={300}
        />
        <p className="ksp-cast-hint">
          Đồ hiệu, xe, điện thoại... được chèn vào prompt để render chính xác.
        </p>
      </div>

      {/* Snip debug helper — only visible when user has tried snip at least once */}
      <div
        className="ksp-cast-photos-block ksp-snip-debug"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ksp-ref-label" style={{ fontSize: 10, opacity: 0.7 }}>
          🔧 Snip debug
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            className="ksp-btn ksp-btn-sm ksp-btn-ghost"
            onClick={showSnipLog}
            title="Xem log từng bước của lần snip gần nhất"
            style={{ fontSize: 10 }}
          >
            📋 Show log
          </button>
          <button
            type="button"
            className="ksp-btn ksp-btn-sm ksp-btn-ghost"
            onClick={clearSnipLog}
            title="Xóa log để debug lần snip mới"
            style={{ fontSize: 10 }}
          >
            🗑 Clear log
          </button>
        </div>
        <p className="ksp-cast-hint" style={{ fontSize: 10 }}>
          Nếu snip không hoạt động: clear log → thử lại → click "Show log" để xem step nào fail.
        </p>
      </div>

      {pickerCategory && (
        <LibraryPicker
          category={pickerCategory}
          onPick={(data) => {
            if (pickerCategory === "face") onAddFace(data);
            else onSetOutfit(data);
            setPickerCategory(null);
          }}
          onClose={() => setPickerCategory(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// FACE SLOT
// ============================================================================

function FaceSlot({
  imageRef,
  isFirst,
  onRemove,
  onRelabel,
}: {
  imageRef: PhotosImageRef;
  isFirst: boolean;
  onRemove: () => void;
  onRelabel: (label: string) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draftLabel, setDraftLabel] = React.useState(imageRef.label);

  const commitLabel = () => {
    setEditing(false);
    if (draftLabel.trim() && draftLabel !== imageRef.label) {
      onRelabel(draftLabel.trim().slice(0, 12));
    } else {
      setDraftLabel(imageRef.label);
    }
  };

  return (
    <div className="ksp-face-slot ksp-face-slot-filled">
      <img src={imageRef.dataUrl} alt={imageRef.label} className="ksp-face-slot-img" />
      <button
        type="button"
        className="ksp-btn-icon-overlay"
        onClick={onRemove}
        title="Remove"
        aria-label="Remove face"
      >
        ✕
      </button>
      {editing && !isFirst ? (
        <input
          type="text"
          value={draftLabel}
          onChange={(e) => setDraftLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => e.key === "Enter" && commitLabel()}
          autoFocus
          maxLength={12}
          className="ksp-face-slot-label-input"
        />
      ) : (
        <span
          className="ksp-face-slot-label"
          onClick={() => !isFirst && setEditing(true)}
          title={isFirst ? "front (locked — primary anchor)" : "Click để đổi label"}
        >
          {imageRef.label}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// FILE → IMAGE REF
// ============================================================================

function fileToImageRef(file: File): Promise<Omit<PhotosImageRef, "id" | "label">> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("File phải là ảnh"));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Đọc file thất bại"));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Try to read dimensions
      const img = new Image();
      img.onload = () => {
        resolve({
          filename: file.name,
          mimeType: file.type,
          width: img.naturalWidth,
          height: img.naturalHeight,
          dataUrl,
        });
      };
      img.onerror = () => {
        // Still resolve without dimensions if image decode fails
        resolve({
          filename: file.name,
          mimeType: file.type,
          dataUrl,
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
