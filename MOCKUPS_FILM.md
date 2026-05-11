# MOCKUPS_FILM.md — Film Mode Design Spec

**Sprint 0.9.3 implementation spec — Locked May 11, 2026**

Đây là tài liệu thiết kế chính thức cho Mode Film trong KSP Image Chrome extension. Mọi quyết định UI/UX/schema được lock trong file này. Khi Claude mới đọc, không cần hỏi clarify implementation details — tất cả answers đã chốt.

Tài liệu này bổ sung cho HANDOFF.md (vision + roadmap) và CHANGELOG.md (trạng thái code). Đọc cả 3 file để pickup context đầy đủ.

---

## 🔒 Implementation locks (Q1-Q6 chốt May 11)

### Q1 — Layout multi-character cards
**Hướng A: Vertical full-width cards stack dọc.** Mỗi character 1 card full-width chứa avatar + name + role + description + face/body refs badges + edit/delete actions. Match pattern Photos Cast (anh đã quen). KHÔNG dùng grid 2-col compact hay accordion.

### Q2 — Role selector
**Dropdown free 4 options, KHÔNG constraint.**
- Options: `Protagonist` / `Antagonist` / `Companion` / `Extra`
- Buddy films có 2 protagonists hợp lệ
- Engine prompt builder show warning yellow nếu missing Protagonist nhưng KHÔNG block save/render

### Q3 — Face/Body/Outfit schema
- **Face refs:** 1-4 ảnh (giảm từ Photos 1-6 — Film có N characters × 4 đã đủ nhiều)
- **Body refs:** 1-3 ảnh (front/side/back đủ cho AI hiểu outfit + body proportion)
- **Outfit slot riêng: BỎ** — gộp vào Body refs (body ảnh đã chứa outfit)

### Q4 — AI Generate Face/Body button
**Hướng B: Button stub + modal description prose, save vào schema, KHÔNG call API ở r2.**
- Button render đầy đủ với icon sparkles + label "AI Generate"
- Click → open modal có textarea "Mô tả character" (Vietnamese)
- Save description vào field `aiGenDescription` trong character schema
- Sprint 0.9.4 sẽ wire Imagen 4 API thật — chỉ cần thêm API call, UX hoàn chỉnh từ r2

### Q5 — Project Setting fields mới + defaults

| Field | Type | Options | Default |
|---|---|---|---|
| Dialog | Segmented 2-way | `Có thoại` / `Không thoại` | `Không thoại` |
| Genre | Dropdown single + sub-genre text optional | `Drama` / `Sci-fi` / `Action` / `Romance` / `Thriller` / `Comedy` (6) | `Drama` |
| Animation Style | Dropdown | `Live Action` / `Anime` / `3D CGI` / `Film Noir` (4 cho v0.9.3) | `Live Action` |
| Aspect Ratio | Dropdown | `16:9` / `9:16` / `1:1` / `4:3` / `21:9` (5) | `16:9` |
| Duration | Integer input | 1-60 phút | `5` |

Notes:
- Dialog là **property toàn phim**, KHÔNG per-character (anh đã chốt trong feedback Mockup 1)
- Dialog 2-way — phim "Có thoại" vẫn có thể có Narrator (configurable trong Voice section). 3-way overkill.
- Genre sub-genre text optional cho phim hybrid (vd "Sci-fi" + sub-genre text "Post-apocalyptic Drama")
- Animation Style v0.9.3 chỉ 4 — defer Stop-motion + 2D Cartoon cho v0.9.4+
- Aspect Ratio default 16:9 phù hợp 90% use case (TV/YouTube); 9:16 cho TikTok/Reels; 21:9 cho cinema

### Q6 — Strategy xoá CastSectionV09
**Hướng A atomic: r2 build CastFilmSection + route Film → CastFilmSection + xoá CastSectionV09 trong CÙNG 1 ship.**

Lý do:
- Photos KHÔNG bị ảnh hưởng (CastPhotosSection riêng — verified Gap Report)
- Vitest runtime + manual Chrome test BẮT BUỘC pass trước ship → catch crashes early
- Phased giữ dead code 1 sprint complicate tracking + risk forget xoá

Cùng pattern atomic cho r3-r7: build new + route + xoá old trong 1 ship mỗi sprint.

---

## 📸 Mockup 1 — Project Setting + Cast

**Pipeline:** Step 0 (Setup)
**Section colors:** Project Setting blue border (`#378ADD`), Cast orange border (`#BA7517`)

### Layout structure

```
[PROJECT label]
┌─────────────────────────────────┐
│ 📁 PROJECT SETTING        [▲]  │  ← collapsible, default expanded
│ ┌─────────────────────────────┐ │
│ │ Project name (full-width)   │ │
│ └─────────────────────────────┘ │
│ ┌──────────┬──────────┐         │
│ │ Mode     │ Genre    │         │  ← 2-col grid
│ │ Dialog   │ Animation│         │
│ │ Aspect   │ Duration │         │
│ │ AI Provider (span 2)│         │
│ └──────────┴──────────┘         │
└─────────────────────────────────┘

[CAST label (nhất quán toàn phim)]
┌─────────────────────────────────┐
│ Character card 1 (full-width)   │  ← Robot
│ Character card 2 (full-width)   │  ← Chim sẻ rừng
│ ...                              │
│ [+ Add character] [AI gợi ý]    │  ← 2-col bottom
└─────────────────────────────────┘
```

### Character card structure

Mỗi card chứa:
- **Avatar** (40x40 circle, background color theo role, icon Tabler)
- **Name** (15px font-weight 500, color theo role)
- **Role** (12px secondary color — vd "Protagonist")
- **Description** (13px primary, line-height 1.5, ~2-3 lines visible)
- **Badges row** (flex wrap, gap 6px):
  - `Face refs · N ảnh` (blue bg `#E6F1FB`)
  - `AI generate` (orange bg `#FAEEDA`, icon sparkles)
  - `Body refs · M ảnh` (blue bg `#E6F1FB`)
- **Actions** (right side): `edit` button + `×` delete

### Role color scheme

| Role | Avatar bg | Name color | Icon |
|---|---|---|---|
| Protagonist | `#EEEDFE` (purple light) | `#534AB7` | ti-robot / ti-user |
| Antagonist | `#FBEAF0` (red light) | `#993556` | ti-skull |
| Companion | `#FBEAF0` | `#993556` | ti-feather |
| Extra | `#F1EFE8` (gray) | `#5F5E5A` | ti-users |

(Anh có thể override icon per character)

### Schema sketch

```typescript
interface FilmCharacterV093 {
  id: string;
  name: string;                    // "Robot"
  role: "protagonist" | "antagonist" | "companion" | "extra";
  description: string;             // prose VN
  faceRefs: ImageRef[];            // 1-4 items
  bodyRefs: ImageRef[];            // 1-3 items
  aiGenDescription?: string;       // optional, Q4 stub schema
  createdAt: number;
}

interface ImageRef {
  dataUrl: string;  // base64
  label?: string;   // optional anchor (vd "front", "3/4 left")
}

interface FilmProjectSettingV093 {
  // Existing
  name: string;
  mode: "film";
  // NEW Q5
  dialog: "has_dialog" | "no_dialog";  // default "no_dialog"
  genre: FilmGenre;                     // 6 options
  subGenre?: string;                    // optional free text
  animationStyle: FilmAnimationStyle;   // 4 options
  aspectRatio: AspectRatio;             // 5 options
  durationMinutes: number;              // 1-60, default 5
  aiProviders: { ... };
  // Existing time format
  timeFormat: TimeFormat;
}

type FilmGenre = "drama" | "sci_fi" | "action" | "romance" | "thriller" | "comedy";
type FilmAnimationStyle = "live_action" | "anime" | "3d_cgi" | "film_noir";
type AspectRatio = "16:9" | "9:16" | "1:1" | "4:3" | "21:9";
```

---

## 🎬 Mockup 2 — Idea + Multi-stage Script

**Pipeline:** Step 1 + 2
**Section colors:** Idea green border (`#1D9E75`), Script orange border (`#D85A30`)

### Layout

```
[PIPELINE — STEP 1 + 2 label]
┌─────────────────────────────────┐
│ 💡 1. Ý TƯỞNG          [✓]      │
│ ┌─────────────────────────────┐ │
│ │ Idea textarea VN (80px min) │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
            ·                       ← connector dot
┌─────────────────────────────────┐
│ 📜 2. SCRIPT (Kịch bản)         │
│         4 scenes · ~5 phút      │
│                                  │
│ ┌─ 5-STAGE BREADCRUMB ──────┐   │
│ │ ① Structure ✓             │   │
│ │ ② Beats     ✓             │   │
│ │ ③ Twists    ✓             │   │
│ │ ④ Scenes    ✓             │   │
│ │ ⑤ Dialogues (current)     │   │
│ │ Status: 3-act · 7 beats   │   │
│ │   · 2 twists · 4 scenes   │   │
│ └───────────────────────────┘   │
│                                  │
│ [AI viết Script] [Variation]    │
│                                  │
│ ┌─ Scene 1 ─────────── ▼ ────┐  │
│ │ EXT. — DAWN — 1m20s         │  │
│ │ [description prose italic]  │  │
│ │ [SFX: ...] (blue note)      │  │
│ │ [MUSIC: ...] (purple note)  │  │
│ │ [TRANSITION: ...] (green)   │  │
│ └─────────────────────────────┘  │
│ ┌─ Scene 2 ────────── ▶ ─────┐  │
│ │ EXT. — MORNING — 1m10s · 3 │  │
│ └─────────────────────────────┘  │
│ ... Scene 3, 4 collapsed         │
│                                  │
│ [Export PDF][Versions][+Scene]  │
│                                  │
│ ⓘ Script feed: Storyboard ·     │
│   SFX list · Music briefs       │
└─────────────────────────────────┘
```

### Multi-stage pipeline 5 stages (Q2 from HANDOFF locked)

Mỗi stage:

| # | Name | Action | User can | UI state |
|---|---|---|---|---|
| 1 | Structure | AI chọn 3-act (default) hoặc Hero's Journey / Save the Cat / Kishōtenketsu | Pick framework | Dropdown + locked sau khi chọn (can rewind) |
| 2 | Beats | AI fill 7-9 narrative milestones | Edit description từng beat | List items editable |
| 3 | Twists | AI suggest 1-3 twist points (gắn vào 1 beat) | Accept/reject/edit từng twist | Toggle inline |
| 4 | Scenes | AI gộp beats + twists → scenes có setting + action prose + duration | Edit scene description | Scene cards |
| 5 | Dialogues + SFX + Music + Transition | AI fill chi tiết per-scene | Edit từng line | Inline notes color-coded (như mockup) |

User có thể click bất kỳ stage cũ trong breadcrumb → rewind regen downstream. Cost ~5 AI calls/script.

### r3 ship phase (Stage 5 quick path)

r3 ship **Stage 5 ONLY** — user click "AI viết Script từ idea" → AI 1 cú generate full script với scenes có SFX/MUSIC/TRANSITION inline. Bỏ qua Stages 1-4 wizard, ra output như Mockup 2 hiển thị.

### r7 ship phase (Multi-stage full)

r7 add Stages 1-4 wizard với breadcrumb navigation + revert logic.

### Inline notes color scheme (Scene block)

| Type | Background | Border | Font |
|---|---|---|---|
| SFX | `#E6F1FB` (blue) | `#185FA5` left 3px | mono 11px label, 12px content |
| MUSIC | `#EEEDFE` (purple) | `#534AB7` left 3px | mono 11px label, 12px content |
| TRANSITION | `#E1F5EE` (green) | `#0F6E56` left 3px | mono 11px label, 12px content |

### Dual-provider AI toggle (HANDOFF Q2 lock)

Đầu Script section thêm provider selector:
- `Gemini Flash` (default)
- `ChatGPT 4o`

User có thể switch giữa 2 → AI tạo script khác nhau → compare quality. Provider preference persist trong project settings.

---

## 🎥 Mockup 3 — Storyboard

**Pipeline:** Step 3
**Section color:** Purple border (`#534AB7`)

### Layout

```
[PIPELINE — STEP 3 label]
┌─────────────────────────────────┐
│ 🎬 3. STORYBOARD                │
│  11 shots · 11 grids · 95 frames│
│                                  │
│ ▼ Scene 1: Khu rừng ngủ quên   │
│   1m20s · 2 shots               │
│              [✨ AI sinh shots] │
│   ┌───────────────────────────┐ │
│   │ 🏔 Shot 1.1: Wide aerial  │ │
│   │ 3×3 grid · 9 frames       │ │
│   │ drone aerial slow         │ │
│   │              [✓ rendered] │ │
│   └───────────────────────────┘ │
│   ┌───────────────────────────┐ │
│   │ 🪶 Shot 1.2: Close-up     │ │
│   │ 2×2 grid · 4 frames       │ │
│   │              [⚙ rendering]│ │
│   └───────────────────────────┘ │
│                                  │
│ ▼ Scene 2: Thức dậy             │
│   ... shots                      │
│                                  │
│ ▶ Scene 3: Khám phá... (collapse)│
│ ▶ Scene 4: Chạy về... (collapse)│
│                                  │
│ [+ Add Shot manual]              │
│ [✨ AI sinh shots cho Scene]     │
│                                  │
│ ⓘ Grid size khác nhau per shot: │
│   2×2 insert · 3×3 default      │
│   · 4×3 action                  │
└─────────────────────────────────┘
```

### Hierarchy

Scene (from Script Stage 4-5) → Shots (manual hoặc AI sinh). Mỗi shot có:
- Title + 1-line description
- Grid size config (5 options: 2×2 / 2×3 / 3×2 / 3×3 / 4×3)
- Number of frames computed from grid (vd 3×3 = 9 frames)
- Camera/lens note (vd "drone aerial slow", "macro detail")
- Status badge

### 4 Status badges (Q3 locked)

| Status | Badge color | Icon | Meaning |
|---|---|---|---|
| `rendered` | Green bg `#EAF3DE`, text `#3B6D11` | ti-check | Grid PNG đã upload + auto-cropped |
| `rendering` | Orange bg `#FAEEDA`, text `#854F0B` | ti-loader-2 (spin) | User đang paste prompt sang Banana Pro |
| `pending` | Gray bg `#F1EFE8`, text `#5F5E5A` | ti-circle | Chưa start |
| `locked` | Blue bg `#E6F1FB`, text `#0C447C` | ti-lock | User lock manual, không cho regen |

Default new shot = `pending`. User toggle `locked` manual.

### AI sinh shots per-scene

Mỗi scene có button `[✨ AI sinh shots]` ở header. Click → AI đọc scene description + action lines → suggest N shots với title + grid size + camera note. User accept/reject/edit từng shot.

Cost ~1 AI call per scene (Gemini Flash).

### Click shot → drill-down

Click vào shot row → mở **Mockup 4 Shot Detail Panel** (xem dưới).

---

## 🖼 Mockup 4 — Shot Detail Panel

**Pipeline:** Step 4 + 5 (drill-down per-shot)
**Section colors:** Image Gen purple light border (`#AFA9EC`), Video AI cùng border

### Layout

```
[PIPELINE — STEP 4+5 · drill-down per shot]
┌─────────────────────────────────┐
│ [←] Shot 1.2 — Close-up chim... │
│ Scene 1 · 2×2 grid · 4 frames   │
│                       [⚙ rendering]
└─────────────────────────────────┘
            ·
┌─────────────────────────────────┐
│ 🖼 4. IMAGE GEN                  │
│         Banana Pro · Imagen 4   │
│                                  │
│ Grid format                      │
│ [2×2] [2×3] [3×2] [3×3] [4×3]  │
│                                  │
│ Image prompt (EN, auto-gen)     │
│ ┌─────────────────────────────┐ │
│ │ Cinematic 2×2 storyboard... │ │
│ │ Subject: same character     │ │
│ │ refs as attached...         │ │
│ │ Lighting: dawn forest...    │ │
│ │              847 chars      │ │
│ └─────────────────────────────┘ │
│ [Copy→Banana Pro][Regen][Refs] │
│                                  │
│ Grid uploaded · auto-cropped    │
│ ┌─────┐ ┌─────┐                 │
│ │ 01  │ │ 02  │                 │
│ └─────┘ └─────┘                 │
│ ┌─────┐ ┌─────┐                 │
│ │ 03  │ │ 04 ⚠│                 │
│ └─────┘ └─────┘                 │
│ Frame 04 chưa hài lòng?         │
│ [Replace single frame]          │
└─────────────────────────────────┘
            ·
┌─────────────────────────────────┐
│ 🎞 5. VIDEO AI                   │
│  Seedance · Veo3 · Kling · Sora │
│                                  │
│ Provider [dropdown]              │
│ ┌─────────────────────────────┐ │
│ │ Seedance 2.0 Pro            │ │
│ │ $0.15/s · 12s · 4000 chars  │ │
│ │                          [▼]│ │
│ └─────────────────────────────┘ │
│                                  │
│ Animation prompt (EN, auto-gen) │
│ ┌─────────────────────────────┐ │
│ │ You are an experienced film │ │
│ │ director specializing in    │ │
│ │ Sci-fi · Drama...           │ │
│ │            2143/4000 chars  │ │
│ └─────────────────────────────┘ │
│ [Copy → Seedance 2.0]            │
└─────────────────────────────────┘
```

### Image Gen block

- **Grid format picker**: 5 buttons inline (2×2 / 2×3 / 3×2 / 3×3 / 4×3). Selected = purple bg.
- **Auto-generated prompt EN**: AI sinh từ Scene description + Cast refs + Animation Style + Shot type. Char count display (no limit cho Banana Pro/Imagen 4).
- **Copy → Banana Pro** primary action (purple bg)
- **Regen** secondary (refresh prompt với same inputs)
- **Refs ZIP** download (face refs + body refs all characters trong shot → ZIP cho user paste cùng prompt)
- **Grid uploaded preview**: 2×2 grid display 4 frames thumbnails (16:9 aspect each). Frame chưa upload = dashed border yellow.
- **Replace single frame**: button per-frame để regen 1 frame (Nano Banana wire defer Sprint 0.9.4)

### Video AI block — Provider Dropdown (Q5 locked May 11)

Dropdown thay vì 4-button grid. Items:

```
┌─────────────────────────────────┐
│ ▼ Seedance 2.0 Pro (selected)   │
│   $0.15/s · 12s · 4000 chars    │
├─────────────────────────────────┤
│   Veo 3                          │
│   $0.30/s · 8s · 2500 chars     │
├─────────────────────────────────┤
│   Kling 2.0                      │
│   $0.10/s · 10s · 2500 chars    │
├─────────────────────────────────┤
│   Sora                           │
│   $0.50/s · 20s · 4000 chars    │
├─────────────────────────────────┤
│ ⭐ Grok Video (custom)           │
│   $0.20/s · 15s · 3000 chars    │
│              [edit][delete]      │
├─────────────────────────────────┤
│ + Add custom provider            │
└─────────────────────────────────┘
```

- 4 default providers (Seedance/Veo3/Kling/Sora) có badge `default` — không xoá được
- Custom providers (vd Grok) có badge `custom` + edit/delete actions
- "+ Add custom provider" mở inline form:
  - Name (required)
  - Pricing (optional, free text)
  - Max duration sec (optional, integer)
  - Char limit (optional, integer — để cảnh báo prompt quá dài)
- Custom providers persist trong `useAppStore` (localStorage), shared across projects

### Animation prompt char count color

- Green `<70%` of char limit
- Yellow `70-95%`
- Red `>95%`

Provider char limit từ dropdown selection. Vd Seedance 4000 → 2143 chars = 53% = green.

---

## 🎙 Mockup 5 — Voice + Music + SFX + Bundle Export

**Pipeline:** Step 6 + 7 + Export
**Section colors:** Voice blue border (`#378ADD`), Music+SFX pink border (`#D4537E`), Bundle green border (`#639922`)

### Layout

```
[PIPELINE — STEP 6+7+EXPORT label]
┌─────────────────────────────────┐
│ 🎙 6. VOICE AI                   │
│       No dialog · Optional narr.│
│                                  │
│ ⓘ Phim Robot không có dialog.   │
│   Anh có thể bỏ qua hoặc thêm   │
│   Narrator (poetic, deep, slow).│
│                                  │
│ [Skip]  [+ Add Narrator]        │
│                                  │
│ Voice provider:                  │
│ [ElevenLabs $0.18/1k][Google TTS]│
└─────────────────────────────────┘
            ·
┌─────────────────────────────────┐
│ 🎵 7. MUSIC AI + SFX             │
│              Per-scene briefs   │
│                                  │
│ Scene 1 — Music brief:          │
│ ┌─────────────────────────────┐ │
│ │ Ambient drone tone, low     │ │
│ │ frequency sustained, gradual│ │
│ │ crescendo over 1m20s.       │ │
│ │ Reference: Hans Zimmer      │ │
│ │ "Time" intro. Tempo 50bpm.  │ │
│ └─────────────────────────────┘ │
│ [Copy→Suno][Regen brief]        │
│                                  │
│ ... Scene 2-4 briefs (collapse) │
│                                  │
│ SFX list per scene:             │
│ Scene 1: gió rừng, chim hót xa,│
│   cót két, kim loại va chạm    │
│ Scene 2: LED bừng, bụi rơi,...  │
│ Scene 3: ...                     │
│ Scene 4: ...                     │
│                                  │
│ SFX source provider:             │
│ [Freesound][Epidemic][Suno SFX] │
└─────────────────────────────────┘
            ·
┌─────────────────────────────────┐
│ 📦 BUNDLE EXPORT  [↓ Download]  │
│                                  │
│ 📦 robot-cuoi-cung-bundle.zip   │
│ ├── README.md (workflow guide)  │
│ ├── script.pdf (4 scenes)       │
│ ├── cast/                        │
│ │   ├── robot_face_01.png · 02..│
│ │   ├── robot_body_01.png · 02  │
│ │   └── bird_01.png · 02        │
│ ├── shots/                       │
│ │   ├── scene1_shot1_wide.../   │
│ │   │   ├── grid_3x3.png        │
│ │   │   ├── cropped/01.png...   │
│ │   │   ├── image_prompt.txt    │
│ │   │   └── animation_prompt... │
│ │   └── scene2_shot1.../        │
│ ├── voice/ (empty)              │
│ ├── music/                       │
│ │   ├── scene1_brief.txt        │
│ │   └── full_score_arc.txt      │
│ └── sfx/                         │
│     ├── sfx_list_per_scene.md   │
│     └── freesound_links.txt     │
│                                  │
│ ⓘ Anh download ZIP → mở README  │
│   → workflow: copy prompts ra   │
│   Banana Pro/Seedance/Suno...   │
└─────────────────────────────────┘
```

### Voice AI — Context-aware logic

- Nếu Project Setting `dialog = "no_dialog"`: section show **Skip** primary + **Add Narrator** secondary
- Nếu `dialog = "has_dialog"`: section show **Dialog list per character** (mỗi character có lines từ Script Stage 5) + Voice provider assignment per character
- Voice provider toggle: ElevenLabs ($0.18/1k chars) vs Google TTS ($4/1M chars)
- API wire defer Sprint 0.9.4 (UI hoàn chỉnh từ r6)

### Music AI per-scene briefs

- Mỗi scene từ Script có music_brief (Stage 5 output)
- AI brief format: style reference + tempo + instrument suggestions
- Vd: `"Ambient drone tone, Hans Zimmer 'Time' style, Tempo 50bpm, synth pad + cello"`
- Buttons per brief: `Copy → Suno` (paste vào Suno/Udio) + `Regen brief` (AI generate lại)
- Cuối section: `full_score_arc.txt` — combine all music briefs thành 1 arc tổng thể (cho composer)

### SFX list per scene

- Plain text list từ Script Stage 5 SFX field
- SFX source provider 3 options:
  - **Freesound.org links** — auto generate search URL per SFX keyword
  - **Epidemic Sound** — manual search link
  - **Suno SFX prompts** — generate prompt cho Suno SFX mode

### Bundle Export ZIP structure

Folder tree verbatim từ HANDOFF Section "Bundle Export ZIP structure":

```
{project-slug}-bundle.zip
├── README.md          (workflow guide auto-generated)
├── script.pdf         (kịch bản đầy đủ N scenes)
├── cast/
│   ├── {char}_face_01.png ... 0N.png
│   └── {char}_body_01.png ... 0M.png
├── shots/
│   └── scene{N}_shot{M}_{type}/
│       ├── grid_{NxM}.png        (uploaded grid)
│       ├── cropped/01.png ... 0K.png  (auto-cropped frames)
│       ├── image_prompt.txt       (EN prompt cho Banana Pro)
│       └── animation_prompt_{provider}.txt
├── voice/             (empty if no dialog, hoặc {character}_lines.txt)
├── music/
│   ├── scene{N}_brief.txt
│   └── full_score_arc.txt
└── sfx/
    ├── sfx_list_per_scene.md
    └── freesound_links.txt
```

JSZip implementation: Sprint 0.9.3-r6 build `engine/filmBundleExporter.ts` với function `exportBundle(project: FilmProject): Promise<Blob>`.

---

## 🧪 Test workflow Film mode (per ship verification)

Sau mỗi r ship (r2-r7), Jason test:

1. **Photos regression**: Mở project Photos cũ → workflow end-to-end (5 Subject Types → upload face refs → BOKEH/DOC toggle → 227+ themes → list view 9 shots → Copy prompt 13 blocks → ZIP refs). PHẢI work như cũ.
2. **Film mode test**: Mở project Film mới → test feature mới của r ship đó. Vd r2 test Cast: add 2 characters Robot + Chim sẻ, upload face/body refs, AI Generate modal nhập description, save reload verify persist.
3. **Vitest runtime**: `npx vitest run` → tất cả tests PASS (49 Photos + Film tests mới của r ship đó).
4. **Build clean**: `npm run build` → 0 TypeScript errors.
5. **Chrome load**: `bash update.sh` → reload extension → no console errors.

Nếu Photos regression FAIL bất kỳ điểm nào → revert ngay, debug trước khi tiếp.

---

## 📋 Sprint 0.9.3-r2 build checklist (next sprint)

- [ ] Create `src/types/film_v093.ts` — FilmCharacterV093, FilmProjectSettingV093, FilmGenre, FilmAnimationStyle, AspectRatio interfaces
- [ ] Create `src/store/film_actions.ts` — `addCharacter`, `removeCharacter`, `updateCharacter`, `setCharacterFaceRefs`, `setCharacterBodyRefs`, `setProjectSettingFilm` (extend ProjectSetting cho Dialog/Genre/AnimationStyle/AspectRatio/Duration)
- [ ] Build `src/components/CastFilmSection.tsx`:
  - Vertical full-width cards stack dọc
  - Per-card: avatar + name + role + description + face/body badges + edit/delete
  - "+ Add character" + "AI gợi ý cast từ idea" 2 buttons
  - Modal "AI Generate" stub (Q4 — nhập description prose, save schema, no API)
- [ ] Extend `src/components/ProjectSettingSectionV09.tsx`:
  - Show 4 new fields (Dialog / Genre / Animation Style / Aspect Ratio) khi `mode === "film"`
  - Hide khi mode khác (vd Photos không cần)
  - Defaults theo Q5 lock
- [ ] Wire Editor.tsx route `mode === "film"` → render `<CastFilmSection />` thay vì `<CastSectionV09 />`
- [ ] **Delete `src/components/CastSectionV09.tsx`** (atomic xóa, Q6)
- [ ] Add `filmV093?: FilmV093Data` field vào ProjectV2 type (đã có comment reserved trong v0_9_0.ts từ r1)
- [ ] Migration: project Film cũ → show note "Vui lòng tạo project mới" (Q3 from HANDOFF earlier)
- [ ] Tests:
  - `test/film_mode.test.tsx` 8 cases: ensureFilmData / addCharacter / removeCharacter / updateRole / setFaceRefs cap 4 / setBodyRefs cap 3 / Dialog toggle / Genre dropdown
  - Photos regression 49/49 PASS
  - Components render: CastFilmSection mount no crash
- [ ] CSS: `src/components/v0_9_3_film.css` cho Cast cards styling (role colors, badges, modal AI Generate)
- [ ] Version bump 0.9.3-r1 → 0.9.3-r2 (package.json + manifest.json)
- [ ] CHANGELOG entry r2
- [ ] Ship zip + manual Chrome verify

---

## 🎨 Visualizer reference (chat mới có thể re-render)

Nếu Claude mới cần xem lại visual mockup, có thể dùng `visualize:show_widget` với CSS variables `var(--color-background-primary)`, `var(--color-text-info)`, etc. Các mockups dưới đây em đã render trong chat ngày 11/5 — Claude mới re-create với cùng specs sẽ ra visual identical.

### Mockup 1 HTML skeleton (re-render reference)

```html
<div style="background: var(--color-background-secondary); padding: 1.5rem;">
  <!-- PROJECT SETTING card -->
  <div style="background: var(--color-background-primary);
              border: 0.5px solid var(--color-border-info);
              border-radius: var(--border-radius-lg);
              padding: 1.25rem;">
    <!-- Header: folder icon + title + chevron -->
    <!-- Project name input full-width -->
    <!-- 2-col grid: Mode/Genre, Dialog (segmented)/Animation, Aspect/Duration -->
    <!-- AI Provider full-width row -->
  </div>

  <!-- CAST cards (orange border #BA7517) -->
  <div style="border: 0.5px solid #BA7517;">
    <!-- Character card x N -->
    <div style="background: var(--color-background-secondary);">
      <!-- Avatar circle (role color) + Name + Role + Description + Badges row + Actions -->
    </div>
    <!-- [+ Add character] [AI gợi ý cast từ idea] 2-col bottom -->
  </div>
</div>
```

(Tương tự cho Mockup 2-5, Claude mới reference visualizer rules trong chat r4-r7.)

---

End of MOCKUPS_FILM.md. File này + HANDOFF.md + CHANGELOG.md = full context cho Sprint 0.9.3 Film mode build.
