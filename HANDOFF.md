# KSP Image Chrome Extension — Handoff Document
## Status: v0.9.1 (Released) — Continue trong chat mới

---

## 🎯 Quick Context cho Claude mới

Tôi là **Jason** (Vietnamese, prefer "Jason" in EN). Chrome extension **KSP Image** — generate AI prompts cho Banana Pro / Nano Banana / video AI tools.

**Stack:** React + TypeScript + Vite + Zustand + Dexie + Tailwind + JSZip
**Source:** `/home/claude/ksp-v0.9.1/` (extract zip vào đây)
**Update command:** `bash ~/Documents/ksp-image-ext/update.sh`

**Workflow preference:**
- Communicate tiếng Việt
- Confirm rồi code
- Output ZIP file via present_files (zip from inside project folder, no parent nesting)
- 1 dòng lệnh duy nhất để update
- **Self-test runtime với vitest** trước khi ship (tsc + build KHÔNG ĐỦ)
- Discuss design trước khi code feature mới (Hướng A/B/C/D format)

---

## 📦 Latest version state

**v0.9.1** — Photos mode functional + Project Setting bug fixes.

### Big additions vs v0.9.0

#### Project Setting bug fixes (B1-B3)
- Time format ẩn ở Photos mode (Photos = single image, không cần timing)
- API Keys + AI Provider + Storage collapsed mặc định, chỉ BASIC INFO mở
- AI Provider per-task ẩn các field theo mode (Photos chỉ Image gen, etc.)

#### Connector global (C1)
- Line height 22px → 10px (áp dụng toàn extension)

#### Photos mode v0.9.1 — full functional pipeline
- **Cast**: 5 Subject Types (Female/Male/Couple/Family/Friends Group), dynamic 1-6 face refs (progressive disclosure, slot 0 luôn "front"), 1 outfit ref optional
- **Camera Style toggle**: BOKEH/DOCUMENTARY (HANDOFF Nguyên tắc 1)
- **Idea**: Theme picker với search + 12 categories + 227+ themes (reused từ `engine/themes.ts`)
- **Image Gen**: list view 6 shots default, auto-pick 8 angle presets, copy prompt + download refs ZIP
- **Engine**: adapter `engine/photosPromptBuilder.ts` reuses existing v0.4 13-block assembler (Skin Paradox + Identity Lock auto-defer + dynamic single/multi-face logic + BOKEH/DOCUMENTARY magic phrases verbatim)

### File structure — additions in v0.9.1

```
src/
├── types/
│   ├── photos_v091.ts                  # NEW — Photos mode schema
│   ├── v0_9_0.ts                       # +photosV091 field on ProjectV09Extensions
│   └── index.ts                        # +export photos_v091
├── store/
│   └── photos_actions.ts               # NEW — CRUD pure functions
├── components/
│   ├── Editor.tsx                      # MODIFIED — Photos pipeline + connector 10px
│   ├── ProjectSettingSectionV09.tsx    # MODIFIED — B1+B2+B3 fixes
│   ├── CastPhotosSection.tsx           # NEW
│   ├── CameraStyleToggleV09.tsx        # NEW
│   ├── PhotosIdeaSection.tsx           # NEW
│   ├── PhotosImageGenSection.tsx       # NEW
│   ├── v0_9_1_photos.css               # NEW
│   └── v0_9_0.css                      # MODIFIED — connector 10px
├── engine/
│   └── photosPromptBuilder.ts          # NEW — adapter to v0.4 assembler

test/
└── photos_mode.test.tsx                # NEW — 21 runtime tests
```

### Test status v0.9.1

- ✅ TypeScript: 0 errors
- ✅ Vite production build: 102 modules, ~8s
- ✅ **Vitest runtime: 35/35 PASS** (21 new Photos + 14 legacy)

---

## 🚧 Known limitations v0.9.1 (deferred to v0.9.2+)

| Feature | Status | Notes |
|---|---|---|
| Multi-model per project | Single active cast | Cast switching via dropdown for now |
| Image storage | base64 dataURL | Heavy — IndexedDB blob in v0.9.2 |
| Batch download all shots | Per-shot only | Batch ZIP all → v0.9.2 |
| Output preview | Refs thumbs only | User paste prompt into Banana Pro |
| AI Generate face/body in Cast (Film) | Stub | Wire-up Imagen 4 in v0.9.2 |
| TTS audio generation | Stub | UI works, API call deferred |
| Photos mode UI | ✅ DONE in v0.9.1 | — |
| Product Photo mode UI | Deferred | v0.9.2+ |

---

## 🎬 Photos mode — Workflow đã verify end-to-end

1. Project Setting → Mode = Photos (Time format auto ẩn, AI Provider chỉ show Image gen)
2. **ASSETS** → CAST → "+ Thêm" → chọn Subject Type (5 options) → upload 1-6 face refs (slot đầu auto label "front") → outfit ref optional
3. **PIPELINE**:
   - Camera Style: pick BOKEH (portrait/áo dài) hoặc DOCUMENTARY (sport/street)
   - Step 1: pick theme từ 227+ catalog (search + categories) hoặc gõ ý tưởng tự do
   - Step 2: Auto-pick 6 angles → list view → mỗi shot:
     - 📋 Copy → paste prompt 13 blocks vào Banana Pro
     - 📥 Download → ZIP với face-1.jpg, face-2.jpg, ..., outfit.jpg + README.txt order

---

## 🚦 Architecture decisions v0.9.1 (locked)

| Topic | Decision | Source |
|---|---|---|
| Photos Cast | 5 Subject Types (HANDOFF prompt engineering doc) | Confirmed |
| Photos face refs | Dynamic 1-6, slot 0 = "front" locked | Q after design discussion |
| Photos outfit | 1 slot optional | Confirmed |
| Photos prompt logic | Dynamic single (N=1) vs multi-face (N≥2) | Confirmed |
| Camera Style toggle | TOP của PIPELINE, BOKEH default | HANDOFF Nguyên tắc 1 |
| Image Gen layout | List view (không grid) | Confirmed |
| Connector line | 10px global toàn extension | Confirmed |
| AI Provider per-task | Ẩn các field theo mode applicable | Confirmed |

---

## 📝 Câu hỏi gợi ý cho chat mới

```
Đây là KSP Image Chrome extension v0.9.1, đang dev tiếp.
Đọc file HANDOFF.md để hiểu context, sau đó [yêu cầu mới].
```

### Recently chốt + đang chờ test

Jason đang **test từng section** một. Đã xong:
- ✅ Project Setting (B1-B3 fixed)
- ✅ Photos mode pipeline (mới ship)

Tiếp theo Jason sẽ test:
- Cast section (Film mode) — xem CastSectionV09.tsx có bug không
- Pipeline Film mode (Idea → Script → Storyboard → Image Gen → Video AI → Voice → Music → Bundle)
- TVC mode pipeline

Khi test, Jason format bug:
```
[Section] [Action] → [Expected] vs [Actual] + screenshot/console
```

---

End of handoff. Chat mới có thể bắt đầu ngay với context này.
