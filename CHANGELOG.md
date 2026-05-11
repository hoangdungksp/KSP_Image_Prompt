# Changelog

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
