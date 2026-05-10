/**
 * KSP Image v0.9.1 — Photos Image Gen Section
 *
 * Step 2 in Photos pipeline. List view (per Jason design):
 *   - Cast pick dropdown (which cast feeds prompts)
 *   - Number of shots dropdown (3 / 6 / 9)
 *   - "Auto-pick angles khác nhau" button → regenerate shots with varied angle presets
 *   - Per-shot row: 2 mini thumbs (face + outfit) + angle name + meta + copy/download icons
 *
 * Copy = entire 13-block prompt (EN) to clipboard.
 * Download = ZIP with face refs (face-1.jpg, face-2.jpg, ...) + outfit.jpg
 *            named for direct paste into Banana Pro slot #1, #2, ...
 */

import React, { useMemo, useState } from "react";
import JSZip from "jszip";
import { useAppStore } from "../store/useAppStore";
import {
  ensurePhotosData,
  selectCast,
  autoPickShots,
  removeShot,
  addShot,
  updateShot,
  setCustomPose,
} from "../store/photos_actions";
import {
  buildPhotosShotPrompt,
  buildAllPhotosPrompts,
} from "../engine/photosPromptBuilder";
import { ANGLE_PRESETS, getAngleById } from "../engine/angles";
import { POSES, POSE_CATEGORIES, getPoseById, type PoseCategory } from "../engine/poses_a_plus";
import { SUBJECT_TYPE_LABELS, type PhotosShot } from "../types/photos_v091";

const SHOT_COUNT_OPTIONS = [3, 6, 9];

export function PhotosImageGenSection() {
  const project = useAppStore((s) => s.currentProject);
  const updateProject = useAppStore((s) => s.updateCurrentProject);
  const showToast = useAppStore((s) => s.showToast);

  if (!project) return null;
  const photos = ensurePhotosData(project);

  const [requestedCount, setRequestedCount] = useState(6);
  // Pose: "auto" = vary all 100 · category id (e.g. "walking") = vary within · pose id = exact pose
  const [poseSelection, setPoseSelection] = useState<string>("auto");
  // Angle: "auto" = vary 12 · angle id = exact
  const [angleSelection, setAngleSelection] = useState<string>("auto");
  // Per-shot edit popup state
  const [editingShotId, setEditingShotId] = useState<string | null>(null);

  const selectedCast = photos.cast.find((c) => c.id === photos.selectedCastId) ?? photos.cast[0];

  // Pre-build all prompts once per render so each row gets cached prompt for copy
  const allPrompts = useMemo(
    () => (selectedCast ? buildAllPhotosPrompts(project) : new Map()),
    [project, selectedCast]
  );

  const onCopyPrompt = (shot: PhotosShot) => {
    const cached = allPrompts.get(shot.id);
    const prompt = cached?.prompt ?? buildPhotosShotPrompt(project, shot)?.prompt;
    if (!prompt) {
      showToast("Không build được prompt — kiểm tra Cast + Theme", "error");
      return;
    }
    navigator.clipboard.writeText(prompt).then(
      () => showToast(`Đã copy prompt shot ${shot.order} (${prompt.length} chars)`, "success"),
      () => showToast("Copy lỗi — clipboard permission?", "error")
    );
  };

  const onDownloadRefs = async (shot: PhotosShot) => {
    if (!selectedCast) {
      showToast("Cần chọn cast trước", "error");
      return;
    }
    if (selectedCast.faceRefs.length === 0) {
      showToast("Cast chưa có face ref nào", "error");
      return;
    }
    try {
      const zip = new JSZip();
      const totalRefs = selectedCast.faceRefs.length + (selectedCast.outfitRef ? 1 : 0);
      // Helper: zero-pad to 2 digits (01, 02, ..., 09, 10) — matches prompt's "01_, 02_, 03_" convention
      const pad = (n: number) => String(n).padStart(2, "0");
      // Helper: sanitize face label for filename (no spaces, no special chars)
      const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

      // Face refs: 01_face_front.jpg, 02_face_3-4-l.jpg, ...
      selectedCast.faceRefs.forEach((ref, idx) => {
        const ext = inferExt(ref.mimeType);
        const data = dataUrlToBase64(ref.dataUrl);
        const labelSlug = slug(ref.label) || `view-${idx + 1}`;
        zip.file(`${pad(idx + 1)}_face_${labelSlug}${ext}`, data, { base64: true });
      });
      // Outfit: 0N_outfit.jpg (N = faceCount + 1)
      if (selectedCast.outfitRef) {
        const ext = inferExt(selectedCast.outfitRef.mimeType);
        const data = dataUrlToBase64(selectedCast.outfitRef.dataUrl);
        const idx = selectedCast.faceRefs.length + 1;
        zip.file(`${pad(idx)}_outfit${ext}`, data, { base64: true });
      }
      // README listing slot order — match new filename convention
      const readme = buildRefsReadme(selectedCast, shot);
      zip.file("README.txt", readme);

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const angle = getAngleById(shot.anglePresetId);
      a.href = url;
      a.download = `refs-shot${shot.order}-${angle?.id ?? "unknown"}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast(`Đã download ${totalRefs} refs (zip với prefix 01_, 02_, ...)`, "success");
    } catch (e: any) {
      showToast(`Download lỗi: ${e.message}`, "error");
    }
  };

  return (
    <section className="ksp-section ksp-photos-imgen">
      <header className="ksp-section-header">
        <span className="ksp-step-num">2.</span>
        <span className="ksp-section-icon">🖼</span>
        <h2 className="ksp-section-title">IMAGE GEN</h2>
      </header>

      <div className="ksp-photos-imgen-body">
        {/* Cast + Shot count */}
        <div className="ksp-form-row ksp-form-row-2">
          <label className="ksp-label">
            <span className="ksp-label-text">Cast pick</span>
            <select
              value={photos.selectedCastId ?? ""}
              onChange={(e) => {
                if (e.target.value) updateProject(selectCast(project, e.target.value));
              }}
              className="ksp-select"
              disabled={photos.cast.length === 0}
            >
              {photos.cast.length === 0 && <option value="">— chưa có cast —</option>}
              {photos.cast.map((c) => {
                const l = SUBJECT_TYPE_LABELS[c.subjectType];
                return (
                  <option key={c.id} value={c.id}>
                    {l.emoji} {c.name || `Cast ${c.order}`} · {l.vi}
                  </option>
                );
              })}
            </select>
          </label>

          <label className="ksp-label">
            <span className="ksp-label-text">Số shot</span>
            <select
              value={requestedCount}
              onChange={(e) => setRequestedCount(parseInt(e.target.value, 10))}
              className="ksp-select"
            >
              {SHOT_COUNT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} shots
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Pose dropdown */}
        <label className="ksp-label">
          <span className="ksp-label-text">Pose · 100 tư thế</span>
          <select
            value={poseSelection}
            onChange={(e) => setPoseSelection(e.target.value)}
            className="ksp-select"
          >
            <option value="auto">⚡ Auto-vary across all 100 poses</option>
            <option value="custom">✍️ Tự nhập tư thế (free-text)</option>
            <optgroup label="🎯 Vary trong 1 category">
              {POSE_CATEGORIES.map((cat) => (
                <option key={`cat:${cat.id}`} value={`cat:${cat.id}`}>
                  {cat.emoji} {cat.label} ({POSES.filter((p) => p.category === cat.id).length} poses)
                </option>
              ))}
            </optgroup>
            {POSE_CATEGORIES.map((cat) => (
              <optgroup key={cat.id} label={`${cat.emoji} ${cat.label}`}>
                {POSES.filter((p) => p.category === cat.id).map((pose) => (
                  <option key={pose.id} value={pose.id}>
                    {pose.vi}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        {/* Custom pose editor — shown only when "Tự nhập" picked */}
        {poseSelection === "custom" && <CustomPoseEditor />}

        {/* Camera Angle dropdown */}
        <label className="ksp-label">
          <span className="ksp-label-text">Camera Angle · 12 góc</span>
          <select
            value={angleSelection}
            onChange={(e) => setAngleSelection(e.target.value)}
            className="ksp-select"
          >
            <option value="auto">⚡ Auto-vary across all 12 angles</option>
            {ANGLE_PRESETS.map((angle) => (
              <option key={angle.id} value={angle.id}>
                {angle.emoji} {angle.name} — {angle.description}
              </option>
            ))}
          </select>
        </label>

        {/* Generate Prompts button — colorful! */}
        <button
          type="button"
          className="ksp-btn-generate-prompts"
          onClick={() => {
            const opts: any = {};
            if (poseSelection === "custom") {
              // User-defined free-text pose: prefer EN if translated, else VI fallback
              const en = photos.theme.customPoseEn?.trim();
              const vi = photos.theme.customPoseVi?.trim();
              const text = en || vi;
              if (!text) {
                showToast("Gõ tư thế tiếng Việt trước (hoặc dịch sang EN)", "error");
                return;
              }
              opts.customPoseText = text;
            } else if (poseSelection !== "auto") {
              if (poseSelection.startsWith("cat:")) {
                opts.poseCategory = poseSelection.slice(4);
              } else {
                opts.poseId = poseSelection;
              }
            }
            if (angleSelection !== "auto") {
              opts.angleId = angleSelection;
            }
            updateProject(autoPickShots(project, requestedCount, opts));
          }}
        >
          ⚡ Generate Prompts
        </button>
      </div>

      {/* Shots list */}
      {photos.shots.length === 0 ? (
        <div className="ksp-empty-state">
          <p style={{ fontSize: 12, color: "#888", padding: "12px 14px", margin: 0 }}>
            Chưa có shot. Nhấn <strong>Auto-pick</strong> để tạo {requestedCount} shots với các góc khác nhau.
          </p>
        </div>
      ) : (
        <div className="ksp-shots-list">
          {photos.shots.map((shot) => {
            const angle = getAngleById(shot.anglePresetId);
            const pose = shot.posePresetId ? getPoseById(shot.posePresetId) : undefined;
            return (
              <div key={shot.id} className="ksp-shot-row">
                <div className="ksp-shot-thumbs">
                  <ThumbMini imageRef={selectedCast?.faceRefs[0]} fallback="👤" title="Face ref" />
                  <ThumbMini imageRef={selectedCast?.outfitRef} fallback="👗" title="Outfit ref" />
                </div>
                <div className="ksp-shot-info">
                  <div className="ksp-shot-line1">
                    <span className="ksp-shot-num">{shot.order}.</span>
                    <span className="ksp-shot-title">
                      {pose ? pose.vi : angle?.name ?? "Unknown"}
                    </span>
                  </div>
                  <div className="ksp-shot-line2">
                    {angle?.emoji} {angle?.name ?? "—"}
                    {pose ? ` · ${POSE_CATEGORIES.find((c) => c.id === pose.category)?.emoji ?? ""}` : ""}
                  </div>
                </div>
                <div className="ksp-shot-icons">
                  <button
                    type="button"
                    className="ksp-shot-icon-btn"
                    title="Edit pose + camera angle"
                    aria-label="Edit shot"
                    onClick={() => setEditingShotId(shot.id)}
                  >
                    ✏
                  </button>
                  <button
                    type="button"
                    className="ksp-shot-icon-btn"
                    title="Copy prompt (EN)"
                    aria-label="Copy prompt"
                    onClick={() => onCopyPrompt(shot)}
                  >
                    📋
                  </button>
                  <button
                    type="button"
                    className="ksp-shot-icon-btn"
                    title="Download face + outfit refs (ZIP)"
                    aria-label="Download refs"
                    onClick={() => onDownloadRefs(shot)}
                  >
                    📥
                  </button>
                  <button
                    type="button"
                    className="ksp-shot-icon-btn ksp-shot-icon-btn-danger"
                    title="Remove shot"
                    aria-label="Remove shot"
                    onClick={() => updateProject(removeShot(project, shot.id))}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
          <button
            type="button"
            className="ksp-shot-add-row"
            onClick={() => updateProject(addShot(project))}
          >
            + Thêm shot
          </button>
        </div>
      )}

      {/* Per-shot edit popup */}
      {editingShotId && (
        <ShotEditPopup
          shotId={editingShotId}
          onClose={() => setEditingShotId(null)}
        />
      )}

      <div className="ksp-shot-footnote">
        <span style={{ marginRight: 6 }}>ℹ</span>
        Mỗi shot = prompt 13 blocks (EN) với Skin Paradox + Identity Lock auto-injected. Download = ZIP gồm face refs + outfit để paste vào Banana Pro slot #1, #2, ...
      </div>
    </section>
  );
}

// ============================================================================
// THUMB MINI
// ============================================================================

function ThumbMini({
  imageRef,
  fallback,
  title,
}: {
  imageRef?: { dataUrl: string } | undefined;
  fallback: string;
  title: string;
}) {
  if (imageRef) {
    return <img src={imageRef.dataUrl} alt={title} className="ksp-shot-thumb-mini" title={title} />;
  }
  return (
    <div className="ksp-shot-thumb-mini ksp-shot-thumb-empty" title={title}>
      <span style={{ fontSize: 14 }}>{fallback}</span>
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function inferExt(mime: string): string {
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  return ".jpg";
}

function dataUrlToBase64(dataUrl: string): string {
  const idx = dataUrl.indexOf("base64,");
  return idx >= 0 ? dataUrl.slice(idx + 7) : dataUrl;
}

function buildRefsReadme(
  cast: { name: string; order: number; subjectType: string; faceRefs: { label: string; filename: string }[]; outfitRef?: { filename: string } },
  shot: PhotosShot
): string {
  const angle = getAngleById(shot.anglePresetId);
  const pad = (n: number) => String(n).padStart(2, "0");
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const lines = [
    `KSP Image v0.9.1 — Reference images for Banana Pro / Nano Banana Pro`,
    ``,
    `Cast: ${cast.name || `Cast ${cast.order}`} (${cast.subjectType})`,
    `Shot: ${shot.order}. ${angle?.name ?? "Unknown"} (${angle?.id ?? ""})`,
    ``,
    `Files in this ZIP are numbered 01_, 02_, 03_, ... matching the`,
    `"Image #N" references in the prompt. Upload in this exact order:`,
    ``,
  ];
  cast.faceRefs.forEach((f, i) => {
    const labelSlug = slug(f.label) || `view-${i + 1}`;
    lines.push(`  ${pad(i + 1)}_face_${labelSlug}.jpg  →  Image #${i + 1} (${f.label})  —  original: ${f.filename}`);
  });
  if (cast.outfitRef) {
    const idx = cast.faceRefs.length + 1;
    lines.push(`  ${pad(idx)}_outfit.jpg  →  Image #${idx} (outfit)  —  original: ${cast.outfitRef.filename}`);
  }
  lines.push(
    ``,
    `Then paste the prompt (copied via 📋 button) into Banana Pro text input.`,
    `Generate → review → adjust prompt or refs as needed.`
  );
  return lines.join("\n");
}

// ============================================================================
// PER-SHOT EDIT POPUP — allows changing pose + camera angle for a single shot
// ============================================================================
function ShotEditPopup({ shotId, onClose }: { shotId: string; onClose: () => void }) {
  const project = useAppStore((s) => s.currentProject);
  const updateProject = useAppStore((s) => s.updateCurrentProject);
  if (!project) return null;
  const photos = ensurePhotosData(project);
  const shot = photos.shots.find((s) => s.id === shotId);
  if (!shot) {
    return null;
  }

  return (
    <div className="ksp-library-picker-backdrop" onClick={onClose}>
      <div
        className="ksp-library-picker"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="ksp-library-picker-header">
          <span className="ksp-library-picker-title">
            ✏ Edit Shot {shot.order}
          </span>
          <button
            type="button"
            className="ksp-btn-icon"
            onClick={onClose}
            aria-label="Đóng"
          >
            ✕
          </button>
        </header>

        <div className="ksp-library-picker-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label className="ksp-label">
            <span className="ksp-label-text">Pose</span>
            <select
              value={shot.posePresetId || ""}
              onChange={(e) =>
                updateProject(
                  updateShot(project, shot.id, { posePresetId: e.target.value || undefined })
                )
              }
              className="ksp-select"
            >
              <option value="">— Không pose cụ thể —</option>
              {POSE_CATEGORIES.map((cat) => (
                <optgroup key={cat.id} label={`${cat.emoji} ${cat.label}`}>
                  {POSES.filter((p) => p.category === cat.id).map((pose) => (
                    <option key={pose.id} value={pose.id}>
                      {pose.vi}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <label className="ksp-label">
            <span className="ksp-label-text">Camera Angle</span>
            <select
              value={shot.anglePresetId}
              onChange={(e) =>
                updateProject(updateShot(project, shot.id, { anglePresetId: e.target.value }))
              }
              className="ksp-select"
            >
              {ANGLE_PRESETS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.emoji} {a.name} — {a.description}
                </option>
              ))}
            </select>
          </label>

          <label className="ksp-label">
            <span className="ksp-label-text">Pose note (free-text, optional)</span>
            <textarea
              value={shot.poseNote || ""}
              onChange={(e) =>
                updateProject(updateShot(project, shot.id, { poseNote: e.target.value }))
              }
              placeholder="vd: cầm bó hoa hồng đỏ, tóc tết bím..."
              rows={2}
              className="ksp-textarea"
            />
          </label>

          <button
            type="button"
            className="ksp-btn-action"
            onClick={onClose}
            style={{ marginTop: 4 }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CUSTOM POSE EDITOR — free-text pose used for ALL N shots (v0.9.1-r12)
// ============================================================================
//
// User flow:
//   1. Pick "✍️ Tự nhập tư thế" in Pose dropdown
//   2. Type Vietnamese pose description in textarea
//   3. (Optional) Click 🌐 Dịch → Gemini translates VN → EN
//   4. Click ⚡ Generate Prompts → all N shots use this pose text in *Position:* block
//      (camera angles still vary independently per "Camera Angle" dropdown)
//
function CustomPoseEditor() {
  const project = useAppStore((s) => s.currentProject);
  const updateProject = useAppStore((s) => s.updateCurrentProject);
  const showToast = useAppStore((s) => s.showToast);
  const [translating, setTranslating] = React.useState(false);

  if (!project) return null;
  const photos = ensurePhotosData(project);
  const poseVi = photos.theme.customPoseVi || "";
  const poseEn = photos.theme.customPoseEn || "";

  const handleTranslate = async () => {
    if (!poseVi.trim()) {
      showToast("Gõ tư thế tiếng Việt trước khi dịch", "error");
      return;
    }
    setTranslating(true);
    try {
      // Lazy import to avoid loading Gemini client unless user clicks Dịch
      const { translateVnToEn } = await import("../engine/gemini");
      const en = await translateVnToEn(poseVi);
      updateProject(setCustomPose(project, { en }));
      showToast(`✓ Đã dịch (${en.length} chars)`, "success");
    } catch (e: any) {
      showToast(`Dịch lỗi: ${e.message}`, "error");
    } finally {
      setTranslating(false);
    }
  };

  const handleClear = () => {
    updateProject(setCustomPose(project, null));
  };

  return (
    <div className="ksp-custom-pose">
      <label className="ksp-label" style={{ marginTop: 4 }}>
        <span className="ksp-label-text">
          ✍️ Tư thế tự nhập (tiếng Việt) · áp dụng cho tất cả N shots
        </span>
        <textarea
          value={poseVi}
          onChange={(e) => updateProject(setCustomPose(project, { vi: e.target.value }))}
          placeholder="vd: ngồi cạnh ly cà phê, một tay đỡ cằm, ngón tay vuốt mép ly, ánh mắt nhìn ra xa qua cửa sổ..."
          className="ksp-textarea ksp-custom-pose-textarea"
          rows={3}
          maxLength={500}
        />
      </label>
      <div className="ksp-custom-pose-actions">
        <button
          type="button"
          className="ksp-btn ksp-btn-sm ksp-btn-ghost"
          onClick={handleTranslate}
          disabled={translating || !poseVi.trim()}
        >
          {translating ? "⏳ Đang dịch..." : "🌐 Dịch sang tiếng Anh"}
        </button>
        {(poseVi || poseEn) && (
          <button
            type="button"
            className="ksp-btn ksp-btn-sm ksp-btn-ghost-danger"
            onClick={handleClear}
          >
            Xóa
          </button>
        )}
      </div>
      {poseEn && (
        <div className="ksp-custom-pose-en">
          <span className="ksp-custom-pose-en-label">✓ EN:</span> {poseEn}
        </div>
      )}
      {poseVi && !poseEn && (
        <div className="ksp-custom-pose-hint">
          💡 Chưa dịch — engine sẽ inject tiếng Việt thẳng (AI hiểu được nhưng dịch sẽ chính xác hơn).
        </div>
      )}
    </div>
  );
}
