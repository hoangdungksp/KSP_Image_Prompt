
# KSP Image Chrome Extension — Handoff Document
## Status: v0.9.1-r11 (in active dev) — Continue trong chat mới

**Last updated:** Saturday, May 9, 2026

---

## 🎯 Quick Context cho Claude mới

Tôi là **Jason** (Vietnamese, prefer "Jason" in EN). Đang phát triển Chrome extension **KSP Image** để generate AI prompts cho Banana Pro / Nano Banana / video AI tools (Seedance, Veo3, Kling, Sora).

**Stack:** React + TypeScript + Vite + Zustand + Dexie + Tailwind + JSZip + CRXJS
**Source:** `/home/claude/ksp-v0.9.1/` (extract zip vào đây)
**Install path Mac:** `~/Downloads/ksp-image-ext/`
**Update command:** `bash ~/Downloads/ksp-image-ext/update.sh`

**Workflow preference:**
- Communicate trong tiếng Việt
- Mình tự quyết → confirm rồi code
- Output ZIP file via present_files (zip from inside project folder, no parent nesting)
- 1 dòng lệnh duy nhất để update
- **Self-test runtime trước khi ship** (tsc + build KHÔNG ĐỦ — phải có vitest + happy-dom + puppeteer screenshot để catch infinite loops, undefined errors, layout bugs)
- Discuss design trước khi code feature mới (Hướng A/B/C/D format)
- Khi ≤3 files change → output individual files để replace
- Khi export ZIP → zip from inside project folder (no parent folder nesting) cho upload Google AI Studio
- Lô lớn OK nếu pre-approved

---

## 📦 Latest version state

**v0.9.1-r11** — Photos mode complete refactor + 100 poses + camera angle enforcement.

Từ v0.9.0 (multi-mode AI cinema toolkit) → **v0.9.1 Photos mode hoàn chỉnh** với Engine A+ (12-block Danh Seven format + 8 KSP improvements), 100 poses, 12 camera angles có MANDATORY enforcement, Snip-to-save Pinterest, Library Picker, brand specificity, Custom Intent VN→EN translate, per-section colors, section collapse, Generate Prompts gradient button.

### v0.9.1 release progression (r1 → r11)

| Release | Major changes |
|---|---|
| r1-r3 | Engine A+ refactor (12 blocks), Library Picker, brand specificity, Custom Intent, section colors, ZIP filename `01_/02_/03_` |
| r4 | Snip-to-save initial (camera icon for Pinterest pins without `<img>` tags) |
| r5 | Fix duplicate library save (clear queue BEFORE processing) + thicker section borders |
| r6-r7 | Snipper defensive cleanup + log inspector debug helper |
| r8 | Fix snip permission — literal `<all_urls>` required (NOT `https://*/*`) |
| r9 | Fix snip false-error — 2-channel `SNIP_DONE` via `chrome.tabs.sendMessage` (sendResponse unreliable in MV3) |
| r10 | 100 poses + 12 camera angles + Generate Prompts gradient button + iPhone 17 Pro Max + 4K resolution + section header collapse + bỏ separators ━━━ |
| r11 | Fix UI section width (margin 0 8px → margin-bottom 16px) + MANDATORY camera angle enforcement at TOP of prompt (research-driven strong wording for Banana Pro/Imagen) |

### Big additions vs v0.9.0

- **Engine A+** — 12 builders verbatim Danh Seven format (`src/engine/blocks_a_plus.ts` + `assembler_a_plus.ts`)
  - FACE LOCK (multi-face avg), REFERENCE META, APPEARANCE, OUTFIT, POSITION, BACKGROUND, ATMOSPHERE, LIGHTING, COMPOSITION, CAMERA, NEGATIVE, OUTPUT
  - Per-shot mood (6 variations), camera-shot match (close-up→85mm, full→35mm, wide→24mm)
  - Anti-AI-beautified phrases, Skin Paradox, anti-portrait-mode for documentary
- **100 poses** — `src/engine/poses_a_plus.ts` (10 categories: walking 10, standing 12, sitting 10, lying 8, hand_gesture 15, gaze 10, prop 10, action 10, nature 10, selfie 5)
- **12 camera angles** — `src/engine/angles.ts` extended từ 8 → 12 (added: dutch_tilt, worm_eye, selfie_pov, looking_up_pov)
- **MANDATORY CAMERA ANGLE block** — injected at TOP of prompt for max AI attention. Strong wording với specific position + degrees + "Do NOT use [opposite]" hard constraint. Repeated 2x (top + Camera block).
- **Snip-to-save** — content script `src/snipper.ts` với fullscreen overlay + drag region capture. Background `OffscreenCanvas` crop. 2-channel SNIP_DONE listener.
- **Library Picker** — modal overlay với grid 3-col, auto-refresh on `PENDING_IMPORT_ADDED` + `SNIP_DONE`
- **Brand specificity field** — Cast UI input "VD: Apple Watch white strap, Honda Vision titanium silver" → inject vào outfit block
- **Custom Intent** — VN textarea + 🌐 Dịch button (call Gemini translateVnToEn) → English EN cộng vào theme description
- **Per-section colors** — Project (blue), Cast (purple), Camera (cyan), Idea (gold), ImageGen (coral)
- **Section collapse** — click header → toggle, caret ▼ rotate -90°
- **Generate Prompts button** — gradient tím→hồng (`#8b5cf6 → #ec4899`) với box-shadow + hover lift
- **Pose + Camera Angle dropdowns** — Image Gen có 2 dropdowns: "Auto-vary all 100" / "Vary trong category" / "Specific pose"
- **Per-shot ✏ edit popup** — click ✏ trên shot → modal đổi pose / angle / free-text note

### File structure (v0.9.1 additions)

```
src/
├── engine/
│   ├── blocks_a_plus.ts            # NEW — 12 builders Danh Seven format
│   ├── assembler_a_plus.ts         # NEW — orchestrates với MANDATORY block
│   ├── poses_a_plus.ts             # NEW — 100 pose presets
│   ├── angles.ts                   # EXTENDED — 8 → 12 angles + enforcement field
│   ├── photosPromptBuilder.ts      # UPDATED — uses A+ assembler, injects pose.en
│   ├── themes.ts                   # 319 themes catalog (unchanged)
│   └── gemini.ts                   # translateVnToEn helper (unchanged)
├── components/
│   ├── CastPhotosSection.tsx       # NEW — Photos cast với 📁/📷 icons + brand input
│   ├── CameraStyleToggleV09.tsx    # UPDATED — iPhone 17 Pro Max label
│   ├── PhotosIdeaSection.tsx       # UPDATED — Custom Intent VN textbox + 🌐 Dịch
│   ├── PhotosImageGenSection.tsx   # UPDATED — pose+angle dropdowns + gradient button + ShotEditPopup
│   ├── LibraryPicker.tsx           # NEW — Library overlay modal với grid 3-col
│   ├── Editor.tsx                  # UPDATED — bỏ separators + click handler toggle collapse
│   ├── v0_9_0.css                  # UPDATED — section borders 1px#3a3a40 + per-section colors + collapse caret
│   └── v0_9_1_photos.css           # NEW — Photos-specific styles (margin-bottom 16px, gradient button)
├── store/
│   ├── photos_actions.ts           # UPDATED — autoPickShots accepts {poseId, poseCategory, angleId}
│   └── db.ts                       # UPDATED — processPendingImports clears queue FIRST (race fix)
├── types/
│   └── photos_v091.ts              # UPDATED — +posePresetId, +brandSpecificity, +customIntentVi/En
├── snipper.ts                      # NEW — content script standalone IIFE for snip overlay
└── background.ts                   # UPDATED — SNIP_START/REGION/DONE handlers + persistent SNIP_CATEGORY_KEY
```

### Test status

- ✅ TypeScript: 0 errors
- ✅ Vite production build: 102 modules + snipper.js IIFE, ~7s
- ✅ **Vitest runtime: 56/56 tests PASS**
  - 14 base v0.9.0 tests
  - 25 photos mode tests (cast, theme, autoPickShots, prompt building)
  - 6 Engine A+ regression tests (single-face, multi-face, BOKEH, DOC, Skin Paradox)
  - 3 Custom Intent tests
  - 6 r10 tests (100 poses, 12 angles, iPhone 17, 4K, pose injection, auto-vary distribution)
  - 4 r11 enforcement tests (Worm/Bird/Dutch wording + repetition check)
- ✅ Puppeteer screenshot self-test: errors=0, cards fit container, outfit≈face 48px, picker overlay opens

---

## 📋 Recent activity log (May 9, 2026 — full session)

### Session goal
Build Photos mode hoàn chỉnh → MANDATORY camera angle enforcement (Banana Pro friendly).

### What got done

1. **Engine A+ refactor** (r1-r3) — 12 builders Danh Seven verbatim + 8 KSP improvements
   - Multi-face avg lock, anti-AI-beautified, per-shot mood, camera-shot match, lighting recipe, composition, output control
   - -38% prompt length BOKEH, -44% DOCUMENTARY (3126 chars vs 5049 cũ)
2. **319 themes catalog** — Vietnamese-first themes (already existed, integrated với UI)
3. **Library Picker** — overlay modal mở từ Cast section, auto-flush queue, listen PENDING_IMPORT_ADDED + SNIP_DONE
4. **Brand specificity field** — Cast input → inject vào *Outfit:* block
5. **Custom Intent** — VN textarea + 🌐 Dịch → Gemini translate → EN cộng vào theme description
6. **Section colors** — 5 categories có màu border riêng (blue/purple/cyan/gold/coral)
7. **Section collapse** — click header → toggle (caret ▼ rotate)
8. **Bỏ separators** — "━━━ PROJECT/ASSETS/PIPELINE ━━━" removed
9. **Snip-to-save** (r4-r9 debugging journey)
   - r4: initial implementation
   - r5: fix duplicate library save (clear queue BEFORE processing)
   - r6-r7: defensive cleanup + log inspector
   - r8: fix permission — literal `<all_urls>` required
   - r9: fix false-error — 2-channel SNIP_DONE via `chrome.tabs.sendMessage`
10. **100 poses + 12 camera angles** (r10) — `poses_a_plus.ts` + extended `angles.ts`
11. **Generate Prompts button** (r10) — gradient tím→hồng với box-shadow + hover lift
12. **iPhone 17 Pro Max + 4K** (r10) — engine output current 2026 flagship + 2160x3840 cho 9:16
13. **Pose + Angle dropdowns** (r10) — Image Gen với search categorized + Auto-vary default
14. **Per-shot ✏ edit popup** (r10) — đổi pose/angle/free-text inline
15. **MANDATORY CAMERA ANGLE enforcement** (r11) — research-driven strong wording at TOP of prompt
    - All 12 angles có `enforcement` field với specific position + degrees + "Do NOT use [opposite]"
    - Inject ở đầu prompt (max AI attention)
    - Repeat 2x trong Camera block
16. **UI section width fix** (r11) — `margin: 0 8px` → `margin-bottom: 16px` × 4 photos sections (root cause: sau khi bỏ separators, không có spacing tự động)

### Verified working (Jason confirmed)
- ✅ Engine A+ generate prompts với 12 blocks
- ✅ Library Picker overlay opens
- ✅ Brand specificity inject vào prompt
- ✅ Custom Intent translate VN→EN
- ✅ Section colors visible
- ✅ Section collapse toggle
- ✅ Snip-to-save (r9 working — image saves to library, false-error eliminated)
- ✅ 100 poses dropdown searchable
- ✅ Generate Prompts gradient button visible
- ✅ Section width + spacing fixed (r11)

### Pending real-world test
- 🟡 r11 MANDATORY camera angle enforcement — anh chưa test với Banana Pro/Nano Banana xem ảnh có ra đúng góc không (Worm's Eye, Bird's Eye, Dutch Tilt)

---

## 🎯 Bugs fixed during v0.9.1 dev

### Critical: Infinite re-render loop crash (carried from v0.9.0)
Selector return new object → fix với primitive select + useMemo. Files affected: `ProjectSettingSectionV09.tsx`, `CastSectionV09.tsx`.

### v0.9.1 specific bugs

| Bug | Root cause | Fix | Release |
|---|---|---|---|
| React reserved `ref` prop crash | `<FaceSlot ref={...} />` xung đột React internal | Renamed `imageRef` | r1 |
| Camera Style cards text overflow | flex layout không wrap | flex→grid `auto+1fr` | r1 |
| Outfit slot too large | Default size không match face | 48×48px (1/6 grid) | r1 |
| Cast row dropdown stretching | flex stretch | grid `[type] [name] [×]` | r1 |
| Library duplicate save | Clear queue AFTER process → race | Clear queue **BEFORE** process (atomic-ish) | r5 |
| Section borders too faint | 0.5px#1f1f22 invisible on dark | 1px#3a3a40 + box-shadow | r5 |
| update.sh hardcoded pattern | `ksp-image-ext-v0_9_0.zip` | Glob `ksp-image-ext-*.zip` | r5 |
| Snip "Background returned no response" | `<all_urls>` permission missing (NOT `https://*/*`) | Add literal `<all_urls>` | r8 |
| Snip false-error after save success | sendResponse unreliable in MV3 SW | 2-channel via `chrome.tabs.sendMessage(senderTabId, SNIP_DONE)` | r9 |
| Snip session expired | SW sleep loses `pendingSnipCategory` variable | Persist to `chrome.storage.local.SNIP_CATEGORY_KEY` | r7 |
| Snipper guard locks re-snip | `__kspSnipperActive=true` không reset on cleanup fail | Always remove leftover overlay first | r6 |
| iPhone 15 Pro outdated | Em pick model 2024 cho safety | iPhone 17 Pro Max (current 2026, web-confirmed) | r10 |
| Resolution 1080x1920 | TikTok min, không phù hợp 4K AI | 2160x3840 (4K vertical) cho 9:16 | r10 |
| "Auto-pick 6 angles khác nhau" generic | User không biết button làm gì | Rename "⚡ Generate Prompts" + gradient | r10 |
| Section width narrow (Photos) | `margin: 0 8px` → 16px narrower than Project Setting | `margin-bottom: 16px` × 4 sections | r11 |
| Sections dính sát (no spacing) | Sau khi bỏ separators, không có buffer | margin-bottom 16px provides gap | r11 |
| Camera angle ignored by AI | Wording yếu ("Camera angle: low") | MANDATORY block ở TOP với specific position + degrees + "Do NOT use [opposite]" + repetition | r11 |

**Lesson v0.9.1:** MV3 service worker quirks (sendResponse channel unreliable + SW sleep) cần defensive 2-channel design. AI image gen prompts cần strong wording + early position + repetition để bind correctly.

---

## 🚧 Pending decisions

Hiện tại không có decisions đang đợi. Tất cả major design choices đã chốt trong session r1-r11.

### Architectural decisions locked (v0.9.1)

| Topic | Decision | Source |
|---|---|---|
| Photos mode pipeline | Cast → Camera Style → Idea → Image Gen (4 sections) | r1 |
| Engine | A+ format (12 blocks Danh Seven verbatim + 8 KSP improvements) | r2 |
| Camera Style | 2 modes — BOKEH (Sony A7R V/Canon R5) + DOCUMENTARY (iPhone 17 Pro Max) | r10 |
| Resolution map | 9:16=2160x3840, 16:9=3840x2160, 1:1=3072x3072, 3:4=2304x3072, 2:3=2048x3072 | r10 |
| Pose system | 100 poses across 10 categories (TikTok travel girl Việt Nam genre) | r10 |
| Camera angles | 12 total (8 cũ + dutch_tilt, worm_eye, selfie_pov, looking_up_pov) | r10 |
| Auto-vary default | Generate Prompts → 6 shots với 6 poses + 6 angles khác nhau | r10 |
| Camera angle enforcement | MANDATORY block at TOP of prompt + repetition trong Camera block | r11 |
| ZIP filename | `01_face_front.jpg`, `02_face_<label>.jpg`, ..., `0N_outfit.jpg` (numeric prefix matches "Image #N" trong prompt) | r3 |
| Custom Intent translate | Lazy-load Gemini client (chỉ khi user click 🌐 Dịch) | r5 |
| Snip architecture | 2-channel SNIP_DONE (sendResponse + tabs.sendMessage) | r9 |
| Section spacing | margin-bottom: 16px, no horizontal margin | r11 |

---

## 🚦 Sprint roadmap (next session)

### Immediate (anh test r11 trước)
- 🟡 **Test r11 camera angle enforcement với Banana Pro/Nano Banana**
  - Pick Worm's Eye → Generate → paste prompt vào Banana Pro → verify ảnh ra đúng góc cực thấp
  - Pick Bird's Eye → verify top-down 90°
  - Pick Dutch Tilt → verify horizon diagonal
  - Nếu vẫn không hoạt động → tăng cường wording, thêm references cụ thể, hoặc test với negative prompt mạnh hơn

### Short-term (sau khi r11 verified)
- **Output preview trong sidebar** — hiện chỉ có refs thumb, chưa preview ảnh đã gen từ Banana Pro
- **Batch download all shots** — 1 ZIP gộp 6 shots (mỗi shot 1 sub-folder với prompt + refs)
- **Per-shot custom intent** — anh edit Custom Intent riêng cho từng shot (hiện global per-project)

### Medium-term (next mode focus)
- **Cast section Film mode** — `CastSectionV09.tsx` chưa test thoroughly (có thể có bug như Cast Photos lúc đầu)
- **Pipeline Film mode** — Idea → Script → Storyboard → Image Gen → Video AI → Voice → Music → Bundle
- **TVC mode pipeline** — Idea → Concept → Storyboard → Image Gen → Voice → Music → Bundle
- **Product Photo mode** — lighting setup + simplified storyboard

### Long-term (v1.0+)
- **IndexedDB blob storage** — thay base64 dataURL → giảm memory ~70% (Image binary 5MB+ mỗi project)
- **Music mode (MV ca sỹ ảo)**
- **AI Generate face/body in Cast** — wire Imagen 4 API
- **TTS audio generation** — wire ElevenLabs/Google TTS API
- **Single-frame regen API** — wire Nano Banana API

---

## 🐛 Known bugs (current)

| Bug | Status | Priority | Notes |
|---|---|---|---|
| r11 camera angle enforcement chưa test với Banana Pro | 🟡 Pending real test | High | Anh đã code MANDATORY wording, chưa verify hình ra đúng góc |
| Image storage = base64 dataURL | 🟡 Performance | Medium | 5MB+ images make project files huge. Migrate to IndexedDB blob |
| AI Generate face/body | 🔴 Stub | Low | Prompt build OK, API call shows alert |
| TTS audio generation | 🔴 Stub | Low | UI works, ElevenLabs API call deferred |
| Single-frame regen | 🔴 Stub | Low | UI works, Nano Banana call deferred |
| Bundle Export image binaries | 🔴 Stub | Low | ZIP exports prompts/configs only, image PNG bundling needs IDB read |

---

## 🎬 v0.9.1 — Workflow Photos mode (verified end-to-end)

1. Click extension icon → sidebar mở (no separators, 5 sections với màu riêng)
2. **PROJECT SETTING** — Mode=Photos, Aspect=9:16. Click header → collapse/expand
3. **CAST** — `+ Thêm` → female cast → upload 1-3 face refs (front + 3/4 left + 3/4 right)
   - Optional: upload outfit ref OR right-click Pinterest → Save to KSP Image → Save as Outfit
   - Optional: 📷 Snip vùng outfit từ Pinterest pin không có `<img>` tag
   - Optional: gõ Brand & Accessories ("Apple Watch white strap, Honda Vision titanium silver")
4. **CAMERA STYLE** — pick BOKEH (Phe A — Sony A7R V) hoặc DOCUMENTARY (Phe B — iPhone 17 Pro Max)
5. **Ý TƯỞNG** — pick theme từ 319 themes catalog, hoặc gõ ý tưởng tự do
   - Optional: gõ Custom Intent VN ("cầm bó hoa hồng đỏ thay vì hoa cúc") → click 🌐 Dịch → EN tự động cộng vào prompt
6. **IMAGE GEN:**
   - Pick Cast + Số shot (3/6/9)
   - Pick POSE: Auto-vary all 100 / Vary trong category / Specific pose
   - Pick CAMERA ANGLE: Auto-vary 12 / Specific angle
   - Click **⚡ Generate Prompts** (gradient button) → tạo N shots
   - Per-shot: 📋 Copy prompt (13 blocks EN) | 📥 Download refs ZIP | ✏ Edit pose/angle | ✕ Remove
7. **Paste prompt + upload ZIP refs** vào Banana Pro / Nano Banana → render

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
- Kling 2.0: $0.10/sec, max 10s

iPhone reference (May 2026):
- iPhone 17 Pro / Pro Max: $1,099 / $1,199 (current flagship, ra Sep 2025)
- iPhone 18 Pro / Pro Max: launching September 2026

---

## ⚙️ Cập nhật v0.9.1

```bash
bash ~/Downloads/ksp-image-ext/update.sh
```

→ `chrome://extensions` → KSP Image → ↻ Reload (BẮT BUỘC nếu manifest đổi permission) → đóng/mở side panel.

---

## 🧪 Test sau khi load r11

1. **Click extension icon** → sidebar mở
2. **Verify UI fix:** 5 sections rộng đều nhau (không bị nhỏ hơn Project Setting), spacing 16px giữa sections
3. **Verify section colors:** Project (blue), Cast (purple), Camera Style (cyan), Ý Tưởng (gold), Image Gen (coral)
4. **Verify collapse:** click section header → toggle, caret ▼ → ▶
5. **Verify Photos workflow:** Photos mode → Cast → Library Picker / Snip-to-save → Camera Style → Idea → Generate Prompts (gradient)
6. **Verify camera angle enforcement (r11 main test):**
   - Pick "🐛 Worm's Eye" → Generate Prompts → click 📋 copy prompt
   - Verify đầu prompt có `*MANDATORY CAMERA ANGLE — WORM'S EYE:*` block
   - Verify wording: "ground level", "lens upward 70-80 degrees", "Do NOT use eye level"
   - Paste vào Banana Pro → render → check ảnh có ra đúng góc cực thấp + sky 70% trên

Test xong gửi feedback theo format `[Section] [Action] → [Expected vs Actual]`.

---

## 🎁 Other parallel projects

Jason cũng đang làm:
- **KSP AutoFlow** (Chrome extension v4→v5 refactor for AI filmmaking automation, Grok Imagine + Google Flow)
- **KSP Studio** (web app cho film production, Cinema module, Storyboard V2, Lock Prompt, Master Prompt)
- **LinguTab** (Chrome extension cho Vietnamese learners of Chinese/English, Chirp 3 HD TTS)
- **Facebook auto-poster** Chrome extension (Substack RSS + Gemini Vision)
- **AWE USA 2026** sponsorship outreach (Long Beach, June 15-18)
- **YouTube channel @DungThichVar** (XR/VR/AR/smart glasses reviews, Vietnamese audience)

Khi nào nói tới các project này, đó là cùng ecosystem nhưng repo riêng.

---

## 📌 Current memory edits (Jason preferences)

- Vietnamese-first communication, address as "Jason" (not "Dung")
- Workflow: 5-10 client revisions/tuần cho storyboards
- Prefer 1-line update commands
- Prefer ZIP output via `present_files` (zip from inside project folder, no parent nesting)
- Confirm trước khi code feature lớn
- Discuss design trước khi code feature mới (Hướng A/B/C/D format)
- **Phải self-test runtime với vitest + puppeteer trước khi ship** (lesson learned từ v0.9.0 infinite loop bug + v0.9.1 layout bugs)
- Khi ≤3 files change → output individual files for replacement
- Lô lớn OK if pre-approved

---

## 📝 Câu hỏi gợi ý cho chat mới

```
Đây là KSP Image Chrome extension v0.9.1-r11, đang dev tiếp.
Đọc file HANDOFF.md để hiểu context (đặc biệt section Recent activity log + Sprint roadmap).
Sau đó [yêu cầu mới của Jason].
```

Hoặc:

```
Tôi cần test/fix [vấn đề] trong KSP Image v0.9.1-r11.
Source ở /home/claude/ksp-v0.9.1/.
Đọc HANDOFF.md trước, đặc biệt section Known bugs + Pending real-world test.
```

---

End of handoff. Chat mới có thể bắt đầu ngay với context này.
