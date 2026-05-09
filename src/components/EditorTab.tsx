/**
 * KSP Image v0.9.0 — Full Editor Tab (1400px+)
 *
 * Hybrid layout:
 * - Left rail (260px): Project list + nav
 * - Main column (flex): Pipeline blocks vertical with connector lines
 * - Right rail (380px): Context panel (focused shot/scene/character)
 *
 * Adaptive per Mode:
 * - photos: Theme picker + Camera Style + Shots (no pipeline)
 * - tvc_commercial: Idea → Concept → Storyboard → Image → Video → Voice → Music
 * - product_photo: Lighting setup + Storyboard light
 * - film: Idea → Script → Storyboard (Scenes/Shots) → Image → Video → Voice → Music + Bundle
 *
 * Opens in new browser tab via window.open() from Sidebar.
 */

import React from "react";
import { useAppStore } from "../store/useAppStore";
import { useGlobalStore } from "../store/useGlobalStore";
import { migrateProjectToV09 } from "../store/migration_v09";
import { ProjectSettingSectionV09 } from "./ProjectSettingSectionV09";
import { CastSectionV09 } from "./CastSectionV09";
import { FilmScriptSection } from "./FilmScriptSection";
import { TvcConceptSection } from "./TvcConceptSection";
import { ScenesShotsManagerV09 } from "./ScenesShotsManagerV09";
import { ShotDetailPanel } from "./ShotDetailPanel";
import { VoiceSectionV09 } from "./VoiceSectionV09";
import { MusicSfxSectionV09 } from "./MusicSfxSectionV09";
import { BundleExportV09 } from "./BundleExportV09";
import type { ProjectModeV2 } from "../types/v0_9_0";

export function EditorTab() {
  const project = useAppStore((s) => s.currentProject);
  const focusedStep = useGlobalStore((s) => s.focusedStep);
  const setFocusedStep = useGlobalStore((s) => s.setFocusedStep);

  if (!project) {
    return (
      <div className="ksp-editor-empty">
        <h2>No project loaded</h2>
        <p>Pick a project from sidebar to start editing.</p>
      </div>
    );
  }

  const migrated = migrateProjectToV09(project);
  const mode = (migrated.settingV2?.mode ?? "photos") as ProjectModeV2;

  return (
    <div className="ksp-editor-tab">
      <LeftRail mode={mode} focusedStep={focusedStep} onFocusStep={setFocusedStep} />

      <main className="ksp-editor-main">
        {/* Prominent v0.9.0 banner */}
        <div style={{
          padding: "12px 16px",
          marginBottom: 16,
          background: "linear-gradient(90deg, rgba(240, 166, 119, 0.15), rgba(175, 169, 236, 0.15))",
          border: "1px solid rgba(240, 166, 119, 0.4)",
          borderRadius: 8,
          fontSize: 13,
          color: "#f0a677",
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <span style={{ fontSize: 18 }}>🎬</span>
          <div style={{ flex: 1 }}>
            <div>KSP Image v0.9.0 — Multi-mode AI Cinema Editor</div>
            <div style={{ fontSize: 11, color: "#aaa", fontWeight: 400, marginTop: 2 }}>
              Pick mode below → Cast → Idea → Script (Film) or Concept (TVC) → Storyboard → Image → Video → Voice → Music → Bundle
            </div>
          </div>
        </div>

        {/* Always visible at top: Project Setting */}
        <ProjectSettingSectionV09 />

        {/* Mode-adaptive content */}
        {mode === "photos" && <PhotosModeView />}
        {mode === "tvc_commercial" && <TvcModeView />}
        {mode === "product_photo" && <ProductModeView />}
        {mode === "film" && <FilmModeView />}
      </main>

      <RightRail mode={mode} />
    </div>
  );
}

// ============================================================================
// LEFT RAIL — Pipeline navigator
// ============================================================================

interface PipelineStep {
  id: string;
  label: string;
  icon: string;
  status?: "done" | "in_progress" | "pending";
}

function LeftRail({
  mode,
  focusedStep,
  onFocusStep,
}: {
  mode: ProjectModeV2;
  focusedStep: string;
  onFocusStep: (s: any) => void;
}) {
  const steps = getStepsForMode(mode);

  return (
    <aside className="ksp-editor-left-rail">
      <div className="ksp-rail-header">
        <h3>Pipeline</h3>
        <span className="ksp-rail-mode-badge">{getModeBadge(mode)}</span>
      </div>

      <nav className="ksp-pipeline-nav">
        {steps.map((step, idx) => (
          <React.Fragment key={step.id}>
            <button
              className={`ksp-pipeline-step ${focusedStep === step.id ? "ksp-pipeline-step-active" : ""}`}
              data-step={step.id}
              onClick={() => onFocusStep(step.id)}
            >
              <span className="ksp-pipeline-step-icon">{step.icon}</span>
              <span className="ksp-pipeline-step-label">{step.label}</span>
              {step.status && <StatusDot status={step.status} />}
            </button>
            {idx < steps.length - 1 && <PipelineConnector />}
          </React.Fragment>
        ))}
      </nav>
    </aside>
  );
}

function PipelineConnector() {
  // Q4 confirmed: dot + line + dot, line dài 22px
  return (
    <div className="ksp-pipeline-connector">
      <span className="ksp-connector-dot" />
      <span className="ksp-connector-line" />
      <span className="ksp-connector-dot" />
    </div>
  );
}

function StatusDot({ status }: { status: "done" | "in_progress" | "pending" }) {
  const symbol = status === "done" ? "✓" : status === "in_progress" ? "⚙" : "○";
  return <span className={`ksp-status-dot ksp-status-${status}`}>{symbol}</span>;
}

function getModeBadge(mode: ProjectModeV2): string {
  switch (mode) {
    case "photos": return "📷 Photos";
    case "tvc_commercial": return "🎬 TVC";
    case "product_photo": return "📦 Product";
    case "film": return "🎞 Film";
  }
}

function getStepsForMode(mode: ProjectModeV2): PipelineStep[] {
  if (mode === "photos") {
    // Photos has no pipeline — flat blocks
    return [
      { id: "project", label: "Project", icon: "📁" },
      { id: "cast", label: "Subject", icon: "👤" },
      { id: "storyboard", label: "Style + Theme", icon: "🎨" },
      { id: "image_gen", label: "Shots", icon: "📸" },
    ];
  }

  if (mode === "film") {
    return [
      { id: "project", label: "Project", icon: "📁" },
      { id: "cast", label: "Cast", icon: "🎭" },
      { id: "idea", label: "1. Idea", icon: "💡" },
      { id: "script", label: "2. Script", icon: "📝" },
      { id: "storyboard", label: "3. Storyboard", icon: "🎬" },
      { id: "image_gen", label: "4. Image Gen", icon: "🖼" },
      { id: "video_ai", label: "5. Video AI", icon: "🎞" },
      { id: "voice", label: "6. Voice", icon: "🎙" },
      { id: "music", label: "7. Music + SFX", icon: "🎵" },
      { id: "bundle", label: "Bundle Export", icon: "📦" },
    ];
  }

  if (mode === "tvc_commercial") {
    return [
      { id: "project", label: "Project", icon: "📁" },
      { id: "cast", label: "Characters", icon: "👤" },
      { id: "idea", label: "1. Idea", icon: "💡" },
      { id: "concept", label: "2. Concept", icon: "📋" },
      { id: "storyboard", label: "3. Storyboard", icon: "🎬" },
      { id: "image_gen", label: "4. Image Gen", icon: "🖼" },
      { id: "video_ai", label: "5. Video AI", icon: "🎞" },
      { id: "voice", label: "6. Voice (VO)", icon: "🎙" },
      { id: "music", label: "7. Music", icon: "🎵" },
      { id: "bundle", label: "Bundle Export", icon: "📦" },
    ];
  }

  // product_photo
  return [
    { id: "project", label: "Project", icon: "📁" },
    { id: "cast", label: "Product", icon: "📦" },
    { id: "storyboard", label: "Lighting + Shots", icon: "💡" },
    { id: "image_gen", label: "Image Gen", icon: "🖼" },
  ];
}

// ============================================================================
// MAIN VIEWS — STUB for now, expanded in Phase 2
// ============================================================================

function PhotosModeView() {
  return (
    <section className="ksp-mode-view ksp-mode-photos">
      <CastSectionV09 />
      <div className="ksp-coming-soon">
        <h3>📷 Photos Mode</h3>
        <p>Theme Picker (100+ themes) + Camera Style + Multi-shot list</p>
        <p className="ksp-stub-note">Theme Picker UI coming in Phase 3</p>
      </div>
    </section>
  );
}

function TvcModeView() {
  return (
    <section className="ksp-mode-view ksp-mode-tvc">
      <CastSectionV09 />
      <IdeaCardV09 stepNum={1} />
      <TvcConceptSection />
      <VoiceSectionV09 />
      <MusicSfxSectionV09 />
      <BundleExportV09 />
      <div className="ksp-coming-soon">
        <h3>3-5. Storyboard / Image / Video (TVC)</h3>
        <p>TVC storyboard pipeline tương tự Film mode. Để dùng full pipeline, anh có thể tạo project với mode = Film tạm thời.</p>
        <p className="ksp-stub-note">v0.9.1 sẽ wire tiếp v0.8.x StoryboardSection để TVC dùng được luôn</p>
      </div>
    </section>
  );
}

function FilmModeView() {
  return (
    <section className="ksp-mode-view ksp-mode-film">
      <CastSectionV09 />
      <IdeaCardV09 stepNum={1} />
      <FilmScriptSection />
      <ScenesShotsManagerV09 />
      <VoiceSectionV09 />
      <MusicSfxSectionV09 />
      <BundleExportV09 />
    </section>
  );
}

function ProductModeView() {
  return (
    <section className="ksp-mode-view ksp-mode-product">
      <CastSectionV09 />
      <div className="ksp-coming-soon">
        <h3>📦 Product Photo Mode</h3>
        <p>Lighting Setup + Storyboard nhẹ</p>
        <p className="ksp-stub-note">Mode Product chưa được prioritize trong v0.9.0 — defer v0.9.1</p>
      </div>
    </section>
  );
}

/**
 * Idea card v0.9.0 — wraps existing project.idea field as Pipeline Step 1.
 * Reads/writes to project.idea (legacy field from v0.8.x for backward compat).
 */
function IdeaCardV09({ stepNum }: { stepNum: number }) {
  const project = useAppStore((s) => s.currentProject);
  const updateProject = useAppStore((s) => s.updateCurrentProject);
  if (!project) return null;
  const idea = (project as any).idea ?? "";

  return (
    <section className="ksp-section ksp-idea-section">
      <header className="ksp-section-header">
        <span className="ksp-section-icon">💡</span>
        <h2 className="ksp-section-title">{stepNum}. Ý TƯỞNG</h2>
        <span className="ksp-script-meta">{idea.length} chars</span>
      </header>
      <div style={{ padding: 12 }}>
        <textarea
          className="ksp-input ksp-textarea"
          rows={4}
          value={idea}
          onChange={(e) => updateProject({ idea: e.target.value } as any)}
          placeholder="Mô tả ý tưởng tự do (tiếng Việt). AI sẽ dịch sang English khi build prompts cho Banana Pro / Seedance."
        />
        <div className="ksp-info-banner" style={{ marginTop: 8 }}>
          ℹ️ Idea = raw input cho AI Script/Concept writer. Đầy đủ context giúp AI sinh kịch bản tốt hơn.
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// RIGHT RAIL — Context panel (focused shot/scene/character)
// ============================================================================

function RightRail({ mode }: { mode: ProjectModeV2 }) {
  const focusedShotId = useGlobalStore((s) => s.focusedShotId);

  return (
    <aside className="ksp-editor-right-rail">
      {focusedShotId ? (
        <ShotDetailPanel />
      ) : (
        <div className="ksp-rail-empty">
          <p>Click a shot in the Storyboard list to open detail editing here.</p>
          <p className="ksp-rail-empty-hint">
            {mode === "film"
              ? "Detail panel: frames text, image prompt, animation chunks, replace single frame."
              : "Mode-specific detail coming."}
          </p>
        </div>
      )}
    </aside>
  );
}
