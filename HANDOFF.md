# KSP Image Chrome Extension — Handoff Document
## Status: `v0.9.3-qc24` shipped (Click-cell-direct + Video upload + Time format + Drag swap + Unified naming + Use Image picker)

**Last updated:** Friday, May 15, 2026 (afternoon — qc24 ship)

**Active version:** `v0.9.3-qc24` · **Tests:** 278/278 PASS + 12 skipped · TS clean · Build OK

---

## ✅ qc24 — UI/UX polish + Video per cell + Time format dropdown + Image promotion (SHIPPED)

7 features/fixes shipped:

1. **Click cell direct → Edit Modal** — bỏ ✏ icon, click cell anywhere mở modal
2. **Refs ZIP unified naming** — tất cả filename theo convention `shot-N.png` matching prompts
3. **Time format dropdown** — 4 options (decimal_seconds / timecode / integer_seconds / percentage), default `timecode` (universal cho Veo3/Kling/Grok)
4. **Upload Video per cell** — 🎬 button trong cell actions, video badge "▶", Animatic Player plays `<video>` thay vì `<img>`
5. **Drag-swap first/last frame panes** — HTML5 native drag, prompt update theo swap state
6. **Extract last frame from video** — option mới trong Advanced picker khi cell có video, browser-side canvas extraction
7. **Video/Image view toggle (left pane)** — khi cell có cả video + image, 2 icons góc trên-phải (🎬 / 🖼) để swap qua lại view mode

**Memory edits applied:**
- #5: NEVER write version markers trong UI strings (confirmed clean across modified files)

**Pacing/Emotional curve discussion:** Captured trong backlog section ở cuối file này. Sẽ tiếp tục thảo luận chat tiếp theo.

## ✅ qc23 — Animatic Player + Animation Prompt fix + UI polish (SHIPPED previous)

### NEW FEATURE — Animatic Player

Per-scene playback preview modal triggered từ "▶ Play Animatic" button cạnh ⚙ Advanced trong Storyboard scene header. Lướt qua tất cả shots trong scene với timing match shot.durationSeconds. Controls: play/pause/prev/next/end + speed (0.5×/1×/1.5×/2×) + timeline scrub + thumbnail strip. Hard cuts giữa shots, modal overlay, no audio (MVP). Empty cells → placeholder card.

### BUG FIX — Animation Prompt quality

Trước: prompt dùng `scene.actionLinesEn` (toàn scene) → AI confused, tried to animate all events trong 1 shot. Sau: prioritize `shot.actionEn` (per-shot action). Thêm CRITICAL "ONE SHOT, ONE BEAT" block + scene action chỉ làm background context grounding.

### UI POLISH

- Advanced toggle CSS overflow fix (label nowrap, checkbox fixed size, picker xuống dòng)
- Split preview 50/50 first-frame + last-frame khi Advanced enabled
- Animation Prompt label generic (bỏ provider name)

## ✅ qc22 — CxR convention + grid template + modal override + Edit Frame refactor (SHIPPED previous)

5 fixes/features cùng 1 sprint (Jason chốt "cùng lúc luôn"):

1. **UI consolidation**: Storyboard scene header gọn lại 1 dòng `4x2 · 16:9 · 7 shots · 1m20s`. Bỏ tất cả version text markers.
2. **ISSUE 1 — CxR convention**: `parseGridFormat("3x2")` giờ trả 3 cols × 2 rows (was 3 rows × 2 cols). Match industry storyboard convention.
3. **ISSUE 1B — Grid template image**: Banana Pro hay fill 3×3 ignoring prompt. Fix: provide blank labeled grid template PNG trong Refs ZIP làm visual reference structure.
4. **ISSUE 2 — Modal format override**: Crop preview modal có dropdown chọn format → user override khi AI tạo grid khác.
5. **ISSUE 3 — Edit Frame per-cell prompts**: Image Prompt giờ là per-cell single shot (not scene-grid). Plus Advanced first/last-frame mode (interpolation reference).

**Memory edit #5:** Tuyệt đối không ghi version markers trong UI strings.

## ✅ qc21 — Storyboard UI refactor (SHIPPED previous)

Refactor sprint 3/3 progressive. Storyboard UI giờ default hiển thị auto-picked grid format read-only. User chỉ thấy dropdown khi click "⚙ Advanced". Manual override hiển thị "↺ Reset to Auto" button.

**5 chốt Jason:** dropdown ẩn behind Advanced toggle · scene info trong header · inline dropdown · Reset button presence indicates manual · per-scene migration hint cho qc17 legacy.

## ✅ qc20 — Stage 4 Scenes Complexity Warning + Lock Fix (SHIPPED)

Refactor sprint 2/3 progressive. AI sinh Stage 4 scenes → estimate shot count → badge cảnh báo nếu > 9 (sweet spot). User 3 options: tách AI / giữ + grid lớn / hủy.

**Bonus fix (parallel qc18 Twist pattern):** `scriptScenesLocked` flag — required cho warning UI hoạt động (trước đó Stage 4 auto-skip giống bug Twist Stage 3 trước qc18).

**5 chốt Jason:** estimate hybrid heuristic · trigger inline Stage 4 · badge + collapsible · AI suggest split + user confirm · "giữ + grid lớn" = chỉ dismiss flag.

## ✅ qc19 — Hướng F-9 engine layer (SHIPPED previous)

Refactor sprint 1/3 (progressive) cho OPEN DISCUSSION #2 — Grid 1 vs Grid 2 consistency.

**Core principle:** AI Shot List sinh shot count theo narrative needs (sweet spot 4-9, hard cap 16). Storyboard tự pick grid format optimal từ shot count + aspect ratio. Single grid per scene cho 99% case → giải quyết root cause consistency drift (cùng 1 lần generate = không drift environment/secondary chars).

**Industry data 2026 backing decision:** ImagineArt AI Filmmaking Guide nói "8-15 scenes/film, one primary movement per shot" → avg 4-9 shots/scene khớp với intuition Jason.

**Mapping shot count → grid (engine `pickOptimalGridFormat`):**
- 0-4 → 2×2 · 5-6 → 3×2 (landscape) / 2×3 (vertical) · 7-8 → 4×2/2×4 · **9 → 3×3 (sweet spot)** · 10-12 → 4×3/3×4 · 13-16 → 4×4 · >16 → 4×4 capped (caller warns)

**Backward-compat:** Project qc17 cũ có `scene.gridFormat` đã chốt → preserve. Không migration Dexie.

Chi tiết technical: xem CHANGELOG.md.

---

## ✅ qc18 — Stage 3 Twists Hướng B (SHIPPED previous turn)

OPEN BUG #1 (Twist Stage 3 không pickable) đã FIX. Root cause confirmed: `isStageDone("twists")` advance ngay sau khi AI sinh xong → ActiveStage3 không render → user không thấy nút ✓/✗.

**Hướng B (Jason chốt):** Stage 3 chỉ "done" khi user click nút "Tiếp: ④ Phân cảnh →" — explicit lock via field `scriptTwistsLocked`. Click ✓/✗ trên twist card chỉ update `accepted` state, KHÔNG advance.

**Bài học vs qc18 attempt cũ (rollback):**
- KHÔNG đụng `runStage1Structure`, `FRAMEWORK_LABELS`, defensive lookups
- KHÔNG bonus fix — scope chỉ Stage 3 + lock state
- Mount tests verify chain render (cards visible) chứ không chỉ check button presence
- Backward-compat inline trong `isStageDone`, không migration mutate Dexie

Chi tiết implementation trong CHANGELOG.md.

---

## 💬 OPEN DISCUSSION #2 — Grid 1 vs Grid 2 consistency (qc19 NEXT)

### Triệu chứng (Jason báo May 14)

"Khi paste 2 prompt và tạo 2 lần ra không consistent cảnh và nhân vật."

Ví dụ project Robot:
- Cast có **Robot Bastion** với face/body refs → consistent giữa 2 grids (vì Banana Pro dùng refs)
- **Con chim** không có ref → khác hình giữa Grid 1 + Grid 2
- **Rừng cây** (background) không có ref → khác lighting, composition, tree style giữa Grid 1 + Grid 2

### Bản chất vấn đề

Option A pack (qc16 chọn) chia 11 shots → 2 grids riêng → user paste prompt + cast refs vào Banana Pro 2 lần → mỗi lần Banana Pro generate độc lập:
- ✅ Cast (có refs) → consistent
- ❌ Environment + secondary characters (chim, rừng, lighting, props) → variation giữa 2 lần generate

### Solutions đề xuất (cần Jason chốt)

**Option A — Style anchor first frame:**
1. Generate Grid 1 trước (9 shots) → output PNG
2. Crop frame 1 (key frame của Grid 1) ra
3. Khi generate Grid 2, paste cast refs + **frame 1 từ Grid 1** làm style anchor
4. Prompt thêm: "Match environment, lighting, secondary character (bird) style từ reference image #N"

Pros: Đơn giản, dùng feature có sẵn của Banana Pro (multi-image refs)
Cons: User phải làm 2-step manual (gen Grid 1 trước, rồi gen Grid 2 sau)

**Option B — Environment ref refs:**
1. User upload "env ref" (vài ảnh rừng cây ưng ý) + "secondary character ref" (chim) vào Cast section
2. Prompts auto include những refs này
3. Cast section thêm category "Environment" + "Secondary chars" (không phải Protagonist/Antagonist)

Pros: Schema sạch, tách environment khỏi character
Cons: Schema rewrite, user phải upload thêm refs

**Option C — Single mega-prompt cho toàn scene:**
- Bỏ multiple grids per scene
- Quay lại 1 grid duy nhất per scene, dynamic size theo shot count
- Vd: Scene 11 shots → grid 4×3 (12 cells, 1 empty) — không cần 2 grids riêng

Pros: 1 lần generate → 100% consistent (cùng image gen call)
Cons: Banana Pro / Imagen 4 có max output size — quá nhiều cells có thể downgrade quality per cell. Scene > 12 shots phải dùng 4×4 hoặc 5×3 (16 hoặc 15 cells)

**Option D — Inline style metadata từ Grid 1 vào Grid 2 prompt:**
- Sau khi user upload + crop Grid 1, tự động extract style metadata (color palette, lighting direction) → inject vào Grid 2 image prompt
- Prompt text only, không cần upload ref

Pros: Automated, không tốn user effort
Cons: Text mô tả style không bằng visual ref, vẫn drift

**Option E — Hybrid Option A + auto-attach (RECOMMENDED):**
- Khi Grid 2 image prompt được build, check nếu `scene.grids[0].gridImageDataUrl` đã tồn tại
- Thêm vào prompt: "Style consistent với reference image #N (key frame của Grid 1, attach below)"
- User vẫn paste cast refs như cũ → cộng thêm 1 frame của Grid 1 làm style anchor
- Auto-extract frame 1 từ Grid 1 cropped frames, gửi vào Refs ZIP của Grid 2

Pros: Tận dụng infrastructure đã có, user vẫn paste prompt + refs 1 lần (refs giờ có 1 frame Grid 1)
Cons: Cần update `buildSceneGridImagePrompt` + Refs ZIP logic

### Recommend Option E (Hybrid)

Hiệu quả nhất với effort thấp nhất. Chat mới nên propose Option E cho Jason confirm.

---

## 🎬 Vision Film mode hiện tại

### 6 cốt lõi (đã chốt từ session trước)

1. **Câu chuyện từ Idea + Cast nhất quán** — face/outfit refs shared toàn project
2. **Script đầy đủ** dialog/SFX/music notes (5-stage wizard Structure → Beats → Twists → Scenes → Dialogues)
3. **Storyboard quan sát các shot** với visual grid display
4. **Per-scene grids** — 1 phim ≈ 4-6 scenes × ~2-3 grids/scene tuỳ shot count
5. **Auto-crop + Bundle Export ZIP** — gói prompts + refs + grids
6. **User work external** — copy prompts vào Banana Pro/Seedance, tự ghép trong CapCut

### Pipeline 7 steps

1. **Project Setting** (mode/genre/aspect/duration/dialog/animationStyle/defaultVideoProvider qc17)
2. **Cast** (multi-character với face/body refs)
3. **Idea + Script Wizard** (5 stages — Stage 3 Twists Hướng B từ qc18)
4. **Shot List** per scene (qc10 — AI sinh shots với grid format constraint qc17)
5. **Storyboard** (qc16 — visual grids, Edit Frame Modal qc17)
6. **Voice + Music + SFX** (chưa rebuild post-qc16)
7. **Bundle Export ZIP** (chưa rebuild post-qc16)

---

## 📦 Trạng thái 4 modes hiện tại

| Mode | Status | Notes |
|---|---|---|
| 📸 **Photos** | ✅ LOCKED v0.9.1-r12 (49 tests xanh) | KHÔNG TOUCH |
| 🎬 **Film / Short Film** | 🟢 PRIMARY focus | qc18 latest, Grid consistency open |
| 🎬 **TVC Commercial** | 🟡 ARCHIVED | Ẩn dropdown từ v0.9.3-r1 |
| 📦 **Product Photo** | 🟡 ARCHIVED | Chưa từng build |

---

## 📋 Recent activity log (top = most recent, max 5 entries)

### Thursday, May 14, 2026 (evening) — qc18 SHIP: Stage 3 Twists Hướng B (explicit lock)

**Output:** `ksp-image-ext-v0_9_3-qc18-fix.zip` (patch) · 213/213 PASS + 12 skipped

**Files changed (4 source + 4 docs/meta):**
1. `src/types/film.ts` — thêm `scriptTwistsLocked?: boolean` (với docstring)
2. `src/store/film_actions.ts` — thêm `lockScriptTwists`, modify `setScriptTwists` (reset lock), `revertToStage` (clear lock), `clearStageData` (clear lock)
3. `src/components/FilmIdeaScriptSection.tsx` — modify `isStageDone("twists")` dùng lock + backward-compat, refactor `countCompletedStages`, modify nút "Tiếp: ④ Phân cảnh →" để chain `lockScriptTwists` + `setScriptStage`
4. `test/film_mode.test.tsx` — 9 tests qc18 (6 unit + 3 mount)
5. `package.json` `0.9.3-qc17` → `0.9.3-qc18`
6. `manifest.json` `0.9.3.24` → `0.9.3.25`
7. `CHANGELOG.md` — qc18 entry top
8. `HANDOFF.md` — close OPEN BUG #1

**Verify:**
- TS compile 0 errors
- Vite build 9.62s OK
- Vitest 213/213 PASS (baseline 204 + 9 mới, không break Stage 1/2/4/5)

**Backward-compat:** inline trong `isStageDone`, không migration Dexie. qc17 project có `scriptTwists` + downstream `scriptIntermediateScenes`/`script` → tự động treat Stage 3 done.

**Quy tắc theo Jason:** scope nhỏ, không bonus fix, có mount tests verify chain logic stepper (rút từ qc18 ATTEMPT ROLLED BACK).

### Thursday, May 14, 2026 (afternoon) — qc18 ATTEMPT ROLLED BACK (historical)

Session trước qc18 ship: phân tích bug → hypothesis `isStageDone(twists)` advance quá sớm → implement fix `.every(t => t.accepted !== undefined)` + bonus framework validation + defensive lookups → ship → Jason test "lỗi nhiều hơn" → ROLLBACK về qc17 baseline.

**Lessons learned (đã apply ở qc18 ship):**
- Không vội ship fix khi chưa có Jason confirm reproduction steps
- Cần screenshot/console errors trước khi propose fix
- Test render chỉ check button exists, không check chain logic stage stepper
- Fix attempt có thể break stages khác (Stage 4/5 navigation)
- Scope nhỏ, không bonus fix

### Thursday, May 14, 2026 (afternoon) — qc17 SHIP: Edit Frame Modal + Grid-aware AI + Provider durations

**Output:** `ksp-image-ext-v0_9_3-qc17.zip` — 552 KB, 204/204 PASS + 12 skipped

**Features shipped:**
1. **Edit Frame Modal** (`FilmFrameEditModal.tsx` ~440 lines): preview + 7 editable fields + Image Prompt collapsible (scene-level read-only) + Animation Prompt collapsible (per-shot) + 4 footer actions (Regen stub / Upload replace / Copy with auto-clamp dialog / Save)
2. **Grid-aware Shot List AI** (`engine/filmShotListGeneration.ts`): AI sinh shot count = multiple of grid cells (9, 18, 27 cho 3x3)
3. **Provider-aware durations** Hướng D (`engine/providerDurations.ts`): 5 providers spec hard-coded, Shot List AI use supported durations, Edit Modal validate + clamp on copy

---

## 🚦 Sprint roadmap (next)

### ✅ DONE — qc19 + qc20 + qc21 + qc22 (Hướng F-9 full stack + convention fix + per-cell prompts)

- qc19: engine auto-pick grid format
- qc20: Stage 4 wizard complexity warning + lock fix
- qc21: Storyboard UI Advanced toggle
- qc22: CxR convention + grid template + modal format override + Edit Frame per-cell prompts

### ⏳ NEXT — qc23 Nano Banana single-frame regen API

**Reference:** qc22c đã wire Edit Frame Modal với per-cell single-shot Image Prompt. qc23 sẽ wire Nano Banana API call để regen 1 cell trực tiếp từ modal (thay vì user copy prompt manually).

### ⏳ qc23+ — Rebuild Voice / Music+SFX / Bundle Export sections

Post-qc16 paradigm shift, 3 sections này chưa rebuild theo scene.grids[] schema mới.

---

## 🚦 Pending decisions còn open

| # | Question | Status | Discussion |
|---|---|---|---|
| qc19-Q1 | Grid consistency approach | 🔴 NEEDS JASON DECISION | Options A/B/C/D/E proposed |

---

## 🔑 API endpoints reference

```
Gemini Flash:    https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
Gemini Pro:      https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent
Imagen 4 Std:    https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict
Nano Banana:     https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent
Nano Banana Pro: https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-image:generateContent
OpenAI 4o:       https://api.openai.com/v1/chat/completions (model: "gpt-4o")
ElevenLabs:      https://api.elevenlabs.io/v1/...
```

Video AI providers (qc17 verified):

| Provider | Pricing/sec | Max duration | Char limit | Supported durations |
|---|---|---|---|---|
| Seedance 2.0 Pro | $0.15/s | 15s | 4000 | 4-15s flexible |
| Veo 3 | $0.30/s | 8s | 2500 | 8s only (fixed) |
| Kling 2.0 | $0.10/s | 10s | 2500 | 5s / 10s |
| Sora | $0.50/s | 20s | 4000 | 5/10/20s |
| Grok Imagine | $0.20/s | 10s | 3000 | 6s / 10s |

---

## 🔒 Architecture Locks (qc16+, DO NOT REVISIT without discuss)

### qc21 locks (NEW)
- **Storyboard UI auto-pick default**: SceneBlock UI default hiển thị read-only `"N shots → format (auto)"` info trong scene-info row. Dropdown ẩn behind `⚙ Advanced` toggle.
- **`scene.gridFormatManual` semantic**: `undefined` = legacy qc17 project, `false` = explicit qc21 auto-pick, `true` = user manual override. Distinguish 3 cases trong UI rendering.
- **Migration hint per-scene only**: qc17 legacy scene (gridFormatManual undefined) chỉ hiện hint khi `gridFormat ≠ optimalFormat`. Match = silent preservation.
- **Reset to Auto idempotent**: `resetSceneGridFormatToAuto` action — clear flag + re-pick optimal format + preserve cropped frames where shotIds match.

### qc20 locks (NEW)
- **Scene complexity estimator**: `estimateSceneShotCount = max(ceil(duration/8), sentence_count, MIN_FLOOR=3)`. Pure heuristic, no AI call. Caller checks against `SHOT_COUNT_SWEET_SPOT=9` / `SHOT_COUNT_HARD_CAP=16` from qc19.
- **Stage 4 explicit lock**: `scriptScenesLocked?: boolean` parallel với qc18 `scriptTwistsLocked`. Stage done chỉ khi `=== true`. Set via `lockScriptScenes` action (called when user click "Tiếp: ⑤ Lời thoại →"). Reset trên AI regen + revert upstream.
- **Backward-compat qc19 projects**: inline check trong `isStageDone("scenes")` — `scriptIntermediateScenes` defined + `script` defined → tự done (không cần migration Dexie).
- **AI split suggestion 2-way only**: `runSplitSceneSuggestion` returns EXACTLY 2 sub-scenes. Defensive throw nếu AI return khác. Beat preservation guaranteed (sum of sub-beatIds = orig.beatIds).
- **Dismiss is local flag, not data change**: `dismissSceneComplexityWarning` chỉ set `complexityWarningDismissed = true`. Scene data + Storyboard auto-pick handle grid lớn (qc19 mapping).

### qc19 locks
- **Hướng F-9 auto-adapt grid format**: Storyboard `pickOptimalGridFormat(shotCount, aspectRatio)` — single source of truth. Mapping table cố định: 0-4→2×2, 5-6→3×2/2×3, 7-8→4×2/2×4, 9→3×3 sweet spot, 10-12→4×3/3×4, 13-16→4×4, >16→4×4 capped.
- **Sweet spot 9 shots/scene + hard cap 16**: `SHOT_COUNT_SWEET_SPOT = 9`, `SHOT_COUNT_HARD_CAP = 16` constants. Stage 4 wizard warn khi > 9 (qc20).
- **AI Shot List narrative-driven**: filmShotListGeneration KHÔNG inject grid constraint vào AI prompt. AI sinh theo narrative needs. gridFormat param trong type giữ cho backward-compat nhưng không dùng trong prompt logic.
- **SceneGridFormat 9 values**: `"2x2" | "2x3" | "3x2" | "2x4" | "4x2" | "3x3" | "4x3" | "3x4" | "4x4"`. Symmetric formats (3×3, 4×4) ignore orientation. Vertical aspects (9:16, 4:5) get taller grids.
- **gridFormat sticky once resolved**: `ensureSceneGrids` persist resolved format vào `scene.gridFormat` — không re-evaluate trên repack (preserve predictability). User override via `setSceneGridFormat` action.

### qc18 locks
- **Stage 3 Twists explicit lock**: `scriptTwistsLocked?: boolean` field. Stage done chỉ khi `=== true`. Set via `lockScriptTwists` action, reset trên AI regen + revert upstream. Click ✓/✗ inline KHÔNG đổi lock.
- **Backward-compat qc17 projects**: inline check trong `isStageDone` — `scriptTwists` defined + downstream stage có data → tự done (không cần migration Dexie).
- **Hướng B confirmed**: Stage 3 KHÔNG auto-advance khi AI sinh xong twists. User PHẢI click "Tiếp: ④ Phân cảnh →" để lock.

### qc17 locks
- **Edit Frame Modal**: preview + 7 editable fields + 2 prompt collapsibles + 4 footer actions
- **Image Prompt scene-level (read-only trong modal)**: edit ở Storyboard section, không edit trong modal
- **Animation Prompt per-shot với provider selector**: char count + auto-clamp dialog on copy
- **Grid-aware Shot List AI**: AI prompt include grid constraint, sanitizeShot post-clamps duration
- **Provider durations Hướng D**: 5 providers spec hard-coded trong `providerDurations.ts`
- **Default Video Provider per project**: Project Setting field, default `seedance-2-pro`
- **Per-shot videoProviderId override**: vẫn giữ trong schema cũ (qc11), user pick trong Edit Modal

### qc16 locks
- **Scene-level grids**: `scene.grids: SceneGrid[]`, mỗi cell = 1 shot snapshot
- **Option A pack**: fixed grid format per scene, multiple grids nếu shots > cells, empty cells OK
- **4 per-cell action buttons**: Lock 🔒/🔓, Regen 🔄, Download 📥, Edit ✏
- **Migration A**: drop old per-shot grid data on load (idempotent marker)
- **Aspect ratio per cell**: match `setting.aspectRatio` (16:9 landscape, 9:16 vertical, 1:1 square, 4:3)

### v0.9.1 locks (Photos mode — KHÔNG TOUCH)
- Sidebar 380px vertical
- AI prompts EN
- Versioning last-10 revert
- Camera Style BOKEH/DOCUMENTARY toggle
- Photos Cast: 5 Subject Types
- Image Gen list view (KHÔNG grid)

---

## 🚨 DESTRUCTIVE OPERATIONS — RULE NGHIÊM NGẶT

TRƯỚC khi đề xuất destructive command (rm -rf, rm -r, find ... -delete, git clean -fd, git reset --hard):
1. Verify Jason đã commit Git ở trạng thái sạch
2. Giải thích RÕ file/folder nào sẽ bị xóa
3. Đợi Jason confirm "OK xóa" mới đưa lệnh

CẤM TUYỆT ĐỐI: `rm -rf ~/Downloads/ksp-image-ext` (toàn bộ source).

---

## 🧪 Test workflow Film mode (qc18 latest)
1. Project Setting → Mode = Film + dialog mode + animation style + aspect + duration + default video provider
2. Cast → tạo characters với face/body refs
3. **Idea + Script → 5-stage wizard:**
   - Stage 1 Structure → AI chọn framework → tự done
   - Stage 2 Beats → AI sinh + edit inline → tự done khi có beats
   - **Stage 3 Twists (qc18 Hướng B): AI sinh twists → cards hiện ra với ✓/✗ → user click chọn → click "Tiếp: ④ Phân cảnh →" mới done**
   - Stage 4 Scenes → AI sinh → click "Tiếp: ⑤ Lời thoại →" → done
   - Stage 5 Dialogues → AI viết → done
4. Shot List → AI sinh shots per scene (grid-aware qc17)
5. Storyboard → expand scene → set grid format → AI sinh image prompt → copy → paste Banana Pro → upload grid → crop modal → cells fill
6. Click ✏ trên cell → Edit Frame Modal mở → edit + copy animation prompt → save

---

## 🎁 Other parallel projects (cùng ecosystem)

- **KSP AutoFlow** (Chrome extension v4→v5 refactor for AI filmmaking automation)
- **KSP Studio** (web app cho film production)
- **LinguTab** (Chrome extension cho Vietnamese learners của Chinese/English)

---

## 📌 Current memory edits (Jason preferences)

- Vietnamese-first communication, address as "Jason"
- Workflow: 5-10 client revisions/tuần cho storyboards
- Prefer 1-line update commands
- Prefer ZIP output via `present_files`
- Confirm trước khi code feature lớn
- Discuss design trước khi build (Hướng A/B/C/D format)
- **Phải self-test runtime với vitest trước khi ship**
- **KHÔNG vội ship fix khi chưa có Jason confirm root cause (lesson qc18 attempt)**

---

## 📝 Câu hỏi gợi ý cho chat mới

```
Đây là KSP Image Chrome extension v0.9.3-qc18 (213/213 tests PASS) → 
đang phát triển Mode Film paradigm scene-level grids.

Đọc 3 file Project Knowledge trước:
- HANDOFF.md (vision + roadmap + Activity log + Architecture locks)
- CHANGELOG.md (trạng thái code per qc sprint)
- MOCKUPS_FILM.md (design spec)

Status: Stage 3 Twists bug đã FIX qc18 (Hướng B explicit lock). 
Next: qc19 Grid 1 vs Grid 2 consistency (Options A-E, Jason recommend E).
```

---

## 🗺 File paths reference

- **Source code:** `~/Downloads/ksp-image-ext/`
- **Distribution zips:** `~/Downloads/ksp-image-ext-v*.zip`
- **GitHub:** https://github.com/hoangdungksp/KSP_Image_Prompt
- **Active branch:** `main`
- **Save point tag:** `v0.9.1-r12` (Photos mode complete — KHÔNG TOUCH)
- **Latest stable ship:** `v0.9.3-qc24` (May 15, 2026)

---

## 🔮 BACKLOG DISCUSSION — Pacing & Emotional Curve (chat tiếp theo)

**Trạng thái:** Jason raised question May 15, 2026. Discussion captured. **KHÔNG CODE** — chat tiếp theo discuss + chốt design rồi mới implement.

### Câu hỏi Jason đặt ra

> "Làm sao để biết nhịp video và quản lý nhịp phim? Ví dụ mình muốn thấy đoạn cao trào như thế nào? Có lấy được nước mắt người xem, có khiến người xem tức giận hoặc hồi hộp không thì làm sao? Thêm đoạn thấy nhịp phim và tôi có thể tuỳ chỉnh để kịch bản thêm hay hơn thì ở đâu?"

### Vấn đề core

App hiện quản lý **mechanical layer** rất kỹ (structure → beats → twists → scenes → shots → grids → frames) nhưng **emotional layer / pacing layer** TRỐNG hoàn toàn:
- Stage 4 Scenes có `durationSeconds` (vật lý) — KHÔNG có metadata về cường độ cảm xúc
- Stage 5 Dialogues có lời thoại — không annotation "đây là beat khóc / căng / giải tỏa"
- Storyboard + Animatic Player chỉ cho thấy "cái gì đang xảy ra", không cho thấy "đường cong cảm xúc xuyên suốt phim"
- Không có chỗ Jason **drag-fix** pacing nếu thấy đoạn nào chùng

### Industry practices reference

1. **Beat sheet với emotion notation**
   - Blake Snyder "Save the Cat" 15 beats — mỗi beat có emotional pulse expected (vd "All Is Lost" = nỗi tuyệt vọng đáy ngay trước climax)
   - Hero's Journey: "Ordeal" + "Resurrection" là 2 climax peaks
   - Stage 1 app đã pick framework — nhưng chưa dùng emotional intel của framework đó

2. **Tension curve graph** — Y=tension 0-10, X=scene index. Phim tốt có curve rising với 1-2 peak (midpoint + climax), không phẳng/zigzag chaos. Pixar dùng tool nội bộ vẽ curve này.

3. **Emotional valence map** — mỗi scene có 1-2 emotion target ("tender", "tense", "funny", "sad", "shocking", "triumphant", "melancholy"). Đặt cạnh nhau biết có emotional whiplash không.

4. **Climax effectiveness checklist:**
   - Setup payoff — climax có giải quyết conflict đã setup không?
   - Stakes escalation — đến climax stakes đã max chưa?
   - Character arc — protagonist có thay đổi không?
   - Emotional catharsis — có khoảnh khắc release cho audience không?
   - Surprise + inevitability — vừa bất ngờ vừa logical (Aristotle's rule)

### 6 hướng feature đề xuất

#### Hướng A — Emotional + Tension annotations cho Scene (foundation)
Backend: Scene + Shot có 2 fields mới:
- `tensionLevel: 0-10` (0 quiet, 10 peak)
- `emotionalTone: "tender" | "tense" | "funny" | "sad" | "shocking" | "triumphant" | "melancholy" | "neutral"`

AI auto-fill khi Stage 4 sinh scenes. User edit được.

**Effort:** Small (1 sprint). PREREQUISITE cho 5 hướng còn lại.

#### Hướng B — Pacing Dashboard (toàn film view)
Section mới sau Storyboard. 1 panel duy nhất hiển thị toàn film:
- Tension curve graph (Y=tension, X=scene number, mỗi điểm scale theo duration)
- Emotional tone strip (color-coded blocks per scene)
- Beat coverage (Save the Cat / 3-Act / Hero's Journey) — ✓ / ⚠ / ✗ markers
- Auto-hint khi detect anomaly (vd "Climax tension chỉ 7/10")

**Effort:** Medium (1 sprint sau Hướng A).

#### Hướng C — AI Pacing Review
Button "🎭 Run Pacing Review" → AI phân tích toàn film, output:
- ✓ Strengths (good pacing decisions)
- ⚠ Concerns (problem areas with specifics)
- Climax effectiveness checklist (5 items)
- Suggested rewrites cho scenes cần improve

**Effort:** Medium-Large (1 sprint, tốn AI call lớn).

#### Hướng D — Editable Tension Curve
User drag điểm trên curve để target tension mới → AI suggest rewrite scene hit target. Bao gồm action mới, camera change suggestion, duration adjust.

**Effort:** Large.

#### Hướng E — Emotional Beat Annotations trong Stage 5 Dialogues
Mỗi dialog line + SFX có icon emotion + intensity. AI dùng khi generate voice (TTS) → pick tone giọng đúng.

**Effort:** Small (data annotation, ít UI).

#### Hướng F — Full Film Animatic với emotion overlay
Extend Animatic Player từ per-scene → toàn phim. Có emotion strip dưới hiển thị real-time tension + emotional tone đang chạy.

**Effort:** Medium-Large (build trên qc23 Animatic Player).

### Câu trả lời ngắn cho 3 câu hỏi của Jason

| Câu hỏi | Hướng giải |
|---|---|
| Làm sao biết nhịp video? | **A + B** — annotate tension/emotion, visualize trên Dashboard |
| Làm sao biết climax có lấy được nước mắt? | **C** — AI Pacing Review với checklist + suggestions |
| Tùy chỉnh kịch bản hay hơn ở đâu? | **D** — drag curve target tension, AI suggest rewrite |

### Phased approach đề xuất (4 sprints)

**Phase 1 (foundation) — Hướng A + E:**
- Add tensionLevel + emotionalTone fields cho Scene + Shot + Dialog
- AI auto-fill khi Stage 4 + 5 generate
- User edit inline
- Không UI mới phức tạp

**Phase 2 (visualization) — Hướng B:**
- Pacing Dashboard read-only
- Tension curve + emotion strip + beat coverage
- "View only" mode

**Phase 3 (analysis) — Hướng C:**
- AI Pacing Review button
- Output strengths/concerns/checklist/suggestions
- User đọc → manual edit

**Phase 4 (advanced) — Hướng D + F:**
- Editable curve drag-to-target + AI rewrite
- Full Film Animatic with emotion overlay

### 5 câu hỏi cần Jason chốt chat tiếp theo

**Q1 — Phasing:** 4 phases OK, hay ship 1 phase lớn duy nhất?

**Q2 — Phase 1 scope:** Phase 1 (Hướng A + E) ship riêng làm utility, ngay cả khi Phase 2 chưa có. Bắt đầu Phase 1 trước OK?

**Q3 — Phase 1 details:**
- `emotionalTone` enum: 8 values (tender, tense, funny, sad, shocking, triumphant, melancholy, neutral). Add/remove?
- `tensionLevel` scale: 0-10 hay 1-5?
- AI auto-fill: Stage 4 tự fill, OR user bấm button "AI annotate emotions" riêng?

**Q4 — Dashboard placement:** Section mới giữa Stage 5 và Storyboard? Tab toggle trong Storyboard? Floating button?

**Q5 — Climax detection:** AI tự biết climax through framework (Save the Cat → beat #11; Hero's Journey → "Ordeal")? Hay user manually mark scene nào là climax?

### Recommend defaults (em đề xuất nếu Jason want quick start)

- Q1: 4 phases (Phase 1 ship trước)
- Q2: YES Phase 1 standalone
- Q3: 8 values, scale 0-10, AI auto-fill khi Stage 4 generate
- Q4: Section mới giữa Stage 5 và Storyboard
- Q5: AI infer từ framework, user override được

---

End of handoff. Chat mới có thể bắt đầu ngay với context này.
