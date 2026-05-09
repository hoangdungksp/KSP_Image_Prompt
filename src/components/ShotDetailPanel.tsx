/**
 * KSP Image v0.9.0 — Shot Detail Panel (Mockup 4)
 *
 * Renders in right rail when a shot is focused.
 * Contains:
 * - Header with back button + title + grid info
 * - 9 frames preview (Mockup 4 grid)
 * - Image Prompt section (collapsed by default but generated)
 * - Animation Prompt section (Mockup 7) with chunks + ref thumbnails
 * - Frames text VN/EN (Mockup 8) — auto-derived from script
 *
 * Workflow:
 * 1. Click shot in Storyboard list → opens here
 * 2. Click "AI derive frames" → AI generates 9 frame texts from Script action lines
 * 3. Click "Generate Image Prompt" → builds Banana Pro storyboard prompt
 * 4. Copy prompt → external Banana Pro → upload grid back via Image Gen block
 * 5. Auto-crop → 9 cells appear in grid preview
 * 6. Click frame F4 → Replace single frame UI (Mockup A)
 * 7. Generate Animation Prompts → chunks ready for Seedance
 */

import React, { useState, useMemo } from "react";
import { useAppStore } from "../store/useAppStore";
import { useGlobalStore } from "../store/useGlobalStore";
import { migrateProjectToV09 } from "../store/migration_v09";
import * as actions from "../store/v09_actions";
import { generateFramesForShot, regenerateSingleFrame } from "../engine/aiRuntime";
import { buildShotImagePrompt } from "../engine/ai_prompts/musicVoiceImage";
import {
  buildAllChunkPrompts,
  VIDEO_PROVIDERS,
  type VideoProvider,
} from "../engine/chunkPlannerV09";
import { formatTimeRange, type TimeFormat } from "../types/v0_9_0";
import type {
  FilmShot,
  ShotFrame,
  FilmCharacterV2,
  AnimationChunk,
} from "../types/v0_9_0";

export function ShotDetailPanel() {
  const project = useAppStore((s) => s.currentProject);
  const updateProject = useAppStore((s) => s.updateCurrentProject);
  const showToast = useAppStore((s) => s.showToast);
  const focusedShotId = useGlobalStore((s) => s.focusedShotId);
  const setFocusedShot = useGlobalStore((s) => s.setFocusedShot);

  if (!project || !focusedShotId) {
    return (
      <div className="ksp-rail-empty">
        <p>Click a shot in the Storyboard list to open detail editing here.</p>
      </div>
    );
  }

  const migrated = migrateProjectToV09(project);
  const cast = migrated.filmCharactersV2 ?? [];
  const setting = migrated.settingV2!;
  const script = migrated.script;
  const filmStructure = migrated.filmStructureV2;

  // Find the shot + parent scene
  let shot: FilmShot | undefined;
  let parentSceneShotId: string | undefined;
  for (const scene of filmStructure?.scenes ?? []) {
    const s = scene.shots.find((sh) => sh.id === focusedShotId);
    if (s) {
      shot = s;
      parentSceneShotId = scene.id;
      break;
    }
  }

  if (!shot || !parentSceneShotId) {
    return (
      <div className="ksp-rail-empty">
        <p>Shot not found. Pick another from Storyboard.</p>
      </div>
    );
  }

  const parentScript = script?.scenes.find((s) => s.id === parentSceneShotId);

  function patch(updates: Partial<typeof migrated>) {
    updateProject(updates as any);
  }

  const numFrames = shot.gridFormat.split("x").map(Number).reduce((a, b) => a * b, 1);
  const hasFrames = (shot.frames?.length ?? 0) === numFrames;

  return (
    <div className="ksp-shot-detail">
      <ShotDetailHeader
        shot={shot}
        onBack={() => setFocusedShot(null)}
      />

      {/* Frames preview grid */}
      <FramesPreviewGrid shot={shot} timeFormat={setting.timeFormat} />

      {/* AI Derive frames (shown when no frames yet) */}
      {!hasFrames && parentScript && (
        <DeriveFramesPanel
          shot={shot}
          parentScript={parentScript}
          cast={cast}
          aiProvider={setting.aiProviders.storyboardFrames}
          onDerived={(frames) => {
            patch(actions.setShotFrames(migrated, shot!.id, frames));
            patch(actions.updateShot(migrated, shot!.id, { status: "frames_ready" }));
          }}
        />
      )}

      {/* Frames text editor */}
      {hasFrames && (
        <FramesTextSection
          shot={shot}
          timeFormat={setting.timeFormat}
          onUpdateFrame={(frameId, p) =>
            patch(actions.updateFrame(migrated, shot!.id, frameId, p))
          }
        />
      )}

      {/* Image Prompt section */}
      {hasFrames && (
        <ImagePromptSection
          shot={shot}
          cast={cast}
          animationStyle={setting.animationStyle ?? "live_action"}
          aspectRatio={setting.aspectRatio}
          onGenerated={(prompt) =>
            patch(
              actions.updateShot(migrated, shot!.id, {
                imagePrompt: prompt,
                status: "prompt_ready",
              })
            )
          }
          showToast={showToast}
        />
      )}

      {/* Image Gen block (Mockup A) */}
      {hasFrames && (
        <ImageGenBlock
          shot={shot}
          cast={cast}
          aspectRatio={setting.aspectRatio}
          onUpload={(gridId) =>
            patch(
              actions.updateShot(migrated, shot!.id, {
                gridImageId: gridId,
              })
            )
          }
          onAutoCrop={(croppedIds) =>
            patch(
              actions.updateShot(migrated, shot!.id, {
                croppedFrameIds: croppedIds,
                status: "rendered",
              })
            )
          }
          onReplaceFrame={(frameIdx, newRefId) => {
            const next = [...(shot!.croppedFrameIds ?? [])];
            next[frameIdx] = newRefId;
            patch(actions.updateShot(migrated, shot!.id, { croppedFrameIds: next }));
          }}
          showToast={showToast}
        />
      )}

      {/* Video AI block (Mockup 7) */}
      {hasFrames && (
        <VideoAiBlock
          shot={shot}
          cast={cast}
          animationStyle={setting.animationStyle ?? "live_action"}
          aspectRatio={setting.aspectRatio}
          timeFormat={setting.timeFormat}
          onChunksGenerated={(chunks) =>
            patch(
              actions.updateShot(migrated, shot!.id, {
                animationPrompts: chunks,
                status: "animated",
              })
            )
          }
          showToast={showToast}
        />
      )}
    </div>
  );
}

// ============================================================================
// HEADER
// ============================================================================

function ShotDetailHeader({ shot, onBack }: { shot: FilmShot; onBack: () => void }) {
  const numFrames = shot.gridFormat.split("x").map(Number).reduce((a, b) => a * b, 1);
  return (
    <div className="ksp-shot-detail-header">
      <button className="ksp-btn ksp-btn-sm ksp-btn-ghost" onClick={onBack}>
        ← Back
      </button>
      <div className="ksp-shot-detail-title-block">
        <div className="ksp-shot-detail-title">{shot.titleEn}</div>
        <div className="ksp-shot-detail-meta">
          {shot.gridFormat} · {numFrames} frames · {shot.durationSeconds}s ·{" "}
          {shot.cameraMovement.replace(/_/g, " ")}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// FRAMES PREVIEW GRID
// ============================================================================

function FramesPreviewGrid({ shot, timeFormat }: { shot: FilmShot; timeFormat: TimeFormat }) {
  const [rows, cols] = shot.gridFormat.split("x").map(Number);
  const numFrames = rows * cols;
  const frames = shot.frames ?? [];
  const cropped = shot.croppedFrameIds ?? [];

  return (
    <div className="ksp-frames-preview">
      <div className="ksp-frames-preview-header">
        <span>Frames preview ({numFrames}):</span>
        <span className="ksp-frames-status">
          {cropped.length > 0
            ? `✓ ${cropped.length}/${numFrames} rendered`
            : frames.length > 0
            ? `📝 ${frames.length} frames text only`
            : "○ no frames yet"}
        </span>
      </div>
      <div
        className="ksp-frames-grid"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {Array.from({ length: numFrames }).map((_, i) => {
          const frame = frames[i];
          const hasCropped = i < cropped.length;
          return (
            <div
              key={i}
              className={`ksp-frame-cell ${hasCropped ? "ksp-frame-rendered" : ""}`}
              title={frame?.actionEn ?? `Frame ${i + 1}`}
            >
              <span className="ksp-frame-num">F{i + 1}</span>
              {frame?.timingSeconds && (
                <span className="ksp-frame-timing">
                  {formatTimeRange(
                    frame.timingSeconds.start,
                    frame.timingSeconds.end,
                    timeFormat
                  )}
                </span>
              )}
              {frame?.locked && <span className="ksp-frame-lock">🔒</span>}
              {hasCropped && <span className="ksp-frame-check">✓</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// AI DERIVE FRAMES PANEL
// ============================================================================

function DeriveFramesPanel({
  shot,
  parentScript,
  cast,
  aiProvider,
  onDerived,
}: {
  shot: FilmShot;
  parentScript: any;
  cast: FilmCharacterV2[];
  aiProvider: any;
  onDerived: (frames: ShotFrame[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const showToast = useAppStore((s) => s.showToast);

  async function handleDerive() {
    setBusy(true);
    try {
      const frames = await generateFramesForShot(
        shot,
        parentScript.actionLinesEn ?? "",
        cast,
        aiProvider
      );
      onDerived(frames);
      showToast(`✓ Derived ${frames.length} frames`, "success");
    } catch (err: any) {
      showToast(`Lỗi: ${err.message}`, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ksp-shot-block">
      <div className="ksp-shot-block-header">
        <h4>Frames text</h4>
        <span className="ksp-block-badge">step 1</span>
      </div>
      <p className="ksp-shot-block-desc">
        Tự động sinh frames text từ Script action lines của scene "{parentScript.titleEn}".
      </p>
      <button className="ksp-btn ksp-btn-orange" onClick={handleDerive} disabled={busy}>
        {busy ? "⚙ Deriving..." : "✨ AI derive frames từ Script"}
      </button>
    </div>
  );
}

// ============================================================================
// FRAMES TEXT SECTION (Mockup 8)
// ============================================================================

function FramesTextSection({
  shot,
  timeFormat,
  onUpdateFrame,
}: {
  shot: FilmShot;
  timeFormat: TimeFormat;
  onUpdateFrame: (frameId: string, patch: Partial<ShotFrame>) => void;
}) {
  const [expandedFrameId, setExpandedFrameId] = useState<string | null>(null);

  return (
    <details className="ksp-shot-block ksp-collapsible-inline" open>
      <summary>📝 Frames text VN/EN ({shot.frames?.length ?? 0})</summary>
      <div className="ksp-collapsible-inline-content ksp-frames-list">
        <div className="ksp-info-banner">
          ✨ Auto-derived from Script. Click frame to edit.
        </div>
        {(shot.frames ?? []).map((f) => (
          <FrameEditRow
            key={f.id}
            frame={f}
            timeFormat={timeFormat}
            expanded={expandedFrameId === f.id}
            onToggle={() => setExpandedFrameId(expandedFrameId === f.id ? null : f.id)}
            onUpdate={(p) => onUpdateFrame(f.id, p)}
          />
        ))}
      </div>
    </details>
  );
}

function FrameEditRow({
  frame,
  timeFormat,
  expanded,
  onToggle,
  onUpdate,
}: {
  frame: ShotFrame;
  timeFormat: TimeFormat;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<ShotFrame>) => void;
}) {
  return (
    <div className="ksp-frame-edit">
      <div className="ksp-frame-edit-header" onClick={onToggle}>
        <span className="ksp-frame-edit-num">F{frame.order + 1}</span>
        <span className="ksp-frame-edit-timing">
          {formatTimeRange(frame.timingSeconds.start, frame.timingSeconds.end, timeFormat)}
        </span>
        <span className="ksp-frame-edit-role">{frame.role}</span>
        <button
          className="ksp-btn ksp-btn-xs ksp-btn-ghost"
          onClick={(e) => {
            e.stopPropagation();
            onUpdate({ locked: !frame.locked });
          }}
        >
          {frame.locked ? "🔒" : "🔓"}
        </button>
        <span style={{ fontSize: 9, color: "#555" }}>{expanded ? "▼" : "▶"}</span>
      </div>
      {expanded && (
        <div className="ksp-frame-edit-body">
          <textarea
            className="ksp-input ksp-textarea"
            rows={2}
            value={frame.actionEn ?? ""}
            onChange={(e) => onUpdate({ actionEn: e.target.value })}
            placeholder="English action description"
            disabled={frame.locked}
          />
          <textarea
            className="ksp-input ksp-textarea"
            rows={2}
            value={frame.actionVi ?? ""}
            onChange={(e) => onUpdate({ actionVi: e.target.value })}
            placeholder="Vietnamese (optional)"
            disabled={frame.locked}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// IMAGE PROMPT SECTION
// ============================================================================

function ImagePromptSection({
  shot,
  cast,
  animationStyle,
  aspectRatio,
  onGenerated,
  showToast,
}: {
  shot: FilmShot;
  cast: FilmCharacterV2[];
  animationStyle: any;
  aspectRatio: any;
  onGenerated: (prompt: string) => void;
  showToast: (msg: string, type?: any) => void;
}) {
  const [copied, setCopied] = useState(false);

  const prompt = useMemo(() => {
    if (!shot.frames || shot.frames.length === 0) return "";
    return buildShotImagePrompt({
      shot: {
        titleEn: shot.titleEn,
        durationSeconds: shot.durationSeconds,
        gridFormat: shot.gridFormat,
        cameraMovement: shot.cameraMovement,
        purpose: shot.purpose,
      },
      frames: shot.frames.map((f) => ({
        order: f.order,
        actionEn: f.actionEn,
        timingSeconds: f.timingSeconds,
      })),
      cast,
      animationStyle,
      aspectRatio,
    });
  }, [shot, cast, animationStyle, aspectRatio]);

  function handleGenerate() {
    onGenerated(prompt);
    showToast("✓ Image prompt generated. Copy it and use in Banana Pro.", "success");
  }

  function handleCopy() {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <details className="ksp-shot-block ksp-collapsible-inline" open>
      <summary>🖼 Image Prompt (cho Banana Pro / Imagen)</summary>
      <div className="ksp-collapsible-inline-content">
        <pre className="ksp-prompt-preview">{prompt}</pre>
        <div className="ksp-prompt-actions">
          <button className="ksp-btn ksp-btn-orange" onClick={handleGenerate}>
            ⚡ Generate &amp; save prompt
          </button>
          <button className="ksp-btn ksp-btn-secondary" onClick={handleCopy}>
            {copied ? "✓ Copied" : "📋 Copy"}
          </button>
        </div>
      </div>
    </details>
  );
}

// ============================================================================
// IMAGE GEN BLOCK (Mockup A) — upload grid + auto-crop + replace single frame
// ============================================================================

function ImageGenBlock({
  shot,
  cast,
  aspectRatio,
  onUpload,
  onAutoCrop,
  onReplaceFrame,
  showToast,
}: {
  shot: FilmShot;
  cast: FilmCharacterV2[];
  aspectRatio: any;
  onUpload: (gridRefId: string) => void;
  onAutoCrop: (croppedIds: string[]) => void;
  onReplaceFrame: (frameIdx: number, newRefId: string) => void;
  showToast: (msg: string, type?: any) => void;
}) {
  const [selectedFrame, setSelectedFrame] = useState<number | null>(null);
  const [changeRequest, setChangeRequest] = useState("");

  // Upload grid → save to IndexedDB (simplified: blob URL only for now, full IDB integration in Phase 5)
  function handleUploadGrid(file: File) {
    const url = URL.createObjectURL(file);
    onUpload(url);
    showToast(`✓ Uploaded grid: ${file.name}`, "success");
  }

  // Auto-crop using Canvas API
  async function handleAutoCrop() {
    if (!shot.gridImageId) {
      showToast("Upload grid first", "error");
      return;
    }

    const [rows, cols] = shot.gridFormat.split("x").map(Number);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = shot.gridImageId;

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load grid image"));
    });

    const cellWidth = img.width / cols;
    const cellHeight = img.height / rows;
    const cropped: string[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const canvas = document.createElement("canvas");
        canvas.width = cellWidth;
        canvas.height = cellHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(
          img,
          c * cellWidth,
          r * cellHeight,
          cellWidth,
          cellHeight,
          0,
          0,
          cellWidth,
          cellHeight
        );
        cropped.push(canvas.toDataURL("image/png"));
      }
    }

    onAutoCrop(cropped);
    showToast(`✓ Auto-cropped ${cropped.length} frames`, "success");
  }

  return (
    <details className="ksp-shot-block ksp-collapsible-inline" open>
      <summary>📤 Image Gen — upload grid + auto-crop + replace</summary>
      <div className="ksp-collapsible-inline-content">
        {/* Upload area */}
        <div className="ksp-upload-area">
          <input
            type="file"
            accept="image/*"
            id={`upload-grid-${shot.id}`}
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUploadGrid(file);
            }}
          />
          <label htmlFor={`upload-grid-${shot.id}`} className="ksp-btn ksp-btn-secondary">
            📤 Upload grid (sau khi tạo từ Banana Pro)
          </label>
          {shot.gridImageId && (
            <span className="ksp-upload-status">✓ Grid uploaded</span>
          )}
        </div>

        {shot.gridImageId && (
          <button className="ksp-btn ksp-btn-orange" onClick={handleAutoCrop}>
            ✂️ Auto-crop into frames
          </button>
        )}

        {/* Cropped grid for selecting frame to replace */}
        {(shot.croppedFrameIds?.length ?? 0) > 0 && (
          <>
            <div className="ksp-cropped-grid-label">Click frame để sửa theo yêu cầu khách:</div>
            <div
              className="ksp-cropped-grid"
              style={{
                gridTemplateColumns: `repeat(${shot.gridFormat.split("x")[1]}, 1fr)`,
              }}
            >
              {(shot.croppedFrameIds ?? []).map((refId, i) => (
                <div
                  key={i}
                  className={`ksp-cropped-cell ${selectedFrame === i ? "ksp-cropped-cell-selected" : ""}`}
                  onClick={() => setSelectedFrame(i)}
                >
                  <span className="ksp-frame-num">F{i + 1}</span>
                </div>
              ))}
            </div>

            {selectedFrame !== null && (
              <div className="ksp-frame-replace-panel">
                <div className="ksp-frame-replace-header">
                  Frame {selectedFrame + 1} đang chọn — Sửa theo yêu cầu khách
                </div>
                <textarea
                  className="ksp-input ksp-textarea"
                  rows={2}
                  placeholder="Mô tả thay đổi (vd: Robot ngước mặt thay vì cúi)"
                  value={changeRequest}
                  onChange={(e) => setChangeRequest(e.target.value)}
                />
                <div className="ksp-form-row ksp-form-row-2">
                  <button
                    className="ksp-btn ksp-btn-orange"
                    onClick={() =>
                      showToast("API replace coming in Phase 5 wire-up", "info")
                    }
                  >
                    ⚡ AI tạo ảnh thay (API)
                  </button>
                  <button className="ksp-btn ksp-btn-orange-ghost">
                    📤 Upload ảnh thay (manual)
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </details>
  );
}

// ============================================================================
// VIDEO AI BLOCK (Mockup 7)
// ============================================================================

function VideoAiBlock({
  shot,
  cast,
  animationStyle,
  aspectRatio,
  timeFormat,
  onChunksGenerated,
  showToast,
}: {
  shot: FilmShot;
  cast: FilmCharacterV2[];
  animationStyle: any;
  aspectRatio: any;
  timeFormat: TimeFormat;
  onChunksGenerated: (chunks: AnimationChunk[]) => void;
  showToast: (msg: string, type?: any) => void;
}) {
  const [provider, setProvider] = useState<VideoProvider>("seedance-2-pro");
  const [chunks, setChunks] = useState<AnimationChunk[]>(shot.animationPrompts ?? []);

  function handleGenerate() {
    if (!shot.frames || shot.frames.length === 0) {
      showToast("Need frames first. Click AI derive frames above.", "error");
      return;
    }
    const newChunks = buildAllChunkPrompts({
      shot,
      frames: shot.frames,
      cast,
      animationStyle,
      aspectRatio,
      provider,
      timeFormat,
    });
    setChunks(newChunks);
    onChunksGenerated(newChunks);
    showToast(`✓ Generated ${newChunks.length} chunks for ${VIDEO_PROVIDERS[provider].label}`, "success");
  }

  const providerCfg = VIDEO_PROVIDERS[provider];

  return (
    <details className="ksp-shot-block ksp-collapsible-inline" open>
      <summary>🎞 Video AI — animation chunks</summary>
      <div className="ksp-collapsible-inline-content">
        <div className="ksp-form-row ksp-form-row-2">
          <Label text="Video Provider">
            <select
              className="ksp-select"
              value={provider}
              onChange={(e) => setProvider(e.target.value as VideoProvider)}
            >
              {Object.values(VIDEO_PROVIDERS).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} · max {p.maxDurationSeconds}s
                </option>
              ))}
            </select>
          </Label>
          <Label text="Camera Movement">
            <select className="ksp-select" value={shot.cameraMovement} disabled>
              <option>{shot.cameraMovement.replace(/_/g, " ")}</option>
            </select>
          </Label>
        </div>

        <div className="ksp-form-row ksp-form-row-2">
          <Label text="Total duration">
            <input
              type="text"
              className="ksp-input"
              value={`${shot.durationSeconds}s`}
              disabled
            />
          </Label>
          <Label text="Chunks needed">
            <input
              type="text"
              className="ksp-input"
              value={`${Math.ceil(shot.durationSeconds / providerCfg.maxDurationSeconds)} chunks`}
              disabled
            />
          </Label>
        </div>

        <button className="ksp-btn ksp-btn-orange" onClick={handleGenerate}>
          ⚡ Generate animation prompts
        </button>

        {chunks.length > 0 && (
          <div className="ksp-chunks-list">
            {chunks.map((chunk, i) => (
              <ChunkCard
                key={chunk.id}
                chunk={chunk}
                shot={shot}
                cast={cast}
                timeFormat={timeFormat}
              />
            ))}
            <div className="ksp-chunks-actions">
              <button
                className="ksp-btn ksp-btn-orange"
                onClick={() => {
                  navigator.clipboard.writeText(chunks.map((c) => c.prompt).join("\n\n---\n\n"));
                  showToast("✓ All chunks copied", "success");
                }}
              >
                📋 Copy ALL chunks
              </button>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

function ChunkCard({
  chunk,
  shot,
  cast,
  timeFormat,
}: {
  chunk: AnimationChunk;
  shot: FilmShot;
  cast: FilmCharacterV2[];
  timeFormat: TimeFormat;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(chunk.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Reference thumbnails (Mockup 7 feature)
  const castRefs = cast.flatMap((c) => [
    ...c.faceRefs.slice(0, 1).map((r) => ({ id: r.id, label: c.name, emoji: "🤖" })),
    ...c.bodyRefs.slice(0, 1).map((r) => ({ id: r.id, label: c.name, emoji: "🦾" })),
  ]);
  const frameRefs = (shot.croppedFrameIds ?? [])
    .slice(chunk.frameRange.start, chunk.frameRange.end)
    .slice(0, 3)
    .map((id, i) => ({
      id,
      label: `F${chunk.frameRange.start + i + 1}`,
      emoji: "",
    }));

  return (
    <div className="ksp-chunk-card">
      <div className="ksp-chunk-card-header">
        <span className="ksp-chunk-title">
          Chunk {chunk.order + 1} — Frames {chunk.frameRange.start + 1}–{chunk.frameRange.end} (
          {formatTimeRange(chunk.timingSeconds.start, chunk.timingSeconds.end, timeFormat)})
        </span>
        <div className="ksp-chunk-meta">
          <span className={chunk.charCount > chunk.charLimit ? "ksp-warning" : ""}>
            {chunk.charCount} / {chunk.charLimit}
          </span>
          <div className="ksp-chunk-refs" title="Reference images for this chunk">
            <span style={{ color: "#85b7eb", fontSize: 10 }}>📷</span>
            {castRefs.map((r, i) => (
              <span key={i} className="ksp-chunk-ref-thumb" title={r.label}>
                {r.emoji}
              </span>
            ))}
            {frameRefs.map((r, i) => (
              <span key={i} className="ksp-chunk-ref-thumb ksp-chunk-ref-frame">
                {r.label}
              </span>
            ))}
          </div>
          <button className="ksp-btn ksp-btn-xs ksp-btn-orange-ghost" onClick={handleCopy}>
            {copied ? "✓" : "📋"} Copy
          </button>
        </div>
      </div>
      <pre className="ksp-chunk-prompt">{chunk.prompt}</pre>
    </div>
  );
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="ksp-label">
      <span className="ksp-label-text">{text}</span>
      {children}
    </label>
  );
}
