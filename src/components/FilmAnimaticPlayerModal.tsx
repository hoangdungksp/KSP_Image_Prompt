/**
 * KSP Image — Film Animatic Player Modal
 *
 * Per-scene animatic preview: plays through all shots in a scene with timing
 * matching each shot's duration, displaying cell image + caption + camera info.
 *
 * Triggered from Storyboard scene header "▶ Play Animatic" button.
 *
 * Design decisions (Jason chốt defaults):
 * - Scope: per-scene only (no cross-scene playback)
 * - No audio (TTS deferred to Voice section sprint)
 * - Transitions: hard cut between shots
 * - Render: modal overlay (dim background, ESC to close)
 * - Empty shots: placeholder "EMPTY · Shot N"
 * - Thumbnail strip: visible at bottom for click-to-jump
 *
 * Controls: play/pause, prev/next shot, step start/end, speed (0.5/1/1.5/2x),
 * timeline scrubber, thumbnail strip.
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import type {
  FilmSceneScript,
  FilmShot,
  ProjectSettingV2,
} from "../types/project";

export interface FilmAnimaticPlayerModalProps {
  scene: FilmSceneScript;
  shotsInScene: FilmShot[]; // ordered, all shots in scene
  /**
   * Per-shot asset info — keyframe image and optional uploaded video.
   * Animatic plays video if present, else falls back to image still.
   */
  cellAssetsByShotId: Record<
    string,
    | {
        dataUrl?: string;
        video?: { dataUrl: string; filename: string };
      }
    | undefined
  >;
  setting: ProjectSettingV2;
  onClose: () => void;
}

type PlaybackSpeed = 0.5 | 1 | 1.5 | 2;

const SPEED_OPTIONS: PlaybackSpeed[] = [0.5, 1, 1.5, 2];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function shotTypeLabel(type: string): string {
  const map: Record<string, string> = {
    wide_establishing: "Wide",
    medium: "Medium",
    close_up: "Close-up",
    extreme_close_up: "ECU",
    over_shoulder: "OTS",
    pov: "POV",
    insert: "Insert",
    cutaway: "Cutaway",
  };
  return map[type] ?? type.replace(/_/g, " ");
}

export function FilmAnimaticPlayerModal({
  scene,
  shotsInScene,
  cellAssetsByShotId,
  setting,
  onClose,
}: FilmAnimaticPlayerModalProps) {
  const [currentShotIdx, setCurrentShotIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [elapsedInShot, setElapsedInShot] = useState(0); // seconds within current shot
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const tickRef = useRef<number | null>(null);

  const totalShots = shotsInScene.length;
  const currentShot = shotsInScene[currentShotIdx];
  const currentDuration = currentShot?.durationSeconds ?? 0;

  // Cumulative timeline math
  const cumulativeBefore = useMemo(() => {
    const arr: number[] = [];
    let sum = 0;
    for (const s of shotsInScene) {
      arr.push(sum);
      sum += s.durationSeconds;
    }
    return arr;
  }, [shotsInScene]);

  const totalDuration = useMemo(
    () => shotsInScene.reduce((sum, s) => sum + s.durationSeconds, 0),
    [shotsInScene]
  );

  const elapsedTotal = (cumulativeBefore[currentShotIdx] ?? 0) + elapsedInShot;

  // Playback tick (100ms intervals, advance based on speed)
  useEffect(() => {
    if (!isPlaying) {
      if (tickRef.current !== null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }
    tickRef.current = window.setInterval(() => {
      setElapsedInShot((prev) => {
        const next = prev + (0.1 * playbackSpeed);
        if (next >= currentDuration) {
          // Advance to next shot
          if (currentShotIdx < totalShots - 1) {
            setCurrentShotIdx((i) => i + 1);
            return 0;
          }
          // Reached end — pause at last shot
          setIsPlaying(false);
          return currentDuration;
        }
        return next;
      });
    }, 100);
    return () => {
      if (tickRef.current !== null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [isPlaying, playbackSpeed, currentShotIdx, currentDuration, totalShots]);

  // Keyboard controls
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === " ") {
        e.preventDefault();
        handlePlayPause();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentShotIdx, totalShots]);

  function handlePlayPause() {
    setIsPlaying((p) => !p);
  }

  function handlePrev() {
    if (currentShotIdx > 0) {
      setCurrentShotIdx((i) => i - 1);
      setElapsedInShot(0);
    } else {
      setElapsedInShot(0);
    }
  }

  function handleNext() {
    if (currentShotIdx < totalShots - 1) {
      setCurrentShotIdx((i) => i + 1);
      setElapsedInShot(0);
    } else {
      setElapsedInShot(currentDuration);
      setIsPlaying(false);
    }
  }

  function handleJumpToShot(idx: number) {
    setCurrentShotIdx(idx);
    setElapsedInShot(0);
  }

  function handleRestart() {
    setCurrentShotIdx(0);
    setElapsedInShot(0);
    setIsPlaying(true);
  }

  function handleStepStart() {
    setCurrentShotIdx(0);
    setElapsedInShot(0);
  }

  function handleStepEnd() {
    setCurrentShotIdx(totalShots - 1);
    setElapsedInShot(shotsInScene[totalShots - 1]?.durationSeconds ?? 0);
    setIsPlaying(false);
  }

  function handleTimelineSeek(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const targetTotal = Math.max(0, Math.min(totalDuration, totalDuration * pct));
    // Find which shot this falls in
    let shotIdx = 0;
    let accumulated = 0;
    for (let i = 0; i < shotsInScene.length; i++) {
      const dur = shotsInScene[i].durationSeconds;
      if (targetTotal < accumulated + dur) {
        shotIdx = i;
        setElapsedInShot(targetTotal - accumulated);
        break;
      }
      accumulated += dur;
      shotIdx = i;
    }
    setCurrentShotIdx(shotIdx);
  }

  if (!currentShot) {
    return null;
  }

  const currentAsset = cellAssetsByShotId[currentShot.id];
  const currentCellDataUrl = currentAsset?.dataUrl;
  const currentCellVideoUrl = currentAsset?.video?.dataUrl;
  const action =
    (currentShot as any).actionVi?.trim() ||
    (currentShot as any).actionEn?.trim() ||
    currentShot.purpose?.trim() ||
    scene.actionLinesEn?.trim() ||
    "";
  const sceneSettings = scene.settings || "";

  return (
    <div className="ksp-animatic-backdrop" onClick={onClose}>
      <div
        className="ksp-animatic-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="ksp-animatic-topbar">
          <div className="ksp-animatic-topbar-left">
            {currentShotIdx === 0 ? "FADE IN" : `SHOT ${currentShot.order}`}
            {currentCellVideoUrl && (
              <span className="ksp-animatic-video-indicator" title="Playing uploaded video">
                {" "}🎬
              </span>
            )}
          </div>
          <button
            type="button"
            className="ksp-animatic-close-btn"
            onClick={onClose}
            title="Close (Esc)"
          >
            ✕
          </button>
          <div className="ksp-animatic-topbar-right">
            {sceneSettings}
            {totalShots > 0 && <span className="ksp-animatic-shot-id">  S{scene.order}</span>}
          </div>
        </div>

        {/* Main viewport — video if available, else keyframe image */}
        <div className="ksp-animatic-viewport">
          {currentCellVideoUrl ? (
            <video
              key={currentShot.id /* force remount per shot for clean playback */}
              src={currentCellVideoUrl}
              className="ksp-animatic-frame-img"
              autoPlay={isPlaying}
              muted
              playsInline
              // Planning duration is source of truth — pause/loop video at shot.durationSeconds
            />
          ) : currentCellDataUrl ? (
            <img
              src={currentCellDataUrl}
              alt={`Shot ${currentShot.order}`}
              className="ksp-animatic-frame-img"
            />
          ) : (
            <div className="ksp-animatic-empty-card">
              <div className="ksp-animatic-empty-label">EMPTY</div>
              <div className="ksp-animatic-empty-sub">
                Shot {currentShot.order} — chưa có ảnh
              </div>
            </div>
          )}
        </div>

        {/* Caption */}
        <div className="ksp-animatic-caption">
          {action || `${currentShot.titleVi || currentShot.titleEn || `Shot ${currentShot.order}`}`}
        </div>

        {/* Timeline */}
        <div className="ksp-animatic-timeline-row">
          <span className="ksp-animatic-time">{formatTime(elapsedTotal)}</span>
          <div
            className="ksp-animatic-timeline-track"
            onClick={handleTimelineSeek}
          >
            <div
              className="ksp-animatic-timeline-fill"
              style={{ width: `${(elapsedTotal / Math.max(1, totalDuration)) * 100}%` }}
            />
            {/* Shot boundary markers */}
            {cumulativeBefore.slice(1).map((boundary, i) => (
              <div
                key={i}
                className="ksp-animatic-timeline-marker"
                style={{ left: `${(boundary / totalDuration) * 100}%` }}
              />
            ))}
          </div>
          <span className="ksp-animatic-time">{formatTime(totalDuration)}</span>
        </div>

        {/* Controls row */}
        <div className="ksp-animatic-controls">
          <button
            type="button"
            className="ksp-animatic-ctrl-btn"
            onClick={handleStepStart}
            title="Restart"
          >
            ⏮
          </button>
          <button
            type="button"
            className="ksp-animatic-ctrl-btn"
            onClick={handlePrev}
            title="Previous shot (←)"
          >
            ⏪
          </button>
          <button
            type="button"
            className="ksp-animatic-ctrl-btn ksp-animatic-ctrl-play"
            onClick={handlePlayPause}
            title="Play / Pause (Space)"
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
          <button
            type="button"
            className="ksp-animatic-ctrl-btn"
            onClick={handleNext}
            title="Next shot (→)"
          >
            ⏩
          </button>
          <button
            type="button"
            className="ksp-animatic-ctrl-btn"
            onClick={handleStepEnd}
            title="Skip to end"
          >
            ⏭
          </button>

          <div className="ksp-animatic-shot-info">
            <strong>
              {currentShotIdx + 1} / {totalShots}
            </strong>
            <span>{shotTypeLabel(currentShot.shotType)}</span>
            <span>·</span>
            <span>{currentShot.cameraMovement?.replace(/_/g, " ") ?? "static"}</span>
            <span>·</span>
            <span>{currentShot.durationSeconds}s</span>
          </div>

          <div className="ksp-animatic-speed-group">
            {SPEED_OPTIONS.map((speed) => (
              <button
                key={speed}
                type="button"
                className={`ksp-animatic-speed-btn ${
                  speed === playbackSpeed ? "active" : ""
                }`}
                onClick={() => setPlaybackSpeed(speed)}
              >
                {speed}×
              </button>
            ))}
          </div>

          <button
            type="button"
            className="ksp-animatic-ctrl-btn"
            onClick={handleRestart}
            title="Restart playback"
          >
            🔁
          </button>
        </div>

        {/* Thumbnail strip */}
        <div className="ksp-animatic-thumb-strip">
          {shotsInScene.map((shot, idx) => {
            const thumbAsset = cellAssetsByShotId[shot.id];
            const thumbUrl = thumbAsset?.dataUrl;
            const hasVideo = !!thumbAsset?.video?.dataUrl;
            return (
              <button
                key={shot.id}
                type="button"
                className={`ksp-animatic-thumb ${
                  idx === currentShotIdx ? "active" : ""
                }`}
                onClick={() => handleJumpToShot(idx)}
                title={`Shot ${shot.order}: ${shot.titleVi || shot.titleEn || ""}`}
              >
                {thumbUrl ? (
                  <img src={thumbUrl} alt={`Shot ${shot.order}`} />
                ) : (
                  <div className="ksp-animatic-thumb-empty">
                    S{shot.order}
                  </div>
                )}
                <span className="ksp-animatic-thumb-num">S{shot.order}</span>
                {hasVideo && (
                  <span className="ksp-animatic-thumb-video-marker" title="Has video">▶</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
