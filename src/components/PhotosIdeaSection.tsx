/**
 * KSP Image v0.9.1 — Photos Idea Section
 *
 * Step 1 in Photos pipeline.
 * Theme picker: search bar + category pills + theme list.
 * Falls back to free-text idea (Vietnamese) when no theme matches.
 *
 * Reuses THEMES catalog (227 entries / 12 categories) from engine/themes.ts.
 */

import React, { useMemo, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import {
  ensurePhotosData,
  selectTheme,
  setCustomIdea,
  setCustomIntent,
  setThemeCategory,
} from "../store/photos_actions";
import {
  THEMES,
  THEME_CATEGORIES,
  searchThemes,
  getThemeById,
  type ThemePreset,
} from "../engine/themes";

const PHOTOS_THEMES = THEMES.filter(
  (t) => !t.mode || t.mode === "lifestyle" || t.mode === "editorial_fashion"
);

export function PhotosIdeaSection() {
  const project = useAppStore((s) => s.currentProject);
  const updateProject = useAppStore((s) => s.updateCurrentProject);
  if (!project) return null;
  const photos = ensurePhotosData(project);

  const [searchQuery, setSearchQuery] = useState("");
  const selectedCategoryId = photos.theme.selectedCategoryId;
  const selectedThemeId = photos.theme.themeId;
  const customIdea = photos.theme.customIdeaVi ?? "";

  const filteredThemes: ThemePreset[] = useMemo(() => {
    let pool = PHOTOS_THEMES;
    if (selectedCategoryId) pool = pool.filter((t) => t.category === selectedCategoryId);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      pool = pool.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.descriptionEn.toLowerCase().includes(q)
      );
    }
    return pool.slice(0, 100); // cap UI list to 100 entries (with scroll)
  }, [selectedCategoryId, searchQuery]);

  const selectedTheme = selectedThemeId ? getThemeById(selectedThemeId) : undefined;

  return (
    <section className="ksp-section ksp-photos-idea">
      <header className="ksp-section-header">
        <span className="ksp-step-num">1.</span>
        <span className="ksp-section-icon">💡</span>
        <h2 className="ksp-section-title">Ý TƯỞNG</h2>
      </header>

      <div className="ksp-photos-idea-body">
        <label className="ksp-label">
          <span className="ksp-label-text">
            Theme preset · {PHOTOS_THEMES.length}+ themes / {THEME_CATEGORIES.length} categories
          </span>
        </label>

        <div className="ksp-theme-picker">
          {/* Search */}
          <div className="ksp-theme-search">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theme... (vd: áo dài, café, hoàng hôn)"
              className="ksp-input"
            />
          </div>

          {/* Category pills */}
          <div className="ksp-theme-cats">
            <button
              type="button"
              className={`ksp-cat-pill ${!selectedCategoryId ? "ksp-cat-pill-selected" : ""}`}
              onClick={() => updateProject(setThemeCategory(project, undefined))}
            >
              Tất cả
            </button>
            {THEME_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`ksp-cat-pill ${selectedCategoryId === cat.id ? "ksp-cat-pill-selected" : ""}`}
                onClick={() => updateProject(setThemeCategory(project, cat.id))}
                title={cat.description}
              >
                {cat.emoji} {cat.name}
              </button>
            ))}
          </div>

          {/* Theme list */}
          <div className="ksp-theme-list">
            {filteredThemes.length === 0 ? (
              <div className="ksp-theme-empty">
                Không tìm thấy theme. Gõ ý tưởng tự do bên dưới.
              </div>
            ) : (
              filteredThemes.map((theme) => (
                <div
                  key={theme.id}
                  className={`ksp-theme-item ${selectedThemeId === theme.id ? "ksp-theme-item-selected" : ""}`}
                  onClick={() => updateProject(selectTheme(project, theme.id))}
                  role="button"
                  tabIndex={0}
                >
                  <span className="ksp-theme-icon">
                    {selectedThemeId === theme.id ? "●" : "○"}
                  </span>
                  <span className="ksp-theme-emoji">{theme.emoji}</span>
                  <span className="ksp-theme-name">{theme.name}</span>
                  <span className={`ksp-theme-style-pill ksp-style-${theme.cameraStyle.toLowerCase()}`}>
                    {theme.cameraStyle === "BOKEH" ? "B" : "D"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Selected theme summary */}
        {selectedTheme && (
          <div className="ksp-preset-summary">
            <div className="ksp-summary-item">
              <span className="ksp-summary-key">Mood:</span>
              {selectedTheme.mood?.join(", ") ?? "—"}
            </div>
            <div className="ksp-summary-item">
              <span className="ksp-summary-key">Setting:</span>
              {selectedTheme.description}
            </div>
            <div className="ksp-summary-item">
              <span className="ksp-summary-key">Camera:</span>
              {selectedTheme.cameraStyle} · {selectedTheme.time ?? "—"}
            </div>

            {/* Custom intent on top of selected theme */}
            <CustomIntentEditor />

            <button
              type="button"
              className="ksp-btn-link"
              onClick={() => updateProject(selectTheme(project, undefined))}
            >
              Bỏ chọn theme
            </button>
          </div>
        )}

        {/* Custom idea fallback */}
        {!selectedTheme && (
          <div className="ksp-custom-idea">
            <label className="ksp-label">
              <span className="ksp-label-text">Hoặc gõ ý tưởng tự do (Tiếng Việt)</span>
              <textarea
                value={customIdea}
                onChange={(e) => updateProject(setCustomIdea(project, e.target.value))}
                placeholder="vd: Cô gái áo dài đứng trên cầu đá, hoàng hôn vàng cam, nền sông Sài Gòn..."
                className="ksp-textarea"
                rows={3}
              />
            </label>
          </div>
        )}
      </div>
    </section>
  );
}

// ============================================================================
// CUSTOM INTENT EDITOR — additional user wishes on top of selected theme
// ============================================================================
//
// User flow:
//   1. Pick theme (e.g., "Áo dài bên cây mai")
//   2. Type Vietnamese custom intent (e.g., "cầm bó hoa hồng đỏ thay vì hoa cúc")
//   3. Click 🌐 Dịch → Gemini translates → English shown below
//   4. Engine A+ injects English intent into background block alongside theme
//
function CustomIntentEditor() {
  const project = useAppStore((s) => s.currentProject);
  const updateProject = useAppStore((s) => s.updateCurrentProject);
  const showToast = useAppStore((s) => s.showToast);
  const [translating, setTranslating] = React.useState(false);

  if (!project) return null;
  const photos = ensurePhotosData(project);
  const intentVi = photos.theme.customIntentVi || "";
  const intentEn = photos.theme.customIntentEn || "";

  const handleTranslate = async () => {
    if (!intentVi.trim()) {
      showToast("Gõ ý tưởng tiếng Việt trước khi dịch", "error");
      return;
    }
    setTranslating(true);
    try {
      // Lazy import to avoid loading Gemini client unless user clicks Dịch
      const { translateVnToEn } = await import("../engine/gemini");
      const en = await translateVnToEn(intentVi);
      updateProject(setCustomIntent(project, { en }));
      showToast(`✓ Đã dịch (${en.length} chars)`, "success");
    } catch (e: any) {
      showToast(`Dịch lỗi: ${e.message}`, "error");
    } finally {
      setTranslating(false);
    }
  };

  const handleClear = () => {
    updateProject(setCustomIntent(project, null));
  };

  return (
    <div className="ksp-custom-intent">
      <label className="ksp-label" style={{ marginTop: 10 }}>
        <span className="ksp-label-text">
          ✨ Custom intent (tiếng Việt) · cộng thêm vào theme
        </span>
        <textarea
          value={intentVi}
          onChange={(e) => updateProject(setCustomIntent(project, { vi: e.target.value }))}
          placeholder="vd: cầm bó hoa hồng đỏ thay vì hoa cúc, mặt cười rạng rỡ, ánh sáng xuyên qua cành cây..."
          className="ksp-textarea ksp-custom-intent-textarea"
          rows={2}
          maxLength={500}
        />
      </label>
      <div className="ksp-custom-intent-actions">
        <button
          type="button"
          className="ksp-btn ksp-btn-sm ksp-btn-ghost"
          onClick={handleTranslate}
          disabled={translating || !intentVi.trim()}
        >
          {translating ? "⏳ Đang dịch..." : "🌐 Dịch sang tiếng Anh"}
        </button>
        {(intentVi || intentEn) && (
          <button
            type="button"
            className="ksp-btn ksp-btn-sm ksp-btn-ghost-danger"
            onClick={handleClear}
          >
            Xóa
          </button>
        )}
      </div>
      {intentEn && (
        <div className="ksp-custom-intent-en">
          <span className="ksp-custom-intent-en-label">✓ EN:</span> {intentEn}
        </div>
      )}
      {intentVi && !intentEn && (
        <div className="ksp-custom-intent-hint">
          💡 Chưa dịch — engine sẽ inject tiếng Việt thẳng (AI hiểu được nhưng dịch sẽ chính xác hơn).
        </div>
      )}
    </div>
  );
}
