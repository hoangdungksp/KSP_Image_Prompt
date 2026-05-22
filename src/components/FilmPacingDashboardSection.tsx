/**
 * KSP Image Sprint 1.0 r2 — Film Pacing Dashboard Section (Phase 2A basic)
 *
 * Pipeline position: SCRIPT → PACING → SHOT LIST → STORYBOARD
 *
 * READ-ONLY dashboard that visualizes the per-scene pacing annotations
 * created in Phase 1A (tensionLevel + emotionalTone). Phase 2A ships:
 *   - Single-line tension curve (SVG line chart, X = scenes, Y = 0-10)
 *   - Emotion strip (color blocks per scene)
 *   - Beat coverage list (framework beats → which scene covers them + tension)
 *   - Anomaly hint banner (flat midpoint detector)
 *
 * Phase 2A is intentionally a STATIC view. Drag-to-rewrite lands in Sprint D.
 * AI Director auto-apply lands in Sprint C. Multi-character curve overlay +
 * setup-payoff arc land in Sprint E (may defer).
 *
 * Empty states:
 *   - No script yet → "Sinh script trước ở phần ② để xem nhịp phim"
 *   - Script exists but no scenes annotated → suggest pressing "🎭 Re-annotate"
 *   - Script + annotations both exist → render dashboard
 */

import React, { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import {
  ensureFilmData,
  setScript,
  applyAiDirectorChanges,
  revertSceneAiDirector,
  revertScriptToVersion,
  applyDragRewrite,
  applyCharacterEmotions,
  setSetupPayoffPairs,
  removeSetupPayoffPair,
  updateSceneInScript,
} from "../store/film_actions";
import {
  EMOTIONAL_TONE_LABELS,
  SETUP_PAYOFF_TYPE_LABELS,
  clampTension,
  getTensionColor,
  validateEmotionTension,
  autoFixEmotionTension,
  EMOTION_TENSION_VALID_RANGE,
  type EmotionalTone,
  type SetupPayoffPair,
} from "../types/project";
import {
  FRAMEWORK_LABELS,
  type FilmScriptBeat,
} from "../types/film";
import {
  runAiDirector,
  runDragRewriteSuggest,
  runReannotateCharacterEmotions,
  runSetupPayoffDetect,
  type AiDirectorResult,
  type AiDirectorSceneChange,
  type DragRewriteSuggestion,
  type SetupPayoffDetectResult,
  type FilmScriptProvider,
} from "../engine/filmScriptStages";

// ============================================================================
// MAIN SECTION
// ============================================================================

export function FilmPacingDashboardSection() {
  const project = useAppStore((s) => s.currentProject);
  const updateProject = useAppStore((s) => s.updateCurrentProject);
  const showToast = useAppStore((s) => s.showToast);

  // Sprint 1.0 r4 — drag rewrite modal state
  const [dragRewrite, setDragRewrite] = useState<{
    status: "loading" | "ready" | "error";
    sceneId: string;
    suggestion?: DragRewriteSuggestion;
    error?: string;
  } | null>(null);

  if (!project) return null;
  const film = ensureFilmData(project);
  const setting = (project as any).settingV2 as
    | import("../types/project").ProjectSettingV2
    | undefined;

  // Only render in Film mode
  if (setting?.mode !== "film") return null;

  const scenes = film.script?.scenes ?? [];
  const hasScript = scenes.length > 0;
  const annotatedCount = scenes.filter(
    (s) => typeof s.tensionLevel === "number" || s.emotionalTone !== undefined
  ).length;
  const isAnnotated = annotatedCount > 0;

  // Drag handler — called when user releases drag on a curve point
  async function handleDragRelease(sceneId: string, newTension: number) {
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene) return;
    setDragRewrite({ status: "loading", sceneId });
    try {
      const provider = (film.scriptProvider ?? "gemini-flash") as FilmScriptProvider;
      const suggestion = await runDragRewriteSuggest({
        scene,
        newTension,
        provider,
      });
      setDragRewrite({ status: "ready", sceneId, suggestion });
    } catch (err) {
      setDragRewrite({ status: "error", sceneId, error: (err as Error).message });
    }
  }

  function handleApplyRewrite() {
    if (!dragRewrite?.suggestion || !film.script) return;
    // Snapshot script BEFORE applying (undo via revertScriptToVersion)
    updateProject((p) => setScript(p, film.script!));
    // Then apply
    updateProject((p) =>
      applyDragRewrite(p, dragRewrite.suggestion!.sceneId, {
        newTension: dragRewrite.suggestion!.newTension,
        newEmotion: dragRewrite.suggestion!.newEmotion,
        newDurationSeconds: dragRewrite.suggestion!.newDurationSeconds,
        newActionLinesVi: dragRewrite.suggestion!.newActionLinesVi,
        newActionLinesEn: dragRewrite.suggestion!.newActionLinesEn,
      })
    );
    showToast(`Đã rewrite cảnh ${scenes.find((s) => s.id === dragRewrite.sceneId)?.order ?? "?"}`, "success");
    setDragRewrite(null);
  }

  function handleCloseRewrite() {
    setDragRewrite(null);
  }

  return (
    <section className="ksp-section-v09 ksp-pacing-dashboard-section">
      <header className="ksp-pacing-dashboard-header">
        <span className="ksp-pacing-dashboard-num">⑥</span>
        <h2 className="ksp-pacing-dashboard-title">PACING DASHBOARD</h2>
        <span className="ksp-pacing-dashboard-subtitle">
          {hasScript
            ? `${scenes.length} scenes · ${annotatedCount} annotated`
            : "chưa có script"}
        </span>
      </header>

      {!hasScript && (
        <div className="ksp-pacing-dashboard-empty">
          <p>Sinh script ở phần ② trước, sau đó dashboard này sẽ hiển thị curve nhịp phim.</p>
        </div>
      )}

      {hasScript && !isAnnotated && (
        <div className="ksp-pacing-dashboard-empty">
          <p>
            Chưa có scene nào được annotate. Vào phần ② Script và click nút{" "}
            <strong>🎭 Re-annotate</strong> để AI fill tension + cảm xúc cho tất cả scenes.
          </p>
        </div>
      )}

      {hasScript && isAnnotated && (
        <div className="ksp-pacing-dashboard-body">
          <AiDirectorPanel scenes={scenes} film={film} setting={setting} />
          {/* Sprint G1e0: validate emotion ↔ tension combos across scenes,
              surface warnings with 1-click auto-fix. */}
          <EmotionTensionWarningPanel
            scenes={scenes}
            onAutoFixAll={() => {
              updateProject((p) => {
                let patched = p;
                for (const s of scenes) {
                  const result = validateEmotionTension(s.emotionalTone, s.tensionLevel);
                  if (!result.valid) {
                    const updatePatch = updateSceneInScript(patched, s.id, {
                      tensionLevel: result.suggestedTension,
                    });
                    patched = { ...patched, ...updatePatch };
                  }
                }
                return patched;
              });
              showToast("Đã auto-fix emotion/tension mismatch", "success");
            }}
            onFixOne={(sceneId, newTension) => {
              updateProject((p) =>
                updateSceneInScript(p, sceneId, { tensionLevel: newTension })
              );
              showToast(`Đã fix scene tension → ${newTension}`, "success");
            }}
          />
          <TensionCurve scenes={scenes} onDragRelease={handleDragRelease} />
          <EmotionStrip scenes={scenes} />
          <MultiCharacterCurve scenes={scenes} film={film} />
          <BeatCoverage scenes={scenes} beats={film.scriptBeats ?? []} framework={film.scriptStructure?.framework} />
          <SetupPayoffPanel scenes={scenes} film={film} />
          <AnomalyHints scenes={scenes} />
          <p className="ksp-pacing-dashboard-footer-hint">
            ⓘ Dashboard này hiển thị nhịp phim. Kéo điểm trên curve để AI rewrite cảnh tương ứng.
          </p>
        </div>
      )}

      {dragRewrite && (
        <DragRewriteModal
          state={dragRewrite}
          scene={scenes.find((s) => s.id === dragRewrite.sceneId)}
          onApply={handleApplyRewrite}
          onClose={handleCloseRewrite}
        />
      )}
    </section>
  );
}

// ============================================================================
// TENSION CURVE (single-line SVG chart)
// ============================================================================

function TensionCurve({
  scenes,
  onDragRelease,
}: {
  scenes: Array<{
    id: string;
    order: number;
    tensionLevel?: number;
    titleVi?: string;
    titleEn: string;
  }>;
  /**
   * Called when user releases drag — passes scene id + new tension value.
   * If undefined, curve renders static (no drag handlers).
   */
  onDragRelease?: (sceneId: string, newTension: number) => void;
}) {
  const W = 320;
  const H = 130;
  const PAD_L = 22;
  const PAD_R = 12;
  const PAD_T = 14;
  const PAD_B = 22;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const svgRef = React.useRef<SVGSVGElement>(null);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [dragTension, setDragTension] = React.useState<number | null>(null);

  const n = scenes.length;
  if (n === 0) return null;

  // X positions: evenly spaced (handle n=1 edge case)
  const xs = scenes.map((_, i) =>
    n === 1 ? PAD_L + innerW / 2 : PAD_L + (i * innerW) / (n - 1)
  );
  // Y from tension 0 (bottom) to 10 (top)
  // If a scene is currently being dragged, use dragTension for its Y
  const ys = scenes.map((s) => {
    const t = draggingId === s.id && dragTension !== null ? dragTension : clampTension(s.tensionLevel);
    return PAD_T + innerH - (t / 10) * innerH;
  });

  // Detect peak index (highest tension, considering drag state)
  let peakIdx = 0;
  let peakVal = scenes[0].id === draggingId && dragTension !== null ? dragTension : clampTension(scenes[0].tensionLevel);
  scenes.forEach((s, i) => {
    const t = s.id === draggingId && dragTension !== null ? dragTension : clampTension(s.tensionLevel);
    if (t > peakVal) {
      peakIdx = i;
      peakVal = t;
    }
  });

  const polylinePoints = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");

  // Original polyline (ghost line shown during drag for reference)
  const ghostYs = scenes.map((s) => {
    const t = clampTension(s.tensionLevel);
    return PAD_T + innerH - (t / 10) * innerH;
  });
  const ghostPoints = xs.map((x, i) => `${x.toFixed(1)},${ghostYs[i].toFixed(1)}`).join(" ");

  // Helper: convert clientY to tension value
  function clientYToTension(clientY: number): number {
    if (!svgRef.current) return 0;
    const rect = svgRef.current.getBoundingClientRect();
    // svg viewBox height is H; client → svg coord
    const svgY = ((clientY - rect.top) / rect.height) * H;
    // tension scale: svgY = PAD_T → t=10 ; svgY = PAD_T + innerH → t=0
    const t = ((PAD_T + innerH - svgY) / innerH) * 10;
    return clampTension(t);
  }

  // Drag handlers (mouse + touch)
  React.useEffect(() => {
    if (!draggingId) return;
    function onMove(e: MouseEvent | TouchEvent) {
      const clientY =
        "touches" in e && e.touches.length > 0 ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const newT = clientYToTension(clientY);
      setDragTension(newT);
      // Prevent page scrolling on touch
      if ("touches" in e && e.cancelable) e.preventDefault();
    }
    function onUp() {
      // Capture final values BEFORE clearing state (React batched updates would otherwise clear them)
      const finalId = draggingId;
      const finalT = dragTension;
      setDraggingId(null);
      setDragTension(null);
      if (finalId && finalT !== null && onDragRelease) {
        const scene = scenes.find((s) => s.id === finalId);
        const oldT = scene ? clampTension(scene.tensionLevel) : 0;
        // Only trigger if changed by ≥1 unit
        if (Math.abs(finalT - oldT) >= 1) {
          onDragRelease(finalId, finalT);
        }
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
    };
  }, [draggingId, dragTension, onDragRelease, scenes]);

  function handlePointDown(sceneId: string, e: React.MouseEvent | React.TouchEvent) {
    if (!onDragRelease) return; // drag disabled if no handler
    e.preventDefault();
    setDraggingId(sceneId);
    // Initialize dragTension to current value so display doesn't jump
    const scene = scenes.find((s) => s.id === sceneId);
    if (scene) setDragTension(clampTension(scene.tensionLevel));
  }

  return (
    <div className="ksp-pacing-block">
      <h3 className="ksp-pacing-block-title">
        Đường cong căng (tension curve)
        {onDragRelease && (
          <span className="ksp-pacing-curve-drag-hint">
            {" "}
            · kéo điểm để chỉnh nhịp
          </span>
        )}
      </h3>
      <svg
        ref={svgRef}
        className={`ksp-pacing-curve-svg${draggingId ? " ksp-pacing-curve-svg-dragging" : ""}`}
        viewBox={`0 0 ${W} ${H}`}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Tension curve across scenes"
      >
        {/* Y-axis grid lines + labels */}
        {[0, 5, 10].map((tick) => {
          const y = PAD_T + innerH - (tick / 10) * innerH;
          return (
            <g key={tick}>
              <line
                x1={PAD_L}
                y1={y}
                x2={W - PAD_R}
                y2={y}
                stroke="#3a3a3a"
                strokeWidth="0.5"
                strokeDasharray={tick === 0 ? "" : "2 3"}
              />
              <text x={4} y={y + 3} fontSize="9" fill="#888780">
                {tick}
              </text>
            </g>
          );
        })}

        {/* Ghost polyline showing original positions during drag */}
        {draggingId && (
          <polyline
            points={ghostPoints}
            fill="none"
            stroke="#534AB7"
            strokeWidth="1"
            strokeDasharray="3 3"
            opacity="0.5"
          />
        )}

        {/* Live (or static) tension polyline */}
        <polyline
          points={polylinePoints}
          fill="none"
          stroke={draggingId ? "#D85A30" : "#D85A30"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points — interactive when onDragRelease provided */}
        {xs.map((x, i) => {
          const isPeak = i === peakIdx;
          const isDragging = scenes[i].id === draggingId;
          const r = isDragging ? 7 : isPeak ? 5 : 4;
          return (
            <g key={scenes[i].id}>
              {/* Larger invisible hit target for easier mobile tap */}
              {onDragRelease && (
                <circle
                  cx={x}
                  cy={ys[i]}
                  r={11}
                  fill="transparent"
                  style={{ cursor: isDragging ? "grabbing" : "grab", touchAction: "none" }}
                  onMouseDown={(e) => handlePointDown(scenes[i].id, e)}
                  onTouchStart={(e) => handlePointDown(scenes[i].id, e)}
                />
              )}
              <circle
                cx={x}
                cy={ys[i]}
                r={r}
                fill={isDragging ? "#fff" : "#D85A30"}
                stroke={isDragging ? "#D85A30" : "#1f1f1f"}
                strokeWidth={isDragging ? 2 : isPeak ? 1.5 : 0}
                style={{ pointerEvents: "none" }}
              >
                <title>
                  {`Scene ${scenes[i].order} (${scenes[i].titleVi || scenes[i].titleEn}) — tension ${clampTension(
                    isDragging && dragTension !== null ? dragTension : scenes[i].tensionLevel
                  )}/10`}
                </title>
              </circle>
              {/* Tension number above dragged point */}
              {isDragging && dragTension !== null && (
                <text
                  x={x}
                  y={ys[i] - 11}
                  fontSize="11"
                  fill="#D85A30"
                  fontWeight="600"
                  textAnchor="middle"
                  style={{ pointerEvents: "none" }}
                >
                  {clampTension(dragTension)}
                </text>
              )}
            </g>
          );
        })}

        {/* X-axis scene labels */}
        {xs.map((x, i) => (
          <text
            key={i}
            x={x}
            y={H - 6}
            fontSize="9"
            fill="#888780"
            textAnchor="middle"
          >
            S{scenes[i].order}
          </text>
        ))}
      </svg>
      <div className="ksp-pacing-curve-legend">
        <span>peak: cảnh {scenes[peakIdx].order} ({peakVal}/10)</span>
      </div>
    </div>
  );
}

// ============================================================================
// EMOTION STRIP (color blocks per scene)
// ============================================================================

function EmotionStrip({
  scenes,
}: {
  scenes: Array<{
    id: string;
    order: number;
    emotionalTone?: EmotionalTone;
    titleVi?: string;
    titleEn: string;
  }>;
}) {
  return (
    <div className="ksp-pacing-block">
      <h3 className="ksp-pacing-block-title">Dải cảm xúc (emotion strip)</h3>
      <div className="ksp-pacing-strip">
        {scenes.map((s) => {
          const tone = s.emotionalTone ?? "neutral";
          const info = EMOTIONAL_TONE_LABELS[tone];
          return (
            <div
              key={s.id}
              className="ksp-pacing-strip-block"
              style={{ background: info.bg, color: info.color }}
              title={`Scene ${s.order} — ${info.vi}`}
            >
              <span className="ksp-pacing-strip-emoji">{info.emoji}</span>
              <span className="ksp-pacing-strip-label">{info.vi}</span>
            </div>
          );
        })}
      </div>
      <div className="ksp-pacing-strip-axis">
        {scenes.map((s) => (
          <span key={s.id} className="ksp-pacing-strip-axis-tick">
            S{s.order}
          </span>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// BEAT COVERAGE (framework beats → which scene covers them)
// ============================================================================

function BeatCoverage({
  scenes,
  beats,
  framework,
}: {
  scenes: Array<{
    id: string;
    order: number;
    tensionLevel?: number;
    titleVi?: string;
    titleEn: string;
    shotIds?: string[];
  }>;
  beats: FilmScriptBeat[];
  framework?: import("../types/film").FilmStoryFramework;
}) {
  if (beats.length === 0) {
    return (
      <div className="ksp-pacing-block">
        <h3 className="ksp-pacing-block-title">Beat coverage</h3>
        <p className="ksp-pacing-beat-empty">
          Chưa có beats. Multi-stage wizard chưa được dùng ở project này (Quick path skip Stage 2).
        </p>
      </div>
    );
  }

  // For each beat, find which scene's beatIds includes it
  // FilmSceneScript doesn't carry beatIds (those live in FilmScriptIntermediateScene),
  // so we approximate by linear position match: beat N of M → scene floor(N/M * scenes.length)
  // This is the same heuristic Stage 5 uses when copying from intermediate.

  const beatToScene = new Map<string, typeof scenes[0]>();
  for (let i = 0; i < beats.length; i++) {
    const sceneIdx = Math.min(scenes.length - 1, Math.floor((i / Math.max(1, beats.length - 1)) * (scenes.length - 1)));
    beatToScene.set(beats[i].id, scenes[sceneIdx]);
  }

  const frameworkLabel = framework ? FRAMEWORK_LABELS[framework].name : "—";

  return (
    <div className="ksp-pacing-block">
      <h3 className="ksp-pacing-block-title">Beat coverage — {frameworkLabel}</h3>
      <ol className="ksp-pacing-beat-list">
        {beats.map((b) => {
          const scene = beatToScene.get(b.id);
          const t = clampTension(scene?.tensionLevel);
          const colors = getTensionColor(t);
          return (
            <li key={b.id} className="ksp-pacing-beat-row">
              <span className="ksp-pacing-beat-order">{b.order}.</span>
              <span className="ksp-pacing-beat-title">{b.title}</span>
              <span className="ksp-pacing-beat-scene">
                {scene ? `S${scene.order}` : "—"}
              </span>
              <span
                className="ksp-pacing-beat-tension"
                style={{ background: colors.bg, color: colors.color }}
                title={`Tension ${t}/10`}
              >
                {t}/10
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ============================================================================
// ANOMALY HINTS (flat midpoint detection — Phase 2A simplest)
// ============================================================================

function AnomalyHints({
  scenes,
}: {
  scenes: Array<{
    id: string;
    order: number;
    tensionLevel?: number;
  }>;
}) {
  const hints: string[] = [];
  const n = scenes.length;

  // 1. Flat midpoint: middle 30% of scenes all have tension < 5
  if (n >= 4) {
    const midStart = Math.floor(n * 0.35);
    const midEnd = Math.ceil(n * 0.65);
    const middleScenes = scenes.slice(midStart, midEnd);
    if (middleScenes.length > 0 && middleScenes.every((s) => clampTension(s.tensionLevel) < 5)) {
      hints.push(
        `Midpoint chùng — các cảnh ${scenes[midStart].order}-${scenes[midEnd - 1].order} đều dưới 5/10. Phim hay thường có peak phụ ở giữa để giữ nhịp.`
      );
    }
  }

  // 2. No peak: max tension < 7
  const maxT = Math.max(...scenes.map((s) => clampTension(s.tensionLevel)));
  if (maxT < 7) {
    hints.push(
      `Chưa có peak cao trào — max tension chỉ ${maxT}/10. Climax thường đạt ≥7/10 để audience nhớ ấn tượng cuối.`
    );
  }

  // 3. Early peak: highest tension in first half (climax should be 70%+ position)
  if (n >= 4) {
    let peakIdx = 0;
    let peakVal = 0;
    scenes.forEach((s, i) => {
      const t = clampTension(s.tensionLevel);
      if (t > peakVal) {
        peakIdx = i;
        peakVal = t;
      }
    });
    if (peakIdx < Math.floor(n * 0.5) && peakVal >= 7) {
      hints.push(
        `Peak quá sớm — cao trào ở cảnh ${scenes[peakIdx].order} (${peakVal}/10) nằm trong nửa đầu phim. Climax thông thường đặt 70%+ tổng phim.`
      );
    }
  }

  if (hints.length === 0) {
    return (
      <div className="ksp-pacing-anomaly ksp-pacing-anomaly-ok">
        <span>✓ Curve nhịp phim ổn — không phát hiện điểm bất thường.</span>
      </div>
    );
  }

  return (
    <div className="ksp-pacing-anomaly ksp-pacing-anomaly-warn">
      <strong>⚠ Phát hiện {hints.length} điểm cần chú ý:</strong>
      <ul>
        {hints.map((h, i) => (
          <li key={i}>{h}</li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================================
// AI DIRECTOR PANEL (Sprint 1.0 r3 — auto-apply pacing adjustments)
// ============================================================================

type DirectorStatus = "idle" | "scanning" | "applied";

function AiDirectorPanel({
  scenes,
  film,
  setting,
}: {
  scenes: Array<{
    id: string;
    order: number;
    titleVi?: string;
    titleEn: string;
    actionLinesVi?: string;
    actionLinesEn: string;
    durationSeconds: number;
    tensionLevel?: number;
    emotionalTone?: EmotionalTone;
  }>;
  film: import("../types/film").FilmData;
  setting: import("../types/project").ProjectSettingV2 | undefined;
}) {
  const updateProject = useAppStore((s) => s.updateCurrentProject);
  const project = useAppStore((s) => s.currentProject);
  const showToast = useAppStore((s) => s.showToast);

  const [status, setStatus] = useState<DirectorStatus>("idle");
  const [result, setResult] = useState<AiDirectorResult | null>(null);
  const [reviewSceneId, setReviewSceneId] = useState<string | null>(null);
  /** Snapshot of pre-apply scene pacing for per-scene undo. */
  const [snapshot, setSnapshot] = useState<Map<string, AiDirectorSceneChange["before"]>>(new Map());

  async function handleRun() {
    if (!project || !film.script) return;
    setStatus("scanning");
    setReviewSceneId(null);
    try {
      const provider = (film.scriptProvider ?? "gemini-flash") as FilmScriptProvider;
      const out = await runAiDirector({
        scenes,
        targetDurationMinutes: setting?.durationMinutes,
        framework: film.scriptStructure?.framework,
        provider,
      });

      if (out.changes.length === 0) {
        setResult(out);
        setStatus("idle");
        showToast("AI Director: nhịp phim đã ổn — không cần chỉnh", "success");
        return;
      }

      // Snapshot before applying (for per-scene undo)
      const snap = new Map<string, AiDirectorSceneChange["before"]>();
      out.changes.forEach((c) => snap.set(c.sceneId, c.before));
      setSnapshot(snap);

      // Archive current script (for "Undo all" via revertScriptToVersion)
      if (film.script) {
        updateProject((p) => setScript(p, film.script!));
      }

      // Apply all changes
      updateProject((p) =>
        applyAiDirectorChanges(
          p,
          out.changes.map((c) => ({
            sceneId: c.sceneId,
            after: c.after,
          }))
        )
      );

      setResult(out);
      setStatus("applied");
      showToast(`AI Director: áp dụng ${out.changes.length} chỉnh`, "success");
    } catch (err) {
      setStatus("idle");
      showToast(`AI Director lỗi: ${(err as Error).message}`, "error");
    }
  }

  function handleUndoAll() {
    if (!film.script || !film.script.versions || film.script.versions.length === 0) {
      showToast("Không có version để revert", "error");
      return;
    }
    // Latest version (index 0) is the snapshot we archived right before applying
    updateProject((p) => revertScriptToVersion(p, 0));
    setStatus("idle");
    setResult(null);
    setReviewSceneId(null);
    showToast("Đã undo tất cả thay đổi AI Director", "success");
  }

  function handleUndoScene(sceneId: string) {
    const before = snapshot.get(sceneId);
    if (!before) {
      showToast("Không có snapshot cho cảnh này", "error");
      return;
    }
    updateProject((p) => revertSceneAiDirector(p, sceneId, before));
    showToast(`Đã undo cảnh ${reviewSceneId ?? sceneId}`, "success");
    // Remove from result so it disappears from review tabs
    if (result) {
      const newChanges = result.changes.filter((c) => c.sceneId !== sceneId);
      setResult({ ...result, changes: newChanges });
      if (newChanges.length === 0) {
        setStatus("idle");
        setReviewSceneId(null);
      } else if (reviewSceneId === sceneId) {
        setReviewSceneId(newChanges[0].sceneId);
      }
    }
  }

  function handleKeep() {
    setStatus("idle");
    setResult(null);
    setReviewSceneId(null);
    showToast("Giữ thay đổi của AI Director", "success");
  }

  // --- Render states ---

  if (status === "scanning") {
    return (
      <div className="ksp-pacing-block ksp-ai-director-panel">
        <div className="ksp-ai-director-header">
          <span className="ksp-ai-director-spark">✨</span>
          <span className="ksp-ai-director-header-text">AI Director đang phân tích...</span>
        </div>
        <div className="ksp-ai-director-progress">
          <div className="ksp-ai-director-progress-fill" />
        </div>
        <ul className="ksp-ai-director-tasks">
          <li className="ksp-ai-director-task ok">✓ Đọc {scenes.length} scenes</li>
          <li className="ksp-ai-director-task ok">✓ So sánh curve với lý thuyết pacing</li>
          <li className="ksp-ai-director-task load">⏳ Đề xuất tension + cảm xúc + duration</li>
          <li className="ksp-ai-director-task wait">○ Check tổng phim duration target</li>
        </ul>
      </div>
    );
  }

  if (status === "applied" && result) {
    const stats = {
      sceneCount: result.changes.length,
      tensionChanges: result.changes.filter((c) => c.fieldsChanged.includes("tension")).length,
      emotionChanges: result.changes.filter((c) => c.fieldsChanged.includes("emotion")).length,
      durationChanges: result.changes.filter((c) => c.fieldsChanged.includes("duration")).length,
    };
    const currentReviewChange = reviewSceneId
      ? result.changes.find((c) => c.sceneId === reviewSceneId)
      : null;
    const overTarget = setting?.durationMinutes
      ? result.totalDurationAfter - setting.durationMinutes * 60
      : 0;

    return (
      <div className="ksp-pacing-block ksp-ai-director-panel ksp-ai-director-applied">
        <div className="ksp-ai-director-report-header">
          <span className="ksp-ai-director-check">✓</span>
          <span className="ksp-ai-director-report-title">
            AI Director đã áp dụng {stats.sceneCount} chỉnh
          </span>
        </div>

        <div className="ksp-ai-director-stat-grid">
          <div className="ksp-ai-director-stat">
            <div className="ksp-ai-director-stat-n">{stats.sceneCount}</div>
            <div className="ksp-ai-director-stat-l">cảnh sửa</div>
          </div>
          <div className="ksp-ai-director-stat">
            <div className="ksp-ai-director-stat-n">{stats.tensionChanges}</div>
            <div className="ksp-ai-director-stat-l">tension</div>
          </div>
          <div className="ksp-ai-director-stat">
            <div className="ksp-ai-director-stat-n">{stats.emotionChanges}</div>
            <div className="ksp-ai-director-stat-l">cảm xúc</div>
          </div>
          <div className="ksp-ai-director-stat">
            <div className="ksp-ai-director-stat-n">{stats.durationChanges}</div>
            <div className="ksp-ai-director-stat-l">duration</div>
          </div>
        </div>

        {result.summaryVi && (
          <p className="ksp-ai-director-summary">{result.summaryVi}</p>
        )}

        {Math.abs(overTarget) > 30 && (
          <div className="ksp-ai-director-duration-warn">
            ⚠ Tổng phim {result.totalDurationAfter}s {overTarget > 0 ? "vượt" : "thiếu"}{" "}
            {Math.abs(overTarget)}s so với target {setting?.durationMinutes ?? "?"} phút.
          </div>
        )}

        {(result.strengthsVi.length > 0 || result.weaknessesVi.length > 0) && (
          <div className="ksp-ai-director-review-grp-stack">
            {result.strengthsVi.length > 0 && (
              <div className="ksp-ai-director-review-grp ok">
                <div className="ksp-ai-director-review-head">✓ Điểm mạnh</div>
                {result.strengthsVi.map((s, i) => (
                  <div key={i} className="ksp-ai-director-review-item">
                    {s}
                  </div>
                ))}
              </div>
            )}
            {result.weaknessesVi.length > 0 && (
              <div className="ksp-ai-director-review-grp warn">
                <div className="ksp-ai-director-review-head">⚠ Lo ngại</div>
                {result.weaknessesVi.map((s, i) => (
                  <div key={i} className="ksp-ai-director-review-item">
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Per-scene review tabs */}
        <div className="ksp-ai-director-tabs-wrap">
          <div className="ksp-ai-director-tabs-label">Review từng cảnh:</div>
          <div className="ksp-ai-director-tabs">
            {result.changes.map((c) => (
              <button
                key={c.sceneId}
                type="button"
                className="ksp-ai-director-tab"
                data-active={reviewSceneId === c.sceneId}
                onClick={() =>
                  setReviewSceneId(reviewSceneId === c.sceneId ? null : c.sceneId)
                }
              >
                S{c.sceneOrder} ✏
              </button>
            ))}
          </div>
        </div>

        {currentReviewChange && (
          <AiDirectorSceneDiff
            change={currentReviewChange}
            onUndo={() => handleUndoScene(currentReviewChange.sceneId)}
          />
        )}

        <div className="ksp-ai-director-actions">
          <button
            type="button"
            className="ksp-ai-director-btn ksp-ai-director-btn-ghost"
            onClick={handleUndoAll}
            title="Revert toàn bộ script về snapshot trước khi AI Director chạy"
          >
            ↶ Undo all
          </button>
          <button
            type="button"
            className="ksp-ai-director-btn ksp-ai-director-btn-primary"
            onClick={handleKeep}
          >
            ✓ Giữ
          </button>
        </div>
      </div>
    );
  }

  // status === "idle"
  return (
    <div className="ksp-pacing-block ksp-ai-director-panel">
      <button
        type="button"
        className="ksp-ai-director-hero"
        onClick={handleRun}
        disabled={!film.script}
      >
        <span className="ksp-ai-director-hero-icon">🎬</span>
        <span className="ksp-ai-director-hero-text">
          <span className="ksp-ai-director-hero-title">AI Director · tự động chỉnh nhịp</span>
          <span className="ksp-ai-director-hero-sub">
            Phân tích toàn phim và áp dụng các chỉnh tốt nhất theo lý thuyết pacing chuyên nghiệp.
            Mặc định áp dụng ngay — anh review/undo sau.
          </span>
        </span>
        <span className="ksp-ai-director-hero-chev">→</span>
      </button>
      {result && result.changes.length === 0 && (
        <div className="ksp-ai-director-noop">
          ✓ AI Director vừa chạy: nhịp phim đã ổn, không cần chỉnh.
        </div>
      )}
    </div>
  );
}

// --- Per-scene diff sub-component ---------------------------------------

function AiDirectorSceneDiff({
  change,
  onUndo,
}: {
  change: AiDirectorSceneChange;
  onUndo: () => void;
}) {
  const beforeT = clampTension(change.before.tensionLevel);
  const afterT = clampTension(change.after.tensionLevel);
  const beforeE = change.before.emotionalTone ?? "neutral";
  const afterE = change.after.emotionalTone;
  const beforeD = change.before.durationSeconds;
  const afterD = change.after.durationSeconds;

  return (
    <div className="ksp-ai-director-diff">
      <div className="ksp-ai-director-diff-rationale">💡 {change.rationaleVi}</div>
      <div className="ksp-ai-director-diff-rows">
        {change.fieldsChanged.includes("tension") && (
          <div className="ksp-ai-director-diff-row">
            <span className="ksp-ai-director-diff-label">tension:</span>
            <span className="ksp-ai-director-diff-before">{beforeT}/10</span>
            <span className="ksp-ai-director-diff-arrow">→</span>
            <span className="ksp-ai-director-diff-after">{afterT}/10</span>
          </div>
        )}
        {change.fieldsChanged.includes("emotion") && (
          <div className="ksp-ai-director-diff-row">
            <span className="ksp-ai-director-diff-label">cảm xúc:</span>
            <span className="ksp-ai-director-diff-before">
              {EMOTIONAL_TONE_LABELS[beforeE].emoji} {EMOTIONAL_TONE_LABELS[beforeE].vi}
            </span>
            <span className="ksp-ai-director-diff-arrow">→</span>
            <span className="ksp-ai-director-diff-after">
              {EMOTIONAL_TONE_LABELS[afterE].emoji} {EMOTIONAL_TONE_LABELS[afterE].vi}
            </span>
          </div>
        )}
        {change.fieldsChanged.includes("duration") && (
          <div className="ksp-ai-director-diff-row">
            <span className="ksp-ai-director-diff-label">duration:</span>
            <span className="ksp-ai-director-diff-before">{beforeD}s</span>
            <span className="ksp-ai-director-diff-arrow">→</span>
            <span className="ksp-ai-director-diff-after">{afterD}s</span>
          </div>
        )}
      </div>
      <div className="ksp-ai-director-diff-actions">
        <button
          type="button"
          className="ksp-ai-director-btn ksp-ai-director-btn-ghost ksp-ai-director-btn-sm"
          onClick={onUndo}
        >
          ↶ Undo cảnh này
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// DRAG REWRITE MODAL (Sprint 1.0 r4 — preview-first because destructive)
// ============================================================================

function DragRewriteModal({
  state,
  scene,
  onApply,
  onClose,
}: {
  state: {
    status: "loading" | "ready" | "error";
    sceneId: string;
    suggestion?: DragRewriteSuggestion;
    error?: string;
  };
  scene?: {
    id: string;
    order: number;
    titleVi?: string;
    titleEn: string;
  };
  onApply: () => void;
  onClose: () => void;
}) {
  return (
    <div className="ksp-drag-rewrite-backdrop" onClick={onClose}>
      <div
        className="ksp-drag-rewrite-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="AI rewrite suggestion"
      >
        <header className="ksp-drag-rewrite-header">
          <span className="ksp-drag-rewrite-sparkle">✨</span>
          <h3 className="ksp-drag-rewrite-title">
            AI rewrite — Cảnh {scene?.order ?? "?"}
          </h3>
          <button
            type="button"
            className="ksp-drag-rewrite-close"
            onClick={onClose}
            aria-label="Đóng"
          >
            ×
          </button>
        </header>

        {state.status === "loading" && (
          <div className="ksp-drag-rewrite-loading">
            <div className="ksp-drag-rewrite-spinner" />
            <p>AI đang đề xuất rewrite cho tension mới...</p>
          </div>
        )}

        {state.status === "error" && (
          <div className="ksp-drag-rewrite-error">
            <p>❌ Lỗi AI: {state.error}</p>
            <button
              type="button"
              className="ksp-drag-rewrite-btn ksp-drag-rewrite-btn-ghost"
              onClick={onClose}
            >
              Đóng
            </button>
          </div>
        )}

        {state.status === "ready" && state.suggestion && (
          <DragRewritePreview suggestion={state.suggestion} scene={scene} onApply={onApply} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

function DragRewritePreview({
  suggestion,
  scene,
  onApply,
  onClose,
}: {
  suggestion: DragRewriteSuggestion;
  scene?: { order: number; titleVi?: string; titleEn: string };
  onApply: () => void;
  onClose: () => void;
}) {
  const beforeT = clampTension(suggestion.before.tensionLevel);
  const afterT = clampTension(suggestion.newTension);
  const beforeE = suggestion.before.emotionalTone ?? "neutral";
  const afterE = suggestion.newEmotion;
  const beforeD = suggestion.before.durationSeconds;
  const afterD = suggestion.newDurationSeconds;
  const beforeAction = suggestion.before.actionLinesVi || suggestion.before.actionLinesEn;
  const afterAction = suggestion.newActionLinesVi || suggestion.newActionLinesEn;

  return (
    <div className="ksp-drag-rewrite-preview">
      <p className="ksp-drag-rewrite-rationale">
        💡 <strong>Lý do:</strong> {suggestion.rationaleVi}
      </p>

      {/* Metadata diff row */}
      <div className="ksp-drag-rewrite-meta-row">
        <div className="ksp-drag-rewrite-meta-cell">
          <div className="ksp-drag-rewrite-meta-label">tension</div>
          <div className="ksp-drag-rewrite-meta-diff">
            <span className="ksp-drag-rewrite-meta-before">{beforeT}/10</span>
            <span className="ksp-drag-rewrite-meta-arrow">→</span>
            <span className="ksp-drag-rewrite-meta-after">{afterT}/10</span>
          </div>
        </div>
        <div className="ksp-drag-rewrite-meta-cell">
          <div className="ksp-drag-rewrite-meta-label">cảm xúc</div>
          <div className="ksp-drag-rewrite-meta-diff">
            <span className="ksp-drag-rewrite-meta-before">{EMOTIONAL_TONE_LABELS[beforeE].emoji}</span>
            <span className="ksp-drag-rewrite-meta-arrow">→</span>
            <span className="ksp-drag-rewrite-meta-after">
              {EMOTIONAL_TONE_LABELS[afterE].emoji} {EMOTIONAL_TONE_LABELS[afterE].vi}
            </span>
          </div>
        </div>
        <div className="ksp-drag-rewrite-meta-cell">
          <div className="ksp-drag-rewrite-meta-label">duration</div>
          <div className="ksp-drag-rewrite-meta-diff">
            <span className="ksp-drag-rewrite-meta-before">{beforeD}s</span>
            <span className="ksp-drag-rewrite-meta-arrow">→</span>
            <span className="ksp-drag-rewrite-meta-after">{afterD}s</span>
          </div>
        </div>
      </div>

      {/* Description diff (the most important + most destructive change) */}
      <div className="ksp-drag-rewrite-action-block">
        <div className="ksp-drag-rewrite-action-label">Mô tả trước:</div>
        <div className="ksp-drag-rewrite-action-before">{beforeAction}</div>
      </div>
      <div className="ksp-drag-rewrite-action-block">
        <div className="ksp-drag-rewrite-action-label ksp-drag-rewrite-action-label-after">AI rewrite:</div>
        <div className="ksp-drag-rewrite-action-after">{afterAction}</div>
      </div>

      <div className="ksp-drag-rewrite-warning">
        ⚠ Mô tả + lời thoại cũ sẽ bị OVERWRITE. Script snapshot được archive trước — anh có thể revert qua{" "}
        <strong>Versions</strong> panel ở phần ②.
      </div>

      <div className="ksp-drag-rewrite-actions">
        <button
          type="button"
          className="ksp-drag-rewrite-btn ksp-drag-rewrite-btn-ghost"
          onClick={onClose}
        >
          ✕ Bỏ qua
        </button>
        <button
          type="button"
          className="ksp-drag-rewrite-btn ksp-drag-rewrite-btn-primary"
          onClick={onApply}
        >
          ✓ Áp dụng rewrite
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// MULTI-CHARACTER EMOTION CURVE (Sprint 1.0 r5 — Phase 2B)
// ============================================================================

/**
 * Color palette for character lines. Cycled through ordered characters.
 * 6 distinct hues chosen for legibility on dark background.
 */
const CHAR_COLORS = ["#D85A30", "#534AB7", "#3B6D11", "#0C447C", "#993C1D", "#854F0B"];

/**
 * Map EmotionalTone to a vertical Y position (0-10) for multi-line curve.
 * Different tones plotted at different heights for legibility.
 * Approximates emotional valence × arousal axes (Pixar model):
 *   - shocking (9) / triumphant (8) — high arousal
 *   - tense (7) / sad (4) — moderate arousal, opposite valence
 *   - funny (6) / tender (3) — lower arousal
 *   - neutral (5) — baseline
 */
const TONE_TO_Y: Record<EmotionalTone, number> = {
  shocking: 9,
  triumphant: 8,
  tense: 7,
  funny: 6,
  neutral: 5,
  sad: 4,
  tender: 3,
};

function MultiCharacterCurve({
  scenes,
  film,
}: {
  scenes: Array<{
    id: string;
    order: number;
    titleVi?: string;
    titleEn: string;
    characterEmotions?: Record<string, EmotionalTone>;
    dialog?: Array<{ characterId: string; characterName: string }>;
  }>;
  film: import("../types/film").FilmData;
}) {
  const updateProject = useAppStore((s) => s.updateCurrentProject);
  const showToast = useAppStore((s) => s.showToast);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [hiddenCharIds, setHiddenCharIds] = useState<Set<string>>(new Set());

  const characters = film.characters ?? [];

  // Don't show this block if fewer than 2 characters in cast
  if (characters.length < 2) return null;

  // Detect if any scene has characterEmotions annotated
  const hasAnnotations = scenes.some(
    (s) => s.characterEmotions && Object.keys(s.characterEmotions).length > 0
  );

  async function handleAnnotate() {
    setIsAnnotating(true);
    try {
      const provider = (film.scriptProvider ?? "gemini-flash") as FilmScriptProvider;
      const result = await runReannotateCharacterEmotions({
        scenes: scenes.map((s) => ({
          id: s.id,
          order: s.order,
          titleEn: s.titleEn,
          titleVi: s.titleVi,
          actionLinesVi: (s as any).actionLinesVi,
          actionLinesEn: (s as any).actionLinesEn ?? "",
          dialog: (s as any).dialog,
        })),
        characters: characters.map((c) => ({ id: c.id, name: c.name, description: c.description })),
        provider,
      });
      const count = Object.keys(result).length;
      if (count === 0) {
        showToast("AI không phát hiện đa cảm xúc — phim có thể chỉ có 1 nhân vật chủ đạo", "info");
      } else {
        updateProject((p) => applyCharacterEmotions(p, result));
        showToast(`Đã annotate ${count} scenes với cảm xúc per-character`, "success");
      }
    } catch (err) {
      showToast(`Lỗi annotate multi-character: ${(err as Error).message}`, "error");
    } finally {
      setIsAnnotating(false);
    }
  }

  // SVG dims (same as TensionCurve for consistency)
  const W = 320;
  const H = 130;
  const PAD_L = 22;
  const PAD_R = 12;
  const PAD_T = 14;
  const PAD_B = 22;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const n = scenes.length;

  const xs = scenes.map((_, i) =>
    n === 1 ? PAD_L + innerW / 2 : PAD_L + (i * innerW) / (n - 1)
  );

  // Build per-character data: { charId, color, points: [(x, y) or null if not present] }
  const charLines = characters.map((c, idx) => {
    const color = CHAR_COLORS[idx % CHAR_COLORS.length];
    const points = scenes.map((s, sceneIdx) => {
      const charEmotions = s.characterEmotions ?? {};
      const tone = charEmotions[c.id];
      if (!tone) return null;
      const y = PAD_T + innerH - (TONE_TO_Y[tone] / 10) * innerH;
      return { x: xs[sceneIdx], y, tone };
    });
    return { id: c.id, name: c.name || `Nhân vật ${c.order}`, color, points };
  });

  return (
    <div className="ksp-pacing-block">
      <h3 className="ksp-pacing-block-title">
        Đa cảm xúc nhân vật
        <span className="ksp-pacing-block-sub"> · {characters.length} characters</span>
      </h3>

      {!hasAnnotations && (
        <div className="ksp-multichar-empty">
          <p>
            Chưa có annotation per-character. Click bên dưới để AI scan dialogue + action lines và phân
            cảm xúc cho từng nhân vật trong mỗi cảnh.
          </p>
          <button
            type="button"
            className="ksp-ai-director-btn ksp-ai-director-btn-primary ksp-ai-director-btn-sm"
            onClick={handleAnnotate}
            disabled={isAnnotating}
          >
            {isAnnotating ? "⏳ AI đang annotate..." : "🎭 AI annotate per-character"}
          </button>
        </div>
      )}

      {hasAnnotations && (
        <>
          {/* Legend with character pills (click to toggle visibility) */}
          <div className="ksp-multichar-legend">
            {charLines.map((line) => {
              const hidden = hiddenCharIds.has(line.id);
              return (
                <button
                  key={line.id}
                  type="button"
                  className="ksp-multichar-pill"
                  data-hidden={hidden}
                  style={{ borderColor: line.color, color: hidden ? "#666" : line.color }}
                  onClick={() => {
                    setHiddenCharIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(line.id)) next.delete(line.id);
                      else next.add(line.id);
                      return next;
                    });
                  }}
                  title={hidden ? "Hiện lại line" : "Ẩn line này"}
                >
                  <span
                    className="ksp-multichar-pill-dot"
                    style={{ background: hidden ? "#666" : line.color }}
                  />
                  {line.name}
                </button>
              );
            })}
          </div>

          <svg
            className="ksp-pacing-curve-svg"
            viewBox={`0 0 ${W} ${H}`}
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="Multi-character emotion curves"
          >
            {/* Y-axis grid */}
            {[3, 5, 7, 9].map((tick) => {
              const y = PAD_T + innerH - (tick / 10) * innerH;
              const toneLabel = Object.entries(TONE_TO_Y).find(([, v]) => v === tick)?.[0];
              return (
                <g key={tick}>
                  <line
                    x1={PAD_L}
                    y1={y}
                    x2={W - PAD_R}
                    y2={y}
                    stroke="#2a2a2a"
                    strokeWidth="0.5"
                    strokeDasharray="2 3"
                  />
                  {toneLabel && (
                    <text x={2} y={y + 3} fontSize="7" fill="#666">
                      {EMOTIONAL_TONE_LABELS[toneLabel as EmotionalTone].emoji}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Per-character polylines, skipping null points (character not in scene) */}
            {charLines.map((line) => {
              if (hiddenCharIds.has(line.id)) return null;
              // Build polyline string only over consecutive non-null points
              const segments: string[] = [];
              let current: string[] = [];
              for (const pt of line.points) {
                if (pt === null) {
                  if (current.length > 0) {
                    segments.push(current.join(" "));
                    current = [];
                  }
                } else {
                  current.push(`${pt.x.toFixed(1)},${pt.y.toFixed(1)}`);
                }
              }
              if (current.length > 0) segments.push(current.join(" "));
              return (
                <g key={line.id}>
                  {segments.map((seg, i) => (
                    <polyline
                      key={i}
                      points={seg}
                      fill="none"
                      stroke={line.color}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.85"
                    />
                  ))}
                  {/* Data point dots */}
                  {line.points.map((pt, i) =>
                    pt ? (
                      <circle
                        key={i}
                        cx={pt.x}
                        cy={pt.y}
                        r={2.5}
                        fill={line.color}
                        opacity="0.95"
                      >
                        <title>{`${line.name} — ${EMOTIONAL_TONE_LABELS[pt.tone].emoji} ${EMOTIONAL_TONE_LABELS[pt.tone].vi}`}</title>
                      </circle>
                    ) : null
                  )}
                </g>
              );
            })}

            {/* X-axis scene labels */}
            {xs.map((x, i) => (
              <text
                key={i}
                x={x}
                y={H - 6}
                fontSize="9"
                fill="#888780"
                textAnchor="middle"
              >
                S{scenes[i].order}
              </text>
            ))}
          </svg>

          <div className="ksp-multichar-actions">
            <button
              type="button"
              className="ksp-ai-director-btn ksp-ai-director-btn-ghost ksp-ai-director-btn-sm"
              onClick={handleAnnotate}
              disabled={isAnnotating}
              title="AI re-scan toàn bộ scenes và annotate lại cảm xúc per-character"
            >
              {isAnnotating ? "⏳" : "🎭"} Re-annotate
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// SETUP-PAYOFF PANEL (Sprint 1.0 r5 — Phase 2B)
// ============================================================================

function SetupPayoffPanel({
  scenes,
  film,
}: {
  scenes: Array<{ id: string; order: number; titleVi?: string; titleEn: string }>;
  film: import("../types/film").FilmData;
}) {
  const updateProject = useAppStore((s) => s.updateCurrentProject);
  const showToast = useAppStore((s) => s.showToast);
  const [isDetecting, setIsDetecting] = useState(false);
  const [danglingHints, setDanglingHints] = useState<string[]>([]);
  const [summary, setSummary] = useState<string>("");

  const pairs = film.setupPayoffPairs ?? [];

  async function handleDetect() {
    setIsDetecting(true);
    try {
      const provider = (film.scriptProvider ?? "gemini-flash") as FilmScriptProvider;
      const result: SetupPayoffDetectResult = await runSetupPayoffDetect({
        scenes: scenes.map((s) => ({
          id: s.id,
          order: s.order,
          titleVi: s.titleVi,
          titleEn: s.titleEn,
          actionLinesVi: (s as any).actionLinesVi,
          actionLinesEn: (s as any).actionLinesEn ?? "",
        })),
        provider,
      });
      updateProject((p) => setSetupPayoffPairs(p, result.pairs));
      setDanglingHints(result.danglingSetupsVi);
      setSummary(result.summaryVi);
      showToast(
        result.pairs.length > 0
          ? `Phát hiện ${result.pairs.length} cặp setup-payoff`
          : "Không phát hiện cặp setup-payoff đáng kể",
        "success"
      );
    } catch (err) {
      showToast(`Lỗi setup-payoff: ${(err as Error).message}`, "error");
    } finally {
      setIsDetecting(false);
    }
  }

  function handleRemovePair(pairId: string) {
    if (!confirm("Xóa cặp setup-payoff này khỏi danh sách?")) return;
    updateProject((p) => removeSetupPayoffPair(p, pairId));
    showToast("Đã xóa cặp", "success");
  }

  const sceneOrderMap = new Map(scenes.map((s) => [s.id, s]));

  return (
    <div className="ksp-pacing-block">
      <h3 className="ksp-pacing-block-title">
        Setup → Payoff
        {pairs.length > 0 && <span className="ksp-pacing-block-sub"> · {pairs.length} cặp</span>}
      </h3>

      {pairs.length === 0 && (
        <div className="ksp-setup-payoff-empty">
          <p>
            AI sẽ scan toàn phim và phát hiện các yếu tố được "gài cắm" sớm rồi "trả nợ" sau (vật thể,
            kỹ năng, lời hứa, bí ẩn, tính cách, thế giới).
          </p>
          <button
            type="button"
            className="ksp-ai-director-btn ksp-ai-director-btn-primary ksp-ai-director-btn-sm"
            onClick={handleDetect}
            disabled={isDetecting}
          >
            {isDetecting ? "⏳ AI đang scan..." : "🎯 Detect setup-payoff"}
          </button>
        </div>
      )}

      {pairs.length > 0 && (
        <>
          {summary && <p className="ksp-setup-payoff-summary">{summary}</p>}

          <ol className="ksp-setup-payoff-list">
            {pairs.map((pair) => {
              const setupScene = sceneOrderMap.get(pair.setupSceneId);
              const payoffScene = sceneOrderMap.get(pair.payoffSceneId);
              const typeInfo = SETUP_PAYOFF_TYPE_LABELS[pair.type];
              const confLabel =
                pair.confidence > 0.7 ? "mạnh" : pair.confidence > 0.5 ? "khá" : "yếu";
              return (
                <li key={pair.id} className="ksp-setup-payoff-row">
                  <div className="ksp-setup-payoff-head">
                    <span
                      className="ksp-setup-payoff-type"
                      style={{ background: typeInfo.color + "33", color: typeInfo.color }}
                      title={typeInfo.vi}
                    >
                      {typeInfo.emoji} {typeInfo.vi}
                    </span>
                    <span className="ksp-setup-payoff-label">{pair.labelVi}</span>
                    <span className="ksp-setup-payoff-conf" data-strength={confLabel}>
                      {confLabel}
                    </span>
                    <button
                      type="button"
                      className="ksp-setup-payoff-rm"
                      onClick={() => handleRemovePair(pair.id)}
                      title="Xóa cặp"
                    >
                      ×
                    </button>
                  </div>
                  <div className="ksp-setup-payoff-arc">
                    <span className="ksp-setup-payoff-anchor ksp-setup-payoff-anchor-setup">
                      S{setupScene?.order ?? "?"}
                    </span>
                    <span className="ksp-setup-payoff-line" />
                    <span className="ksp-setup-payoff-anchor ksp-setup-payoff-anchor-payoff">
                      S{payoffScene?.order ?? "?"}
                    </span>
                  </div>
                  {pair.rationaleVi && (
                    <div className="ksp-setup-payoff-rationale">{pair.rationaleVi}</div>
                  )}
                </li>
              );
            })}
          </ol>

          {danglingHints.length > 0 && (
            <div className="ksp-setup-payoff-dangling">
              <strong>⚠ Setup chưa được payoff:</strong>
              <ul>
                {danglingHints.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="ksp-multichar-actions">
            <button
              type="button"
              className="ksp-ai-director-btn ksp-ai-director-btn-ghost ksp-ai-director-btn-sm"
              onClick={handleDetect}
              disabled={isDetecting}
              title="AI scan lại toàn film để cập nhật phân tích"
            >
              {isDetecting ? "⏳" : "🎯"} Re-scan
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Sprint G1e0 — EMOTION ↔ TENSION VALIDATOR WARNING PANEL
// ============================================================================

/**
 * Scans all scenes for emotion/tension combo violations (per Pixar emotional model
 * defined in EMOTION_TENSION_VALID_RANGE). Surfaces 1-click auto-fix UI.
 *
 * Root cause this addresses: AI Stage 4 sometimes generates contradictory combos
 * like "shocking + tension 3" → downstream prompt builder produces conflicting
 * cinematic intent → AI image gen renders inconsistent lighting/mood across cells
 * ("cái tối cái sáng" symptom Jason reported).
 *
 * Renders nothing if all scenes have valid combos.
 */
function EmotionTensionWarningPanel({
  scenes,
  onAutoFixAll,
  onFixOne,
}: {
  scenes: Array<{
    id: string;
    order: number;
    tensionLevel?: number;
    emotionalTone?: EmotionalTone;
    titleVi?: string;
    titleEn: string;
  }>;
  onAutoFixAll: () => void;
  onFixOne: (sceneId: string, newTension: number) => void;
}) {
  const invalidScenes = React.useMemo(
    () =>
      scenes
        .map((s) => {
          const result = validateEmotionTension(s.emotionalTone, s.tensionLevel);
          if (result.valid) return null;
          return { scene: s, result };
        })
        .filter((x): x is { scene: typeof scenes[number]; result: ReturnType<typeof validateEmotionTension> & { valid: false } } => x !== null),
    [scenes]
  );

  if (invalidScenes.length === 0) return null;

  return (
    <div className="ksp-pacing-block ksp-emotion-warning-panel">
      <div className="ksp-emotion-warning-header">
        <strong className="ksp-emotion-warning-title">
          ⚠ Phát hiện {invalidScenes.length} scene có cảm xúc / tension không khớp
        </strong>
        <button
          type="button"
          className="ksp-emotion-warning-autofix-btn"
          onClick={onAutoFixAll}
          title="Auto-fix tất cả: clamp tension vào valid range của tone"
        >
          ✨ Auto-fix tất cả
        </button>
      </div>
      <p className="ksp-emotion-warning-hint">
        Combo emotion+tension không hợp ngữ cảnh sẽ tạo prompt mâu thuẫn — AI sinh ảnh
        sẽ "cái tối cái sáng" giữa các shots cùng scene.
      </p>
      <ul className="ksp-emotion-warning-list">
        {invalidScenes.map(({ scene, result }) => {
          const tone = scene.emotionalTone!;
          const range = EMOTION_TENSION_VALID_RANGE[tone];
          const toneLabel = EMOTIONAL_TONE_LABELS[tone];
          return (
            <li key={scene.id} className="ksp-emotion-warning-item">
              <div className="ksp-emotion-warning-item-meta">
                <span className="ksp-emotion-warning-scene-order">
                  Scene {scene.order}:
                </span>
                <span className="ksp-emotion-warning-scene-title">
                  {scene.titleVi || scene.titleEn}
                </span>
              </div>
              <div className="ksp-emotion-warning-item-detail">
                <span
                  className="ksp-emotion-warning-current"
                  style={{ background: toneLabel.bg, color: toneLabel.color }}
                >
                  {toneLabel.emoji} {toneLabel.vi} · tension {clampTension(scene.tensionLevel)}/10
                </span>
                <span className="ksp-emotion-warning-arrow">→</span>
                <span className="ksp-emotion-warning-suggested">
                  tension {result.suggestedTension}/10 (valid {range.min}–{range.max})
                </span>
                <button
                  type="button"
                  className="ksp-emotion-warning-fix-one-btn"
                  onClick={() => onFixOne(scene.id, result.suggestedTension)}
                  title={`Fix scene ${scene.order}: tension ${clampTension(scene.tensionLevel)} → ${result.suggestedTension}`}
                >
                  Fix
                </button>
              </div>
              <p className="ksp-emotion-warning-reason">{result.reason}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
