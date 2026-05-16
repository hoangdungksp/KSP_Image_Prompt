/**
 * KSP Image qc15 — Grid Crop Preview Modal
 *
 * Opens after user uploads a grid PNG. Shows live preview with overlay grid
 * + cell numbers, allows tuning:
 *   - AI provider (Nano Banana / ChatGPT / Grok / Imagen 4 / Custom)
 *   - Total grid dimensions (textbox, auto-fills from provider preset)
 *   - Gutter px (slider 0-20)
 *
 * User clicks "Approve & Crop" → returns ShotCropSettings to parent, which
 * then runs cropGridIntoFrames() engine call.
 * User clicks "Cancel" → modal closes without saving.
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import type { ShotCropSettings } from "../types/project";
import {
  GRID_PROVIDERS,
  getProviderDefaultSize,
  getProviderDefaultGutter,
} from "../engine/gridProviders";

export interface GridCropPreviewModalProps {
  /** Source grid image as base64 dataURL (user just uploaded) */
  gridDataUrl: string;
  /** Grid format from scene, e.g. "3x3" (CxR convention: 3 cols × 3 rows) */
  gridFormat: string;
  /**
   * qc22 hotfix: Project aspect ratio (e.g. "16:9", "9:16", "1:1").
   * Used to compute target cell aspect — cells will be center-cropped to this ratio
   * so Storyboard displays cells without further distortion.
   */
  projectAspectRatio: string;
  /** Pre-fill from existing shot settings OR project default OR null */
  initialSettings?: ShotCropSettings;
  /** User clicked Approve — return settings + final grid format chosen (may differ from prop if user override) */
  onApprove: (settings: ShotCropSettings, finalGridFormat: string) => void;
  /** User clicked Cancel — discard upload */
  onCancel: () => void;
}

/** Detect aspect bias from dimensions for default size lookup */
function detectAspectBias(w: number, h: number): "16:9" | "9:16" | "1:1" {
  const ratio = w / h;
  if (ratio > 1.3) return "16:9";
  if (ratio < 0.77) return "9:16";
  return "1:1";
}

/** Grid format options for the override dropdown — keep in sync with SceneGridFormat type */
const GRID_FORMAT_CHOICES = [
  { value: "2x2", label: "2×2 (4 cells)" },
  { value: "3x2", label: "3×2 (6 cells, wide)" },
  { value: "2x3", label: "2×3 (6 cells, tall)" },
  { value: "4x2", label: "4×2 (8 cells, wide)" },
  { value: "2x4", label: "2×4 (8 cells, tall)" },
  { value: "3x3", label: "3×3 (9 cells)" },
  { value: "4x3", label: "4×3 (12 cells, wide)" },
  { value: "3x4", label: "3×4 (12 cells, tall)" },
  { value: "4x4", label: "4×4 (16 cells)" },
];

export function GridCropPreviewModal({
  gridDataUrl,
  gridFormat,
  projectAspectRatio,
  initialSettings,
  onApprove,
  onCancel,
}: GridCropPreviewModalProps) {
  const [provider, setProvider] = useState<string>(
    initialSettings?.provider ?? "custom"
  );
  // Local override of grid format — defaults to scene's format, user can change
  // if AI returned different layout (e.g. requested 4x2 but AI made 3x3).
  const [localGridFormat, setLocalGridFormat] = useState<string>(gridFormat);
  const [totalWidth, setTotalWidth] = useState<number>(
    initialSettings?.totalWidth ?? 0
  );
  const [totalHeight, setTotalHeight] = useState<number>(
    initialSettings?.totalHeight ?? 0
  );
  const [gutterPx, setGutterPx] = useState<number>(
    initialSettings?.gutterPx ?? 0
  );
  const [imageNatural, setImageNatural] = useState<{ w: number; h: number } | null>(
    null
  );
  const imgRef = useRef<HTMLImageElement>(null);

  // Parse grid format CxR — same convention as parseGridFormat in sceneGridPacker
  const [cols, rows] = useMemo(() => {
    const parts = localGridFormat.toLowerCase().split("x").map(Number);
    return [parts[0] || 3, parts[1] || 3];
  }, [localGridFormat]);

  // qc22 hotfix: compute target cell aspect ratio from project setting.
  // Cells will be center-cropped to this aspect, so Storyboard displays them
  // without further distortion.
  const targetCellAspect = useMemo(() => {
    const parts = projectAspectRatio.split(":").map(Number);
    const w = parts[0] || 16;
    const h = parts[1] || 9;
    return w / h;
  }, [projectAspectRatio]);

  // On image load: auto-detect natural dimensions, set initial size if not set
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      setImageNatural({ w, h });
      // If no initial settings, pre-fill from custom (auto-detect) defaults
      if (!initialSettings) {
        setTotalWidth(w);
        setTotalHeight(h);
        // Provider stays "custom" by default — user picks if they know
      }
    };
    img.src = gridDataUrl;
  }, [gridDataUrl, initialSettings]);

  // When provider changes, auto-fill size + gutter (unless custom)
  function handleProviderChange(newProviderId: string) {
    setProvider(newProviderId);
    if (newProviderId === "custom") {
      // Auto-detect from image
      if (imageNatural) {
        setTotalWidth(imageNatural.w);
        setTotalHeight(imageNatural.h);
      }
      setGutterPx(0);
      return;
    }
    // Pick aspect bias from current image
    const aspect = imageNatural
      ? detectAspectBias(imageNatural.w, imageNatural.h)
      : "16:9";
    const presetSize = getProviderDefaultSize(newProviderId, aspect);
    if (presetSize) {
      setTotalWidth(presetSize.w);
      setTotalHeight(presetSize.h);
    }
    setGutterPx(getProviderDefaultGutter(newProviderId));
  }

  // Compute cell dimensions in USER coordinates (for overlay display)
  const cellW = useMemo(
    () => Math.max(0, (totalWidth - gutterPx * (cols - 1)) / cols),
    [totalWidth, gutterPx, cols]
  );
  const cellH = useMemo(
    () => Math.max(0, (totalHeight - gutterPx * (rows - 1)) / rows),
    [totalHeight, gutterPx, rows]
  );
  const cellAspect = useMemo(() => (cellH > 0 ? cellW / cellH : 0), [cellW, cellH]);

  // qc22 hotfix: output cell dims AFTER target aspect crop.
  // Source cell may be square-ish (e.g. 904×758 from 16:9 image / 3x2 grid),
  // but we center-crop to target aspect (16:9 → 904×508).
  const outputCell = useMemo(() => {
    if (cellW <= 0 || cellH <= 0) return { w: 0, h: 0, cropped: false };
    if (Math.abs(targetCellAspect - cellAspect) < 0.01) {
      return { w: cellW, h: cellH, cropped: false };
    }
    if (targetCellAspect > cellAspect) {
      // Target wider → crop height
      const newH = cellW / targetCellAspect;
      return { w: cellW, h: newH, cropped: true };
    }
    // Target taller → crop width
    const newW = cellH * targetCellAspect;
    return { w: newW, h: cellH, cropped: true };
  }, [cellW, cellH, cellAspect, targetCellAspect]);

  // Validation — disable approve if invalid
  const validation = useMemo(() => {
    if (!imageNatural) return { ok: false, msg: "Đang load ảnh..." };
    if (totalWidth < cols * 16 || totalHeight < rows * 16) {
      return { ok: false, msg: `Kích thước quá nhỏ cho grid ${rows}×${cols}` };
    }
    if (cellW < 4 || cellH < 4) {
      return { ok: false, msg: "Cell quá nhỏ — giảm gutter" };
    }
    return { ok: true, msg: `Mỗi cell ${Math.round(cellW)}×${Math.round(cellH)}` };
  }, [imageNatural, totalWidth, totalHeight, cellW, cellH, rows, cols]);

  function handleApprove() {
    if (!validation.ok) return;
    onApprove(
      {
        provider,
        totalWidth: Math.round(totalWidth),
        totalHeight: Math.round(totalHeight),
        gutterPx: Math.round(gutterPx),
      },
      localGridFormat
    );
  }

  return (
    <div className="ksp-grid-crop-modal-backdrop" onClick={onCancel}>
      <div
        className="ksp-grid-crop-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Preview và crop grid"
      >
        <header className="ksp-grid-crop-modal-header">
          <h3>📐 Preview & Crop Grid</h3>
          <button
            type="button"
            className="ksp-grid-crop-modal-close"
            onClick={onCancel}
            aria-label="Đóng"
          >
            ×
          </button>
        </header>

        <div className="ksp-grid-crop-modal-body">
          {/* Controls row 1: Provider + Grid info */}
          <div className="ksp-grid-crop-controls-row">
            <div className="ksp-grid-crop-field">
              <label>AI Provider</label>
              <select
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value)}
              >
                {GRID_PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="ksp-grid-crop-field">
              <label>Grid format {localGridFormat !== gridFormat && <span style={{ color: "#ffb86c" }}>(override)</span>}</label>
              <select
                value={localGridFormat}
                onChange={(e) => setLocalGridFormat(e.target.value)}
                title="Đổi nếu AI tạo grid khác kích thước (vd request 4×2 nhưng AI tạo 3×3)"
              >
                {GRID_FORMAT_CHOICES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Controls row 2: Width + Height */}
          <div className="ksp-grid-crop-controls-row">
            <div className="ksp-grid-crop-field">
              <label>Width (px)</label>
              <input
                type="number"
                value={totalWidth || ""}
                onChange={(e) => setTotalWidth(Number(e.target.value) || 0)}
                min={cols * 16}
                step={1}
              />
            </div>
            <div className="ksp-grid-crop-field">
              <label>Height (px)</label>
              <input
                type="number"
                value={totalHeight || ""}
                onChange={(e) => setTotalHeight(Number(e.target.value) || 0)}
                min={rows * 16}
                step={1}
              />
            </div>
          </div>

          {/* Image natural size info */}
          {imageNatural && (
            <div className="ksp-grid-crop-natural-info">
              Ảnh thật: {imageNatural.w}×{imageNatural.h}
              {(imageNatural.w !== totalWidth || imageNatural.h !== totalHeight) && (
                <button
                  type="button"
                  className="ksp-grid-crop-link-btn"
                  onClick={() => {
                    setTotalWidth(imageNatural.w);
                    setTotalHeight(imageNatural.h);
                  }}
                >
                  Sync from image
                </button>
              )}
            </div>
          )}

          {/* Gutter slider */}
          <div className="ksp-grid-crop-gutter-row">
            <label>
              Gutter: <strong>{gutterPx}px</strong>
            </label>
            <input
              type="range"
              min={0}
              max={20}
              step={1}
              value={gutterPx}
              onChange={(e) => setGutterPx(Number(e.target.value))}
              className="ksp-grid-crop-slider"
            />
            <span className="ksp-grid-crop-gutter-hint">
              Kéo để chỉnh viền giữa cells
            </span>
          </div>

          {/* Preview with overlay */}
          <div className="ksp-grid-crop-preview-wrap">
            <img
              ref={imgRef}
              src={gridDataUrl}
              alt="Grid preview"
              className="ksp-grid-crop-preview-img"
            />
            <PreviewOverlay
              rows={rows}
              cols={cols}
              totalWidth={totalWidth}
              totalHeight={totalHeight}
              gutterPx={gutterPx}
              targetCellAspect={targetCellAspect}
            />
          </div>

          {/* Output info */}
          <div className="ksp-grid-crop-output-info">
            <div>
              <strong>Source cells:</strong> {rows * cols} × ~{Math.round(cellW)}×
              {Math.round(cellH)} px (aspect {cellAspect.toFixed(2)}:1)
            </div>
            {outputCell.cropped && (
              <div className="ksp-grid-crop-target-info">
                <strong>→ Output cells (cropped to {projectAspectRatio}):</strong>{" "}
                ~{Math.round(outputCell.w)}×{Math.round(outputCell.h)} px
                (aspect {targetCellAspect.toFixed(2)}:1)
              </div>
            )}
            <div
              className={`ksp-grid-crop-validation ${
                validation.ok ? "ok" : "error"
              }`}
            >
              {validation.ok ? "✓" : "⚠"} {validation.msg}
            </div>
          </div>
        </div>

        <footer className="ksp-grid-crop-modal-footer">
          <button
            type="button"
            className="ksp-btn ksp-btn-ghost"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="ksp-btn ksp-btn-primary ksp-grid-crop-approve-btn"
            onClick={handleApprove}
            disabled={!validation.ok}
          >
            ✓ Approve & Crop
          </button>
        </footer>
      </div>
    </div>
  );
}

/**
 * Live preview overlay — semi-transparent purple rects + cell numbers (F1-F9).
 * Positioned absolutely over the image, scales with image display size.
 */
function PreviewOverlay({
  rows,
  cols,
  totalWidth,
  totalHeight,
  gutterPx,
  targetCellAspect,
}: {
  rows: number;
  cols: number;
  totalWidth: number;
  totalHeight: number;
  gutterPx: number;
  targetCellAspect: number;
}) {
  if (totalWidth <= 0 || totalHeight <= 0) return null;

  const cellWPct = ((totalWidth - gutterPx * (cols - 1)) / cols / totalWidth) * 100;
  const cellHPct =
    ((totalHeight - gutterPx * (rows - 1)) / rows / totalHeight) * 100;
  const gutterWPct = (gutterPx / totalWidth) * 100;
  const gutterHPct = (gutterPx / totalHeight) * 100;

  // qc22 hotfix: compute inner crop zone within each cell to indicate target aspect crop
  const cellWPx = (totalWidth - gutterPx * (cols - 1)) / cols;
  const cellHPx = (totalHeight - gutterPx * (rows - 1)) / rows;
  const sourceCellAspect = cellHPx > 0 ? cellWPx / cellHPx : 1;
  const aspectMismatch =
    targetCellAspect > 0 && Math.abs(targetCellAspect - sourceCellAspect) > 0.01;

  // Inner crop zone dimensions (% of cell, centered)
  let innerWPctOfCell = 100;
  let innerHPctOfCell = 100;
  if (aspectMismatch) {
    if (targetCellAspect > sourceCellAspect) {
      // Target wider → crop top/bottom → inner H smaller
      innerHPctOfCell = (sourceCellAspect / targetCellAspect) * 100;
    } else {
      // Target taller → crop left/right → inner W smaller
      innerWPctOfCell = (targetCellAspect / sourceCellAspect) * 100;
    }
  }

  const cells: JSX.Element[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const left = c * (cellWPct + gutterWPct);
      const top = r * (cellHPct + gutterHPct);
      const order = r * cols + c + 1;
      cells.push(
        <div
          key={`${r}-${c}`}
          className="ksp-grid-crop-overlay-cell"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            width: `${cellWPct}%`,
            height: `${cellHPct}%`,
          }}
        >
          {/* Inner crop zone (target aspect) — only visible when mismatch */}
          {aspectMismatch && (
            <div
              className="ksp-grid-crop-overlay-target"
              style={{
                width: `${innerWPctOfCell}%`,
                height: `${innerHPctOfCell}%`,
              }}
            />
          )}
          <span className="ksp-grid-crop-overlay-label">F{order}</span>
        </div>
      );
    }
  }

  return <div className="ksp-grid-crop-overlay">{cells}</div>;
}
