# MOCKUPS_FILM.md — Film Mode Design Spec

**Sprint 0.9.3 implementation spec — Locked May 11, 2026 (post-r4)**

Đây là tài liệu thiết kế chính thức cho Mode Film trong KSP Image Chrome extension. Mọi quyết định UI/UX/schema được lock trong file này. Khi Claude mới đọc, KHÔNG cần hỏi clarify implementation details — tất cả answers đã chốt.

Tài liệu này bổ sung cho HANDOFF.md (vision + roadmap) và CHANGELOG.md (trạng thái code). Đọc cả 3 file để pickup context đầy đủ.

**⚠️ QUAN TRỌNG cho Claude mới:** Đọc cả section "🔒 Implementation locks Q1-Q6" VÀ "🚨 UI POLISH ADJUSTMENTS LOCKED (r3.1 + r4)". Polish adjustments **OVERRIDE** spec gốc cho các phần đã chỉnh sửa. KHÔNG được apply lại spec gốc cho những phần đã polish (avatar, cards background, dialog segmented, aspect ratio labels dài, etc.).

---

## 🔒 Implementation locks (Q1-Q6 chốt May 11)

### Q1 — Layout multi-character cards
**Hướng A: Vertical full-width cards stack dọc.** Mỗi character 1 card chứa name + role + description + face/body refs badges + edit/delete actions. Match pattern Photos Cast. KHÔNG dùng grid 2-col compact hay accordion. (Polish r4 chỉnh: bỏ avatar circle, bỏ background+border, separator subtle line — xem section Polish bên dưới.)

### Q2 — Role selector
**Dropdown free 4 options, KHÔNG constraint.**
- Options: `Protagonist` (Nhân vật chính) / `Antagonist` (Phản diện) / `Companion` (Bạn đồng hành) / `Extra` (Phụ)
- Buddy films có 2 protagonists hợp lệ
- Engine prompt builder show warning yellow nếu missing Protagonist nhưng KHÔNG block save/render

### Q3 — Face/Body/Outfit schema
- **Face refs:** 1-4 ảnh (giảm từ Photos 1-6)
- **Body refs:** 1-3 ảnh (front/side/back)
- **Outfit slot riêng: BỎ** — gộp vào Body refs (body ảnh đã chứa outfit)

### Q4 — AI Generate Face/Body button
**Hướng B: Button stub + modal description prose, save vào schema, KHÔNG call API ở r2.**
- Button render đầy đủ với icon sparkles + label "AI Generate"
- Click → open modal có textarea "Mô tả character" (Vietnamese)
- Save description vào field `aiGenDescription`
- Sprint 0.9.4 wire Imagen 4 API thật

### Q5 — Project Setting fields mới + defaults

| Field | Type | Options | Default |
|---|---|---|---|
| Dialog | **Dropdown** (chỉnh r4, không phải segmented) | `🔇 Không thoại` / `💬 Có thoại` | `Không thoại` |
| Genre | Dropdown single | 6 options (Drama / Sci-fi / Action / Romance / Thriller / Comedy) | `Drama` |
| Animation Style | Dropdown | 4 options v0.9.3 (Live Action / Anime / 3D CGI / Film Noir) | `Live Action` |
| Aspect Ratio | Dropdown | 7 options nhãn gọn (xem r4 polish lock) | `16:9` |
| Duration | Integer input | 1-60 phút | `5` |

### Q6 — Strategy xoá CastSectionV09 (và các section cũ khác)
**Hướng A atomic** cho mọi sprint r2-r7: build new + route + xoá old trong CÙNG 1 ship. Photos KHÔNG bị ảnh hưởng (sections riêng).

---

## 🚨 UI POLISH ADJUSTMENTS LOCKED (r3.1 + r4 — May 11)

Sau khi ship r2 (Mockup 1 Cast) và r3 (Mockup 2 Idea+Script), Jason feedback nhiều adjustments. Tất cả đã apply trong r3.1 + r4. Chat mới **PHẢI** áp dụng các locks này, không revert về spec gốc.

### A) Project Setting — Layout adjustments

| Item | Spec gốc | LOCKED (r3.1 + r4) |
|---|---|---|
| Time Format ở Film mode | Show | **HIDE** (chỉ show cho TVC/Product/archived modes) |
| Form rows | 2-col grid | 2-col grid ✓ (CSS fix: `.ksp-sidebar-v09 .ksp-form-row-2 { grid-template-columns: 1fr 1fr }` — đã có trong v0_9_0.css line 465-467) |
| Dialog control | Segmented 2-way buttons | **Dropdown `<select>`** với 2 options: 🔇 Không thoại (default) / 💬 Có thoại |
| Aspect Ratio labels | Long với explanations | **Rút gọn — KHÔNG có ngoặc giải thích**: `16:9 landscape`, `9:16 vertical`, `1:1 square`, `4:5 portrait`, `4:3 classic`, `21:9 cinemascope`, `2.39:1 anamorphic` |
| Duration input | text "5 phút" | Integer input `<input type="number" min={1} max={60} step={1}>` |
| BASIC INFO sub-collapsible | Có wrapper | Giữ wrapper (đã ship vậy, không revert) |

### B) Cast section — Card visual adjustments

| Item | Spec gốc | LOCKED (r4) |
|---|---|---|
| Avatar circle (R / 1 / emoji) | 36×36 role-colored circle | **BỎ HOÀN TOÀN** — `display: none` + remove DOM element. Card body 100% width. |
| Card background | `#1c1c1c` solid + border | **Transparent** + no border. Cards separated by `border-top: 0.5px solid #2c2c2c` between siblings. |
| Card border-radius | `8px` | **0** (no rounded corners cho card outer) |
| Card padding | 12px all sides | **8px 10px** (compact) |
| Card width | width auto | **100%** |
| "+ Thêm character" button | Long text | **"+ Thêm"** (gọn) |
| Footer "✨ AI gợi ý cast từ idea" | Render footer | **XOÁ HOÀN TOÀN** (không cần button stub) |
| Face refs slot | 64×64 | **44×44** (smaller per mockup) |
| Body refs slot | 64×64 | **44×44** |
| Avatar font | 14px medium | **N/A** (avatar removed) |
| AI Generate button | Medium 14px padding | **Smaller font 10px, padding 4px 10px** |

CSS class hierarchy đã ship trong `v0_9_3_film.css`:
```css
.ksp-cast-film-card { background: transparent !important; border: none !important; border-radius: 0 !important; padding: 8px 10px !important; width: 100% !important; }
.ksp-cast-film-avatar { display: none !important; }
.ksp-cast-film-body { width: 100% !important; }
.ksp-cast-film .ksp-cast-film-card + .ksp-cast-film-card { border-top: 0.5px solid #2c2c2c !important; }
.ksp-cast-film-ref-slot { width: 44px !important; height: 44px !important; }
.ksp-cast-film-ref-add { width: 44px !important; height: 44px !important; }
```

### C) Idea + Script section — Padding adjustments

| Item | Spec gốc | LOCKED (r4) |
|---|---|---|
| Outer section padding | 12px all sides | **0** (`.ksp-idea-film, .ksp-script-film { padding: 0 !important }`) |
| Inner blocks self-padding | Inherit from section | **12px left/right margin** (textarea, breadcrumb, provider toggle, actions, scenes list, feed note) |
| Section header padding | inherit | **10px 12px** (compact) |

CSS đã ship:
```css
.ksp-idea-film, .ksp-script-film { padding: 0 !important }
.ksp-idea-film .ksp-section-header, .ksp-script-film .ksp-section-header { padding: 10px 12px }
.ksp-idea-film-textarea { margin: 0 12px 12px 12px !important; width: calc(100% - 24px) !important }
.ksp-script-film-breadcrumb { margin: 0 12px 10px 12px !important }
.ksp-script-film-provider { margin: 0 12px 10px 12px !important; width: calc(100% - 24px) !important }
.ksp-script-film-actions, .ksp-script-film-content, .ksp-script-film-versions { margin: 0 12px ... 12px !important }
```

### D) Script Section — Script-specific adjustments

| Item | Spec gốc | LOCKED (r3.1) |
|---|---|---|
| Connector Idea ↔ Script | Implicit (cùng component) | **`<Connector colorFrom="#1D9E75" colorTo="#D85A30" />` giữa 2 sections** (chấm tròn + line gradient green→orange) |
| Provider toggle | Label "AI Provider:" + segmented | **KHÔNG label**, segmented split 50/50 full-width |
| Generate button | `ksp-btn-primary` default style | **Solid orange `#D85A30` filled** với class `.ksp-script-film-generate-btn` (12px font, 9px padding, full-width, hover brightness 1.05, disabled `#6b3a25` opacity 0.7) |
| 5-stage breadcrumb placeholder | Defer r7 (no stub) | **Render stub trong r3** — Stage ⑤ Dialogues active amber `#FAEEDA bg, #854F0B text`, Stage ①②③④ greyed `#2a2a2a bg, #888 text opacity 0.6` với label "5-STAGE BREADCRUMB (r7)" + status "r3 — Stage 5 quick path active. r7 sẽ add wizard Structure→Beats→Twists→Scenes." |

### E) `Connector` component — Export needed

Connector component trong `Editor.tsx` **đã export** (r3.1 change) để FilmIdeaScriptSection import + add Connector giữa 2 internal sections. Pattern:

```typescript
export function Connector({ colorFrom, colorTo }: { colorFrom: string; colorTo: string }) {
  // 7×7 circle border colorFrom + 0.5px×10px vertical line gradient + 7×7 circle border colorTo
}
```

r5+r6+r7 cũng có thể cần Connector giữa internal sections — import từ `./Editor`.

---

## 📸 Mockup 1 — Project Setting + Cast (r2 SHIPPED + r4 polished)

**Pipeline:** Step 0 (Setup)
**Section colors:** Project Setting blue border (`#378ADD`), Cast orange border (`#BA7517`)

### Layout structure (post-polish)

```
[PROJECT label]
┌─────────────────────────────────┐
│ 📁 PROJECT SETTING        [▲]   │  ← collapsible, default expanded
│ ▼ BASIC INFO                    │
│   Project name (full-width)     │
│   ┌──────────┬──────────┐       │  ← 2-col rows
│   │ Mode     │ Genre    │       │
│   │ Animation│ Dialog   │       │  ← Dialog dropdown (Q5 r4 lock)
│   │ Aspect   │ Duration │       │
│   └──────────┴──────────┘       │
│ ▶ API KEYS (collapsed)          │
│ ▶ AI PROVIDER PER TASK          │
│ ▶ STORAGE & AUTOSAVE            │
└─────────────────────────────────┘

[CAST label (nhất quán toàn phim)]
┌─────────────────────────────────┐
│ 🎭 CAST (nhất quán)   [+ Thêm]  │
│ ─────────────────────────────── │  ← character card (NO bg, NO border-radius)
│ ┌──────────┬──────────┐         │  ← Name + Role 2-col
│ │ Robot    │ Nhân vật │         │
│ └──────────┴──────────┘         │
│ Description textarea            │
│ Face refs · 1/4: [img][+]       │  ← 44×44 slots
│ Body refs · 1/3: [img][+]       │
│ [✨ AI Generate]                 │
│ ─────────────────────────────── │  ← separator line giữa cards
│ Character 2 ...                 │
└─────────────────────────────────┘
```

### Character card structure (POLISHED)

**KHÔNG có avatar circle** (r4 polish bỏ). Card chứa:
- **Name + Role row** 2-col (name input + role dropdown)
- **Description** textarea (~2 rows)
- **Face refs row**: label "Face refs · N/4" + slots 44×44 (filled thumbnails + empty `[+]` add slots, cap 4)
- **Body refs row**: label "Body refs · N/3" + slots 44×44 (cap 3)
- **AI Generate button** smaller (font 10px, padding 4×10) — gradient `linear-gradient(135deg, #5a4f8a, #7a3f5f)`
- **× remove button** positioned absolute top-right corner of card

### Role color scheme (avatar removed but role used cho engine prompt builder warnings)

| Role | EN label | VN label |
|---|---|---|
| protagonist | Protagonist | Nhân vật chính |
| antagonist | Antagonist | Phản diện |
| companion | Companion | Bạn đồng hành |
| extra | Extra | Phụ |

### Schema (already shipped)

```typescript
// src/types/film_v093.ts (DON'T MODIFY)
interface FilmCharacter {
  id: string;
  order: number;
  name: string;
  role: "protagonist" | "antagonist" | "companion" | "extra";
  description: string;
  faceRefs: FilmImageRef[];      // cap MAX_FACE_REFS_FILM = 4
  bodyRefs: FilmImageRef[];      // cap MAX_BODY_REFS = 3
  aiGenDescription?: string;     // Q4 stub, wire 0.9.4
}

interface FilmImageRef {
  id: string;
  label?: string;
  filename: string;
  mimeType: string;
  width?: number;
  height?: number;
  dataUrl: string;  // base64
}

interface FilmV093Data {
  schemaVersion: "v0.9.3-film";
  characters: FilmCharacter[];
  selectedCharacterId?: string;
  script?: FilmScript;                                     // r3
  shotsBySceneId?: Record<string, FilmShot[]>;             // r4
  scriptProvider?: "gemini-flash" | "openai-4o";
  createdAt: number;
  updatedAt: number;
}

type FilmDialogMode = "has_dialog" | "no_dialog";
```

---

## 🎬 Mockup 2 — Idea + Multi-stage Script (r3 SHIPPED + r3.1 polished)

**Pipeline:** Step 1 + 2
**Section colors:** Idea green border (`#1D9E75`), Script orange border (`#D85A30`)
**Component:** `src/components/FilmIdeaScriptSection.tsx` (đã ship)

### Layout post-polish

```
[STEP 1+2]
┌─────────────────────────────────┐  ← Idea section, padding 0
│ 💡 1. Ý TƯỞNG           [✓]     │  ← header padding 10px 12px
│   ┌─────────────────────────┐   │
│   │ Idea textarea VN        │   │  ← margin 0 12px 12px 12px
│   └─────────────────────────┘   │
└─────────────────────────────────┘
            ·                       ← Connector green → orange
┌─────────────────────────────────┐  ← Script section, padding 0
│ 📜 2. SCRIPT (Kịch bản)         │
│         4 scenes · ~5 phút      │
│   ┌─ 5-STAGE BREADCRUMB (r7) ┐  │  ← stub, margin 12px
│   │ ① Structure  (greyed)     │  │  ← Stage 1-4 disabled defer r7
│   │ ② Beats     (greyed)      │  │
│   │ ③ Twists    (greyed)      │  │
│   │ ④ Scenes    (greyed)      │  │
│   │ ⑤ Dialogues ● (active)    │  │  ← amber active
│   │ r3 — Stage 5 quick path...│  │
│   └───────────────────────────┘  │
│   ┌─ Provider 50/50 ─────────┐   │  ← NO label
│   │[✦ Gemini Flash][◯ OpenAI]│   │
│   └───────────────────────────┘  │
│   ╔═════════════════════════╗   │
│   ║ ✨ AI viết Script       ║   │  ← solid orange filled
│   ╚═════════════════════════╝   │
│   ┌─ Scene 1 ──── ▼ ────────┐   │
│   │ EXT. — DAWN — 1m20s     │   │
│   │ Action lines...         │   │
│   │ [SFX: blue inline]      │   │
│   │ [MUSIC: purple inline]  │   │
│   │ [TRANSITION: green]     │   │
│   └─────────────────────────┘   │
│   [📥 Export][📚 Versions][+]  │
│   ⓘ Script feed: ...           │
└─────────────────────────────────┘
```

### Multi-stage pipeline 5 stages (r3 ship Stage 5 only, r7 add Stage 1-4)

| # | Name | r3 status | r7 plan |
|---|---|---|---|
| 1 | Structure | Stub greyed | AI picks 3-act (default) / Hero's Journey / Save the Cat / Kishōtenketsu |
| 2 | Beats | Stub greyed | AI fills 7-9 narrative milestones, user edits |
| 3 | Twists | Stub greyed | AI suggests 1-3 twists per beat, user accept/reject |
| 4 | Scenes | Stub greyed | AI gộp beats+twists → scenes với setting + duration |
| 5 | Dialogues+SFX+Music+Transition | **ACTIVE r3** | Already shipped — 1-cú generation full script |

### Inline notes color scheme (Scene block, MUST verbatim)

| Type | Background | Border-left | Font label color |
|---|---|---|---|
| SFX | `#E6F1FB` (blue 50) | `#185FA5` 3px | mono 11px `#0C447C` (blue 800) |
| MUSIC | `#EEEDFE` (purple 50) | `#534AB7` 3px | mono 11px `#3C3489` (purple 800) |
| TRANSITION | `#E1F5EE` (green 50) | `#0F6E56` 3px | mono 11px `#085041` (green 800) |
| DIALOG | `#FBEAF0` (pink 50) | `#b87093` 3px | mono 11px `#72243E` (pink 800) |

### Dual-provider AI toggle

Provider selector full-width 50/50 (no label):
- `✦ Gemini Flash` (default)
- `◯ OpenAI 4o`

Provider persist trong `project.filmV093.scriptProvider`.

### Engine wrapper (already shipped)

`src/engine/filmScriptStages.ts` exports `runStage5Quick(input)`. Wrap existing `aiRuntime.generateFilmScript()` với adapter `adaptCharacter()` map new FilmCharacter → legacy FilmCharacterV2. Strip dialog nếu `dialog === "no_dialog"`.

r7 sẽ add: `runStage1Structure`, `runStage2Beats`, `runStage3Twists`, `runStage4Scenes`.

### Script versioning (already shipped)

- `setScript(project, script)` archive current script vào `ScriptVersion` wrapper (id/timestamp/label/scriptSnapshot), keep last 10
- `revertScriptToVersion(project, versionIndex)` restore archived snapshot, current goes to versions
- Versions panel collapsible với Revert button per version

---

## 🎥 Mockup 3 — Storyboard (r4 SHIPPED)

**Pipeline:** Step 3
**Section color:** Purple border (`#534AB7`)
**Component:** `src/components/FilmStoryboardSection.tsx` (đã ship)

### Layout

```
[STEP 3]
┌─────────────────────────────────┐  ← Storyboard section, padding 0
│ 🎬 3. STORYBOARD                │
│   N shots · M frames            │
│   ┌─ Scene 1 ──── ▼ ──────────┐ │
│   │ Scene 1 [title] 2 shots    │ │
│   │ ┌──────────────────────┐   │ │
│   │ │ Shot title input     │   │ │
│   │ │ Grid│Shot type│Status│   │ │
│   │ │ Meta · 🔒 · ×         │   │ │
│   │ └──────────────────────┘   │ │
│   │ [+ Add Shot][✨ AI sinh]   │ │
│   └────────────────────────────┘ │
│   ┌─ Scene 2 ──── ▶ ──────────┐ │
│   └────────────────────────────┘ │
│   ⓘ Grid size khác nhau...      │
└─────────────────────────────────┘
```

### Hierarchy

`script.scenes[]` (từ Script Stage 5) → `shotsBySceneId[sceneId]: FilmShot[]` (manual hoặc AI sinh).

Mỗi shot có:
- Title (titleVi/titleEn)
- Shot type (7 options): wide_establishing / medium / close_up / insert / over_shoulder / two_shot / pov
- Grid format (5 options): 2x2 (4 frames) / 2x3 (6) / 3x2 (6) / 3x3 (9 default) / 4x3 (12)
- Status badge (4 states): rendered ✓ / rendering ⚙ / pending ○ / locked 🔒
- Duration seconds
- Camera movement (defer r5)

### 4 Status badges (verbatim CSS — DON'T MODIFY)

```css
.ksp-status-rendered  { background: #EAF3DE; color: #3B6D11; } /* ✓ rendered */
.ksp-status-rendering { background: #FAEEDA; color: #854F0B; } /* ⚙ rendering */
.ksp-status-pending   { background: #2a2a2a; color: #888;    } /* ○ pending */
.ksp-status-locked    { background: #E6F1FB; color: #0C447C; } /* 🔒 locked */
```

Mapping `FilmShot["status"]` → badge:
- `rendered` / `animated` → ✓ rendered
- `frames_ready` / `prompt_ready` → ⚙ rendering
- `draft` (default) → ○ pending
- If `locked: true` → 🔒 locked (overrides status)

### Click shot → drill-down (r5)

r5 sẽ add: click shot row → open `FilmShotDetailPanel` (Mockup 4 specs bên dưới). r4 chỉ render row inline.

### AI sinh shots per-scene

Button "✨ AI sinh shots" per scene header → stub toast trong r4. r5/r6 sẽ wire `aiRuntime.generateShotsForScene()` (existing function v0.9.0). Cost ~1 AI call per scene.

---

## 🖼 Mockup 4 — Shot Detail Panel (r5 PLAN)

**Pipeline:** Step 4 + 5 (drill-down per-shot)
**Section colors:** Image Gen purple light border (`#AFA9EC`), Video AI same border
**Component to build:** `src/components/FilmShotDetailPanel.tsx`

### Trigger: click shot row trong FilmStoryboardSection

State management option A (recommended): inline expand below shot row (collapsible drawer pattern like Mockup 2 Scene cards).
Option B: modal overlay with backdrop.

**Choose Option A** cho consistency với Storyboard collapsible pattern.

### Layout

```
[STEP 4+5 drill-down per shot]
[Shot row click → expand drawer below]
┌─────────────────────────────────┐
│ [↑ collapse] Shot 1.2 — ...     │
│              ⚙ rendering         │
└─────────────────────────────────┘
            ·  ← internal connector
┌─────────────────────────────────┐
│ 🖼 4. IMAGE GEN                  │
│         Banana Pro · Imagen 4   │
│ Grid format                      │
│ [2×2] [2×3] [3×2] [3×3] [4×3]  │  ← buttons inline, selected purple bg
│ Image prompt (EN, auto-gen)     │
│ ┌─────────────────────────────┐ │
│ │ Cinematic 3×3 storyboard... │ │
│ │              N chars        │ │
│ └─────────────────────────────┘ │
│ [📋 Copy→Banana Pro][🔄 Regen]  │
│ [📥 Refs ZIP]                    │
│ Grid uploaded · auto-cropped    │
│ ┌─────┐ ┌─────┐ ┌─────┐         │
│ │ 01  │ │ 02  │ │ 03  │         │  ← thumbnails
│ └─────┘ └─────┘ └─────┘         │
│ ...                              │
│ Frame X chưa hài lòng?          │
│ [🔁 Replace single frame]        │
└─────────────────────────────────┘
            ·
┌─────────────────────────────────┐
│ 🎞 5. VIDEO AI                   │
│   Provider [dropdown]            │
│   ┌─────────────────────────────┐
│   │ ▼ Seedance 2.0 Pro          │
│   │   $0.15/s · 12s · 4000 chars│
│   │ ◯ Veo 3                      │
│   │   $0.30/s · 8s · 2500 chars │
│   │ ◯ Kling 2.0                  │
│   │ ◯ Sora                       │
│   │ ⭐ Grok Video (custom)       │
│   │   [edit][delete]             │
│   │ ──────────────               │
│   │ + Add custom provider        │
│   └─────────────────────────────┘
│   Animation prompt (EN, auto-gen)│
│   ┌─────────────────────────────┐
│   │ You are an experienced film │
│   │ director specializing...    │
│   │     2143/4000 chars (green) │
│   └─────────────────────────────┘
│   [📋 Copy → Seedance 2.0]       │
└─────────────────────────────────┘
```

### Image Gen block

- **Grid format picker**: 5 inline buttons. Selected = purple bg `#534AB7`, others transparent.
- **Auto-generated prompt EN**: AI sinh từ Scene description + Cast refs + Animation Style + Shot type + Grid format. Char count display.
- **Copy → Banana Pro** primary action (purple bg)
- **Regen** secondary (refresh prompt với same inputs)
- **Refs ZIP** download: face refs + body refs all characters trong shot → ZIP cho user paste cùng prompt
- **Grid uploaded preview**: render N thumbnails per grid format (N = grid.frames). Frame chưa upload = dashed border yellow.
- **Replace single frame**: button per-frame để regen 1 frame (Nano Banana wire defer Sprint 0.9.4)

Implementation:
- New engine `src/engine/filmShotPromptBuilder.ts` build prompt từ shot context
- ZIP refs reuse JSZip pattern từ existing Photos refs download

### Video AI block — Provider Dropdown (Q5 r4-spec lock)

Dropdown (KHÔNG phải 4-button grid). Items:

```
┌─────────────────────────────────┐
│ ▼ Seedance 2.0 Pro (selected)   │ default
│   $0.15/s · 12s · 4000 chars    │
├─────────────────────────────────┤
│   Veo 3                          │ default
│   $0.30/s · 8s · 2500 chars     │
├─────────────────────────────────┤
│   Kling 2.0                      │ default
│   $0.10/s · 10s · 2500 chars    │
├─────────────────────────────────┤
│   Sora                           │ default
│   $0.50/s · 20s · 4000 chars    │
├─────────────────────────────────┤
│ ⭐ Grok Video (custom)           │ custom
│   $0.20/s · 15s · 3000 chars    │
│              [edit][delete]      │
├─────────────────────────────────┤
│ + Add custom provider            │
└─────────────────────────────────┘
```

- 4 default providers có badge `default` (Seedance/Veo3/Kling/Sora) — KHÔNG xoá được
- Custom providers (vd Grok) có badge `custom` + edit/delete actions
- "+ Add custom provider" mở inline form:
  - Name (required)
  - Pricing per second (optional, free text "$0.20/s")
  - Max duration seconds (optional, integer)
  - Char limit (optional, integer)
- Custom providers persist trong `useAppStore` (localStorage), shared across projects

### Animation prompt char count color

- Green `<70%` of char limit
- Yellow `70-95%`
- Red `>95%`

Provider char limit từ dropdown selection. Vd Seedance 4000 → 2143 chars = 53% = green.

### r5 Build Checklist

- [ ] Extend `FilmV093Data` với `expandedShotId?: string` (drawer state) + `videoProvidersCustom?: VideoProvider[]`
- [ ] Add type `VideoProvider { id, name, pricingPerSec?, maxDurationSec?, charLimit?, isCustom: bool }`
- [ ] Add type `FilmShotImageGen { gridFormat, prompt, gridImageDataUrl?, frames?: ShotFrame[] }` + extend `FilmShot.imageGen?: FilmShotImageGen`
- [ ] Add actions: `expandShot(shotId) / collapseShot / setShotPrompt / setShotGridImage / regenSingleFrame (stub) / addCustomProvider / removeCustomProvider / setShotVideoProvider / setShotAnimationPrompt`
- [ ] Create `src/engine/filmShotPromptBuilder.ts`:
  - `buildImagePrompt(shot, scene, cast, setting)` → EN prompt string
  - `buildAnimationPrompt(shot, scene, cast, setting, provider)` → EN prompt
- [ ] Create `src/components/FilmShotDetailPanel.tsx`:
  - Image Gen block với grid picker + prompt + buttons + frame grid + replace
  - Video AI block với provider dropdown + custom add form + animation prompt + char count color
- [ ] CSS in `v0_9_3_film.css`: `.ksp-shot-detail-panel`, `.ksp-grid-format-picker`, `.ksp-video-provider-dropdown`, `.ksp-char-count-{green/yellow/red}`
- [ ] Wire FilmStoryboardSection: click row → call `expandShot(shotId)`, render `<FilmShotDetailPanel shotId={id} />` inline below row when expanded
- [ ] **DELETE `src/components/ShotDetailPanel.tsx`** (legacy 852 lines, atomic Q6)
- [ ] Tests: provider CRUD / char count color logic / prompt builder snapshots / FilmShotDetailPanel mount
- [ ] Version bump r4 → r5 + CHANGELOG entry
- [ ] Photos regression 49/49 PASS

### Default providers seed (constant in code)

```typescript
const DEFAULT_VIDEO_PROVIDERS: VideoProvider[] = [
  { id: "seedance-2-pro", name: "Seedance 2.0 Pro", pricingPerSec: "$0.15/s", maxDurationSec: 12, charLimit: 4000, isCustom: false },
  { id: "veo-3", name: "Veo 3", pricingPerSec: "$0.30/s", maxDurationSec: 8, charLimit: 2500, isCustom: false },
  { id: "kling-2", name: "Kling 2.0", pricingPerSec: "$0.10/s", maxDurationSec: 10, charLimit: 2500, isCustom: false },
  { id: "sora", name: "Sora", pricingPerSec: "$0.50/s", maxDurationSec: 20, charLimit: 4000, isCustom: false },
];
```

---

## 🎙 Mockup 5 — Voice + Music + SFX + Bundle Export (r6 PLAN)

**Pipeline:** Step 6 + 7 + Export
**Section colors:** Voice blue border (`#378ADD`), Music+SFX pink border (`#D4537E`), Bundle green border (`#639922`)
**Components to build:**
- `src/components/FilmVoiceSection.tsx`
- `src/components/FilmMusicSfxSection.tsx`
- `src/components/FilmBundleExportSection.tsx`
- `src/engine/filmBundleExporter.ts`

### Layout

```
[STEP 6+7+EXPORT]
┌─────────────────────────────────┐
│ 🎙 6. VOICE AI                   │
│   [Context-aware logic]          │
│   if dialog="no_dialog":         │
│     "Phim không có dialog.       │
│      Skip hoặc add Narrator."    │
│     [Skip][+ Add Narrator]       │
│   if dialog="has_dialog":        │
│     Per-character voice list     │
│     {char.name}: line preview    │
│     Voice provider assign        │
│   Voice provider toggle:         │
│   [ElevenLabs $0.18/1k][Google]  │
└─────────────────────────────────┘
            ·
┌─────────────────────────────────┐
│ 🎵 7. MUSIC AI + SFX             │
│   Per-scene music briefs:        │
│   Scene 1 — Music brief:         │
│   "Ambient drone... Hans Zimmer  │
│    Time style, 50bpm..."         │
│   [📋 Copy→Suno][🔄 Regen]      │
│   ... scenes 2-N (collapse)      │
│   SFX list per scene (text)      │
│   Scene 1: gió rừng, chim hót,  │
│   SFX provider toggle:           │
│   [Freesound][Epidemic][Suno]    │
└─────────────────────────────────┘
            ·
┌─────────────────────────────────┐
│ 📦 BUNDLE EXPORT  [↓ Download]  │
│   {project-slug}-bundle.zip      │
│   ├── README.md                  │
│   ├── script.pdf                 │
│   ├── cast/                      │
│   │   └── refs PNGs              │
│   ├── shots/                     │
│   │   └── scene_N_shot_M_*/      │
│   │       ├── grid_NxM.png       │
│   │       ├── cropped/*.png      │
│   │       ├── image_prompt.txt   │
│   │       └── animation_prompt..│
│   ├── voice/ (lines if dialog)   │
│   ├── music/ (briefs + arc)      │
│   └── sfx/ (list + freesound)    │
└─────────────────────────────────┘
```

### Voice AI — Context-aware logic

- `dialog === "no_dialog"`:
  - Show note "Phim không có dialog. Anh có thể bỏ qua hoặc thêm Narrator (poetic, deep, slow)."
  - Buttons: `[Skip]` (primary) | `[+ Add Narrator]` (secondary)
- `dialog === "has_dialog"`:
  - Show dialog list per character (lines từ Script Stage 5 `scene.dialog[]`)
  - Per-character voice provider assignment (dropdown)
  - Preview line: "{characterName}: {lineVi || lineEn}"
- Voice provider toggle: `ElevenLabs ($0.18/1k chars)` vs `Google TTS ($4/1M chars)`
- API wire defer Sprint 0.9.4 (UI hoàn chỉnh từ r6, stub Generate audio buttons)

### Music AI per-scene briefs

- Each scene từ Script.scenes có `musicBrief: string` field (Stage 5 output)
- Display block per scene:
  - Header "Scene N — Music brief:"
  - Text content readable + monospace nhẹ
  - Buttons: `[📋 Copy → Suno]` (paste vào Suno/Udio) + `[🔄 Regen brief]` (AI generate lại)
- Cuối section: optional `full_score_arc.txt` text — combine all music briefs thành 1 arc tổng thể (cho composer)

### SFX list per scene

- Plain text list từ Script Stage 5 `scene.sfx[]` field
- Display per scene: "Scene N: SFX1, SFX2, SFX3, ..."
- SFX source provider 3 options dropdown:
  - **Freesound.org links** — auto generate search URL per SFX keyword (e.g. `https://freesound.org/search/?q={keyword}`)
  - **Epidemic Sound** — manual search link
  - **Suno SFX prompts** — generate prompt cho Suno SFX mode

### Bundle Export ZIP structure (verbatim — DON'T MODIFY)

```
{project-slug}-bundle.zip
├── README.md           (workflow guide auto-generated)
├── script.pdf          (kịch bản đầy đủ N scenes)
├── cast/
│   ├── {char}_face_01.png ... 0N.png
│   └── {char}_body_01.png ... 0M.png
├── shots/
│   └── scene{N}_shot{M}_{type}/
│       ├── grid_{NxM}.png        (uploaded grid)
│       ├── cropped/
│       │   ├── 01.png
│       │   └── 0K.png            (auto-cropped frames)
│       ├── image_prompt.txt
│       └── animation_prompt_{provider}.txt
├── voice/              (empty if no dialog, hoặc {character}_lines.txt)
├── music/
│   ├── scene{N}_brief.txt
│   └── full_score_arc.txt
└── sfx/
    ├── sfx_list_per_scene.md
    └── freesound_links.txt
```

### r6 Build Checklist

- [ ] Extend `FilmV093Data` với:
  - `voiceAssignments?: Record<characterId, "elevenlabs" | "google-tts" | null>` (per-character voice provider)
  - `sfxProvider?: "freesound" | "epidemic" | "suno-sfx"` (project-level)
  - `voiceProviderGlobal?: "elevenlabs" | "google-tts"` (fallback if no per-character)
- [ ] Create `src/components/FilmVoiceSection.tsx`:
  - Context-aware render based on `dialog` setting
  - Dialog mode: per-character list + voice provider assign
  - No dialog mode: Skip + Add Narrator
- [ ] Create `src/components/FilmMusicSfxSection.tsx`:
  - Per-scene music brief cards collapsible
  - Copy → Suno + Regen brief buttons
  - Full score arc generator (concat all briefs)
  - SFX list per scene plain display
  - SFX provider dropdown
- [ ] Create `src/components/FilmBundleExportSection.tsx`:
  - Folder tree visualization (read-only display)
  - Download ZIP primary button
  - Loading state during ZIP build
- [ ] Create `src/engine/filmBundleExporter.ts`:
  - `exportBundle(project: PromptProject): Promise<Blob>` returns ZIP blob
  - Use JSZip library (already in package)
  - Generate README.md with workflow guide
  - script.pdf via jsPDF (if available) hoặc fallback script.txt
  - cast/ folder: write each face/body ref as PNG from base64 dataUrl
  - shots/ folder: structured by scene_N_shot_M, write grid + cropped + prompts
  - voice/ folder: empty or character_lines.txt files
  - music/ folder: scene_N_brief.txt + full_score_arc.txt
  - sfx/ folder: sfx_list_per_scene.md + freesound_links.txt with auto-generated URLs
- [ ] **DELETE** 3 legacy components atomically (Q6):
  - `src/components/VoiceSectionV09.tsx`
  - `src/components/MusicSfxSectionV09.tsx`
  - `src/components/BundleExportV09.tsx`
- [ ] CSS: 3 new color borders, music brief blocks, folder tree style
- [ ] Wire Editor.tsx: replace 3 imports + render mới
- [ ] Tests: Voice context-aware render / Music brief copy / Bundle exporter file count snapshot / 3 sections mount
- [ ] Version bump r5 → r6 + CHANGELOG
- [ ] Photos regression 49/49 PASS

### Known stubs (defer Sprint 0.9.4 API wire)

- Voice TTS audio generation (ElevenLabs / Google TTS API call) — UI works, audio Generate button stubbed
- Music brief Suno API call — UI works, Copy button works, Generate music defer
- Single-frame regen Nano Banana — UI works từ r5, API call defer

---

## 🎭 r7 — Multi-stage Script Wizard (v0.9.3 FINAL)

r3 ship Stage 5 quick path. r7 add Stage 1-4 wizard với navigation + revert logic.

### UI changes in `FilmIdeaScriptSection.tsx`

Replace 5-stage breadcrumb stub (r3 placeholder) với fully clickable stage navigation:

```
┌─ 5-STAGE BREADCRUMB ──────────┐
│ [① Structure ✓] (clickable)    │  ← click navigates to stage view
│ [② Beats     ✓] (clickable)    │
│ [③ Twists    ✓] (clickable)    │
│ [④ Scenes    ✓] (clickable)    │
│ [⑤ Dialogues ●] (current)      │
│ Status: 3-act · 7 beats · ...  │
└─────────────────────────────────┘

[Stage-specific UI below breadcrumb]
```

### Stage 1 Structure picker

```
Choose narrative structure:
( ) 3-act (Setup → Confrontation → Resolution) — default, recommended
( ) Hero's Journey (12 stages)
( ) Save the Cat (15 beats)
( ) Kishōtenketsu (4-act Japanese)
[Use this structure →]
```

### Stage 2 Beats editor

```
N beats list (editable):
[#] Beat title + description textarea
[1] Opening Image: ...
[2] Inciting Incident: ...
[3] First Plot Point: ...
...
[Re-generate beats][Confirm beats →]
```

### Stage 3 Twists injector

```
AI suggested twists (1-3):
[ ✓] Twist 1: ... (attached to Beat 4)
[  ] Twist 2: ... (rejected)
[ ✓] Twist 3: ... (attached to Beat 7)
[Accept selected → Stage 4]
```

### Stage 4 Scenes splitter

```
Scenes generated:
[Scene 1] Setting + duration + action prose
[Scene 2] ...
[Confirm scenes → Stage 5 Dialogues]
```

### Stage 5 Dialogues (= current r3 output)

Existing r3 flow continues — but now triggered from Stage 4 confirm instead of "AI viết Script" button.

### Revert logic

Click any past stage (✓ stages) → confirm dialog "Revert to this stage? Downstream stages will be regenerated." → call revert function clears downstream + re-runs from selected stage.

### r7 Build Checklist

- [ ] Extend `FilmV093Data` với multi-stage state:
  - `scriptStage?: "structure" | "beats" | "twists" | "scenes" | "dialogues"` (current stage)
  - `scriptStructure?: { framework, content }`
  - `scriptBeats?: Beat[]` (id, title, description, order)
  - `scriptTwists?: Twist[]` (id, beatId, description, accepted: bool)
  - `scriptScenes?: Scene[]` (pre-dialogues, simpler than FilmSceneScript)
- [ ] Add engine functions: `runStage1Structure / runStage2Beats / runStage3Twists / runStage4Scenes`
- [ ] Each stage: own AI prompt template trong `engine/ai_prompts/scriptStages/*`
- [ ] Update `FilmIdeaScriptSection.tsx`:
  - Replace stub breadcrumb với clickable navigation
  - Conditional render stage-specific UI based on `scriptStage`
  - Add revert dialog logic
- [ ] Tests: stage progression / revert logic / each stage AI call
- [ ] Version bump r6 → 0.9.3 final
- [ ] Update CHANGELOG with "v0.9.3 FINAL"
- [ ] Tag annotated `v0.9.3` + push GitHub
- [ ] Merge to main if branch used

---

## 🧪 Test workflow Film mode (per ship verification)

Sau mỗi r ship (r5, r6, r7), Jason test:

1. **Photos regression**: Mở project Photos cũ → workflow end-to-end (5 Subject Types → upload face refs → BOKEH/DOC toggle → 227+ themes → list view → Copy prompt 13 blocks → ZIP refs). PHẢI work như cũ.
2. **Film mode test** feature r ship đó.
3. **Vitest runtime**: `npx vitest run` → all PASS.
4. **Build clean**: `npm run build` → 0 TS errors.
5. **Chrome load**: `bash update.sh` → reload extension → no console errors.

Nếu Photos regression FAIL bất kỳ điểm nào → revert ngay, debug trước khi tiếp.

---

## 📊 Sprint progress (post-r4)

| Sprint | Status | Component shipped | Tests count |
|---|---|---|---|
| r1 Foundation | ✅ DONE | Cleanup 18 files + update.sh fix | 62/62 |
| r2 Mockup 1 Cast | ✅ DONE | CastFilmSection | 71/71 |
| r3 Mockup 2 Script v1 | ✅ DONE | FilmIdeaScriptSection + filmScriptStages | 71/71 |
| r3.1 UI polish batch 1 | ✅ DONE | CSS fixes + UI tweaks | 71/71 |
| r4 Mockup 3 Storyboard | ✅ DONE | FilmStoryboardSection + shot CRUD | **76/76** |
| r5 Mockup 4 Shot Detail | ⏳ NEXT | FilmShotDetailPanel + filmShotPromptBuilder + Video provider dropdown | target ~85 |
| r6 Mockup 5 Voice+Music+Bundle | ⏳ | FilmVoiceSection + FilmMusicSfxSection + FilmBundleExportSection + filmBundleExporter | target ~95 |
| r7 Multi-stage Script | ⏳ | Multi-stage wizard upgrade + revert | target ~110 = v0.9.3 final |

---

End of MOCKUPS_FILM.md.

**Chat mới — câu hỏi gợi ý paste vào đầu chat:**

```
Đây là KSP Image Chrome extension v0.9.3-r4 → đang phát triển Mode Film,
đã ship 4 mockups (Cast / Script v1 / Storyboard + polish batches).

Đọc 3 files trong Project Knowledge:
- HANDOFF.md (vision + roadmap + workflow rules)
- CHANGELOG.md (trạng thái code r4)
- MOCKUPS_FILM.md (design spec với r3.1+r4 polish locks)

QUAN TRỌNG section "🚨 UI POLISH ADJUSTMENTS LOCKED" trong MOCKUPS_FILM.md —
đây là feedback đã apply, KHÔNG được revert về spec gốc.

Bắt đầu Sprint 0.9.3-r5 — Mockup 4 Shot Detail:
- Build FilmShotDetailPanel.tsx (inline expand drawer when shot row clicked)
- Image Gen block (5 grid picker + AI prompt + Copy → Banana Pro + refs ZIP + frame thumbnails + replace single)
- Video AI block (provider dropdown 4 default Seedance/Veo3/Kling/Sora + custom add Grok et al + animation prompt với char count color)
- engine/filmShotPromptBuilder.ts
- Atomic delete ShotDetailPanel.tsx (legacy 852 lines)
- Photos regression 49/49 PASS
```
