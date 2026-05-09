import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { assemblePrompt } from "../engine/assembler";
import { ANGLE_PRESETS, getAngleById } from "../engine/angles";
import { getPoseTemplatesForMode, getPoseTemplateById } from "../engine/poseTemplates";
import {
  POSITION_SUGGESTIONS,
  HANDS_SUGGESTIONS,
  EXPRESSION_SUGGESTIONS,
  getSuggestionsForMode,
} from "../engine/poseSuggestions";
import {
  saveShotResult,
  listShotResults,
  deleteShotResult,
  getReferenceImage,
  type ShotResult,
} from "../store/db";
import type { Shot } from "../types";

interface Props {
  shot: Shot;
  index: number;
  isDragging: boolean;
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDragEnd: () => void;
}

export function ShotEditor({ shot, index, isDragging, onDragStart, onDragOver, onDragEnd }: Props) {
  const {
    currentProject,
    generatedPrompts,
    updateShot,
    deleteShot,
    setGeneratedPrompt,
    showToast,
  } = useAppStore();
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<ShotResult[]>([]);
  // v0.5.3: Auto-regenerate state
  const [autoRegenStatus, setAutoRegenStatus] = useState<"idle" | "updating" | "ready">("idle");
  const autoRegenTimerRef = useRef<number | null>(null);

  const refreshResults = async () => {
    const r = await listShotResults(shot.id);
    setResults(r);
  };

  useEffect(() => {
    if (open) refreshResults();
  }, [open, shot.id]);

  if (!currentProject) return null;

  const result = generatedPrompts.get(shot.id);
  const currentAngle = shot.anglePresetId ? getAngleById(shot.anglePresetId) : undefined;

  // v0.5.3: Get mode for filtering pose templates + suggestions
  const projectMode = ((currentProject as any).mode || "lifestyle") as
    | "lifestyle"
    | "tvc_commercial"
    | "product_photo"
    | "editorial_fashion";
  const poseTemplates = getPoseTemplatesForMode(projectMode);
  const positionSuggestions = getSuggestionsForMode(POSITION_SUGGESTIONS, projectMode);
  const handsSuggestions = getSuggestionsForMode(HANDS_SUGGESTIONS, projectMode);
  const expressionSuggestions = getSuggestionsForMode(EXPRESSION_SUGGESTIONS, projectMode);

  const handleGenerate = () => {
    try {
      const r = assemblePrompt(currentProject, shot);
      setGeneratedPrompt(shot.id, r);
      setAutoRegenStatus("ready");
      showToast(`Đã generate "${shot.name}"`, "success");
      setOpen(true);
    } catch (e: any) {
      showToast(`Lỗi: ${e.message}`, "error");
    }
  };

  // v0.5.3: Auto-regenerate after debounce when fields change
  const triggerAutoRegen = () => {
    setAutoRegenStatus("updating");
    if (autoRegenTimerRef.current) {
      window.clearTimeout(autoRegenTimerRef.current);
    }
    autoRegenTimerRef.current = window.setTimeout(() => {
      try {
        const r = assemblePrompt(currentProject, shot);
        setGeneratedPrompt(shot.id, r);
        setAutoRegenStatus("ready");
      } catch {
        setAutoRegenStatus("idle");
      }
    }, 600);
  };

  // Auto-regenerate when shot pose/camera fields change
  useEffect(() => {
    if (result) {
      // Only auto-regen if user has previously generated (avoid generating on first mount)
      triggerAutoRegen();
    }
    return () => {
      if (autoRegenTimerRef.current) window.clearTimeout(autoRegenTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    shot.pose.position,
    shot.pose.hands,
    shot.pose.expression,
    shot.pose.lookingAt,
    shot.pose.framing,
    shot.pose.cameraAngle,
    shot.anglePresetId,
  ]);

  const handlePickPoseTemplate = (templateId: string) => {
    const tpl = getPoseTemplateById(templateId);
    if (!tpl) return;

    // Map template framing string to PoseConfig enum
    const framingMap: Record<string, "close-up" | "medium" | "full-body" | "wide" | "selfie"> = {
      "close-up": "close-up",
      "medium close-up": "close-up",
      "extreme close-up": "close-up",
      "medium shot": "medium",
      "three-quarter shot": "medium",
      "full body": "full-body",
      "wide shot": "wide",
    };

    const mappedFraming = tpl.framing ? (framingMap[tpl.framing] || shot.pose.framing) : shot.pose.framing;

    updateShot(shot.id, {
      pose: {
        ...shot.pose,
        position: tpl.position,
        hands: tpl.hands,
        expression: tpl.expression,
        lookingAt: tpl.lookingAt || shot.pose.lookingAt,
        framing: mappedFraming,
      },
    });
    showToast(`✓ Đã áp dụng template "${tpl.name}"`, "success");
  };

  const handleCopy = async () => {
    if (!result) {
      showToast("Generate trước đã", "error");
      return;
    }
    await navigator.clipboard.writeText(result.prompt);
    showToast("Đã copy vào clipboard", "success");
  };

  const updatePose = (updates: Partial<Shot["pose"]>) =>
    updateShot(shot.id, { pose: { ...shot.pose, ...updates } });

  const handleAngleChange = (newAngleId: string) => {
    const preset = getAngleById(newAngleId);
    if (!preset) return;
    updateShot(shot.id, {
      anglePresetId: newAngleId,
      pose: {
        ...shot.pose,
        framing: preset.framing,
        cameraAngle: preset.cameraAngle,
      },
    });
  };

  const handleUploadResult = async (file: File, status: ShotResult["status"]) => {
    if (!file.type.startsWith("image/")) {
      showToast("Chỉ hỗ trợ file ảnh", "error");
      return;
    }
    await saveShotResult({
      shotId: shot.id,
      projectId: currentProject.id,
      imageBlob: file,
      status,
      promptUsed: result?.prompt || "",
    });
    showToast("Đã lưu kết quả", "success");
    refreshResults();
  };

  return (
    <div
      draggable
      onDragStart={() => onDragStart(shot.id)}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(shot.id);
      }}
      onDragEnd={onDragEnd}
      className={`bg-ksp-bg border rounded transition-opacity ${
        isDragging ? "opacity-40 border-ksp-accent" : "border-ksp-border"
      }`}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 p-2">
        <span className="cursor-grab text-ksp-muted text-xs select-none" title="Drag to reorder">
          ⋮⋮
        </span>
        <button onClick={() => setOpen(!open)} className="text-ksp-muted text-xs">
          {open ? "▼" : "▶"}
        </button>
        <span className="text-xs text-ksp-muted">{index + 1}.</span>
        {currentAngle && (
          <span className="text-xs" title={currentAngle.description}>
            {currentAngle.emoji}
          </span>
        )}
        <input
          type="text"
          value={shot.name}
          onChange={(e) => updateShot(shot.id, { name: e.target.value })}
          className="flex-1 text-xs"
          placeholder="Tên shot"
        />
        {results.length > 0 && (
          <span className="text-[10px] text-ksp-muted" title={`${results.length} kết quả`}>
            🖼{results.length}
          </span>
        )}
        <button
          onClick={handleGenerate}
          className="px-2 py-1 bg-ksp-accent text-black rounded text-xs font-medium hover:opacity-90"
          title="Generate prompt"
        >
          ⚡
        </button>
        {result && (
          <button
            onClick={handleCopy}
            className="px-2 py-1 bg-ksp-panel border border-ksp-border rounded text-xs hover:border-ksp-accent"
            title="Copy prompt"
          >
            📋
          </button>
        )}
        {/* Reference thumbnails next to Copy - clickable to download */}
        <RefThumbnailButtons project={currentProject} result={result} />
        <button
          onClick={() => deleteShot(shot.id)}
          className="px-2 py-1 text-ksp-bad hover:bg-ksp-bad/10 rounded text-xs"
          title="Xóa"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      {open && (
        <div className="p-2 pt-0 space-y-2 border-t border-ksp-border">
          {/* Angle preset selector */}
          <div>
            <label>📐 Góc máy ({currentAngle?.name || "Chưa chọn"})</label>
            <select
              value={shot.anglePresetId || ""}
              onChange={(e) => handleAngleChange(e.target.value)}
            >
              {ANGLE_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.emoji} {p.name} — {p.description}
                </option>
              ))}
            </select>
            {currentAngle && (
              <p className="text-[10px] text-ksp-muted mt-1 leading-snug">
                💡 {currentAngle.hintVn}
              </p>
            )}
          </div>

          {/* v0.5.3: Pose Templates - 1-click fill 3 fields */}
          {poseTemplates.length > 0 && (
            <div>
              <label>⚡ Pose Templates (1-click)</label>
              <div className="grid grid-cols-3 gap-1">
                {poseTemplates.slice(0, 9).map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => handlePickPoseTemplate(tpl.id)}
                    className="p-1.5 text-[10px] bg-ksp-bg border border-ksp-border rounded hover:border-ksp-accent transition-colors text-left"
                    title={`${tpl.name}: ${tpl.position.slice(0, 50)}...`}
                  >
                    <div>{tpl.emoji} {tpl.name}</div>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-ksp-muted mt-1">Click 1 template để fill cả 3 ô (Position / Hands / Expression)</p>
            </div>
          )}

          <div>
            <label>Position (chi tiết)</label>
            <input
              type="text"
              list={`positions-${shot.id}`}
              value={shot.pose.position}
              onChange={(e) => updatePose({ position: e.target.value })}
              placeholder="Click để xem gợi ý hoặc tự gõ..."
            />
            <datalist id={`positions-${shot.id}`}>
              {positionSuggestions.map((s, i) => (
                <option key={i} value={s} />
              ))}
            </datalist>
          </div>

          <div>
            <label>Hands</label>
            <input
              type="text"
              list={`hands-${shot.id}`}
              value={shot.pose.hands || ""}
              onChange={(e) => updatePose({ hands: e.target.value })}
              placeholder="Click để xem gợi ý hoặc tự gõ..."
            />
            <datalist id={`hands-${shot.id}`}>
              {handsSuggestions.map((s, i) => (
                <option key={i} value={s} />
              ))}
            </datalist>
          </div>

          <div>
            <label>Expression</label>
            <input
              type="text"
              list={`expressions-${shot.id}`}
              value={shot.pose.expression}
              onChange={(e) => updatePose({ expression: e.target.value })}
              placeholder="Click để xem gợi ý hoặc tự gõ..."
            />
            <datalist id={`expressions-${shot.id}`}>
              {expressionSuggestions.map((s, i) => (
                <option key={i} value={s} />
              ))}
            </datalist>
          </div>

          <div>
            <label>Looking at</label>
            <select
              value={shot.pose.lookingAt}
              onChange={(e) => updatePose({ lookingAt: e.target.value as any })}
            >
              <option value="camera">Camera</option>
              <option value="away">Away</option>
              <option value="down">Down</option>
              <option value="up">Up</option>
              <option value="side">Side</option>
              <option value="object">Object</option>
            </select>
          </div>

          {/* v0.5.3 + v0.6.2: Generated prompt with fidelity indicator */}
          {result && (
            <div className="mt-3 pt-3 border-t border-ksp-border">
              <div className="flex items-center justify-between mb-1">
                <label className="!mb-0 flex items-center gap-1.5">
                  {autoRegenStatus === "updating" ? (
                    <span className="text-[11px] text-yellow-500">⏳ Đang cập nhật...</span>
                  ) : (
                    <span className="text-[11px] text-ksp-good">✓ Prompt sẵn sàng</span>
                  )}
                </label>
                <span className="text-[10px] text-ksp-muted">
                  {result.estimatedTokens} tokens · {result.prompt.length} chars
                </span>
              </div>

              {/* Fidelity tier indicator */}
              {currentProject.references.hasFace && (() => {
                const hasIdentifiers = !!(currentProject.subject.uniqueIdentifiers && currentProject.subject.uniqueIdentifiers.trim().length > 5);
                const has100Phrase = result.prompt.includes("100% accurate");
                const isReasonable = result.prompt.length < 6000;

                let tier: "low" | "med" | "high" = "low";
                if (has100Phrase && isReasonable) tier = "med";
                if (has100Phrase && isReasonable && hasIdentifiers) tier = "high";

                const tierConfig = {
                  low: { color: "text-yellow-500", bg: "bg-yellow-500/10", icon: "⚠️", label: "Face fidelity: Cơ bản (~70-80%)", hint: "Thêm 'Unique features' trong Subject DNA để tăng similarity" },
                  med: { color: "text-blue-400", bg: "bg-blue-500/10", icon: "✓", label: "Face fidelity: Tốt (~80-90%)", hint: "Thêm 'Unique features' trong Subject DNA → tăng lên 90%+" },
                  high: { color: "text-ksp-good", bg: "bg-green-500/10", icon: "🎯", label: "Face fidelity: Cao (~90-95%)", hint: "Để đạt >95%, dùng Higgsfield Soul ID — xem tab Settings" },
                };
                const c = tierConfig[tier];
                return (
                  <div className={`mb-2 p-2 rounded ${c.bg} border border-ksp-border`}>
                    <div className={`text-[11px] font-medium ${c.color}`}>{c.icon} {c.label}</div>
                    <div className="text-[10px] text-ksp-muted mt-0.5">{c.hint}</div>
                  </div>
                );
              })()}

              <textarea
                value={result.prompt}
                readOnly
                rows={8}
                className="font-mono text-[11px] bg-ksp-bg/50"
              />
            </div>
          )}

          {/* Result images */}
          <ResultsPanel
            results={results}
            onUpload={handleUploadResult}
            onDelete={async (id) => {
              await deleteShotResult(id);
              refreshResults();
            }}
            hasPrompt={!!result}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Show small reference image thumbnails next to Copy button.
 * v0.4.3: Filenames now use ordered prefix (01_, 02_, ...) + role hint
 * so AI sees "01_face_front.png", "02_face_3-4_left.png", etc.
 * matching the Image #N references in the prompt.
 */
function RefThumbnailButtons({ project, result }: { project: any; result?: any }) {
  const refIds = project.refImageIds || {};
  const subjectType = project.subject?.subjectType || "female";

  // Multi-face support: collect all face IDs
  const faces: string[] = refIds.faces || (refIds.face ? [refIds.face] : []);

  // Role hints for filenames (matching what's in the prompt)
  const FACE_ROLE_HINTS = [
    "face_front",
    "face_3-4_left",
    "face_3-4_right",
    "face_side_profile",
    "face_looking_up",
    "face_other_angle",
  ];

  const ids: { label: string; id: string; roleHint: string }[] = [];

  // Subject-specific face role hints
  if (subjectType === "couple") {
    if (faces[0]) ids.push({ label: "#1", id: faces[0], roleHint: "face_woman" });
    if (faces[1]) ids.push({ label: "#2", id: faces[1], roleHint: "face_man" });
  } else {
    faces.forEach((fid: string, i: number) => {
      if (fid) {
        const hint = FACE_ROLE_HINTS[i] || `face_${i + 1}`;
        ids.push({ label: `#${ids.length + 1}`, id: fid, roleHint: hint });
      }
    });
  }

  // Outfit
  if (refIds.outfit) {
    ids.push({
      label: `#${ids.length + 1}`,
      id: refIds.outfit,
      roleHint: "outfit",
    });
  }

  // Products
  if (refIds.products) {
    refIds.products.forEach((pid: string, i: number) => {
      if (pid) {
        ids.push({
          label: `#${ids.length + 1}`,
          id: pid,
          roleHint: `product_${i + 1}`,
        });
      }
    });
  }

  // v0.5.3: Download All as ZIP
  const handleDownloadAllZip = async () => {
    if (ids.length === 0) return;
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      // Add all images with ordered filenames
      for (let i = 0; i < ids.length; i++) {
        const ref = await getReferenceImage(ids[i].id);
        if (!ref) continue;
        const num = String(i + 1).padStart(2, "0");
        const ext = ref.blob.type.split("/")[1] || "png";
        zip.file(`${num}_${ids[i].roleHint}.${ext}`, ref.blob);
      }

      // Add prompt.txt if available
      if (result?.prompt) {
        zip.file("prompt.txt", result.prompt);
      }

      // Add README.md
      const readmeContent = `# KSP Image — ${project.name}

## Hướng dẫn upload vào Banana Pro / Nano Banana

1. Mở Banana Pro
2. Paste nội dung file \`prompt.txt\` vào ô prompt input
3. Upload các file ảnh vào Banana Pro **theo đúng thứ tự**:
${ids.map((r, i) => `   - File ${String(i + 1).padStart(2, "0")}_${r.roleHint}.* → upload vị trí thứ ${i + 1}`).join("\n")}
4. Generate ảnh

## Project info
- Mode: ${project.mode || "lifestyle"}
- Industry: ${project.industry || "general"}
- Camera Style: ${project.cameraStyle}
- Aspect Ratio: ${project.aspectRatio}
- Tổng ${ids.length} reference images
- Generated: ${new Date().toLocaleString("vi-VN")}

---
Tạo bởi KSP Image extension.
`;
      zip.file("README.md", readmeContent);

      // Generate and trigger download
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ksp-${project.name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("ZIP download failed:", e);
    }
  };

  if (ids.length === 0) return null;

  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {ids.map((ref, idx) => (
        <RefThumbButton
          key={ref.id}
          label={ref.label}
          refId={ref.id}
          imageNumber={idx + 1}
          roleHint={ref.roleHint}
        />
      ))}
      <button
        onClick={handleDownloadAllZip}
        className="px-1.5 py-1 bg-ksp-accent text-black rounded text-[10px] font-medium hover:opacity-90"
        title="Download all as ZIP (gồm files + prompt.txt + README.md)"
      >
        📦 ZIP
      </button>
    </div>
  );
}

function RefThumbButton({
  label,
  refId,
  imageNumber,
  roleHint,
}: {
  label: string;
  refId: string;
  imageNumber: number;
  roleHint: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>("ref.jpg");

  useEffect(() => {
    let u: string | null = null;
    getReferenceImage(refId).then((ref) => {
      if (ref) {
        u = URL.createObjectURL(ref.blob);
        setUrl(u);
        const ext = ref.blob.type.split("/")[1] || "jpg";
        // CRITICAL FIX v0.4.3: Filename now matches Image #N in prompt
        // Use 2-digit prefix so alphabetical sort = upload order = prompt order
        const paddedNum = String(imageNumber).padStart(2, "0");
        // Sanitize role hint: lowercase, replace special chars
        const cleanRole = roleHint
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "")
          .slice(0, 30);
        setFilename(`${paddedNum}_${cleanRole}.${ext}`);
      }
    });
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [refId, imageNumber, roleHint]);

  const handleDownload = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  };

  if (!url) return null;

  return (
    <button
      onClick={handleDownload}
      title={`Click để download ${label}`}
      className="relative w-7 h-7 rounded overflow-hidden border border-ksp-border hover:border-ksp-accent group"
    >
      <img src={url} alt={label} className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-[9px] text-white">⬇</span>
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[7px] text-center text-white leading-tight">
        {label}
      </div>
    </button>
  );
}

function ResultsPanel({
  results,
  onUpload,
  onDelete,
  hasPrompt,
}: {
  results: ShotResult[];
  onUpload: (file: File, status: ShotResult["status"]) => void;
  onDelete: (id: string) => void;
  hasPrompt: boolean;
}) {
  const fileInputGood = useRef<HTMLInputElement>(null);
  const fileInputBad = useRef<HTMLInputElement>(null);
  const fileInputIter = useRef<HTMLInputElement>(null);

  return (
    <div className="mt-2 pt-2 border-t border-ksp-border">
      <div className="flex items-center justify-between mb-2">
        <label>🖼 Kết quả từ Banana Pro ({results.length})</label>
      </div>

      <div className="grid grid-cols-3 gap-1 mb-2">
        <button
          onClick={() => fileInputGood.current?.click()}
          disabled={!hasPrompt}
          className="text-[10px] px-2 py-1 bg-ksp-good/20 border border-ksp-good text-ksp-good rounded disabled:opacity-30"
        >
          ✅ Good
        </button>
        <button
          onClick={() => fileInputIter.current?.click()}
          disabled={!hasPrompt}
          className="text-[10px] px-2 py-1 bg-yellow-500/20 border border-yellow-500 text-yellow-500 rounded disabled:opacity-30"
        >
          🔄 Iter
        </button>
        <button
          onClick={() => fileInputBad.current?.click()}
          disabled={!hasPrompt}
          className="text-[10px] px-2 py-1 bg-ksp-bad/20 border border-ksp-bad text-ksp-bad rounded disabled:opacity-30"
        >
          ❌ Bad
        </button>
      </div>

      <input ref={fileInputGood} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f, "good"); e.target.value = ""; }} />
      <input ref={fileInputIter} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f, "iteration"); e.target.value = ""; }} />
      <input ref={fileInputBad} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f, "bad"); e.target.value = ""; }} />

      {!hasPrompt && (
        <p className="text-[10px] text-ksp-muted text-center">
          Generate prompt trước, rồi mới upload kết quả
        </p>
      )}

      {results.length > 0 && (
        <div className="grid grid-cols-3 gap-1">
          {results.map((r) => (
            <ResultThumb key={r.id} result={r} onDelete={() => onDelete(r.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResultThumb({ result, onDelete }: { result: ShotResult; onDelete: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [showLarge, setShowLarge] = useState(false);

  useEffect(() => {
    const u = URL.createObjectURL(result.imageBlob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [result.imageBlob]);

  const statusColor = {
    good: "border-ksp-good",
    iteration: "border-yellow-500",
    bad: "border-ksp-bad",
  }[result.status];

  const statusEmoji = { good: "✅", iteration: "🔄", bad: "❌" }[result.status];

  return (
    <>
      <div
        onClick={() => setShowLarge(true)}
        className={`aspect-square border-2 ${statusColor} rounded overflow-hidden cursor-pointer relative bg-black`}
      >
        {url && <img src={url} className="w-full h-full object-cover" alt="" />}
        <div className="absolute top-0.5 left-0.5 text-xs">{statusEmoji}</div>
      </div>
      {showLarge && (
        <div onClick={() => setShowLarge(false)} className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div onClick={(e) => e.stopPropagation()} className="max-w-sm w-full">
            {url && <img src={url} className="w-full max-h-[60vh] object-contain" alt="" />}
            <div className="bg-ksp-panel p-3 mt-2 rounded">
              <p className="text-xs">Status: {statusEmoji} <strong>{result.status}</strong></p>
              <p className="text-[10px] text-ksp-muted mt-1">{new Date(result.createdAt).toLocaleString("vi-VN")}</p>
              <div className="flex gap-2 mt-2">
                <button onClick={() => setShowLarge(false)} className="flex-1 px-3 py-1 bg-ksp-bg border border-ksp-border rounded text-xs">Đóng</button>
                <button
                  onClick={() => { if (confirm("Xóa ảnh này?")) { onDelete(); setShowLarge(false); } }}
                  className="px-3 py-1 bg-ksp-bad/20 border border-ksp-bad text-ksp-bad rounded text-xs"
                >🗑</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
