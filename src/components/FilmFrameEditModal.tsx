/**
 * KSP Image Edit Frame Modal
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
 *      validates duration vs provider; if mismatch, offers auto-clamp.
 *   5. Per-cell override prompt (stub — defer wire to )
 *
 * 4 actions in footer:
 *   🔄 Regenerate frame (Nano Banana stub — defer to )
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
import { buildOmniShotPrompt } from "../engine/omniShotPromptBuilder";
import {
  PROVIDER_DURATIONS,
  isDurationValid,
  clampDurationToProvider,
  formatDurationsForUI,
} from "../engine/providerDurations";
import {
  runShotReprompt,
  type FilmScriptProvider,
} from "../engine/filmScriptStages";

const SHOT_TYPE_OPTIONS: { value: FilmShot["shotType"]; label: string }[] = [
  { value: "wide_establishing", label: "Wide / Establishing" },
  { value: "medium", label: "Medium" },
  { value: "close_up", label: "Close-up" },
  { value: "insert", label: "Insert" },
  { value: "over_shoulder", label: "Over Shoulder" },
  { value: "two_shot", label: "Two-shot" },
  { value: "pov", label: "POV" },
];

// r7.21: cameraMovement options now imported from single source of truth.
import { CAMERA_MOVEMENT_OPTIONS } from "../types/cameraMovement";

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
  /** r6: All scenes (for setup-payoff cross-scene anchoring in prompt) */
  allScenes?: FilmSceneScript[];
  /** r6: AI-detected setup-payoff pairs (for prompt continuity anchors) */
  setupPayoffPairs?: import("../types/project").SetupPayoffPair[];
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
  allScenes,
  setupPayoffPairs,
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
  // r7.22a: audio direction for Omni prompts (inline audio cues)
  const [audioDirection, setAudioDirection] = useState((shot as any).audioDirection ?? "");
  const [videoProviderId, setVideoProviderId] = useState(
    shot.videoProviderId ?? (setting as any).defaultVideoProvider ?? "seedance-2-pro"
  );

  // Sprint 1.0 r7 (Q-L): per-shot mood override state — fields editable in collapsible section
  const [lightingHintEn, setLightingHintEn] = useState<string>((shot as any).lightingHintEn ?? "");
  const [shotMoodOverride, setShotMoodOverride] = useState<string>(
    (shot as any).shotMoodOverride ?? ""
  );
  const [shotMoodIntensity, setShotMoodIntensity] = useState<number | "">(
    typeof (shot as any).shotMoodIntensity === "number" ? (shot as any).shotMoodIntensity : ""
  );
  const [moodOverrideExpanded, setMoodOverrideExpanded] = useState(false);

  // Sprint 1.0 r7 (Q-E follow-up): draggable gutter for left/right pane width.
  // Snap stops at 50px steps, persisted to localStorage.
  const [leftPaneWidth, setLeftPaneWidth] = useState<number>(() => {
    if (typeof window === "undefined") return 480;
    const stored = window.localStorage?.getItem("ksp.frameEdit.leftPaneWidth");
    const n = stored ? parseInt(stored, 10) : NaN;
    return isFinite(n) && n >= 300 && n <= 800 ? n : 480;
  });
  const [gutterDragging, setGutterDragging] = useState(false);

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

  // Sprint 1.0 AI re-prompt loading state (shared image + animation)
  const [isReprompting, setIsReprompting] = useState(false);

  // AI re-prompt handler — calls runShotReprompt with current shot state +
  // applies result via onSave callback (writes to imagePromptR5 + animationPromptR5).
  // Modal re-renders with override active. User can ↻ Reset to revert to deterministic build.
  async function handleAiReprompt() {
    setIsReprompting(true);
    try {
      const provider: FilmScriptProvider =
        ((setting.aiProviders?.scriptWriter ?? "gemini-flash") as FilmScriptProvider);
      const suggestion = await runShotReprompt({
        shot: {
          id: shot.id,
          titleVi,
          titleEn,
          shotType,
          cameraMovement: cameraMovement as string,
          durationSeconds: duration,
          actionVi,
          actionEn,
          rhythmRole: (shot as any).rhythmRole,
          imagePromptR5: (shot as any).imagePromptR5,
          animationPromptR5: (shot as any).animationPromptR5,
        },
        previousDuration: duration,
        sceneTension: (scene as any).tensionLevel,
        provider,
      });
      const stillNote = suggestion.useStillImage
        ? `\n\n📌 Duration ${duration}s > 8s — AI suggest dùng STILL IMAGE + audio overlay (Ken Burns) thay vì AI video clip.`
        : "";
      const ok = confirm(
        `🎬 AI re-prompt cho shot ${shot.order}\n\n💡 ${suggestion.rationaleVi}${stillNote}\n\n--- IMAGE PROMPT MỚI ---\n${suggestion.newImagePrompt}\n\n--- ANIMATION PROMPT MỚI ---\n${suggestion.newAnimationPrompt}\n\nÁp dụng?`
      );
      if (!ok) {
        showToast?.("Bỏ qua re-prompt", "info");
        return;
      }
      // Persist as override — modal re-renders with new prompts after parent updates store.
      onSave({
        imagePromptR5: suggestion.newImagePrompt,
        animationPromptR5: suggestion.newAnimationPrompt,
      } as any);
      showToast?.(
        `Đã áp dụng AI prompt mới${suggestion.useStillImage ? " (dùng still image)" : ""}`,
        "success"
      );
    } catch (err) {
      showToast?.(`AI re-prompt lỗi: ${(err as Error).message}`, "error");
    } finally {
      setIsReprompting(false);
    }
  }

  function handleResetPrompt(field: "imagePromptR5" | "animationPromptR5") {
    if (!confirm(`Reset ${field === "imagePromptR5" ? "image" : "animation"} prompt về auto-build?\n\nNội dung AI re-prompt sẽ bị xóa, prompt sẽ dùng default build từ shot info.`)) return;
    onSave({ [field]: undefined } as any);
    showToast?.("Đã reset về auto", "success");
  }

  // Image prompt is PER-CELL (single shot generation), not scene-level grid.
  // Sprint 1.0 Prefer shot.imagePromptR5 if set (AI re-prompt override),
  // fallback to deterministic build. User can toggle via 🎬 AI re-prompt / ↻ Reset.
  const imagePromptText = useMemo(() => {
    if ((shot as any).imagePromptR5) return (shot as any).imagePromptR5 as string;
    return buildSingleShotImagePrompt({
      shot,
      scene,
      cast,
      setting,
      allScenes,
      setupPayoffPairs,
    });
  }, [shot, scene, cast, setting, allScenes, setupPayoffPairs]);
  const imagePromptIsOverride = !!(shot as any).imagePromptR5;

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
    // Sprint 1.0 AI re-prompt override takes precedence
    if ((shot as any).animationPromptR5) return (shot as any).animationPromptR5 as string;
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
      allScenes,
      setupPayoffPairs,
    });
  }, [shot, previewShot, scene, cast, setting, provider, advancedFirstLast, lastFrameShot, timeFormat, firstLastSwapped, allScenes, setupPayoffPairs]);
  const animationPromptIsOverride = !!(shot as any).animationPromptR5;

  // duration validation vs provider
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
    // r7.22a: audio direction for Omni prompts
    const audioTrim = audioDirection.trim();
    (updates as any).audioDirection = audioTrim || undefined;
    // Sprint 1.0 r7 (Q-L): per-shot mood override fields
    const lightingTrim = lightingHintEn.trim();
    (updates as any).lightingHintEn = lightingTrim || undefined;
    (updates as any).shotMoodOverride = shotMoodOverride || undefined;
    (updates as any).shotMoodIntensity =
      shotMoodIntensity === "" ? undefined : (shotMoodIntensity as number);
    onSave(updates);
    showToast?.(`Đã lưu shot ${shot.order}`, "success");
  }

  // Sprint 1.0 r7: gutter drag handlers — snap to 50px stops, clamp 300-800
  function onGutterMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    setGutterDragging(true);
    const startX = e.clientX;
    const startWidth = leftPaneWidth;
    function onMove(ev: MouseEvent) {
      const delta = ev.clientX - startX;
      let next = startWidth + delta;
      // Snap to 50px stops
      next = Math.round(next / 50) * 50;
      next = Math.max(300, Math.min(800, next));
      setLeftPaneWidth(next);
    }
    function onUp() {
      setGutterDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      try {
        window.localStorage?.setItem("ksp.frameEdit.leftPaneWidth", String(leftPaneWidth));
      } catch {}
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleCopyAnimation() {
    // validate + offer clamp
    if (!durationValid) {
      const ok = confirm(
        `Shot duration ${duration}s không khớp với ${provider.name} (${supportedLabel}).\n\nAuto-clamp về ${clampedDuration}s rồi copy?\n\n[OK] Clamp về ${clampedDuration}s + copy\n[Cancel] Copy nguyên ${duration}s`
      );
      if (ok) {
        // Update duration first
        setDuration(clampedDuration);
        const adjustedShot = { ...previewShot, durationSeconds: clampedDuration };
        // c: respect advanced mode in clamp re-build
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
      "Frame regen từ scene context sẽ wire khi Nano Banana API ready",
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
            style={{ width: `${leftPaneWidth}px`, flexShrink: 0 }}
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

          {/* Sprint 1.0 r7: Draggable gutter for resizing left/right panes (50px snap stops) */}
          <div
            className={`ksp-modal-gutter-handle${gutterDragging ? " ksp-modal-gutter-active" : ""}`}
            onMouseDown={onGutterMouseDown}
            title="Kéo để chỉnh tỷ lệ (snap 50px)"
            role="separator"
            aria-orientation="vertical"
          />

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
                  {CAMERA_MOVEMENT_OPTIONS.map((o) => {
                    // r7.21: badge for Veo3/Omni-only vocab
                    const badge = o.veo3Compatible && o.omniCompatible
                      ? ""
                      : o.omniCompatible
                        ? " 🎯"
                        : " 🎬";
                    return (
                      <option key={o.value} value={o.value}>
                        {o.labelVi}{badge}
                      </option>
                    );
                  })}
                </select>
              </label>
            </div>

            {/* r7.22a: Audio direction for Omni prompts (optional, only shown when Omni mode targeted) */}
            <div className="ksp-frame-edit-row">
              <label style={{ width: "100%" }}>
                <span>
                  Audio direction <span style={{ fontSize: 10, color: "#888" }}>(Omni only — optional)</span>
                </span>
                <input
                  type="text"
                  value={audioDirection}
                  onChange={(e) => setAudioDirection(e.target.value)}
                  className="ksp-input"
                  placeholder='e.g. "soft footsteps + ambient wind", "harp synced to leaf touch"'
                  maxLength={200}
                />
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

          {/* Sprint 1.0 r7 (Q-L): Per-shot mood override collapsible section.
              Default collapsed (AI auto-fills hidden). User can expand to override. */}
          <div className="ksp-mood-override-section">
            <div
              className="ksp-mood-override-header"
              onClick={() => setMoodOverrideExpanded(!moodOverrideExpanded)}
              role="button"
              tabIndex={0}
            >
              {moodOverrideExpanded ? "▼" : "▶"} 🎨 Override per-shot mood
              <span style={{ fontSize: 11, color: "#888780", fontWeight: 400, marginLeft: "auto" }}>
                {(lightingHintEn || shotMoodOverride || shotMoodIntensity !== "") ? "(active)" : "(default scene)"}
              </span>
            </div>
            {moodOverrideExpanded && (
              <div className="ksp-mood-override-body">
                <div className="ksp-mood-override-field">
                  <label>
                    <span>Lighting hint (EN)</span>
                    <button
                      type="button"
                      className="ksp-mood-override-reset"
                      onClick={() => setLightingHintEn("")}
                      title="Reset về scene-level lighting"
                    >
                      Reset
                    </button>
                  </label>
                  <input
                    type="text"
                    value={lightingHintEn}
                    onChange={(e) => setLightingHintEn(e.target.value)}
                    placeholder="e.g., golden-hour rays, subtle blue accent on subject's eye"
                    className="ksp-input"
                  />
                </div>
                <div className="ksp-mood-override-field">
                  <label>
                    <span>Shot mood override</span>
                    <button
                      type="button"
                      className="ksp-mood-override-reset"
                      onClick={() => setShotMoodOverride("")}
                      title="Reset về scene-level emotion"
                    >
                      Reset
                    </button>
                  </label>
                  <select
                    value={shotMoodOverride}
                    onChange={(e) => setShotMoodOverride(e.target.value)}
                    className="ksp-input"
                  >
                    <option value="">(use scene emotion)</option>
                    <option value="tender">😊 Tender</option>
                    <option value="tense">😰 Tense</option>
                    <option value="funny">😄 Funny</option>
                    <option value="sad">😢 Sad</option>
                    <option value="shocking">😱 Shocking</option>
                    <option value="triumphant">🏆 Triumphant</option>
                    <option value="neutral">😐 Neutral</option>
                  </select>
                </div>
                <div className="ksp-mood-override-field">
                  <label>
                    <span>Tension intensity ({shotMoodIntensity === "" ? "default" : `${shotMoodIntensity}/10`})</span>
                    <button
                      type="button"
                      className="ksp-mood-override-reset"
                      onClick={() => setShotMoodIntensity("")}
                      title="Reset về scene-level tension"
                    >
                      Reset
                    </button>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={1}
                    value={shotMoodIntensity === "" ? 5 : shotMoodIntensity}
                    onChange={(e) =>
                      setShotMoodIntensity(parseInt(e.target.value, 10))
                    }
                  />
                </div>
              </div>
            )}
          </div>

          {/* Image Prompt block — per-cell single shot (not scene-level grid) */}
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
                  {imagePromptIsOverride && (
                    <span className="ksp-frame-edit-prompt-override-badge"> · 🎬 AI override</span>
                  )}
                </div>
                <textarea
                  className="ksp-frame-edit-prompt-textarea"
                  readOnly
                  value={imagePromptText}
                />
                <div className="ksp-frame-edit-prompt-actions">
                  <button
                    type="button"
                    className="ksp-btn ksp-btn-ghost ksp-btn-sm"
                    onClick={() => {
                      navigator.clipboard.writeText(imagePromptText);
                      showToast?.("Copied Veo3 image prompt (verbose, Tier 1-4 architecture)", "success");
                    }}
                    title="Verbose prompt cho Veo3 / Banana Pro / Imagen 4 / Seedance"
                  >
                    📋 Copy Veo3 🎬
                  </button>
                  <button
                    type="button"
                    className="ksp-btn ksp-btn-ghost ksp-btn-sm"
                    onClick={() => {
                      // r7.22a: Generate Omni-friendly concise prompt on-demand
                      const { promptText, references } = buildOmniShotPrompt({
                        shot,
                        scene,
                        cast,
                        setting,
                      });
                      // Include reference manifest as comment header in copied text
                      const refManifest = references.length > 0
                        ? `# REFERENCE IMAGES (upload to Gemini app in this order):\n${references.map((r) => `# <image_${r.slot}> = ${r.description}`).join("\n")}\n\n`
                        : "";
                      navigator.clipboard.writeText(refManifest + promptText);
                      showToast?.(`Copied Omni prompt (${references.length} refs needed)`, "success");
                    }}
                    title="Concise prompt cho Gemini Omni (~150 từ) + multimodal reference syntax"
                  >
                    📋 Copy Omni 🎯
                  </button>
                  <button
                    type="button"
                    className="ksp-btn ksp-btn-ghost ksp-btn-sm"
                    onClick={handleAiReprompt}
                    disabled={isReprompting}
                    title="AI viết lại image + animation prompts theo duration intent mới"
                  >
                    {isReprompting ? "⏳" : "🎬"} AI re-prompt
                  </button>
                  {imagePromptIsOverride && (
                    <button
                      type="button"
                      className="ksp-btn ksp-btn-ghost ksp-btn-sm"
                      onClick={() => handleResetPrompt("imagePromptR5")}
                      title="Reset image prompt về auto-build (xóa AI override)"
                    >
                      ↻ Reset
                    </button>
                  )}
                </div>
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
                  {animationPromptIsOverride && (
                    <span className="ksp-frame-edit-prompt-override-badge"> · 🎬 AI override</span>
                  )}
                </div>

                {/* Advanced first/last-frame toggle */}
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
                <div className="ksp-frame-edit-prompt-actions">
                  <button
                    type="button"
                    className="ksp-btn ksp-btn-primary ksp-btn-sm"
                    onClick={handleCopyAnimation}
                  >
                    📋 Copy → {provider.name}
                  </button>
                  <button
                    type="button"
                    className="ksp-btn ksp-btn-ghost ksp-btn-sm"
                    onClick={handleAiReprompt}
                    disabled={isReprompting}
                    title="AI viết lại image + animation prompts theo duration intent mới"
                  >
                    {isReprompting ? "⏳" : "🎬"} AI re-prompt
                  </button>
                  {animationPromptIsOverride && (
                    <button
                      type="button"
                      className="ksp-btn ksp-btn-ghost ksp-btn-sm"
                      onClick={() => handleResetPrompt("animationPromptR5")}
                      title="Reset animation prompt về auto-build (xóa AI override)"
                    >
                      ↻ Reset
                    </button>
                  )}
                </div>
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
