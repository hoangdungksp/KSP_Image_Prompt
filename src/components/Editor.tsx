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
import { migrateProjectToV09 } from "../store/migration_v09";
import type { ProjectModeV2 } from "../types/v0_9_0";

// v0.9.0 components (built in Phase 1-4)
import { ProjectSettingSectionV09 } from "./ProjectSettingSectionV09";
import { CastSectionV09 } from "./CastSectionV09";
import { FilmScriptSection } from "./FilmScriptSection";
import { ScenesShotsManagerV09 } from "./ScenesShotsManagerV09";
import { ShotDetailPanel } from "./ShotDetailPanel";
import { VoiceSectionV09 } from "./VoiceSectionV09";
import { MusicSfxSectionV09 } from "./MusicSfxSectionV09";
import { BundleExportV09 } from "./BundleExportV09";

// v0.9.1 Photos mode components
import { CastPhotosSection } from "./CastPhotosSection";
import { CameraStyleToggleV09 } from "./CameraStyleToggleV09";
import { PhotosIdeaSection } from "./PhotosIdeaSection";
import { PhotosImageGenSection } from "./PhotosImageGenSection";

// v0.8.x reused (Idea section legacy)
import { IdeaCardV09 } from "./IdeaCardV09";

// Global store for focused entities (Shot Detail navigation)
import { useGlobalStore } from "../store/useGlobalStore";

// Inject v0.9.0 styles
import "./v0_9_0.css";
import "./v0_9_0_phase2.css";
import "./v0_9_0_phase34.css";
import "./v0_9_1_photos.css";
// v0_9_2_product.css removed v0.9.3-r1 (TVC archived)

export function Editor() {
  const { currentProject, setCurrentProject, showToast } = useAppStore();
  const focusedShotId = useGlobalStore((s) => s.focusedShotId);
  const setFocusedShot = useGlobalStore((s) => s.setFocusedShot);

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

  // If a shot is focused, show its detail panel (replaces sidebar content)
  if (focusedShotId) {
    return (
      <div className="ksp-sidebar-v09">
        <div style={{ padding: "8px 12px", borderBottom: "0.5px solid #1f1f22" }}>
          <button
            className="ksp-btn ksp-btn-sm ksp-btn-ghost"
            onClick={() => setFocusedShot(null)}
            style={{ width: "100%" }}
          >
            ← Back to Pipeline
          </button>
        </div>
        <ShotDetailPanel />
      </div>
    );
  }

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
      <ProjectSettingSectionV09 />
      <Connector colorFrom="#6da9d6" colorTo="#c490c4" />

      {/* Section 2: ASSETS — mode-adaptive
          Photos + TVC dùng chung CastPhotosSection (5 Subject Types + 1-6 face refs + outfit)
          Film giữ CastSectionV09 (multi-character cards cho narrative cinema) */}
      {mode === "photos" || mode === "tvc_commercial" ? (
        <CastPhotosSection />
      ) : (
        <CastSectionV09 />
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
      <PipelineStep stepNum={1} icon="💡" label="Ý TƯỞNG" color="green">
        <IdeaCardV09 />
      </PipelineStep>
      <Connector colorFrom="#5dcaa5" colorTo="#f0a677" />

      <FilmScriptSection />
      <Connector colorFrom="#f0a677" colorTo="#afa9ec" />

      <ScenesShotsManagerV09 />
      <Connector colorFrom="#afa9ec" colorTo="#85b7eb" />

      <PipelineStep stepNum={4} icon="🖼" label="IMAGE GEN" color="purple-light">
        <p style={{ fontSize: 11, color: "#888", padding: "8px 12px", margin: 0 }}>
          Click vào shot trong Storyboard ở trên → Shot Detail mở ra với Image Gen block (upload grid + auto-crop + replace single frame).
        </p>
      </PipelineStep>
      <Connector colorFrom="#afa9ec" colorTo="#afa9ec" />

      <PipelineStep stepNum={5} icon="🎞" label="VIDEO AI" color="purple-light">
        <p style={{ fontSize: 11, color: "#888", padding: "8px 12px", margin: 0 }}>
          Click shot → Shot Detail có Video AI block với chunks + animation prompts cho Seedance/Veo3/Kling.
        </p>
      </PipelineStep>
      <Connector colorFrom="#afa9ec" colorTo="#85b7eb" />

      <VoiceSectionV09 />
      <Connector colorFrom="#85b7eb" colorTo="#c490c4" />

      <MusicSfxSectionV09 />
      <Connector colorFrom="#c490c4" colorTo="#5dcaa5" />

      <BundleExportV09 />
    </>
  );
}

// TvcPipeline + ProductPipeline removed v0.9.3-r1 — see ArchivedModePlaceholder above.

function PhotosPipeline() {
  return (
    <>
      <CameraStyleToggleV09 />
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

function Connector({ colorFrom, colorTo }: { colorFrom: string; colorTo: string }) {
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
