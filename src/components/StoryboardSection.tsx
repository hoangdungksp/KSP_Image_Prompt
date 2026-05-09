import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { Section } from "./Section";
import {
  getStoryArc,
  getFilmStoryArc,
  FORMAT_CONFIGS,
  type GridFormat,
  type FrameTemplate,
} from "../engine/storyboard/arcs";
import { generateStoryboardPrompt } from "../engine/storyboard/storyboardPrompt";
import {
  generateAnimationPrompts,
  generateAnimationReadme,
  generateProviderAwarePrompts,
  generateStitchingGuide,
  type AnimationPair,
  type ProviderChunkPrompt,
} from "../engine/storyboard/animationPrompt";
import {
  PROVIDERS,
  TARGET_DURATIONS,
  ASPECT_RATIOS,
  estimateCost,
  getProviderAspectRatios,
  type VideoProvider,
  type AspectRatioOption,
} from "../engine/storyboard/providers";
import {
  planChunks,
  describePlan,
  validatePlan,
  type PlanResult,
} from "../engine/storyboard/chunkPlanner";
import {
  generateStoryboardWithAI,
  type AIProvider as StoryboardAIProvider,
} from "../engine/storyboard/aiGenerator";
import { getSettings } from "../engine/gemini";
import {
  detectFormat,
  generateFrameId,
  insertFrameAfter,
  deleteFrame,
  moveFrame,
} from "../engine/storyboard/frameOps";
import {
  regenerateFrameText,
  generateSingleFramePrompt,
} from "../engine/storyboard/singleFrameOps";
import {
  createVersion,
  formatRelativeTime,
  type StoryboardVersion,
} from "../engine/storyboard/versioning";
import {
  saveReferenceImage,
  getReferenceImage,
} from "../store/db";

export function StoryboardSection() {
  const { currentProject, updateCurrentProject, showToast } = useAppStore();
  const [activeTab, setActiveTab] = useState<"setup" | "grid" | "animate">("setup");
  const [storyboardPrompt, setStoryboardPrompt] = useState("");
  const [animationPairs, setAnimationPairs] = useState<AnimationPair[]>([]);
  // v0.7.0: Provider-aware state
  const [videoProvider, setVideoProvider] = useState<VideoProvider>("seedance_2");
  const [targetDuration, setTargetDuration] = useState<number>(15);
  // v0.7.2: User-selectable aspect ratio
  const [videoAspectRatio, setVideoAspectRatio] = useState<AspectRatioOption>("9:16");
  const [chunkPrompts, setChunkPrompts] = useState<ProviderChunkPrompt[]>([]);
  const [chunkPlan, setChunkPlan] = useState<PlanResult | null>(null);
  const [gridImageBlobUrl, setGridImageBlobUrl] = useState<string | null>(null);
  // v0.6.5: AI generator state
  const [aiGenerating, setAiGenerating] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<StoryboardAIProvider>("gemini");
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [hasOpenAIKey, setHasOpenAIKey] = useState(false);
  // v0.7.1: Per-frame text regen state (must be at top to follow Rules of Hooks)
  const [regeneratingFrameIdx, setRegeneratingFrameIdx] = useState<number | null>(null);
  // v0.7.1: Per-frame image regeneration prompt
  const [singleFrameRegenPrompt, setSingleFrameRegenPrompt] = useState<{
    idx: number;
    prompt: string;
  } | null>(null);

  // v0.7.2: Auto-switch aspect ratio when provider changes (if not supported)
  useEffect(() => {
    const supported = getProviderAspectRatios(videoProvider);
    if (!supported.includes(videoAspectRatio)) {
      setVideoAspectRatio(supported[0] || "9:16");
    }
  }, [videoProvider]);

  // Load API key availability
  useEffect(() => {
    getSettings().then((s) => {
      setHasGeminiKey(!!s.geminiApiKey);
      setHasOpenAIKey(!!s.openaiApiKey);
      if (s.preferredAIProvider) {
        setSelectedProvider(s.preferredAIProvider);
      } else if (s.geminiApiKey) {
        setSelectedProvider("gemini");
      } else if (s.openaiApiKey) {
        setSelectedProvider("openai");
      }
    });
  }, []);

  if (!currentProject) return null;

  const mode = (currentProject as any).mode || "lifestyle";
  const industry = (currentProject as any).industry || "general";

  // v0.8.0: Component is gated by Editor.tsx (only mounts for tvc_commercial or film)
  // No need for inner mode gate — would violate Rules of Hooks

  const storyboard = currentProject.storyboard || {
    enabled: false,
    format: "3x3" as GridFormat,
  };

  // v0.7.1: Auto-detect format from frame count
  const explicitFormat = storyboard.format;
  const tempFrames = storyboard.frames || [];
  const autoFormat = detectFormat(tempFrames.length || 9);
  const format: GridFormat = (explicitFormat && explicitFormat !== "auto"
    ? explicitFormat
    : autoFormat) as GridFormat;
  const formatConfig = FORMAT_CONFIGS[format] || FORMAT_CONFIGS["3x3"];
  // v0.8.0: Use film arc when in film mode
  const isFilmMode = mode === "film";
  const filmGenre = (currentProject as any).filmGenre || "drama";
  const arc = isFilmMode
    ? getFilmStoryArc(filmGenre, format)
    : getStoryArc(industry as any, format);
  const currentFrames = storyboard.frames || arc.frames;

  const updateStoryboard = (updates: Partial<NonNullable<typeof currentProject.storyboard>>) => {
    updateCurrentProject({
      storyboard: { ...storyboard, ...updates },
    });
  };

  const handleEnableStoryboard = () => {
    updateStoryboard({ enabled: true });
  };

  const handleFormatChange = (newFormat: GridFormat) => {
    const newArc = isFilmMode
      ? getFilmStoryArc(filmGenre, newFormat)
      : getStoryArc(industry as any, newFormat);
    updateStoryboard({
      format: newFormat,
      frames: newArc.frames,  // Reset frames to new format defaults
    });
  };

  const handleResetArc = () => {
    if (!confirm("Reset cảnh về template mặc định?")) return;
    updateStoryboard({
      frames: arc.frames,
      aiProvider: "template",
      aiReasoning: undefined,
    });
    showToast("Đã reset về template", "success");
  };

  // v0.6.5: AI generate frames from idea
  const handleAIGenerate = async (forceFormat?: GridFormat | "auto") => {
    if (!currentProject.idea?.raw?.trim()) {
      showToast("⚠️ Nhập 'Mô tả ý tưởng' ở section trên trước", "error");
      return;
    }

    if (selectedProvider === "gemini" && !hasGeminiKey) {
      showToast("⚠️ Chưa có Gemini API key. Vào ⚙️ Settings để thêm.", "error");
      return;
    }
    if (selectedProvider === "openai" && !hasOpenAIKey) {
      showToast("⚠️ Chưa có OpenAI API key. Vào ⚙️ Settings để thêm.", "error");
      return;
    }

    setAiGenerating(true);
    try {
      const result = await generateStoryboardWithAI({
        project: currentProject,
        provider: selectedProvider,
        formatPreference: forceFormat || "auto",
        brandName: storyboard.brandName,
        tagline: storyboard.tagline,
      });

      // Convert AI frames to project frames format
      const projectFrames = result.frames.map((f) => ({
        num: f.num,
        timing: f.timing,
        role: f.role,
        action: f.actionEn,        // English used in prompt assembly
        actionVi: f.actionVi,      // Vietnamese for user editing
        actionEn: f.actionEn,
      }));

      updateStoryboard({
        format: result.format,
        frames: projectFrames,
        aiProvider: selectedProvider,
        aiReasoning: result.reasoning,
      });

      showToast(
        `✓ ${selectedProvider === "gemini" ? "Gemini" : "ChatGPT"} đã tạo ${result.frames.length} cảnh (${result.format})`,
        "success"
      );
    } catch (e: any) {
      showToast(`Lỗi AI: ${e.message}`, "error");
    } finally {
      setAiGenerating(false);
    }
  };

  // v0.7.1: Frame edit with VN/EN dual support
  const handleFrameEdit = (idx: number, field: "role" | "action" | "actionVi", value: string) => {
    const newFrames = [...currentFrames];
    if (field === "actionVi") {
      // User edits Vietnamese — clear English so it'll be re-translated, OR keep English as-is
      newFrames[idx] = { ...newFrames[idx], actionVi: value, action: value, actionEn: value };
    } else {
      newFrames[idx] = { ...newFrames[idx], [field]: value };
    }
    updateStoryboard({ frames: newFrames });
  };

  // v0.7.1: Frame-level operations (Hướng A)

  const snapshotVersion = (changeDescription: string) => {
    const versions = storyboard.versions || [];
    const newVersions = createVersion(currentFrames, format, changeDescription, versions);
    return newVersions;
  };

  const handleToggleLock = (idx: number) => {
    const newFrames = [...currentFrames];
    newFrames[idx] = {
      ...newFrames[idx],
      locked: !newFrames[idx].locked,
      id: newFrames[idx].id || generateFrameId(),
    };
    updateStoryboard({ frames: newFrames });
  };

  const handleInsertAfter = (idx: number) => {
    if (currentFrames.length >= 16) {
      showToast("⚠️ Tối đa 16 cảnh", "error");
      return;
    }
    const newFrames = insertFrameAfter(currentFrames, idx, {
      id: generateFrameId(),
      role: "Scene",
      action: "(Cảnh mới — mô tả hành động)",
      actionVi: "(Cảnh mới — mô tả hành động)",
      actionEn: "(New scene — describe action)",
    } as any);
    const versions = snapshotVersion(`Thêm cảnh sau #${idx + 1}`);
    updateStoryboard({ frames: newFrames, versions });
    showToast(`✓ Thêm cảnh sau #${idx + 1}`, "success");
  };

  const handleDeleteFrame = (idx: number) => {
    if (currentFrames.length <= 1) {
      showToast("Không thể xóa cảnh cuối cùng", "error");
      return;
    }
    if (!confirm(`Xóa cảnh #${idx + 1}?`)) return;
    const newFrames = deleteFrame(currentFrames, idx);
    const versions = snapshotVersion(`Xóa cảnh #${idx + 1}`);
    updateStoryboard({ frames: newFrames, versions });
    showToast(`✓ Đã xóa cảnh #${idx + 1}`, "success");
  };

  const handleMoveFrame = (idx: number, direction: "up" | "down") => {
    const newFrames = moveFrame(currentFrames, idx, direction);
    if (newFrames === currentFrames) return; // No change
    updateStoryboard({ frames: newFrames });
  };

  // v0.7.1: AI Regenerate text for ONE frame (preserves surrounding context)
  const handleRegenerateFrameText = async (idx: number) => {
    const userRequest = prompt(
      `Mô tả thay đổi cho cảnh #${idx + 1} (optional, bỏ trống để AI tự cải thiện):`,
      ""
    );
    if (userRequest === null) return;

    if (selectedProvider === "gemini" && !hasGeminiKey) {
      showToast("⚠️ Cần Gemini API key", "error");
      return;
    }
    if (selectedProvider === "openai" && !hasOpenAIKey) {
      showToast("⚠️ Cần OpenAI API key", "error");
      return;
    }

    setRegeneratingFrameIdx(idx);
    try {
      const result = await regenerateFrameText({
        allFrames: currentFrames as any,
        targetIdx: idx,
        userRequest: userRequest || undefined,
        project: currentProject,
        provider: selectedProvider,
      });

      const newFrames = [...currentFrames];
      newFrames[idx] = {
        ...newFrames[idx],
        id: newFrames[idx].id || generateFrameId(),
        role: result.role,
        action: result.actionEn,
        actionVi: result.actionVi,
        actionEn: result.actionEn,
        regenCount: ((newFrames[idx] as any).regenCount || 0) + 1,
      };
      const versions = snapshotVersion(`Regen text cảnh #${idx + 1}${userRequest ? ` (${userRequest.slice(0, 30)}...)` : ""}`);
      updateStoryboard({ frames: newFrames, versions });
      showToast(`✓ Đã regen text cảnh #${idx + 1}`, "success");
    } catch (e: any) {
      showToast(`Lỗi: ${e.message}`, "error");
    } finally {
      setRegeneratingFrameIdx(null);
    }
  };

  // v0.7.1: Bulk lock/unlock all
  const handleLockAll = () => {
    const newFrames = currentFrames.map((f) => ({
      ...f,
      id: f.id || generateFrameId(),
      locked: true,
    }));
    updateStoryboard({ frames: newFrames });
    showToast("✓ Đã lock tất cả cảnh", "success");
  };

  const handleUnlockAll = () => {
    const newFrames = currentFrames.map((f) => ({ ...f, locked: false }));
    updateStoryboard({ frames: newFrames });
    showToast("✓ Đã unlock tất cả cảnh", "success");
  };

  // v0.7.1: Versioning - revert to specific version
  const handleRevertToVersion = (versionId: string) => {
    const versions = storyboard.versions || [];
    const target = versions.find((v) => v.id === versionId);
    if (!target) return;
    if (!confirm(`Revert về ${target.label}? (${target.changeDescription})\nState hiện tại sẽ được lưu thành version mới trước khi revert.`)) return;

    // First snapshot current state
    const updatedVersions = createVersion(
      currentFrames,
      format,
      "Trước khi revert",
      versions
    );

    updateStoryboard({
      frames: target.frames as any,
      format: target.format as any,
      versions: updatedVersions,
    });
    showToast(`✓ Đã revert về ${target.label}`, "success");
  };

  const handleRegenerateFrameImage = (idx: number) => {
    const userRequest = prompt(
      `Mô tả thay đổi visual cho ảnh cảnh #${idx + 1} (vd: "đổi pose, đặt sản phẩm gần camera hơn"):`,
      ""
    );
    if (userRequest === null) return;

    const targetFrame = currentFrames[idx] as any;
    const promptText = generateSingleFramePrompt({
      project: currentProject,
      frame: {
        num: idx + 1,
        role: targetFrame.role,
        action: targetFrame.action,
        actionVi: targetFrame.actionVi,
      },
      prevFrame: idx > 0 ? (currentFrames[idx - 1] as any) : undefined,
      nextFrame: idx < currentFrames.length - 1 ? (currentFrames[idx + 1] as any) : undefined,
      userRequest: userRequest || undefined,
      brandName: storyboard.brandName,
    });

    setSingleFrameRegenPrompt({ idx, prompt: promptText });
  };

  const handleGenerateStoryboardPrompt = () => {
    try {
      const customArc = { ...arc, frames: currentFrames };
      const prompt = generateStoryboardPrompt({
        arc: customArc,
        project: currentProject,
        brandName: storyboard.brandName,
        tagline: storyboard.tagline,
      });
      setStoryboardPrompt(prompt);
      showToast(`✓ Đã generate storyboard prompt (${prompt.length} chars)`, "success");
    } catch (e: any) {
      showToast(`Lỗi: ${e.message}`, "error");
    }
  };

  const handleCopyStoryboardPrompt = async () => {
    if (!storyboardPrompt) return;
    await navigator.clipboard.writeText(storyboardPrompt);
    showToast("Đã copy prompt", "success");
  };

  // v0.6.7: Download storyboard prompt + reference images as ZIP
  // Critical fix: User needed an easy way to get references with the prompt
  const handleDownloadStoryboardPackage = async () => {
    if (!storyboardPrompt) {
      showToast("Generate prompt trước", "error");
      return;
    }
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      // Add prompt
      zip.file("storyboard_prompt.txt", storyboardPrompt);

      // Collect all reference images in order: faces, outfit, products
      const refIds = (currentProject as any).refImageIds || {};
      const faces: string[] = refIds.faces || (refIds.face ? [refIds.face] : []);
      const allRefs: { id: string; roleHint: string }[] = [];

      const FACE_HINTS = ["face_front", "face_3-4_left", "face_3-4_right", "face_side_profile", "face_looking_up", "face_other_angle"];
      faces.forEach((fid: string, i: number) => {
        if (fid) allRefs.push({ id: fid, roleHint: FACE_HINTS[i] || `face_${i + 1}` });
      });
      if (refIds.outfit) {
        allRefs.push({ id: refIds.outfit, roleHint: "outfit" });
      }
      if (refIds.products) {
        refIds.products.forEach((pid: string, i: number) => {
          if (pid) allRefs.push({ id: pid, roleHint: `product_${i + 1}` });
        });
      }

      // Add reference images with numeric prefixes
      let imageCount = 0;
      for (let i = 0; i < allRefs.length; i++) {
        const ref = await getReferenceImage(allRefs[i].id);
        if (!ref) continue;
        const num = String(i + 1).padStart(2, "0");
        const ext = ref.blob.type.split("/")[1] || "png";
        zip.file(`${num}_${allRefs[i].roleHint}.${ext}`, ref.blob);
        imageCount++;
      }

      // Add README
      const readme = `# Storyboard Generation Package

## Project: ${currentProject.name}
- Format: ${format}
- Brand: ${storyboard.brandName || "(none)"}
- AI provider: ${storyboard.aiProvider || "template"}

## Cách sử dụng

1. Mở Banana Pro Pro (https://gemini.google.com/) hoặc Imagen 3
2. Paste nội dung file \`storyboard_prompt.txt\` vào ô prompt
3. Upload ${imageCount} reference images theo đúng thứ tự:
${allRefs.slice(0, imageCount).map((r, i) => `   - ${String(i + 1).padStart(2, "0")}_${r.roleHint}.* → upload vị trí thứ ${i + 1}`).join("\n")}
4. Generate → ra grid ${format} image
5. Quay lại extension → Tab "2. Upload Grid" → upload grid này
6. Click "Auto-crop" → 9 frame riêng biệt
7. Tab "3. Animation" → generate 8 animation prompts
8. Dùng Kling/Veo3 + animation prompts + frames để tạo TVC

## Important
- Đảm bảo upload references ĐÚNG THỨ TỰ - file 01 = vị trí thứ 1
- Banana Pro Pro hỗ trợ tốt hơn Banana Pro thường cho task này
- Nếu kết quả face không giống >90%, dùng Higgsfield Soul ID (xem ⚙️ Settings)

Generated: ${new Date().toLocaleString("vi-VN")}
`;
      zip.file("README.md", readme);

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `storyboard-${currentProject.name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`✓ Đã download ZIP (${imageCount} refs + prompt)`, "success");
    } catch (e: any) {
      showToast(`Lỗi: ${e.message}`, "error");
    }
  };

  const handleGridUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      showToast("Chỉ hỗ trợ file ảnh", "error");
      return;
    }
    try {
      const id = await saveReferenceImage({
        blob: file,
        category: "storyboard_grid" as any,
        tags: ["storyboard", "grid", format],
        source: "upload",
      });
      updateStoryboard({ gridImageId: id });
      showToast(`✓ Đã upload grid ${format}`, "success");
    } catch (e: any) {
      showToast(`Lỗi: ${e.message}`, "error");
    }
  };

  // Load grid blob URL for preview
  useEffect(() => {
    let url: string | null = null;
    if (storyboard.gridImageId) {
      getReferenceImage(storyboard.gridImageId).then((ref) => {
        if (ref) {
          url = URL.createObjectURL(ref.blob);
          setGridImageBlobUrl(url);
        }
      });
    } else {
      setGridImageBlobUrl(null);
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [storyboard.gridImageId]);

  const handleAutoCropGrid = async () => {
    if (!storyboard.gridImageId) {
      showToast("Upload grid image trước", "error");
      return;
    }
    try {
      const ref = await getReferenceImage(storyboard.gridImageId);
      if (!ref) throw new Error("Grid image not found");

      const [cols, rows] = format.split("x").map(Number);
      const totalCells = cols * rows;

      // Load image to canvas
      const img = new Image();
      const blobUrl = URL.createObjectURL(ref.blob);
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = blobUrl;
      });

      const cellWidth = img.width / cols;
      const cellHeight = img.height / rows;
      const croppedIds: string[] = [];

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const canvas = document.createElement("canvas");
          canvas.width = cellWidth;
          canvas.height = cellHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;

          ctx.drawImage(
            img,
            col * cellWidth,
            row * cellHeight,
            cellWidth,
            cellHeight,
            0,
            0,
            cellWidth,
            cellHeight
          );

          const blob = await new Promise<Blob>((resolve) => {
            canvas.toBlob((b) => resolve(b!), "image/png");
          });

          const cellNum = row * cols + col + 1;
          const id = await saveReferenceImage({
            blob,
            category: "storyboard_frame" as any,
            tags: ["storyboard", "frame", `frame_${cellNum}`],
            source: "upload",
          });
          croppedIds.push(id);
        }
      }

      URL.revokeObjectURL(blobUrl);
      updateStoryboard({ croppedFrameIds: croppedIds });
      showToast(`✓ Đã crop ${totalCells} frames riêng từ grid`, "success");
    } catch (e: any) {
      showToast(`Lỗi crop: ${e.message}`, "error");
    }
  };

  const handleGenerateAnimationPrompts = () => {
    try {
      const customArc = { ...arc, frames: currentFrames };
      const cam = storyboard.cameraMovement || "subtle";

      // Per-pair (Kling/Veo3 traditional workflow)
      const pairs = generateAnimationPrompts({ arc: customArc, cameraStyle: cam });
      setAnimationPairs(pairs);

      // v0.7.0: Provider-aware chunked prompts (the new primary output)
      const plan = planChunks(currentFrames, videoProvider, targetDuration);
      setChunkPlan(plan);
      // v0.8.0: Pass film context if in film mode
      const filmCharactersForPrompt = isFilmMode
        ? ((currentProject as any).filmCharacters || []).map((c: any) => ({
            name: c.name,
            role: c.role,
            description: c.description,
          }))
        : undefined;
      const chunks = generateProviderAwarePrompts({
        plan,
        cameraStyle: cam,
        brandName: storyboard.brandName,
        tagline: storyboard.tagline,
        aspectRatio: videoAspectRatio,
        isFilmMode,
        animationStyle: isFilmMode ? (currentProject as any).animationStyle : undefined,
        filmGenre: isFilmMode ? filmGenre : undefined,
        filmCharacters: filmCharactersForPrompt,
      });
      setChunkPrompts(chunks);

      showToast(
        `✓ Generated ${chunks.length} ${PROVIDERS[videoProvider].name} prompt${chunks.length > 1 ? "s" : ""} + ${pairs.length} per-pair`,
        "success"
      );
    } catch (e: any) {
      showToast(`Lỗi: ${e.message}`, "error");
    }
  };

  // v0.7.0: Copy individual chunk prompt
  const handleCopyChunkPrompt = async (chunkNum: number) => {
    const chunk = chunkPrompts.find((c) => c.chunkNum === chunkNum);
    if (!chunk) return;
    await navigator.clipboard.writeText(chunk.prompt);
    showToast(`✓ Đã copy prompt chunk ${chunkNum}/${chunk.totalChunks}`, "success");
  };

  const handleDownloadAnimationZip = async () => {
    if (animationPairs.length === 0) {
      showToast("Generate animation prompts trước", "error");
      return;
    }
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      // Add cropped frames if available
      if (storyboard.croppedFrameIds && storyboard.croppedFrameIds.length > 0) {
        for (let i = 0; i < storyboard.croppedFrameIds.length; i++) {
          const ref = await getReferenceImage(storyboard.croppedFrameIds[i]);
          if (!ref) continue;
          const frameNum = String(i + 1).padStart(2, "0");
          zip.file(`frame_${frameNum}.png`, ref.blob);
        }
      }

      // Add original grid if available
      if (storyboard.gridImageId) {
        const ref = await getReferenceImage(storyboard.gridImageId);
        if (ref) {
          zip.file(`grid_${format}.png`, ref.blob);
        }
      }

      // Add storyboard prompt
      if (storyboardPrompt) {
        zip.file("0_storyboard_prompt.txt", storyboardPrompt);
      }

      // v0.7.0: Add provider-aware chunked prompts + stitching guide (PRIMARY output)
      if (chunkPrompts.length > 0 && chunkPlan) {
        const providerName = chunkPlan.provider.id;
        const folder = `${providerName}_${chunkPlan.targetDuration}s`;
        chunkPrompts.forEach((chunk) => {
          const num = String(chunk.chunkNum).padStart(2, "0");
          zip.file(
            `${folder}/prompt_chunk_${num}.txt`,
            chunk.prompt
          );
        });
        // Stitching guide
        const stitchGuide = generateStitchingGuide(chunkPlan, storyboard.brandName, videoAspectRatio);
        zip.file(`${folder}/STITCHING_GUIDE.md`, stitchGuide);
      }

      // Add each animation prompt as separate file (for Kling/Veo3/Runway)
      animationPairs.forEach((pair, idx) => {
        const num = String(idx + 1).padStart(2, "0");
        const fromN = String(pair.fromFrame).padStart(2, "0");
        const toN = String(pair.toFrame).padStart(2, "0");
        zip.file(`animation_${num}_frame${fromN}_to_frame${toN}.txt`, pair.prompt);
      });

      // Add README
      const customArc = { ...arc, frames: currentFrames };
      const readme = generateAnimationReadme(customArc, animationPairs);
      zip.file("README.md", readme);

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tvc-storyboard-${currentProject.name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("✓ ZIP downloaded", "success");
    } catch (e: any) {
      showToast(`Lỗi: ${e.message}`, "error");
    }
  };

  if (!storyboard.enabled) {
    return (
      <Section title="🎬 TVC Storyboard Generator (v0.6)">
        <div className="p-3 bg-ksp-accent/5 border border-ksp-accent/30 rounded">
          <p className="text-xs text-ksp-text mb-2">
            <strong>Tính năng mới v0.6:</strong> Generate storyboard prompt + animation prompts cho TVC commercial.
          </p>
          <p className="text-[11px] text-ksp-muted mb-3 leading-relaxed">
            Pipeline: Bạn nhập ý tưởng → KSP tạo prompt grid → bạn dùng AI khác (Banana Pro) tạo grid 3x3 → upload trở lại → KSP tạo 8 animation prompts → bạn dùng AI video (Kling/Veo3) tạo 8 clips → ghép thành TVC ~30s.
          </p>
          <button
            onClick={handleEnableStoryboard}
            className="w-full py-2 bg-ksp-accent text-black rounded text-xs font-semibold hover:opacity-90"
          >
            🎬 Bật Storyboard Generator
          </button>
        </div>
      </Section>
    );
  }

  return (
    <Section title="🎬 TVC Storyboard Generator">
      {/* v0.6.8: Color-coded tabs for visual distinction */}
      <div className="flex gap-1 border-b border-ksp-border pb-2">
        <TabBtn active={activeTab === "setup"} onClick={() => setActiveTab("setup")} color="blue">
          1. 📝 Setup & Prompt
        </TabBtn>
        <TabBtn active={activeTab === "grid"} onClick={() => setActiveTab("grid")} color="orange">
          2. 📤 Upload Grid
        </TabBtn>
        <TabBtn active={activeTab === "animate"} onClick={() => setActiveTab("animate")} color="pink">
          3. 🎬 Animation
        </TabBtn>
      </div>

      {/* TAB 1: Setup */}
      {activeTab === "setup" && (
        <div className="space-y-3">
          {/* v0.6.5: AI Generate Section - PRIMARY action */}
          <div className="p-3 bg-purple-500/5 border border-purple-500/30 rounded space-y-2">
            <div className="flex items-center justify-between">
              <label className="!mb-0 text-purple-400">🤖 Tạo cảnh từ ý tưởng (AI)</label>
              {storyboard.aiProvider && storyboard.aiProvider !== "template" && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
                  Đã tạo bằng {storyboard.aiProvider === "gemini" ? "Gemini" : "ChatGPT"}
                </span>
              )}
            </div>

            <p className="text-[10px] text-ksp-muted leading-relaxed">
              AI đọc <strong>"Mô tả ý tưởng"</strong> + product + industry → tạo cảnh tailored cho TVC.
              Format và số cảnh được AI tự chọn dựa trên độ phức tạp của idea.
            </p>

            {/* Provider selector */}
            <div className="space-y-1">
              <label className="text-[10px] !mb-1">AI Provider:</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setSelectedProvider("gemini")}
                  disabled={!hasGeminiKey}
                  className={`p-2 rounded text-[11px] border transition-colors text-left ${
                    selectedProvider === "gemini"
                      ? "bg-purple-500/20 border-purple-500/60 text-purple-400"
                      : "bg-ksp-bg border-ksp-border hover:border-purple-500/40"
                  } ${!hasGeminiKey ? "opacity-40 cursor-not-allowed" : ""}`}
                  title={hasGeminiKey ? "Gemini 2.0 Flash" : "Chưa có Gemini API key"}
                >
                  <div className="font-medium">⚡ Gemini Flash</div>
                  <div className="text-[9px] text-ksp-muted">{hasGeminiKey ? "Free, nhanh" : "Cần API key"}</div>
                </button>
                <button
                  onClick={() => setSelectedProvider("openai")}
                  disabled={!hasOpenAIKey}
                  className={`p-2 rounded text-[11px] border transition-colors text-left ${
                    selectedProvider === "openai"
                      ? "bg-purple-500/20 border-purple-500/60 text-purple-400"
                      : "bg-ksp-bg border-ksp-border hover:border-purple-500/40"
                  } ${!hasOpenAIKey ? "opacity-40 cursor-not-allowed" : ""}`}
                  title={hasOpenAIKey ? "GPT-4o-mini" : "Chưa có OpenAI API key"}
                >
                  <div className="font-medium">🧠 ChatGPT</div>
                  <div className="text-[9px] text-ksp-muted">{hasOpenAIKey ? "Trả phí, chất lượng" : "Cần API key"}</div>
                </button>
              </div>
              {!hasGeminiKey && !hasOpenAIKey && (
                <p className="text-[10px] text-yellow-500 mt-1">
                  ⚠️ Chưa có API key nào. Vào ⚙️ Settings để thêm Gemini hoặc OpenAI key.
                </p>
              )}
            </div>

            {/* Big AI generate button */}
            <button
              onClick={() => handleAIGenerate("auto")}
              disabled={aiGenerating || (!hasGeminiKey && !hasOpenAIKey)}
              className="w-full py-2.5 bg-purple-500 text-white rounded text-sm font-semibold hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {aiGenerating ? "⏳ Đang tạo..." : "🤖 AI tạo cảnh từ ý tưởng (auto format)"}
            </button>

            {/* AI reasoning if available */}
            {storyboard.aiReasoning && (
              <div className="p-2 bg-ksp-bg/50 rounded text-[10px] text-ksp-muted leading-relaxed italic">
                💭 <strong>AI giải thích:</strong> {storyboard.aiReasoning}
              </div>
            )}
          </div>

          {/* Format override (only if user wants manual control) */}
          <details className="border border-ksp-border rounded">
            <summary className="cursor-pointer p-2 text-[11px] text-ksp-muted hover:text-ksp-text">
              ⚙️ Override format thủ công ({format} hiện tại)
            </summary>
            <div className="p-2 space-y-2 border-t border-ksp-border">
              <p className="text-[10px] text-ksp-muted leading-relaxed">
                Mặc định AI tự chọn format. Nếu muốn force, chọn 1 format và click AI tạo lại.
              </p>
              <div className="grid grid-cols-2 gap-1">
                {(Object.keys(FORMAT_CONFIGS) as GridFormat[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => handleFormatChange(f)}
                    className={`p-2 rounded text-[11px] border transition-colors text-left ${
                      format === f
                        ? "bg-ksp-accent text-black border-ksp-accent"
                        : "bg-ksp-bg border-ksp-border hover:border-ksp-accent/50"
                    }`}
                  >
                    <div className="font-medium">{FORMAT_CONFIGS[f].label}</div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => handleAIGenerate(format)}
                disabled={aiGenerating || (!hasGeminiKey && !hasOpenAIKey)}
                className="w-full py-1.5 bg-ksp-accent text-black rounded text-[11px] font-medium hover:opacity-90 disabled:opacity-30"
              >
                🤖 AI tạo lại với format {format}
              </button>
            </div>
          </details>

          {/* Brand info */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label>Brand name (logo)</label>
              <input
                type="text"
                value={storyboard.brandName || ""}
                onChange={(e) => updateStoryboard({ brandName: e.target.value })}
                placeholder="Vichy"
                className="text-xs"
              />
            </div>
            <div>
              <label>Tagline (optional)</label>
              <input
                type="text"
                value={storyboard.tagline || ""}
                onChange={(e) => updateStoryboard({ tagline: e.target.value })}
                placeholder="Healthy skin every day"
                className="text-xs"
              />
            </div>
          </div>

          {/* v0.7.1: Bulk actions */}
          <div className="flex items-center gap-1.5 flex-wrap p-2 bg-ksp-bg/30 border border-ksp-border rounded">
            <span className="text-[10px] text-ksp-muted">Bulk:</span>
            <button
              onClick={handleLockAll}
              className="text-[10px] px-2 py-1 bg-ksp-bg border border-ksp-border rounded hover:border-ksp-accent"
              title="Lock tất cả cảnh — không bị thay đổi khi AI regen"
            >
              🔒 Lock all
            </button>
            <button
              onClick={handleUnlockAll}
              className="text-[10px] px-2 py-1 bg-ksp-bg border border-ksp-border rounded hover:border-ksp-accent"
            >
              🔓 Unlock all
            </button>
            <span className="text-[10px] text-ksp-muted ml-auto">
              {currentFrames.filter((f: any) => f.locked).length}/{currentFrames.length} locked
            </span>
          </div>

          {/* v0.7.1: Version history (collapsible) */}
          {(storyboard.versions?.length || 0) > 0 && (
            <details className="border border-ksp-border rounded">
              <summary className="cursor-pointer p-2 text-[11px] text-ksp-muted hover:text-ksp-text">
                📜 Lịch sử chỉnh sửa ({storyboard.versions?.length || 0} versions)
              </summary>
              <div className="p-2 space-y-1.5 border-t border-ksp-border max-h-48 overflow-y-auto">
                {(storyboard.versions || []).map((v: StoryboardVersion) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between gap-2 p-1.5 bg-ksp-bg/30 rounded text-[10px]"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-ksp-accent font-mono">{v.label}</div>
                      <div className="text-ksp-muted truncate">
                        {v.changeDescription || "(no description)"}
                      </div>
                      <div className="text-ksp-muted/60 text-[9px]">
                        {formatRelativeTime(v.timestamp)} · {v.frames.length} cảnh
                      </div>
                    </div>
                    <button
                      onClick={() => handleRevertToVersion(v.id)}
                      className="text-[10px] px-2 py-0.5 bg-yellow-500/20 text-yellow-500 rounded hover:bg-yellow-500/30"
                      title="Revert về version này"
                    >
                      ↺ Revert
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Frame editor */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="!mb-0">
                📋 Story Arc ({currentFrames.length} cảnh, format {format})
              </label>
              <button
                onClick={handleResetArc}
                className="text-[10px] text-ksp-muted hover:text-ksp-text"
                title="Reset về template generic"
              >
                ↺ Reset template
              </button>
            </div>
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {currentFrames.map((frame, idx) => {
                const isLocked = (frame as any).locked;
                const isRegen = regeneratingFrameIdx === idx;
                const regenCount = (frame as any).regenCount || 0;
                return (
                  <div
                    key={(frame as any).id || idx}
                    className={`p-2 border rounded space-y-1 ${
                      isLocked
                        ? "bg-ksp-good/5 border-ksp-good/40"
                        : "bg-ksp-bg/40 border-ksp-border"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] flex-wrap">
                      <span className="font-mono text-ksp-accent">#{frame.num}</span>
                      <span className="text-ksp-muted">{frame.timing}</span>
                      <input
                        type="text"
                        value={frame.role}
                        onChange={(e) => handleFrameEdit(idx, "role", e.target.value)}
                        className="text-[10px] flex-1 min-w-[60px] px-1.5 py-0.5"
                        disabled={isLocked}
                      />
                      {regenCount > 0 && (
                        <span className="text-[9px] px-1 bg-purple-500/20 text-purple-400 rounded" title="Số lần đã regenerate">
                          ↻{regenCount}
                        </span>
                      )}
                      {/* Action buttons */}
                      <div className="flex gap-0.5">
                        <button
                          onClick={() => handleToggleLock(idx)}
                          className={`text-[10px] px-1.5 py-0.5 rounded ${
                            isLocked
                              ? "bg-ksp-good/20 text-ksp-good"
                              : "bg-ksp-bg border border-ksp-border hover:border-ksp-good"
                          }`}
                          title={isLocked ? "Đã lock — click để unlock" : "Lock cảnh này"}
                        >
                          {isLocked ? "🔒" : "🔓"}
                        </button>
                        <button
                          onClick={() => handleMoveFrame(idx, "up")}
                          disabled={idx === 0 || isLocked}
                          className="text-[10px] px-1.5 py-0.5 bg-ksp-bg border border-ksp-border rounded hover:border-ksp-accent disabled:opacity-30"
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => handleMoveFrame(idx, "down")}
                          disabled={idx === currentFrames.length - 1 || isLocked}
                          className="text-[10px] px-1.5 py-0.5 bg-ksp-bg border border-ksp-border rounded hover:border-ksp-accent disabled:opacity-30"
                          title="Move down"
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => handleRegenerateFrameText(idx)}
                          disabled={isLocked || isRegen}
                          className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400 border border-purple-500/40 rounded hover:bg-purple-500/30 disabled:opacity-30"
                          title="AI viết lại text cảnh này"
                        >
                          {isRegen ? "⏳" : "🔄"}
                        </button>
                        <button
                          onClick={() => handleInsertAfter(idx)}
                          className="text-[10px] px-1.5 py-0.5 bg-ksp-bg border border-ksp-border rounded hover:border-ksp-accent"
                          title="Thêm cảnh mới sau cảnh này"
                        >
                          ➕
                        </button>
                        <button
                          onClick={() => handleDeleteFrame(idx)}
                          disabled={currentFrames.length <= 1}
                          className="text-[10px] px-1.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20 disabled:opacity-30"
                          title="Xóa cảnh"
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                    {/* Show Vietnamese version if available, else English */}
                    {(frame as any).actionVi !== undefined ? (
                      <>
                        <textarea
                          value={(frame as any).actionVi || ""}
                          onChange={(e) => handleFrameEdit(idx, "actionVi", e.target.value)}
                          rows={2}
                          className="text-[11px] w-full"
                          placeholder="Mô tả cảnh bằng tiếng Việt..."
                          disabled={isLocked}
                        />
                        <details className="text-[9px]">
                          <summary className="cursor-pointer text-ksp-muted">
                            🇬🇧 EN (sẽ dùng trong prompt cuối)
                          </summary>
                          <textarea
                            value={frame.action}
                            onChange={(e) => handleFrameEdit(idx, "action", e.target.value)}
                            rows={2}
                            className="text-[10px] w-full mt-1 font-mono"
                            placeholder="English action..."
                            disabled={isLocked}
                          />
                        </details>
                      </>
                    ) : (
                      <textarea
                        value={frame.action}
                        onChange={(e) => handleFrameEdit(idx, "action", e.target.value)}
                        rows={2}
                        className="text-[11px] w-full"
                        placeholder="Mô tả action..."
                        disabled={isLocked}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerateStoryboardPrompt}
            className="w-full py-2.5 bg-ksp-accent text-black rounded text-sm font-semibold hover:opacity-90"
          >
            ⚡ Generate Storyboard Prompt
          </button>

          {/* Output */}
          {storyboardPrompt && (
            <div className="space-y-2 pt-2 border-t border-ksp-border">
              <div className="flex items-center justify-between">
                <label className="!mb-0 text-ksp-good">✓ Storyboard prompt sẵn sàng</label>
                <div className="flex gap-1">
                  <button
                    onClick={handleCopyStoryboardPrompt}
                    className="text-[11px] px-2 py-1 bg-ksp-bg border border-ksp-border rounded hover:border-ksp-accent"
                  >
                    📋 Copy
                  </button>
                  <button
                    onClick={handleDownloadStoryboardPackage}
                    className="text-[11px] px-2 py-1 bg-ksp-accent text-black rounded font-medium hover:opacity-90"
                    title="Download ZIP gồm prompt + tất cả reference images đã đặt tên đúng thứ tự"
                  >
                    📦 ZIP (prompt + refs)
                  </button>
                </div>
              </div>

              {/* v0.6.7: Reference images checklist - shows what's included */}
              {(() => {
                const refIds = (currentProject as any).refImageIds || {};
                const faces: string[] = refIds.faces || (refIds.face ? [refIds.face] : []);
                const outfitId = refIds.outfit;
                const productIds: string[] = refIds.products || [];
                const totalRefs = faces.length + (outfitId ? 1 : 0) + productIds.length;

                if (totalRefs === 0) {
                  return (
                    <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-[10px] text-yellow-500 leading-relaxed">
                      ⚠️ <strong>Chưa có reference images!</strong> Lên section "📷 Hình tham chiếu" upload face/outfit/product trước khi generate prompt — không có refs thì AI sẽ tạo person/product ngẫu nhiên.
                    </div>
                  );
                }

                return (
                  <div className="p-2 bg-ksp-good/10 border border-ksp-good/30 rounded text-[10px] leading-relaxed">
                    <div className="text-ksp-good font-medium mb-1">✓ Prompt đã include {totalRefs} reference image(s):</div>
                    <ul className="text-ksp-text/80 space-y-0.5">
                      {faces.length > 0 && (
                        <li>• {faces.length} face reference{faces.length > 1 ? "s" : ""} (Image #1{faces.length > 1 ? `-#${faces.length}` : ""})</li>
                      )}
                      {outfitId && (
                        <li>• 1 outfit reference (Image #{faces.length + 1})</li>
                      )}
                      {productIds.length > 0 && (
                        <li>• {productIds.length} product reference{productIds.length > 1 ? "s" : ""} (Image #{faces.length + (outfitId ? 1 : 0) + 1}{productIds.length > 1 ? `-#${faces.length + (outfitId ? 1 : 0) + productIds.length}` : ""})</li>
                      )}
                    </ul>
                  </div>
                );
              })()}

              <textarea
                value={storyboardPrompt}
                readOnly
                rows={8}
                className="font-mono text-[10px] bg-ksp-bg/50"
              />
              <p className="text-[10px] text-ksp-muted italic leading-relaxed">
                💡 <strong>Recommend:</strong> Click <strong>"📦 ZIP (prompt + refs)"</strong> → giải nén → upload tất cả file vào Banana Pro Pro <strong>đúng thứ tự</strong> (01_, 02_, 03_...) + paste prompt. Nếu chỉ click Copy thì phải tự nhớ upload references.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Upload grid */}
      {activeTab === "grid" && (
        <div className="space-y-3">
          <div>
            <label>Upload grid {format} image (đã tạo bởi Banana Pro)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleGridUpload(file);
              }}
              className="text-xs"
            />
          </div>

          {gridImageBlobUrl && (
            <div className="space-y-2">
              <p className="text-[11px] text-ksp-good">✓ Grid uploaded</p>
              <img
                src={gridImageBlobUrl}
                alt="Grid"
                className="w-full rounded border border-ksp-border"
              />
              <button
                onClick={handleAutoCropGrid}
                className="w-full py-2 bg-ksp-accent text-black rounded text-xs font-semibold hover:opacity-90"
              >
                ✂️ Auto-crop thành {formatConfig.cells} ảnh riêng
              </button>
            </div>
          )}

          {storyboard.croppedFrameIds && storyboard.croppedFrameIds.length > 0 && (
            <div className="pt-2 border-t border-ksp-border space-y-2">
              <p className="text-[11px] text-ksp-good">
                ✓ Đã crop {storyboard.croppedFrameIds.length} frames riêng
              </p>

              {/* v0.7.1: Per-frame thumbnails with regenerate buttons */}
              <div>
                <label className="!mb-1">🔄 Regenerate frame riêng (Hướng B)</label>
                <p className="text-[10px] text-ksp-muted leading-relaxed mb-2">
                  Click button "🔄" trên từng frame để generate prompt cho việc tạo lại ảnh đó. Copy prompt vào Banana Pro + upload references → ra ảnh mới → upload thay thế.
                </p>
                <CroppedFramesGrid
                  frameIds={storyboard.croppedFrameIds}
                  onRegenerateFrame={handleRegenerateFrameImage}
                />
              </div>

              {/* v0.7.1: Single-frame regen prompt display */}
              {singleFrameRegenPrompt && (
                <div className="p-3 bg-purple-500/10 border-2 border-purple-500/40 rounded space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="!mb-0 text-purple-400">
                      🔄 Single-Frame Regen Prompt — Frame #{singleFrameRegenPrompt.idx + 1}
                    </label>
                    <div className="flex gap-1">
                      <button
                        onClick={async () => {
                          await navigator.clipboard.writeText(singleFrameRegenPrompt.prompt);
                          showToast("Đã copy prompt", "success");
                        }}
                        className="text-[11px] px-2 py-1 bg-purple-500 text-white rounded hover:opacity-90"
                      >
                        📋 Copy
                      </button>
                      <button
                        onClick={() => setSingleFrameRegenPrompt(null)}
                        className="text-[11px] px-2 py-1 bg-ksp-bg border border-ksp-border rounded hover:border-ksp-bad"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={singleFrameRegenPrompt.prompt}
                    readOnly
                    rows={6}
                    className="font-mono text-[9px] bg-ksp-bg/50 w-full"
                  />
                  <div className="text-[10px] text-ksp-muted leading-relaxed">
                    <div className="font-medium text-ksp-text mb-1">📋 Cách dùng:</div>
                    <ol className="space-y-0.5 ml-3 list-decimal">
                      <li>Copy prompt trên</li>
                      <li>Mở Banana Pro Pro</li>
                      <li>Upload face + outfit + product references (như cũ)</li>
                      <li>Paste prompt → generate 1 ảnh</li>
                      <li>Download → upload lại frame #{singleFrameRegenPrompt.idx + 1} để thay thế</li>
                    </ol>
                  </div>
                </div>
              )}

              <p className="text-[10px] text-ksp-muted italic leading-relaxed pt-2 border-t border-ksp-border">
                💡 Hoặc qua Tab "3. Animation" để generate prompts cho video AI.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Animation prompts */}
      {activeTab === "animate" && (
        <div className="space-y-3">
          <div>
            <label>Camera movement style</label>
            <select
              value={storyboard.cameraMovement || "subtle"}
              onChange={(e) =>
                updateStoryboard({ cameraMovement: e.target.value as any })
              }
              className="text-xs"
            >
              <option value="static">📷 Static - Camera đứng yên (cho TVC simple)</option>
              <option value="subtle">🎬 Subtle - Push-in nhẹ (recommend)</option>
              <option value="dynamic">⚡ Dynamic - Camera chuyển động mạnh</option>
              <option value="cinematic">🎥 Cinematic - Pro commercial feel</option>
            </select>
          </div>

          {/* v0.7.0: Provider + Target Duration selectors */}
          <div className="p-3 bg-pink-500/5 border border-pink-500/30 rounded space-y-2.5">
            <div className="text-[11px] text-pink-400 font-medium">
              🎯 Provider, Duration & Aspect Ratio
            </div>

            {/* Provider selector */}
            <div>
              <label className="text-[10px]">AI Video Provider</label>
              <select
                value={videoProvider}
                onChange={(e) => setVideoProvider(e.target.value as VideoProvider)}
                className="text-xs"
              >
                {(Object.keys(PROVIDERS) as VideoProvider[]).map((id) => {
                  const p = PROVIDERS[id];
                  return (
                    <option key={id} value={id}>
                      {p.name} — max {p.maxClipDuration}s/clip{p.hasNativeAudio ? " 🔊" : ""}
                    </option>
                  );
                })}
              </select>
              <p className="text-[10px] text-ksp-muted mt-1 leading-snug">
                {PROVIDERS[videoProvider].tagline}
                {PROVIDERS[videoProvider].notes && (
                  <span className="block mt-0.5 italic">
                    {PROVIDERS[videoProvider].notes}
                  </span>
                )}
              </p>
            </div>

            {/* v0.7.2: Duration + Aspect Ratio (independent dropdowns) */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px]">⏱ Duration</label>
                <select
                  value={targetDuration}
                  onChange={(e) => setTargetDuration(parseInt(e.target.value))}
                  className="text-xs"
                >
                  {TARGET_DURATIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px]">📐 Aspect Ratio</label>
                <select
                  value={videoAspectRatio}
                  onChange={(e) => setVideoAspectRatio(e.target.value as AspectRatioOption)}
                  className="text-xs"
                >
                  {ASPECT_RATIOS.map((ar) => {
                    const supportedRatios = getProviderAspectRatios(videoProvider);
                    const supported = supportedRatios.includes(ar.value);
                    return (
                      <option
                        key={ar.value}
                        value={ar.value}
                        disabled={!supported}
                      >
                        {ar.emoji} {ar.label}
                        {!supported ? " (provider không support)" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Aspect ratio description */}
            <div className="text-[10px] text-ksp-muted leading-snug px-1">
              {ASPECT_RATIOS.find((a) => a.value === videoAspectRatio)?.description}
            </div>

            {/* Live plan preview */}
            {(() => {
              const plan = planChunks(currentFrames, videoProvider, targetDuration);
              const warnings = validatePlan(plan);
              const cost = estimateCost(videoProvider, plan.actualDuration);

              return (
                <div className="p-2 bg-ksp-bg/50 rounded space-y-1.5 text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="text-ksp-muted">Plan:</span>
                    <span className={plan.isSingleShot ? "text-ksp-good font-medium" : "text-yellow-500 font-medium"}>
                      {plan.isSingleShot ? "✓ Single-shot" : `⚠ ${plan.chunks.length} chunks`}
                    </span>
                  </div>
                  <div className="text-ksp-text leading-relaxed">
                    {describePlan(plan)}
                  </div>
                  {!plan.isSingleShot && (
                    <div className="text-ksp-muted leading-snug pl-2 border-l-2 border-yellow-500/30">
                      Cần generate {plan.chunks.length} clips trên {PROVIDERS[videoProvider].name} → ghép lại trong CapCut
                    </div>
                  )}
                  {cost !== null && (
                    <div className="text-ksp-muted">
                      Cost ước tính: ~${cost.toFixed(2)} USD
                    </div>
                  )}
                  {warnings.length > 0 && (
                    <div className="space-y-0.5 pt-1 border-t border-ksp-border">
                      {warnings.map((w, i) => (
                        <div key={i} className="text-yellow-500">{w}</div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          <button
            onClick={handleGenerateAnimationPrompts}
            className="w-full py-2.5 bg-pink-500 text-white rounded text-sm font-semibold hover:opacity-90"
          >
            ⚡ Generate Animation Prompts
          </button>

          {/* v0.7.0: PROVIDER-AWARE CHUNK PROMPTS (primary output) */}
          {chunkPrompts.length > 0 && chunkPlan && (
            <div className="space-y-2 pt-2 border-t border-pink-500/30">
              <div className="p-3 bg-pink-500/10 border-2 border-pink-500/50 rounded space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <div>
                    <div className="text-[12px] font-semibold text-pink-400">
                      🎬 All Frames Prompt
                    </div>
                    <div className="text-[10px] text-ksp-muted">
                      {describePlan(chunkPlan)}
                    </div>
                  </div>
                  {chunkPlan.isSingleShot ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-ksp-good/20 text-ksp-good">
                      ✓ Single-shot
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-500">
                      {chunkPlan.chunks.length} chunks → stitch
                    </span>
                  )}
                </div>

                {!chunkPlan.isSingleShot && (
                  <div className="p-2 bg-ksp-bg/50 rounded text-[10px] text-ksp-muted leading-relaxed">
                    💡 <strong>Multi-chunk workflow:</strong> Generate từng clip riêng trên {PROVIDERS[videoProvider].name} (mỗi clip dùng cùng 1 grid storyboard reference), sau đó ghép trong CapCut với crossfade nhẹ giữa các clips.
                  </div>
                )}

                {/* Chunk list */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {chunkPrompts.map((chunk) => (
                    <details
                      key={chunk.chunkNum}
                      className="bg-ksp-bg/40 border border-ksp-border rounded"
                    >
                      <summary className="cursor-pointer p-2 flex items-center justify-between hover:bg-ksp-bg/60">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-pink-400">
                            #{chunk.chunkNum}/{chunk.totalChunks}
                          </span>
                          <span className="text-[11px]">
                            {chunk.frameRange}
                          </span>
                          <span className="text-[10px] text-ksp-muted">
                            ~{chunk.duration}s
                          </span>
                          {/* v0.7.4: Char count vs provider limit */}
                          {(() => {
                            const len = chunk.prompt.length;
                            const limit = 4000; // Seedance limit; most providers similar
                            const isOver = len > limit;
                            const isWarning = len > limit * 0.8;
                            return (
                              <span
                                className={`text-[10px] font-mono px-1 rounded ${
                                  isOver
                                    ? "bg-red-500/20 text-red-400"
                                    : isWarning
                                    ? "bg-yellow-500/20 text-yellow-500"
                                    : "bg-ksp-good/20 text-ksp-good"
                                }`}
                                title={`${len}/${limit} chars (Seedance limit)`}
                              >
                                {isOver ? "⚠" : "✓"} {len}/{limit}
                              </span>
                            );
                          })()}
                        </div>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            handleCopyChunkPrompt(chunk.chunkNum);
                          }}
                          className="text-[10px] px-2 py-0.5 bg-pink-500 text-white rounded hover:opacity-90"
                        >
                          📋 Copy
                        </button>
                      </summary>
                      <div className="p-2 border-t border-ksp-border">
                        <textarea
                          value={chunk.prompt}
                          readOnly
                          rows={6}
                          className="font-mono text-[9px] bg-ksp-bg/50 w-full"
                        />
                      </div>
                    </details>
                  ))}
                </div>

                {/* Workflow guide */}
                <div className="text-[10px] text-ksp-muted leading-relaxed">
                  <div className="font-medium text-ksp-text mb-1">📋 Workflow:</div>
                  <ol className="space-y-0.5 ml-3 list-decimal">
                    <li>
                      Mở <a href={PROVIDERS[videoProvider].url} target="_blank" rel="noreferrer" className="text-pink-400 underline">{PROVIDERS[videoProvider].name}</a>
                    </li>
                    <li>Upload nguyên grid storyboard (file ở Tab 2)</li>
                    {chunkPlan.isSingleShot ? (
                      <>
                        <li>Paste prompt từ chunk #1 ở trên</li>
                        <li>Generate → 1 video {chunkPlan.actualDuration}s hoàn chỉnh</li>
                      </>
                    ) : (
                      <>
                        <li>Cho mỗi chunk: paste prompt → generate → download clip_NN.mp4</li>
                        <li>Ghép {chunkPlan.chunks.length} clips trong CapCut với crossfade 0.3-0.5s</li>
                        <li>Total: ~{chunkPlan.actualDuration}s TVC hoàn chỉnh</li>
                      </>
                    )}
                  </ol>
                </div>
              </div>
            </div>
          )}


          {animationPairs.length > 0 && (
            <details className="space-y-2 pt-2 border-t border-ksp-border">
              <summary className="cursor-pointer text-[11px] text-ksp-muted hover:text-ksp-text py-1">
                ⚙️ Advanced: Per-pair prompts ({animationPairs.length} clips 3s, cho Kling/Veo3/Runway workflow)
              </summary>
              <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <label className="!mb-0 text-ksp-good">
                  ⚙️ Per-pair prompts (advanced — cho Kling/Veo3 từng clip 3s)
                </label>
                <button
                  onClick={handleDownloadAnimationZip}
                  className="text-[11px] px-2 py-1 bg-ksp-accent text-black rounded font-medium hover:opacity-90"
                >
                  📦 Download ZIP all
                </button>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {animationPairs.map((pair, idx) => (
                  <details
                    key={idx}
                    className="p-2 bg-ksp-bg/40 border border-ksp-border rounded"
                  >
                    <summary className="cursor-pointer text-[11px]">
                      <span className="font-mono text-ksp-accent">
                        Frame {pair.fromFrame} → {pair.toFrame}
                      </span>
                      <span className="text-ksp-muted ml-2">
                        ({pair.fromTiming} → {pair.toTiming})
                      </span>
                    </summary>
                    <div className="mt-2 space-y-1">
                      <textarea
                        value={pair.prompt}
                        readOnly
                        rows={6}
                        className="font-mono text-[10px] bg-ksp-bg/50"
                      />
                      <button
                        onClick={async () => {
                          await navigator.clipboard.writeText(pair.prompt);
                          showToast(
                            `Copied prompt #${idx + 1}`,
                            "success"
                          );
                        }}
                        className="text-[10px] px-2 py-1 bg-ksp-bg border border-ksp-border rounded"
                      >
                        📋 Copy
                      </button>
                    </div>
                  </details>
                ))}
              </div>
              <p className="text-[10px] text-ksp-muted italic leading-relaxed">
                💡 Sử dụng từng prompt với 2 frames tương ứng vào Kling/Veo3/Runway → 8 clips → ghép thành TVC.
              </p>
            </div>
            </details>
          )}
        </div>
      )}
    </Section>
  );
}

function TabBtn({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color: "blue" | "orange" | "pink";
  children: React.ReactNode;
}) {
  // v0.6.8: Color-coded tabs for visual distinction
  const colorClasses = {
    blue: {
      active: "bg-blue-500 text-white font-semibold",
      inactive: "text-blue-400 hover:bg-blue-500/10 border border-blue-500/40",
    },
    orange: {
      active: "bg-orange-500 text-white font-semibold",
      inactive: "text-orange-400 hover:bg-orange-500/10 border border-orange-500/40",
    },
    pink: {
      active: "bg-pink-500 text-white font-semibold",
      inactive: "text-pink-400 hover:bg-pink-500/10 border border-pink-500/40",
    },
  }[color];

  return (
    <button
      onClick={onClick}
      className={`flex-1 px-2 py-1.5 text-[11px] rounded transition-colors ${
        active ? colorClasses.active : colorClasses.inactive
      }`}
    >
      {children}
    </button>
  );
}

// v0.7.1: Cropped frames grid with per-frame regenerate buttons
function CroppedFramesGrid({
  frameIds,
  onRegenerateFrame,
}: {
  frameIds: string[];
  onRegenerateFrame: (idx: number) => void;
}) {
  const [blobUrls, setBlobUrls] = useState<(string | null)[]>([]);

  useEffect(() => {
    const urls: (string | null)[] = new Array(frameIds.length).fill(null);
    const cleanups: (() => void)[] = [];
    frameIds.forEach((id, idx) => {
      getReferenceImage(id).then((ref) => {
        if (ref) {
          const url = URL.createObjectURL(ref.blob);
          urls[idx] = url;
          setBlobUrls([...urls]);
          cleanups.push(() => URL.revokeObjectURL(url));
        }
      });
    });
    return () => cleanups.forEach((c) => c());
  }, [frameIds.join(",")]);

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {frameIds.map((id, idx) => (
        <div key={id} className="relative group">
          <div className="aspect-[9/16] bg-ksp-bg/50 rounded overflow-hidden border border-ksp-border">
            {blobUrls[idx] ? (
              <img
                src={blobUrls[idx]!}
                alt={`Frame ${idx + 1}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-ksp-muted text-[10px]">
                Loading...
              </div>
            )}
          </div>
          <div className="absolute top-1 left-1 bg-black/60 text-white text-[9px] px-1 rounded">
            #{idx + 1}
          </div>
          <button
            onClick={() => onRegenerateFrame(idx)}
            className="absolute bottom-1 right-1 bg-purple-500 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-purple-600"
            title={`Regenerate frame #${idx + 1}`}
          >
            🔄
          </button>
        </div>
      ))}
    </div>
  );
}
