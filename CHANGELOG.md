# Changelog

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
