/**
 * KSP Image qc17 — Edit Frame Modal
 *
 * Opens when user clicks ✏ on a cell in FilmStoryboardSection visual grid.
 *
 * Shows:
 *   1. Frame preview (fullsize) — cropped image or "no upload yet" placeholder
 *   2. Editable shot info: titleVi/titleEn, action, duration, camera movement, shot type
 *   3. IMAGE prompt block (collapsible) — scene-level prompt that includes this cell.
 *      Shows highlighted cell entry (what this shot contributes to grid).
 *   4. ANIMATION prompt block (collapsible) — per-shot Seedance/Veo prompt with
 *      char count + provider selector + Copy → provider button.
 *      qc17: validates duration vs provider; if mismatch, offers auto-clamp.
 *   5. Per-cell override prompt (qc17 stub — defer wire to qc18)
 *
 * 4 actions in footer:
 *   - 🔄 Regenerate frame (Nano Banana stub — defer to qc18)
 *   - 📤 Upload replace (single frame PNG upload)
 *   - 📋 Copy animation prompt (with validate + clamp)
 *   - 💾 Save changes
 */

import React, { useState, useMemo } from "react";
import type {
  FilmShot,
  FilmSceneScript,
  SceneGrid,
  SceneGridCell,
  ProjectSettingV2,
} from "../types/project";
import type { FilmCharacter } from "../types/film";
import { DEFAULT_VIDEO_PROVIDERS, resolveVideoProvider } from "../types/film";
import {
  buildSingleShotImagePrompt,
  buildAnimationPromptAdvanced,
  buildAnimationPrompt,
  TIME_FORMAT_LABELS,
  type TimeFormat,
} from "../engine/filmShotPromptBuilder";
import {
  PROVIDER_DURATIONS,
  isDurationValid,
  clampDurationToProvider,
  formatDurationsForUI,
} from "../engine/providerDurations";

const SHOT_TYPE_OPTIONS: { value: FilmShot["shotType"]; label: string }[] = [
  { value: "wide_establishing", label: "Wide / Establishing" },
  { value: "medium", label: "Medium" },
  { value: "close_up", label: "Close-up" },
  { value: "insert", label: "Insert" },
  { value: "over_shoulder", label: "Over Shoulder" },
  { value: "two_shot", label: "Two-shot" },
  { value: "pov", label: "POV" },
];

const CAMERA_MOVEMENT_OPTIONS: { value: string; label: string }[] = [
  { value: "static", label: "Static" },
  { value: "pan_left", label: "Pan Left" },
  { value: "pan_right", label: "Pan Right" },
  { value: "tilt_up", label: "Tilt Up" },
  { value: "tilt_down", label: "Tilt Down" },
  { value: "zoom_in", label: "Zoom In" },
  { value: "zoom_out", label: "Zoom Out" },
  { value: "dolly_in", label: "Dolly In" },
  { value: "dolly_out", label: "Dolly Out" },
  { value: "tracking", label: "Tracking" },
  { value: "handheld_documentary", label: "Handheld / Documentary" },
];

export interface FilmFrameEditModalProps {
  /** Cell being edited (must have shotId) */
  cell: SceneGridCell;
  /** Grid containing the cell (needed for image prompt context) */
  grid: SceneGrid;
  /** Scene containing the grid (needed for prompt context) */
  scene: FilmSceneScript;
  /** Shot referenced by cell.shotId */
  shot: FilmShot;
  /** All shots in scene (for image prompt scene-level context) */
  allShotsInScene: FilmShot[];
  /** All cast (for prompt) */
  cast: FilmCharacter[];
  /** Project setting (animation style, aspect, default video provider) */
  setting: ProjectSettingV2;
  /** Save edits — caller updates store */
  onSave: (updates: Partial<FilmShot>) => void;
  /** Upload replace frame — caller saves dataUrl to cell */
  onUploadReplace: (dataUrl: string) => void;
  /** Upload video for this cell — caller persists to cell.video */
  onUploadVideo: (video: { dataUrl: string; filename: string; durationSeconds?: number }) => void;
  /** Remove uploaded video from cell */
  onClearVideo: () => void;
  /** User cancels — close modal without saving */
  onCancel: () => void;
  /** Toast helper (defer to caller — store hook) */
  showToast?: (msg: string, type?: "success" | "error" | "info") => void;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/** Trigger browser download of a dataURL with a specific filename */
function triggerDownload(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Extract the last frame of a video as PNG dataURL (browser-side, canvas).
 * Seeks to (duration - 0.05s) to avoid black-frame artifacts at exact end.
 */
async function extractLastFrameFromVideo(videoDataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = videoDataUrl;
    video.onloadedmetadata = () => {
      // Seek just before end to avoid potential black frame at exact duration
      video.currentTime = Math.max(0, video.duration - 0.05);
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas 2D context unavailable"));
          return;
        }
        ctx.drawImage(video, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (err) {
        reject(err);
      }
    };
    video.onerror = () => reject(new Error("Video load failed"));
  });
}

export function FilmFrameEditModal({
  cell,
  grid,
  scene,
  shot,
  allShotsInScene,
  cast,
  setting,
  onSave,
  onUploadReplace,
  onUploadVideo,
  onClearVideo,
  onCancel,
  showToast,
}: FilmFrameEditModalProps) {
  // Editable shot fields (local state, save on click)
  const [titleVi, setTitleVi] = useState(shot.titleVi ?? "");
  const [titleEn, setTitleEn] = useState(shot.titleEn ?? "");
  const [actionVi, setActionVi] = useState((shot as any).actionVi ?? "");
  const [actionEn, setActionEn] = useState((shot as any).actionEn ?? "");
  const [duration, setDuration] = useState(shot.durationSeconds);
  const [cameraMovement, setCameraMovement] = useState(shot.cameraMovement);
  const [shotType, setShotType] = useState(shot.shotType);
  const [videoProviderId, setVideoProviderId] = useState(
    shot.videoProviderId ?? (setting as any).defaultVideoProvider ?? "seedance-2-pro"
  );

  // Collapsible state
  const [imagePromptExpanded, setImagePromptExpanded] = useState(false);
  const [animationPromptExpanded, setAnimationPromptExpanded] = useState(false);
  // Advanced first/last-frame mode toggle + last frame cell pick
  const [advancedFirstLast, setAdvancedFirstLast] = useState(false);
  const [lastFrameShotId, setLastFrameShotId] = useState<string | null>(null);
  // Time format for TIMING BREAKDOWN in animation prompt (default = universal timecode)
  const [timeFormat, setTimeFormat] = useState<TimeFormat>("timecode");
  // Drag-swap: when true, first-frame and last-frame are swapped (UI + prompt)
  const [firstLastSwapped, setFirstLastSwapped] = useState(false);
  // When user picks "Extract last frame from this cell's video" — dataUrl of extracted frame
  const [extractedLastFrame, setExtractedLastFrame] = useState<string | null>(null);
  const [extractingFrame, setExtractingFrame] = useState(false);

  // View mode toggle for left pane: when cell has video, user can switch between
  // playing the video and showing the static keyframe image. Default = "video" if available.
  const [leftPaneView, setLeftPaneView] = useState<"video" | "image">(
    cell.video?.dataUrl ? "video" : "image"
  );

  // Image prompt is PER-CELL (single shot generation), not scene-level grid.
  const imagePromptText = useMemo(() => {
    return buildSingleShotImagePrompt({
      shot,
      scene,
      cast,
      setting,
    });
  }, [shot, scene, cast, setting]);

  const provider = useMemo(() => resolveVideoProvider(videoProviderId, undefined), [videoProviderId]);

  // Animation prompt uses local edited values (not shot from store) for live preview
  const previewShot: FilmShot = useMemo(
    () => ({
      ...shot,
      titleVi,
      titleEn,
      durationSeconds: duration,
      cameraMovement: cameraMovement as any,
      shotType,
      // Inject local action edits via cast to any
      ...((actionVi || actionEn) ? { actionVi, actionEn } : {}),
    } as any),
    [shot, titleVi, titleEn, duration, cameraMovement, shotType, actionVi, actionEn]
  );

  // Last frame shot resolution (only in Advanced mode).
  // Special value "__extract_video__" means extract last frame from cell's video.
  const lastFrameShot = useMemo(() => {
    if (!advancedFirstLast || !lastFrameShotId) return null;
    if (lastFrameShotId === "__extract_video__") {
      // Use current shot as "last frame source" but with extracted dataUrl
      // (prompt builder will reference filename last-frame_shot-N.png — same convention)
      return previewShot;
    }
    return allShotsInScene.find((s) => s.id === lastFrameShotId) ?? null;
  }, [advancedFirstLast, lastFrameShotId, allShotsInScene, previewShot]);

  const animationPromptText = useMemo(() => {
    if (advancedFirstLast && lastFrameShot) {
      return buildAnimationPromptAdvanced({
        shot: previewShot,
        lastFrameShot,
        scene,
        cast,
        setting,
        provider,
        timeFormat,
        swapped: firstLastSwapped,
      });
    }
    return buildAnimationPrompt({
      shot: previewShot,
      scene,
      cast,
      setting,
      provider,
      timeFormat,
    });
  }, [previewShot, scene, cast, setting, provider, advancedFirstLast, lastFrameShot, timeFormat, firstLastSwapped]);

  // qc17 — duration validation vs provider
  const durationValid = isDurationValid(duration, videoProviderId);
  const clampedDuration = clampDurationToProvider(duration, videoProviderId);
  const supportedLabel = formatDurationsForUI(videoProviderId);

  function handleSave() {
    const updates: Partial<FilmShot> = {
      titleVi,
      titleEn,
      durationSeconds: duration,
      cameraMovement: cameraMovement as any,
      shotType,
      videoProviderId,
    };
    if (actionVi !== ((shot as any).actionVi ?? "")) (updates as any).actionVi = actionVi;
    if (actionEn !== ((shot as any).actionEn ?? "")) (updates as any).actionEn = actionEn;
    onSave(updates);
    showToast?.(`Đã lưu shot ${shot.order}`, "success");
  }

  function handleCopyAnimation() {
    // qc17 validate + offer clamp
    if (!durationValid) {
      const ok = confirm(
        `Shot duration ${duration}s không khớp với ${provider.name} (${supportedLabel}).\n\nAuto-clamp về ${clampedDuration}s rồi copy?\n\n[OK] Clamp về ${clampedDuration}s + copy\n[Cancel] Copy nguyên ${duration}s`
      );
      if (ok) {
        // Update duration first
        setDuration(clampedDuration);
        const adjustedShot = { ...previewShot, durationSeconds: clampedDuration };
        // qc22c: respect advanced mode in clamp re-build
        const clampedPrompt =
          advancedFirstLast && lastFrameShot
            ? buildAnimationPromptAdvanced({
                shot: adjustedShot,
                lastFrameShot,
                scene,
                cast,
                setting,
                provider,
              })
            : buildAnimationPrompt({
                shot: adjustedShot,
                scene,
                cast,
                setting,
                provider,
              });
        navigator.clipboard.writeText(clampedPrompt);
        showToast?.(`Đã clamp ${duration}s → ${clampedDuration}s + copy`, "success");
        return;
      }
      // User chose to copy anyway
    }
    navigator.clipboard.writeText(animationPromptText);
    showToast?.(
      `Copied animation prompt → ${provider.name} (${animationPromptText.length} chars)${
        advancedFirstLast && lastFrameShot ? " · Advanced first/last" : ""
      }`,
      "success"
    );
  }

  async function handleUploadReplaceFile(file: File) {
    try {
      const dataUrl = await fileToDataUrl(file);
      onUploadReplace(dataUrl);
      showToast?.(`Đã upload replace cell ${cell.order}`, "success");
    } catch (err) {
      showToast?.(`Upload lỗi: ${(err as Error).message}`, "error");
    }
  }

  function handleRegenStub() {
    showToast?.(
      "qc18 sẽ wire Nano Banana API: regen single frame với scene context + per-cell override",
      "info"
    );
  }

  return (
    <div className="ksp-frame-edit-modal-backdrop" onClick={onCancel}>
      <div
        className="ksp-frame-edit-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Edit frame"
      >
        <header className="ksp-frame-edit-modal-header">
          <h3>
            ✏ Edit Frame — Scene {scene.order}, Grid {grid.order}, Cell {cell.order}
            {" "}(Shot {shot.order})
            {cell.video?.dataUrl && (
              <span className="ksp-frame-edit-video-badge" title={`Video: ${cell.video.filename}`}>
                🎬 Video uploaded
              </span>
            )}
          </h3>
          <button
            type="button"
            className="ksp-frame-edit-modal-close"
            onClick={onCancel}
            aria-label="Đóng"
          >
            ×
          </button>
        </header>

        <div className="ksp-frame-edit-modal-body">
          {/* Frame preview — single OR split (first + last) when Advanced + last-frame picked */}
          <div
            className={`ksp-frame-edit-preview-wrap ${
              advancedFirstLast && lastFrameShot ? "ksp-frame-edit-preview-split" : ""
            }`}
          >
            {(() => {
              // Resolve content for each pane based on swap state.
              // Left pane = first-frame, right pane = last-frame.
              // When firstLastSwapped is true, the "current cell" content moves to right (last-frame role).
              const lastCell = lastFrameShot && lastFrameShotId !== "__extract_video__"
                ? grid.cells.find((c) => c.shotId === lastFrameShot.id)
                : null;
              const lastCellDataUrl =
                lastFrameShotId === "__extract_video__"
                  ? extractedLastFrame ?? undefined
                  : lastCell?.dataUrl;

              const currentPane = {
                dataUrl: cell.dataUrl,
                shotOrder: shot.order,
                video: cell.video,
                isExtracted: false,
              };
              const otherPane = lastFrameShot
                ? {
                    dataUrl: lastCellDataUrl,
                    shotOrder: lastFrameShot.order,
                    video: undefined as typeof cell.video,
                    isExtracted: lastFrameShotId === "__extract_video__",
                  }
                : null;

              // Swap: left pane shows "first-frame role". When swapped, the current cell
              // gets last-frame role (right), and otherPane gets first-frame role (left).
              const leftPaneContent = firstLastSwapped && otherPane ? otherPane : currentPane;
              const rightPaneContent = firstLastSwapped ? currentPane : otherPane;

              function downloadLeft() {
                if (!leftPaneContent.dataUrl) return;
                const fname =
                  advancedFirstLast && lastFrameShot
                    ? `first-frame_shot-${leftPaneContent.shotOrder}.png`
                    : `first-frame_shot-${leftPaneContent.shotOrder}.png`;
                triggerDownload(leftPaneContent.dataUrl, fname);
                showToast?.(`Đã tải ${fname}`, "success");
              }
              function downloadRight() {
                if (!rightPaneContent?.dataUrl) return;
                const fname = `last-frame_shot-${rightPaneContent.shotOrder}.png`;
                triggerDownload(rightPaneContent.dataUrl, fname);
                showToast?.(`Đã tải ${fname}`, "success");
              }

              return (
                <>
                  {/* Left pane (first-frame role) */}
                  <div
                    className="ksp-frame-edit-preview-pane"
                    draggable={advancedFirstLast && !!lastFrameShot}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", "left");
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => {
                      if (advancedFirstLast && lastFrameShot) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from = e.dataTransfer.getData("text/plain");
                      if (from === "right") setFirstLastSwapped((s) => !s);
                    }}
                    onClick={downloadLeft}
                    title={
                      leftPaneContent.dataUrl
                        ? advancedFirstLast && lastFrameShot
                          ? "Click to download · drag to swap"
                          : "Click to download"
                        : ""
                    }
                    style={{
                      cursor: leftPaneContent.dataUrl ? "pointer" : "default",
                    }}
                  >
                    {/* Video/Image toggle icons — top-right of pane.
                        Visible only when cell has BOTH video AND image. */}
                    {leftPaneContent.video?.dataUrl && leftPaneContent.dataUrl && (
                      <div
                        className="ksp-frame-edit-preview-view-toggle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className={`ksp-frame-edit-view-toggle-btn ${
                            leftPaneView === "video" ? "active" : ""
                          }`}
                          onClick={() => setLeftPaneView("video")}
                          title="Show video"
                        >
                          🎬
                        </button>
                        <button
                          type="button"
                          className={`ksp-frame-edit-view-toggle-btn ${
                            leftPaneView === "image" ? "active" : ""
                          }`}
                          onClick={() => setLeftPaneView("image")}
                          title="Show image (keyframe)"
                        >
                          🖼
                        </button>
                      </div>
                    )}

                    {/* Render: prefer based on viewMode if both exist, else fallback */}
                    {leftPaneContent.video?.dataUrl &&
                    (leftPaneView === "video" || !leftPaneContent.dataUrl) ? (
                      <video
                        src={leftPaneContent.video.dataUrl}
                        className="ksp-frame-edit-preview-img"
                        muted
                        loop
                        autoPlay
                        playsInline
                      />
                    ) : leftPaneContent.dataUrl ? (
                      <img
                        src={leftPaneContent.dataUrl}
                        alt={`Shot ${leftPaneContent.shotOrder}`}
                        className="ksp-frame-edit-preview-img"
                      />
                    ) : (
                      <div className="ksp-frame-edit-preview-empty">
                        <span>Chưa có ảnh — upload grid trong Storyboard hoặc upload replace ở đây.</span>
                      </div>
                    )}
                    {advancedFirstLast && lastFrameShot && (
                      <div className="ksp-frame-edit-preview-label">
                        first-frame · Shot {leftPaneContent.shotOrder}
                      </div>
                    )}
                  </div>

                  {/* Right pane (last-frame role) — only in Advanced + lastFrame picked */}
                  {advancedFirstLast && lastFrameShot && rightPaneContent && (
                    <div
                      className="ksp-frame-edit-preview-pane"
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", "right");
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const from = e.dataTransfer.getData("text/plain");
                        if (from === "left") setFirstLastSwapped((s) => !s);
                      }}
                      onClick={downloadRight}
                      title={rightPaneContent.dataUrl ? "Click to download · drag to swap" : ""}
                      style={{ cursor: rightPaneContent.dataUrl ? "pointer" : "default" }}
                    >
                      {rightPaneContent.video?.dataUrl ? (
                        <video
                          src={rightPaneContent.video.dataUrl}
                          className="ksp-frame-edit-preview-img"
                          muted
                          loop
                          autoPlay
                          playsInline
                        />
                      ) : rightPaneContent.dataUrl ? (
                        <img
                          src={rightPaneContent.dataUrl}
                          alt={`Last frame — Shot ${rightPaneContent.shotOrder}`}
                          className="ksp-frame-edit-preview-img"
                        />
                      ) : (
                        <div className="ksp-frame-edit-preview-empty">
                          <span>
                            {rightPaneContent.isExtracted
                              ? extractingFrame
                                ? "Đang extract last frame từ video..."
                                : "Chưa extract — click 'Extract' ở dropdown"
                              : `Shot ${rightPaneContent.shotOrder} chưa có ảnh trong grid này.`}
                          </span>
                        </div>
                      )}
                      <div className="ksp-frame-edit-preview-label">
                        last-frame · Shot {rightPaneContent.shotOrder}
                        {rightPaneContent.isExtracted && " · extracted"}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* Editable shot info */}
          <div className="ksp-frame-edit-fields">
            <div className="ksp-frame-edit-row">
              <label>
                <span>Title VN</span>
                <input
                  type="text"
                  value={titleVi}
                  onChange={(e) => setTitleVi(e.target.value)}
                  className="ksp-input"
                />
              </label>
              <label>
                <span>Title EN</span>
                <input
                  type="text"
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                  className="ksp-input"
                />
              </label>
            </div>

            <div className="ksp-frame-edit-row">
              <label>
                <span>Shot Type</span>
                <select
                  value={shotType}
                  onChange={(e) => setShotType(e.target.value as FilmShot["shotType"])}
                  className="ksp-select"
                >
                  {SHOT_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Camera Movement</span>
                <select
                  value={cameraMovement as string}
                  onChange={(e) => setCameraMovement(e.target.value as any)}
                  className="ksp-select"
                >
                  {CAMERA_MOVEMENT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="ksp-frame-edit-row">
              <label>
                <span>Duration (s)</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  step={1}
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value, 10) || 1)}
                  className={`ksp-input ${!durationValid ? "ksp-frame-edit-input-warn" : ""}`}
                />
              </label>
              <label>
                <span>Video Provider</span>
                <select
                  value={videoProviderId}
                  onChange={(e) => setVideoProviderId(e.target.value)}
                  className="ksp-select"
                >
                  {DEFAULT_VIDEO_PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="ksp-frame-edit-row">
              <label>
                <span>Time format (in animation prompt)</span>
                <select
                  value={timeFormat}
                  onChange={(e) => setTimeFormat(e.target.value as TimeFormat)}
                  className="ksp-select"
                  title="Format hiển thị time trong TIMING BREAKDOWN của animation prompt"
                >
                  {(Object.keys(TIME_FORMAT_LABELS) as TimeFormat[]).map((k) => (
                    <option key={k} value={k}>
                      {TIME_FORMAT_LABELS[k]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Duration validation warning */}
            {!durationValid && (
              <div className="ksp-frame-edit-duration-warn">
                ⚠ {duration}s không khớp {provider.name} ({supportedLabel}).
                Khi Copy animation prompt sẽ offer auto-clamp về {clampedDuration}s.
              </div>
            )}

            <label className="ksp-frame-edit-row-full">
              <span>Action VN</span>
              <textarea
                value={actionVi}
                onChange={(e) => setActionVi(e.target.value)}
                className="ksp-textarea"
                rows={2}
                placeholder="Mô tả hành động cụ thể trong shot..."
              />
            </label>

            <label className="ksp-frame-edit-row-full">
              <span>Action EN (for AI prompts)</span>
              <textarea
                value={actionEn}
                onChange={(e) => setActionEn(e.target.value)}
                className="ksp-textarea"
                rows={2}
                placeholder="English action description for downstream AI..."
              />
            </label>
          </div>

          {/* Image Prompt block (qc22c: now per-cell single shot, not scene-level grid) */}
          <div className="ksp-frame-edit-prompt-block">
            <button
              type="button"
              className="ksp-frame-edit-prompt-toggle"
              onClick={() => setImagePromptExpanded(!imagePromptExpanded)}
            >
              {imagePromptExpanded ? "▼" : "▶"} 📝 Image Prompt
              <span className="ksp-frame-edit-prompt-chars">
                · {imagePromptText.length} chars
              </span>
            </button>
            {imagePromptExpanded && (
              <div className="ksp-frame-edit-prompt-body">
                <div className="ksp-frame-edit-prompt-note">
                  ⓘ Prompt tạo image cho shot này. Paste vào Banana Pro / Imagen + attach cast refs từ Refs ZIP.
                </div>
                <textarea
                  className="ksp-frame-edit-prompt-textarea"
                  readOnly
                  value={imagePromptText}
                />
                <button
                  type="button"
                  className="ksp-btn ksp-btn-ghost ksp-btn-sm"
                  onClick={() => {
                    navigator.clipboard.writeText(imagePromptText);
                    showToast?.("Copied single-shot image prompt", "success");
                  }}
                >
                  📋 Copy image prompt
                </button>
              </div>
            )}
          </div>

          {/* Animation Prompt block (per-shot, for video AI) */}
          <div className="ksp-frame-edit-prompt-block">
            <button
              type="button"
              className="ksp-frame-edit-prompt-toggle"
              onClick={() => setAnimationPromptExpanded(!animationPromptExpanded)}
            >
              {animationPromptExpanded ? "▼" : "▶"} 🎬 Animation Prompt
              <span className="ksp-frame-edit-prompt-chars">
                · {animationPromptText.length} chars
                {provider.charLimit ? ` / ${provider.charLimit}` : ""}
              </span>
            </button>
            {animationPromptExpanded && (
              <div className="ksp-frame-edit-prompt-body">
                <div className="ksp-frame-edit-prompt-note">
                  ⓘ Prompt cho video AI. Provider hiện tại: <strong>{provider.name}</strong> · supports {supportedLabel}.
                </div>

                {/* qc22c: Advanced first/last-frame toggle */}
                <div className="ksp-frame-edit-advanced-row">
                  <label className="ksp-frame-edit-advanced-toggle">
                    <input
                      type="checkbox"
                      checked={advancedFirstLast}
                      onChange={(e) => {
                        setAdvancedFirstLast(e.target.checked);
                        if (!e.target.checked) setLastFrameShotId(null);
                      }}
                    />
                    <span>⚙ Advanced: First-frame + Last-frame mode</span>
                  </label>
                  {advancedFirstLast && (
                    <select
                      className="ksp-frame-edit-advanced-picker"
                      value={lastFrameShotId ?? ""}
                      onChange={async (e) => {
                        const value = e.target.value || null;
                        setLastFrameShotId(value);
                        // If user picked "extract from video", run extraction
                        if (value === "__extract_video__" && cell.video?.dataUrl) {
                          setExtractingFrame(true);
                          setExtractedLastFrame(null);
                          try {
                            const frame = await extractLastFrameFromVideo(cell.video.dataUrl);
                            setExtractedLastFrame(frame);
                            showToast?.("Đã extract last frame từ video", "success");
                          } catch (err) {
                            showToast?.(
                              `Extract lỗi: ${(err as Error).message}`,
                              "error"
                            );
                            setLastFrameShotId(null);
                          } finally {
                            setExtractingFrame(false);
                          }
                        }
                      }}
                    >
                      <option value="">— Pick last-frame shot —</option>
                      {allShotsInScene
                        .filter((s) => s.id !== shot.id)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            Shot {s.order}: {s.titleVi || s.titleEn}
                          </option>
                        ))}
                      {cell.video?.dataUrl && (
                        <option value="__extract_video__">
                          🎬 Extract last frame from this cell's video
                        </option>
                      )}
                    </select>
                  )}
                </div>
                {advancedFirstLast && (
                  <div className="ksp-frame-edit-prompt-note">
                    {lastFrameShot ? (
                      <>
                        ✓ First frame: <strong>shot {shot.order}</strong> (this cell) ·
                        Last frame: <strong>shot {lastFrameShot.order}</strong> ({lastFrameShot.titleVi || lastFrameShot.titleEn}).
                        Prompt sẽ instruct AI interpolate giữa 2 frames. User cần attach
                        2 reference images (cell hiện tại + cell shot {lastFrameShot.order})
                        vào video AI.
                      </>
                    ) : (
                      <>⚠ Chọn last-frame shot ở dropdown trên để generate Advanced prompt.</>
                    )}
                  </div>
                )}

                <textarea
                  className="ksp-frame-edit-prompt-textarea"
                  readOnly
                  value={animationPromptText}
                />
                <button
                  type="button"
                  className="ksp-btn ksp-btn-primary ksp-btn-sm"
                  onClick={handleCopyAnimation}
                >
                  📋 Copy → {provider.name}
                </button>
              </div>
            )}
          </div>
        </div>

        <footer className="ksp-frame-edit-modal-footer">
          <div className="ksp-frame-edit-footer-actions-left">
            <button
              type="button"
              className="ksp-btn ksp-btn-ghost ksp-btn-sm"
              onClick={handleRegenStub}
              title="Wire Nano Banana single-frame API later"
            >
              🔄 Regen frame
            </button>
            <label className="ksp-btn ksp-btn-ghost ksp-btn-sm">
              📤 Upload replace
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUploadReplaceFile(f);
                }}
              />
            </label>
            {cell.video?.dataUrl ? (
              <button
                type="button"
                className="ksp-btn ksp-btn-ghost ksp-btn-sm"
                onClick={() => {
                  if (!confirm("Xóa video uploaded cho cell này?")) return;
                  onClearVideo();
                  setExtractedLastFrame(null);
                  showToast?.("Đã xóa video", "info");
                }}
                title="Remove uploaded video"
              >
                🗑 Remove video
              </button>
            ) : (
              <label className="ksp-btn ksp-btn-ghost ksp-btn-sm">
                🎬 Upload video
                <input
                  type="file"
                  accept="video/*"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      const dataUrl = await fileToDataUrl(f);
                      let durationSeconds: number | undefined;
                      try {
                        durationSeconds = await new Promise<number>((res, rej) => {
                          const v = document.createElement("video");
                          v.preload = "metadata";
                          v.onloadedmetadata = () => res(v.duration);
                          v.onerror = () => rej(new Error("metadata"));
                          v.src = dataUrl;
                        });
                      } catch {
                        /* duration optional */
                      }
                      onUploadVideo({
                        dataUrl,
                        filename: f.name,
                        durationSeconds,
                      });
                      showToast?.(
                        `Video uploaded${
                          durationSeconds ? ` (${durationSeconds.toFixed(1)}s)` : ""
                        }`,
                        "success"
                      );
                    } catch (err) {
                      showToast?.(`Upload lỗi: ${(err as Error).message}`, "error");
                    }
                  }}
                />
              </label>
            )}
          </div>
          <div className="ksp-frame-edit-footer-actions-right">
            <button
              type="button"
              className="ksp-btn ksp-btn-ghost"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className="ksp-btn ksp-btn-primary"
              onClick={handleSave}
            >
              💾 Save changes
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
