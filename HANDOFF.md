# KSP Image Chrome Extension — Handoff Document
## Status: v0.9.3-r1 shipped → pivot Film mode (Sprint 0.9.3-r2 next)

**Last updated:** Monday, May 11, 2026

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

### Monday, May 11, 2026 — Sprint 0.9.3-r1 SHIP + 2 critical bug fixes

**Session goal:** Vẽ 5 mockup Film theo vision sạch + Gap Report + Sprint 0.9.3-r1 foundation cleanup.

**What happened:**
1. Claude vẽ lại toàn bộ 5 mockup Mode Film bằng visualizer (M1 Project+Cast → M5 Voice+Music+SFX+Bundle), Jason confirm OK lần lượt từng cái.
2. Jason chỉnh design: Dialog (có/không thoại) MOVE từ per-character lên Project Setting toàn phim.
3. Video AI provider: thay 4-button grid bằng dropdown + "+ Add custom provider" (cho Grok et al).
4. Q2 chốt approach (d) Multi-stage Pipeline 5 stages: Structure → Beats → Twists → Scenes → Dialogues + revert logic; Q6 chốt bỏ Camera Style toggle BOKEH/DOC (Animation Style descriptor đã handle).
5. Claude make Gap Report: 4 nhóm files (1 TVC archived xoá / 2 Legacy xoá / 3 Film rebuild / 4 Shared không động), 13 files mới sẽ tạo, Sprint roadmap r1→r7.
6. Jason confirm: Q1=B (xoá Nhóm 1+2 cùng lúc), Q2=ẩn TVC+Product, Q3=A (project Film cũ show note tạo mới).
7. **Sprint 0.9.3-r1 SHIPPED**:
   - Xoá 18 files (Nhóm 1 TVC 6 files + Nhóm 2 Legacy 12 files, ~270 KB rác)
   - Hide TVC + Product khỏi Mode dropdown
   - ArchivedModePlaceholder cho project cũ
   - editor.tsx legacy EditorTab → wired tới Editor sidebar
   - Vitest 62/62 PASS, TS 0 errors, Vite build OK
   - Version bump 0.9.2-r2 → 0.9.3-r1
8. **🚨 Critical bug fix 1: `update.sh` wipe `.git/`** — root cause của vấn đề "lúc nào cũng mất git". Bug: rsync `--delete` không có `--exclude='.git'` → mỗi lần update.sh, xóa sạch .git của Jason. Fix: thêm `.git`, `.git/**`, `.env`, `.env.*`, `.vscode`, `.idea`, `*.local` vào excludes (cả rsync + fallback cp branch).
9. **🚨 Critical bug fix 2: node_modules accidentally committed** — push r1 first time bị bloat 43.71 MiB / 15747 objects. Root cause: zip Jason gốc thiếu `.gitignore` + rsync `--delete` xóa `.gitignore` từ folder fresh clone (do .gitignore không có trong exclude). Fix immediate: tạo `.gitignore`, `git rm -r --cached node_modules dist .vite`, commit + push. Fix vĩnh viễn r2+: include `.gitignore` trong zip + thêm `--exclude='.gitignore'` vào rsync.

**Output:** zip `ksp-image-ext-v0_9_3-r1.zip` 395 KB ship + pushed lên `main`. Tag `v0.9.3-r1` chưa annotated (Jason có thể tag sau khi verify Chrome load OK).

---

### Sunday, May 10, 2026 (afternoon late) — Film Vision clarified via mockups

**Session goal:** Sau khi pivot bỏ TVC sáng nay, Jason ship 4 mockup HTML + 6 cốt lõi để clarify vision Film mode.

**What happened:**
1. Claude verify code Film hiện tại trong v0.9.2-r2 zip (FilmScriptSection 494 dòng, ScenesShotsManagerV09 396 dòng, ShotDetailPanel 852 dòng, CastSectionV09 595 dòng, etc.)
2. Tổng hợp past chats về Film vision (v0.8.0 redesign, v0.9.0 expansion, why Film vs TVC) — bảng 11 differences, 3-act 12-frame, 6 genres × 6 animation styles, multi-character system, hierarchy scenes→shots vì phim dài không render 1 grid được.
3. Jason ship 4 mockup (M1/M2/M3/M5 — M4 chưa upload) + 6 cốt lõi clear nhất từ trước.
4. Claude map 6 cốt lõi vs code hiện tại → 5/7 questions Q1-Q7 đã có answer implicit từ mockups (Q1/Q3/Q4/Q5/Q7 chốt).
5. Jason quyết định: **rebuild Film tách riêng pattern Photos, code rác xoá hết**.

---

### Sunday, May 10, 2026 (afternoon) — DECISION: bỏ TVC, pivot Film

**Session goal:** Discuss design TVC Concept + Storyboard 3-tab.

**What happened:**
1. Build v0.9.2-r2: Cast TVC dùng Photos pattern + Product UI single-row 3-way upload. 85/85 tests PASS, ship zip.
2. Discuss design Concept section theo mockup 3 (8 fields treatment với Gemini/ChatGPT toggle, History 3, Copy/Export PDF, AI reasoning box).
3. Vẽ 2 mockup HTML so sánh: design ý tưởng vs UI thực tế đang chạy.
4. Vẽ mockup Storyboard combined (gộp Concept vào Tab Setup, 3-tab Setup/Upload Grid/Animation).
5. **Jason quyết định BỎ TOÀN BỘ Mode TVC** — Concept quá phức tạp, không hợp client workflow thực tế. Tagline vs Logline gây confusing. Tập trung Film.
6. Update HANDOFF.md.

---

### Sunday, May 10, 2026 (morning) — Sprint 0.9.2-r1 + r2: TVC Cast + Product

**Session goal:** Unblock TVC test (Cast crash + thiếu Brand/Tagline + thiếu Product upload).

**r1:** Defensive fix Cast crash (`ref.angle ?? "front"`) + tạo Product Section v1 (multi-image grid 3-col + Brand + Tagline VN/EN + Brand notes toggle). 77/77 tests.

**r2:** Cast TVC dùng `CastPhotosSection` (giống Photos) + Product UI single-row layout (image-slot left + form right) + 3-way upload (file/library/snip) + bỏ counter/hint/EN-tagline-toggle/brand-notes-toggle. 85/85 tests.

(Note: r1+r2 code partially obsolete vì pivot Film. Code xoá trong v0.9.3-r1.)

---

### Saturday, May 9, 2026 (evening) — Git lock-in v0.9.1-r12 + setup branch dev

Recovery `.git` (Jason move source `~/Documents/` → `~/Downloads/` mất `.git`). Backup folder cũ, clone fresh từ GitHub, extract zip r12 đè. Commit + tag annotated `v0.9.1-r12` push GitHub. Tạo branch `sprint-0.9.2-tvc-film` track origin. Document workflow daily commits + revert plans 4 levels.

(Note: Lần mất .git này KHÔNG phải do move folder mà do `update.sh` wipe — đã fix root cause trong r1.)

---

## 🚦 Sprint roadmap (Film-focused)

### ✅ Sprint 0.9.3-r1 SHIPPED (May 11, 2026) — Foundation cleanup

- Xoá 18 files Nhóm 1 (TVC archived) + Nhóm 2 (Legacy) ~270 KB rác
- Hide TVC + Product khỏi Mode dropdown (code giữ, có thể re-enable post-v1.0)
- ArchivedModePlaceholder cho project mode cũ
- editor.tsx wired Editor (legacy EditorTab dead feature)
- Fix `update.sh` wipe `.git` bug (add .git + .env + .vscode + .idea + *.local vào exclude)
- Fix `.gitignore` missing (cần làm lại r2 prevention)
- Version bump 0.9.2-r2 → 0.9.3-r1
- 62/62 tests PASS · TS 0 errors · Vite build OK

### ⏳ Sprint 0.9.3-r2 NEXT — Mockup 1 Cast (`CastFilmSection`)

- Build `src/components/CastFilmSection.tsx` (multi-character cards, 4 roles Protagonist/Antagonist/Companion/Extra, face refs + body refs, AI Generate badge stub)
- Project Setting extend: thêm field Dialog (Có thoại / Không thoại toggle), Genre dropdown, AnimationStyle dropdown, AspectRatio dropdown
- Create `src/types/film_v093.ts` foundation types
- Create `src/store/film_actions.ts` skeleton state mutations
- Xoá `CastSectionV09.tsx` (replace bằng CastFilmSection)
- **Fix .gitignore + update.sh exclude .gitignore** (r1 leak prevention)
- Self-test: Photos 49/49 PASS · Film cast 8 tests · TS clean
- Ship zip r2

### ⏳ Sprint 0.9.3-r3 — Mockup 2 Script v1 (Stage 5 quick path)

- Build `src/components/FilmIdeaScriptSection.tsx` (1-stage initially, full output như Mockup 2 hiện tại)
- Build `src/engine/filmScriptStages.ts` stage5 only (full script generation từ Idea + Genre + Cast)
- AI integration Gemini/ChatGPT dual-provider toggle
- Variation button + Versions list + Export PDF + Add Scene
- Xoá `FilmScriptSection.tsx`
- Self-test runtime
- Ship zip r3

### ⏳ Sprint 0.9.3-r4 — Mockup 3 Storyboard (hierarchy + 4 status badges)

- Build `src/components/FilmStoryboardSection.tsx` (Scenes × Shots hierarchy)
- 4 status badges (rendered/rendering/pending/locked) — 1 status mới so với code cũ
- 5 grid formats (2×2/2×3/3×2/3×3/4×3) per shot
- AI sinh shots per-scene button
- Xoá `ScenesShotsManagerV09.tsx`
- Self-test runtime
- Ship zip r4

### ⏳ Sprint 0.9.3-r5 — Mockup 4 Shot Detail

- Build `src/components/FilmShotDetailPanel.tsx` (Image Gen + Video AI per-shot drill-down)
- Image Gen: grid format picker + AI-generated prompt EN + Copy → Banana Pro + auto-crop grid upload + replace single frame (stub)
- Video AI: provider dropdown (4 default + Add custom Grok et al) + AI-generated animation prompt + char count + Copy → Seedance
- Build `src/engine/filmShotPromptBuilder.ts`
- Xoá `ShotDetailPanel.tsx`
- Self-test runtime
- Ship zip r5

### ⏳ Sprint 0.9.3-r6 — Mockup 5 Voice + Music + SFX + Bundle Export

- Build `src/components/FilmVoiceSection.tsx` (context-aware Skip/Narrator + ElevenLabs/Google TTS toggle)
- Build `src/components/FilmMusicSfxSection.tsx` (per-scene music briefs + SFX list + Freesound/Epidemic/Suno SFX toggle)
- Build `src/components/FilmBundleExportSection.tsx` (folder tree visualization + Download ZIP)
- Build `src/engine/filmBundleExporter.ts`
- Xoá 3 sections cũ (VoiceSectionV09 + MusicSfxSectionV09 + BundleExportV09)
- Self-test runtime
- Ship zip r6

### ⏳ Sprint 0.9.3-r7 — Mockup 2 upgrade Multi-stage (Stage 1-4) = v0.9.3 FINAL

- Add Stage 1 Structure picker (default 3-act + advanced options)
- Add Stage 2 Beats generator (AI fill 7-9 milestones, user edit each)
- Add Stage 3 Twist injector (AI suggest 1-3 twists, user accept/reject)
- Add Stage 4 Scenes splitter (gộp beats + twists thành scenes)
- Stage navigation breadcrumb + revert logic (click stage cũ regen downstream)
- Self-test runtime full pipeline
- Ship zip r7 → tag `v0.9.3` final + merge main

### 🔮 Sprint 0.9.4+ — Polish + API wires + Storage migration

- IndexedDB blob storage thay base64 dataURL (giảm memory ~70%)
- Wire ElevenLabs API (Voice TTS audio generation)
- Wire Suno API (Music brief → MP3)
- Wire Imagen 4 API (Cast AI Generate face/body)
- Wire Nano Banana single-frame regen
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
| node_modules accidentally committed (43.71 MiB bloat) | ✅ FIXED immediate | — | Tạo .gitignore + git rm --cached. r2+ sẽ include .gitignore trong zip + thêm exclude .gitignore vào update.sh rsync. History bloat OK (limit 100MB còn xa). |
| TVC mode | 🟡 ARCHIVED | — | Code xoá r1, mode ẩn dropdown. Có thể bring back post-v1.0 (separated module). |
| Product Photo mode | 🟡 ARCHIVED | — | Chưa bao giờ build, mode ẩn dropdown. Defer indefinitely. |
| Film Cast `CastSectionV09` | 🟡 Will rebuild r2 | High | Replace bằng CastFilmSection theo Mockup 1. |
| Film Script `FilmScriptSection` | 🟡 Will rebuild r3+r7 | High | r3 ship Stage 5 quick path, r7 add Stage 1-4 wizard. |
| Film Storyboard `ScenesShotsManagerV09` | 🟡 Will rebuild r4 | High | Replace bằng FilmStoryboardSection với 4 status badges. |
| Film Shot Detail `ShotDetailPanel` | 🟡 Will rebuild r5 | Medium | Image Gen + Video AI provider dropdown + Add custom (Grok). |
| Film Voice `VoiceSectionV09` | 🟡 Will rebuild r6 | Medium | Context-aware Skip/Narrator. |
| Film Music `MusicSfxSectionV09` | 🟡 Will rebuild r6 | Medium | Per-scene briefs (Hans Zimmer style). |
| Film Bundle `BundleExportV09` | 🟡 Will rebuild r6 | Medium | Folder tree structure như Mockup 5. |
| Voice TTS API call | 🔴 Stub | Low | UI works, ElevenLabs API call deferred Sprint 0.9.4. |
| Music brief generator | 🔴 Stub | Low | UI works, Suno API not wired. |
| Single-frame regen API | 🔴 Stub | Low | UI works, Nano Banana call deferred. |
| Bundle Export image binaries | 🔴 Stub | Low | ZIP exports prompts/configs only, image PNG bundling needs IDB read. |
| Image storage = base64 dataURL | 🟡 Performance | Medium | 5MB+ images make project files huge. IndexedDB blob v0.9.4. |
| Cast AI Generate face/body | 🔴 Stub | Medium | Badge UI có sẵn (Mockup 1), Imagen 4 wire deferred Sprint 0.9.4. |

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

### v0.9.3-r2+ locks dự kiến (sẽ chốt khi Film build từng phần)

- Cast Film pattern: multi-character cards 4 roles (Protagonist/Antagonist/Companion/Extra) — KHÔNG dùng pattern Photos 5 Subject Types
- Per-character: face refs N + body refs M + description prose + AI Generate stub
- Project Setting Dialog toggle (Có thoại / Không thoại) là property toàn phim, NOT per-character
- Script multi-stage pipeline 5 stages with user review between (Q2 approach d)
- Storyboard 4 status badges (rendered ✓ / rendering ⚙ / pending ○ / locked 🔒)
- Grid size linh hoạt per-shot (2×2 insert / 3×3 default / 4×3 action) — NOT fix 12 frames
- Video AI provider dropdown với custom add (Grok et al), không phải button grid
- Voice context-aware (auto Skip nếu Dialog=Không thoại, suggest Narrator optional)
- Music brief per-scene
- Bundle Export folder tree theo Mockup 5 verbatim

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
Đây là KSP Image Chrome extension v0.9.3-r1 (TVC archived, Foundation cleanup done) →
đang phát triển Mode Film theo 5 mockup đã chốt + 5-stage Multi-stage Script pipeline.

Đọc file HANDOFF.md trong Project Knowledge để hiểu context (đặc biệt section
"FILM MODE VISION" với 6 cốt lõi + 5 Mockups + Sprint roadmap r2→r7).

Sau đó [yêu cầu mới của Jason].
```

---

## 🗺 File paths reference

- **Source code:** `~/Downloads/ksp-image-ext/`
- **Distribution zips:** `~/Downloads/ksp-image-ext-v*.zip`
- **GitHub:** https://github.com/hoangdungksp/KSP_Image_Prompt
- **Active branch:** `main` (Sprint 0.9.3-r1 pushed)
- **Save point tag:** `v0.9.1-r12` (Photos mode complete — KHÔNG TOUCH)
- **Next save point:** `v0.9.3-r1` (sẽ tag sau khi Jason verify Chrome load OK)

---

End of handoff. Chat mới có thể bắt đầu ngay với context này.
