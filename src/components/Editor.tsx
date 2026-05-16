/**
 * KSP Image v0.9.0 — Sidebar Editor (NEW)
 *
 * Renders v0.9.0 components vertically (1 column ~380px wide).
 * Replaces v0.8.x Editor.tsx (backed up to Editor.tsx.v0.8.x.backup).
 *
 * Layout matches mockups exactly:
 * - Section 1: PROJECT (Project Setting)
 * - Section 2: ASSETS (Cast)
 * - Section 3: PIPELINE (Idea → Concept/Script → Storyboard → Voice → Music → Bundle)
 *   with connector lines between steps
 *
 * Mode-adaptive: pipeline blocks differ per mode (Photos vs TVC vs Film).
 */

import React from "react";
import { useAppStore, createEmptyProject, createEmptyShot } from "../store/useAppStore";
import { saveProject } from "../store/db";
import { migrateProjectToV09 } from "../store/migration";
import type { ProjectModeV2 } from "../types/project";

// v0.9.0 components (built in Phase 1-4)
import { ProjectSettingSection } from "./ProjectSettingSection";
import { CastFilmSection } from "./CastFilmSection";
import { FilmIdeaScriptSection } from "./FilmIdeaScriptSection";
import { FilmShotListSection } from "./FilmShotListSection";
import { FilmStoryboardSection } from "./FilmStoryboardSection";
// ShotDetailPanel deleted r5 (atomic Q6) — replaced by FilmShotDetailPanel inline expand drawer
// rendered inside FilmStoryboardSection when a shot row is clicked.
// r6: VoiceSectionV09 / MusicSfxSectionV09 / BundleExportV09 all deleted (atomic Q6),
// replaced by FilmVoiceSection / FilmMusicSfxSection / FilmBundleExportSection.
import { FilmVoiceSection } from "./FilmVoiceSection";
import { FilmMusicSfxSection } from "./FilmMusicSfxSection";
import { FilmBundleExportSection } from "./FilmBundleExportSection";

// v0.9.1 Photos mode components
import { CastPhotosSection } from "./CastPhotosSection";
import { CameraStyleToggle } from "./CameraStyleToggle";
import { PhotosIdeaSection } from "./PhotosIdeaSection";
import { PhotosImageGenSection } from "./PhotosImageGenSection";

// v0.8.x reused (Idea section legacy)
import { IdeaCard } from "./IdeaCard";  // legacy — kept for non-Film modes if any

// Inject v0.9.0 styles
import "./base.css";
import "./components.css";
import "./pipeline.css";
import "./photos.css";
import "./film.css";
// v0_9_2_product.css removed v0.9.3-r1 (TVC archived)

export function Editor() {
  const { currentProject, setCurrentProject, showToast } = useAppStore();

  const handleNewProject = async () => {
    const empty = createEmptyProject();
    empty.shots = [createEmptyShot(1)];
    await saveProject(empty);
    setCurrentProject(empty);
    showToast("Đã tạo project mới", "success");
  };

  if (!currentProject) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "#888", marginBottom: 12 }}>Chưa có project nào.</p>
          <button
            onClick={handleNewProject}
            className="px-4 py-2 bg-ksp-accent text-black font-semibold rounded"
          >
            + Tạo project mới
          </button>
        </div>
      </div>
    );
  }

  const migrated = migrateProjectToV09(currentProject);
  const mode = (migrated.settingV2?.mode ?? "photos") as ProjectModeV2;

  // r5: Shot detail is now an INLINE EXPAND DRAWER inside FilmStoryboardSection
  // (no longer a modal-style route that replaces the sidebar). The focusedShotId
  // pattern from v0.9.0 is gone; per-shot state lives in filmV093.expandedShotId.

  // Connector colors mode-aware: Cast (purple) → next pipeline section
  // Photos: → CAMERA STYLE (cyan #5ecac8)
  // TVC: → PRODUCT (warm orange #e8a55e)
  // Film: → IDEA (green #5dcaa5)
  // Product mode (stub): gray
  const castToNextColor =
    mode === "photos"
      ? "#5ecac8"
      : mode === "tvc_commercial"
      ? "#e8a55e"
      : mode === "product_photo"
      ? "#888"
      : "#5dcaa5";

  return (
    <div
      className="ksp-sidebar-v09"
      onClick={(e) => {
        // Click on a section header → toggle collapse on the parent .ksp-section
        const target = e.target as HTMLElement;
        const header = target.closest(".ksp-section-header");
        if (!header) return;
        // Don't toggle if clicked on an interactive element inside header
        if (target.closest("button, input, select, a")) return;
        const section = header.closest(".ksp-section");
        if (!section) return;
        section.classList.toggle("ksp-section-collapsed");
      }}
    >
      {/* Section 1: PROJECT */}
      <ProjectSettingSection />
      <Connector colorFrom="#6da9d6" colorTo="#c490c4" />

      {/* Section 2: ASSETS — mode-adaptive
          Photos + TVC dùng chung CastPhotosSection (5 Subject Types + 1-6 face refs + outfit)
          Film dùng CastFilmSection v0.9.3 (multi-character cards, 4 roles, face/body refs, AI Generate stub) */}
      {mode === "photos" || mode === "tvc_commercial" ? (
        <CastPhotosSection />
      ) : (
        <CastFilmSection />
      )}
      <Connector colorFrom="#c490c4" colorTo={castToNextColor} />

      {/* Section 3: PIPELINE — adaptive per mode */}
      {mode === "photos" && <PhotosPipeline />}
      {mode === "film" && <FilmPipeline />}
      {(mode === "tvc_commercial" || mode === "product_photo") && <ArchivedModePlaceholder mode={mode} />}
    </div>
  );
}

// ============================================================================
// PIPELINE LAYOUTS (per mode)
// ============================================================================

function ArchivedModePlaceholder({ mode }: { mode: string }) {
  const label = mode === "tvc_commercial" ? "TVC Commercial" : "Product Photo";
  return (
    <div style={{ padding: "12px 16px" }}>
      <div className="ksp-coming-soon" style={{ background: "#f4f1ec", border: "1px dashed #b8b0a3", borderRadius: 8, padding: 16 }}>
        <h3 style={{ margin: 0, fontSize: 14, color: "#5f5e5a" }}>📦 {label} Mode — tạm gác lại</h3>
        <p style={{ fontSize: 12, color: "#888", margin: "8px 0 0", lineHeight: 1.6 }}>
          Mode này hiện không phát triển trong Sprint 0.9.3 (đang focus Film/Short Film).
          Vui lòng chuyển Mode = <b>Photos</b> hoặc <b>Film / Short Film</b> ở Project Setting.
        </p>
      </div>
    </div>
  );
}

function FilmPipeline() {
  return (
    <>
      <FilmIdeaScriptSection />
      <Connector colorFrom="#f0a677" colorTo="#D4537E" />

      <FilmShotListSection />
      <Connector colorFrom="#D4537E" colorTo="#afa9ec" />

      <FilmStoryboardSection />
      <Connector colorFrom="#afa9ec" colorTo="#85b7eb" />

      {/* r5: Steps 4 (IMAGE GEN) + 5 (VIDEO AI) are now per-shot — accessed by
          clicking a shot row in Storyboard to expand FilmShotDetailPanel inline.
          No standalone sections here anymore. */}
      <FilmVoiceSection />
      <Connector colorFrom="#85b7eb" colorTo="#c490c4" />

      <FilmMusicSfxSection />
      <Connector colorFrom="#c490c4" colorTo="#5dcaa5" />

      <FilmBundleExportSection />
    </>
  );
}

// TvcPipeline + ProductPipeline removed v0.9.3-r1 — see ArchivedModePlaceholder above.

function PhotosPipeline() {
  return (
    <>
      <CameraStyleToggle />
      <Connector colorFrom="#5ecac8" colorTo="#e8c874" />

      <PhotosIdeaSection />
      <Connector colorFrom="#e8c874" colorTo="#f09090" />

      <PhotosImageGenSection />
    </>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 9,
        color: "#666",
        letterSpacing: "0.12em",
        marginTop: 16,
        marginBottom: 8,
        paddingLeft: 4,
        textAlign: "center",
      }}
    >
      {children}
    </div>
  );
}

function PipelineStep({
  stepNum,
  icon,
  label,
  color,
  children,
}: {
  stepNum: number;
  icon: string;
  label: string;
  color: string;
  children: React.ReactNode;
}) {
  const colorMap: Record<string, string> = {
    green: "rgba(94, 202, 165, 0.3)",
    orange: "rgba(240, 166, 119, 0.3)",
    "purple-light": "rgba(175, 169, 236, 0.3)",
    "purple-dark": "rgba(196, 144, 196, 0.3)",
    blue: "rgba(133, 183, 235, 0.3)",
  };
  const accentColor: Record<string, string> = {
    green: "#5dcaa5",
    orange: "#f0a677",
    "purple-light": "#afa9ec",
    "purple-dark": "#c490c4",
    blue: "#85b7eb",
  };
  return (
    <div
      style={{
        border: `0.5px solid ${colorMap[color] ?? "#2a2a2c"}`,
        borderRadius: 8,
        background: "rgba(255, 255, 255, 0.015)",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          borderBottom: `0.5px solid ${colorMap[color] ?? "#2a2a2c"}`,
        }}
      >
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span
          style={{
            fontSize: 11,
            letterSpacing: "0.08em",
            fontWeight: 500,
            color: accentColor[color] ?? "#ccc",
          }}
        >
          {stepNum}. {label}
        </span>
      </header>
      {children}
    </div>
  );
}

export function Connector({ colorFrom, colorTo }: { colorFrom: string; colorTo: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "4px 0",
      }}
    >
      <div
        style={{
          width: 7,
          height: 7,
          border: `1px solid ${colorFrom}`,
          borderRadius: "50%",
          background: "#0e0e10",
        }}
      />
      <div
        style={{
          width: "0.5px",
          height: 10,
          background: `linear-gradient(to bottom, ${colorFrom}, ${colorTo})`,
        }}
      />
      <div
        style={{
          width: 7,
          height: 7,
          border: `1px solid ${colorTo}`,
          borderRadius: "50%",
          background: "#0e0e10",
        }}
      />
    </div>
  );
}
