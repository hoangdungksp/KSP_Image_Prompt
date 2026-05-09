import { useAppStore } from "../store/useAppStore";
import { Section } from "./Section";
import {
  SHOT_MODES,
  INDUSTRIES,
  FILM_GENRES,
  ANIMATION_STYLES,
} from "../engine/themes_industry/_modes_industries";
import type {
  ShotMode,
  Industry,
  FilmGenre,
  AnimationStyle,
} from "../engine/themes_industry/_modes_industries";

export function ModeIndustrySection() {
  const { currentProject, updateCurrentProject } = useAppStore();
  if (!currentProject) return null;

  const currentMode = (currentProject as any).mode || "lifestyle";
  const currentIndustry = (currentProject as any).industry || "general";
  const currentGenre: FilmGenre = (currentProject as any).filmGenre || "drama";
  const currentAnimStyle: AnimationStyle =
    (currentProject as any).animationStyle || "live_action";

  const isFilm = currentMode === "film";

  const handleModeChange = (mode: ShotMode) => {
    const modeConfig = SHOT_MODES.find((m) => m.id === mode);
    const updates: any = { mode };

    if (modeConfig?.defaults.cameraStyle) {
      updates.cameraStyle = modeConfig.defaults.cameraStyle;
    }

    // v0.8.0: When switching to film, set defaults
    if (mode === "film") {
      if (!(currentProject as any).filmGenre) updates.filmGenre = "drama";
      if (!(currentProject as any).animationStyle) updates.animationStyle = "live_action";
      if (!(currentProject as any).filmSubjectMode) updates.filmSubjectMode = "simple";
    }

    // If non-film mode doesn't support current industry, switch to "general"
    const currentInd = INDUSTRIES.find((i) => i.id === currentIndustry);
    if (mode !== "film" && currentInd && !currentInd.supportedModes.includes(mode)) {
      updates.industry = "general";
    }

    updateCurrentProject(updates);
  };

  const handleIndustryChange = (industry: Industry) => {
    updateCurrentProject({ ...(currentProject as any), industry } as any);
  };

  const handleGenreChange = (filmGenre: FilmGenre) => {
    updateCurrentProject({ ...(currentProject as any), filmGenre } as any);
  };

  const handleAnimStyleChange = (animationStyle: AnimationStyle) => {
    updateCurrentProject({ ...(currentProject as any), animationStyle } as any);
  };

  const modeConfig = SHOT_MODES.find((m) => m.id === currentMode);
  const industryConfig = INDUSTRIES.find((i) => i.id === currentIndustry);
  const genreConfig = FILM_GENRES.find((g) => g.id === currentGenre);
  const animStyleConfig = ANIMATION_STYLES.find((s) => s.id === currentAnimStyle);

  const supportedIndustries = INDUSTRIES.filter((ind) =>
    ind.supportedModes.includes(currentMode)
  );

  return (
    <Section title="🎬 Mode & Style">
      {/* Mode selector */}
      <div>
        <label>Mode</label>
        <div className="grid grid-cols-2 gap-1">
          {SHOT_MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => handleModeChange(m.id)}
              className={`p-2 rounded text-left border transition-colors ${
                currentMode === m.id
                  ? "bg-ksp-accent text-black border-ksp-accent"
                  : "bg-ksp-bg border-ksp-border hover:border-ksp-accent/50"
              }`}
            >
              <div className="text-xs font-medium">
                {m.emoji} {m.name}
              </div>
              <div className="text-[10px] opacity-80 leading-tight mt-0.5">
                {m.description}
              </div>
            </button>
          ))}
        </div>
        {modeConfig && (
          <p className="text-[10px] text-ksp-muted mt-1.5 italic">
            💡 {modeConfig.hintVi}
          </p>
        )}
      </div>

      {/* v0.8.0: Film mode → Genre + Animation Style. Other modes → Industry */}
      {isFilm ? (
        <>
          {/* Film Genre */}
          <div>
            <label>
              🎭 Genre <span className="text-[9px] text-ksp-muted">(thể loại phim)</span>
            </label>
            <div className="grid grid-cols-3 gap-1">
              {FILM_GENRES.map((g) => (
                <button
                  key={g.id}
                  onClick={() => handleGenreChange(g.id)}
                  className={`p-1.5 rounded text-center text-[11px] border transition-colors ${
                    currentGenre === g.id
                      ? "bg-ksp-accent text-black border-ksp-accent"
                      : "bg-ksp-bg border-ksp-border hover:border-ksp-accent/50"
                  }`}
                  title={g.hintVi}
                >
                  <div className="text-base leading-tight">{g.emoji}</div>
                  <div className="leading-tight mt-0.5">{g.name}</div>
                </button>
              ))}
            </div>
            {genreConfig && (
              <div className="text-[10px] text-ksp-muted mt-1.5 italic space-y-0.5">
                <div>{genreConfig.hintVi}</div>
                <div className="opacity-70">
                  References: {genreConfig.styleReferences.slice(0, 3).join(", ")}
                </div>
              </div>
            )}
          </div>

          {/* Animation Style */}
          <div>
            <label>
              🎨 Animation Style{" "}
              <span className="text-[9px] text-ksp-muted">(phong cách hình ảnh)</span>
            </label>
            <div className="grid grid-cols-3 gap-1">
              {ANIMATION_STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleAnimStyleChange(s.id)}
                  className={`p-1.5 rounded text-center text-[11px] border transition-colors ${
                    currentAnimStyle === s.id
                      ? "bg-ksp-accent text-black border-ksp-accent"
                      : "bg-ksp-bg border-ksp-border hover:border-ksp-accent/50"
                  }`}
                  title={s.hintVi}
                >
                  <div className="text-base leading-tight">{s.emoji}</div>
                  <div className="leading-tight mt-0.5">{s.name}</div>
                </button>
              ))}
            </div>
            {animStyleConfig && (
              <p className="text-[10px] text-ksp-muted mt-1.5 italic">
                {animStyleConfig.hintVi}
              </p>
            )}
          </div>
        </>
      ) : (
        /* Industry selector for non-film modes */
        <div>
          <label>
            Industry / Ngành{" "}
            <span className="text-[9px] text-ksp-muted">
              (chỉ hiện ngành phù hợp với mode)
            </span>
          </label>
          <div className="grid grid-cols-3 gap-1">
            {supportedIndustries.map((ind) => (
              <button
                key={ind.id}
                onClick={() => handleIndustryChange(ind.id)}
                className={`p-1.5 rounded text-center text-[11px] border transition-colors ${
                  currentIndustry === ind.id
                    ? "bg-ksp-accent text-black border-ksp-accent"
                    : "bg-ksp-bg border-ksp-border hover:border-ksp-accent/50"
                }`}
                title={ind.hintVi}
              >
                <div className="text-base leading-tight">{ind.emoji}</div>
                <div className="leading-tight mt-0.5">{ind.name}</div>
              </button>
            ))}
          </div>
          {industryConfig && (
            <p className="text-[10px] text-ksp-muted mt-1.5 italic">
              {industryConfig.hintVi}
            </p>
          )}
        </div>
      )}
    </Section>
  );
}
