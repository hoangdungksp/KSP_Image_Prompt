/**
 * KSP Image qc16 — Film Storyboard Section (visual grid rewrite)
 *
 * Paradigm shift from qc11: replaced shot list (text rows) with VISUAL GRIDS.
 * Each scene contains 1+ SceneGrid (packed via Option A).
 * Each cell = 1 shot snapshot, with 4 per-cell action buttons.
 *
 * Migration A: old per-shot grid data was dropped at load (migration.ts qc16).
 */

import React, { useState, useMemo } from "react";
import JSZip from "jszip";
import { useAppStore } from "../store/useAppStore";
import {
  ensureFilmData,
  getShotsForScene,
  ensureSceneGrids,
  setSceneGridFormat,
  resetSceneGridFormatToAuto,
  setSceneGridImage,
  applyCroppedFramesToGrid,
  clearSceneGridImage,
  toggleSceneGridCellLock,
  setSceneGridCellVideo,
  clearSceneGridCellVideo,
  regenerateSceneGridImagePrompt,
  setSceneGridCellDataUrl,
  updateShot,
} from "../store/film_actions";
import type {
  SceneGrid,
  SceneGridCell,
  SceneGridFormat,
  FilmSceneScript,
  FilmShot,
  ShotCropSettings,
} from "../types/project";
import { parseGridFormat, gridStats, pickOptimalGridFormat } from "../engine/sceneGridPacker";
import { buildSceneGridImagePrompt } from "../engine/sceneImagePromptBuilder";
import { cropGridIntoFrames } from "../engine/gridImageCrop";
import { buildGridTemplateImage } from "../engine/gridTemplateImage";
import { GridCropPreviewModal } from "./GridCropPreviewModal";
import { FilmFrameEditModal } from "./FilmFrameEditModal";
import { FilmAnimaticPlayerModal } from "./FilmAnimaticPlayerModal";

const GRID_FORMAT_OPTIONS: { value: SceneGridFormat; label: string; cells: number }[] = [
  { value: "2x2", label: "2×2", cells: 4 },
  { value: "2x3", label: "2×3", cells: 6 },
  { value: "3x2", label: "3×2", cells: 6 },
  { value: "2x4", label: "2×4", cells: 8 },
  { value: "4x2", label: "4×2", cells: 8 },
  { value: "3x3", label: "3×3", cells: 9 },
  { value: "4x3", label: "4×3", cells: 12 },
  { value: "3x4", label: "3×4", cells: 12 },
  { value: "4x4", label: "4×4", cells: 16 },
];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = meta.match(/data:(.*?);/)?.[1] ?? "image/png";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export function FilmStoryboardSection() {
  const project = useAppStore((s) => s.currentProject);
  if (!project) return null;
  const film = ensureFilmData(project);
  const scenes = film.script?.scenes ?? [];
  const totalShots = scenes.reduce(
    (acc, s) => acc + getShotsForScene(project, s.id).length,
    0
  );
  const totalGrids = scenes.reduce((acc, s) => acc + (s.grids?.length ?? 0), 0);

  return (
    <section className="ksp-section ksp-storyboard-film">
      <header className="ksp-section-header">
        <span className="ksp-section-icon">🎬</span>
        <h2 className="ksp-section-title">5. STORYBOARD</h2>
        <span className="ksp-storyboard-stats">
          {scenes.length} scene{scenes.length !== 1 ? "s" : ""} · {totalShots} shot
          {totalShots !== 1 ? "s" : ""} · {totalGrids} grid{totalGrids !== 1 ? "s" : ""}
        </span>
      </header>

      {scenes.length === 0 && (
        <div className="ksp-storyboard-empty">
          <p>Chưa có scene. Quay lại Script section, hoàn thành Stage 5 (Dialogues) trước.</p>
        </div>
      )}

      {scenes.map((scene) => (
        <SceneBlock key={scene.id} scene={scene} />
      ))}
    </section>
  );
}

interface SceneBlockProps {
  scene: FilmSceneScript;
}

function SceneBlock({ scene }: SceneBlockProps) {
  const project = useAppStore((s) => s.currentProject)!;
  const updateProject = useAppStore((s) => s.updateCurrentProject);
  const [expanded, setExpanded] = useState(false);
  // qc21: Advanced override panel toggle (default collapsed)
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [animaticPlayerOpen, setAnimaticPlayerOpen] = useState(false);

  const shots = getShotsForScene(project, scene.id);
  const grids = scene.grids ?? [];
  const stats = gridStats(grids);
  const gridFormat: SceneGridFormat = scene.gridFormat ?? "3x3";
  // qc21: aspect ratio from project setting
  const aspectRatio = (project as any).settingV2?.aspectRatio ?? "16:9";
  // qc21: optimal format that WOULD be auto-picked for current shot count + aspect
  const optimalFormat = pickOptimalGridFormat(shots.length, aspectRatio);

  // qc21 Q21.4: Distinguish auto-picked vs manual override.
  // - gridFormatManual === true: explicit qc21 user override → show "↺ Reset to Auto"
  // - gridFormatManual === false: explicit qc21 auto-picked → show "(auto)"
  // - gridFormatManual === undefined: legacy from qc17/qc18 → migration hint
  const isManualOverride = scene.gridFormatManual === true;
  const isExplicitAuto = scene.gridFormatManual === false;
  const isLegacy = scene.gridFormatManual === undefined && scene.gridFormat !== undefined;
  // qc21 Q21.5: migration hint only when legacy AND current format differs from auto-optimal
  const showMigrationHint = isLegacy && scene.gridFormat !== optimalFormat;

  function handleExpand() {
    if (!expanded && grids.length === 0) {
      updateProject((p) => ensureSceneGrids(p, scene.id));
    }
    setExpanded(!expanded);
  }

  function handleChangeFormat(newFormat: SceneGridFormat) {
    if (newFormat === gridFormat) return;
    const ok = confirm(
      `Đổi grid format từ ${gridFormat} sang ${newFormat}?\n\nGrids sẽ re-pack. Cropped frames được giữ nếu shot vị trí khớp.\n\nĐây là MANUAL override — sẽ không tự đổi khi shot count thay đổi.`
    );
    if (!ok) return;
    updateProject((p) => setSceneGridFormat(p, scene.id, newFormat));
  }

  function handleResetToAuto() {
    const ok = confirm(
      `Reset về Auto?\n\nSẽ pick lại grid format optimal theo shot count (${shots.length} shots → ${optimalFormat}).\n\nCropped frames giữ nếu shot vị trí khớp.`
    );
    if (!ok) return;
    updateProject((p) => resetSceneGridFormatToAuto(p, scene.id));
    setAdvancedOpen(false);
  }

  return (
    <div className="ksp-storyboard-scene">
      <div className="ksp-storyboard-scene-header" onClick={handleExpand}>
        <span className="ksp-storyboard-arrow">{expanded ? "▼" : "▶"}</span>
        <strong className="ksp-storyboard-scene-title">Scene {scene.order}</strong>
        <span className="ksp-storyboard-scene-subtitle">
          {scene.titleVi || scene.titleEn}
        </span>
        <span className="ksp-storyboard-scene-meta">
          <strong>{gridFormat}</strong> · {aspectRatio} ·{" "}
          {shots.length} shot{shots.length !== 1 ? "s" : ""} ·{" "}
          {Math.floor(scene.durationSeconds / 60)}m{scene.durationSeconds % 60}s
          {isManualOverride && <span className="ksp-sb-meta-manual"> · manual</span>}
        </span>
      </div>

      {expanded && (
        <div className="ksp-storyboard-scene-body">
          {/* Advanced toggle + Play Animatic button (default collapsed). No dropdown by default. */}
          <div className="ksp-storyboard-grid-format-row">
            <button
              type="button"
              className={`ksp-sb-grid-advanced-toggle ${
                advancedOpen ? "ksp-sb-grid-advanced-toggle-active" : ""
              }`}
              onClick={() => setAdvancedOpen(!advancedOpen)}
            >
              ⚙ Advanced {advancedOpen ? "▲" : "▼"}
            </button>
            <button
              type="button"
              className="ksp-sb-play-animatic-btn"
              onClick={() => setAnimaticPlayerOpen(true)}
              disabled={shots.length === 0}
              title={
                shots.length === 0
                  ? "Cần có shots trong scene để play animatic"
                  : "Play animatic preview of scene"
              }
            >
              ▶ Play Animatic
            </button>
            {/* Reset to Auto button visible only when manual override (or legacy mismatch) */}
            {(isManualOverride || showMigrationHint) && (
              <button
                type="button"
                className="ksp-sb-grid-reset-btn"
                onClick={handleResetToAuto}
                title={`Reset về auto: ${optimalFormat}`}
              >
                ↺ Reset to Auto ({optimalFormat})
              </button>
            )}
            {stats.emptyCells > 0 && (
              <span className="ksp-storyboard-grid-stats">
                {stats.gridCount} grid{stats.gridCount !== 1 ? "s" : ""} · {stats.emptyCells} empty
              </span>
            )}
          </div>

          {/* Inline dropdown shown only when Advanced toggle is open */}
          {advancedOpen && (
            <div className="ksp-sb-grid-advanced-panel">
              <label>Grid format override:</label>
              <select
                value={gridFormat}
                onChange={(e) => handleChangeFormat(e.target.value as SceneGridFormat)}
              >
                {GRID_FORMAT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} ({opt.cells} cells)
                    {opt.value === optimalFormat ? " ← auto" : ""}
                  </option>
                ))}
              </select>
              <span className="ksp-storyboard-grid-stats">
                {stats.gridCount} grid{stats.gridCount !== 1 ? "s" : ""} ·{" "}
                {stats.filledCells} filled
                {stats.emptyCells > 0 ? ` · ${stats.emptyCells} empty` : ""}
              </span>
            </div>
          )}

          {shots.length === 0 && (
            <div className="ksp-storyboard-empty">
              <p>Chưa có shot. Quay lại Shot List section để generate shots trước.</p>
            </div>
          )}

          {grids.map((grid) => (
            <GridDisplay key={grid.id} grid={grid} scene={scene} />
          ))}
        </div>
      )}

      {/* Animatic Player Modal — per-scene preview */}
      {animaticPlayerOpen && (
        <FilmAnimaticPlayerModal
          scene={scene}
          shotsInScene={shots}
          cellAssetsByShotId={(() => {
            const map: Record<
              string,
              { dataUrl?: string; video?: { dataUrl: string; filename: string } } | undefined
            > = {};
            for (const g of grids) {
              for (const c of g.cells) {
                if (c.shotId) {
                  map[c.shotId] = {
                    dataUrl: c.dataUrl,
                    video: c.video
                      ? { dataUrl: c.video.dataUrl, filename: c.video.filename }
                      : undefined,
                  };
                }
              }
            }
            return map;
          })()}
          setting={(project as any).settingV2}
          onClose={() => setAnimaticPlayerOpen(false)}
        />
      )}
    </div>
  );
}

interface GridDisplayProps {
  grid: SceneGrid;
  scene: FilmSceneScript;
}

function GridDisplay({ grid, scene }: GridDisplayProps) {
  const project = useAppStore((s) => s.currentProject)!;
  const updateProject = useAppStore((s) => s.updateCurrentProject);
  const showToast = useAppStore((s) => s.showToast);
  const film = ensureFilmData(project);
  const setting = (project as any).settingV2;
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<{
    dataUrl: string;
    initialSettings?: ShotCropSettings;
  } | null>(null);
  // qc17: Edit Frame Modal state
  const [editingCellOrder, setEditingCellOrder] = useState<number | null>(null);

  const { rows, cols } = parseGridFormat(grid.gridFormat);
  const shots = getShotsForScene(project, scene.id);
  const aspectRatio = setting?.aspectRatio ?? "16:9";

  const imagePromptText = useMemo(() => {
    if (grid.imagePrompt) return grid.imagePrompt;
    if (!setting) return "(missing project setting)";
    return buildSceneGridImagePrompt({
      grid,
      scene,
      shots,
      cast: film.characters,
      setting,
    });
  }, [grid, scene, shots, film.characters, setting]);

  function handleCopyPrompt() {
    navigator.clipboard.writeText(imagePromptText);
    showToast(`Copied prompt grid ${grid.order} (${imagePromptText.length} chars)`, "success");
  }

  function handleRegenPrompt() {
    updateProject((p) => regenerateSceneGridImagePrompt(p, scene.id, grid.id));
    showToast(`Đã regen prompt grid ${grid.order}`, "success");
  }

  async function handleUploadFile(file: File) {
    try {
      const dataUrl = await fileToDataUrl(file);
      setPendingUpload({ dataUrl, initialSettings: grid.cropSettings });
    } catch (err) {
      showToast(`Upload lỗi: ${(err as Error).message}`, "error");
    }
  }

  function handleRecrop() {
    if (!grid.gridImageDataUrl) {
      showToast("Chưa có grid để re-crop", "info");
      return;
    }
    setPendingUpload({
      dataUrl: grid.gridImageDataUrl,
      initialSettings: grid.cropSettings,
    });
  }

  function handleClear() {
    if (!grid.gridImageDataUrl) return;
    if (!confirm(`Xóa grid ${grid.order} và tất cả cropped cells?`)) return;
    updateProject((p) => clearSceneGridImage(p, scene.id, grid.id));
  }

  /**
   * Trigger hidden file input for video upload. Reads video as dataURL,
   * optionally probes duration via <video> element, then stores on cell.
   */
  function handleUploadVideoForCell(cellOrder: number) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      // Soft size limit: 50 MB. Larger files may slow IndexedDB persist.
      if (file.size > 50 * 1024 * 1024) {
        const ok = confirm(
          `Video ${(file.size / 1024 / 1024).toFixed(1)} MB khá lớn. Vẫn upload? (Có thể chậm khi save project)`
        );
        if (!ok) return;
      }
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("File read failed"));
          reader.readAsDataURL(file);
        });
        // Probe duration (best-effort, non-blocking)
        let durationSeconds: number | undefined;
        try {
          durationSeconds = await new Promise<number>((resolve, reject) => {
            const v = document.createElement("video");
            v.preload = "metadata";
            v.onloadedmetadata = () => resolve(v.duration);
            v.onerror = () => reject(new Error("Cannot read video metadata"));
            v.src = dataUrl;
          });
        } catch {
          /* ignore — duration is optional metadata */
        }
        updateProject((p) =>
          setSceneGridCellVideo(p, scene.id, grid.id, cellOrder, {
            dataUrl,
            filename: file.name,
            durationSeconds,
          })
        );
        showToast(
          `Đã upload video cho shot ${cellOrder}${
            durationSeconds ? ` (${durationSeconds.toFixed(1)}s)` : ""
          }`,
          "success"
        );
      } catch (err) {
        showToast(`Upload lỗi: ${(err as Error).message}`, "error");
      }
    };
    input.click();
  }

  async function handleDownloadRefs() {
    const filledCells = grid.cells.filter((c) => c.shotId);
    const croppedCells = grid.cells.filter((c) => c.dataUrl);
    if (film.characters.length === 0 && croppedCells.length === 0 && filledCells.length === 0) {
      showToast("Chưa có cast + chưa crop — ZIP rỗng", "info");
      return;
    }
    try {
      const zip = new JSZip();
      // Filename convention matches prompt references:
      //   IMAGE #1 (grid template)  → image-01_grid-template.png
      //   IMAGE #2+ (cast refs)     → image-02_cast-{name}_face-NN.png, image-03_cast-{name}_body-NN.png
      //   (Supplemental cropped cells in subfolder, not referenced as IMAGE #N)

      // IMAGE #1 — grid template (blank labeled layout)
      try {
        const template = buildGridTemplateImage({
          gridFormat: grid.gridFormat,
          targetAspect: setting?.aspectRatio ?? "16:9",
          filledCellOrders: filledCells.map((c) => c.order),
        });
        zip.file("image-01_grid-template.png", dataUrlToBlob(template.dataUrl));
      } catch (err) {
        console.warn("[Storyboard] grid template image generation failed", err);
      }

      // IMAGE #2+ — cast refs (face + body per character).
      // Sequential numbering across all cast members, face before body per character.
      let imageNum = 2;
      for (const c of film.characters) {
        const safeName = (c.name || `char${c.order}`).replace(/[^a-zA-Z0-9_-]/g, "_");
        c.faceRefs.forEach((ref, i) => {
          const numStr = String(imageNum).padStart(2, "0");
          const slotStr = String(i + 1).padStart(2, "0");
          const ext = (ref.filename.split(".").pop() || "png").toLowerCase();
          zip.file(
            `image-${numStr}_cast-${safeName}_face-${slotStr}.${ext}`,
            dataUrlToBlob(ref.dataUrl)
          );
          imageNum++;
        });
        c.bodyRefs.forEach((ref, i) => {
          const numStr = String(imageNum).padStart(2, "0");
          const slotStr = String(i + 1).padStart(2, "0");
          const ext = (ref.filename.split(".").pop() || "png").toLowerCase();
          zip.file(
            `image-${numStr}_cast-${safeName}_body-${slotStr}.${ext}`,
            dataUrlToBlob(ref.dataUrl)
          );
          imageNum++;
        });
      }

      // Supplemental — cropped cells, named by SHOT order (matches prompt refs).
      // Filename matches `first-frame_shot-N.png` / `shot-N.png` convention used elsewhere.
      croppedCells.forEach((cell) => {
        if (cell.dataUrl) {
          const cellShot = cell.shotId ? shots.find((s) => s.id === cell.shotId) : undefined;
          const name = cellShot ? `shot-${cellShot.order}.png` : `cell-${cell.order}.png`;
          zip.file(`cropped-cells/${name}`, dataUrlToBlob(cell.dataUrl));
        }
      });
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scene-${scene.order}_grid-${grid.order}_refs.zip`;
      a.click();
      URL.revokeObjectURL(url);
      const parts: string[] = ["template"];
      if (film.characters.length > 0) parts.push(`${film.characters.length} cast`);
      if (croppedCells.length > 0) parts.push(`${croppedCells.length} crops`);
      showToast(`Refs ZIP downloaded — ${parts.join(" + ")}`, "success");
    } catch (err) {
      showToast(`ZIP error: ${(err as Error).message}`, "error");
    }
  }

  return (
    <div className="ksp-storyboard-grid-block">
      <div className="ksp-storyboard-grid-header">
        <strong>Grid {grid.order}</strong>
        <span className="ksp-storyboard-grid-info">
          ({grid.gridFormat} ·{" "}
          {grid.cells.filter((c) => c.shotId).length} filled
          {grid.cells.filter((c) => !c.shotId).length > 0
            ? ` · ${grid.cells.filter((c) => !c.shotId).length} empty`
            : ""}
          {grid.gridImageDataUrl ? " · ✓ cropped" : " · 📤 needs upload"})
        </span>
      </div>

      {!grid.gridImageDataUrl && (
        <div className="ksp-storyboard-no-upload-warning">
          ⚠ Chưa upload grid PNG. Copy prompt → paste Banana Pro / Imagen 4 / Nano Banana → generate grid → upload lại.
        </div>
      )}

      <div
        className={`ksp-storyboard-grid ksp-storyboard-grid-cells-aspect`}
        style={(() => {
          const parts = aspectRatio.split(":").map(Number);
          const w = parts[0] || 16;
          const h = parts[1] || 9;
          const isVertical = w < h;
          // Vertical aspects: cap container width so cells stay reasonable size
          // (else grid 2x3 in 9:16 would render cells 350×622px = giant column).
          const maxWidth = isVertical ? `${cols * 130}px` : undefined;
          return {
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            ["--ksp-cell-aspect" as any]: `${w} / ${h}`,
            maxWidth,
          };
        })()}
      >
        {grid.cells.map((cell) => {
          const shot = cell.shotId
            ? shots.find((s) => s.id === cell.shotId)
            : undefined;
          return (
            <GridCell
              key={cell.order}
              cell={cell}
              shot={shot}
              hasGridImage={!!grid.gridImageDataUrl}
              onToggleLock={() =>
                updateProject((p) =>
                  toggleSceneGridCellLock(p, scene.id, grid.id, cell.order)
                )
              }
              onRegen={() => {
                showToast(
                  `Regen shot ${shot?.order ?? cell.order}: qc17 sẽ wire single-frame Nano Banana API`,
                  "info"
                );
              }}
              onDownload={() => {
                if (!cell.dataUrl) {
                  showToast("Chưa có ảnh để download", "info");
                  return;
                }
                const a = document.createElement("a");
                a.href = cell.dataUrl;
                // Unified naming: shot-N.png (matches prompt references)
                a.download = shot ? `shot-${shot.order}.png` : `cell-${cell.order}.png`;
                a.click();
                showToast(`Đã download shot ${shot?.order ?? cell.order}`, "success");
              }}
              onEdit={() => {
                setEditingCellOrder(cell.order);
              }}
              onUploadVideo={() => {
                handleUploadVideoForCell(cell.order);
              }}
            />
          );
        })}
      </div>

      <div className="ksp-storyboard-grid-actions">
        <label className="ksp-btn ksp-btn-primary ksp-btn-sm">
          📤 Upload grid
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUploadFile(f);
            }}
          />
        </label>
        {grid.gridImageDataUrl && (
          <button
            type="button"
            className="ksp-btn ksp-btn-ghost ksp-btn-sm"
            onClick={handleRecrop}
            title="Re-crop với settings mới"
          >
            🔧 Re-crop
          </button>
        )}
        <button
          type="button"
          className="ksp-btn ksp-btn-ghost ksp-btn-sm"
          onClick={handleDownloadRefs}
          title="Download cast refs + cropped frames"
        >
          📥 Refs ZIP
        </button>
        {grid.gridImageDataUrl && (
          <button
            type="button"
            className="ksp-btn ksp-btn-ghost ksp-btn-sm"
            onClick={handleClear}
            title="Clear grid + cropped cells"
          >
            ✕ Clear
          </button>
        )}
      </div>

      <div className="ksp-storyboard-prompt-collapsible">
        <button
          type="button"
          className="ksp-storyboard-prompt-toggle"
          onClick={() => setPromptExpanded(!promptExpanded)}
        >
          {promptExpanded ? "▼" : "▶"} 📝 Image Prompt (cho{" "}
          {grid.cells.filter((c) => c.shotId).length} shots)
          <span className="ksp-storyboard-prompt-chars">
            · {imagePromptText.length} chars
          </span>
        </button>
        {promptExpanded && (
          <div className="ksp-storyboard-prompt-body">
            <div className="ksp-storyboard-prompt-actions">
              <button
                type="button"
                className="ksp-btn ksp-btn-primary ksp-btn-sm"
                onClick={handleCopyPrompt}
              >
                📋 Copy → Banana Pro
              </button>
              <button
                type="button"
                className="ksp-btn ksp-btn-ghost ksp-btn-sm"
                onClick={handleRegenPrompt}
              >
                🔄 Regen prompt
              </button>
            </div>
            <textarea
              className="ksp-storyboard-prompt-textarea"
              readOnly
              value={imagePromptText}
            />
          </div>
        )}
      </div>

      {pendingUpload && (
        <GridCropPreviewModal
          gridDataUrl={pendingUpload.dataUrl}
          gridFormat={grid.gridFormat}
          projectAspectRatio={aspectRatio}
          initialSettings={pendingUpload.initialSettings}
          onCancel={() => setPendingUpload(null)}
          onApprove={async (settings, finalGridFormat) => {
            const dataUrl = pendingUpload.dataUrl;
            setPendingUpload(null);
            try {
              // If user overrode grid format in modal (e.g. AI returned different layout),
              // update the scene's grid format first so re-pack uses correct cell count.
              if (finalGridFormat !== grid.gridFormat) {
                updateProject((p) =>
                  setSceneGridFormat(p, scene.id, finalGridFormat as SceneGridFormat)
                );
                showToast(
                  `Grid format override: ${grid.gridFormat} → ${finalGridFormat}`,
                  "info"
                );
              }
              updateProject((p) =>
                setSceneGridImage(p, scene.id, grid.id, dataUrl, settings)
              );
              showToast("Đang crop...", "info");
              // qc22 hotfix: compute target cell aspect from project setting
              const aspectParts = aspectRatio.split(":").map(Number);
              const targetCellAspect = (aspectParts[0] || 16) / (aspectParts[1] || 9);
              const cropResult = await cropGridIntoFrames(dataUrl, finalGridFormat, {
                totalWidth: settings.totalWidth,
                totalHeight: settings.totalHeight,
                gutterPx: settings.gutterPx,
                targetCellAspect,
              });
              updateProject((p) =>
                applyCroppedFramesToGrid(p, scene.id, grid.id, cropResult.frameDataUrls)
              );
              showToast(
                `Đã crop ${cropResult.count} cells (${cropResult.cellW}×${cropResult.cellH})`,
                "success"
              );
            } catch (err) {
              showToast(`Crop lỗi: ${(err as Error).message}`, "error");
            }
          }}
        />
      )}

      {/* qc17: Edit Frame Modal — opens when user clicks ✏ on a cell */}
      {editingCellOrder !== null && (() => {
        const cell = grid.cells.find((c) => c.order === editingCellOrder);
        if (!cell || !cell.shotId) return null;
        const shot = shots.find((s) => s.id === cell.shotId);
        if (!shot || !setting) return null;
        return (
          <FilmFrameEditModal
            cell={cell}
            grid={grid}
            scene={scene}
            shot={shot}
            allShotsInScene={shots}
            cast={film.characters}
            setting={setting}
            onCancel={() => setEditingCellOrder(null)}
            showToast={showToast}
            onSave={(updates) => {
              updateProject((p) =>
                updateShot(p, scene.id, shot.id, updates as any)
              );
              setEditingCellOrder(null);
            }}
            onUploadReplace={(dataUrl) => {
              updateProject((p) =>
                setSceneGridCellDataUrl(p, scene.id, grid.id, cell.order, dataUrl)
              );
              // Keep modal open so user can verify
            }}
            onUploadVideo={(video) => {
              updateProject((p) =>
                setSceneGridCellVideo(p, scene.id, grid.id, cell.order, video)
              );
            }}
            onClearVideo={() => {
              updateProject((p) =>
                clearSceneGridCellVideo(p, scene.id, grid.id, cell.order)
              );
            }}
          />
        );
      })()}
    </div>
  );
}

interface GridCellProps {
  cell: {
    order: number;
    shotId?: string;
    dataUrl?: string;
    locked?: boolean;
    video?: { dataUrl: string; filename: string; durationSeconds?: number };
  };
  shot?: { id: string; order: number; titleVi?: string; titleEn?: string };
  hasGridImage: boolean;
  onToggleLock: () => void;
  onRegen: () => void;
  onDownload: () => void;
  onEdit: () => void;
  onUploadVideo: () => void;
}

function GridCell({
  cell,
  shot,
  hasGridImage,
  onToggleLock,
  onRegen,
  onDownload,
  onEdit,
  onUploadVideo,
}: GridCellProps) {
  if (!cell.shotId || !shot) {
    return (
      <div className="ksp-storyboard-cell ksp-storyboard-cell-empty">
        <span className="ksp-storyboard-cell-empty-label">—</span>
      </div>
    );
  }

  if (!hasGridImage) {
    return (
      <div
        className="ksp-storyboard-cell ksp-storyboard-cell-no-upload"
        onClick={onEdit}
        role="button"
        tabIndex={0}
        title="Click to edit shot"
        style={{ cursor: "pointer" }}
      >
        <span className="ksp-storyboard-cell-shot-num">Shot {shot.order}</span>
        <span className="ksp-storyboard-cell-no-upload-label">chưa có ảnh</span>
      </div>
    );
  }

  return (
    <div
      className="ksp-storyboard-cell ksp-storyboard-cell-filled"
      onClick={onEdit}
      role="button"
      tabIndex={0}
      title="Click to edit shot"
      style={{ cursor: "pointer" }}
    >
      {cell.dataUrl ? (
        <img
          src={cell.dataUrl}
          alt={`Shot ${shot.order}`}
          className="ksp-storyboard-cell-img"
        />
      ) : (
        <span className="ksp-storyboard-cell-loading">crop...</span>
      )}
      <span className="ksp-storyboard-cell-shot-num">Shot {shot.order}</span>
      {/* Video uploaded badge */}
      {cell.video?.dataUrl && (
        <span
          className="ksp-storyboard-cell-video-badge"
          title={`Video uploaded: ${cell.video.filename}`}
        >
          ▶
        </span>
      )}
      <div className="ksp-storyboard-cell-actions">
        <button
          type="button"
          className="ksp-storyboard-cell-btn"
          onClick={(e) => {
            e.stopPropagation();
            onUploadVideo();
          }}
          title={cell.video ? "Replace uploaded video" : "Upload video for this shot"}
        >
          🎬
        </button>
        <button
          type="button"
          className={`ksp-storyboard-cell-btn ${cell.locked ? "locked" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleLock();
          }}
          title={cell.locked ? "Unlock" : "Lock"}
        >
          {cell.locked ? "🔒" : "🔓"}
        </button>
        <button
          type="button"
          className="ksp-storyboard-cell-btn"
          onClick={(e) => {
            e.stopPropagation();
            onRegen();
          }}
          title="Regen frame"
          disabled={cell.locked}
        >
          🔄
        </button>
        <button
          type="button"
          className="ksp-storyboard-cell-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
          title="Download PNG"
          disabled={!cell.dataUrl}
        >
          📥
        </button>
      </div>
    </div>
  );
}
