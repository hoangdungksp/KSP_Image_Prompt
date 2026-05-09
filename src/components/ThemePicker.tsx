import { useState, useMemo } from "react";
import {
  THEMES,
  THEME_CATEGORIES,
  searchThemes,
  getThemesByCategory,
  type ThemePreset,
} from "../engine/themes";
import { useAppStore } from "../store/useAppStore";
import { SHOT_MODES, INDUSTRIES } from "../engine/themes_industry/_modes_industries";

interface Props {
  onSelect: (theme: ThemePreset) => void;
  onClose: () => void;
}

export function ThemePicker({ onSelect, onClose }: Props) {
  const { currentProject } = useAppStore();
  const projectMode = (currentProject as any)?.mode || "lifestyle";
  const projectIndustry = (currentProject as any)?.industry || "general";

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<string>(projectMode);
  const [filterIndustry, setFilterIndustry] = useState<string>(projectIndustry);

  const displayed = useMemo(() => {
    let list = THEMES;

    if (search.trim()) {
      return searchThemes(search);
    }

    if (filterMode && filterMode !== "all") {
      list = list.filter((t) => (t.mode || "lifestyle") === filterMode);
    }

    if (filterIndustry && filterIndustry !== "general") {
      list = list.filter((t) => (t.industry || "travel") === filterIndustry);
    }

    if (activeCategory) {
      list = list.filter((t) => t.category === activeCategory);
    }

    return list;
  }, [search, activeCategory, filterMode, filterIndustry]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-2"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-ksp-panel border border-ksp-border rounded-lg w-full max-w-md max-h-[90vh] flex flex-col"
      >
        <div className="border-b border-ksp-border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">💡 Chọn ý tưởng ({displayed.length})</h3>
            <button
              onClick={onClose}
              className="text-ksp-muted hover:text-ksp-text text-lg leading-none"
            >
              ✕
            </button>
          </div>

          <input
            type="text"
            placeholder="🔍 Tìm kiếm... (vd: áo dài, serum, smart glasses)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />

          {!search.trim() && (
            <>
              <div className="flex flex-wrap gap-1">
                <span className="text-[10px] text-ksp-muted self-center mr-1">Mode:</span>
                <button
                  onClick={() => setFilterMode("all")}
                  className={`text-[10px] px-2 py-0.5 rounded ${
                    filterMode === "all"
                      ? "bg-ksp-accent text-black"
                      : "bg-ksp-bg border border-ksp-border text-ksp-muted"
                  }`}
                >
                  All
                </button>
                {SHOT_MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setFilterMode(m.id)}
                    className={`text-[10px] px-2 py-0.5 rounded ${
                      filterMode === m.id
                        ? "bg-ksp-accent text-black"
                        : "bg-ksp-bg border border-ksp-border text-ksp-muted hover:text-ksp-text"
                    }`}
                  >
                    {m.emoji} {m.name}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-1">
                <span className="text-[10px] text-ksp-muted self-center mr-1">Industry:</span>
                {INDUSTRIES.map((ind) => (
                  <button
                    key={ind.id}
                    onClick={() => setFilterIndustry(ind.id)}
                    className={`text-[10px] px-2 py-0.5 rounded ${
                      filterIndustry === ind.id
                        ? "bg-ksp-accent text-black"
                        : "bg-ksp-bg border border-ksp-border text-ksp-muted hover:text-ksp-text"
                    }`}
                    title={ind.hintVi}
                  >
                    {ind.emoji} {ind.name}
                  </button>
                ))}
              </div>

              {filterIndustry === "travel" && (
                <div className="flex flex-wrap gap-1 pt-1 border-t border-ksp-border">
                  <button
                    onClick={() => setActiveCategory(null)}
                    className={`text-[10px] px-2 py-0.5 rounded ${
                      activeCategory === null
                        ? "bg-ksp-accent text-black"
                        : "bg-ksp-bg border border-ksp-border text-ksp-muted"
                    }`}
                  >
                    Tất cả categories
                  </button>
                  {THEME_CATEGORIES.map((cat) => {
                    const count = getThemesByCategory(cat.id).length;
                    if (count === 0) return null;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.id)}
                        className={`text-[10px] px-2 py-0.5 rounded ${
                          activeCategory === cat.id
                            ? "bg-ksp-accent text-black"
                            : "bg-ksp-bg border border-ksp-border text-ksp-muted hover:text-ksp-text"
                        }`}
                        title={cat.description}
                      >
                        {cat.emoji} {cat.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {displayed.length === 0 ? (
            <div className="text-center text-xs text-ksp-muted py-8">
              Không tìm thấy theme phù hợp với filter này.
            </div>
          ) : (
            <div className="space-y-1.5">
              {displayed.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => {
                    onSelect(theme);
                    onClose();
                  }}
                  className="w-full text-left p-2 bg-ksp-bg border border-ksp-border rounded hover:border-ksp-accent transition-colors group"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg leading-none">{theme.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-xs font-semibold group-hover:text-ksp-accent">
                          {theme.name}
                        </span>
                        {theme.mode && theme.mode !== "lifestyle" && (
                          <span className="text-[9px] px-1 rounded bg-ksp-accent/20 text-ksp-accent">
                            {SHOT_MODES.find((m) => m.id === theme.mode)?.emoji}{" "}
                            {SHOT_MODES.find((m) => m.id === theme.mode)?.name}
                          </span>
                        )}
                        {theme.industry && theme.industry !== "travel" && theme.industry !== "general" && (
                          <span className="text-[9px] px-1 rounded bg-blue-500/20 text-blue-400">
                            {INDUSTRIES.find((i) => i.id === theme.industry)?.emoji}{" "}
                            {INDUSTRIES.find((i) => i.id === theme.industry)?.name}
                          </span>
                        )}
                        <span
                          className={`text-[9px] px-1 rounded ${
                            theme.cameraStyle === "BOKEH"
                              ? "bg-purple-500/20 text-purple-400"
                              : "bg-blue-500/20 text-blue-400"
                          }`}
                        >
                          {theme.cameraStyle === "BOKEH" ? "📸 Bokeh" : "📱 Doc"}
                        </span>
                      </div>
                      <p className="text-[11px] text-ksp-muted mt-0.5 line-clamp-2">
                        {theme.description}
                      </p>
                      {theme.mood && theme.mood.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {theme.mood.slice(0, 3).map((m) => (
                            <span
                              key={m}
                              className="text-[9px] text-ksp-muted bg-ksp-panel px-1 rounded"
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
