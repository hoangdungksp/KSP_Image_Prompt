/**
 * KSP Image v0.9.3-r6 — Film Bundle Export Section (Mockup 5)
 *
 * Final pipeline section. Shows:
 *   - ASCII folder tree preview (Hướng A: static, read-only)
 *   - Download ZIP button (Mockup 5 verbatim structure)
 *   - Stats summary (characters, scenes, shots, total images, voice lines)
 *
 * Replaces deprecated BundleExportV09.tsx (atomic Q6).
 */

import React, { useState, useMemo } from "react";
import { useAppStore } from "../store/useAppStore";
import { ensureFilmData } from "../store/film_actions";
import {
  exportFilmBundle,
  previewBundleTree,
  type BundleExportStats,
} from "../engine/filmBundleExporter";

export function FilmBundleExportSection() {
  const project = useAppStore((s) => s.currentProject);
  const showToast = useAppStore((s) => s.showToast);

  const [isExporting, setIsExporting] = useState(false);
  const [lastStats, setLastStats] = useState<BundleExportStats | null>(null);

  const treePreview = useMemo(
    () => (project ? previewBundleTree(project) : ""),
    [project]
  );

  if (!project) return null;
  const film = ensureFilmData(project);
  const setting = (project as any).settingV2;

  const canExport =
    !!setting && (film.characters.length > 0 || (film.script?.scenes.length ?? 0) > 0);

  async function handleExport() {
    if (!project) return;
    setIsExporting(true);
    try {
      const { blob, filename, stats } = await exportFilmBundle(project);
      setLastStats(stats);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Bundle downloaded: ${filename} (${stats.estimatedSizeKb} KB)`, "success");
    } catch (err) {
      showToast(`Export error: ${(err as Error).message}`, "error");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <section className="ksp-section ksp-bundle-film">
      <header className="ksp-section-header">
        <span className="ksp-section-icon">📦</span>
        <h2 className="ksp-section-title">BUNDLE EXPORT</h2>
      </header>

      <div className="ksp-bundle-film-body">
        <p className="ksp-bundle-film-intro">
          Gói toàn bộ project vào 1 file ZIP để chuyển sang Banana Pro /
          Seedance / CapCut: prompts + ảnh refs + grids + music briefs + SFX
          links + script.
        </p>

        <h3 className="ksp-bundle-film-h3">📂 Folder structure preview</h3>
        <pre className="ksp-bundle-film-tree">{treePreview}</pre>

        {!canExport && (
          <div className="ksp-bundle-film-warning">
            ⚠ Chưa đủ data để export. Thêm cast hoặc generate script trước.
          </div>
        )}

        <div className="ksp-bundle-film-actions">
          <button
            type="button"
            className="ksp-btn ksp-btn-primary ksp-bundle-film-download"
            onClick={handleExport}
            disabled={!canExport || isExporting}
          >
            {isExporting ? "Building ZIP..." : "↓ Download Bundle ZIP"}
          </button>
        </div>

        {lastStats && (
          <div className="ksp-bundle-film-stats">
            <strong>Last export:</strong> {lastStats.characterCount} characters
            · {lastStats.sceneCount} scenes · {lastStats.shotCount} shots ·{" "}
            {lastStats.totalImages} images · {lastStats.voiceLineCount} voice lines · {lastStats.estimatedSizeKb} KB
          </div>
        )}

        <div className="ksp-bundle-film-footer">
          ⓘ Image binaries (grid + cropped frames) đọc trực tiếp từ schema r5
          inline base64. r6 ship complete folder structure. PDF format defer
          Sprint 0.9.4 (giờ là script.txt plain text).
        </div>
      </div>
    </section>
  );
}
