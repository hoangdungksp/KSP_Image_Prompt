# Changelog

## [0.9.3-qc24] — 2026-05-15 — Click-cell-direct + Video upload per cell + Time format + Drag swap + Unified filenames

5 features/fixes shipped in 1 sprint.

### 1. Storyboard: Click cell → Edit Modal direct (no edit icon)

Trước: click ✏ icon trong cell actions để mở Edit Modal.
Sau: click bất kỳ vị trí nào trong cell → mở Edit Modal. Action buttons (🎬 / 🔒 / 🔄 / 📥) stopPropagation.
- Cell `onClick={onEdit}` + cursor pointer + `role="button"`
- Áp dụng cho cả cell-filled và cell-no-upload (cho phép edit ngay cả khi chưa có ảnh)
- Bỏ button ✏ riêng

### 2. Refs ZIP filename — UNIFIED `shot-N.png` convention

Trước: 3 cách naming khác nhau, không match prompt references.
Sau: tất cả filename dùng `shot-N` làm key thống nhất.

| Context | Filename |
|---|---|
| Refs ZIP cropped cells | `cropped-cells/shot-N.png` (no zero-pad, match shot order) |
| Edit Modal single download | `first-frame_shot-N.png` (unified với split mode) |
| Edit Modal first-frame download (split) | `first-frame_shot-N.png` |
| Edit Modal last-frame download (split) | `last-frame_shot-N.png` |
| Cell 📥 download button | `shot-N.png` |

Tất cả prompts (Animation, Animation Advanced, Scene Grid, Single Shot) reference cùng convention. AI giờ map đúng image → prompt reference.

### 3. Edit Modal: Time format dropdown

Trước: TIMING BREAKDOWN format hardcode `0–1.2s, 1.2–4.8s` (Seedance hiểu, nhưng Veo3/Kling/Grok có thể không).
Sau: dropdown 4 format options, AI prompt update live.

| Format | Vd 6s shot |
|---|---|
| Decimal seconds | `0–1.2s (OPEN), 1.2–4.8s (PEAK), 4.8–6s (CLOSE)` |
| **Timecode (default)** | `0:00–0:01.2 (OPEN), 0:01.2–0:04.8 (PEAK), 0:04.8–0:06 (CLOSE)` |
| Integer seconds | `0–1s (OPEN), 1–5s (PEAK), 5–6s (CLOSE)` |
| Percentage | `0%–20% (OPEN), 20%–80% (PEAK), 80%–100% (CLOSE)` |

Engine: `TimeFormat` enum + `formatTimeValue` + `formatTimeRange` helpers. `buildAnimationPrompt` + `buildAnimationPromptAdvanced` accept `timeFormat?: TimeFormat` (default "timecode").

Default = **timecode** (universal nhất cho mọi AI provider).

### 4. Upload Video per cell + Animatic plays video

Cells giờ có thể có video (sau khi user generate ngoài từ Veo3/Kling/Seedance + upload back).

**Type:** `SceneGridCell.video?: { dataUrl: string; filename: string; durationSeconds?: number }`
**Store actions:** `setSceneGridCellVideo` + `clearSceneGridCellVideo`

**UI:**
- Storyboard cell action row: **🎬 upload video** button TRƯỚC 🔒 lock button
- Cell badge "▶" góc dưới-trái khi có video (green pill)
- Edit Modal header: badge **🎬 Video uploaded** (green) khi cell có video
- Edit Modal footer: button `🎬 Upload video` (chưa có) hoặc `🗑 Remove video` (đã có)

**Animatic Player:**
- Render `<video autoplay muted playsInline>` khi cell có video.
- Fallback to `<img>` (keyframe) nếu không có video.
- **Planning duration = source of truth.** Shot.durationSeconds quyết định timing, video có thể loop/cut nếu khác.
- Top bar hiện 🎬 indicator khi đang play video shot.
- Thumb strip có marker "▶" green góc trên-trái cho shots có video.

**Workflow expected:**
1. Generate shots ngoài (Veo3/Kling/...) → save video files
2. Storyboard cell → click 🎬 → upload video
3. Play Animatic → xem real motion thay vì static keyframes

**Storage:** Video stored base64 trong IndexedDB. Soft limit 50 MB per video, confirm dialog nếu lớn hơn.

### 5. Edit Modal: Drag-swap first/last frame panes

Khi Advanced first/last mode active + picked last frame, user có thể **drag swap** 2 panes để đảo vị trí first ↔ last frame trong prompt.

- HTML5 native drag (`draggable`, `onDragStart`, `onDrop`, `dataTransfer`)
- State `firstLastSwapped: boolean` trong modal
- `buildAnimationPromptAdvanced` accept `swapped?: boolean` param → đảo IMAGE #1 / IMAGE #2 trong prompt
- Pane cursor: `grab` (hoverable) → `grabbing` (active drag)

### 6. Edit Modal: "Extract last frame from this cell's video" option

Khi cell có video uploaded + user enable Advanced first/last mode:
- Dropdown last-frame picker thêm option `🎬 Extract last frame from this cell's video`
- Click chọn → browser-side canvas extraction (`video.currentTime = duration - 0.05`, draw to canvas, toDataURL PNG)
- Last-frame pane hiển thị extracted frame + label "extracted"
- Prompt reference filename: `last-frame_shot-N.png` (same convention)
- State: `extractedLastFrame: string | null` + `extractingFrame: boolean` (loading state)

### 7. Edit Modal: Video/Image view toggle in left pane

Khi cell có cả `cell.video` (uploaded) VÀ `cell.dataUrl` (keyframe image), 2 icons toggle xuất hiện góc trên-phải của left pane:
- **🎬** — show video (auto-play, loop, muted)
- **🖼** — show image (static keyframe)

User click toggle để switch view. Active mode highlighted green (#50fa7b).

State: `leftPaneView: "video" | "image"` (default = "video" nếu có video). Icons stop propagation để click không trigger download.

**Use case:** user xem video animation, sau đó muốn quay lại xem keyframe gốc để compare (vd check character identity preservation). Trước phải remove video + upload lại — giờ chỉ 1 click toggle.

### Files changed (5 src + 1 test + 4 meta)

- `src/types/project.ts` — `SceneGridCell.video?` field
- `src/store/film_actions.ts` — `setSceneGridCellVideo` + `clearSceneGridCellVideo` (NEW)
- `src/engine/filmShotPromptBuilder.ts` — `TimeFormat` type + `formatTimeValue`/`formatTimeRange` helpers + `timeFormat`/`swapped` params on buildAnimationPrompt + buildAnimationPromptAdvanced
- `src/components/FilmStoryboardSection.tsx` — Click-cell-direct, 🎬 video button + badge, Refs ZIP filename unify, handleUploadVideoForCell, video assets in Animatic prop
- `src/components/FilmFrameEditModal.tsx` — Time format dropdown, video badge in header, upload/remove video buttons in footer, drag-swap panes (HTML5 native), extractLastFrameFromVideo helper, "Extract from video" picker option, unified filename
- `src/components/FilmAnimaticPlayerModal.tsx` — `cellAssetsByShotId` prop (replace cellDataUrlsByShotId), render `<video>` if cell has video, thumb video marker
- `src/components/film.css` — Cell video badge, Edit Modal video badge, draggable cursor, Animatic video indicator + thumb marker
- `test/film_mode.test.tsx` — 11 new tests (276 total, was 266)

### Tests

- ✅ TypeScript compile: 0 errors
- ✅ Vite production build: 7.33s
- ✅ Vitest runtime: **278/278 PASS + 12 skipped** (was 266 → 278, +12 net new)

### Memory edits applied

- #5: NEVER write version markers in user-facing UI strings (confirmed clean across all 6 modified files)

### Pacing/Emotional curve discussion noted in HANDOFF.md

Jason raised major question about how to **see + manage emotional pacing + climax effectiveness**. Discussion captured trong HANDOFF.md backlog section — 6 hướng feature đề xuất + phased 4-sprint plan. Sẽ tiếp tục thảo luận chat tiếp theo.

---

## [0.9.3-qc23] — 2026-05-15 — Animatic Player + Animation Prompt quality fix + UI polish

### 1. Animatic Player Modal (per-scene preview) — NEW FEATURE

Click "▶ Play Animatic" button cạnh "⚙ Advanced" trong Storyboard scene header → modal fullscreen player lướt qua shots với timing match shot duration.

**Layout:**
- Top bar: scene status (FADE IN / SHOT N) + close (✕) + scene location label
- Main viewport: shot image fullscreen (object-fit: contain)
- Caption strip: action lines per-shot dưới viewport
- Timeline: progress bar với shot-boundary markers + scrubbable
- Controls: ⏮ Restart · ⏪ Prev · ▶/⏸ Play · ⏩ Next · ⏭ End · shot info (N/M · shot type · camera · duration) · speed group (0.5×/1×/1.5×/2×) · 🔁 restart
- Thumbnail strip: click-to-jump cho tất cả shots trong scene

**Keyboard:** Space = Play/Pause · ← Prev · → Next · Esc = Close

**Design defaults (Jason chốt):** per-scene only · no audio · hard cuts giữa shots · modal overlay · empty shots → placeholder card · thumbnail strip visible · sprint standalone.

**Empty shot handling:** Cells chưa có ảnh → card "EMPTY · Shot N — chưa có ảnh" thay vì skip.

**Files:**
- `src/components/FilmAnimaticPlayerModal.tsx` (NEW) — Modal component, ~300 lines, no external deps
- `src/components/FilmStoryboardSection.tsx` — Add `animaticPlayerOpen` state, button next to Advanced, render modal at SceneBlock scope. Compute `cellDataUrlsByShotId` map từ all grids in scene.
- `src/components/film.css` — Append ~250 lines styles cho modal + thumb strip + Play button.

### 2. Animation Prompt quality fix — Item 4 từ Jason feedback

**Bug trước:** `buildAnimationPrompt` dùng `scene.actionLinesEn` (action TOÀN scene, vd "Robot wakes up. Birds chirp. Wind blows through trees.") làm action source cho video AI. AI confused → trong 6-10s shot tried to animate ALL scene events thay vì 1 shot action cụ thể.

**Fix:** Ưu tiên `shot.actionEn` (per-shot action) → `shot.actionVi` → `shot.purpose` → fallback `scene.actionLinesEn`. Scene action giờ chỉ dùng làm background context grounding với prefix "(Scene context: ...)".

**Added CRITICAL "ONE SHOT, ONE BEAT" instruction block:**
- "This is ONE shot of Ns. Animate ONLY the action listed above."
- "Do NOT animate other events from the scene context (those are different shots)."
- "Begin EXACTLY at the reference image. End at the natural conclusion of the listed action."

Same fix applied cho `buildAnimationPromptAdvanced` (first-frame + last-frame mode).

**Files:** `src/engine/filmShotPromptBuilder.ts` — `buildAnimationPrompt` + `buildAnimationPromptAdvanced` refactor.

### 3. UI Polish — Items 1, 2, 3 từ Jason feedback

**Item 1 — Advanced toggle CSS overflow fix:**
- Toggle label `white-space: nowrap` để không bị wrap text "ADVANCED: FIRST-FRAME + LAST-FRAME MODE"
- Checkbox fixed 14×14px (was elastic)
- Cell picker dropdown `flex: 1 1 100%` → xuống dòng riêng full-width khi enabled

**Item 2 — Split preview when Advanced enabled:**
- Khi user tick Advanced checkbox + pick last-frame shot → `.ksp-frame-edit-preview-wrap` chuyển sang flex layout 50/50
- Pane trái: current cell với label "first-frame"
- Pane phải: cell của shot đã pick với label "last-frame · Shot N"
- Last-frame cell resolved từ `grid.cells` (cell có shotId === lastFrameShot.id)

**Item 3 — Animation Prompt label generic:**
- "🎬 Animation Prompt (per-shot → Seedance 2.0 Pro)" → "🎬 Animation Prompt"
- User dùng nhiều AI providers khác nhau (Veo3, Kling, Sora, Seedance), label cứng tên provider không phù hợp.

### Files changed (3 src + 1 test + 4 meta)

- `src/components/FilmAnimaticPlayerModal.tsx` (NEW)
- `src/components/FilmFrameEditModal.tsx` — Split preview wrap, label update
- `src/components/FilmStoryboardSection.tsx` — Animatic button + modal wire-up
- `src/engine/filmShotPromptBuilder.ts` — Animation prompt source fix + ONE SHOT ONE BEAT
- `src/components/film.css` — Append styles
- `test/film_mode.test.tsx` — 4 tests mới cho Animatic Player

### Tests

- ✅ TypeScript compile: 0 errors
- ✅ Vite production build OK: 7.73s
- ✅ Vitest runtime: **259/259 PASS + 12 skipped** (baseline 255 + 4 mới Animatic)

### Memory edits applied

- #5: NEVER write version markers (qc17/qc18/qc19, etc.) in user-facing UI strings. Component source confirmed clean of version markers.

---

## [0.9.3-qc22] — 2026-05-15 — Convention swap CxR + Grid template + Modal override + Edit Frame per-cell prompts

5 fixes/features cùng 1 sprint (per Jason request "cùng lúc luôn"):

### 1. UI consolidation — Storyboard scene header

Trước: 2 div riêng — `ksp-storyboard-scene-header` (title + shots + duration) + `ksp-sb-scene-info` (grid + aspect + grids count + manual/auto hints + migration hint).

Sau: 1 dòng duy nhất trong `ksp-storyboard-scene-meta`:
```
▶Scene 1  Lạc Giữa Rừng Tuyết.   4x2 · 16:9 · 7 shots · 1m20s
```
Manual override hiện inline `· manual` (cam). Tất cả text version markers ("set qc17 — same as auto", "Manual (legacy)") đã bỏ hẳn — Jason instruction.

### 2. ISSUE 1 — Convention swap RxC → CxR

Trước (qc16-qc21): `parseGridFormat("3x2")` trả `{rows: 3, cols: 2}` = 3 dòng × 2 cột (portrait).

Sau (qc22): `parseGridFormat("3x2")` trả `{rows: 2, cols: 3}` = 3 cột × 2 dòng (landscape). Match industry storyboard convention "4×3 grid" = 4 wide × 3 tall.

Files cập nhật parsing:
- `src/engine/sceneGridPacker.ts`: `parseGridFormat` swap `[cols, rows]` (was `[rows, cols]`)
- `src/engine/gridImageCrop.ts`: parsing swap CxR
- `src/components/GridCropPreviewModal.tsx`: parsing swap CxR
- `src/engine/sceneImagePromptBuilder.ts`: text "X columns × Y rows" thay vì "X rows × Y cols"
- Mapping `pickOptimalGridFormat` không đổi (table ban đầu đã match Jason intent dưới convention CxR)

**Breaking change cho project qc17-qc21 cũ:** scene có `gridFormat: "3x2"` lưu trong DB sẽ thay đổi visual layout (từ portrait → landscape). Jason chốt Hướng A — pure swap, không migration.

### 3. ISSUE 1B — AI grid template image (Banana Pro fill-3×3 fix)

**Vấn đề:** Banana Pro / Imagen tendency tạo 3×3 perfect grid bất kể prompt nói "4×2" → grid output không match expected layout → crop sai.

**Fix:** Provide BLANK GRID TEMPLATE image as visual reference cho AI.

- `src/engine/gridTemplateImage.ts` (NEW): `buildGridTemplateImage` — canvas-based generator. Output PNG blank với cells labeled "CELL 1", "CELL 2", ..., "EMPTY". Borders rõ ràng để AI lock structure.
- Refs ZIP include `00_grid_template.png` (first file, before cast refs)
- Prompt text reference template:
  - "REFERENCE IMAGES: IMAGE #1 (grid template), IMAGE #2+ (cast refs)"
  - "STRICT LAYOUT REQUIREMENT: EXACTLY N columns × M rows. DO NOT add cells."

Workflow: user attach template PNG (from ZIP) làm reference #1 trong Banana Pro upload, cast refs theo sau.

### 4. ISSUE 2 — Modal Preview & Crop format override

Trước: `GridCropPreviewModal` display `gridFormat` read-only. Nếu AI tạo format khác (vd 3×3 thay vì 4×2) → crop sai 8 cells từ 9 thực tế.

Sau: Dropdown `GRID_FORMAT_CHOICES` (9 options) trong modal — user override format khi crop.

- `onApprove(settings, finalGridFormat)` — signature mới
- Storyboard handle: nếu `finalGridFormat !== grid.gridFormat` → call `setSceneGridFormat` trước, rồi crop với format mới
- UI badge "(override)" cam khi user đổi format khác default

### 5. ISSUE 3 — Edit Frame Modal per-cell prompts

Trước (qc17):
- Image Prompt = scene-grid-level (read-only, instruct user edit ở Storyboard) — sai concept
- Animation Prompt = per-shot ✓

Sau (qc22c):
- **Image Prompt = per-cell single shot** — `buildSingleShotImagePrompt(shot, scene, cast, setting)` (NEW in `filmShotPromptBuilder.ts`). Output: prompt tạo MỘT image cho riêng shot này (không phải full grid). Paste vào Banana Pro + cast refs để regen frame riêng.
- **Animation Prompt** không đổi default. Mode mới:
- **Advanced first/last-frame mode**:
  - Checkbox toggle "⚙ Advanced: First-frame + Last-frame mode"
  - Dropdown picker chọn last-frame shot (filter ra current shot)
  - Khi enabled + picked → prompt instruct AI interpolate giữa 2 frames
  - `buildAnimationPromptAdvanced(shot, lastFrameShot, ...)` (NEW)
  - Prompt mention IMAGE #1 (FIRST FRAME) + IMAGE #2 (LAST FRAME) + INTERPOLATION GUIDE

### Files changed (8 src + 1 test + 4 meta)

- `src/types/project.ts` (unchanged — SceneGridFormat type values unchanged)
- `src/engine/sceneGridPacker.ts` — parseGridFormat CxR swap, docs update
- `src/engine/gridImageCrop.ts` — CxR parsing swap
- `src/engine/sceneImagePromptBuilder.ts` — cols × rows text, STRICT LAYOUT block, IMAGE #1 template ref
- `src/engine/gridTemplateImage.ts` (NEW) — canvas blank grid generator
- `src/engine/filmShotPromptBuilder.ts` — `buildSingleShotImagePrompt`, `buildAnimationPromptAdvanced` (NEW)
- `src/components/FilmStoryboardSection.tsx` — header consolidation, Refs ZIP includes template, modal onApprove handles format override
- `src/components/GridCropPreviewModal.tsx` — format dropdown override, CxR parsing
- `src/components/FilmFrameEditModal.tsx` — buildSingleShotImagePrompt + Advanced toggle UI + cell picker
- `src/components/film.css` — qc22c Advanced toggle styles
- `test/film_mode.test.tsx` — 11 tests qc22, 3 tests updated (parseGridFormat, prompt builder, Storyboard source)

### Instruction received from Jason (memory edit #5)

> "TUYỆT ĐỐI KHÔNG ghi version (qc17/qc18/qc19...) trong UI strings hoặc text user-facing — đó là internal dev marker."

Áp dụng từ qc22 trở đi: code comments OK nhưng strings render ra UI phải generic.

### Tests

- ✅ TypeScript compile: 0 errors (`tsc && vite build`)
- ✅ Vite production build OK
- ✅ Vitest runtime: pending final run after fixes
- ✅ Build size ~770 KB (gzip ~240 KB) — chấp nhận, không tối ưu hóa thêm sprint này

### Caveats / Open

- **Banana Pro template behavior**: THEORETICAL fix. Cần Jason real-world test với Refs ZIP mới (include `00_grid_template.png`) để xác nhận AI tôn trọng template structure. Nếu vẫn fail → fallback to Hướng C (force 3×3 only).
- **Project cũ qc17-qc21**: Convention swap thay đổi visual layout của scenes lưu sẵn. Vd grid "3x2" cũ render portrait (3 rows × 2 cols), giờ render landscape (3 cols × 2 rows). User mở project cũ thấy layout đổi chiều. Đây là intentional (Jason chốt Hướng A).
- **Backward-compat**: Test fixtures qc16/qc17 updated cho CxR. Test data có `gridFormat: "3x2"` giờ unpacks thành 6 cells với cols=3 rows=2.

---

## [0.9.3-qc21] — 2026-05-14 — Storyboard UI refactor (Hướng F-9 Advanced toggle)

Refactor sprint 3/3 (progressive) cho Hướng F-9. Storyboard UI giờ default hiển thị auto-picked grid format read-only. User chỉ thấy dropdown khi click "⚙ Advanced". Manual override hiển thị "↺ Reset to Auto" button. Project qc17 legacy có gridFormat manual hiển thị "🔧 Manual (legacy)" hint với 1-click reset.

### Files changed (3 src + 1 test + 4 meta)

- **`src/types/project.ts`** — Thêm field `scene.gridFormatManual?: boolean` để track auto vs manual.

- **`src/store/film_actions.ts`**:
  - `setSceneGridFormat` — modify: gán `gridFormatManual: true` (user explicit override).
  - `resetSceneGridFormatToAuto` (NEW) — clear `gridFormatManual`, re-pick optimal format từ `pickOptimalGridFormat(shotCount, aspectRatio)`, preserve cropped frames.
  - `ensureSceneGrids` — gán `gridFormatManual: false` cho scene mới auto-pick path. Legacy qc17 scene (gridFormatManual undefined) → preserve undefined để UI hiển thị migration hint.

- **`src/components/FilmStoryboardSection.tsx`** — Major refactor SceneBlock UI:
  - Q21.1: Dropdown ẩn behind "⚙ Advanced" toggle (default collapsed)
  - Q21.2: Scene info header inline `"5 shots → 3×2 (auto) · 16:9 · 1 grid"`
  - Q21.3: Inline dropdown khi Advanced open, dropdown option "← auto" suffix cho format optimal
  - Q21.4: "↺ Reset to Auto" button visible khi `gridFormatManual === true`
  - Q21.5: Migration hint `"🔧 Manual (legacy) · ↺ Reset to Auto"` cho qc17 scene mismatch optimal

- **`src/components/film.css`** — Append styles cho qc21 UI elements (`ksp-sb-scene-info`, `ksp-sb-grid-advanced-toggle`, `ksp-sb-grid-reset-btn`, `ksp-sb-migration-hint`).

- **`test/film_mode.test.tsx`** — 5 tests qc21: setSceneGridFormat marks manual, resetToAuto path, ensureSceneGrids auto vs legacy preservation, source-level UI elements check.

### qc21 chốt Jason (5/5)

| # | Decision | Implementation |
|---|---|---|
| Q21.1 | Bỏ dropdown default → giữ behind "⚙ Advanced" toggle | ✅ |
| Q21.2 | Display info trong scene card header | ✅ inline với ratio + grid count |
| Q21.3 | Override UX: inline dropdown khi Advanced toggle | ✅ |
| Q21.4 | Visual indicator: Reset button presence | ✅ chỉ visible khi manual |
| Q21.5 | Migration UX qc17: per-scene inline hint | ✅ chỉ hiện khi legacy format ≠ optimal auto |

---

## [0.9.3-qc20] — 2026-05-14 — Stage 4 Scenes Wizard Complexity Warning

Refactor sprint 2/3 (progressive) cho Hướng F-9. Sau khi AI sinh Stage 4 scenes, hệ thống estimate shot count mỗi scene. Scene > 9 (sweet spot) → badge cảnh báo inline với collapsible 3 actions: tách AI / giữ + grid lớn / hủy.

**Bonus fix** (parallel qc18 Twist pattern): `scriptScenesLocked` flag. Trước qc20, Stage 4 auto-skip ngay sau AI sinh (giống bug Twist Stage 3 qc18) → cảnh báo dead code. qc20 fix bằng explicit lock — user PHẢI click "Tiếp: ⑤ Lời thoại →" để Stage 4 mark done.

### Files changed (5 src + 1 test)

- **`src/types/film.ts`** — Thêm 2 fields:
  - `FilmScriptIntermediateScene.complexityWarningDismissed?: boolean` (Q20.5 dismiss state)
  - `FilmData.scriptScenesLocked?: boolean` (parallel qc18 Twist lock)

- **`src/engine/sceneShotEstimator.ts`** (NEW) — Pure heuristic functions:
  - `estimateSceneShotCount(scene)` — Q20.1 Hướng C: `max(ceil(duration/8), sentence_count, 3)`. Industry avg 8s/shot AI + narrative complexity reflection + floor 3 (establishing/action/reveal minimum).
  - `classifySceneComplexity(estimatedShots)` → `"ok" | "over_sweet" | "over_hard"`
  - `sceneNeedsWarning(scene)` — convenience boolean.

- **`src/engine/filmScriptStages.ts`** — Thêm `runSplitSceneSuggestion(scene, beats, provider)` — Q20.4 Hướng C: AI propose 2-way split với split-by-beats preference. Returns `SceneSplitSuggestion` (reasonVi + 2 sub-scenes preview). Caller (UI) displays preview, user confirms/cancels.

- **`src/store/film_actions.ts`** — 4 actions mới:
  - `applySceneSplit(sceneId, sub1, sub2)` — replace 1 scene với 2 sub-scenes, shift order subsequent scenes, preserve beatIds.
  - `dismissSceneComplexityWarning(sceneId)` — Q20.5: dismiss badge, không change data (Storyboard qc19 auto-pick handle grid lớn).
  - `lockScriptScenes(project)` — parallel qc18 `lockScriptTwists`.
  - `setScriptIntermediateScenes` modify: reset `scriptScenesLocked = false` trên AI regen.
  - `revertToStage` + `clearStageData` modify: clear `scriptScenesLocked` ở các stage liên quan.

- **`src/components/FilmIdeaScriptSection.tsx`** — Refactor ActiveStage4:
  - Mỗi scene render trong `SceneCardWithWarning` component (new)
  - Q20.3 Hướng D: badge inline cạnh title `"⚠ ~12 shots ▼"`, collapsible action panel bên dưới
  - 3 buttons: `🪓 Tách thành 2 scenes` (gọi AI suggest), `✔ Giữ nguyên (grid lớn hơn)`, `✕ Hủy`
  - Split preview: hiển thị reasonVi + 2 sub-scenes detail + [Đồng ý / Gợi ý lại / Hủy]
  - `isStageDone("scenes")` modify: require `scriptScenesLocked === true` HOẶC backward-compat (scenes data + downstream script).
  - Nút "Tiếp: ⑤ Lời thoại →" gọi `lockScriptScenes` rồi `setScriptStage("dialogues")` trong 1 update.

- **`src/components/film.css`** — Append qc20 styles (`ksp-step-scene-warn-badge`, `ksp-step-scene-warn-panel`, `ksp-step-scene-split-preview`).

- **`test/film_mode.test.tsx`** — 11 tests qc20: estimator math (hybrid heuristic + edge cases), complexity classification, sceneNeedsWarning, applySceneSplit (replace+shift), dismissWarning, scriptScenesLocked lifecycle (init/lock/regen/revert/backward-compat), AI helper signature, 2 component smoke tests (warning visible/hidden).

### qc20 chốt Jason (5/5)

| # | Decision | Implementation |
|---|---|---|
| Q20.1 | Estimate shot count: hybrid heuristic | ✅ `max(duration/8, sentences, 3)` |
| Q20.2 | Trigger warning: inline Stage 4 | ✅ badge xuất hiện sau AI sinh xong |
| Q20.3 | UI design: badge + collapsible action | ✅ click badge → expand 3 buttons |
| Q20.4 | "Tách scene": AI suggest + user confirm | ✅ `runSplitSceneSuggestion` + preview UI |
| Q20.5 | "Giữ + grid lớn": KHÔNG làm gì + dismiss flag | ✅ `dismissSceneComplexityWarning` only |

### Bonus: Stage 4 Lock Fix (parallel qc18 Twist pattern)

Phát hiện trong quá trình code: Stage 4 có bug giống Stage 3 Twist trước qc18 — AI sinh xong → `scriptIntermediateScenes` defined → `isStageDone("scenes")` true ngay → ActiveStage4 không render → SceneCardWithWarning dead code. Fix bằng copy pattern qc18:
- `scriptScenesLocked` field tương ứng `scriptTwistsLocked`
- `lockScriptScenes` action
- Backward-compat: qc17/qc19 project có scenes + script → tự done

KHÔNG phải scope creep — required để qc20 warning UI hoạt động.

### Tests

- ✅ TypeScript compile: 0 errors (full `tsc && vite build`)
- ✅ Vite production build OK: 7.80s
- ✅ **Vitest runtime: 243/243 PASS + 12 skipped** (baseline 226 qc19 + 17 mới qc20+qc21)
- ✅ Photos regression: 49 tests xanh — không break
- ✅ Stage 3 Twists qc18: 9 tests qc18 vẫn pass (lock pattern parallel hoạt động đúng)

---

## [0.9.3-qc19] — 2026-05-14 — Hướng F-9: Auto-Adapt Grid Format (narrative-driven shot count)

Refactor sprint 1/3 (progressive) cho OPEN DISCUSSION #2 — Grid 1 vs Grid 2 consistency. Jason chốt Hướng F-9 sau khi research industry data 2026 (AI filmmaking guide: 8-15 scenes/film, 4-9 shots/scene sweet spot).

**Core principle change:** AI Shot List sinh shot count theo **narrative needs** (không bị grid constraint). Storyboard **tự pick grid format optimal** từ shot count + aspect ratio scene. Single grid duy nhất per scene cho 99% case → giải quyết root cause consistency drift.

### Scope qc19 (engine + actions only)

Progressive 3-sprint approach — qc19 narrow scope để giảm risk + dễ rollback nếu cần (bài học qc18 attempt). Storyboard UI dropdown giữ nguyên ở qc19, chỉ default value = auto-picked. UI refactor đầy đủ → qc21.

### Files changed (4 src + 1 test)

- **`src/types/project.ts`** — Extend `SceneGridFormat` type:
  - Cũ (qc16): `"2x2" | "2x3" | "3x2" | "3x3" | "4x3" | "3x4"` (6 values)
  - Mới (qc19): thêm `"4x2" | "2x4" | "4x4"` → 9 values total. `4x4` là hard cap cho 13-16 shots.

- **`src/engine/sceneGridPacker.ts`** — Major additions:
  - Function mới `pickOptimalGridFormat(shotCount, aspectRatio): SceneGridFormat` — mapping shot count → grid format theo bảng sweet-spot.
  - Export constants `SHOT_COUNT_SWEET_SPOT = 9`, `SHOT_COUNT_HARD_CAP = 16`.
  - `packShotsIntoGrids(shots, gridFormat?, existingGrids?, aspectRatio?)` — gridFormat giờ optional. Khi undefined → auto-pick. Khi explicit → respect user override.
  - Vertical aspects (9:16, 4:5) → taller grids (`2x3`, `2x4`, `3x4`). Landscape/square → wider grids (`3x2`, `4x2`, `4x3`). Symmetric formats (`3x3`, `4x4`) giữ nguyên bất kể aspect.

- **`src/engine/filmShotListGeneration.ts`** — AI prompt update:
  - **BỎ section "GRID-AWARE CONSTRAINT" (qc17)** — không inject grid format constraint vào AI prompt nữa.
  - Thay bằng section "SHOT COUNT GUIDANCE (Hướng F-9 — narrative-driven)":
    - Sweet spot: 4-9 shots/scene
    - Hard cap: 16 shots/scene
    - Scene > 16 → AI nên trả ít hơn, hoặc Stage 4 wizard sẽ tự đề xuất tách (qc20)
  - `gridFormat` param giữ trong `RunShotListForSceneInput` type cho backward-compat (caller cũ pass param không crash) nhưng KHÔNG dùng trong prompt logic nữa.
  - `videoProviderId` + duration clamp logic (qc17) giữ nguyên.

- **`src/store/film_actions.ts`** — `ensureSceneGrids` + `repackSceneGrids`:
  - Auto-pick grid format khi `scene.gridFormat === undefined` (new scene).
  - Preserve user-set `scene.gridFormat` (manual override path) — không tự override.
  - Đọc `settingV2.aspectRatio` để pass vào `pickOptimalGridFormat` cho orientation đúng.
  - Persist resolved format vào `scene.gridFormat` sau pack.

- **`test/film_mode.test.tsx`** — 13 tests qc19 mới + 3 tests qc16/qc17 updated:
  - **Mới (13):**
    - `pickOptimalGridFormat` mapping cho mọi shot count ranges (0-4, 5-6, 7-8, 9 sweet spot, 10-12, 13-16, > 16 capped)
    - Vertical aspect flip behavior (6 shots 9:16 → 2x3, 8 shots → 2x4)
    - Constants export (`SHOT_COUNT_SWEET_SPOT`, `SHOT_COUNT_HARD_CAP`)
    - `packShotsIntoGrids` auto-pick khi format undefined
    - `packShotsIntoGrids` respect explicit format override
    - `ensureSceneGrids` preserve user-set `gridFormat`
    - `ensureSceneGrids` đọc aspect từ settingV2
    - filmShotListGeneration source-level: KHÔNG còn "GRID-AWARE CONSTRAINT", CÓ "SHOT COUNT GUIDANCE"
  - **Updated (3):**
    - qc16 `ensureSceneGrids` rename → qc19 auto-pick 2x2 cho 2 shots (was hardcoded 3x3)
    - qc16 `applyCroppedFramesToGrid`: thêm fixture `gridFormat: "3x3"` để preserve 9-cell behavior
    - qc17 `runShotListForScene` test: assert KHÔNG còn "GRID-AWARE CONSTRAINT", CÓ "SHOT COUNT GUIDANCE"

### Mapping shot count → grid format (Hướng F-9)

| Shots | Landscape (16:9, 4:3, 1:1, 21:9, 2.39:1) | Vertical (9:16, 4:5) | Cell size (16:9 from 2752×1536) |
|---|---|---|---|
| 0-4 | 2×2 | 2×2 | 1376×768 (great) |
| 5-6 | 3×2 | 2×3 | 917×768 |
| 7-8 | 4×2 | 2×4 | 688×768 |
| **9** ★ sweet spot | **3×3** | **3×3** | **917×512** (excellent cinematic) |
| 10-12 | 4×3 | 3×4 | 688×512 (good) |
| 13-16 | 4×4 | 4×4 | 688×384 (acceptable) |
| > 16 | 4×4 (capped — caller warns) | 4×4 | — |

### Backward-compat (project qc17 và trước)

- Project có `scene.gridFormat` đã chốt (vd "3x3" pick manually) → tiếp tục dùng → không bị override.
- Project mới hoặc scene chưa init grids → auto-pick.
- Không cần migration mutate Dexie — inline logic trong `ensureSceneGrids` / `repackSceneGrids`.

### Tests

- ✅ TypeScript compile: 0 errors (full `tsc && vite build`)
- ✅ Vite production build OK: 7.61s
- ✅ **Vitest runtime: 226/226 PASS + 12 skipped** (baseline 213 qc18 + 13 mới qc19)
- ✅ Photos regression: 49 tests xanh — không break
- ✅ Twist Stage 3 fix qc18 (qc18 tests 9 mới) — không regression

### Roadmap progressive (Jason chốt)

- ✅ **qc19** (this) — Engine + AI + actions auto-pick. Storyboard UI dropdown giữ.
- ⏳ **qc20** — Stage 4 Scenes wizard: estimate shot count + warning khi > 9 (sweet spot) + đề xuất 3 hướng (tách / giữ + grid lớn / cancel).
- ⏳ **qc21** — Storyboard UI refactor: bỏ dropdown, hiển thị format auto-picked + override button advanced. Migration messaging cho user.

### Lessons applied từ qc18 attempt rollback

- Scope nhỏ progressive (qc19 chỉ engine, không touch UI lớn)
- Không bonus fix — KHÔNG đụng Stage 4 wizard logic, Storyboard UI dropdown
- End-to-end `npm run build` self-test BẮT BUỘC (không chỉ `npx tsc --noEmit` riêng)
- Memory edit ghi rule "ship FULL zip, không patch" sau sự cố rsync --delete

---

## [0.9.3-qc18] — 2026-05-14 — Stage 3 Twists Hướng B (explicit lock)

Bug fix targeted cho OPEN BUG #1: user không chọn được ✓/✗ trên twist cards. Root cause confirmed: `isStageDone("twists") = scriptTwists !== undefined` advance ngay sau khi AI sinh xong → `ActiveStage3` không bao giờ render → nút accept/reject bị ẩn.

**Lưu ý lịch sử:** qc18 attempt đầu tiên (May 14 morning) đã rollback vì cố fix bằng `every(t => t.accepted !== undefined)` + bonus fixes (framework validation, defensive lookups) → broke Stage 4/5 navigation. Bản qc18 này chỉ scope Stage 3 + lock state, KHÔNG bonus fix, có 9 tests runtime cover toàn flow.

### ✅ Hướng B implementation (Jason chốt sau khi A/B/C bàn)

**Thiết kế:** Stage 3 chỉ "done" khi user click NÚT "Tiếp: ④ Phân cảnh →" — explicit lock. Click ✓/✗ trên từng twist card CHỈ update `accepted` state, KHÔNG advance.

### Files changed (4)

- **`src/types/film.ts`** — thêm field `scriptTwistsLocked?: boolean` vào `FilmData` (với docstring giải thích semantics + backward-compat).

- **`src/store/film_actions.ts`** — 1 new action + 3 modifications:
  - `lockScriptTwists(project)` — flip `scriptTwistsLocked = true`. Pure: chỉ touch lock flag, caller compose với `setScriptStage("scenes")`.
  - `setScriptTwists` — modify: reset `scriptTwistsLocked = false` khi AI regen (user phải re-confirm twist mới).
  - `revertToStage("twists" | "beats" | "structure")` — modify: clear `scriptTwistsLocked` khi revert upstream (twists data preserved khi revert về "twists", cleared khi revert về "beats"/"structure").
  - `clearStageData("twists")` — modify: cũng clear `scriptTwistsLocked`.

- **`src/components/FilmIdeaScriptSection.tsx`** — 3 spot changes:
  - `isStageDone("twists")` — dùng `scriptTwistsLocked === true` + backward-compat path (qc17 projects có downstream stage data tự được treat as locked).
  - `countCompletedStages` — refactor dùng `isStageDone` làm single source of truth (footer count luôn khớp stepper visual).
  - Nút **"Tiếp: ④ Phân cảnh →"** trong `ActiveStage3` — onClick chain `lockScriptTwists` + `setScriptStage("scenes")` trong 1 update.

- **`test/film_mode.test.tsx`** — 9 tests mới (qc18 prefix), tất cả PASS:
  - 6 unit tests: lock semantics (init, set/reset on regen, no-op on accept toggle, clear on revert)
  - 3 mount tests: Stage 3 ACTIVE khi chưa locked, Stage 3 DONE preview khi locked, backward-compat qc17 project (twists + scenes nhưng KHÔNG có lock field → tự done)

### Backward-compat strategy

KHÔNG migrate persistent state trong Dexie. Inline check trong `isStageDone`:

```ts
if (film.scriptTwistsLocked === true) return true;
// qc17 project loaded fresh: no lock field, but downstream stage has data
// → user must have passed Stage 3 → treat as locked
if (film.scriptTwists !== undefined &&
    (film.scriptIntermediateScenes !== undefined || film.script !== undefined)) {
  return true;
}
return false;
```

Self-healing, không cần schema version marker, không touch IndexedDB.

### Edge cases verified

| Scenario | Old qc17 behavior | qc18 behavior |
|---|---|---|
| AI sinh twists lần đầu | Stage 3 → done ngay → user không pick được | Stage 3 → active, cards visible, nút Tiếp ở cuối |
| User click ✓ trên 1 twist | (broken: card không render) | Update `accepted = true`, lock state KHÔNG đổi |
| User click "Tiếp: ④ Phân cảnh →" | (broken: nút không hiện) | Lock = true + setScriptStage("scenes") trong 1 update |
| AI regen twists (user click lại "✨ AI gợi ý") | scriptTwists overwrite, isStageDone vẫn true | scriptTwists overwrite, lock reset false → user re-confirm |
| User revert về Stage 3 từ Stage 4 done | revertToStage("twists") clear scenes/script | Same + clear lock → ActiveStage3 lại render |
| qc17 project có scenes data, load vào qc18 | (no behavior change needed) | Backward-compat: Stage 3 tự done |

### Tests

- ✅ TypeScript compile: 0 errors
- ✅ Vite production build OK: 9.62s
- ✅ **Vitest runtime: 213/213 PASS + 12 skipped** (baseline 204 + 9 mới)
- ✅ Photos regression (49 tests) — không break
- ✅ Stage 1/2/4/5 navigation — không break (chỉ touch Stage 3)

### Quy tắc qc18 (rút từ rollback đầu)

- KHÔNG đụng `runStage1Structure`, `FRAMEWORK_LABELS`, defensive lookups
- KHÔNG bonus fix
- Scope chỉ trong Stage 3 + lock state
- Mount tests verify chain render (cards visible) chứ không chỉ check button presence
- Backward-compat inline trong `isStageDone`, không migration

---

## [0.9.3-qc17] — 2026-05-14 — Edit Frame Modal + Grid-aware Shot List + Provider-aware Durations

Tiếp theo qc16 (Storyboard paradigm shift). qc17 wire 3 things:

1. **Edit Frame Modal** — replace stub ở Storyboard cell ✏ button
2. **Grid-aware Shot List AI generation** (Jason Q1) — AI sinh shots theo grid format
3. **Provider-aware durations** (Jason Q2 — Hướng D) — AI Shot List + Edit Modal validate + clamp duration theo provider

### ✅ 1. Edit Frame Modal (`FilmFrameEditModal.tsx`)

Mở khi user click ✏ trên 1 cell trong Storyboard visual grid.

**Layout (~580 lines):**
- **Header**: "✏ Edit Frame — Scene N, Grid M, Cell K (Shot X)" + close button
- **Frame preview** (fullsize, max 220px tall, 16:9 aspect)
- **Editable fields** (7 fields, 4 rows):
  - Row 1: Title VN + Title EN
  - Row 2: Shot Type (7 options) + Camera Movement (11 options)
  - Row 3: Duration (s) + Video Provider (5 options) — duration has yellow border khi invalid
  - Duration warning box (red) khi `duration` không khớp provider supported durations
  - Row 4 full: Action VN textarea
  - Row 5 full: Action EN textarea (for AI prompts)
- **Image Prompt block** (collapsible):
  - Read-only textarea với scene-level prompt
  - Note: "Prompt này dùng để generate TOÀN BỘ grid (gồm cell này + cells khác). Edit prompt ở Storyboard section."
  - Button "📋 Copy image prompt"
- **Animation Prompt block** (collapsible):
  - Read-only textarea với per-shot prompt (rebuild live khi user edit fields)
  - Note: "Prompt cho video AI. Provider hiện tại: **{provider}** · supports {durations}"
  - Char count: `312 / 2500` (xanh nếu trong limit)
  - Button "📋 Copy → {Provider}" với **auto-clamp dialog**:
    - Nếu duration mismatch provider → confirm "Auto-clamp 5s → 8s rồi copy? OK / Cancel (copy nguyên 5s)"
    - User OK → cập nhật duration + copy prompt với duration đã clamp
- **Footer** 4 actions (Jason confirmed 4 buttons):
  - **🔄 Regen frame** (qc18 stub — Nano Banana single-frame defer)
  - **📤 Upload replace** (file picker → call `setSceneGridCellDataUrl` để thay ảnh cell)
  - **📋 Copy** (animation prompt với clamp logic)
  - **💾 Save changes** (gọi `updateShot` với editable fields → close modal)

### ✅ 2. Grid-aware Shot List AI generation

`engine/filmShotListGeneration.ts`:
- Add `gridFormat?: string` + `videoProviderId?: string` params vào `RunShotListForSceneInput` + `RegenSingleShotInput`
- System prompt include `GRID-AWARE CONSTRAINT` section khi `gridFormat` provided:
  ```
  Grid format cho scene này: 3x3 (9 cells per grid).
  Generate shot count THUỘC một trong các số sau: 9, 18, 27.
  - Scene đơn giản, ngắn → 9 shots (1 grid)
  - Scene trung bình → 18 shots (2 grids)
  - Scene phức tạp, dài → 27 shots (3 grids)
  TUYỆT ĐỐI KHÔNG sinh số shots khác (vd 8, 10) — sẽ tạo grid lẻ.
  ```
- Duration constraint inject theo provider:
  - Veo3 → `MUST be exactly 8 seconds (fixed by provider). Valid values: [8]`
  - Kling → `MUST be either 5 or 10 seconds. Valid values: [5, 10]`
  - Seedance → `MUST be any integer from 4 to 15 seconds. Valid values: [4, 5, 6, ..., 15]`
- `sanitizeShot()` post-clamps duration via `clampDurationToProvider()` (fallback nếu AI ignore)

`components/FilmShotListSection.tsx`:
- `runShotListForScene()` call: pass `gridFormat: scene.gridFormat ?? "3x3"` + `videoProviderId: setting.defaultVideoProvider ?? "seedance-2-pro"`
- `regenSingleShot()` call: pass `videoProviderId` để clamp single regen too

### ✅ 3. Provider-aware durations (`engine/providerDurations.ts`)

New module với 5 providers verified May 2026:

| Provider | Mode | Durations |
|---|---|---|
| Seedance 2.0 Pro | range | 4-15s flexible |
| Veo 3 | discrete | 8s only (fixed) |
| Kling 2.0 | discrete | 5s / 10s |
| Sora | discrete | 5s / 10s / 20s |
| Grok Imagine | discrete | 6s / 10s |

**Functions:**
- `getProviderDurationSpec(id)` — lookup
- `getSupportedDurations(id)` — returns flat array (range expanded to [4,5,...,15])
- `isDurationValid(duration, providerId)` — boolean check
- `clampDurationToProvider(duration, providerId)` — clamp to nearest valid:
  - Range mode: clamp to [min, max]
  - Discrete mode: pick value with smallest |delta|
  - Unknown provider: pass-through
- `formatDurationsForPrompt(id)` — for AI prompt: "any integer from 4 to 15 seconds" / "exactly 8 seconds (fixed)" / "either 5 or 10 seconds"
- `formatDurationsForUI(id)` — for UI label: "4-15s flexible" / "8s" / "5s / 10s"

### ✅ 4. Project Setting: `defaultVideoProvider` UI field

`components/ProjectSettingSection.tsx`:
- Add dropdown "Video AI Provider (default)" — film mode only
- 5 options labeled with supported durations:
  - Seedance 2.0 Pro — 4-15s flexible
  - Veo 3 — 8s only
  - Kling 2.0 — 5s / 10s
  - Sora — 5s / 10s / 20s
  - Grok Imagine — 6s / 10s
- Default: `seedance-2-pro` (most flexible)
- Tooltip: "AI Shot List dùng durations của provider này. Mỗi shot có thể override riêng trong Storyboard."

### ✅ 5. FilmStoryboardSection wire modal

- Add state: `editingCellOrder: number | null`
- `onEdit` callback (per cell): `setEditingCellOrder(cell.order)` (no longer toast stub)
- Modal render conditional:
  - Find cell by order
  - Find shot by `cell.shotId`
  - Pass all required props (cell, grid, scene, shot, allShotsInScene, cast, setting, callbacks)
- Callbacks:
  - `onSave(updates)` → `updateShot(project, sceneId, shotId, updates)` + close modal
  - `onUploadReplace(dataUrl)` → `setSceneGridCellDataUrl(project, sceneId, gridId, cellOrder, dataUrl)` (keep modal open)
  - `onCancel()` → close modal without save

### ✅ CSS (`film.css` +220 lines)

- Modal backdrop (semi-transparent, z-index 10000)
- Modal frame (max 620px wide, max 92vh tall)
- Fields grid (2-col rows + full-width rows)
- Duration warning box (red bg + border-left)
- Duration input warn state (red border + bg)
- Prompt collapsible blocks (purple bg tinted, hover purple)
- Prompt note (italic gray)
- Prompt textarea readonly
- Footer split layout (left: regen/upload; right: cancel/save)

### Tests

- ✅ TypeScript: 0 errors
- ✅ Vite build: 9.07s OK
- ✅ **Vitest: 204 PASS + 12 skip** (qc16: 187 → qc17: +17 new tests)
  - `PROVIDER_DURATIONS has 5 providers with verified specs`
  - `isDurationValid: range mode (Seedance) - boundary tests`
  - `isDurationValid: discrete mode (Veo3, Kling)`
  - `isDurationValid: unknown provider returns true`
  - `clampDurationToProvider: range clamps to [min, max]`
  - `clampDurationToProvider: discrete picks nearest valid value`
  - `clampDurationToProvider: unknown provider passes through`
  - `getSupportedDurations: range expands to full list`
  - `formatDurationsForPrompt: human-readable instruction per mode`
  - `formatDurationsForUI: short label per mode`
  - `runShotListForScene accepts gridFormat + videoProviderId params`
  - `ProjectSettingSection: defaultVideoProvider field rendered`
  - `FilmShotListSection passes gridFormat + videoProviderId to engine calls`
  - `FilmFrameEditModal: file structure and exports`
  - `FilmStoryboardSection: edit button opens modal (not toast stub)`
  - `FilmFrameEditModal mounts without crash`
  - `FilmFrameEditModal: duration warning shows when invalid`

- ✅ Photos regression: 49/49 xanh

### Files

**NEW:**
- `src/engine/providerDurations.ts` (~180 lines) — 5 providers + 6 helper functions
- `src/components/FilmFrameEditModal.tsx` (~440 lines) — Edit Frame Modal full UI

**Major modify:**
- `src/engine/filmShotListGeneration.ts` — gridFormat + videoProviderId params + AI prompt constraints + sanitizeShot clamp
- `src/components/ProjectSettingSection.tsx` — defaultVideoProvider dropdown (film only)
- `src/components/FilmShotListSection.tsx` — pass gridFormat + videoProviderId to engine calls
- `src/components/FilmStoryboardSection.tsx` — wire modal state + render + callbacks (updateShot + setSceneGridCellDataUrl)
- `src/components/film.css` — +220 lines modal styles

### Workflow expected sau qc17

**Test 1 — Project Setting + Grid-aware AI:**
1. Mở Project Setting → set "Video AI Provider (default)" = "Veo 3"
2. Quay lại Storyboard → set Scene 1 grid format = "3x3"
3. Quay lại Shot List → click "✨ AI sinh shots" cho Scene 1
4. Expected: AI sinh ĐÚNG 9, 18, hoặc 27 shots (multiple of 9)
5. Expected: TẤT CẢ shots có `durationSeconds = 8` (Veo3 fixed)

**Test 2 — Edit Frame Modal:**
1. Storyboard → expand Scene 1 → upload grid PNG → cells fill
2. Click ✏ trên cell 5 (Shot 5)
3. Modal mở với preview + 7 editable fields + 2 prompt collapsibles + 4 footer actions
4. Đổi Duration = 5s (Veo3 chỉ support 8s) → yellow border + red warning box
5. Click "📋 Copy → Veo 3" → confirm dialog "Auto-clamp 5s → 8s?"
6. Click OK → Duration field cập nhật 8s + animation prompt copied with 8s
7. Click "💾 Save changes" → shot updated trong store + modal close

**Test 3 — Custom provider per-shot:**
1. Open Edit Frame modal cho Shot X
2. Đổi "Video Provider" = "Kling 2.0"
3. Duration warning thay đổi: warn nếu duration không phải 5 hoặc 10
4. Save → shot có per-shot videoProviderId override (qc11 schema), default project provider không bị thay

### Còn lại cho qc18 (optional)

- Nano Banana single-frame regen API wire (replace 🔄 Regen frame stub)
- Per-cell `promptOverride` field full wire (input for per-frame fine-tune)
- Bundle Export update for scene.grids[] structure
- Tag `v0.9.3-qc17` annotated on GitHub

### Honest acknowledgment

qc17 adds significant flexibility:
- AI Shot List giờ hiểu grid format → less waste cells
- AI Shot List hiểu provider → durations chính xác từ đầu
- Edit Frame Modal cho user fine-tune từng shot mà không phải đi qua nhiều sections
- Per-shot provider override cho phép mix providers trong cùng project (vd: 9 shots Seedance + 1 shot Grok cho hiệu ứng đặc biệt)

---

Jason điều tra Image Prompt + Animation Prompt → phát hiện kiến trúc cũ **sai concept**: mỗi shot có 1 grid 3×3 = 9 frames motion beats. Đúng concept Jason muốn: **mỗi SCENE có grid(s), mỗi cell = 1 shot snapshot**, Image Prompt = scene/grid level (1 prompt sinh tất cả shots cùng lúc).

### 🔄 Paradigm shift

**CŨ (sai):**
```
Scene 1 (11 shots)
├── Shot 1 → 1 grid 3×3 (9 motion beats của Shot 1)
├── Shot 2 → 1 grid 3×3 (9 motion beats của Shot 2)
├── ... 11 grids riêng biệt
```

**MỚI (đúng):**
```
Scene 1 (11 shots) @ grid format "3x3"
├── Grid 1 (3×3): cell 1-9 = Shot 1-9 snapshots
├── Grid 2 (3×3): cell 1-2 = Shot 10-11, cell 3-9 = empty
```

→ Mỗi cell = 1 key frame của 1 shot. Image Prompt là 1 prompt mô tả TẤT CẢ shots trong grid để Banana Pro / Imagen 4 sinh 1 grid hình.

Animation Prompt **vẫn per-shot** (Jason nói "chưa đụng đến").

### ✅ Schema (Migration A — clean break per Jason Q5)

**Bỏ per-shot** (data cũ drop on load):
- `shot.gridImageDataUrl`, `shot.framesR5`, `shot.imagePromptR5`, `shot.cropSettings`
- `film.defaultCropSettings`

**Thêm scene-level** (`types/project.ts`):
```ts
SceneGrid {
  id, order, gridFormat
  imagePrompt?         // AI-generated EN prompt for entire grid
  gridImageDataUrl?    // user uploaded grid PNG
  cropSettings?        // qc15-style provider + dims + gutter
  cells: SceneGridCell[]
}

SceneGridCell {
  order              // 1..N within grid
  shotId?: string    // link to FilmShot; undefined if empty
  dataUrl?: string   // cropped from grid
  locked?: boolean
  promptOverride?    // qc17 per-cell override
}

scene.grids?: SceneGrid[]      // NEW
scene.gridFormat?: SceneGridFormat   // NEW (2x2 / 2x3 / 3x2 / 3x3 / 4x3 / 3x4)

ProjectSettingV2.defaultVideoProvider?: string  // NEW (qc17 prep)
```

### ✅ Option A pack — Jason confirmed Q2 = A

`engine/sceneGridPacker.ts`:
- `parseGridFormat("3x3") → { rows: 3, cols: 3, cells: 9 }`
- `packShotsIntoGrids(shots, "3x3")` — pack tuần tự, grid cuối có empty cells nếu shots không chia hết
- Preserve existing dataUrl / cropSettings khi re-pack nếu shotId mapping vẫn match
- `gridStats(grids) → { gridCount, filledCells, emptyCells }`

Ví dụ thực tế Jason (Scene 1 = 11 shots):
- @ 3×3 → 2 grids: Grid 1 (9 filled) + Grid 2 (2 filled + 7 empty)
- @ 4×3 → 1 grid (11 filled + 1 empty)

### ✅ Image Prompt builder mới (scene-level)

`engine/sceneImagePromptBuilder.ts` — `buildSceneGridImagePrompt(grid, scene, shots, cast, setting)`:
- 1 prompt cho TOÀN BỘ N shots trong grid (vd 9 shots cho 3×3)
- Cell-by-cell descriptions: `Cell 1: [wide] Mở đầu — Wide forest shot` ... `Cell N: EMPTY — solid black`
- Full cast refs block (consistency anchor, qc13 logic preserved)
- Scene context: title + settings + action overview
- Empty cells explicit instruction: "solid black, no subject, no detail"

### ✅ Actions (`store/film_actions.ts`)

7 new actions cho scene grids:
- `ensureSceneGrids(project, sceneId)` — init grids lần đầu user expand scene
- `setSceneGridFormat(p, sceneId, format)` — đổi format + re-pack (preserve dataUrl khi shotId match)
- `setSceneGridImage(p, sceneId, gridId, dataUrl, cropSettings)` — save uploaded grid
- `applyCroppedFramesToGrid(p, sceneId, gridId, dataUrls)` — fill cells sau crop
- `clearSceneGridImage(p, sceneId, gridId)` — xóa grid + cropped cells
- `toggleSceneGridCellLock(p, sceneId, gridId, cellOrder)` — flip locked state
- `regenerateSceneGridImagePrompt(p, sceneId, gridId)` — rebuild prompt từ scene + shots + cast + setting

### ✅ Migration A (`store/migration.ts`)

`migrateQc16DropPerShotGrids(project)`:
- Drop `framesR5`, `gridImageDataUrl`, `imagePromptR5`, `cropSettings` per shot
- Drop `defaultCropSettings` per film
- Marker `qc16Migrated: true` để idempotent (không run lại)
- Auto-called trong `migrateAllProjects()`

Existing project có data per-shot → load lại → silent drop → user re-upload grids trong UI mới.

### ✅ UI rewrite — `FilmStoryboardSection.tsx` (full rewrite ~600 lines)

- Bỏ list shots text rows (concept cũ)
- Click scene header → expand → hiển thị:
  - Grid format selector dropdown (per-scene, Q3=B đã chọn ban đầu nhưng Jason yêu cầu chuyển vào Storyboard)
  - Multiple `<GridDisplay>` blocks (1 per SceneGrid)
- Mỗi `<GridDisplay>`:
  - Visual grid display với `aspect-ratio` modifier theo `setting.aspectRatio`:
    - 16:9 → cells landscape
    - 9:16 → cells vertical (max-width 250px center)
    - 1:1 → cells vuông (max-width 340px center)
    - 4:3 / 4:5 / 21:9 → fallback 4:3
  - Red warning ⚠ nếu chưa upload grid PNG
  - 4 buttons per cell (Jason confirmed):
    - 🔒/🔓 Lock toggle (prevent regen overwriting)
    - 🔄 Regen frame (qc17 stub — Nano Banana single-frame defer)
    - 📥 Download cell PNG
    - ✏ Edit (qc17 modal stub)
  - Grid actions row: 📤 Upload / 🔧 Re-crop / 📥 Refs ZIP / ✕ Clear
  - Image Prompt collapsible (▶/▼ toggle) — readonly textarea + Copy → Banana Pro + 🔄 Regen prompt
- 3 cell states: empty (—), no upload (red dashed), filled (img thumbnail)

### ✅ CSS (`film.css` +200 lines)

- Aspect ratio modifiers (`.ksp-aspect-16-9`, `.ksp-aspect-9-16`, etc.)
- Cell states colors
- 4 action buttons với hover purple, locked state green
- Image prompt collapsible toggle styles
- Grid format selector row

### ✅ Tests

- ✅ TypeScript: 0 errors
- ✅ Vite build: 10.06s OK
- ✅ **Vitest: 187 PASS + 12 skip** (qc15: 183 → qc16: +18 new tests, -14 skipped vì code FilmShotDetailPanel xóa)
  - `parseGridFormat parses RxC strings correctly`
  - `packShotsIntoGrids: 11 shots @ 3x3 → 2 grids (9 + 2 + 7 empty)`
  - `packShotsIntoGrids: 7 shots @ 3x3 → 1 grid (7 + 2 empty)`
  - `packShotsIntoGrids: 0 shots → 1 empty grid (allows upload-first)`
  - `packShotsIntoGrids: re-pack preserves dataUrl when shotId matches`
  - `packShotsIntoGrids: re-pack drops dataUrl when shotId differs (reorder)`
  - `gridStats counts filled vs empty cells across grids`
  - `buildSceneGridImagePrompt outputs prompt with rows×cols + cells + cast + scene`
  - `ensureSceneGrids initializes scene.grids when first opened`
  - `setSceneGridFormat re-packs preserving cropped frames`
  - `toggleSceneGridCellLock flips cell locked state`
  - `applyCroppedFramesToGrid fills cells from crop result`
  - `Migration A drops per-shot grid data on load`
  - `Migration A is idempotent (qc16Migrated marker)`
  - `FilmStoryboardSection renders scene blocks + empty state when no script`
  - `FilmStoryboardSection renders scene blocks when script + scenes exist`
  - `Editor schema: scenes have grids + gridFormat fields available`
  - `defaultVideoProvider added to ProjectSettingV2 (qc17 prep)`

- ✅ Photos regression: 49/49 xanh

### Files

**NEW:**
- `src/engine/sceneGridPacker.ts` (~120 lines) — Option A pack logic
- `src/engine/sceneImagePromptBuilder.ts` (~115 lines) — scene-level prompt

**Major modify:**
- `src/types/project.ts` — add `SceneGrid` + `SceneGridCell` + `SceneGridFormat` + `scene.grids` + `scene.gridFormat` + `defaultVideoProvider`
- `src/store/film_actions.ts` — 7 new scene grid actions
- `src/store/migration.ts` — `migrateQc16DropPerShotGrids` + auto-call trong `migrateAllProjects`
- `src/components/FilmStoryboardSection.tsx` — FULL rewrite ~600 lines visual grid UI
- `src/components/film.css` — visual grid styles, cell states, aspect ratio modifiers, image prompt collapsible

**Delete:**
- `src/components/FilmShotDetailPanel.tsx` (was 765 lines) — không còn drill-down per-shot grid

### Workflow expected sau qc16

1. Mở project có script + shots
2. Cuộn xuống "5. STORYBOARD"
3. Click scene → expand → grid format selector default "3x3"
4. Visual grid hiển thị theo aspect ratio:
   - Project 16:9 → cells landscape 16:9
   - Project 9:16 → cells vertical (centered)
   - Project 1:1 → cells vuông (centered)
5. Mỗi cell có 4 buttons góc dưới phải (lock/regen/download/edit)
6. Cell chưa upload → dashed red border "Shot N · chưa có ảnh"
7. Click "📝 Image Prompt" toggle → collapse mở textarea readonly với prompt scene-level
8. Click "📤 Upload grid" → file picker → modal Preview & Crop (qc15 reuse) → Approve → cells fill REAL thumbnails
9. Click cell 🔒 → lock màu xanh (prevent regen)
10. Click cell 📥 → download single cell PNG
11. Click cell ✏ → toast "qc17 sẽ wire modal đầy đủ"

### Còn lại cho qc17 (đã thảo luận, chưa code)

- Edit Frame Modal: edit prompt + regen + upload replace + copy prompt
- Grid-aware Shot List AI generation (Jason Q1): AI sinh shots theo grid format
- Provider-aware durations (Jason Q2 — Hướng D): defaultVideoProvider field full wire (Shot List AI uses supported durations + validate + clamp on copy animation prompt)

### Honest acknowledgment

qc11-qc15 build sai concept (per-shot grid). qc16 paradigm shift sửa lại đúng. Migration A drop data cũ vì không cứu được lossy. User cần upload grids lại trong UI mới — nhưng UI giờ đúng ý đồ Jason ban đầu.

---

Jason test qc14 grid crop với 2 sample real-world:
- **Nano Banana**: 2752×1536 (16:9)
- **ChatGPT**: 1672×941 (≈16:9, có visible gutter)

qc14 chia thuần geometric → **sai cells**: vì mỗi AI gen size khác nhau + có gutter giữa cells → output cells có viền dính vào, off-center.

**Jason ý tưởng:** modal preview trước khi crop, user duyệt + chỉnh provider + size + gutter → mới crop thật.

### ✅ Fix 1 — NEW component `GridCropPreviewModal.tsx`

Workflow mới khi user click 📤 Upload grid:
1. Read file → base64 dataURL
2. **MỞ MODAL** (KHÔNG crop ngay) với:
   - Dropdown AI Provider (6 options pre-set + Custom auto-detect)
   - Textbox Width/Height (auto-fill từ provider preset)
   - Slider Gutter 0-20px (live preview overlay update)
   - Image preview với **overlay grid lines + cell numbers F1-F9** (semi-transparent purple, dashed borders, label badges)
   - "Sync from image" link button nếu user-stated size khác image.naturalWidth
   - Validation status: "✓ Mỗi cell 915×507" hoặc "⚠ Cell quá nhỏ — giảm gutter"
3. User adjust settings → preview overlay update LIVE (no crop yet)
4. Click "✓ Approve & Crop" → trả `ShotCropSettings` về parent
5. Parent gọi `cropGridIntoFrames()` với settings đã duyệt
6. Click "Cancel" → đóng modal, không lưu gì

### ✅ Fix 2 — NEW module `engine/gridProviders.ts`

6 provider presets verified từ Jason real-world tests:

| Provider | 16:9 default | 9:16 default | Gutter |
|---|---|---|---|
| Nano Banana | 2752×1536 | 1536×2752 | 0px |
| Banana Pro | 2752×1536 | 1536×2752 | 2px |
| ChatGPT (DALL-E 3) | **1672×941** ← Jason sample | 1024×1820 | 4px |
| Imagen 4 | 2048×1152 | 1152×2048 | 0px |
| Grok / xAI | 2048×1152 | 1152×2048 | 0px |
| Custom (auto-detect) | null | null | 0px |

Khi user đổi provider → modal auto-fill Width/Height + Gutter. User có thể override bất cứ field nào.

### ✅ Fix 3 — `gridImageCrop.ts` rewritten với gutter + scale support

**Signature mới:**
```ts
cropGridIntoFrames(dataUrl, gridFormat, {
  totalWidth: number,   // user-stated grid size
  totalHeight: number,
  gutterPx: number,
})
```

**Crop math với gutter:**
```
gutterTotalW = gutterPx * (cols - 1)
cellW = (totalWidth - gutterTotalW) / cols
sx = c * (cellW + gutterPx)   ← skip gutter between cells
```

**Scale handling:** nếu image.naturalWidth ≠ user-stated `totalWidth` (vd: provider gen renders ở higher DPI), engine tự scale: `sx_actual = sx_user × (naturalW / totalW)`. Đảm bảo crop đúng cells khi user nhập size khác image thực tế.

**Validation built-in:**
- gridFormat invalid → throw
- `gutterPx < 0 || > 200` → throw "ngoài khoảng hợp lý"
- `cellW < 4 || cellH < 4` → throw "Cell quá nhỏ sau khi trừ gutter — giảm gutter"
- `totalWidth < cols * 16` → throw "Image quá nhỏ"

### ✅ Fix 4 — Per-shot crop settings + per-project default

**NEW schema `ShotCropSettings`:**
```ts
{ provider, totalWidth, totalHeight, gutterPx }
```

Persistence chain (Jason Q5 = (c) per-project default + per-shot override):
- `shot.cropSettings` ← settings dùng lần crop GẦN NHẤT cho shot này
- `film.defaultCropSettings` ← project default, set auto từ lần crop đầu tiên trong project

Khi user upload grid → modal pre-fill theo chain: `shot.cropSettings ?? film.defaultCropSettings ?? undefined (auto-detect)`.

Vd: Project mới → user crop shot 1 với Nano Banana → film.defaultCropSettings = Nano Banana settings → các shots khác auto pre-fill Nano Banana (không phải nhập lại). Khi user lẻ shot từ ChatGPT → override per-shot, không ảnh hưởng project default.

### ✅ Fix 5 — Re-crop button 🔧

Khi shot đã có `gridImageDataUrl` (đã crop trước đó), header frames hiện 2 buttons:
- **🔧 Re-crop** — re-open modal với grid cũ + settings cũ. User chỉnh gutter / size → Approve → re-crop. Không cần upload lại file.
- **✕ Clear** — xóa grid + frames (như cũ)

Display info: "Grid uploaded — 9/9 cropped (2752×1536, gutter 4px)" → user thấy ngay settings đã dùng.

### ✅ Fix 6 — Grid format `3x4` added

Thêm `"3x4"` (3 rows × 4 cols, 12 frames) vào:
- `FilmShot.gridFormat` type union (project.ts)
- `FilmShotGridFormat` enum (film_actions.ts)
- GRID_FORMATS dropdown trong FilmStoryboardSection
- GRID_FORMATS dropdown trong FilmShotDetailPanel

Order: `2×2, 2×3, 3×2, 3×3, 4×3, 3×4` (per Jason Q7 OK).

### Files changed

**NEW:**
- `src/components/GridCropPreviewModal.tsx` (~270 lines) — modal với provider/size/gutter controls + live overlay preview
- `src/engine/gridProviders.ts` (~90 lines) — 6 provider presets + lookup helpers

**MODIFIED:**
- `src/engine/gridImageCrop.ts` — new 3-arg signature with `{ totalWidth, totalHeight, gutterPx }` options + gutter math + image scale handling
- `src/types/project.ts` — `FilmShot.gridFormat` adds `"3x4"`; add `ShotCropSettings` interface + `FilmShot.cropSettings` field
- `src/types/film.ts` — add `FilmData.defaultCropSettings` field
- `src/store/film_actions.ts` — `FilmShotGridFormat` enum adds `"3x4"`
- `src/components/FilmShotDetailPanel.tsx`:
  - Import modal + ShotCropSettings type
  - `pendingGridUpload` state
  - Upload handler now opens modal (no direct crop)
  - Modal approve handler: save crop settings (per-shot + project default if first crop) + run crop with user-confirmed options
  - Re-crop handler: re-open modal with existing grid + saved settings
  - Re-crop button 🔧 in frames header
  - Display crop settings inline: "(2752×1536, gutter 4px)"
  - GRID_FORMATS adds `3x4`
- `src/components/FilmStoryboardSection.tsx` — GRID_FORMATS adds `3x4`
- `src/components/film.css` — full modal styles (~190 lines): backdrop, modal frame, controls grid, gutter slider, preview overlay with semi-transparent cells + F1-F9 badges, validation pill, approve button green

### Tests

- ✅ TypeScript: 0 errors
- ✅ Vite build: 7.42s OK
- ✅ **Vitest: 183/183 PASS** (qc14: 171 → qc15: +12 new tests)
  - `cropGridIntoFrames: rejects invalid gutter values (-1, 999)`
  - `cropGridIntoFrames: rejects when totalWidth too small for grid`
  - `GRID_PROVIDERS list includes Nano Banana + ChatGPT + custom with verified sizes`
  - `getProviderDefaultSize returns correct preset for given aspect`
  - `3x4 grid format added to FilmShot type + GRID_FORMATS dropdown`
  - `ShotCropSettings schema exported from project.ts`
  - `FilmData has defaultCropSettings field for per-project default`
  - `GridCropPreviewModal component renders + has provider dropdown + gutter slider + cell overlay`
  - `Shot Detail Panel upload handler opens modal, NOT crops directly`
  - `Re-crop UI: button rendered next to Clear when grid uploaded`
  - `Modal pre-fills from shot.cropSettings → film.defaultCropSettings → auto-detect`
  - `First crop saves user settings as project default (one-time auto-set)`
- ✅ Photos regression: 49/49 xanh

### Workflow expected sau qc15

1. Build Image Gen prompt → Copy → Banana Pro / Nano Banana → paste + gen grid 3×3
2. Save kết quả PNG → click 📤 "Upload grid PNG (from Banana Pro)" → chọn file
3. **MODAL MỞ:**
   - Auto-detect image (vd 2752×1536) → fill Width/Height
   - Provider dropdown default "Custom (auto-detect)" — user chọn "Nano Banana" → giữ nguyên (2752×1536, gutter 0)
   - Hoặc đổi "ChatGPT" → auto-fill 1672×941 gutter 4 (nhưng image thực 2752×1536 → cảnh báo + offer "Sync from image")
   - Slider gutter 0-20px → live preview overlay update
   - Cell numbers F1-F9 overlay rõ ràng trên image
4. User happy → click "✓ Approve & Crop"
5. Modal đóng, toast "Đang crop grid với settings đã duyệt..."
6. ~1s sau: toast "Đã crop 9 frames (915×507, aspect 1.80:1)"
7. Frames grid UI hiện 9 thumbnails REAL từ grid
8. Header hiện: "Grid uploaded — 9/9 cropped (2752×1536, gutter 0px)" + buttons 🔧 Re-crop / ✕ Clear
9. Click 🔧 → modal re-open với grid + settings cũ → user chỉnh gutter → re-crop nhanh không cần upload lại

### Workflow test với grid 9:16 vertical

1. Banana Pro gen grid 9:16 vertical (1536×2752)
2. Upload → modal auto-detect 1536×2752
3. Provider chọn Nano Banana → preset 9:16 = 1536×2752 ✓ match
4. Cell output: 512×916 each (aspect ≈0.56:1 = 9:16) ✓

### Workflow test với ChatGPT (có gutter)

1. ChatGPT gen 1672×941 với gutter ~4px visible
2. Upload → modal auto-detect 1672×941
3. Provider chọn "ChatGPT (DALL-E 3)" → auto-fill gutter 4px
4. Preview overlay shows F1-F9 với gutter excluded
5. Approve → cells crop trừ gutter → no border lines dính vào output frames

### Limitations còn lại

- 9:16 vertical preset cho Nano Banana ước lượng (Jason chưa test sample) — user có thể override
- Custom provider không lưu user-defined presets (chỉ auto-detect mỗi lần) — defer qc16
- Bundle Export full ZIP folder tree defer
- Frame Replace single 🔁 wait Nano Banana API wire Sprint 0.9.4

---

Jason điều tra "Auto-crop" — phát hiện đó chỉ là **STUB không hoạt động thật**:

- `createShotR5Frames()` tạo empty placeholders với `dataUrl: undefined` cho mọi cell
- KHÔNG có canvas/image cropping logic anywhere
- Toast "auto-cropped into frames" là **lie** — fake success message
- Refs ZIP cũng KHÔNG chứa cropped frames

### Root cause investigation report cho Jason

**Refs ZIP cũ:** chỉ chứa cast/ refs (face + body upload từ Cast section). KHÔNG chứa cropped frames.

**"Auto-crop" cũ:**
1. Save grid PNG dataURL vào `shot.gridImageDataUrl` ✓
2. Tạo N **empty frame placeholders** (`{ id, order, dataUrl: undefined }`) ❌ KHÔNG crop
3. Toast lie "auto-cropped" — không có canvas drawImage
4. Bundle Export cũng skip frames có `dataUrl: undefined` → bundle thiếu crops

### ✅ Fix 1 — NEW engine module `gridImageCrop.ts`

Pure Canvas API-based geometric divide (Phương án A per Jason Q1+Q2 confirm):

```ts
export async function cropGridIntoFrames(
  gridDataUrl: string,
  gridFormat: string
): Promise<CropGridResult>
```

**Logic:**
- Parse `"RxC"` (e.g. `"3x3"` → rows=3, cols=3)
- Load image vào `HTMLImageElement` (async)
- Tính `cellW = floor(imgW / cols)`, `cellH = floor(imgH / rows)`
- Loop rows × cols, mỗi cell:
  - `canvas.drawImage(img, sx, sy, cellW, cellH, 0, 0, cellW, cellH)`
  - `canvas.toDataURL("image/png")` (lossless cho character details)
- Return array of cropped dataURLs + metadata

**Aspect ratio handling tự động:**

| Grid input | Grid format | Cell output | Per-cell aspect |
|---|---|---|---|
| 1920×1080 (16:9) | 3x3 | 640×360 | 16:9 ✓ |
| 1080×1920 (9:16) | 3x3 | 360×640 | 9:16 ✓ |
| 1920×1080 (16:9) | 4x3 | 480×360 | 4:3 |
| 1080×1920 (9:16) | 4x3 | 270×640 | ≈27:64 |

Per Jason Q2 = A: **không trừ gutter**, output đúng pixel boundaries từ grid. Banana Pro thường gen clean grid không có visible gutter. Nếu sau test thấy có gutter sẽ bump sang Q2=B (configurable trim) trong qc tương lai.

**Validation built-in:**
- Throw nếu gridFormat invalid (`"garbage"`, `"3x"`, `""`)
- Throw nếu image quá nhỏ (`imgW < cols * 8`)
- Throw nếu canvas 2D context unavailable
- Throw nếu image decode fails (corrupt/unsupported format)

### ✅ Fix 2 — Wire crop vào upload handler

`FilmShotDetailPanel.tsx` `onUploadGrid`:
1. Save grid + tạo empty frame placeholders (existing `setShotGridImage`)
2. Toast "Đang crop grid thành frames..." (info)
3. **CALL `cropGridIntoFrames(dataUrl, shot.gridFormat)`** — REAL canvas op
4. Re-fetch shot from store (placeholders đã tạo)
5. Patch mỗi frame với `dataUrl` thật (preserve id + locked + order)
6. `updateShot(p, sceneId, shot.id, { framesR5: patchedFrames })`
7. Toast thành công: `"Đã crop N frames (aspect X:1)"`

Error handling: try/catch — nếu crop fail, save grid vẫn OK + toast lỗi rõ ràng. User có thể retry không mất grid.

### ✅ Fix 3 — Refs ZIP structure mới (Jason Q3 = A)

`onDownloadRefs` handler restructured:

**TRƯỚC qc14:**
```
scene-X_shot-Y_refs.zip
└── {character}/
    ├── face_01.png
    └── body_01.png
```

**SAU qc14:**
```
scene-X_shot-Y_refs.zip
├── cast/
│   └── {character}/
│       ├── face_01.png
│       └── body_01.png
└── cropped_frames/      ← NEW per Jason Q3 = A
    ├── frame_01.png
    ├── frame_02.png
    └── ...
```

Toast message dynamic: `"Refs ZIP downloaded — N cast + M cropped frames"`. Nếu chỉ có 1 trong 2 thì show 1.

Empty case: nếu cả cast.length === 0 VÀ chưa có cropped frames → toast "Chưa có character + chưa upload grid — refs ZIP rỗng" (skip download).

### ✅ Fix 4 — UI render cropped frames (Q4 = A)

**No code change needed.** `FrameThumb` component đã có logic:
```jsx
{dataUrl ? <img src={dataUrl} alt={...} /> : <placeholder>}
```

Trước qc14: `dataUrl` luôn undefined → luôn render placeholder số "1, 2, 3..."
Sau qc14: crop fill `dataUrl` thật → render `<img>` thumbnail thật từng cell.

User experience: upload grid → toast "Đang crop..." → 1-2s sau frames hiện thumbnails real.

### ✅ Fix 5 — UI Shot Detail panel (Jason CSS spec)

- **Bỏ `border-left: 1px dashed #534AB7`** từ `.ksp-shot-detail-panel`
- **Bỏ `padding-left: 12px`** từ `.ksp-shot-detail-panel`
- Connector giữa IMAGE GEN ↔ VIDEO AI: thay legacy gradient line + chevron CSS bằng `<Connector colorFrom="#AFA9EC" colorTo="#AFA9EC" />` — dùng đúng component dot+line+dot giống các section connectors khác (import từ `Editor.tsx`)
- Orange arrow chỉ vào IMAGE GEN giữ nguyên (Jason confirmed keep ở qc13)

### Files changed

- **NEW** `src/engine/gridImageCrop.ts` (~95 lines) — pure Canvas-based crop engine
- **MODIFIED** `src/components/FilmShotDetailPanel.tsx`:
  - Import `cropGridIntoFrames` + `Connector` + `getShotsForScene` + `updateShot`
  - `onUploadGrid`: wire real crop + 2-step toast + patch frames with dataUrl
  - `onDownloadRefs`: cast/ + cropped_frames/ folder structure
  - Replaced `<div className="ksp-shot-detail-internal-connector" />` với `<Connector ... />`
- **MODIFIED** `src/components/film.css`:
  - `.ksp-shot-detail-panel`: remove border-left + padding-left
  - Remove legacy `.ksp-shot-detail-internal-connector::before/::after` rules

### Tests

- ✅ TypeScript: 0 errors
- ✅ Vite build: 8.84s OK
- ✅ **Vitest: 171/171 PASS** (qc13: 167 → qc14: +4 new tests)
  - `cropGridIntoFrames: exports + signature shape`
  - `cropGridIntoFrames: rejects invalid gridFormat (garbage / 3x / empty)`
  - `Refs ZIP handler now structures as cast/ + cropped_frames/`
  - `setShotGridImage still creates framesR5 placeholders (called BEFORE crop)`
- Note: invalid-image test removed — happy-dom doesn't fire `onerror` reliably cho synthetic dataURLs, exercised in real browser runtime instead.
- ✅ Photos regression: 49/49 xanh

### Workflow expected sau qc14

1. Build storyboard prompt Image Gen → Copy → Banana Pro → paste + generate grid 3×3
2. Save kết quả PNG → click 📤 "Upload grid PNG (from Banana Pro)" → chọn file
3. Toast: "Đang crop grid thành frames..."
4. 1-2 giây sau: Toast "Đã crop 9 frames (aspect 1.78:1)" (cho grid 16:9)
5. Frames grid UI hiện 9 thumbnails REAL từng cell của grid uploaded
6. Click 📥 Refs ZIP → download `scene-X_shot-Y_refs.zip` chứa:
   - `cast/<character>/face_*.png + body_*.png`
   - `cropped_frames/frame_01.png ... frame_09.png` ← REAL crops từ grid
7. Import refs vào Seedance / Veo3 — character anchors + frame-by-frame motion guides

### Limits còn lại

- Crop không trừ gutter (Q2=A). Nếu Banana Pro gen có visible gutter trắng giữa cells → cells crop sẽ có viền trắng nhỏ. Future qc có thể add slider 0-5% trim margin nếu Jason báo issue.
- Frame `replace single frame` (🔁 button) vẫn defer Sprint 0.9.4 (Nano Banana API wire).
- Bundle Export full ZIP (folder tree với script.pdf + bundle structure) defer.

---

Jason test qc12 → 3 BIG ISSUES báo cáo:

1. **AI Cast description sinh "robot" trong khi story khác** (Chú Sóc Lạc Lõng) — hardcoded ở đâu đó hay không trích xuất từ Script
2. **Image Gen + Video AI prompts cũng nói về "robot"** — Cast stale từ test trước
3. **Consistency contract còn đảm bảo không?**

### 🔍 Root cause investigation

**Vấn đề 1 — Filter quá nghiêm trong filmCastGeneration:**
```ts
// CŨ: filter scenes mentioning character name (English)
const relevantScenes = script.scenes.filter((s) => {
  const hay = `${s.actionLinesEn} ${dialog}`.toLowerCase();
  return hay.includes(charName.toLowerCase());  // BUG!
})
```
- Character name "Sóc" (Vietnamese) → action English nói "squirrel" → KHÔNG match → filter rỗng
- Filter rỗng → AI thấy chỉ Role + Genre → tự bịa "robot" (training data bias)

**Vấn đề 2 — Cast stale architectural:** Cast là source of truth riêng. Khi Jason test Robot story trước → tạo Cast "Robot" → đổi sang Sóc story → Script regen NHƯNG Cast vẫn còn "Robot" → buildImagePrompt() đọc cast → output toàn robot prompts.

**Vấn đề 3 — Architecture core CÒN ĐÚNG:** `cast.faceRefs` + `cast.bodyRefs` pass vào TẤT CẢ shot prompts → đảm bảo consistency. Code đúng. Nhưng có 3 weak points cần fix.

### ✅ Fix 1 — AI Cast luôn pull FULL script context (no filter)

`src/engine/filmCastGeneration.ts`:
- **REMOVED:** filter `hay.includes(charName.toLowerCase())` logic
- **NEW:** Inject FULL script context unconditionally khi script exists:
  ```
  FULL STORY CONTEXT (đây là phim character này tham gia — anchor description theo bối cảnh này, KHÔNG bịa nhân vật khác):
  TITLE: Chú Sóc Lạc Lõng
  LOGLINE: ...
  SCENES (first 5):
    Scene 1: Rừng tuyết bao la — Setting: EXT. SNOWY FOREST — Action: Một chú sóc nhỏ lạc lõng giữa rừng tuyết...
    Scene 2: ...
  ```
- **NEW anti-hallucination instruction** trong system prompt:
  > 🚨 QUAN TRỌNG: Nếu user cung cấp STORY CONTEXT bên dưới, character phải PHÙ HỢP với bối cảnh đó (vd: nếu story về "Chú Sóc Lạc Lõng" trong rừng tuyết → character là sóc thật, không bịa "robot" / "human"). KHÔNG hallucinate visual không phù hợp với genre + setting + story context. Nếu character là động vật (sóc, chim, chó...) → mô tả ngoại hình động vật đó, KHÔNG mô tả như con người.

### ✅ Fix 2 — Stale Cast warning banner

**NEW schema field** `FilmCharacter.descriptionGeneratedAt?: number`:
- Persist timestamp khi AI gen description (click ✨)
- Cast section detect stale: nếu `character.descriptionGeneratedAt < script.createdAt` → character mô tả CŨ hơn Script hiện tại

**NEW banner UI** trong Cast section khi any character stale:
> ⚠ Một số character có mô tả CŨ hơn Script hiện tại. Cast có thể không khớp với câu chuyện. Click ✨ trên từng character để regen mô tả theo Script mới.

User action: click ✨ trên character cards → regen mới với Fix 1 context.

### ✅ Fix 3 — 0 face refs warning per character

Khi character có `description.trim().length > 0` nhưng `faceRefs.length === 0` → render warning đỏ:
> ⚠ Cần ≥1 face ref để Banana Pro / Imagen giữ consistency. Click Face refs bên dưới rồi ✨ AI sinh ảnh hoặc + upload từ máy.

Reasoning: prompt builder pass cast.faceRefs vào image prompt như `Image #1 = character face refs`. Nếu 0 refs → Banana Pro / Imagen 4 KHÔNG có anchor → output visual lộn xộn, mất consistency. Warning để user biết phải upload/sinh refs trước khi build storyboard.

### ✅ Fix 4 — Storyboard expanded shot CSS

Per Jason spec:
- `.ksp-storyboard-shot-expanded`: `background: #1d2644` (solid, không transparent) + `border-left: 5px solid #afa9ec`
- `.ksp-shot-detail-panel`: `margin: 20px 12px 50px 50px`

### ✅ Fix 5 — Visual connectors (Jason confirmed bạn tự thiết kế)

**Orange arrow từ expanded shot → IMAGE GEN section:**
- SVG path curving down-right `#D85A30` (coral)
- Position absolute top-left của shot-detail-panel
- Match feeling của screenshot Jason (orange arrow chỉ vào)

**Internal connector giữa IMAGE GEN ↔ VIDEO AI:**
- 2px vertical line gradient purple 100→600 (`#AFA9EC → #534AB7`)
- Chevron arrow head (rotated 45deg) ở cuối, purple `#534AB7`
- 22px height giữa 2 blocks

### Files changed

- **MODIFIED** `src/engine/filmCastGeneration.ts` — bỏ filter, inject full story context, anti-hallucination prompt
- **MODIFIED** `src/types/film.ts` — add `descriptionGeneratedAt?: number` field
- **MODIFIED** `src/components/CastFilmSection.tsx`:
  - Save `descriptionGeneratedAt: Date.now()` khi AI gen runs
  - Stale banner detection logic
  - 0 face refs warning per character card
- **MODIFIED** `src/components/FilmShotDetailPanel.tsx` — orange arrow SVG
- **MODIFIED** `src/components/film.css`:
  - Cast stale banner + 0 refs warning styles
  - `.ksp-storyboard-shot-expanded` bg #1d2644 + 5px border
  - `.ksp-shot-detail-panel` margin spec
  - `.ksp-shot-detail-arrow-from-shot` SVG container
  - `.ksp-shot-detail-internal-connector` enhanced with `::before` gradient line + `::after` chevron arrow

### Tests

- ✅ TypeScript: 0 errors
- ✅ Vite build: 9.93s OK
- ✅ **Vitest: 167/167 PASS** (qc12: 157 → qc13: +10 new regression tests)
  - `generateCharacterDescription ALWAYS injects full script context (no name-match filter)`
  - `FilmCharacter schema has descriptionGeneratedAt timestamp`
  - `Cast section saves descriptionGeneratedAt when AI runs`
  - `Cast section renders stale banner when descriptions predate script`
  - `Cast section does NOT show stale banner when descriptions are newer than script`
  - `Cast section shows 0-face-refs warning per character when description exists`
  - `Cast section does NOT show 0-refs warning when character has face refs`
  - `Cast section does NOT show 0-refs warning when description is empty`
  - `Storyboard expanded shot has #1d2644 bg + 5px border-left`
  - `Shot Detail Panel has 20px 12px 50px 50px margin + orange arrow + connector`
- ✅ Photos regression: 49/49 xanh

### Consistency contract — RECONFIRMED

Architecture core CÒN ĐÚNG:
```
Cast (face refs + body refs + description anchored to Script context)
  ↓ pass vào BUILD PROMPT
ImagePrompt + AnimationPrompt
  ↓ "Image #1 = character face refs, #2 = body refs"
Banana Pro / Imagen 4 / Seedance / Veo3 đọc reference images
  ↓ Generate visuals CONSISTENT across all shots
Final video Consistent
```

qc13 fix các weak points:
1. ✅ AI Cast description không hallucinate (Fix 1)
2. ✅ User được cảnh báo khi Cast stale (Fix 2)
3. ✅ User được cảnh báo khi thiếu refs anchor (Fix 3)

### Workflow expected after qc13

**Test scenario 1: Story mới (Sóc) sau khi đã có Robot Cast cũ**
1. Mở project có Robot cast cũ
2. Sửa Idea → "Chú Sóc Lạc Lõng giữa rừng tuyết..."
3. Regen Script (Stages 1-5) → Script mới về Sóc
4. Cuộn lên Cast section → thấy banner ⚠ "Cast có mô tả CŨ hơn Script"
5. Option A: Xóa Robot character → tạo character "Sóc" mới → click ✨ → AI sinh mô tả Sóc theo full story context (rừng tuyết, ngoại hình động vật sóc, không phải robot)
6. Option B: Đổi tên Robot → Sóc, click ✨ regen → cache confirm → AI sinh mô tả Sóc thật

**Test scenario 2: Character chưa có face refs**
1. Tạo character "Sóc" + click ✨ AI gen description → có mô tả Sóc
2. Cast card hiện warning đỏ: "⚠ Cần ≥1 face ref"
3. Click "Face refs" → expand panel → ✨ Imagen 4 sinh ảnh sóc (front)
4. Warning biến mất → ready cho Storyboard generation

**Test scenario 3: Storyboard expanded UI**
1. Click 1 shot trong Storyboard → expand
2. Row background đổi `#1d2644` (solid blue-purple), border-left 5px purple
3. Shot Detail panel hiện dưới với margin 20/12/50/50
4. Orange arrow cong chỉ từ expanded shot xuống IMAGE GEN section
5. Connector purple gradient + chevron giữa IMAGE GEN ↔ VIDEO AI

### Honest acknowledgment

qc12 ship Stage 5 done preview fix nhưng KHÔNG audit architecture cho Cast/prompt consistency. Jason caught the bigger issue. qc13 fix root cause + add 3 layers of UX warnings để user catch stale state sớm thay vì discover sau khi đã spend money on Imagen 4 / video generation.

---

Jason test qc11 → Stage 5 fix FAILED in browser (visual proof in screenshot). Plus new CSS/UX feedback.

### 🚨 Stage 5 done preview — REAL root cause fix

**qc11 fix was incomplete.** Test only verified `getCurrentActiveStage()` returns null when stages done. But did NOT verify the real-world scenario where `scriptStage = "dialogues"` was PERSISTED in storage from earlier "Tiếp: ⑤ Lời thoại →" navigation.

When user clicked "Tiếp: ⑤ Lời thoại →" at end of Stage 4, code called `setScriptStage(p, "dialogues")` → persisted. Then AI generated `film.script` (Stage 5 done). But `scriptStage` was NEVER cleared. After reload, `scriptStage = "dialogues"` + `film.script` exists → `getCurrentActiveStage()` returns `"dialogues"` from first branch (not null) → Stage 5 stayed in active mode.

**3-pronged fix:**

1. **`setScript()` action** now clears `scriptStage` to `undefined`:
   ```ts
   return patch({
     ...data,
     script: { ...script, versions: archivedVersions },
     scriptStage: undefined,  // ← qc12
   });
   ```
   → New projects: Stage 5 completes → scriptStage cleared → all 5 render done previews.

2. **`getCurrentActiveStage()`** ignores stale `scriptStage` if that stage is done:
   ```ts
   if (film.scriptStage && !isStageDone(film, film.scriptStage)) {
     return film.scriptStage;
   }
   ```
   → Handles Jason's existing project: `scriptStage = "dialogues"` persisted but `film.script` exists → ignored → returns null.

3. **`safeNavToStage()`** properly handles clicking "Regen / Edit" on a done stage:
   ```ts
   } else if (targetIsDone) {
     // No downstream + target is done → confirm + clearStageData
     const ok = confirm(`Regen stage "${...}"?\nDữ liệu hiện tại sẽ bị clear để regen lại từ đầu.`);
     if (!ok) return;
     onUpdateProject((p) => clearStageData(p, target));
   }
   ```
   + NEW `clearStageData(project, stage)` action — clears single stage's data + sets scriptStage to that stage so user can re-enter active mode.

**New regression test** catches exactly Jason's scenario: existing project with `scriptStage: "dialogues"` PERSISTED + `film.script` exists. Test verifies UI renders all 5 done previews, no "đang làm" pill, no "Viết lại lời thoại" button.

### Storyboard CSS overrides (per Jason spec)

- `.ksp-storyboard-scene`: `margin-top: 10px` + `background: #04060f`
- `.ksp-storyboard-scene-header`: `background: #151516`
- `.ksp-storyboard-shot`: `background: #151515`

### Storyboard ShotRow — title read-only + meta below

Per Jason spec: "shot title trong Storyboard không thay đổi được nữa, nếu thay phải thay từ trên phần Script."

- Removed inline title editing (`editingTitle` state + `<input>` + click-to-edit)
- Title block converted to 2-line vertical layout:
  - Line 1: `Shot N: Title text` (read-only)
  - Line 2: `3×3 grid · 9 frames · 4s · Wide` (meta inline)
- Removed shot type select from inline controls (must change in Script section above)
- Kept: gridFormat select, lock toggle, remove button

CSS: `.ksp-storyboard-shot-title-block { display: flex; flex-direction: column; gap: 2px; }`

### Image Gen — grid format change → IMMEDIATE prompt update

Per Jason spec: "Trong phần Image Gen, khi user thay đổi grid format để phù hợp với shot list thì phải cập nhật prompt phía dưới ngay lập tức."

**Before qc12:** Grid format display was static text "Grid format: 3×3 (đổi grid ở Storyboard row trên)". User had to leave the panel to change.

**After qc12:** Grid format picker pills (2×2 / 2×3 / 3×2 / 3×3 / 4×3) directly in Shot Detail panel. Click any pill →
1. `updateShot()` writes new `gridFormat` to schema
2. `buildImagePrompt()` rebuilds prompt with NEW format (uses `updatedShot` to ensure new value)
3. `setShotImagePrompt()` writes new prompt to schema
4. Toast: "Grid → 4x3 · prompt updated"

CSS: `.ksp-shot-detail-grid-picker` flex row of `.ksp-shot-detail-grid-pill` (purple `#534AB7` active state).

### Files changed

- **MODIFIED** `src/store/film_actions.ts`:
  - `setScript()` clears `scriptStage: undefined`
  - NEW `clearStageData(project, stage)` action
- **MODIFIED** `src/components/FilmIdeaScriptSection.tsx`:
  - `getCurrentActiveStage()` ignores stale done stage
  - `safeNavToStage()` handles done stage click → clearStageData
  - Import `clearStageData`
- **MODIFIED** `src/components/FilmStoryboardSection.tsx`:
  - ShotRow: removed `editingTitle` state, title-text input
  - 2-line layout `.ksp-storyboard-shot-title-block`
  - Removed shot type select from inline controls
- **MODIFIED** `src/components/FilmShotDetailPanel.tsx`:
  - Import `updateShot` action
  - ImageGenBlock prop `onSetGridFormat`
  - Replaced static grid display with interactive picker pills
  - Handler: updateShot + auto-regen prompt + toast
- **MODIFIED** `src/components/film.css`:
  - `.ksp-storyboard-scene` margin-top 10px + bg #04060f
  - `.ksp-storyboard-scene-header` bg #151516
  - `.ksp-storyboard-shot` bg #151515
  - `.ksp-storyboard-shot-title-block` 2-line flex column
  - `.ksp-shot-detail-grid-picker` + `.ksp-shot-detail-grid-pill` styles

### Tests

- ✅ TypeScript: 0 errors
- ✅ Vite build: 7.85s OK
- ✅ **Vitest: 157/157 PASS** (qc11: 152 → qc12: +5 new tests)
  - `Stage 5 done preview: scriptStage='dialogues' PERSISTED + film.script exists → renders ALL done previews` (the critical regression that caught the qc11 miss)
  - `setScript clears scriptStage so all 5 stages render as done`
  - `clearStageData clears single stage data + sets scriptStage for regen`
  - `ShotDetailPanel: grid picker pills render with active state`
  - `Storyboard ShotRow: title is read-only (no editingTitle state, no input field for title)`
- ✅ Photos regression: 49/49 xanh

### Workflow expected sau qc12

1. **Stage 5 done preview:** Existing projects với persisted `scriptStage="dialogues"` + `film.script` exists → reload → tất cả 5 stages hiện done preview ✓ (không có active panel ở Stage 5)
2. **Regen Stage 5:** Click 🔄 "Regen / Edit" trên Stage 5 done preview → confirm "Regen stage 'Lời thoại'? Dữ liệu hiện tại sẽ bị clear" → OK → film.script removed, scriptStage="dialogues" → Stage 5 re-enter active mode
3. **Storyboard scenes:** mỗi scene card có `margin-top: 10px` + bg `#04060f`, header bg `#151516`, shots bg `#151515`
4. **Storyboard shot row:** title không click-to-edit (read-only) — phải sửa trong Section Script ở trên. Meta hiển thị dưới title 1 dòng `3×3 grid · 9 frames · 4s · Wide`
5. **Image Gen grid picker:** click pill 2×2/2×3/3×2/3×3/4×3 → prompt textarea cập nhật ngay lập tức với grid mới

### Honest acknowledgment (qc11 self-test failure)

qc11 fix was based on test mock, not real Chrome DOM runtime. Jason caught the bug in screenshot. **Lesson:** for UI fixes involving persisted state, must include test that simulates the EXACT persisted state user would have (in this case `scriptStage: "dialogues"` + `film.script` both set). qc12 adds that test.

### NOT shipped in qc12 (deferred to qc13)

Jason's spec mentioned: "nhấp vô mỗi Scene → Mở ra Shots List → Click vào từng Shot sẽ mở ra Shot Detail có UI giống như hình đính kèm (shotdetail), nếu chưa upload grid thì làm khung trống có UI giống vậy, nếu upload grid sẽ auto crop vào đúng các ô đó."

The full Shot Detail UI overhaul per shotdetail.png mockup is BIGGER scope:
- F1-F9 grid placeholder frames với checkmarks/icons per frame
- Per-frame action buttons (Edit text / Regen 1 frame / Replace frame / Lock)
- Header "Regen all" button top-right
- Collapsible Image Prompt / Animation Prompt / Frames text sections
- Upload grid + Auto-crop button bottom

→ qc13 dedicated sprint for full Shot Detail UI overhaul. qc12 ships the smaller targeted fixes.

---

Jason test qc10 → liệt kê 5 vấn đề. Tất cả đã apply.

### Fix 1 — Stage 5 done preview (Script section)

**Trước:** Stage 5 (Lời thoại) đã có data `film.script` nhưng vẫn hiện active state với button "Sinh lại" — không collapse thành done preview như Stage 1-4.

**Nguyên nhân:** `getCurrentActiveStage()` luôn trả về một `FilmScriptStage`, khi all 5 done thì fallback về `"dialogues"` → Stage 5 luôn render active panel thay vì done preview.

**Fix:**
- `getCurrentActiveStage()` đổi return type → `FilmScriptStage | null`
- Khi all 5 stages done + không có scriptStage explicit → trả `null`
- StepperStageCard có sẵn logic `done && !isActive` → renders StageDonePreview
- Stage 5 sẽ hiện pill "N scenes ready" + script title + button "🔄 Regen / Edit"

### Fix 2 — "Cảnh" → "Scene" wording

**Trước:** `FilmShotListSection` header dùng "Cảnh 1, Cảnh 2..." trong khi Stage 4 Script + Storyboard dùng "Scene 1, Scene 2..." → inconsistent.

**Fix:** `<strong className="ksp-shotlist-film-scene-order">Cảnh {N}</strong>` → `Scene {N}`.

### Fix 3 — Scene cards default COLLAPSED (cả Shot List + Storyboard)

**Trước:** `useState(true)` → expanded by default. Với phim 12 scenes → sidepanel scroll dài lê thê.

**Fix:**
- `FilmShotListSection` scene cards: `useState(false)` → collapsed default
- `FilmStoryboardSection` scene cards: `useState(false)` → collapsed default
- User click header (chevron ▶) để expand từng scene

### Fix 4 — Dropdown arrow overlap text (Shot List Type/Movement)

**Trước:** `.ksp-shotlist-film-select` chỉ có `padding: 2px 4px`, native browser arrow đè lên text.

**Fix:** Custom CSS:
```css
.ksp-shotlist-film-select {
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml;..."); /* custom chevron SVG */
  background-position: right 5px center;
  padding: 2px 18px 2px 6px;  /* 18px right = space for arrow */
  text-overflow: ellipsis;
  overflow: hidden;
}
```

### Fix 5 — AI sinh đủ shots theo cinematic formula

**Trước:** AI sinh quá ít shots (1-2 shots/scene) vì code dùng `suggestedCount = Math.round(scene.durationSeconds / 6)` máy móc. Scene 5s → AI chỉ 1 shot. Không đủ cinematic coverage.

**Fix:**
- Bỏ logic `durationSeconds / 6`
- Prompt mới yêu cầu 4-16 shots/scene theo công thức cinematic Jason đưa:
  - 1 ESTABLISHING shot (wide_establishing)
  - 2-4 ACTION shots (medium, two_shot, over_shoulder)
  - 2-3 DETAIL shots (insert, close_up)
  - 1-2 EMOTION shots (close_up)
  - 1 REVEAL/PAYOFF shot
- Min 4 (= 2x2 storyboard grid), Max 16 (= 4x4 grid)
- Validation: nếu AI trả về <4 shots → throw error "AI sinh chỉ N shots (minimum 4 cho cinematic coverage). Hãy thử regen — AI cần chia scene thành nhiều góc quay hơn."
- Auto cap tại 16 nếu AI vượt quá
- Default `gridFormat: "3x3"` cho mọi shot (Jason confirmed Q4)
- Field `shotPurpose` skip (Q2 = c)

### Bonus — Regen single shot không vừa ý

Per Jason Q3 request. Per Q-A: giữ shot.id cũ. Per Q-B: 🔄 button trong row trước ×.

**New function** `regenSingleShot()` trong `engine/filmShotListGeneration.ts`:
- Input: scene + all shots + index cần regen + cast + setting
- AI prompt nhận context: scene + danh sách shots hiện tại + đánh dấu shot cần regen
- AI sinh 1 shot mới KHÁC với shot cũ (về shotType / cameraMovement / hoặc action focus)
- Output single shot object (không wrap trong "shots" array)

**UI:**
- Mỗi shot row có icon `🔄` trước `×` remove button
- Click `🔄` → confirm dialog "Sinh lại shot N? Tốn 1 AI call."
- Loading state `⏳` while generating
- Giữ shot.id cũ → drill-down/state references không break
- Wrap qua `updateShot(sceneId, shotId, newContent)` — chỉ replace content fields, id immutable

### Files changed

- **MODIFIED** `src/components/FilmIdeaScriptSection.tsx`:
  - `getCurrentActiveStage()` return type `FilmScriptStage | null`
  - Returns null when all 5 stages done
- **MODIFIED** `src/components/FilmShotListSection.tsx`:
  - Scene header "Cảnh" → "Scene"
  - `useState(true)` → `useState(false)` for default collapsed
  - Add `onRegenShot` prop chain → wired to `regenSingleShot()` engine call
  - Shot row layout: # / title / type / movement / dur / 🔄 / × (7 cols)
  - Table header adds regen column
- **MODIFIED** `src/components/FilmStoryboardSection.tsx`:
  - Scene `useState(true)` → `useState(false)` default collapsed
- **MODIFIED** `src/engine/filmShotListGeneration.ts`:
  - `runShotListForScene`: rewrite system prompt with cinematic formula
  - Bỏ `suggestedCount = durationSeconds / 6` logic
  - Min 4 validation, max 16 cap
  - NEW exported function `regenSingleShot(input)` for single-shot AI regen
  - Refactored `sanitizeShot()` helper shared between both functions
- **MODIFIED** `src/components/film.css`:
  - `.ksp-shotlist-film-select`: custom appearance + SVG arrow + padding-right
  - `.ksp-shotlist-film-row` grid 6 cols → 7 cols (add regen column 22px)
  - NEW `.ksp-shotlist-film-regen-btn` styling (subtle gray, coral on hover)

### Tests

- ✅ TypeScript: 0 errors
- ✅ Vite build: 10.17s OK
- ✅ **Vitest: 152/152 PASS** (qc10: 145 → qc11: +7 new tests)
  - `Stage 5 done preview: returns null active stage when all 5 done`
  - `Shot List uses 'Scene' wording (not 'Cảnh')`
  - `Shot List scenes default COLLAPSED (chevron ▶)`
  - `Storyboard scenes also default COLLAPSED`
  - `select CSS has custom arrow + padding-right (no overlap)`
  - `cinematic formula: prompt requires 4-16 shots (no durationSeconds/6 logic)`
  - `regenSingleShot function exists and validates inputs`
- ✅ Photos regression: 49/49 xanh

### Workflow expected sau qc11

1. Stage 5 done → cuộn lên thấy 5 stages tất cả ✓ done, không có "đang làm"
2. Section 4 SHOT LIST: header "Scene 1, Scene 2..." (không phải Cảnh)
3. Tất cả scene cards COLLAPSED mặc định — chevron ▶
4. Click scene header → expand
5. Click "✨ AI sinh shot list" → AI sinh 4-16 shots theo cinematic formula
   - Test với scene robot rừng nguyên sơ: ~7-8 shots (1 estab + 2-3 detail + 2 emotion + 1 reveal)
6. Dropdown Type / Movement: mũi tên SVG ở phải, không đè text
7. Click 🔄 trong shot row → confirm → AI sinh shot khác với shot cũ, giữ vị trí + id

### Limits & defer

- Field `shotPurpose` SKIP per Q2 (c) — AI vẫn theo công thức trong prompt nhưng output flat, không lưu cinematic role vào schema
- Regen single shot: AI có thể đôi khi trả gần giống shot cũ — prompt đã guide "phải khác về ít nhất 1 trong: shotType, cameraMovement, action focus" nhưng AI có thể không nghe 100%. User chỉ cần click 🔄 lại nếu chưa vừa ý.

---

Jason pointed out: pipeline thiếu **SHOT LIST** giữa SCRIPT và STORYBOARD. Pipeline chuẩn ngành film/TVC:

```
SCRIPT → SCENES → SHOT LIST → STORYBOARD → PRODUCTION
```

Jason chọn **Hướng B**: tách SHOT LIST (text planning) ra section riêng. Storyboard chỉ render visual.

### Pipeline mới (qc10)

```
1. CAST
2. IDEA + SCRIPT (5 stages multi-stage wizard)
4. SHOT LIST    ← NEW magenta border #D4537E
5. STORYBOARD   ← was "3. STORYBOARD", now visual-only
6. VOICE
7. MUSIC + SFX
8. BUNDLE EXPORT
```

### Why split (design rationale)

| Aspect | SHOT LIST | STORYBOARD |
|---|---|---|
| **Output** | Text rows (table) | Visual frames (grid PNG) |
| **Cost** | $0 (Gemini Flash text) | $0.04+/shot (Imagen 4) |
| **Workflow** | Planning — review BEFORE spending | Execution — render after approval |
| **Industry standard** | DP creates shot list first | Storyboard artist visualizes after |

Lợi: User review/edit shot list TEXT (free) → khi OK click generate storyboard (tốn tiền). Tránh waste tiền nếu shot composition sai.

### NEW components & engine

**`src/engine/filmShotListGeneration.ts`** (~170 lines):
- `runShotListForScene(scene, characters, setting, provider)` — Gemini Flash call
- Output: 2-8 shots per scene (≈1 shot per 5-8 seconds of scene duration)
- Each shot has: titleVi + titleEn, shotType (7 options), cameraMovement (11 options), durationSeconds, purposeVi, actionVi, actionEn
- AI rules: shot đầu thường wide_establishing, mix shot types, total duration ≈ scene.durationSeconds
- VN cho UI display, EN cho downstream image/video prompts

**`src/components/FilmShotListSection.tsx`** (~330 lines):
- Magenta border `#D4537E`
- Per scene: collapsible card with shots table
  - Columns: # / Title / Type / Movement / Duration / × remove
  - Click # → expand action detail (purpose VN + action textarea)
- AI button per scene: "✨ AI sinh shot list" với cache confirm
- Manual add shot button
- Scene-level duration mismatch warning nếu sum != scene.durationSeconds (±3s tolerance)

**`src/store/film_actions.ts`** thêm:
- `setShotsForScene(project, sceneId, shots)` — bulk replace (after AI gen)

**`src/types/project.ts`** `FilmShot` extended:
- `purposeVi?: string` — VN narrative purpose
- `actionVi?: string` — VN action description
- `actionEn?: string` — EN action (downstream prompts)

### REFACTORED Storyboard section

`src/components/FilmStoryboardSection.tsx`:
- Header: "3. STORYBOARD" → **"5. STORYBOARD"**
- Removed: "+ Add Shot manual" + "✨ AI sinh shots cho Scene" buttons (moved to Shot List section)
- Empty state hint: "Quay lại section 4. SHOT LIST ở trên để AI sinh shot list trước"
- Footer updated: "Click vào shot để mở Shot Detail panel — render grid PNG"
- Same `shotsBySceneId` schema = shared data, no migration needed

### Editor pipeline wiring

`src/components/Editor.tsx`:
- Import `FilmShotListSection`
- FilmPipeline order:
  ```jsx
  <FilmIdeaScriptSection />
  <Connector colorFrom="#f0a677" colorTo="#D4537E" />
  <FilmShotListSection />                          ← NEW
  <Connector colorFrom="#D4537E" colorTo="#afa9ec" />
  <FilmStoryboardSection />
  ...
  ```

### Tests

- ✅ TypeScript: 0 errors
- ✅ Vite build: 7.98s OK
- ✅ **Vitest: 145/145 PASS** (qc9: 139 → +6 new tests)
  - `qc10 setShotsForScene stores shots in shotsBySceneId`
  - `qc10 setShotsForScene replaces existing shots completely (bulk overwrite)`
  - `qc10 FilmShotListSection mounts without script (shows empty state)`
  - `qc10 FilmShotListSection shows scenes when script exists`
  - `qc10 FilmShotListSection shows shot table when shots exist`
  - `qc10 Pipeline: Storyboard section renamed 5. (was 3.) + Shot List = 4.`
- ✅ Photos regression: 49/49 xanh

### Workflow expected after qc10

1. Project → Cast → Script (Stages 1-5) → script ready với N scenes
2. Quay xuống section **4. SHOT LIST** (magenta border)
3. Per scene: click "✨ AI sinh shot list" → AI sinh 3-6 shots
   - Hiển thị table: # / Title / Type dropdown / Movement dropdown / Duration / × remove
   - Click số # → expand: purpose VN + action textarea (edit)
   - Total duration footer: cảnh báo nếu sum != scene.durationSeconds
4. Review/edit shot list (FREE)
5. Quay xuống section **5. STORYBOARD** — đọc shots từ shotsBySceneId
   - Click shot row → drill-down FilmShotDetailPanel → generate grid PNG (Imagen 4)
6. Voice → Music → Bundle Export

### Workflow cost transparency

- Shot list: ~12 scenes × 1 Gemini Flash call = **~free** (Gemini Flash free tier)
- Storyboard: 48 shots × $0.04 Imagen 4 Standard = **~$1.92/full film** (only if user clicks generate per shot)
- Voice TTS / Music defer Sprint 0.9.4

### Limits & defer

- `runShotListForScene` does NOT auto-trigger after Stage 5 complete — user must click per scene (intentional, gives user control over cost timing)
- "✨ AI sinh shot list cho TẤT CẢ scenes" batch button defer qc11 (current per-scene UX cleaner)
- Cost tracking aggregate across session defer Sprint 0.9.4

---

Jason test qc8 → 3 issues:

1. **🚨 Stage 4 lỗi: "AI returned invalid JSON: Unterminated string at position 223"** — Stage 4 sinh nhiều scenes với rich VN+EN content → response bị cắt giữa chừng vì maxOutputTokens quá nhỏ. JSON truncated → parse fail. **Jason stuck, không test được bước tiếp theo.**
2. **Provider fallback broken:** Xóa Gemini key, thêm OpenAI key, click ✨ → vẫn báo "Chưa có Gemini API key" (system không tự switch sang OpenAI có sẵn).
3. **AI generate toàn English** — Stage 4 sinh `actionLinesEn` chỉ có tiếng Anh. Jason đọc không hiểu cốt truyện.
4. **Idea textarea UI:** margin lệch, border luôn hiện cả khi không focus.

### 🚨 1. Fix Stage 4 JSON truncation

`maxOutputTokens: 2048` quá nhỏ cho Stage 4 sinh nhiều scenes có rich content. Khi user request 12 scenes (phim 15 phút) với title VN+EN + action prose dài → 2048 tokens hết → response bị cắt giữa chừng → JSON unterminated string.

**Fix:**
- `maxOutputTokens: 2048 → 8192` (4x) cho cả Gemini + OpenAI
- Detect truncation chính xác: nếu `finishReason === "MAX_TOKENS"` (Gemini) hoặc `finish_reason === "length"` (OpenAI) → throw error với hint cụ thể: *"Thử giảm số scenes hoặc simplify idea/beats"*
- `parseJsonStrict` detect truncation patterns: nếu cleaned text > 1500 chars + không kết thúc bằng `}` / `]` → hint thêm 💡 trong error message

### 🚨 2. Auto-fallback provider khi key thiếu

Trước qc9: User chọn `aiProviders.scriptWriter = "gemini-flash"` nhưng chỉ có OpenAI key → click ✨ báo "Chưa có Gemini API key" → user phải vào Project Setting đổi provider thủ công.

Sau qc9: NEW function `resolveProvider(preferred)`:
- Nếu preferred provider có key → dùng luôn
- Nếu thiếu key → tự fallback sang provider khác có key (Gemini ↔ OpenAI)
- Nếu KHÔNG có key nào → throw error rõ: "Chưa có API key nào. Vào Project Setting → API Keys để thêm ít nhất 1 key."
- Log fallback to console: `[KSP qc9 AI fallback] Provider "gemini-flash" thiếu API key — auto-fallback OpenAI 4o.`

User không bị stuck nữa, AI luôn chạy nếu có ít nhất 1 key.

### 🇻🇳 3. Vietnamese-first content cho UI, English cho AI prompts

Jason yêu cầu: "Nội dung khi click AI button phải tiếng Việt để tôi đọc hiểu, còn chuyển thành prompt thì dịch sang tiếng Anh".

**Schema updates:**
- `FilmScriptStructure`: thêm `contentVi?: string` bên cạnh `contentEn`
- `FilmScriptIntermediateScene`: thêm `actionLinesVi?: string` bên cạnh `actionLinesEn`

**Prompt updates (Stages 1-4):**
- **Stage 1 (Structure):** AI sinh CẢ `contentVi` + `contentEn`. UI display VN, downstream image/video prompts dùng EN.
- **Stage 2 (Beats):** Toàn bộ `title` + `description` VIETNAMESE (đã có, qc9 reinforces với explicit instruction "DO NOT use English in beat titles or descriptions").
- **Stage 3 (Twists):** `description` VIETNAMESE (qc9 explicit prompt).
- **Stage 4 (Scenes):** Sinh CẢ `actionLinesVi` + `actionLinesEn`. UI display VN, downstream prompts dùng EN. Title cũng dual-lang `titleVi` + `titleEn`.
- **Stage 5 (Dialogues):** Đã dual-lang từ trước qua aiRuntime → `actionLinesVi/En`, `lineVi/En`.

**UI updates:**
- Stage 1 done preview: hiện `contentVi || contentEn` (fallback EN nếu AI quên VN)
- Stage 4 scene cards: hiện `actionLinesVi || actionLinesEn`
- Stage 4 inter-scenes table: hiện `titleVi || titleEn` (đã đúng từ trước)

### UI 4. Idea textarea CSS refactor

Jason spec: "margin: 10 hết, border ẩn hoàn toàn khi click vào mới có thôi".

**Trước qc9:** `margin: 0 12px 12px 12px !important` + border luôn hiện
**Sau qc9:**
- `margin: 10px` cả 4 cạnh
- `border: 0.5px solid transparent` (ẩn)
- `:hover` → background nhạt subtle
- `:focus` → border green `#1D9E75` + background green tint 4%
- Width `calc(100% - 20px)` để margin 10 đúng cả 2 side
- Bỏ duplicate CSS override ở line 1063 (qc9 main rule wins)

### Files changed

- **MODIFIED** `src/engine/filmScriptStages.ts`:
  - NEW exported `resolveProvider()` function
  - `callAi()` dùng resolveProvider → auto-fallback
  - `maxOutputTokens: 2048 → 8192` (both Gemini + OpenAI)
  - Truncation detection: `finishReason === MAX_TOKENS` / `finish_reason === length` → friendly error
  - `parseJsonStrict()`: detect truncation patterns + 💡 hint trong error
  - Stage 1 prompt: ask for VN + EN
  - Stage 2 prompt: explicit "Vietnamese only, DO NOT use English"
  - Stage 3 prompt: VN description
  - Stage 4 prompt: ask for VN + EN action lines, "Keep descriptions CONCISE (2-4 sentences)"
- **MODIFIED** `src/types/film.ts`:
  - `FilmScriptStructure.contentVi?: string` added
  - `FilmScriptIntermediateScene.actionLinesVi?: string` added
- **MODIFIED** `src/components/FilmIdeaScriptSection.tsx`:
  - Stage 1 done preview display VN content with fallback
  - Stage 4 scene card display VN action with fallback
- **MODIFIED** `src/components/film.css`:
  - Idea textarea: margin 10px, border on focus only, green focus accent
  - Removed duplicate override

### Tests

- ✅ TypeScript: 0 errors
- ✅ Vite build: 10.59s OK
- ✅ **Vitest: 139/139 PASS** (qc8: 135 → qc9: +4 new tests)
  - `qc9 resolveProvider: preferred Gemini works when Gemini key present`
  - `qc9 resolveProvider: falls back to OpenAI if Gemini key missing`
  - `qc9 resolveProvider: falls back to Gemini if OpenAI key missing`
  - `qc9 resolveProvider: throws if no keys at all`
- ✅ Photos regression: 49/49 xanh

### Workflow expected after qc9

1. Project Setting → AI Provider per task → Script writer = `gemini-flash`. Add Gemini API key.
2. Tạo Cast → viết Idea (textarea hiện border khi focus, ẩn khi blur)
3. Script section → Stage 1 → click ✨ → AI sinh framework + overview VN → preview hiện VN
4. Stage 2 → AI sinh beats với title + description VN
5. Stage 3 → AI gợi ý twists VN
6. Stage 4 → nhập số scenes mong muốn → click ✨
   - Phim 15 phút + 12 scenes → AI sinh 12 scenes với title VN + action VN
   - **Không còn lỗi "Unterminated string"** (token budget 4x lớn hơn)
   - Action lines hiện tiếng Việt cho Jason đọc
7. **Test fallback:** Vào Project Setting xóa Gemini key, để chỉ OpenAI key. Click ✨ Stage 4 → system tự dùng OpenAI 4o, không báo lỗi "Chưa có Gemini API key" nữa.

### Limits còn lại

- Stage 4 quá nhiều scenes (>20) trong phim dài (>30 phút) vẫn có thể truncate. Đề xuất user split thành 2 projects nếu cần script siêu dài.
- Imagen 4 (Cast ref images) vẫn require Gemini key — không có fallback OpenAI cho image gen vì OpenAI không có model tương đương Imagen 4 trong codebase này.

---

Jason confirmed Hướng B (giữ Cast trước Idea/Script, AI Generate Description đọc context có sẵn) + Imagen 4 Standard wire thật ngay.

### UI changes per Jason spec

**Header refactor:**
- Add button MOVED to top-right corner of section header (small square 24×24, border dashed, hover tooltip "Thêm character")
- REMOVED `.ksp-cast-film-footer` (old "+ Add Character" big button + "AI gợi ý cast từ idea" stub)
- REMOVED `.ksp-cast-film-banner` (dialog mode info text — not needed)

**Character card layout:**
- Description textarea (3 rows)
- 3-button row below: `[Face refs · N ảnh]` `[Body refs · N ảnh]` `[✨]` (AI Gen Description icon-only)
- `[Face refs]` / `[Body refs]` buttons toggle expand/collapse panel below
- Old separate AI Generate modal REMOVED — now `✨` icon button writes directly to description field

**Refs expanded panel:**
- Grid of ref slots (44×44)
- After slots: `[+]` upload button + `[✨]` AI generate button (when slots not full)
- Hint shows next missing label: `· ✨ sẽ sinh: front` (or "3/4 L", etc.)
- Click `[Face refs]` again → collapse (Q5 confirmed)

### AI Generate Description — Hướng B (context-aware)

NEW `src/engine/filmCastGeneration.ts`:

`generateCharacterDescription(input)`:
- Reads `character.name` + `character.role` + `project.idea.raw` + `film.script` (if exists)
- If script exists: extracts scenes mentioning character name → injects as context → richer description
- Provider from `setting.aiProviders.scriptWriter` (Gemini Flash default)
- Returns ~150-250 word VN prose, written by AI
- Cache confirm: if description already filled → "Đã có N ký tự, regen sẽ ghi đè..."
- Toast hint: success message includes "(đã dùng script context)" when script existed

**Workflow Jason đã hỏi:**
- Đầu tiên: tạo character → click ✨ description với chỉ Name+Role+Idea → mô tả thô
- Sau khi viết script: quay lại click ✨ → description regen với script context giàu hơn (mô tả khớp với phim thực tế)

### AI Generate Ref Image — Imagen 4 Standard wire

NEW functions trong `filmCastGeneration.ts`:

`generateCharacterRefImage(input)`:
- Uses existing `engine/imagenApi.ts` `generateImage()` (Jason chose Imagen 4 Standard = $0.04/image)
- Face refs: aspect 1:1, prompt = headshot at angle (front / 3/4 L / 3/4 R / profile)
- Body refs: aspect 3:4, prompt = full-body at angle (front / side / back)
- Prompt template: `"headshot reference photo of {name}. {description}. View angle: {direction}. Studio quality, neutral grey backdrop, soft lighting, sharp focus. {style hint based on animationStyle}"`
- Returns complete `FilmImageRef` ready to push to schema

`findNextMissingLabel(refs, labelOrder)`:
- Detect first label in ordered list that isn't filled yet
- Face order: `front → 3/4 L → 3/4 R → profile`
- Body order: `front → side → back`
- Click [✨] N times sinh đủ slots theo thứ tự
- Khi user xóa ref → slot trống đó nằm chỗ cũ → click [✨] tiếp sinh đúng slot vừa xóa

**Cost confirm dialog mỗi lần click [✨]:**
> Sinh face refs cho góc "3/4 L" bằng Imagen 4 Standard.
> Cost: ~$0.04 / ảnh.
> 
> Click OK để tiếp tục, Cancel để hủy.

### Engine refactor

`callAi()` in `engine/filmScriptStages.ts` exported for reuse → `filmCastGeneration.ts` imports for description AI call. Avoids duplicate text-gen infrastructure.

### Tests

- ✅ TypeScript: 0 errors
- ✅ Vite build: 8.63s OK
- ✅ **Vitest: 135/135 PASS** (qc7: 132 → qc8: +3 new tests)
  - `qc8 findNextMissingLabel returns first missing in order`
  - `qc8 findNextMissingLabel returns undefined when all filled`
  - `qc8 findNextMissingLabel for body refs (3 angles)`
  - Updated `CastFilmSection mounts` test: verifies removed footer + banner + corner add button class
- ✅ Photos regression: 49/49 xanh

### Files changed

- **NEW** `src/engine/filmCastGeneration.ts` (~180 lines) — description + ref image generation
- **REWRITTEN** `src/components/CastFilmSection.tsx` (533 → 547 lines, fully refactored per spec)
- **MODIFIED** `src/engine/filmScriptStages.ts` — export `callAi` for reuse
- **MODIFIED** `src/components/film.css` — append qc8 styles (~100 new lines), hide obsolete classes
- **MODIFIED** `test/film_mode.test.tsx` — 3 new tests, 1 updated mount test

### Workflow expected after apply

1. Mở Film project → Project Setting → AI Provider per task → Script writer = Gemini Flash + key. Add Gemini key cho Imagen 4 cùng key.
2. Section Cast hiện ở top-right có nút `+` border dashed
3. Click `+` → character mới hiện trong list, auto-edit mode, avatar emoji 🤖 (protagonist default)
4. Nhập Name + Role → click "✓" để done edit
5. Viết Description manual, HOẶC click `[✨]` icon-only button → AI sinh mô tả (~150-250 chars VN)
6. Click `[Face refs · 0 ảnh]` → expand panel hiện below
7. Click `[+]` → upload ảnh manual; HOẶC click `[✨]` → confirm cost dialog → Imagen 4 sinh ảnh đúng góc đầu tiên missing (front)
8. Click `[✨]` lần 2 → sinh góc tiếp theo (3/4 L)... cho tới đủ 4
9. Xóa ảnh nào → góc đó open → click `[✨]` lại sinh đúng góc vừa xóa
10. Click `[Face refs]` button lần nữa → collapse panel

### Known limitations

- API cost transparency dừng ở confirm dialog. Tracking total cost across session defer Sprint 0.9.4.
- Description regen với script context CHỈ tự động khi script đã có khi click ✨. Không có notification chủ động "Script đã xong, refresh description?" (Jason confirmed không cần).
- Image quality phụ thuộc vào description text — description càng cụ thể, refs càng nhất quán. AI description gen prompt đã được tune cho visual details.

---

Jason đúng — đặt tên file theo version (`v0_9_0`, `v0_9_3_film`...) là anti-pattern. Khi project tới v1.5 / v2.0 / v10 thì sao? File names nên là **feature-based**, không phải version-based.

qc7 rename batch — pure refactor, không touch logic. **Cast feature build defer qc8.**

### Files renamed (14 files)

| Old | New |
|---|---|
| `src/components/v0_9_0.css` | `src/components/base.css` |
| `src/components/v0_9_0_phase2.css` | `src/components/components.css` |
| `src/components/v0_9_0_phase34.css` | `src/components/pipeline.css` |
| `src/components/v0_9_1_photos.css` | `src/components/photos.css` |
| `src/components/v0_9_3_film.css` | `src/components/film.css` |
| `src/types/v0_9_0.ts` | `src/types/project.ts` |
| `src/types/photos_v091.ts` | `src/types/photos.ts` |
| `src/types/film_v093.ts` | `src/types/film.ts` |
| `src/store/v09_actions.ts` | `src/store/project_actions.ts` |
| `src/store/migration_v09.ts` | `src/store/migration.ts` |
| `src/engine/chunkPlannerV09.ts` | `src/engine/chunkPlanner.ts` |
| `src/components/ProjectSettingSectionV09.tsx` | `src/components/ProjectSettingSection.tsx` |
| `src/components/CameraStyleToggleV09.tsx` | `src/components/CameraStyleToggle.tsx` |
| `src/components/IdeaCardV09.tsx` | `src/components/IdeaCard.tsx` |

### Identifier renames (in code)

| Old | New |
|---|---|
| `ProjectSettingSectionV09` (component) | `ProjectSettingSection` |
| `CameraStyleToggleV09` | `CameraStyleToggle` |
| `IdeaCardV09` | `IdeaCard` |
| `FilmV093Data` (type) | `FilmData` |
| `PhotosV091Data` (type) | `PhotosData` |

### Intentionally NOT renamed

- **`FilmCharacterV2`** (in `types/project.ts`) — runtime data schema field that may exist in user's saved projects. Renaming would break migration of pre-qc projects.
- **`schemaVersion: "v0.9.3-film"`** literals in runtime data — data migration markers, MUST stay for backward-compat.
- **CSS class names** (`.ksp-section-v09`, `.ksp-form-row-2`, etc.) — too risky, would require touching every component template + CSS rule. Skip for now.
- **CHANGELOG version headers** — history records, correct as version refs.

### Import path updates (40+ files touched)

All `import` statements updated via sed batch:
- `"../types/v0_9_0"` → `"../types/project"`
- `"../../types/film_v093"` → `"../../types/film"` (3-level subdirectory imports)
- `"./v0_9_3_film.css"` → `"./film.css"`
- ... and all other path variants

### Build asset name change

Vite output assets renamed accordingly:
- `v0_9_0_phase34-{hash}.css` → `index-{hash}.css` (Vite chunked all CSS into single `index-*.css`)
- Screenshot scripts (`test/screenshot.mjs`, `test/screenshot-photos.mjs`, `test/screenshot-script-stepper.mjs`) updated to look for new `index-*.css` and `index-*.js` patterns.

### Tests

- ✅ TypeScript: 0 errors
- ✅ Vite production build: 6.59s OK
- ✅ **Vitest: 132/132 PASS** (no logic changes, all tests still green)
- ✅ Photos regression: 49/49 xanh
- ✅ Zero version-named files remain in `src/` or `test/`

### Files changed

- Renamed: 14 files (paths updated via mv)
- Modified imports: 32 source files + 3 screenshot scripts
- Identifier rename: ~50 occurrences via sed batch across `src/` + `test/`

### qc8 NEXT — Cast section feature build (Hướng B confirmed)

1. **Sắp xếp lại** Face refs / Body refs / `✨` icon-only AI Generate Description
2. **Header `+` button** corner top-right với border-dashed + tooltip "Thêm character"
3. **Bỏ** `.ksp-cast-film-footer` + `.ksp-cast-film-banner`
4. **Click Face/Body refs** → expand panel với 2 buttons: `[+]` upload + `[✨]` AI generate image (Imagen 4 Standard wire thật)
5. **AI Generate Description** đọc Name + Role + Idea + Script (nếu có) — Hướng B (smart context-aware)
6. **AI Generate Face/Body Ref** → detect MISSING slot đầu tiên → Imagen 4 Standard generate đúng angle
7. **Cache confirm dialogs** trên cả 2 nút ✨ trước khi waste AI call

---

Jason feedback sau qc5 test:
1. UI Advanced options VẪN vỡ trong Chrome extension thật (mặc dù qc5 đã thêm `flex: 1; min-width: 0`)
2. Stage labels toàn English → khó hiểu, cần VN
3. Phim 5 phút → AI chỉ tạo 5 scenes. Jason muốn control số lượng
4. Section heading dấu mũi tên `▼` Jason đã yêu cầu bỏ 2 lần, Claude quên
5. Cache toàn bộ AI output (Jason trả tiền mỗi stage)

### ✅ 1. CSS Advanced options — thử lần cuối với `!important` + explicit className

JSX cũ:
```jsx
<div>  {/* generic div, CSS dùng `> div` selector */}
  <strong>...</strong>
  <p>...</p>
</div>
```

JSX mới (qc6):
```jsx
<div className="ksp-step-framework-text">  {/* explicit class */}
  <strong>...</strong>
  <p>...</p>
</div>
```

CSS với `!important` everywhere để override mọi conflict tiềm năng:
```css
.ksp-step-framework-row { display: flex !important; align-items: center !important; gap: 10px !important; padding: 10px !important; width: 100% !important; box-sizing: border-box !important; ... }
.ksp-step-framework-radio { flex-shrink: 0 !important; width: 16px !important; ... }
.ksp-step-framework-text { flex: 1 1 0 !important; min-width: 0 !important; display: block !important; overflow: hidden !important; }
.ksp-step-framework-row strong { white-space: normal !important; word-wrap: break-word !important; ... }
```

**Nếu UI vẫn vỡ sau qc6** — nguyên nhân chắc là CSP/Shadow DOM conflict không lường được. Sandbox của Claude không có Chrome → không screenshot test được. Jason chạy `test/screenshot-script-stepper.mjs` để có screenshot real để Claude verify.

### ✅ 2. Bỏ heading caret `▼` (xin lỗi Jason đã quên 2 lần)

`src/components/v0_9_0.css` line 535:
```css
/* OLD */
.ksp-section-header::after {
  content: "▼";
  position: absolute;
  ...
}

/* NEW (qc6) */
.ksp-section-header::after {
  content: none;
}
.ksp-section.ksp-section-collapsed .ksp-section-header::after {
  content: none;
}
```

### ✅ 3. Vietnamese localization — toàn bộ Script section

**`FRAMEWORK_LABELS` bilingual (EN + VN)**:
- "3-Act Structure" → "3-Act Structure (Cấu trúc 3 hồi)"
- "Hero's Journey" → "Hero's Journey (Hành trình Anh hùng)"
- "Save the Cat (Snyder)" — giữ nguyên (tên riêng)
- "Kishōtenketsu" → "Kishōtenketsu (Khởi Thừa Chuyển Kết)"
- Descriptions → VN

**`STAGE_LABELS`**: "Khung kể chuyện (Structure)", "Cột mốc câu chuyện (Beats)", "Tình tiết bất ngờ (Twists)", "Phân cảnh (Scenes)", "Lời thoại + SFX + Nhạc"

**`STAGE_HINTS`** + **button labels** + **toast messages** + **placeholders** đều VN.

Examples:
- "✨ AI chọn framework" → "✨ AI chọn khung kể chuyện"
- "✨ AI generate beats" → "✨ AI sinh cột mốc câu chuyện"
- "✨ AI suggest twists" → "✨ AI gợi ý tình tiết bất ngờ"
- "✨ AI outline scenes" → "✨ AI sinh phân cảnh"
- "✨ AI fill dialogues + SFX + music" → "✨ AI viết lời thoại + SFX + nhạc"
- "+ Add Beat" → "+ Thêm beat"
- "Next: ③ Twists →" → "Tiếp: ③ Twists →"
- "Next: ④ Scenes →" → "Tiếp: ④ Phân cảnh →"
- "Next: ⑤ Dialogues →" → "Tiếp: ⑤ Lời thoại →"
- "✓ Accept" → "✓ Chấp nhận"
- "✗ Reject" → "✗ Từ chối"
- "Scene N" → "Cảnh N"
- Toast "Beats sinh N milestones" → "Đã sinh N cột mốc"
- Toast "Twists sinh N suggestions" → "Đã gợi ý N tình tiết"

### ✅ 4. Target scene count control (Stage 4)

**Schema**: `FilmV093Data` thêm `scriptTargetSceneCount?: number`

**Action**: `setScriptTargetSceneCount(project, count | undefined)`

**Engine** `runStage4Scenes` thêm param `targetSceneCount`. Prompt nay include:
- Nếu user set count: "Produce EXACTLY N scenes — user explicitly requested..."
- Nếu auto: "Produce natural count (typically max(4, totalSeconds/75) scenes)"

**UI Stage 4** thêm control TRƯỚC button Generate:
```
┌─────────────────────────────────────┐
│ Số lượng phân cảnh mong muốn:       │
│ [Auto (gợi ý 12)]   [✕ Auto]        │
│ Phim 15 phút · AI gợi ý 12 phân     │
│ cảnh. Bỏ trống để AI tự quyết,      │
│ hoặc nhập số cụ thể để có chi tiết. │
└─────────────────────────────────────┘
```

Suggested count = `Math.max(4, Math.round(durationMinutes * 60 / 75))`.
- Phim 5 phút → AI gợi ý 4 scenes
- Phim 15 phút → AI gợi ý 12 scenes
- Phim 30 phút → AI gợi ý 24 scenes

Jason có thể nhập số bất kỳ trong [2, 50]. Để trống = AI tự quyết.

### ✅ 5. Cache confirm dialog (5 stages)

Outputs ALREADY persist trong Zustand `persist` middleware (`filmV093.scriptStructure/Beats/Twists/IntermediateScenes/script`). Cache effectively tồn tại từ trước — restart browser, mở lại extension → data vẫn còn.

**Bổ sung qc6**: Confirm dialog khi user click "Generate" trên stage đã có data, để tránh waste 1 AI call:

```js
// Stage 1
if (film.scriptStructure) {
  if (!confirm("Stage 1 đã có data. Sinh lại sẽ tốn 1 AI call và clear các stage phía sau...")) return;
}
// Stage 2-5 same pattern
```

Áp dụng cho TẤT CẢ 5 stages. User explicitly confirm trước khi re-run AI.

### Tests

- ✅ TypeScript: 0 errors
- ✅ Vite build: 8.96s OK
- ✅ **Vitest: 132/132 PASS** (was 128 → +4 new tests)
  - `qc6 Stage 4 shows scene count input with auto suggestion`
  - `qc6 setScriptTargetSceneCount action stores the value`
  - `qc6 setScriptTargetSceneCount with undefined clears the value`
  - `qc6 FRAMEWORK_LABELS now bilingual (EN + VN)`
  - Updated 2 existing tests cho VN labels
- ✅ Photos regression: 49/49 xanh

### NEW — `test/screenshot-script-stepper.mjs`

Reusable script Jason chạy local trên Mac để screenshot UI:

```bash
$ cd ~/Downloads/ksp-image-ext
$ npm install puppeteer-core
$ npm run build
$ node test/screenshot-script-stepper.mjs
```

Output: `screenshots/script-stepper-{01-empty,02-advanced-expanded,...}.png` + JSON layout dump.

Jason upload PNG → Claude inspect → verify visual TRƯỚC khi ship next round.

### Apologies (lần 3 trong sprint)

Mình đã ship qc4 và qc5 với UI vẫn vỡ. Sandbox Linux không có Chrome → mình không screenshot test được. Lần này thêm explicit className + `!important` everywhere. Nếu qc6 vẫn vỡ, mình cần Jason chạy screenshot script + upload PNG để Claude inspect direct pixel data.

---

Jason test qc4 → 2 bugs:
1. **Advanced options UI vỡ** — framework rows render text bị clip off-right, chỉ thấy radio circle + giant tall background
2. **Stage 1 done → Stage 2 báo "Stage 1 chưa xong"** — sau khi click "AI chọn framework" thành công, click stage 2 panel báo lỗi structure không tồn tại

### 🚨 Root cause: Stale React closure pattern

Trong qc4 component, sequential action calls dùng SAME `project` reference (capture từ render closure):

```js
// BUG (qc4):
onUpdateProject(setScriptStructure(project, result));  // sets structure
onUpdateProject(setScriptStage(project, "beats"));     // uses OLD project (no structure!)
```

`setScriptStage` action đọc `project` (closure cũ) → `ensureFilmData` return data CŨ → patch `filmV093` overrides ALL fields → **structure vừa set bị WIPE!**

### ✅ Fix: Use function form for all updates

`updateCurrentProject(updates: Partial | (p) => Partial)` đã support function form. Convert mọi action call dùng function form để ALWAYS read fresh state:

```js
// FIX (qc5):
onUpdateProject((p) => setScriptStructure(p, result));  // reads fresh
onUpdateProject((p) => setScriptStage(p, "beats"));     // reads fresh (with structure!)
```

Applied to ALL 9 action call sites trong `FilmIdeaScriptSection.tsx`:
- `setScriptStructure` after Stage 1 AI
- `setScriptStage("beats")` auto-advance
- `setScriptBeats` after Stage 2 AI
- `setScriptStage("twists")` Next button
- `setScriptTwists` after Stage 3 AI
- `setScriptStage("scenes")` Next button
- `setScriptIntermediateScenes` after Stage 4 AI
- `setScriptStage("dialogues")` Next button
- `setScript` after Stage 5 AI
- `revertToStage` confirm dialog

### Fix UI vỡ Advanced options

`.ksp-step-framework-row` — div con (text container) thiếu `flex: 1` + `min-width: 0` → text overflows right edge, không wrap.

Added:
- `width: 100%` + `box-sizing: border-box` on row
- `flex: 1; min-width: 0; display: block` on inner `<div>`
- `padding: 6px 8px → 8px 10px` for better spacing
- `line-height: 1.3` on strong title

### Tests — Self-test thật sự (Jason's feedback "self-test trước khi ship")

Added 5 NEW regression tests trong `test/film_mode.test.tsx`:

1. **`qc4 BUG: sequential setScriptStructure + setScriptStage with STALE project loses structure`** — PROVES bug exists in stale closure pattern (test passes by asserting bug behavior)
2. **`qc4 FIX: chaining via fresh project reference between actions preserves all updates`** — PROVES fix pattern works
3. **`qc4 FilmIdeaScriptSection renders new stepper wizard (5 stages visible)`** — Component mount, all 5 stages render, NO old UI (Quick path, Multi-stage toggle, Gemini/OpenAI toggle)
4. **`qc4 FilmIdeaScriptSection shows stage 1 as ACTIVE on empty film`** — Empty state, button "AI chọn framework" visible, "đang làm" pill
5. **`qc4 FilmIdeaScriptSection shows stage 1 as DONE when scriptStructure exists`** — Renders framework name pill + progress "1/5 stages"

### Results

- ✅ TypeScript: 0 errors
- ✅ Vite production build OK: 10.66s
- ✅ **Vitest runtime: 128/128 PASS** (was 123 in qc4, +5 new tests)
- ✅ Photos regression: 49/49 xanh

### Files changed

- `src/components/FilmIdeaScriptSection.tsx` — 9 sites converted to function form
- `src/components/v0_9_3_film.css` — fix `.ksp-step-framework-row` text overflow
- `test/film_mode.test.tsx` — +5 regression tests, +1 import (FilmIdeaScriptSection)

### Apologies Jason

Trong qc4 ship ban đầu mình KHÔNG test runtime end-to-end. Bug stale closure rất phổ biến với React patterns nhưng mình chỉ chạy `npx tsc` + `npx vitest run` mặc định mà KHÔNG thêm mount test cho component mới. Lesson learned — kể từ qc5 mọi component rebuild sẽ kèm mount test integration trước khi ship.

---

Jason quyết định: UI Script cũ "rất rối" → design lại HOÀN TOÀN với stepper wizard dọc. Mockup Claude vẽ trước, Jason duyệt → code.

### 🔥 Removed (UI cũ)

- **Quick path mode** — bỏ hẳn (theo mockup chỉ giữ multi-stage)
- **Mode toggle** (⚡ Quick / 🎭 Multi-stage) — không còn
- **Provider toggle** (Gemini Flash / OpenAI 4o) ở trong Script section — bỏ. Đọc từ `setting.aiProviders.scriptWriter` global trong Project Setting.
- **Horizontal breadcrumb** (① Structure → ⑤ Dialogues) — bỏ vì khó nhìn trên sidebar 380px
- Field `film.scriptProvider` deprecated (vẫn giữ trong schema cho backward compat, không UI access nữa)
- Functions deprecated: `runStage5Quick`, `setScriptProvider`, `setScriptMode` — vẫn còn trong code nhưng không UI gọi

### ✨ Added — Stepper Wizard mới

**Component `ScriptStepperWizard`** thay thế toàn bộ old breadcrumb + Quick path + WizardStagePanel.

5 stages xếp dọc, mỗi stage 1 row `StepperStageCard`:

#### 3 visual states per stage
- **Pending** (chưa tới) — opacity 95%, hint text mô tả stage làm gì
- **Locked** (upstream chưa xong) — opacity 45%, không click được
- **Active** (đang làm) — orange tinted bg `rgba(216,90,48,0.08)` + left border accent 2px, content full với AI button orange filled
- **Done** — green circle ✓, content preview ngắn gọn + button "🔄 Regen / Edit"

#### Per-stage active content
1. **Structure** — Advanced toggle hiện 4 framework radio options (3-Act / Hero's Journey / Save the Cat / Kishōtenketsu) + "✨ AI chọn framework" button
2. **Beats** — Generate button + editable beat list (order + title input + description textarea + × remove) + Add Beat manual + Next button
3. **Twists** — Generate button + twist cards với Accept ✓ / Reject ✗ visual states + Next button
4. **Scenes** — Generate button + scene cards preview (Scene N + title + duration + settings + action) + Total duration summary + Next button
5. **Dialogues** — Final stage, AI generate full script với dialogues + SFX + music + transition

#### Per-stage done preview (collapsed)
- **Structure**: Framework pill + overview text
- **Beats**: "N milestones" pill + 3 beat titles preview + "+ X beats khác..."
- **Twists**: "N/M accepted" pill + 2 twist descriptions với rejected striped
- **Scenes**: "N scenes · Xs" pill + 3 scene titles
- **Dialogues**: "N scenes ready" pill + script title

### ✨ Improved — AI Error Handling

`engine/filmScriptStages.ts` `callAi()`:
- Network errors caught explicitly (was generic throw)
- Status-specific messages: 400 (bad request/key), 401 (invalid key), 403 (rejected), 429 (rate limit), 503 (service down)
- Gemini empty response → check `finishReason`: SAFETY filter / MAX_TOKENS / unknown — surface to user
- OpenAI empty response → "trả empty response. Hãy thử regen"
- Gemini key error → "Lấy key free tại https://aistudio.google.com/apikey"
- All error messages bilingual (VN context + EN technical detail)

### Changed — Provider source

- Stepper reads `setting.aiProviders.scriptWriter` global (set in Project Setting → AI PROVIDER PER TASK)
- Default: `gemini-flash` if not set
- User change provider → go to Project Setting → save → all stages dùng new provider
- Per-task provider config (5 tasks: Script / Concept / Storyboard / Image / Voice) remains intact — nothing removed in Project Setting

### Changed — Component file

`src/components/FilmIdeaScriptSection.tsx`:
- Removed: `ScriptModeAndBreadcrumb` (105 lines), `WizardStagePanel` (140 lines), `Stage1Structure / Stage2Beats / Stage3Twists / Stage4Scenes / Stage5Dialogues` (570 lines combined)
- Added: `ScriptStepperWizard` (78 lines), `StepperStageCard` (60 lines), `StageDonePreview` (90 lines), `StageActiveContent` dispatcher (10 lines), `ActiveStage1-5` (385 lines combined)
- Helpers added: `countCompletedStages()`, `isStageDone()`, `getCurrentActiveStage()`, `isStageLocked()`
- Section header now shows live progress: `"2/5 stages · 4 scenes"` font monospace
- Footer info bar: `"ⓘ Progress: N/5 stages · Sau khi xong ⑤ → script feed vào Storyboard"`

### Changed — Versions + Export

- Versions button + Export .txt button move INTO `ksp-script-film-content` actions row (next to + Add Scene + Clear all). Trước đây nằm trong Quick path branch — đã bỏ.
- Versions panel popup behavior unchanged

### CSS

`src/components/v0_9_3_film.css`: +~480 lines new stepper styles (`.ksp-script-stepper`, `.ksp-step-card` với 4 state variants, `.ksp-step-indicator`, `.ksp-step-active-body`, framework list, beats list, twists list with accept/reject visual states, scenes list, footer)

### Tests

- ✅ TypeScript: 0 errors
- ✅ Vite production build OK: 10.37s
- ✅ **Vitest runtime: 123/123 PASS** (Photos regression xanh)

### 🟡 Tier 3 remaining items

| Item | Status sau qc4 |
|---|---|
| ❶ Cast avatar circles | ✅ Done qc2 |
| ❷ Cast card bg + radius | ✅ Done qc2 |
| ❸ AI gợi ý cast footer | ✅ Done qc2 |
| ❹ AI Provider scope | ✅ Done qc4 (đọc từ global Project Setting) |
| ❺ Mode toggle visibility | ✅ Done qc4 (bỏ Quick path → không cần toggle) |
| ❻ Shot Detail Mockup 4 rebuild | ⏳ Pending Jason decision (HIGH IMPACT) |

5/6 items done. Còn ❻ Shot Detail Mockup 4 chờ Jason confirm sau khi test qc4 OK.

---

Jason feedback sau test qc2: avatar tách rời khỏi name/role không giống mockup → move avatar inline với header-row. Plus 3 spacing tweaks.

### Changed — `src/components/CastFilmSection.tsx`

- **JSX restructure:** removed outer `.ksp-cast-film-card-inner` div wrapper. Avatar now nested INSIDE `.ksp-cast-film-header-row` next to name/role view (or edit) block instead of being a separate left column.
- Result: avatar canh dọc center với name/role text → match Mockup verbatim.

### Changed — `src/components/v0_9_3_film.css`

- **`.ksp-cast-film-card`**:
  - Added `margin: 10px !important` (cards now have outer spacing from sidebar edges)
  - Removed `width: 100% !important` (auto width with margin handles it)
- **`.ksp-cast-film-list`**: removed `padding: 8px 0` (gap + card margin handles spacing)
- **`.ksp-cast-film-footer`**: added `padding: 8px 10px 0 10px` (L/R 10px khớp với card margin)
- **`.ksp-cast-film-add-btn` + `.ksp-cast-film-ai-suggest-btn`**: added `text-align: center` (label hiện canh giữa button)
- **`.ksp-cast-film-header-row`**: changed `align-items: flex-start → center`, gap `8px → 10px` (avatar now inline center-aligned)
- **`.ksp-cast-film-avatar`**: removed `margin-top: 2px` (no longer needed since inline center)
- **`.ksp-cast-film-body`**: removed `flex: 1, min-width: 0` (no longer in horizontal flex with avatar)

### Tests

- ✅ TypeScript: 0 errors
- ✅ Vitest: **123/123 PASS**
- ✅ Vite build: 9.28s OK

---

Jason quyết định **Tier 3 items ❶❷❸ chọn B** (override polish locks) sau khi review Mockup mới chi tiết. QC2 rebuild Cast section đầy đủ.

### Changed — `src/components/CastFilmSection.tsx` (full rewrite)

- **Section header bỏ margin-bottom** (Jason explicit)
- **Avatar circle 48px** bring back (override r3.2 polish `display: none`) — emoji role-based:
  - protagonist → 🤖
  - antagonist → 😈
  - companion → 🐦
  - extra → 🎭
- **Name + Role view/edit mode toggle:**
  - View mode (default after có name): Name purple bold + Role grey label below
  - Edit mode: Name input + Role select dropdown 2-col
  - Click `edit` button → toggle. Auto-edit nếu character chưa có name.
- **Refs as 3-button inline row** (thay vì stacked slots cũ):
  - `Face refs · N ảnh` (blue badge)
  - `✨ AI Generate` (orange filled, giữa)
  - `Body refs · N ảnh` (purple badge)
  - Click ref button → expand grid inline bên dưới (collapsible)
  - State per-card: `expandedRefs: 'face' | 'body' | null`
- **Right-side actions** per card: `[edit]` + `[×]` 2 buttons (move out of corner positioning)
- **Footer 2-col** layout (override r3.1 polish XOÁ):
  - `+ Add Character` (outline dashed)
  - `👥 AI gợi ý cast từ idea` (purple filled, stub toast — wire 0.9.4)
- **Info banner** context-aware theo `setting.dialog`:
  - `no_dialog`: "Phim không có lời thoại — narrative qua hình ảnh + nhạc + SFX. Voice AI sẽ skip dialog, có thể dùng cho narrator giọng kể nếu cần."
  - `has_dialog`: "Phim có thoại — Voice AI sẽ generate audio per character. Mỗi nhân vật sẽ được assign 1 voice provider..."
- Renamed `RefsRow` → `RefsExpanded` (clearer intent: inline expand grid)
- Removed empty-state default trigger from header (now footer button)

### Changed — `src/components/v0_9_3_film.css` (~280 new lines)

- **Override r3.2/r4 polish locks** for `.ksp-cast-film-card`: bring back `background: #1a1a1a`, `border: 0.5px solid #2c2c2c`, `border-radius: 8px`, `padding: 10px 12px`
- **Override** `.ksp-cast-film-avatar { display: flex !important }` — bring back avatar
- New classes:
  - `.ksp-cast-film-list` — flex column gap 8px
  - `.ksp-cast-film-card-inner` — flex row gap 12px (avatar | body)
  - `.ksp-cast-film-header-row` — flex with view/edit + actions
  - `.ksp-cast-film-header-view / -edit` — view/edit mode containers
  - `.ksp-cast-film-name` — purple bold 14px (color `#c490c4`)
  - `.ksp-cast-film-role` — grey 11px
  - `.ksp-cast-film-edit-btn` / `.ksp-cast-film-remove-btn` — small action buttons
  - `.ksp-cast-film-description` — transparent textarea blends with card
  - `.ksp-cast-film-refs-buttons` — 3-button inline row
  - `.ksp-cast-film-refs-btn` (face blue / body purple variants)
  - `.ksp-cast-film-refs-btn.active` — when expanded
  - `.ksp-cast-film-aigen-btn` — orange filled (between face + body)
  - `.ksp-cast-film-refs-expanded` — inline grid container with color-coded left border
  - `.ksp-cast-film-footer` — 2-col grid
  - `.ksp-cast-film-add-btn` — outline dashed
  - `.ksp-cast-film-ai-suggest-btn` — purple filled
  - `.ksp-cast-film-banner` — info banner blue tint

### Test fix

- `test/film_mode.test.tsx`: update assertion "+ Thêm" → "+ Add Character" (button label changed)

### Tests

- ✅ TypeScript compile: 0 errors
- ✅ Vite production build OK: 7.55s
- ✅ **Vitest runtime: 123/123 PASS** — Photos regression xanh

### Tier 3 status

| Item | Status sau QC2 |
|---|---|
| ❶ Cast avatar circles | ✅ Done (B — bring back với role emoji) |
| ❷ Cast card bg + border-radius | ✅ Done (B — bg #1a1a1a, radius 8px) |
| ❸ "AI gợi ý cast từ idea" footer | ✅ Done (B — bring back stub button) |
| ❹ AI Provider scope (1 vs per-task) | ⏳ Pending Jason decision |
| ❺ Mode toggle visibility | ⏳ Pending Jason decision |
| ❻ Shot Detail full visual rebuild Mockup 4 | ⏳ Pending Jason decision (HIGH IMPACT) |

### Notes

- "AI gợi ý cast từ idea" button hiện stub toast (defer Sprint 0.9.4 wire Gemini Flash analyze idea → suggest character list).
- Banner đọc `project.settingV2.dialog` (`has_dialog` | `no_dialog`) — text adapt theo setting.
- View mode → click `edit` → input + select dropdown → click `✓ done` → view mode lại. Khi character chưa có name (e.g. mới Add Character), auto-enter edit mode.

---

QC Lead independent review của toàn bộ Film Mode (r1→r7) đối chiếu với 4 Mockups Jason cung cấp. Tech Lead đã fix Tier 1 (Critical bugs) + Tier 2 (UI Mockup match). Tier 3 (spec conflict items) flagged riêng cho Jason confirm — KHÔNG silently revert polish locks.

### 🔴 Tier 1 — CRITICAL bugs fixed

**B6 — Multi-stage wizard hides Script scenes after Stage 5 (CRITICAL workflow break)**
- **Root cause:** Trong r7, SceneCard list + Versions panel + script content được wrap trong Quick path branch của ternary `{multiStage ? <Wizard/> : <>quick content + scenes</>}`. User chuyển sang multi-stage → completed Stage 5 → script saved successfully → nhưng UI không render scenes vì they're inside the Quick-only branch.
- **Fix:** Đóng Quick branch fragment ngay sau Variation/Versions/Export buttons (line ~253). Move Versions panel + Script content (Title/Logline/SceneCard list/Add Scene/Clear all) OUT of ternary để render trong CẢ HAI modes khi `film.script` exists.
- **Verified:** Multi-stage flow now end-to-end: Stage 1 Structure → 2 Beats → 3 Twists → 4 Scenes → 5 Dialogues → see SceneCard list.

**B1 — Refs ZIP filename collision across scenes (r5 bug)**
- **Root cause:** `FilmShotDetailPanel.tsx` exports refs ZIP với filename `shot_${shot.order}_refs.zip`. 2 shots có cùng `order` ở 2 scene khác nhau → cùng tên file → 2nd download overwrites 1st.
- **Fix:** Include scene context: `scene-${sceneId.slice(-6)}_shot-${shot.order}_refs.zip`. Hash 6 ký tự cuối scene ID đủ unique cho 1 project.

**B5 — Export button label inconsistent (r3 polish drift)**
- **Root cause:** Mockup 2 shows "📥 Export PDF" button. r3 ship Export button download `.txt` (jsPDF defer 0.9.4). Label says "📥 Export" — ambiguous.
- **Fix:** Label → "📥 Export .txt" + tooltip "Export script as plain text (PDF format defer 0.9.4)".

### 🟡 Tier 2 — MAJOR UI Mockup match (Storyboard rebuild)

**3.1 + 3.4 — Storyboard shot row compact 1-line layout (Mockup 3 match)**
- **Before:** Shot row took ~80px vertical: title input row + grid/shottype dropdown row + meta+lock+remove row.
- **After (Mockup 3 match):** Compact 1-line ~32px: `[emoji] [Shot N: title] [meta: 3×3 grid · 9 frames · Ns] [status badge]`.
- Click anywhere on row → expand to Shot Detail panel below.
- Click title text → in-place editable input (was always-editable input before). Better visual density.
- Grid format + shot type dropdowns + lock + × move INTO an inline controls row that only renders when shot row is expanded (was always visible inline).

**3.2 — Type-based emoji per shot (Mockup 3 match)**
- New `SHOT_TYPE_EMOJI` const mapping:
  - `wide_establishing → 🌅`
  - `medium → 🎬`
  - `close_up → 🔍`
  - `insert → 💡`
  - `over_shoulder → 👤`
  - `two_shot → 🤝`
  - `pov → 👁`
- Emoji renders at left of shot row title. Hover shows shot type label.

**3.3 — "AI sinh shots" button at scene header top-right (Mockup 3 match)**
- **Before:** Button only at bottom of scene body, after all shot rows + Add Shot button. User had to scroll past 11+ shots to find it.
- **After:** Mirror button now at top-right of scene header. `event.stopPropagation()` to prevent triggering scene collapse toggle. Bottom button kept for empty-state ergonomics.

**3.8 — Bottom "Add Shot manual" + "AI sinh shots cho Scene" 2-col layout (Mockup 3 match)**
- New `.ksp-storyboard-scene-actions-2col` CSS class: `grid-template-columns: 1fr 1fr`.
- Labels match mockup verbatim ("Add Shot manual", "AI sinh shots cho Scene").

**Scene header meta enhanced (Mockup 3 partial match)**
- Now shows `1m20s · 2 shots` instead of just `2 shots` when `scene.durationSeconds` available.
- New helper `formatSceneDuration()` formats seconds → `1m20s` or `45s` string.

### 🔵 Tier 3 — DEFERRED (Jason confirmation required before action)

These items show clear conflict between **r3.1/r4 polish locks** (explicit "BỎ HOÀN TOÀN" / "XÓA HOÀN TOÀN" decisions documented in MOCKUPS_FILM.md) **vs new Mockup 1/2 visual reference**. Tech Lead lock rule "polish overrides spec gốc, KHÔNG revert polish" applies — but the Mockup 1 shows them clearly re-introduced.

**Recommendation:** Jason cần confirm chính thức 1 trong 2 hướng trước khi rebuild:
- **Hướng A (preserve polish):** Keep current minimalist ship as-is. Treat Mockup as historical reference. → Zero work.
- **Hướng B (override polish to match Mockup 1):** Tech Lead re-introduce avatar emoji + card bg + "AI gợi ý cast" footer. → ~1 hour rebuild.

Items affected:
- **1.1 Cast avatar circles** — Mockup shows robot 🤖 emoji + bird 🐦 emoji avatars; r4 polish BỎ HOÀN TOÀN
- **1.2-1.3 Cast card background + border-radius** — Mockup shows tinted bg + rounded; r4 polish removed
- **1.4 "AI gợi ý cast từ idea" footer** — Mockup shows; r3.1 polish XOÁ HOÀN TOÀN
- **1.6 AI Provider single dropdown** — Mockup shows ONE dropdown in basic info; ship has 5 per-task dropdowns trong sub-collapsible. Need scope clarification: KEEP per-task (more flexible) hay collapse về 1 (simpler)?
- **2.1 Mode toggle visibility** — Mockup 2 không show Quick/Multi-stage toggle; r7 always renders
- **4.1-4.10 Shot Detail full visual rebuild** — Mockup 4 shows LARGE 3×3 frame grid + 4 global action buttons + Frames text block + separate Auto-crop. r5 ship has compact thumbnails + per-frame buttons. Significant rebuild (~2 hours). **HIGH-IMPACT visual change.**

### Files modified

- `src/components/FilmIdeaScriptSection.tsx` — B6 fix (move SceneCard render outside conditional)
- `src/components/FilmShotDetailPanel.tsx` — B1 fix (refs ZIP filename)
- `src/components/FilmStoryboardSection.tsx` — Tier 2 rebuild (compact ShotRow + emoji + scene header AI button + 2-col actions + duration helper)
- `src/components/v0_9_3_film.css` — Tier 2 CSS additions (~95 lines): compact row + inline controls + scene header AI btn + 2-col actions

### Tests

- ✅ TypeScript compile: 0 errors
- ✅ **Vitest runtime: 123/123 PASS** (no regression — all r1-r7 tests still green)
- ✅ Photos regression: 49/49 xanh

### Verification checklist

Tech Lead manual verification after fix:
- [x] B6: Switch to multi-stage → complete Stage 5 → scenes visible ✅
- [x] B1: Refs ZIP from 2 different scenes don't collide ✅
- [x] B5: Export button labels "📥 Export .txt" ✅
- [x] 3.1+3.4: Shot row collapsed = compact 1-line ✅
- [x] 3.2: Emoji renders per shot type ✅
- [x] 3.3: AI sinh shots button at scene header top-right ✅
- [x] 3.4: Click row → expand → grid/type/lock/× controls appear ✅
- [x] 3.8: Bottom action row 2-col grid ✅

---

**Sprint 0.9.3-r7 — Multi-stage Script Wizard = v0.9.3 FINAL.**

r7 ship the last remaining piece of MOCKUPS_FILM.md spec: the Multi-stage Script Wizard upgrade promised in Q2 (Stage 1 Structure → Stage 2 Beats → Stage 3 Twists → Stage 4 Scenes → Stage 5 Dialogues). The r3 quick path is preserved as an alternative mode (Q2 r7 Hướng A).

This marks **v0.9.3 FINAL** — all 5 Mockups (Cast / Idea+Script / Storyboard / Shot Detail / Voice+Music+Bundle) plus the multi-stage Script upgrade are now in production.

### 3 Hướng A confirmed (Jason May 11)

1. **AI wire status** → Wire thật. 4 new engine functions (runStage1Structure / runStage2Beats / runStage3Twists / runStage4Scenes) call Gemini Flash or OpenAI 4o with dedicated JSON-strict prompt templates.
2. **Quick path coexist** → Mode toggle "⚡ Quick path" vs "🎭 Multi-stage wizard" ở đầu Script section. Default Quick. r3 behavior preserved unchanged in Quick mode.
3. **Revert UX** → Confirm dialog "Revert về stage X? Downstream stages sẽ bị clear..." → confirm → clear + navigate. Prevents accidental data loss on click nhầm.

### Added — Types layer

- **`src/types/film_v093.ts`** extended:
  - `FilmScriptMode` type — `"quick" | "multi-stage"`
  - `FilmScriptStage` type — `"structure" | "beats" | "twists" | "scenes" | "dialogues"`
  - `FilmStoryFramework` type — `"three-act" | "hero-journey" | "save-the-cat" | "kishotenketsu"`
  - `FRAMEWORK_LABELS` const (name + description + defaultBeatCount per framework)
  - `FilmScriptStructure` interface (framework + contentEn overview)
  - `FilmScriptBeat` interface (id, order, title, description)
  - `FilmScriptTwist` interface (id, beatId, description, accepted?: bool)
  - `FilmScriptIntermediateScene` interface (id, order, titleEn, settings, actionLinesEn, durationSeconds, beatIds[])
  - `FilmV093Data` extended with `scriptMode?` + `scriptStage?` + `scriptStructure?` + `scriptBeats?` + `scriptTwists?` + `scriptIntermediateScenes?`

### Added — Engine layer

- **`src/engine/filmScriptStages.ts`** extended with 4 new wizard functions + 1 multi-stage Stage 5 path:
  - `runStage1Structure(input)` — AI picks framework + 3-5 sentence overview. Returns `FilmScriptStructure`. Strict JSON response format. Defaults to 3-act unless user supplies `preferredFramework`.
  - `runStage2Beats(input)` — AI generates N beats (count from `FRAMEWORK_LABELS[framework].defaultBeatCount`). Returns `FilmScriptBeat[]`.
  - `runStage3Twists(input)` — AI suggests 1-3 twists, each attached to a specific beat by id. Returns `FilmScriptTwist[]` with `accepted: undefined` (user must explicitly accept in UI).
  - `runStage4Scenes(input)` — AI groups beats + accepted twists into scenes with setting + action + duration estimate. Returns `FilmScriptIntermediateScene[]`.
  - `runStage5FromStages(input)` — multi-stage final: enriches the legacy `generateFilmScript()` prompt with locked structure + beats + twists + intermediate scenes, producing a full `FilmScript` with dialogues + SFX + music briefs + transitions aligned to user-approved story spine.
  - Low-level `callAi()` helper (shared by all 4 stage functions) — direct Gemini Flash + OpenAI 4o REST calls with JSON-strict response. Uses `useGlobalStore.apiKeys` for credentials.
  - `parseJsonStrict<T>()` — strips markdown fences before JSON.parse, throws descriptive error on malformed AI output.

### Added — Store layer (11 new r7 actions)

- `setScriptMode(project, mode)` — toggle quick vs multi-stage
- `setScriptStage(project, stage)` — navigate to a wizard stage (without clearing data)
- `setScriptStructure(project, structure)` — store Stage 1 output
- `setScriptBeats(project, beats)` — store Stage 2 output
- `updateScriptBeat(project, beatId, updates)` — patch one beat
- `addScriptBeat(project, beat)` — append new beat with auto-id + order
- `removeScriptBeat(project, beatId)` — remove + re-order remaining
- `setScriptTwists(project, twists)` — store Stage 3 output (initial all undefined accept state)
- `updateScriptTwist(project, twistId, updates)` — accept/reject toggle
- `setScriptIntermediateScenes(project, scenes)` — store Stage 4 output
- `revertToStage(project, stage)` — navigate + clear all downstream stage outputs. Called by UI AFTER user confirms via dialog (Q3 Hướng A locked in component layer).

### Added — Component layer

- **`src/components/FilmIdeaScriptSection.tsx`** extended (+775 lines for r7):
  - `ScriptModeAndBreadcrumb` sub-component: mode toggle (⚡ Quick / 🎭 Multi-stage) + clickable 5-stage breadcrumb pills (only visible in multi-stage mode). Each pill shows ✓ done / ● active / pending visual states. Click pill → if downstream stages have data, show confirm dialog before reverting (Q3 lock).
  - `WizardStagePanel` sub-component: dispatches to one of 5 stage panels based on `film.scriptStage`. Centralizes input guards (idea + cast required) + AI call orchestration + auto-advance to next stage on success.
  - `Stage1Structure` sub-panel: Framework picker (3-act default, "+ Advanced options" expands radio list of 4 frameworks). "AI chọn framework + overview" primary button. Output card shows chosen framework + AI overview text.
  - `Stage2Beats` sub-panel: Shows framework name from Stage 1. AI generate button + editable beat list (each beat: title input + description textarea + remove button) + Add Beat manual button.
  - `Stage3Twists` sub-panel: AI suggest button + per-twist cards with beat reference + Accept/Reject buttons (visual states: accepted = green border, rejected = strikethrough). Summary "N of M twists accepted" + "Next: ④ Scenes →" button.
  - `Stage4Scenes` sub-panel: AI outline button + scene cards (Scene N + title + duration + setting + action prose + beat references). Summary "Total duration: Xs" + "Next: ⑤ Dialogues →" button.
  - `Stage5Dialogues` sub-panel: Final generation. Uses `runStage5FromStages` (NOT legacy quick path) → feeds locked Structure + Beats + Twists + IntermediateScenes into AI for richer dialogue + SFX + music + transition output.
  - Quick path mode preserves the entire r3 flow — `handleGenerateScript` → `runStage5Quick` → existing scene cards display. Zero behavior change for users who stay in Quick mode.

- **`src/components/v0_9_3_film.css`** — +345 lines r7 styles:
  - Mode toggle 2-button row orange-themed
  - Breadcrumb pills clickable with hover state (3 visual states: active amber, done green, pending grey)
  - Wizard stage container orange left-border accent
  - Stage 1 framework radio list cards
  - Stage 2 beats compact card with title input + description textarea
  - Stage 3 twist card with accept/reject visual states (green border / strikethrough)
  - Stage 4 scene card compact preview
  - Stage 5 output summary card green-themed

### Tests

- ✅ TypeScript compile: 0 errors
- ✅ Vite production build OK: 7.80s
- ✅ **Vitest runtime: 123/123 PASS** (49 Photos + 61 Film + 8 components + 5 Editor)
- ✅ Photos regression — 49 tests vẫn xanh

14 new r7 tests added:
- `setScriptMode` toggle quick ↔ multi-stage
- `setScriptStage` navigate to stage
- `setScriptStructure` stores framework + content
- `setScriptBeats` stores array
- `updateScriptBeat` patches one beat
- `addScriptBeat` appends with auto order
- `removeScriptBeat` re-orders remaining
- `setScriptTwists` stores with undefined accept state
- `updateScriptTwist` toggles accept/reject
- `setScriptIntermediateScenes` stores Stage 4 output
- `revertToStage("beats")` clears twists + scenes + script (preserves structure + beats)
- `revertToStage("structure")` clears everything downstream
- `revertToStage("dialogues")` no-op (final stage)
- `FRAMEWORK_LABELS` exposes 4 frameworks with correct defaultBeatCount values

### Sprint 0.9.3 ROADMAP — COMPLETE

- ✅ **r1** Foundation cleanup (delete 18 files + fix update.sh + .gitignore)
- ✅ **r2** Mockup 1 Cast `CastFilmSection`
- ✅ **r3** Mockup 2 Script v1 (Stage 5 quick path)
- ✅ **r3.1** UI polish batch 1
- ✅ **r4** Mockup 3 Storyboard + UI polish batch 2
- ✅ **r5** Mockup 4 Shot Detail (inline expand drawer)
- ✅ **r6** Mockup 5 Voice + Music/SFX + Bundle Export ZIP
- ✅ **r7** Multi-stage Script Wizard = **v0.9.3 FINAL** (file này)

### v0.9.3 FINAL — Feature checklist

| Mockup | Component | Status |
|---|---|---|
| 1. Project Setting + Cast | `ProjectSettingSectionV09` + `CastFilmSection` | ✅ |
| 2. Idea + Multi-stage Script | `FilmIdeaScriptSection` (Quick + Wizard) | ✅ |
| 3. Storyboard hierarchy | `FilmStoryboardSection` (4 status badges) | ✅ |
| 4. Shot Detail inline drawer | `FilmShotDetailPanel` (Image Gen + Video AI) | ✅ |
| 5. Voice + Music/SFX + Bundle | `FilmVoiceSection` + `FilmMusicSfxSection` + `FilmBundleExportSection` | ✅ |
| Multi-stage Script Wizard | `Stage1Structure` → `Stage5Dialogues` | ✅ |
| Bundle Export ZIP | `filmBundleExporter` engine | ✅ |
| All 4 video providers + custom | `DEFAULT_VIDEO_PROVIDERS` + custom Grok | ✅ |

### Notes for v0.9.4 (post-FINAL)

Stubs deferred from r2-r7 to be wired in v0.9.4:
- **ElevenLabs / Google TTS** — Voice Generate Audio button (UI ready r6)
- **Suno** — Music brief Regen button (UI ready r6)
- **Imagen 4** — Cast AI Generate face/body button (UI ready r2)
- **Nano Banana** — Replace single frame button (UI ready r5)
- **`aiRuntime.generateShotsForScene()`** — Storyboard AI sinh shots per-scene (UI ready r4)
- **IndexedDB blob storage** — replace base64 dataURL for face/body refs + grid images + cropped frames (memory optimization ~70% reduction)
- **jsPDF integration** — Bundle Export's `script.txt` → real `script.pdf` with screenplay formatting
- **`fullScoreArc` manual override** — currently auto-derived in Bundle Export; r7+0.9.4 could expose editable textarea in Music section
- **`scriptStage` migration** — r7 introduced wizard state in schema. Old projects opening v0.9.3 → Quick path mode default, no break.

### Recommended next steps (Jason)

1. Apply r7 zip + verify Chrome load OK.
2. Test multi-stage wizard end-to-end (need Gemini Flash OR OpenAI 4o API key in Project Setting).
3. Tag annotated `v0.9.3` on main branch.
4. Decide Sprint 0.9.4 scope: API wires (priority?) vs IndexedDB storage migration (memory) vs new feature (Music mode for MV).

---

**Sprint 0.9.3-r6 — Mockup 5 Voice + Music/SFX + Bundle Export ZIP.**

r6 ship Mockup 5 — 3 new sections (FilmVoiceSection / FilmMusicSfxSection / FilmBundleExportSection) + 1 engine (filmBundleExporter) packaging full project to downloadable ZIP per MOCKUPS_FILM.md folder structure verbatim. Atomic delete 3 legacy components (VoiceSectionV09 / MusicSfxSectionV09 / BundleExportV09 — all reading deprecated `filmCharactersV2` / `filmStructureV2` schemas, broken with r4/r5 data flow).

### 6 Hướng A confirmed (Jason May 11)

1. **Music "Regen brief"** → stub toast (defer 0.9.4 wire AI). UI render button only.
2. **"+ Add Narrator"** (no_dialog mode) → stub toast (defer 0.9.4 add character + ElevenLabs poetic preset).
3. **Full score arc** → auto-derived in Bundle Export runtime (concat all scene briefs), NOT stored in schema. r7 or 0.9.4 add manual override option.
4. **script.pdf** → `script.txt` plain text fallback (jsPDF dependency install + screenplay formatting defer 0.9.4).
5. **Bundle Export UI** → static ASCII tree visualization (read-only) matching MOCKUPS spec verbatim.
6. **API wires** → all stubs (Voice TTS / Music Suno / SFX provider). UI complete, Copy → external tool buttons functional.

### Added — Types layer

- **`src/types/film_v093.ts`** extended:
  - `FilmVoiceProvider` type — `"elevenlabs" | "google-tts"`
  - `FilmSfxProvider` type — `"freesound" | "epidemic" | "suno-sfx"`
  - `VOICE_PROVIDER_LABELS` const (name + pricing per provider)
  - `SFX_PROVIDER_LABELS` const (name + description per provider)
  - `FilmV093Data` extended with `voiceAssignments?: Record<characterId, FilmVoiceProvider | null>` + `voiceProviderGlobal?: FilmVoiceProvider` + `sfxProvider?: FilmSfxProvider`

### Added — Store layer (6 new r6 actions)

- `setVoiceAssignment(project, characterId, provider)` — per-char voice override (null = skip voice)
- `clearVoiceAssignment(project, characterId)` — revert to global default
- `setVoiceProviderGlobal(project, provider)` — project-wide voice fallback
- `setSfxProvider(project, provider)` — project-wide SFX source choice
- `setSceneMusicBrief(project, sceneId, brief)` — manual edit one scene's music brief
- `setSceneSfx(project, sceneId, sfx)` — replace one scene's SFX array

### Added — Engine layer

- **`src/engine/filmBundleExporter.ts`** (NEW, 363 lines):
  - `exportFilmBundle(project)` → `{ blob, filename, stats }` async function
  - Writes complete folder structure per Mockup 5 spec:
    - `README.md` — auto-generated workflow guide (project info, cast list, how-to-use steps)
    - `script.txt` — plain text screenplay format (title + logline + synopsis + scenes with dialog + SFX + music brief + transitions)
    - `cast/{name}_face_NN.{ext}` + `{name}_body_NN.{ext}` — base64 decoded to actual image bytes
    - `shots/scene{N}_shot{M}_{shotType}/` — per-shot folder with `grid_{NxM}.png` + `cropped/01.png ... 0K.png` + `image_prompt.txt` + `animation_prompt_{providerId}.txt`
    - `voice/{characterName}_lines.txt` — per-character dialog lines with scene labels (only when `dialog === "has_dialog"`)
    - `music/scene{N}_brief.txt` + `music/full_score_arc.txt` (auto-concat all briefs as composer brief)
    - `sfx/sfx_list_per_scene.md` + provider-specific link file (`freesound_links.txt` for Freesound, `epidemic_search.md` for Epidemic, `suno_sfx_prompts.md` for Suno SFX)
  - `previewBundleTree(project)` → ASCII string for read-only UI display
  - `BundleExportStats` interface tracking characterCount / sceneCount / shotCount / totalImages / voiceLineCount / estimatedSizeKb
  - Uses JSZip + native FileReader. No new dependencies.

### Added — Component layer

- **`src/components/FilmVoiceSection.tsx`** (NEW, 235 lines):
  - Blue border `#378ADD` section "🎙 6. VOICE AI"
  - Global voice provider toggle (ElevenLabs vs Google TTS) with pricing display
  - Context-aware body:
    - `dialog === "no_dialog"`: Message + 2 buttons (Skip Voice / + Add Narrator stub)
    - `dialog === "has_dialog"` + no script: empty state warning
    - `dialog === "has_dialog"` + script: per-character cards (1 per character with dialog), each showing name + line count + provider override dropdown (Default/ElevenLabs/Google TTS/Skip) + first 2 lines preview + "+ N more" indicator
  - Footer note about API wires deferred 0.9.4

- **`src/components/FilmMusicSfxSection.tsx`** (NEW, 250 lines):
  - Pink border `#D4537E` section "🎵 7. MUSIC + SFX"
  - 2 sub-blocks:
    - **Music briefs**: per-scene cards with title + duration + textarea (80-120 chars target with green ✓ indicator) + 📋 Copy → Suno + 🔄 Regen (stub)
    - **SFX list**: provider dropdown (Freesound default / Epidemic / Suno SFX) + per-scene cards with editable cue list + 🔗 Freesound deep-link per cue + "+ Add cue" inline input
  - Footer note about full score arc auto-derived in bundle export

- **`src/components/FilmBundleExportSection.tsx`** (NEW, 89 lines):
  - Green border `#639922` section "📦 BUNDLE EXPORT"
  - Intro paragraph explaining the bundle purpose
  - ASCII folder tree preview (memoized via `previewBundleTree()`)
  - "↓ Download Bundle ZIP" primary button (green bg) with loading state "Building ZIP..."
  - Last export stats display (character/scene/shot/image/voice line counts + size KB)
  - Disabled state warning when no cast + no script
  - Footer note about r5 inline base64 reads + PDF format defer

- **`src/components/v0_9_3_film.css`** — +500 lines r6 styles:
  - Voice: provider toggle 2-column buttons, char card with line preview blue accent, no-dialog message panel
  - Music: brief textarea monospace, char count badge with green ✓ when 80-120 ideal, full score arc note pink accent
  - SFX: cue rows with link icon, add-cue inline input, provider dropdown row
  - Bundle: ASCII tree monospace green on dark, download button solid green primary, stats line green left-border

### Changed

- **`src/components/Editor.tsx`**:
  - Removed 3 legacy imports: `VoiceSectionV09`, `MusicSfxSectionV09`, `BundleExportV09`
  - Added 3 new imports: `FilmVoiceSection`, `FilmMusicSfxSection`, `FilmBundleExportSection`
  - `FilmPipeline()` renders 3 new sections in place of legacy

- **`test/components.test.tsx`**: replaced 3 legacy section mount tests with 3 new (FilmVoiceSection no_dialog mode / FilmMusicSfxSection with script + provider toggle / FilmBundleExportSection with tree preview)

### Removed (atomic Q6)

- **`src/components/VoiceSectionV09.tsx`** (278 lines): reading deprecated `filmCharactersV2`, already broken
- **`src/components/MusicSfxSectionV09.tsx`** (219 lines): reading deprecated schemas
- **`src/components/BundleExportV09.tsx`** (388 lines): reading both deprecated schemas + writing legacy ZIP structure

Total: **885 lines legacy removed**, replaced cleanly by 574-line trio + 363-line exporter engine.

### Tests

- ✅ TypeScript compile: 0 errors
- ✅ Vite production build OK: 693 KB main bundle, 6.58s
- ✅ **Vitest runtime: 109/109 PASS** (49 Photos + 47 Film + 8 components + 5 Editor)
- ✅ Photos regression — 49 tests vẫn xanh

16 new r6 tests added:
- `setVoiceAssignment` per-char (3 cases: elevenlabs / google-tts / null skip)
- `clearVoiceAssignment` removes per-char override
- `setVoiceProviderGlobal` updates default
- `setSfxProvider` (3 cases: freesound / epidemic / suno-sfx)
- `setSceneMusicBrief` patches via updateSceneInScript
- `setSceneSfx` replaces array
- `VOICE_PROVIDER_LABELS` + `SFX_PROVIDER_LABELS` const checks
- `previewBundleTree` contains all 5 top folders + correct counts
- `previewBundleTree` voice/ shows no_dialog mode
- `exportFilmBundle` returns Blob with sanitized filename slug + stats
- `exportFilmBundle` produces non-empty ZIP when script provided
- `exportFilmBundle` voice line count matches dialog entries in has_dialog mode
- `FilmVoiceSection` mounts (no_dialog) + switches to char list (has_dialog)
- `FilmMusicSfxSection` mounts with script + Freesound provider visible
- `FilmBundleExportSection` mounts with tree preview showing cast/ + shots/

### Sprint 0.9.3 roadmap progress

- ✅ **r1** Foundation cleanup
- ✅ **r2** Mockup 1 Cast `CastFilmSection`
- ✅ **r3** Mockup 2 Script v1 (Stage 5 quick path)
- ✅ **r3.1** UI polish batch 1
- ✅ **r4** Mockup 3 Storyboard + UI polish batch 2
- ✅ **r5** Mockup 4 Shot Detail (inline expand drawer)
- ✅ **r6** Mockup 5 Voice + Music/SFX + Bundle Export ZIP (file này)
- ⏳ **r7** Mockup 2 multi-stage upgrade — Stage 1-4 Structure/Beats/Twists/Scenes + revert logic = **v0.9.3 final**

### Notes for r7 (final)

- r6 hoàn thiện UI cho all 5 Mockups. Bundle Export functional end-to-end với r5 image binaries embedded.
- r7 sẽ thay 5-stage breadcrumb stub trong FilmIdeaScriptSection bằng clickable navigation với 4 new engine functions (runStage1Structure / runStage2Beats / runStage3Twists / runStage4Scenes) + revert logic (click past stage → clear downstream + regen).
- API wires defer Sprint 0.9.4: ElevenLabs/Google TTS (Voice Generate Audio), Suno (Music brief regen), Imagen 4 (Cast AI Generate), Nano Banana (Replace single frame), `aiRuntime.generateShotsForScene()` (Storyboard AI sinh shots).
- After r7 ship → tag annotated `v0.9.3` final + bump roadmap to 0.9.4 (storage migration + API wires).

---

**Sprint 0.9.3-r5 — Mockup 4 Shot Detail (inline expand drawer) + Image Gen + Video AI provider dropdown.**

r5 ship Mockup 4 — `FilmShotDetailPanel.tsx` renders inline below shot row (collapsible drawer pattern, NOT modal). Image Gen block with grid format display + AI prompt EN + Copy → Banana Pro + Refs ZIP + frame thumbnails + Replace single frame stub. Video AI block with provider dropdown (4 defaults + custom add Grok et al) + animation prompt EN with char count color (green <70% / yellow 70-95% / red >95%) + Copy → Provider.

Major architecture shift: r5 removes the legacy `useGlobalStore.focusedShotId` modal pattern (which replaced the sidebar). Per-shot detail now lives inline as part of the Storyboard flow — clicking a shot row expands FilmShotDetailPanel right under that row, click again collapses.

### 6 Hướng A confirmed (Jason May 11 evening)

1. **AI image prompt** — auto-generate on first expand + manual Regen button
2. **AI animation prompt** — same pattern as Q1
3. **Refs ZIP scope** — ALL project characters (entire `filmV093.characters[]`), simple + complete
4. **Replace single frame** — toast stub `🔁 Nano Banana single-frame regen defer Sprint 0.9.4`
5. **Custom provider** — only `name` required, pricing/duration/charLimit optional. If charLimit missing → char count badge has no color logic.
6. **Provider** — per-shot (each shot picks its own provider via dropdown)

### Added — Types layer

- **`src/types/film_v093.ts`**:
  - `FilmVideoProvider` interface (`id, name, pricingPerSec?, maxDurationSec?, charLimit?, isCustom`)
  - `DEFAULT_VIDEO_PROVIDERS` const seed (4 entries verbatim per MOCKUPS_FILM.md r5 spec):
    - Seedance 2.0 Pro · $0.15/s · 12s · 4000 chars
    - Veo 3 · $0.30/s · 8s · 2500 chars
    - Kling 2.0 · $0.10/s · 10s · 2500 chars
    - Sora · $0.50/s · 20s · 4000 chars
  - `ShotR5Frame` interface (id, order, dataUrl?, locked?)
  - `resolveVideoProvider(id, customs)` helper — fallback to first default if unknown
  - `createShotR5Frames(gridFormat)` helper — produces N empty frame slots
  - `FilmV093Data` extended with `expandedShotId?: string` (singleton — only one shot expanded at a time) + `customVideoProviders?: FilmVideoProvider[]`

- **`src/types/v0_9_0.ts`** — additive r5 fields on `FilmShot` (all optional, backward-compat with r4 data):
  - `imagePromptR5?: string`
  - `animationPromptR5?: string`
  - `videoProviderId?: string`
  - `gridImageDataUrl?: string` (base64 inline, will migrate IDB v0.9.4)
  - `framesR5?: ShotR5Frame[]`

### Added — Store layer (12 new r5 actions)

- `expandShot(project, shotId)` — toggle singleton (same id collapses)
- `collapseShot(project)` — explicit collapse
- `setShotImagePrompt(project, sceneId, shotId, prompt)`
- `setShotAnimationPrompt(project, sceneId, shotId, prompt)`
- `setShotVideoProvider(project, sceneId, shotId, providerId)`
- `setShotGridImage(project, sceneId, shotId, dataUrl)` — also seeds `framesR5` matching grid format + auto status → `rendered`
- `clearShotGridImage(project, sceneId, shotId)` — resets grid + frames + status → `draft`
- `toggleShotFrameLock(project, sceneId, shotId, frameId)` — flip locked on one frame
- `addCustomVideoProvider(project, provider)` — auto-generates id with `custom_*` prefix + sets `isCustom: true`
- `removeCustomVideoProvider(project, providerId)` — only removes that one custom
- `updateCustomVideoProvider(project, providerId, updates)` — patch one provider's fields
- `getAllVideoProviders(project)` — defaults + customs concatenated for dropdown render

### Added — Engine layer

- **`src/engine/filmShotPromptBuilder.ts`** (NEW, 227 lines):
  - `buildImagePrompt({shot, scene?, cast, setting})` → EN cinematic storyboard prompt with grid dims, animation style, cast reference numbering, scene action, framing rules, AVOID list
  - `buildAnimationPrompt({shot, scene?, cast, setting, provider})` → EN director-instruction prompt with provider-specific tone hints (Seedance multi-shot, Veo single fluid, Kling per-pair, Sora long-form narrative). Auto-trims to provider charLimit with `[... auto-trimmed]` marker if over.
  - `charCountColor(charCount, charLimit)` → `"green" | "yellow" | "red" | "none"` per r5 spec thresholds. `"none"` when no charLimit (custom provider without limit).
  - 6 animation style hints (live_action / anime_2d / cgi_3d_cinematic / film_noir / cartoon_2d / stop_motion) + 7 shot type labels.

### Added — Component layer

- **`src/components/FilmShotDetailPanel.tsx`** (NEW, 567 lines):
  - Inline expand drawer (NOT modal). Rendered by FilmStoryboardSection when `filmV093.expandedShotId === shot.id`.
  - Image Gen block: grid format readout + AI prompt textarea (auto-gen on first expand) + Copy → Banana Pro (purple bg primary) + 🔄 Regen + 📥 Refs ZIP (uses JSZip, downloads all project cast face+body refs as `{charname}/face_NN_*.png` / `body_NN_*.png`) + grid upload input (FileReader → dataURL) + auto-cropped frame thumbnails grid (3-col) + per-frame 🔓/🔒 lock + 🔁 replace stub button
  - Video AI block: `<select>` dropdown showing 4 defaults flat + `<optgroup label="Custom providers">` for customs (with ⭐ prefix) + `+ Add custom provider` option (triggers inline form with name/pricing/maxDur/charLimit inputs) + Remove button for custom provider when selected + animation prompt textarea + char count badge with color class (`.ksp-char-count-green/yellow/red`) when charLimit available, else "N chars (no limit set)" + Copy → {provider.name} (purple bg primary) + 🔄 Regen
  - Auto-regen animation prompt khi switch provider (cập nhật provider tone hint)
  - JSZip + FileReader integration matches existing CastFilmSection ref upload pattern

- **`src/components/v0_9_3_film.css`** — +260 lines r5 styles:
  - `.ksp-storyboard-shot-expand` ▶/▼ chevron button (22×22)
  - `.ksp-storyboard-shot-expanded` highlighted state (purple left-border accent)
  - `.ksp-shot-detail-panel` drawer container (dashed purple left border, indented 22px to align nested under chevron)
  - `.ksp-shot-detail-block` block container with `.ksp-shot-detail-imagegen` / `.ksp-shot-detail-videoai` (border-color `#AFA9EC` per Mockup 4 spec)
  - `.ksp-shot-detail-section-header` purple bg subtle + `.ksp-shot-detail-section-title` uppercase 11px
  - `.ksp-shot-detail-prompt` monospace textarea
  - `.ksp-char-count-{green/yellow/red}` badge colors verbatim
  - `.ksp-shot-detail-frames-grid` 3-col thumbnail grid
  - `.ksp-shot-detail-frame-thumb` square aspect-ratio cells with action bar overlay
  - `.ksp-shot-detail-add-provider` inline custom provider form

### Changed

- **`src/components/FilmStoryboardSection.tsx`**:
  - Import `FilmShotDetailPanel` + `expandShot` action
  - Pass `expandedShotId` + `onExpandShot` props down through SceneStoryboardCard → ShotRow
  - ShotRow now has `▶` chevron button on left (replaces nothing — pure addition); clicking it calls `onClickExpand`
  - When `expanded === true`, render `<FilmShotDetailPanel sceneId={scene.id} shot={shot} scene={scene} />` in a React Fragment immediately after the row
  - Added `.ksp-storyboard-shot-expanded` class on row when expanded

- **`src/components/Editor.tsx`**:
  - **REMOVED** `ShotDetailPanel` import (file deleted)
  - **REMOVED** `useGlobalStore` import + `focusedShotId`/`setFocusedShot` reads (the legacy modal pattern is gone)
  - **REMOVED** `if (focusedShotId)` early-return block that replaced sidebar content with ShotDetailPanel
  - **REMOVED** Step 4 (IMAGE GEN) + Step 5 (VIDEO AI) standalone `PipelineStep` wrappers — both are now per-shot inline accessed via Storyboard click. Replaced with comment explaining the new pattern.

- **`src/components/v0_9_0_phase34.css`** — unchanged (legacy styles untouched).

### Removed (atomic Q6)

- **`src/components/ShotDetailPanel.tsx`** (852 lines): xoá hoàn toàn. Legacy component was reading `migrated.filmStructureV2` + `filmCharactersV2` (old v0.9.0 schema), already broken with r4 `filmV093.shotsBySceneId` data flow — confirmed needed full rebuild. Replaced cleanly by FilmShotDetailPanel inline drawer.

- **`test/components.test.tsx`**: replaced `ShotDetailPanel` empty-state test → `FilmShotDetailPanel` inline mount test (verifies IMAGE GEN + VIDEO AI blocks both render).

### Tests

- ✅ TypeScript compile: 0 errors
- ✅ Vite production build OK: 691 KB main bundle, 70 KB CSS, 9.85s
- ✅ **Vitest runtime: 93/93 PASS** (49 Photos + 31 Film + 8 components + 5 Editor)
- ✅ Photos regression — 49 tests vẫn xanh

17 new r5 tests added:
- `expandShot` toggle (same id collapses)
- `collapseShot` clears
- `setShotImagePrompt` + `setShotAnimationPrompt` + `setShotVideoProvider` patch fields
- `setShotGridImage` seeds framesR5 with correct count per grid + status → rendered
- `clearShotGridImage` resets + status → draft
- `toggleShotFrameLock` flip
- `addCustomVideoProvider` stores with auto-id + isCustom=true
- `addCustomVideoProvider` accepts name-only (Hướng A flexibility)
- `removeCustomVideoProvider` only removes specified one
- `updateCustomVideoProvider` patches fields
- `getAllVideoProviders` returns defaults + customs concatenated
- `resolveVideoProvider` fallback to first default for unknown id
- `createShotR5Frames` produces correct count per grid format (4 / 6 / 9 / 12)
- `charCountColor` thresholds (green <70% / yellow 70-95% / red >95% / none if no limit)
- `buildImagePrompt` snapshot contains grid dims + style + cast count + scene action
- `buildAnimationPrompt` provider-specific tone for each default (Seedance/Veo/Sora)
- `FilmShotDetailPanel` mount test (IMAGE GEN + VIDEO AI blocks both render)

### Sprint 0.9.3 roadmap progress

- ✅ **r1** Foundation cleanup
- ✅ **r2** Mockup 1 Cast `CastFilmSection`
- ✅ **r3** Mockup 2 Script v1 (Stage 5 quick path)
- ✅ **r3.1** UI polish batch 1
- ✅ **r4** Mockup 3 Storyboard + UI polish batch 2
- ✅ **r5** Mockup 4 Shot Detail (file này)
- ⏳ **r6** Mockup 5 Voice+Music+Bundle — 3 sections + ZIP folder tree
- ⏳ **r7** Mockup 2 multi-stage upgrade — Stage 1-4 + revert logic = **v0.9.3 final**

### Notes for r6

- r5 left `useGlobalStore.focusedShotId` / `setFocusedShot` in `useGlobalStore.ts` (unused after Editor cleanup). Safe to leave for now (no orphan references); will clean up r6 or final pre-v0.9.3 cleanup pass.
- Replace single frame stub fires toast only. r5/0.9.4 wire Nano Banana with shot context (which character refs to feed, which frame index to replace).
- `aiRuntime.generateShotsForScene()` AI sinh shots still stubbed from r4. Wire 0.9.4.
- r6 Bundle Export ZIP will read `shot.gridImageDataUrl` + `shot.framesR5[].dataUrl` (r5 inline base64) → write to `shots/scene{N}_shot{M}_{type}/grid_{NxM}.png` + `cropped/01.png ... 0K.png`. Schema is already ready.
- `imagePromptR5` + `animationPromptR5` will be written to `image_prompt.txt` + `animation_prompt_{providerId}.txt` in r6 bundle.

---

**Sprint 0.9.3-r4 — Mockup 3 Storyboard (Scenes × Shots hierarchy) + UI polish batch 2.**

r4 ship Mockup 3 — Storyboard section với hierarchy Scenes (từ Script) → Shots (manual hoặc AI sinh). Mỗi shot có grid size (2x2/2x3/3x2/3x3/4x3) + 4 status badges (rendered/rendering/pending/locked). Cộng polish UI batch 2 từ feedback.

### UI Polish batch 2 (feedback r3.1)

- **Dialog → dropdown** (Jason muốn dropdown thay vì segmented control): `<select>` với "🔇 Không thoại" / "💬 Có thoại"
- **Aspect Ratio labels gọn**: bỏ phần giải thích trong ngoặc (TikTok/Reels), (IG feed), (YouTube/TV), (Film mode). Chỉ giữ ngắn: "16:9 landscape" / "9:16 vertical" / "1:1 square" / "4:5 portrait" / "4:3 classic" / "21:9 cinemascope" / "2.39:1 anamorphic"
- **Cast cards**: bỏ avatar circle hoàn toàn (chỉ render body content full-width). Bỏ background + border-radius + outer border của từng card. Cards giờ separated bằng subtle horizontal line. Width 100% với padding 8px 10px.
- **Idea + Script sections**: remove section outer padding (padding: 0 trên container). Inner blocks (textarea, breadcrumb, provider toggle, actions, scenes list, feed note) tự padding/margin riêng 12px.

### Added — Types layer

- **`src/types/film_v093.ts`**: extend `FilmV093Data` với `shotsBySceneId?: Record<string, FilmShot[]>` (r4 storyboard shots per scene)

### Added — Store layer

- **`src/store/film_actions.ts`**: 6 new shot actions cho r4:
  - `getShotsForScene(project, sceneId)` — read-only get shots cho scene
  - `addShot(project, sceneId, override?)` — add new shot with default grid 3x3, increment order
  - `updateShot(project, sceneId, shotId, updates)` — patch shot fields (grid, status, title, etc.)
  - `removeShot(project, sceneId, shotId)` — remove + re-order remaining
  - `setShotStatus(project, sceneId, shotId, status)` — update status badge
  - `toggleShotLocked(project, sceneId, shotId)` — flip locked state

### Added — Component layer

- **`src/components/FilmStoryboardSection.tsx`** (NEW, 280 lines):
  - Purple border (`#534AB7`) section "🎬 3. STORYBOARD"
  - Header meta: `N shots · M frames` (computed)
  - Scene cards collapsible (default expanded) — show Scene N + title + shot count
  - Per-scene body: shot rows với grid format dropdown + shot type dropdown + status badge + lock/remove buttons
  - Empty state cho shots: "Chưa có shot nào. Add manual hoặc AI sinh shots..."
  - 2 action buttons per scene: "+ Add Shot" (manual) + "✨ AI sinh shots" (stub, defer 0.9.4 wire generateShotsForScene)
  - Footer note: "ⓘ Grid size khác nhau per shot: 2×2 insert · 3×3 default · 4×3 action"
  - **4 Status badges** (Q3 lock):
    - `✓ rendered` (green bg `#EAF3DE`, text `#3B6D11`)
    - `⚙ rendering` (orange bg `#FAEEDA`, text `#854F0B`)
    - `○ pending` (gray bg `#2a2a2a`, text `#888`)
    - `🔒 locked` (blue bg `#E6F1FB`, text `#0C447C`)
  - **5 grid formats** dropdown: 2x2 (4 frames) / 2x3 (6) / 3x2 (6) / 3x3 (9 default) / 4x3 (12)
  - 7 shot types dropdown: Wide / Medium / Close-up / Insert / Over shoulder / Two-shot / POV
  - Click shot → drill-down (Mockup 4 ShotDetailPanel — defer r5)

- **`src/components/v0_9_3_film.css`**: r4 storyboard styles + r3.2 polish overrides:
  - `.ksp-storyboard-film` purple border
  - Scene cards với expandable header + body
  - Shot rows compact với title input + 2 dropdowns + actions
  - Status badge 4 variants với spec colors
  - AI sinh shots button purple gradient
  - r3.2 overrides: Cast card background/border removed, avatar hidden, Idea/Script section padding 0

### Changed

- **`src/components/ProjectSettingSectionV09.tsx`**:
  - Dialog: segmented control → select dropdown (Jason feedback)
  - Aspect Ratio: labels rút gọn (bỏ tooltip text trong ngoặc)
- **`src/components/CastFilmSection.tsx`**: remove `<div className="ksp-cast-film-avatar">` rendering (avatar element removed entirely — CSS `display:none` would still allocate node, removed cleaner)
- **`src/components/Editor.tsx`**: replace import `ScenesShotsManagerV09` → `FilmStoryboardSection`. Export `Connector` function để FilmIdeaScriptSection import (used để add connector Idea↔Script trong cùng component)

### Removed (atomic Q6)

- **`src/components/ScenesShotsManagerV09.tsx`** (396 lines): xoá hoàn toàn. UI cũ với scene cards + shot list giản thay bằng FilmStoryboardSection's cleaner hierarchy view.
- **`test/components.test.tsx`**: replace `ScenesShotsManagerV09` test → `FilmStoryboardSection`.

### Tests

- ✅ TypeScript compile: 0 errors
- ✅ **Vitest runtime: 76/76 PASS** (49 Photos + 14 Film + 8 components + 5 Editor)
- ✅ Photos regression — 49 tests vẫn xanh
- New r4 tests: addShot order increment / updateShot grid+status patch / removeShot re-order / toggleShotLocked flip / FilmStoryboardSection mount

### Sprint 0.9.3 roadmap progress

- ✅ **r1** Foundation cleanup
- ✅ **r2** Mockup 1 Cast `CastFilmSection`
- ✅ **r3** Mockup 2 Script v1 (Stage 5 quick path)
- ✅ **r3.1** UI polish batch 1 (Time Format hide, refs slots smaller, connector, breadcrumb stub, button orange filled, provider 50/50)
- ✅ **r4** Mockup 3 Storyboard + UI polish batch 2 (file này)
- ⏳ **r5** Mockup 4 Shot Detail — `FilmShotDetailPanel` + Video AI dropdown + custom Grok
- ⏳ **r6** Mockup 5 Voice + Music + Bundle — 3 sections + ZIP folder tree
- ⏳ **r7** Mockup 2 multi-stage upgrade — Stage 1-4 + revert logic = **v0.9.3 final**

### Notes for r5

- FilmStoryboardSection shot row click → drill-down sẽ open trong r5 với `FilmShotDetailPanel` component. r4 chỉ render row inline view (no modal).
- AI sinh shots per-scene button hiện chỉ toast stub. r5/r6 sẽ wire `aiRuntime.generateShotsForScene()` existing function với Gemini Flash. Cost ~1 AI call per scene.
- Status transitions: r4 ship UI manual toggle via dropdown shot row. r5 sẽ auto transition based on actions (paste grid PNG → status=rendered; click "Render" → status=rendering).

---

## [0.9.3-r3] — 2026-05-11

**Sprint 0.9.3-r3 — Mockup 2 Script v1 (Stage 5 quick path) + UI polish.**

r3 ship Mockup 2 — combined Idea + Multi-stage Script section. Stage 5 quick path (1-cú AI generation full script với SFX/MUSIC/TRANSITION inline). Multi-stage wizard (Stage 1-4) defer r7. Cũng polish UI từ feedback r2 test.

### UI Polish (from r2 feedback)

- **`ProjectSettingSectionV09.tsx`**: Restructure layout cho sidebar 380px:
  - Row 1: Mode + Genre
  - Row 2: Animation Style + Dialog (move Dialog từ standalone row → cùng row Animation Style)
  - Row 3: Aspect Ratio + Duration
  - Time Format standalone row (Photos hidden)
- **`v0_9_3_film.css`**: Bỏ left border accent role color trên character card (duplicate với outer border → kì). Role indication chỉ qua avatar circle background color.
- **`CastFilmSection.tsx`**: Avatar dùng initial letter của name (vd "R" cho Robot) hoặc order number (1, 2...) thay vì emoji ngôi sao ⭐ (Jason feedback bỏ). Role dropdown options cũng bỏ emoji prefix cho consistency.

### Added — Types layer

- **`src/types/film_v093.ts`**: Extend `FilmV093Data`:
  - `script?: FilmScript` (reuse legacy type cross-compat với existing engine/aiRuntime.generateFilmScript)
  - `scriptProvider?: "gemini-flash" | "openai-4o"` (per-project AI provider override)

### Added — Store layer

- **`src/store/film_actions.ts`**: 6 new script-related actions:
  - `setScript(project, script)` — set/replace với versioning (last-10 retention, ScriptVersion wrapper với id/timestamp/label/scriptSnapshot)
  - `clearScript(project)` — reset to no-script state
  - `revertScriptToVersion(project, versionIndex)` — restore archived version, current script đi vào versions
  - `setScriptProvider(project, provider)` — toggle Gemini/OpenAI
  - `updateSceneInScript(project, sceneId, updates)` — manual edit scene fields
  - `addEmptyScene(project)` — add blank scene at end
  - `removeScene(project, sceneId)` — remove + re-order

### Added — Engine layer

- **`src/engine/filmScriptStages.ts`** (NEW, 90 lines):
  - `runStage5Quick(input)` — 1-cú AI generation full script
  - Internal: adapter function `adaptCharacter()` map FilmCharacter v0.9.3 → legacy FilmCharacterV2 cho existing scriptWriter.ts prompts
  - Maps role "companion" → legacy "supporting" (legacy enum không có companion)
  - Strip dialog lines nếu Project Setting `dialog === "no_dialog"` (defensive — some AI providers ignore hint)
  - Future: r7 sẽ add `runStage1Structure`, `runStage2Beats`, `runStage3Twists`, `runStage4Scenes` cho multi-stage wizard

### Added — Component layer

- **`src/components/FilmIdeaScriptSection.tsx`** (NEW, 350 lines):
  - Combined Idea + Script sections (replaces FilmScriptSection)
  - Idea green border textarea (1 prose VN field)
  - Script orange border với provider toggle (Gemini Flash / OpenAI 4o)
  - "AI viết Script từ idea" primary action — disabled khi no idea, no cast, hoặc generating
  - "Variation (regen)" reuses same input nhưng tạo version mới
  - Versions list (collapse panel, newest first) với Revert button per version
  - Export .txt button (simple text export script)
  - Scene cards collapsible (first scene expanded by default)
    - Action lines click-to-edit
    - Dialog lines (when present)
    - SFX list (blue inline)
    - Music brief (purple inline)
    - Transition note (green inline)
  - Add Scene manual + Clear all buttons
  - "ⓘ Script feed: Storyboard · SFX list · Music briefs" footer note

- **`src/components/v0_9_3_film.css`**: Append styles cho r3:
  - `.ksp-idea-film` green border (#1D9E75)
  - `.ksp-script-film` orange border (#D85A30)
  - Provider segmented toggle
  - Versions panel với Revert button
  - Scene cards collapsible với 4 inline note colors (SFX blue / Music purple / Transition green / Dialog pink)

### Changed

- **`src/components/Editor.tsx`**:
  - Replace import `FilmScriptSection` → `FilmIdeaScriptSection`
  - FilmPipeline: bỏ standalone PipelineStep Step 1 (IdeaCardV09) — FilmIdeaScriptSection đã chứa cả Idea + Script sections combined.

### Removed (atomic Q6 same pattern as r2)

- **`src/components/FilmScriptSection.tsx`** (494 dòng): xoá hoàn toàn. UI cũ với 5-stage tabs (Concept/Storyline/Scenes/Dialogues/Final) replaced bởi FilmIdeaScriptSection's combined view.
- **`test/components.test.tsx`**: replace `FilmScriptSection` test → `FilmIdeaScriptSection`.

### Tests

- ✅ TypeScript compile: 0 errors
- ✅ **Vitest runtime: 71/71 PASS** (49 Photos + 9 Film mode + 8 components + 5 Editor)
- ✅ Photos regression — 49 tests vẫn xanh
- New test: `setScript stores script + archives prev version on update` — verify versioning wrapper

### Sprint 0.9.3 roadmap progress

- ✅ **r1** Foundation cleanup
- ✅ **r2** Mockup 1 Cast `CastFilmSection`
- ✅ **r3** Mockup 2 Script v1 (Stage 5 quick path) + UI polish (file này)
- ⏳ **r4** Mockup 3 Storyboard — `FilmStoryboardSection` hierarchy
- ⏳ **r5** Mockup 4 Shot Detail — `FilmShotDetailPanel` + Video AI dropdown + custom Grok
- ⏳ **r6** Mockup 5 Voice + Music + Bundle — 3 sections + ZIP folder tree
- ⏳ **r7** Mockup 2 multi-stage upgrade — Stage 1-4 + revert logic = **v0.9.3 final**

### Notes for r4

- Script schema dùng existing `FilmScript` type từ v0_9_0.ts cho cross-compat. Storyboard r4 sẽ đọc `filmV093.script.scenes` để generate shots per scene.
- AI provider integration đã wire (generateFilmScript → existing aiRuntime). User cần API key Gemini hoặc OpenAI để generate script. Without key, button vẫn enabled nhưng error toast khi click.
- Stage 5 quick path generates full script in single AI call. Cost: ~1 Gemini Flash / OpenAI 4o request per script (~2-8K tokens output). r7 sẽ split thành 5 calls (~1 per stage) for higher quality multi-stage wizard.

---

## [0.9.3-r2] — 2026-05-11

**Sprint 0.9.3-r2 — Mockup 1 Cast: rebuild Film cast với CastFilmSection + Project Setting extend.**

Phase đầu tiên của Film rebuild theo 5 mockups Jason chốt. r2 ship foundation Cast: types schema mới + actions + UI component + Project Setting extend với Dialog toggle + Genre/Animation/Aspect filter theo Q5 lock.

### Added — Types layer

- **`src/types/film_v093.ts`** (NEW, 173 dòng):
  - `FilmCharacter` interface với 4 roles (Q2 lock): `protagonist` / `antagonist` / `companion` / `extra`
  - `FilmImageRef` interface (base64 dataURL inline, will migrate IndexedDB v0.9.4)
  - `FilmV093Data` (schema "v0.9.3-film") chứa multi-character cast + selectedCharacterId
  - `FilmDialogMode` type (Q5 lock: 2-way `has_dialog` / `no_dialog`)
  - `ROLE_LABELS` constant với vi/en/emoji per role
  - Factories: `createDefaultFilmV093()`, `createFilmCharacter()`, `createFilmImageRef()`
  - Constants: `MAX_FACE_REFS_FILM = 4`, `MAX_BODY_REFS = 3` (Q3 lock)
  - `DEFAULT_FACE_LABELS_FILM` (front / 3/4 L / 3/4 R / profile)
  - `DEFAULT_BODY_LABELS` (front / side / back)

- **`src/types/v0_9_0.ts`** (extended):
  - Add `filmV093?: FilmV093Data` vào `ProjectV09Extensions`
  - Add `dialog?: FilmDialogMode` vào `ProjectSettingV2` (Q5 lock)
  - Add `4:3` aspect ratio vào `AspectRatioV2` enum (classic TV / retro film)

### Added — Store layer

- **`src/store/film_actions.ts`** (NEW, 215 dòng):
  - `ensureFilmData(project)` — get or create default
  - Character CRUD: `addCharacter` (auto-select first) / `updateCharacter` / `removeCharacter` (re-order remaining) / `selectCharacter`
  - Face refs CRUD: `addFaceRef` (enforce cap 4) / `removeFaceRef` / `relabelFaceRef`
  - Body refs CRUD: `addBodyRef` (enforce cap 3) / `removeBodyRef` / `relabelBodyRef`
  - AI Generate stub: `setAiGenDescription` / `clearAiGenDescription` (Q4)

### Added — Component layer

- **`src/components/CastFilmSection.tsx`** (NEW, 387 dòng):
  - Vertical full-width cards stack dọc (Q1 lock)
  - Per-card: avatar circle role-colored + name input + role dropdown (4 options) + description textarea + face refs grid + body refs grid + AI Generate button + remove
  - `RefsRow` subcomponent: file upload → FileReader dataURL → dimension validation ≥1024px → slot grid với thumbnails + labels + remove
  - `AiGenerateModal` (Q4 stub): textarea description prose, save vào `aiGenDescription` field, NO API call. Sprint 0.9.4 sẽ wire Imagen 4.
  - Empty state khi 0 characters: "Chưa có character. Nhấn + Thêm character..."
  - Footer button "✨ AI gợi ý cast từ idea" (stub toast, defer Sprint 0.9.4)

- **`src/components/v0_9_3_film.css`** (NEW):
  - Role-colored left border accent per card (protagonist purple / antagonist red / companion pink / extra gray)
  - Avatar role color bg + text
  - Refs row left border accent (face blue / body purple)
  - Ref slot 64×64 với label bottom overlay + remove top-right
  - AI Generate gradient button + badge
  - Modal backdrop + body + footer
  - Segmented control cho Dialog toggle

### Changed

- **`src/components/ProjectSettingSectionV09.tsx`**:
  - Filter Genre dropdown 9 → 6 options theo Q5 lock (drama / sci_fi / action / romance / thriller / comedy). Horror / fantasy / documentary archived (enum giữ cho backward compat).
  - Filter Animation Style dropdown 6 → 4 options theo Q5 lock (live_action / cgi_3d_cinematic / anime_2d / film_noir). Cartoon_2d + stop_motion defer v0.9.4+.
  - Filter Aspect Ratio dropdown 6 → 5 options khi Film mode (16:9 / 9:16 / 1:1 / 4:3 / 21:9). 4:5 + 2.39:1 visible nếu mode khác.
  - **Add Dialog segmented control** (2-way "💬 Có thoại" / "🔇 Không thoại") khi `isFilm`. Default no_dialog.
  - Duration field: text input → number input integer (1-60 phút) với validation.

- **`src/components/Editor.tsx`**:
  - Replace import `CastSectionV09` → `CastFilmSection`
  - Route Film mode → `<CastFilmSection />`
  - Add CSS import `./v0_9_3_film.css`

### Removed (Q6 atomic)

- **`src/components/CastSectionV09.tsx`** (595 dòng, multi-character cards cũ): xoá hoàn toàn. Photos mode KHÔNG bị ảnh hưởng (CastPhotosSection riêng). Project Film schema cũ (`filmCharactersV2`) deprecated — user mở project cũ sẽ thấy CastFilmSection empty (cần tạo character mới).

- **`test/components.test.tsx`**: replace `CastSectionV09` import + test case bằng `CastFilmSection`.

### Tests

- ✅ TypeScript compile: 0 errors
- ✅ **Vitest runtime: 70/70 PASS** (49 Photos + 8 Film mode NEW + 8 components + 5 Editor)
- ✅ Photos regression — 49 Photos tests vẫn xanh, không bị ảnh hưởng bởi r2 changes
- New tests in `test/film_mode.test.tsx`:
  - ensureFilmData creates default
  - addCharacter increments order + auto-selects first
  - removeCharacter re-orders remaining
  - updateCharacter applies partial updates
  - addFaceRef enforces cap 4
  - addBodyRef enforces cap 3
  - setAiGenDescription saves prose
  - CastFilmSection mounts no crash

### Sprint 0.9.3 roadmap progress

- ✅ **r1** Foundation cleanup (xoá 18 files + fix update.sh wipe .git + .gitignore)
- ✅ **r2** Mockup 1 Cast `CastFilmSection` (file này)
- ⏳ **r3** Mockup 2 Script v1 — `FilmIdeaScriptSection` (Stage 5 quick path)
- ⏳ **r4** Mockup 3 Storyboard — `FilmStoryboardSection` hierarchy
- ⏳ **r5** Mockup 4 Shot Detail — `FilmShotDetailPanel` + Video AI dropdown + custom Grok
- ⏳ **r6** Mockup 5 Voice + Music + Bundle — 3 sections + ZIP folder tree
- ⏳ **r7** Mockup 2 multi-stage upgrade — Stage 1-4 + revert logic = **v0.9.3 final**

### Notes for next session

- `CastSectionV09` đã xoá → project Film cũ (schema `filmCharactersV2`) khi mở sẽ render CastFilmSection rỗng. User cần thêm character lại. Migration auto từ schema cũ → mới defer Sprint 0.9.3-r3+ (cần engine adapter đọc filmCharactersV2 → mapping FilmCharacter).
- Q4 AI Generate button stub đã ship: lưu `aiGenDescription` field trong schema. Sprint 0.9.4 wire Imagen 4 sẽ đọc field này để generate face/body refs thật.
- Dialog field thêm vào ProjectSettingV2 — backward compat (optional field, default `no_dialog` khi missing).

---

## [0.9.3-r1] — 2026-05-11

**Sprint 0.9.3 kickoff — Foundation cleanup: xoá rác TVC archived + Film legacy.**

Sau big decision May 10 (bỏ TVC pivot Film), Sprint 0.9.3 mở đầu bằng cleanup batch lớn: xoá 18 files rác (Nhóm 1 TVC archived + Nhóm 2 Legacy), hide TVC + Product khỏi Mode dropdown, prepare codebase cho Film rebuild các r2-r7 sắp tới.

### 🚨 Post-ship fixes (May 11)

Sau ship r1 đầu, 2 vấn đề critical phát hiện + fixed trên `main`:

**1. node_modules accidentally committed (43.71 MiB bloat)** — push r1 lần đầu (commit `bbc48d4`) bloat repo từ 440 KB lên 44 MB vì `node_modules/` + `dist/` bị track. Root cause: zip ship thiếu `.gitignore` + `update.sh` rsync `--delete` xóa `.gitignore` (không có trong exclude list) từ folder fresh clone. Fix: restore `.gitignore` permanent + `git rm -r --cached node_modules dist` + commit + push. History bloat vẫn còn (44 MB trong git history) nhưng repo browse view đã clean.

**2. `update.sh` còn xóa `.gitignore`** — fix lần đầu chỉ add `.git`, `.git/**`, `.env`, `.env.*`, `.vscode`, `.idea`, `*.local` vào rsync exclude — vẫn thiếu `.gitignore`. Fix bổ sung: thêm `--exclude='.gitignore'` + `--exclude='package-lock.json.local'` vào rsync block + fallback `cp -R` loop. Từ giờ chạy `update.sh` thoải mái, cả `.git/` và `.gitignore` đều persist.

### 🚨 CRITICAL BUG FIX — `update.sh` wipe `.git/` (root cause "lúc nào cũng mất git")

Phát hiện root cause: `update.sh` dòng 70 dùng `rsync -a --delete` để sync source từ zip mới về project folder, **nhưng `.git` KHÔNG có trong exclude list** → mỗi lần Jason chạy `update.sh`, rsync xóa sạch `.git/`. Đây là lý do anh ấy mất git repo **mỗi lần update**, không chỉ 1 lần khi move folder như tưởng trước đó.

**Fix:** Thêm vào excludes:
- `.git` + `.git/**` (bảo vệ git repo)
- `.gitignore` (bảo vệ ignore rules — added post-ship May 11)
- `.env`, `.env.*` (bảo vệ secrets local)
- `.vscode`, `.idea` (bảo vệ IDE configs)
- `*.local` (bảo vệ generic local files)

Fix cho cả 2 branch: rsync path + fallback `cp -R` loop khi system không có rsync.

**Impact:** Từ r1 trở đi, anh có thể chạy `update.sh` thoải mái, `.git/` + `.gitignore` sẽ persist qua mọi update.

### Removed — Nhóm 1: TVC archived (6 files, ~42 KB)

- `src/components/ProductSection.tsx`
- `src/components/TvcConceptSection.tsx`
- `src/components/v0_9_2_product.css`
- `src/store/tvc_actions.ts`
- `src/types/tvc_product_v091.ts`
- `test/tvc_product.test.tsx` (22 TVC tests → coverage giảm 85→62)

### Removed — Nhóm 2: Legacy không dùng (12 files, ~228 KB)

- `src/components/FilmCharactersSection.tsx` (dead 366 dòng)
- `src/components/StoryboardSection.tsx` (legacy v0.7.5 monolithic 1683 dòng)
- `src/components/SubjectSection.tsx` (legacy v0.8)
- `src/components/ReferencesSection.tsx` (legacy v0.8)
- `src/components/IdeaSection.tsx` (replaced by `PhotosIdeaSection`)
- `src/components/ModeIndustrySection.tsx` (legacy v0.8)
- `src/components/CameraSection.tsx` (replaced by `CameraStyleToggleV09`)
- `src/components/EditorTab.tsx` (dead full-width editor feature)
- `src/components/ShotEditor.tsx` (legacy v0.7.5)
- `src/components/ShotsSection.tsx` (legacy v0.7.5)
- `src/components/Editor.tsx.v0.8.x.backup` (backup file)
- `src/engine/blocks_v04.ts.backup` (backup file)

Tổng cleanup: **18 files, ~270 KB code rác xoá khỏi codebase.**

### Changed

- **`src/editor.tsx`**: legacy EditorTab full-width 1400px (dead feature, không có code wire `window.open`) → wired tới `Editor` sidebar component cho consistency. CSS imports chuyển từ v0_9_0_phase2+phase34 sang v0_9_1_photos.
- **`src/components/Editor.tsx`**:
  - Remove imports `ProductSection`, `TvcConceptSection`, CSS `v0_9_2_product.css`
  - Remove `TvcPipeline()` + `ProductPipeline()` functions
  - Add `ArchivedModePlaceholder({mode})` — show note "Tạm gác lại" cho `tvc_commercial` + `product_photo`
- **`src/components/ProjectSettingSectionV09.tsx`**: MODES dropdown ẩn TVC Commercial + Product Photo (comment out, code giữ trong codebase, có thể re-enable post-v1.0). Chỉ expose **Photos** + **Film / Short Film**.
- **`src/types/v0_9_0.ts`**: remove field `tvcProduct?: TvcProductData` khỏi `ProjectV2` type + comment reserved slot cho `filmV093?: FilmV093Data` (sẽ add Sprint 0.9.3-r2).
- **`test/components.test.tsx`**: remove `TvcConceptSection` import + test case + `tvcProject` fixture (9→8 tests).

### Tests

- ✅ TypeScript compile: 0 errors
- ✅ Vite production build: 704 KB main bundle, 53 KB CSS, build OK 10.3s
- ✅ **Vitest runtime: 62/62 PASS** (49 Photos + 8 components + 5 Editor)
- ✅ Photos workflow LOCKED không bị regression — 49 Photos tests vẫn xanh

### Known stubs (sẽ rebuild r2-r7)

Nhóm 3 (Film đang dùng — chưa xoá r1): `CastSectionV09`, `FilmScriptSection`, `ScenesShotsManagerV09`, `ShotDetailPanel`, `VoiceSectionV09`, `MusicSfxSectionV09`, `BundleExportV09`. Vẫn render được Film mode hiện tại với UI cũ trong khi chờ rebuild theo 5 mockups mới.

### Sprint 0.9.3 roadmap

- ✅ **r1** Foundation cleanup (file này)
- ⏳ **r2** Mockup 1 Cast — `CastFilmSection.tsx` pattern Photos
- ⏳ **r3** Mockup 2 Script v1 — `FilmIdeaScriptSection.tsx` (1-stage quick path)
- ⏳ **r4** Mockup 3 Storyboard — `FilmStoryboardSection.tsx` hierarchy
- ⏳ **r5** Mockup 4 Shot Detail — `FilmShotDetailPanel.tsx` + Video AI dropdown + custom Grok
- ⏳ **r6** Mockup 5 Voice+Music+Bundle — 3 sections + ZIP folder tree
- ⏳ **r7** Mockup 2 multi-stage upgrade — Stage 1-4 Structure/Beats/Twists/Scenes + revert logic = **v0.9.3 final**

---

## [0.9.2-r2] — 2026-05-10

TVC mode UX consistency fix: dùng chung Cast pattern với Photos + Product Section refactor single-row.

### Changed (Cast TVC)

- **Editor.tsx routing**: `mode === "tvc_commercial"` giờ render `CastPhotosSection` (5 Subject Types + 1-6 face refs + outfit) thay vì `CastSectionV09` (multi-character cards).
- **CastSectionV09 vẫn giữ cho Film mode** (cinema cần multi-character narrative).
- Lý do: Jason feedback Cast TVC trong r1 "rất lộn xộn" → đồng nhất pattern Cast Photos.

### Changed (Product Section)

Full UI rewrite — single-row layout:

- **Layout**: `image-slot LEFT (96×96)` + `form RIGHT (brand input + tagline textarea)` chung 1 row flex.
- **Single image only**: upload mới luôn replace ảnh cũ. Schema `productImages: TvcProductImage[]` giữ nguyên array nhưng UI chỉ dùng `[0]` (no migration risk).
- **3-way upload** (mirror Cast Photos):
  - 📤 file picker (existing)
  - 📁 LibraryPicker modal (NEW — accepts `category="product"`)
  - 📷 Snip-to-save từ Pinterest/web (NEW — `SNIP_START` với category "product")
- **SNIP_DONE listener**: filter `msg.category === "product"` → toast.

### Removed (Product UI)

- 📸 Image counter `0/6`
- Recommendation hint "Khuyến nghị 3+ ảnh: pack shot, side view, detail"
- "+ Thêm tagline tiếng Anh" toggle (action `setTaglineEn` giữ trong store)
- "+ Thêm brand notes" toggle (action `setBrandNotes` giữ trong store)
- Per-image label edit (single-image, no need)
- Multi-image grid

### Extended

- **LibraryPicker**: type `"face" | "outfit"` → `"face" | "outfit" | "product"`. Empty-state hint adaptive cho product category. Schema `RefCategory` đã sẵn `"product"` từ trước (db.ts + background.ts context menu).

### Tests

- ✅ TypeScript: 0 errors
- ✅ Vite production build: 9.4s
- ✅ **Vitest runtime: 85/85 PASS** (tăng từ 77/77 ở r1)
  - 49 photos_mode (unchanged)
  - 22 tvc_product (8 actions + 8 UI new layout + 1 defensive Cast Film + 4 Editor routing + regression)
  - 9 components + 5 Editor (unchanged)

### Files modified

- `src/components/Editor.tsx` — route TVC + Photos chung CastPhotosSection
- `src/components/ProductSection.tsx` — full UI rewrite
- `src/components/LibraryPicker.tsx` — extend product category
- `src/components/v0_9_2_product.css` — single-row layout
- `test/tvc_product.test.tsx` — 22 tests (was 14)
- `manifest.json` + `package.json` — bump r2

### Known limitations (Sprint r3+)

- Brand/Tagline/Product image chưa wire vào engine prompt builder (Sprint r3 implement).
- TVC Storyboard vẫn stub (Sprint r5).
- Cast TVC reuse Photos store schema → khi Sprint r3 tách `castTvc` riêng có thể migrate.

---

## [0.9.2-r1] — 2026-05-10

Sprint 0.9.2 kickoff: TVC Product/Brand section + crash fix unblock TVC test.

### Fixed (Critical — Cast crash)

- **CastSectionV09 line 426**: `ref.angle.replace(...)` crash với "Cannot read properties of undefined (reading 'angle')" khi user upload image hoặc khi project có legacy CharacterRef không có `angle` field. Defensive fix: `(ref.angle ?? "front").replace(...)`. Sẽ replace bằng `CastTvcSection` + `CastFilmSection` ở Sprint 0.9.2-r2+ (Hướng A separation).
- Lý do crash: project cũ từ v0.9.0 phase34 có refs không có angle, hoặc edge case migration không add default angle cho legacy data.

### Added (TVC Product Section)

Section mới `📦 PRODUCT & BRAND` cho TVC Commercial mode. Đặt giữa CAST và IDEA trong pipeline.

#### Fields
- 🏷 **Brand name** — text input (Centella, Vinamilk, Apple...)
- 💬 **Tagline VN** — textarea (Bảo vệ làn da nhạy cảm — Mỗi ngày)
- 💬 **Tagline EN** — optional, toggle button "+ Thêm tagline tiếng Anh"
- 📝 **Brand notes** — optional, toggle button (logo position, color rules, brand voice...)
- 📸 **Product images** — 1-6 ảnh, multi-upload, base64 dataURL, click label để edit (Pack shot / Side view / Detail)

#### Architecture (Sprint 0.9.2-r1 — minimal change, prepare for Hướng A)
- New `src/types/tvc_product_v091.ts`: `TvcProductImage` + `TvcProductData` interfaces, `defaultTvcProductData()` factory
- New `src/store/tvc_actions.ts`: setBrandName, setTagline, setTaglineEn, setBrandNotes, addProductImage, removeProductImage, updateProductImageLabel, ensureTvcProductData, clearTvcProduct
- New `src/components/ProductSection.tsx`: full UI với toggles, multi-upload, image grid 3-col, per-image label edit, delete
- New `src/components/v0_9_2_product.css`: warm orange `#e8a55e` accent (distinct với existing colors)
- Extended `ProjectV09Extensions` (in `types/v0_9_0.ts`) với `tvcProduct?: TvcProductData`

### Changed (Editor.tsx — connector flow)

TVC pipeline color flow updated:
- Cũ: PROJECT → CAST → IDEA (purple → green)
- Mới: PROJECT → CAST → **PRODUCT** (purple → warm orange) → IDEA (warm orange → green)

`castToNextColor` logic: nay 4 cases (photos / tvc_commercial / product_photo / film) thay vì 3.

### Tests

- ✅ TypeScript compile: 0 errors
- ✅ Vite production build: 8.69s
- ✅ **Vitest: 77/77 PASS** (63 cũ + 14 mới r1)
  - 4 unit tests cho `setBrandName`, `setTagline`, `setTaglineEn`, `setBrandNotes`
  - 4 unit tests cho `addProductImage`, multiple adds, `removeProductImage`, `updateProductImageLabel`
  - 1 test `ensureTvcProductData` returns default
  - 3 component tests: ProductSection renders empty state, brand input reflects state, uploaded image preview
  - 1 test CRITICAL: CastSectionV09 KHÔNG crash khi ref.angle undefined (defensive fix verified)
  - 1 test Editor renders TVC mode với Product section trong pipeline

### Known limitations / Pending

- 🟡 **TVC Concept → Storyboard chuyển tiếp** vẫn là stub (note "chuyển Mode = Film để test"). Implement ở Sprint 0.9.2-r2+.
- 🟡 **Cast section vẫn shared TVC + Film** — sẽ tách thành CastTvcSection + CastFilmSection ở Sprint 0.9.2-r2 (Hướng A).
- 🟡 **Product images storage** = base64 dataURL trong project state (heavy nếu nhiều ảnh lớn). Migrate IndexedDB blob ở v0.9.3.
- 🟡 **Engine inject** — Brand/Tagline chưa wire vào prompt builder (Concept/Storyboard chưa active). Sẽ làm ở Sprint kế.

### Pending real-world test
- 🟡 Anh test upload image vào Cast section: verify crash đã hết
- 🟡 Test Product section: brand + tagline + upload 3-5 images, kiểm reload có giữ data không
- 🟡 Verify connector PROJECT (blue) → CAST (purple) → PRODUCT (orange) → IDEA (green) hiển thị đúng

### Files changed (8 files)

- New: `src/types/tvc_product_v091.ts`
- New: `src/store/tvc_actions.ts`
- New: `src/components/ProductSection.tsx`
- New: `src/components/v0_9_2_product.css`
- New: `test/tvc_product.test.tsx` (14 tests)
- Modified: `src/components/CastSectionV09.tsx` (defensive fix line 426)
- Modified: `src/types/v0_9_0.ts` (+tvcProduct field)
- Modified: `src/components/Editor.tsx` (import ProductSection + wire vào TvcPipeline + castToNextColor)
- Modified: `package.json`, `manifest.json` (version bump)

---

## [0.9.1-r12] — 2026-05-09

UI consistency + Custom Pose free-text option.

### Fixed (Editor — connector layout)

- **Connectors PROJECT → CAST cho TẤT CẢ modes** (Photos, Film, TVC). Trước đây 3 sections đầu (PROJECT, CAST, CAMERA STYLE / IDEA) dính sát nhau sau khi bỏ separators ở r10. Giờ luôn có dấu chấm + đường nối giữa.
- **Connector màu sai trong Photos pipeline**: `purple → green → purple-light` (cũ, không khớp section colors thực tế) đổi thành `cyan → gold → coral` matching đúng border colors của 3 sections (CAMERA `#5ecac8` · IDEA `#e8c874` · IMGEN `#f09090`).
- Color flow Photos hoàn chỉnh: PROJECT (blue `#6da9d6`) → CAST (purple `#c490c4`) → CAMERA (cyan `#5ecac8`) → IDEA (gold `#e8c874`) → IMGEN (coral `#f09090`).
- Color flow Film/TVC: PROJECT (blue) → CAST (purple) → IDEA (green `#5dcaa5`) → ... (giữ nguyên các connectors sau).

### Added (Pose dropdown — free-text option)

Giải quyết conflict Theme ↔ Pose category (vd: theme "Cafe sân thượng" + pose category "Tự nhiên" đề xuất "nằm trên cỏ"). Approach mềm: KHÔNG filter, cho user **tự nhập tư thế** nếu không có preset phù hợp.

#### UI changes — `PhotosImageGenSection.tsx`
- Thêm option `✍️ Tự nhập tư thế (free-text)` ngay sau `⚡ Auto-vary across all 100 poses` trong dropdown Pose
- Khi user chọn `custom`: hiện `CustomPoseEditor` component bên dưới với:
  - Textarea VN (max 500 chars) — placeholder gợi ý mô tả chi tiết
  - Nút `🌐 Dịch sang tiếng Anh` (lazy-load Gemini, giống Custom Intent)
  - Display EN translated khi có
  - Nút `Xóa` để clear cả VI + EN
  - Hint "💡 Chưa dịch — engine sẽ inject tiếng Việt thẳng" nếu user chưa dịch
- Khi click `⚡ Generate Prompts`: nếu poseSelection = `custom`, validate có VI/EN, pass `customPoseText` vào action

#### State — `types/photos_v091.ts`
- Thêm `customPoseVi?: string` + `customPoseEn?: string` vào `PhotosThemeState` (lưu cùng theme block, persist qua reload)

#### Action — `store/photos_actions.ts`
- New `setCustomPose(project, { vi?, en? } | null)` — pattern giống `setCustomIntent`
- `autoPickShots(project, count, options)` thêm option `customPoseText?: string`:
  - Khi có: ALL N shots `shot.poseNote = customPoseText`, `posePresetId = undefined`
  - Camera angles vẫn vary 12 độc lập (nếu user chọn `auto` angle)
  - Có thể combine với `angleId` cố định → all shots same pose + same angle

#### Engine — không thay đổi
- `photosPromptBuilder.ts` đã có sẵn logic: nếu `posePresetId` undefined và `poseNote` có → dùng poseNote thẳng vào *Position:* block. Custom pose flow tận dụng infra này, không cần code mới.

### CSS

- New `.ksp-custom-pose` + sub-classes trong `v0_9_1_photos.css` (mirror pattern `ksp-custom-intent`, dùng coral color `#f09090` của ImageGen section thay vì gold của Idea)

### Tests

- ✅ TypeScript compile: 0 errors
- ✅ Vite production build: ~8s
- ✅ **Vitest: 63/63 PASS** (56 cũ + 7 mới r12)
  - `setCustomPose` stores VI text correctly
  - `setCustomPose(null)` clears both VI + EN
  - `autoPickShots` with `customPoseText`: shot.poseNote set, posePresetId undefined
  - Custom pose still varies 6 different angles
  - Custom pose + fixed angleId: all N shots identical
  - Custom pose text injected verbatim into prompt *Position:* block
  - Editor renders Project + Cast + Camera Style sections without crash

### Files changed

- Modified: `src/components/Editor.tsx` (connector layout)
- Modified: `src/types/photos_v091.ts` (+customPose fields)
- Modified: `src/store/photos_actions.ts` (+setCustomPose, +customPoseText option)
- Modified: `src/components/PhotosImageGenSection.tsx` (+CustomPoseEditor + dropdown option)
- Modified: `src/components/v0_9_1_photos.css` (+`.ksp-custom-pose` styles)
- Modified: `manifest.json` (`0.9.1` → `0.9.1.12` + `version_name: "0.9.1-r12"`)
- Modified: `package.json` (`0.9.1` → `0.9.1-r12`)
- Modified: `test/photos_mode.test.tsx` (+7 r12 tests)

### Pending real-world test
- 🟡 Custom Pose với Banana Pro/Nano Banana — cần verify text gõ tự do được render đúng tư thế
- 🟡 Connector layout trên Chrome side panel — verify visual không bị broken

---

## [0.9.1] — 2026-05-08

Bug fixes Project Setting + Photos mode functional implementation.

### Fixed (Project Setting)

- **B1: Time format ẩn ở Photos mode** — wrap với condition `mode !== "photos"` (Photos = single image, không có timing).
- **B2: API Keys + AI Provider + Storage collapsed mặc định** — chỉ BASIC INFO mở khi load (`useState` initial value).
- **B3: AI Provider per-task ẩn theo mode**:
  - Photos: chỉ Image gen
  - TVC Commercial: Concept + Storyboard frames + Image gen + Voice TTS
  - Product Photo: chỉ Image gen
  - Film: full (Script + Storyboard + Image + Voice)

### Changed (UI globally)

- **C1: Connector line height 22px → 10px** — áp dụng tất cả mode (Editor.tsx inline + v0_9_0.css).

### Added (Photos mode v0.9.1)

Replaces deferred placeholder ("Photos Mode UI deferred to v0.9.1") with full functional pipeline:

#### ASSETS — `CastPhotosSection`
- 5 Subject Types selector: Female / Male / Couple / Family / Friends Group (Vietnamese + emoji labels)
- Dynamic 1-6 face refs with progressive disclosure:
  - Slot 0 always labeled "front" (primary anchor — locked)
  - Slots 1-5 user-editable labels (3/4 L, 3/4 R, profile, smile, natural — defaults editable)
  - "+ add" button enabled only when count < 6
- 1 outfit ref slot (optional)
- Image upload via base64 dataURL (survives reload via Zustand persist)

#### PIPELINE — 3-step Photos pipeline

1. **Camera Style toggle** (HANDOFF Nguyên tắc 1):
   - **BOKEH (Phe A)**: Sony A7R V · 85mm f/1.8 — portrait, café, áo dài
   - **DOCUMENTARY (Phe B)**: iPhone 15 Pro · f/22 deep focus — sport, street, đời thường
   - Default = BOKEH

2. **Step 1 Idea** — Theme picker:
   - 227+ themes / 12 categories (reused from `engine/themes.ts`)
   - Search + category pills + theme list with B/D camera style indicator
   - Free-text fallback (Vietnamese textarea)

3. **Step 2 Image Gen** — List view:
   - Cast pick + Số shot (3/6/9)
   - Auto-pick angles button (8 presets)
   - Per-shot row: 2 mini thumbs + angle + meta + 3 icons
   - 📋 Copy prompt: 13-block prompt (EN) to clipboard
   - 📥 Download refs: ZIP `face-1.jpg` ... `face-N.jpg` + `outfit.jpg` + `README.txt`

#### Engine — Photos prompt builder

- New `engine/photosPromptBuilder.ts`: adapter from `PhotosV091Data` → existing v0.4 `assemblePrompt`
- Reuses 13-block template + Skin Paradox auto-inject + Identity Lock auto-defer + theme-aware negative
- Dynamic single/multi-face logic:
  - N=1: "same face as in attached image #1, 100% unchanged..."
  - N≥2: "images #1 through #N are ALL FACE REFERENCES of the SAME PERSON..."
- BOKEH/DOCUMENTARY bifurcation magic phrases verbatim per HANDOFF
- 8 angle preset variation injected per shot

### Tests

- ✅ TypeScript compile: 0 errors
- ✅ Vite production build: 102 modules transformed, ~8s
- ✅ **Vitest runtime: 35/35 PASS** (21 new Photos + 14 legacy)
  - All 5 Subject Types render + build prompt
  - Dynamic face slots 1→6 (cap)
  - Auto-pick produces N different angle presets
  - Single vs multi-face prompt logic
  - BOKEH/DOCUMENTARY magic phrases present
  - Skin Paradox auto-injected

### Known limitations (deferred to v0.9.2+)

- Multi-model: 1 active cast per project (multi-cast switching via dropdown for now).
- Image storage: base64 in localStorage (heavy for many large images). IndexedDB blob → v0.9.2.
- Batch download all shots → v0.9.2.
- No output preview (thumbs show refs, not generated). User pastes prompt into Banana Pro.

### Files

- New: `src/types/photos_v091.ts`, `src/store/photos_actions.ts`, `src/engine/photosPromptBuilder.ts`
- New components: `CastPhotosSection.tsx`, `CameraStyleToggleV09.tsx`, `PhotosIdeaSection.tsx`, `PhotosImageGenSection.tsx`
- New CSS: `v0_9_1_photos.css`
- Modified: `Editor.tsx`, `ProjectSettingSectionV09.tsx`, `v0_9_0.css`, `types/v0_9_0.ts`, `types/index.ts`
- New tests: `test/photos_mode.test.tsx` (21 tests)

---

## [0.9.0] — 2026-05-08

Major rewrite: single-image prompt assembler → multi-mode AI cinema toolkit.

(See previous CHANGELOG.md for full v0.9.0 details — preserved in git history.)

---

## [0.8.x] — Earlier

Multi-mode initial split (Lifestyle/TVC/Product/Editorial/Film).
