# KSP Image Chrome Extension — Handoff Document
## Status: v0.9.3-r4 shipped → ready cho Sprint 0.9.3-r5 (Mockup 4 Shot Detail)

**Last updated:** Monday, May 11, 2026 (evening — after r4 ship)

**Active version:** `v0.9.3-r4` · **Tests:** 76/76 PASS (49 Photos + 14 Film + 8 components + 5 Editor)

---

## 🚨 BIG DECISION (May 10, 2026)

Jason đã quyết định **BỎ TOÀN BỘ Mode TVC**. Không phát triển tiếp.

**Lý do:**
- UX Concept section quá phức tạp, user thực tế không dùng (8 fields treatment overhead).
- Phân biệt Tagline (Brand) vs Logline (Concept) gây confusing.
- 7-step pipeline TVC chồng chéo với Film pipeline — duplicate effort.
- Film/Short Film là use case Jason ưu tiên thực sự (5-10 client revisions/tuần).

**Trạng thái code TVC:**
- v0.9.3-r1 đã XOÁ code TVC archived: `ProductSection.tsx`, `TvcConceptSection.tsx`, `tvc_actions.ts`, `types/tvc_product_v091.ts`, `v0_9_2_product.css`, `test/tvc_product.test.tsx` — tổng 6 files Nhóm 1.
- TVC + Product modes vẫn còn enum trong `ProjectModeV2` (giữ schema cho backward compat), nhưng đã ẩn khỏi Mode dropdown trong ProjectSettingSectionV09.
- Nếu user mở project TVC/Product cũ → render `ArchivedModePlaceholder` với note "tạm gác lại — chuyển sang Photos/Film".

**Focus mới:** Film / Short Film mode — Sprint 0.9.3 trở đi.

---

## 🎬 FILM MODE VISION (May 10, 2026 afternoon late — clarified via 5 mockups)

Jason đã ship **6 cốt lõi + 5 mockup HTML** — vision sạch nhất cho Film mode từ trước tới giờ. Vision này thay thế mọi thảo luận Film trước đó từ v0.8/v0.9.0/v0.9.1.

### Triết lý
> *"Câu chuyện trước, hình ảnh sau. Cast nhất quán toàn project. Mỗi shot có grid riêng (KHÔNG phải 1 grid cho cả phim như TVC). Script là source of truth feed cho Storyboard + SFX + Music."*

Insight quan trọng nhất từ Mockup 2 footer: **"Script feed: Storyboard (action lines → frames) · SFX list · Music briefs"** → Script là 1 nguồn duy nhất, AI tự derive ra Storyboard + SFX + Music. User không nhập 3 lần.

### 6 cốt lõi Film mode (Jason confirm verbatim)

1. **Tạo câu chuyện tốt từ Ý tưởng ban đầu — Cast nhất quán**: face + outfit refs shared toàn project, mọi shot dùng cùng refs. Cast = các nhân vật + trang phục, được user upload HOẶC AI generate (Imagen 4) HOẶC tạo ra từ description bằng prompt.
2. **Script đầy đủ dialog/SFX/music notes** — AI tạo từ Idea. User chọn Gemini hoặc ChatGPT để compare quality (dual-provider toggle).
3. **Storyboard quan sát các shot** — click vào shot mở drill-down xem grid.
4. **Nhiều grids per-shot** — 1 phim 15 phút ≈ 12 shots = 12 grids riêng (KHÔNG phải 1 grid). Grid size linh hoạt 2×2/2×3/3×3/4×3 phù hợp độ chi tiết của shot.
5. **Auto-crop + Bundle Export ZIP** — gói tất cả prompts + ảnh + cast refs + music briefs + sfx list theo cấu trúc folder rõ ràng (Mockup 5).
6. **User work external** — copy prompts + ảnh ra Banana Pro/Seedance, tự ghép trong CapCut. Extension KHÔNG generate AI.

### 5 Mockup reference (Jason ship May 10 afternoon late, Claude render visualizer)

| Mockup | Nội dung | Map vào pipeline |
|---|---|---|
| **M1** Project Setting + Cast | Project name + Mode/Genre/Dialog(toggle có/không thoại)/AnimationStyle/AspectRatio/Duration(phút)/AIProvider + Cast multi-character cards với face/body refs + AI Generate button | Step 0 (setup) |
| **M2** Idea + AI Multi-stage Script | Idea textarea + Script section orange với 5-stage breadcrumb (Structure → Beats → Twists → Scenes → Dialogues) + scenes có SFX/MUSIC/TRANSITION embedded inline + Variation/Versions/AddScene/ExportPDF | Step 1-2 |
| **M3** Storyboard | 4 scenes × 11 shots × ~95 frames, mỗi shot có grid size khác nhau (2×2 insert, 3×3 default, 4×3 action), 4 status indicators (✓rendered / ⚙rendering / ○pending / 🔒locked) | Step 3 |
| **M4** Shot Detail Panel | Image Gen block (grid format picker + AI-generated prompt EN + Copy → Banana Pro + auto-crop grid PNG → N frames + replace single frame) + Video AI block (provider dropdown với 4 default Seedance/Veo3/Kling/Sora + "+ Add custom provider" cho Grok et al + AI-generated animation prompt + char count + Copy → Seedance) | Step 4-5 |
| **M5** Voice + Music + SFX + Bundle Export | Voice context-aware (Skip nếu không thoại / Add Narrator) + ElevenLabs/Google TTS provider + Music per-scene briefs (Hans Zimmer "Time" style references) + SFX per-scene list + ZIP folder structure | Step 6-7-Export |

### Multi-stage Script Pipeline (M2 deep dive — 5 stages, Q2 đã chốt approach (d))

Khi user click "AI viết Script từ idea", AI KHÔNG generate 1 cú mà chia thành 5 stages, user review/edit giữa mỗi stage:

1. **Stage 1 Structure** — AI chọn khung kể chuyện (default 3-act; advanced: Hero's Journey, Save the Cat 15 beats, Kishōtenketsu). Chỉ chọn framework, chưa có content.
2. **Stage 2 Beats** — AI điền 7-9 narrative milestones theo structure đã chọn (Opening Image, Inciting Incident, First Plot Point, Midpoint, Climax, Final Image...). User edit description từng beat. **Đây là chỗ user "đọc sơ được cốt truyện".**
3. **Stage 3 Twists** — AI scan beats + suggest 1-3 twist points để câu chuyện hấp dẫn hơn. Mỗi twist gắn vào 1 beat. User accept/reject/edit từng twist. **Đây là chỗ user "thấy những chỗ có twist hấp dẫn".**
4. **Stage 4 Scenes** — AI gộp beats + twists thành scenes cụ thể có setting + action prose + duration estimate. Mỗi scene chứa 1-3 beats.
5. **Stage 5 Dialogues + SFX + Music + Transition** — AI fill chi tiết per-scene: dialog (nếu Project Setting = "Có thoại"), SFX list, music brief, transition giữa scenes.

User có thể **rewind** về bất kỳ stage trước → regen downstream. Cost: ~5 AI calls per script (vs 1 monster call) nhưng quality vượt trội. Implementation tách 2 phase: r3 ship Stage 5 quick path, r7 add Stage 1-4 wizard.

### Bundle Export ZIP structure (Mockup 5 verbatim)

```
{project-slug}-bundle.zip
├── README.md (workflow guide)
├── script.pdf (kịch bản đầy đủ N scenes)
├── cast/
│   ├── {character}_face_01.png · 02 · 03
│   └── {character}_body_01.png · 02
├── shots/
│   └── scene{N}_shot{M}_{type}/
│       ├── grid_{NxM}.png
│       ├── cropped/01.png ... 0N.png
│       ├── image_prompt.txt
│       └── animation_prompt_seedance.txt
├── voice/ (empty if no dialog)
├── music/
│   ├── scene{N}_brief.txt
│   └── full_score_arc.txt
└── sfx/
    ├── sfx_list_per_scene.md
    └── freesound_links.txt
```

### Approach build: Film tách riêng pattern Photos (Jason confirm May 10 late)

Jason đã quyết định: **rebuild Film hoàn toàn tách riêng, KHÔNG patch code Film cũ**. Apply pattern Photos đã làm thành công ở v0.9.1:

| Photos pattern (đã làm) | Film mới (sẽ làm Sprint 0.9.3-r2 trở đi) |
|---|---|
| `types/photos_v091.ts` | `types/film_v093.ts` |
| `store/photos_actions.ts` | `store/film_actions.ts` |
| `engine/photosPromptBuilder.ts` | `engine/filmScriptStages.ts` + `engine/filmShotPromptBuilder.ts` + `engine/filmBundleExporter.ts` |
| `components/CastPhotosSection.tsx` | `components/CastFilmSection.tsx` |
| `components/PhotosIdeaSection.tsx` | `components/FilmIdeaScriptSection.tsx` |
| `components/PhotosImageGenSection.tsx` | `components/FilmStoryboardSection.tsx` + `FilmShotDetailPanel.tsx` + `FilmVoiceSection.tsx` + `FilmMusicSfxSection.tsx` + `FilmBundleExportSection.tsx` |
| `styles/v0_9_1_photos.css` | `styles/v0_9_3_film.css` |
| `test/photos_mode.test.tsx` | `test/film_mode.test.tsx` |

---

## 🎯 Quick Context cho Claude mới

Tôi là **Jason** (Vietnamese, prefer "Jason" in EN). Đang phát triển Chrome extension **KSP Image** để generate AI prompts cho Banana Pro / Nano Banana / video AI tools (Seedance, Veo3, Kling, Sora, Grok Video).

**Stack:** React 18 + TypeScript 5.7 + Vite 5 + Zustand 5 + Dexie 4 + Tailwind 3.4 + JSZip + CRXJS
**Source:** `~/Downloads/ksp-image-ext/` (Mac)
**Update command:** `bash ~/Downloads/ksp-image-ext/update.sh`
**GitHub:** https://github.com/hoangdungksp/KSP_Image_Prompt (private)
**Active branch:** `main` (Sprint 0.9.3-r1 pushed)
**Save points:** tag `v0.9.1-r12` (Photos locked) + tag `v0.9.3-r1` (foundation cleanup ship) sẽ tag sau khi r1 stable

**Workflow preference:**
- Communicate trong tiếng Việt, English code/comment OK
- Confirm trước khi code feature lớn
- Discuss design trước khi build feature mới (Hướng A/B/C/D format)
- Self-test runtime với vitest TRƯỚC khi ship (TSC + build pass KHÔNG ĐỦ)
- Output ZIP from inside project folder (no parent nesting)
- Khi ≤3 files thay đổi → output từng file riêng
- Format minimal: ít bullet, ít heading lồng nhau, ít emoji

---

## 📦 Trạng thái 4 modes hiện tại

| Mode | Status | Sprint focus |
|---|---|---|
| 📸 **Photos** | ✅ LOCKED v0.9.1-r12 trên `main` (49 tests PASS) | KHÔNG TOUCH |
| 🎬 **Film / Short Film** | 🟢 PRIMARY focus từ v0.9.3-r2+ | Sprint 0.9.3-r2 next |
| 🎬 **TVC Commercial** | 🟡 ARCHIVED — code xoá r1, mode ẩn dropdown, có thể quay lại post-v1.0 | (parked) |
| 📦 **Product Photo** | 🟡 ARCHIVED — chưa bao giờ build, mode ẩn dropdown | (parked) |

---

## 📋 Recent activity log (top = most recent, max 5 entries)

### Monday, May 11, 2026 (evening) — Sprint 0.9.3-r4 SHIP: Mockup 3 Storyboard + UI polish batch 2

**Session goal:** Ship Mockup 3 (Storyboard) + apply UI polish feedback batch 2 from r3.1 test.

**What happened:**
1. UI polish batch 2 fix: Dialog → dropdown (thay segmented); Aspect Ratio labels rút gọn (bỏ "(TikTok/Reels)" etc., chỉ giữ "16:9 landscape" / "9:16 vertical"...); Cast cards bỏ avatar circle hoàn toàn + bỏ background + border-radius (separator subtle line giữa cards); Idea+Script section outer padding 0 (inner blocks self-padded 12px).
2. r4 build: `FilmStoryboardSection.tsx` (280 lines) — Scenes×Shots hierarchy purple border. Per-scene collapsible card với shot rows. Each shot: title + grid format dropdown (5 options) + shot type dropdown (7 options) + status badge (4 states).
3. 4 status badges spec colors: rendered green `#EAF3DE/#3B6D11`, rendering orange `#FAEEDA/#854F0B`, pending gray `#2a2a2a/#888`, locked blue `#E6F1FB/#0C447C`.
4. 6 shot actions: `addShot / updateShot / removeShot / setShotStatus / toggleShotLocked / getShotsForScene`.
5. Extended `FilmV093Data` với `shotsBySceneId: Record<string, FilmShot[]>`.
6. AI sinh shots per-scene button stub (defer 0.9.4 wire generateShotsForScene).
7. **DELETED** `ScenesShotsManagerV09.tsx` (396 lines, atomic Q6).
8. Tests: 76/76 PASS (5 new r4 tests: addShot order / updateShot patch / removeShot reorder / toggleLock / FilmStoryboardSection mount).

**Output:** `ksp-image-ext-v0_9_3-r4.zip` (414 KB) + CHANGELOG r4 entry. Jason apply via unzip + update.sh.

---

### Monday, May 11, 2026 (afternoon) — Sprint 0.9.3-r3.1 polish batch 1 + 4 UI fixes

**Session goal:** Fix UI feedback từ r3 test (sidebar 2-col layout broken, refs slots too big, footer thừa, button styling weak, missing connector).

**What happened:**
1. CSS root cause fix: `@media (max-width: 480px)` collapse `.ksp-form-row-2` → 1 col ở sidebar 380px. Override `.ksp-sidebar-v09 .ksp-form-row-2 { grid-template-columns: 1fr 1fr }` (pattern đã có cho `.ksp-form-row-3`).
2. Project Setting: Hide TIME FORMAT cho Film mode (vẫn show cho TVC/Product archived).
3. Cast section: Bỏ avatar circle emoji ⭐, dùng initial letter "R" hoặc order number "1" (sau r4 lại bỏ luôn avatar). Bỏ left border accent role color (duplicate với outer border).
4. Idea+Script: Add Connector giữa 2 sections (`#1D9E75` green → `#D85A30` orange). Add 5-stage breadcrumb stub (⑤ Dialogues active amber, ①②③④ greyed defer r7). Provider toggle bỏ "AI Provider:" label, segmented full-width 50/50. Generate button solid orange filled `#D85A30` (font 12px, padding 9px).
5. Cast: Refs slots 64×64 → 44×44, Avatar 36×36 → 32×32, AI Generate button smaller.
6. Cast: "+ Thêm character" → "+ Thêm", bỏ footer "✨ AI gợi ý cast từ idea".
7. Export Connector function từ Editor.tsx để FilmIdeaScriptSection import.
8. Tests: 71/71 PASS (no new tests, polish only).

**Output:** Files đã ship bundle trong r4 zip. Jason confirm OK.

---

### Monday, May 11, 2026 (morning) — Sprint 0.9.3-r3 SHIP: Mockup 2 Script v1 (Stage 5 quick path)

**Session goal:** Build Mockup 2 combined Idea + Script section với Stage 5 1-cú generation.

**What happened:**
1. Extended `FilmV093Data` với `script?: FilmScript` + `scriptProvider?` (Gemini Flash / OpenAI 4o).
2. Created `engine/filmScriptStages.ts` (90 lines): `runStage5Quick(input)` wrapper around existing `aiRuntime.generateFilmScript` với adapter map FilmCharacter v0.9.3 → legacy FilmCharacterV2 (role "companion" → "supporting"). Strip dialog nếu `dialog === "no_dialog"`.
3. Created `FilmIdeaScriptSection.tsx` (350 lines): Idea green border + Script orange border. Provider toggle. Scene cards collapsible với SFX (blue) / Music (purple) / Transition (green) / Dialog (pink) inline color-coded.
4. 7 script actions: `setScript` (ScriptVersion wrapper last-10) / `clearScript` / `revertScriptToVersion` / `setScriptProvider` / `addEmptyScene` / `removeScene` / `updateSceneInScript`.
5. Export .txt button.
6. **DELETED** `FilmScriptSection.tsx` (494 lines) + `IdeaCardV09` reference cleanup (atomic Q6).
7. Editor.tsx: Replace standalone Step 1 IdeaCardV09 + FilmScriptSection bằng combined FilmIdeaScriptSection.
8. Tests: 71/71 PASS (new test setScript versioning).

**Output:** `ksp-image-ext-v0_9_3-r3.zip` 411 KB. r3.1 polish + r4 ship combined trong file r4 zip cuối.

---

### Monday, May 11, 2026 (morning) — Sprint 0.9.3-r2 SHIP: Mockup 1 Cast (`CastFilmSection`)

**Session goal:** Build Mockup 1 Cast section theo Photos pattern.

**What happened:**
1. Created `src/types/film_v093.ts` (173 lines): FilmCharacter schema (id/order/name/role/description/faceRefs[4]/bodyRefs[3]/aiGenDescription) + FilmImageRef + FilmV093Data wrapper.
2. Created `src/store/film_actions.ts` (215 lines): 8 actions — ensureFilmData / addCharacter / updateCharacter / removeCharacter / addFaceRef / removeFaceRef / addBodyRef / removeBodyRef / setAiGenDescription / clearAiGenDescription.
3. Created `src/components/CastFilmSection.tsx` (387 lines): Multi-character cards với role dropdown (4 options), face/body refs grid, AI Generate stub button + modal description prose.
4. Extended `src/types/v0_9_0.ts` ProjectV09Extensions với `filmV093` field + `dialog: "has_dialog" | "no_dialog"` Project Setting + aspect "4:3".
5. ProjectSettingSectionV09 thêm Dialog segmented + Genre dropdown (6 options Drama default) + AnimationStyle (4 options Live Action default) + Aspect (7 options 16:9 default) + Duration integer 1-60.
6. Editor.tsx route Film → CastFilmSection.
7. **DELETED** `CastSectionV09.tsx` (atomic Q6).
8. Tests: 70/70 PASS (8 Film mode tests).

**Output:** `ksp-image-ext-v0_9_3-r2.zip` 414 KB. Jason confirm + commit GitHub.

---

### Monday, May 11, 2026 — Sprint 0.9.3-r1 SHIP + 2 critical bug fixes

**Session goal:** Foundation cleanup + ship r1.

**What happened:**
1. Xoá 18 files Nhóm 1 (TVC archived 6) + Nhóm 2 (Legacy 12) ~270 KB rác.
2. Hide TVC + Product khỏi Mode dropdown (giữ enum cho migration).
3. ArchivedModePlaceholder cho project mode cũ.
4. **🚨 Critical bug fix 1: `update.sh` wipe `.git/`** — rsync `--delete` thiếu `.git` exclude. Fix: thêm `.git`, `.git/**`, `.gitignore`, `.env`, `.env.*`, `.vscode`, `.idea`, `*.local` vào excludes.
5. **🚨 Critical bug fix 2: node_modules accidentally committed** (43.71 MiB bloat). Fix: tạo `.gitignore`, `git rm -r --cached node_modules dist .vite`, push.
6. Tests: 62/62 PASS · TS 0 errors.

**Output:** `ksp-image-ext-v0_9_3-r1.zip` 395 KB + push GitHub. Tag `v0.9.3-r1` chờ Jason annotate.

---

## 🚦 Sprint roadmap (Film-focused)

### ✅ Sprint 0.9.3-r1 SHIPPED (May 11, 2026) — Foundation cleanup

- Xoá 18 files Nhóm 1 (TVC archived) + Nhóm 2 (Legacy) ~270 KB rác
- Hide TVC + Product khỏi Mode dropdown (code giữ, có thể re-enable post-v1.0)
- ArchivedModePlaceholder cho project mode cũ
- editor.tsx wired Editor (legacy EditorTab dead feature)
- Fix `update.sh` wipe `.git` bug (add .git + .env + .vscode + .idea + *.local + .gitignore vào exclude)
- Version bump 0.9.2-r2 → 0.9.3-r1
- 62/62 tests PASS

### ✅ Sprint 0.9.3-r2 SHIPPED (May 11, 2026 morning) — Mockup 1 Cast

- Created `src/types/film_v093.ts` (173 lines) — FilmCharacter schema
- Created `src/store/film_actions.ts` (215 lines) — 8 actions
- Created `src/components/CastFilmSection.tsx` (387 lines) — Multi-character cards với role dropdown, face/body refs, AI Generate stub
- ProjectSettingSectionV09 extend: Dialog + Genre + AnimationStyle + Aspect + Duration fields
- Editor.tsx route Film → CastFilmSection
- DELETED `CastSectionV09.tsx` (atomic Q6)
- 70/70 tests PASS · TS clean

### ✅ Sprint 0.9.3-r3 SHIPPED (May 11, 2026 morning) — Mockup 2 Script v1 (Stage 5 quick path)

- Extended `FilmV093Data` với `script` + `scriptProvider` fields
- Created `engine/filmScriptStages.ts` (90 lines) — `runStage5Quick()` wrapper around aiRuntime.generateFilmScript
- Created `components/FilmIdeaScriptSection.tsx` (350 lines) — combined Idea + Script with provider toggle, versions panel, scene cards collapsible
- 7 script actions (setScript/clearScript/revertScriptToVersion/setScriptProvider/addEmptyScene/removeScene/updateSceneInScript)
- Export .txt button
- DELETED `FilmScriptSection.tsx` (494 lines) + IdeaCardV09 reference cleanup (atomic Q6)
- 71/71 tests PASS

### ✅ Sprint 0.9.3-r3.1 SHIPPED (May 11, 2026 afternoon) — UI polish batch 1

- CSS fix: `.ksp-sidebar-v09 .ksp-form-row-2 { grid-template-columns: 1fr 1fr }` (root cause sidebar < 480px media query collapse)
- Hide TIME FORMAT cho Film mode
- Avatar dùng initial letter / order number (bỏ emoji ⭐)
- Bỏ left border accent role color (duplicate)
- Connector giữa Idea ↔ Script (`#1D9E75` → `#D85A30`)
- 5-stage breadcrumb stub (⑤ active amber, ①②③④ greyed defer r7)
- Provider toggle 50/50 no label
- Generate button solid orange filled `#D85A30`
- Refs slots 64×64 → 44×44
- Export Connector từ Editor.tsx
- 71/71 tests PASS

### ✅ Sprint 0.9.3-r4 SHIPPED (May 11, 2026 evening) — Mockup 3 Storyboard + UI polish batch 2

- Created `src/components/FilmStoryboardSection.tsx` (280 lines) — Scenes×Shots hierarchy purple border
- 6 shot actions (addShot/updateShot/removeShot/setShotStatus/toggleShotLocked/getShotsForScene)
- Extended `FilmV093Data` với `shotsBySceneId: Record<string, FilmShot[]>`
- 4 status badges spec colors (rendered green / rendering orange / pending gray / locked blue)
- 5 grid formats dropdown (2x2/2x3/3x2/3x3/4x3) + 7 shot types dropdown
- AI sinh shots per-scene stub (defer 0.9.4)
- DELETED `ScenesShotsManagerV09.tsx` (396 lines, atomic Q6)
- UI polish batch 2: Dialog → dropdown · Aspect Ratio labels rút gọn · Cast bỏ avatar+background+border · Idea+Script section padding 0
- **76/76 tests PASS** (49 Photos + 14 Film + 8 components + 5 Editor)

### ⏳ Sprint 0.9.3-r5 NEXT — Mockup 4 Shot Detail

**Reference:** MOCKUPS_FILM.md section "🖼 Mockup 4 — Shot Detail Panel (r5 PLAN)" có full spec + build checklist.

- Build `src/components/FilmShotDetailPanel.tsx` — inline expand drawer khi click shot row
- Image Gen block: 5 grid format picker + AI prompt EN auto-gen + Copy → Banana Pro + Refs ZIP + frame thumbnails + Replace single frame stub
- Video AI block: provider dropdown (4 default Seedance/Veo3/Kling/Sora + custom add form) + AI animation prompt + char count color (green <70% / yellow 70-95% / red >95%) + Copy → Provider
- Build `src/engine/filmShotPromptBuilder.ts`: `buildImagePrompt()` + `buildAnimationPrompt()`
- Extend `FilmV093Data`: `expandedShotId` + `videoProvidersCustom` + per-shot `imageGen` + `videoProvider` + `animationPrompt`
- DELETE `src/components/ShotDetailPanel.tsx` (852 lines, atomic Q6)
- Target ~85 tests · Photos 49/49 must stay green

### ⏳ Sprint 0.9.3-r6 — Mockup 5 Voice + Music + SFX + Bundle Export

**Reference:** MOCKUPS_FILM.md section "🎙 Mockup 5 — Voice + Music + SFX + Bundle Export (r6 PLAN)" có full spec + ZIP folder structure verbatim.

- Build 3 components: FilmVoiceSection (context-aware Skip/Narrator OR per-char dialog list với ElevenLabs/Google TTS) + FilmMusicSfxSection (per-scene briefs + Copy → Suno + SFX list + Freesound/Epidemic/Suno SFX provider dropdown) + FilmBundleExportSection (folder tree + Download ZIP)
- Build `src/engine/filmBundleExporter.ts`: `exportBundle(project) → Blob` using JSZip
- ZIP folder structure verbatim từ MOCKUPS_FILM.md (README + script.pdf + cast/ + shots/scene_N_shot_M_*/ + voice/ + music/ + sfx/)
- DELETE 3 legacy: VoiceSectionV09.tsx + MusicSfxSectionV09.tsx + BundleExportV09.tsx
- Target ~95 tests

### ⏳ Sprint 0.9.3-r7 — Multi-stage Script Wizard (Stage 1-4) = v0.9.3 FINAL

**Reference:** MOCKUPS_FILM.md section "🎭 r7 — Multi-stage Script Wizard" có full build checklist.

- Extend `FilmV093Data`: `scriptStage / scriptStructure / scriptBeats / scriptTwists / scriptScenes`
- 4 new engine functions: `runStage1Structure / runStage2Beats / runStage3Twists / runStage4Scenes`
- Replace 5-stage breadcrumb stub với clickable navigation
- Stage 1: 3-act default + Hero's Journey / Save the Cat / Kishōtenketsu options
- Stage 2: 7-9 beats editable
- Stage 3: 1-3 twists accept/reject
- Stage 4: Scenes splitter
- Revert logic: click past stage → clear downstream + regen
- Tag annotated `v0.9.3` final
- Target ~110 tests = **v0.9.3 FINAL**

### 🔮 Sprint 0.9.4+ — Polish + API wires + Storage migration

- IndexedDB blob storage thay base64 dataURL (giảm memory ~70%)
- Wire ElevenLabs API (Voice TTS audio generation)
- Wire Suno API (Music brief → MP3)
- Wire Imagen 4 API (Cast AI Generate face/body)
- Wire Nano Banana single-frame regen
- Wire `aiRuntime.generateShotsForScene()` cho AI sinh shots per-scene
- Bundle Export image binaries (IDB read)

### 🚀 Long-term (v1.0+)

- Music mode (MV ca sỹ ảo)
- Bring back TVC mode (if needed, separated codebase)
- Bring back Product Photo mode
- Cloud sync project files
- Team collab (multi-user)

---

## 🚧 Pending decisions — Q1-Q7 status (TẤT CẢ ĐÃ CHỐT)

| # | Question | Status | Câu trả lời |
|---|---|---|---|
| Q1 | Subject Mode Simple vs Characters | ✅ CHỐT | Chỉ Characters mode (M1 không có Simple toggle) |
| Q2 | Genre có generate story arc? Hardcode/AI/Hybrid? | ✅ CHỐT May 11 | **Approach (d) Multi-stage Pipeline 5 stages** (Structure → Beats → Twists → Scenes → Dialogues) với user review giữa stages + revert |
| Q3 | 6 Animation Styles implement đầy đủ? | ✅ CHỐT | Multi-style dropdown. v0.9.3: Live + Anime + 3D CGI + Film Noir; defer Stop-motion + 2D Cartoon |
| Q4 | Per-character outfit riêng hay outfit chung? | ✅ CHỐT | Per-character riêng |
| Q5 | Pipeline 7-step implement bao nhiêu cho v0.9.3? | ✅ CHỐT | Full 7 steps có UI; API wire stubs defer Sprint 0.9.4+ |
| Q6 | Film có dùng Camera Style toggle BOKEH/DOC như Photos không? | ✅ CHỐT May 11 | **Bỏ** — Animation Style descriptor đã handle camera/lens look. KHÔNG port từ Photos |
| Q7 | 12-frame default vs flexible grid? | ✅ CHỐT | Linh hoạt per-shot (2×2 insert, 3×3 default, 4×3 action) |

**TẤT CẢ 7 questions đã chốt → ready để bắt đầu Sprint 0.9.3-r2 ngay.**

---

## 🐛 Known bugs / decisions parked

| Item | Status | Priority | Notes |
|---|---|---|---|
| `update.sh` wipe `.git/` recurring | ✅ FIXED v0.9.3-r1 | — | Root cause: rsync `--delete` thiếu `.git` exclude. Fix permanent trên main + tất cả zip ship sau. |
| node_modules accidentally committed (43.71 MiB bloat) | ✅ FIXED immediate | — | Tạo .gitignore + git rm --cached. r2+ include .gitignore trong zip + rsync exclude `.gitignore`. |
| TVC mode | 🟡 ARCHIVED | — | Code xoá r1, mode ẩn dropdown. Có thể bring back post-v1.0 (separated module). |
| Product Photo mode | 🟡 ARCHIVED | — | Chưa bao giờ build, mode ẩn dropdown. Defer indefinitely. |
| Film Cast `CastSectionV09` | ✅ DONE r2 | — | Replaced bằng `CastFilmSection` (Mockup 1 + r4 polish bỏ avatar). |
| Film Script `FilmScriptSection` | ✅ DONE r3 + 🟡 r7 multi-stage | High | r3 ship Stage 5 quick path. r7 sẽ add Stage 1-4 wizard. |
| Film Storyboard `ScenesShotsManagerV09` | ✅ DONE r4 | — | Replaced bằng `FilmStoryboardSection` với 4 status badges. |
| Film Shot Detail `ShotDetailPanel` | 🟡 Will rebuild r5 | High | Image Gen + Video AI provider dropdown + Add custom (Grok). |
| Film Voice `VoiceSectionV09` | 🟡 Will rebuild r6 | Medium | Context-aware Skip/Narrator. |
| Film Music `MusicSfxSectionV09` | 🟡 Will rebuild r6 | Medium | Per-scene briefs (Hans Zimmer style). |
| Film Bundle `BundleExportV09` | 🟡 Will rebuild r6 | Medium | Folder tree structure như Mockup 5. |
| Voice TTS API call | 🔴 Stub | Low | UI works (r6), ElevenLabs/Google TTS API call deferred Sprint 0.9.4. |
| Music brief Suno API | 🔴 Stub | Low | UI works (r6), Copy → Suno button works. Generate via API deferred. |
| Single-frame regen API | 🔴 Stub | Low | UI works (r5), Nano Banana call deferred. |
| AI sinh shots per-scene | 🔴 Stub r4 | Low | Button toast stub. Wire `aiRuntime.generateShotsForScene()` Sprint 0.9.4. |
| Cast AI Generate face/body | 🔴 Stub r2 | Medium | Modal description prose works, Imagen 4 API wire deferred. |
| Bundle Export image binaries | 🔴 Stub | Low | ZIP exports prompts/configs only, image PNG bundling needs IDB read (r6 partial). |
| Image storage = base64 dataURL | 🟡 Performance | Medium | 5MB+ images make project files huge. IndexedDB blob v0.9.4. |

---

## 🔑 API endpoints reference

```
Gemini Flash:    https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
Gemini Pro:      https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent
Imagen 4 Std:    https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict
Imagen 4 Fast:   https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict
Nano Banana:     https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent
Nano Banana Pro: https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-image:generateContent
OpenAI 4o:       https://api.openai.com/v1/chat/completions (model: "gpt-4o")
ElevenLabs:      https://api.elevenlabs.io/v1/...
```

Pricing reference (May 2026):
- Imagen 4 Standard: $0.04/image
- Imagen 4 Fast: $0.02/image
- Nano Banana: $0.039/image (with refs)
- Nano Banana Pro: $0.13+/image (with refs, higher quality)
- Seedance 2.0 Pro: $0.15/sec, max 12s, 4000 chars
- Veo3: $0.30/sec, max 8s, 2500 chars
- Kling 2.0: $0.10/sec, max 10s, 2500 chars
- Sora: $0.50/sec, max 20s, 4000 chars
- Grok Video (custom): $0.20/sec, max 15s, 3000 chars (Jason đã add ví dụ Mockup 4)

iPhone reference (May 2026):
- iPhone 17 Pro / Pro Max: $1,099 / $1,199 (current flagship, ra Sep 2025)
- iPhone 18 Pro / Pro Max: launching September 2026

---

## 🔒 Architecture Locks (DO NOT REVISIT)

### v0.9.1 locks (Photos mode — đã chốt)
- Sidebar 380px vertical
- AI prompts EN (international cinema English)
- Time format: integer default (decimal/integer/timecode options)
- Versioning: last-10 revert
- Auto-migration silent v0.8.x → v0.9.0 → v0.9.1
- Photos Cast: 5 Subject Types (Female/Male/Couple/Family/Friends Group)
- Photos face refs: dynamic 1-6, slot 0 = "front" LOCKED label
- Photos outfit: 1 slot optional
- Photos prompt: dynamic single (N=1) vs multi-face (N≥2) logic
- Camera Style toggle: BOKEH (Sony A7R V 85mm f/1.8) default, DOCUMENTARY (iPhone 17 Pro Max f/22) alt — placement TOP của PIPELINE
- Image Gen layout: list view (KHÔNG grid)
- Connector line height: 10px global
- AI Provider per-task: ẩn các field theo mode applicable
- Magic phrases: verbatim từ 18 docs (Skin Paradox, Identity Lock, BOKEH/DOC bifurcation)
- Engine adapter pattern: photosPromptBuilder.ts → reuses existing v0.4 13-block assembler

### v0.9.3-r1 locks (Foundation cleanup — đã chốt)
- TVC + Product modes ẩn khỏi Mode dropdown (giữ enum trong types để migration không break)
- `update.sh` rsync excludes: `.git`, `.git/**`, `.env`, `.env.*`, `.vscode`, `.idea`, `*.local` (PROTECT FOREVER)
- editor.tsx wired Editor sidebar (legacy EditorTab dead, không bring back)

### v0.9.3-r2 locks (Cast Film — đã chốt May 11)

- Multi-character cards 4 roles (Protagonist/Antagonist/Companion/Extra) — KHÔNG dùng pattern Photos 5 Subject Types
- Per-character: face refs 1-4 + body refs 1-3 + description prose + AI Generate stub (modal description, no API call r2-r4)
- Outfit slot riêng: BỎ (gộp vào Body refs)
- Project Setting Dialog là property toàn phim (not per-character)
- Schema lock: `FilmCharacter` + `FilmImageRef` + `FilmV093Data` (xem types/film_v093.ts)
- Atomic Q6 delete pattern: build mới + route + delete old trong cùng 1 ship

### v0.9.3-r3 locks (Script v1 — đã chốt May 11)

- Multi-stage Script Pipeline 5 stages: Structure → Beats → Twists → Scenes → Dialogues+SFX+Music+Transition
- r3 ship Stage 5 quick path (1-cú generation), r7 add Stage 1-4 wizard
- Dual AI provider per project: Gemini Flash (default) / OpenAI 4o
- Script versioning: ScriptVersion wrapper (id/timestamp/label/scriptSnapshot) keep last-10
- Inline note colors (Scene block) MUST verbatim: SFX `#E6F1FB/#0C447C` blue / MUSIC `#EEEDFE/#3C3489` purple / TRANSITION `#E1F5EE/#085041` green / DIALOG `#FBEAF0/#72243E` pink
- Engine adapter: legacy `FilmCharacterV2` shape via `adaptCharacter()` (role "companion" → "supporting" for legacy enum compat)
- Strip dialog từ AI output nếu `setting.dialog === "no_dialog"`

### v0.9.3-r3.1 + r4 locks (UI Polish — đã chốt May 11)

**⚠️ Polish overrides spec gốc. KHÔNG được revert về spec gốc cho các phần đã polish.**

**Project Setting:**
- Time Format HIDE khi `mode === "film"` (chỉ show cho TVC/Product archived)
- Dialog: dropdown `<select>` (KHÔNG segmented control)
- Aspect Ratio labels rút gọn — KHÔNG có ngoặc giải thích (`16:9 landscape` not `16:9 landscape (YouTube/TV)`)
- Form rows 2-col grid — CSS `.ksp-sidebar-v09 .ksp-form-row-2 { grid-template-columns: 1fr 1fr }`
- Duration: integer input 1-60

**Cast cards (post-r4):**
- Avatar circle BỎ HOÀN TOÀN (`display: none` + DOM element removed)
- Background transparent, border none, border-radius 0
- Padding 8px 10px, width 100%
- Separator `border-top: 0.5px solid #2c2c2c` giữa siblings (chứ không phải border bao quanh card)
- Refs slots 44×44 (smaller than r2 64×64)
- Button "+ Thêm character" rút gọn "+ Thêm"
- Footer "✨ AI gợi ý cast từ idea" XOÁ HOÀN TOÀN (không cần button stub)

**Idea + Script sections:**
- Section outer padding 0 (`.ksp-idea-film, .ksp-script-film { padding: 0 !important }`)
- Inner blocks self-padded margins 12px (textarea, breadcrumb, provider toggle, actions, scenes, feed note)
- Section header padding 10px 12px
- Connector giữa 2 sections: `<Connector colorFrom="#1D9E75" colorTo="#D85A30" />` chấm tròn + line gradient green→orange
- 5-stage breadcrumb stub: ⑤ Dialogues active amber `#FAEEDA/#854F0B`, ①②③④ greyed `#2a2a2a/#888 opacity 0.6` defer r7
- Provider toggle: KHÔNG label, segmented split 50/50 full-width
- Generate button: solid orange `#D85A30` filled (font 12px, padding 9px×14px, hover brightness 1.05, disabled `#6b3a25` opacity 0.7)

**Connector component export:** Editor.tsx exports `Connector` function cho FilmIdeaScriptSection (và future r5/r6/r7) import.

### v0.9.3-r4 locks (Storyboard — đã chốt May 11)

- Hierarchy: `script.scenes[]` → `shotsBySceneId[sceneId]: FilmShot[]`
- 4 status badges spec colors (verbatim CSS — DON'T MODIFY):
  - `.ksp-status-rendered { background: #EAF3DE; color: #3B6D11 }` ✓ rendered
  - `.ksp-status-rendering { background: #FAEEDA; color: #854F0B }` ⚙ rendering
  - `.ksp-status-pending { background: #2a2a2a; color: #888 }` ○ pending
  - `.ksp-status-locked { background: #E6F1FB; color: #0C447C }` 🔒 locked
- Status mapping: `rendered/animated` → rendered · `frames_ready/prompt_ready` → rendering · `draft` (default) → pending · `locked: true` overrides
- 5 grid formats: 2x2 (4 frames) / 2x3 (6) / 3x2 (6) / 3x3 (9 default) / 4x3 (12)
- 7 shot types: wide_establishing / medium / close_up / insert / over_shoulder / two_shot / pov
- Click shot → drill-down (Mockup 4 ShotDetailPanel — implement r5)
- AI sinh shots per-scene button (stub r4, wire 0.9.4)

### v0.9.3-r5+ locks dự kiến

Xem MOCKUPS_FILM.md cho r5 (Shot Detail) / r6 (Voice+Music+Bundle) / r7 (Multi-stage upgrade) full spec.

- r5: Video AI provider dropdown (KHÔNG button grid) + custom add (Grok et al). 4 default seeds: Seedance-2-pro / Veo-3 / Kling-2 / Sora
- r6: Voice context-aware (Skip nếu no_dialog, suggest Narrator optional). Music brief per-scene. Bundle Export folder tree verbatim từ MOCKUPS_FILM.md
- r7: Stage 1 (Structure picker 3-act default), Stage 2 (Beats editable), Stage 3 (Twists accept/reject), Stage 4 (Scenes splitter), full revert logic

---

## 🚨 DESTRUCTIVE OPERATIONS — RULE NGHIÊM NGẶT

TRƯỚC khi đề xuất destructive command (rm -rf, rm -r, find ... -delete, git clean -fd, git reset --hard):
1. Verify Jason đã commit Git ở trạng thái sạch
2. Giải thích RÕ file/folder nào sẽ bị xóa
3. Đợi Jason confirm "OK xóa" mới đưa lệnh

CẤM TUYỆT ĐỐI: `rm -rf ~/Downloads/ksp-image-ext` (toàn bộ source). Lý do: Jason đã từng mất audio HSK1-6 LinguTab vì lệnh rm tương tự.

---

## ⛔ Claude — KHÔNG được phép

- `rm -rf ~/Downloads/ksp-image-ext` hoặc lệnh xoá toàn bộ source
- Push trực tiếp lên GitHub (Jason apply zip + commit)
- Bump version nhanh (v0.9.3 → v1.0.0 trong 1 ngày)
- Ship feature lớn không confirm với Jason trước
- Wire-up stubs (Imagen 4, TTS, Music, Single-frame regen) mà không discuss design A/B/C/D trước
- Modify magic phrases verbatim trong engine — phải đối chiếu 18 docs nguyên gốc
- Thay đổi Architecture Locks ở section trên mà không explicit re-discuss
- Touch `main` branch (chỉ làm trên branch dev cho Sprint hiện tại, OR ship sub-r releases với Jason apply)
- Touch Photos mode code (locked tag v0.9.1-r12)
- Modify `update.sh` rsync excludes — chỉ THÊM, KHÔNG xóa các exclude hiện có (đặc biệt `.git`, `.gitignore`)

---

## ⚙️ Update commands

### Cập nhật version mới
```bash
bash ~/Downloads/ksp-image-ext/update.sh
```

→ `chrome://extensions` → KSP Image → ↻ Reload (BẮT BUỘC nếu manifest đổi permission) → đóng/mở side panel.

### First-time install
```bash
bash ~/Downloads/ksp-image-ext/setup.sh
```

---

## 📂 Git workflow quick reference

### Daily commits (sau khi tôi ship patch)
```bash
cd ~/Downloads/ksp-image-ext
unzip -o ~/Downloads/ksp-image-ext-vX_Y_Z-rN.zip
bash update.sh
git add -A && git commit -m "Sprint X.Y-rN: <description>"
git push
```

### Khi tôi đi sai → Revert
```bash
git reset --hard v0.9.1-r12
git push --force-with-lease origin main
```

### Restore từ Git nếu mất source
```bash
cd ~/Downloads
mv ksp-image-ext ksp-image-ext-backup-`date +%Y%m%d`
git clone https://github.com/hoangdungksp/KSP_Image_Prompt.git ksp-image-ext
cd ksp-image-ext && git checkout v0.9.3-r1   # hoặc tag mới nhất
```

---

## 🧪 Test discipline (UNIQUE TO THIS PROJECT)

- TypeScript compile pass KHÁC runtime work
- LUÔN chạy `npx vitest run` trước khi ship
- Test coverage hiện tại: 62/62 PASS (49 Photos + 8 components + 5 Editor)
- Khi add feature mới: viết test runtime trước, code sau (TDD optional nhưng test BẮT BUỘC trước ship)

### Test workflow Photos mode (locked, regression guard)
1. Project Setting → Mode = Photos (Time format auto ẩn)
2. ASSETS → CAST → "+ Thêm" → 5 Subject Types → upload 1-6 face refs (slot 0 = "front") → outfit optional
3. PIPELINE → Camera Style: BOKEH/DOC → Step 1 Idea (theme picker 227+) → Step 2 Image Gen (auto-pick angles)
4. Per shot: Copy prompt 13 blocks → paste Banana Pro · Download refs ZIP

### Test workflow Film mode (sẽ verify khi vào Sprint 0.9.3-r2 trở đi)
- TBD theo 5 mockups Jason đã chốt

---

## 🎁 Other parallel projects (cùng ecosystem)

- **KSP AutoFlow** (Chrome extension v4→v5 refactor for AI filmmaking automation)
- **KSP Studio** (web app cho film production)
- **LinguTab** (Chrome extension cho Vietnamese learners của Chinese/English)
- **Facebook auto-poster** Chrome extension
- **AWE USA 2026** sponsorship outreach (Long Beach, June 15-18)
- **YouTube channel @DungThichVar** (XR/VR/AR reviews)

Khi nào nói tới các project này, đó là cùng ecosystem nhưng repo riêng.

---

## 📌 Current memory edits (Jason preferences)

- Vietnamese-first communication, address as "Jason" (not "Dung")
- Workflow: 5-10 client revisions/tuần cho storyboards
- Prefer 1-line update commands
- Prefer ZIP output via `present_files` (zip from inside project folder, no parent nesting)
- Confirm trước khi code feature lớn
- Discuss design trước khi code feature mới (Hướng A/B/C/D format)
- **Phải self-test runtime với vitest trước khi ship** (TSC + build pass KHÔNG ĐỦ — đã có precedent bug compile-pass-runtime-fail)
- Khi ≤3 files change → output từng file riêng cho replacement
- Lô lớn OK if pre-approved
- Source path: `~/Downloads/ksp-image-ext/`

---

## 📝 Câu hỏi gợi ý cho chat mới

```
Đây là KSP Image Chrome extension v0.9.3-r4 (76/76 tests PASS) →
đang phát triển Mode Film theo 5 mockup. Đã ship 4 sprint r1→r4.

Đọc 3 file trong Project Knowledge để hiểu context:
- HANDOFF.md (vision + roadmap + Activity log + Architecture locks)
- MOCKUPS_FILM.md (design spec đầy đủ Mockup 1-5 + r3.1/r4 UI POLISH LOCKS)
- CHANGELOG.md (trạng thái code per sprint)

⚠️ QUAN TRỌNG: Section "🚨 UI POLISH ADJUSTMENTS LOCKED (r3.1 + r4)"
trong MOCKUPS_FILM.md — đây là feedback đã apply, KHÔNG được revert về spec gốc.

Bắt đầu Sprint 0.9.3-r5 — Mockup 4 Shot Detail:
- Build FilmShotDetailPanel.tsx (inline expand drawer khi click shot row trong Storyboard)
- Image Gen block (5 grid format picker + AI prompt EN + Copy → Banana Pro + Refs ZIP + frame thumbnails + replace single frame stub)
- Video AI block (provider dropdown 4 default Seedance/Veo3/Kling/Sora + custom add Grok et al + animation prompt với char count color green<70%/yellow70-95%/red>95%)
- Build engine/filmShotPromptBuilder.ts
- DELETE ShotDetailPanel.tsx (legacy 852 lines, atomic Q6)
- Photos regression 49/49 PASS · Target ~85 tests · Self-test vitest trước ship
```

---

## 🗺 File paths reference

- **Source code:** `~/Downloads/ksp-image-ext/`
- **Distribution zips:** `~/Downloads/ksp-image-ext-v*.zip`
- **GitHub:** https://github.com/hoangdungksp/KSP_Image_Prompt
- **Active branch:** `main` (Sprint 0.9.3-r4 latest ship, Jason commit + push)
- **Save point tag:** `v0.9.1-r12` (Photos mode complete — KHÔNG TOUCH)
- **Latest ship version:** `v0.9.3-r4` (Jason tag annotated nếu muốn save point Film MVP-ish)
- **Next save point dự kiến:** `v0.9.3` final = sau r7 complete

---

End of handoff. Chat mới có thể bắt đầu ngay với context này.
