# KSP Image — Chrome Extension v0.9.0

> Multi-mode AI Cinema toolkit. See HANDOFF.md for full context.

## Quick start

```bash
bash setup.sh        # First time install
bash update.sh       # Subsequent updates
bash git-upload.sh   # Push to GitHub
```

---

## Original v0.4.1 description


Sidebar Chrome extension generate prompt siêu thật cho Banana Pro / Nano Banana từ ý tưởng + reference images.

## ⚡ CÀI ĐẶT — 1 DÒNG LỆNH

### Nếu đã download zip về Downloads, chạy:

```bash
bash <(curl -fsSL file://$HOME/Downloads/install-ksp-image.sh)
```

Hoặc đơn giản nhất — copy paste vào Terminal:

```bash
bash ~/Downloads/install-ksp-image.sh
```

Script sẽ tự động:
1. ✅ Tìm file `ksp-image-ext-*.zip` mới nhất trong ~/Downloads
2. ✅ Giải nén vào `~/Documents/ksp-image-ext`
3. ✅ Cài npm dependencies
4. ✅ Build extension
5. ✅ Copy đường dẫn `dist/` vào clipboard
6. ✅ Tự mở Chrome đến `chrome://extensions`

Sau đó **chỉ cần lần đầu**:
- Bật toggle "Developer mode" góc phải trên
- Click "Load unpacked"
- **Cmd+Shift+G** trong dialog Finder → **Cmd+V** (đường dẫn đã có trong clipboard) → Enter → Open
- Pin extension vào toolbar

### Hoặc cách thủ công (nếu không dùng installer):

```bash
unzip ~/Downloads/ksp-image-ext-v0.4.1.zip -d ~/Documents/
cd ~/Documents/ksp-image-ext
bash setup.sh
```

## 🔄 RELOAD SAU KHI SỬA CODE

Chỉ cần **1 dòng lệnh duy nhất**:

```bash
cd ~/Documents/ksp-image-ext && bash setup.sh
```

Script tự rebuild + tự mở Chrome đến `chrome://extensions` → click ↻ trên card extension.

Hoặc nếu thích dev mode (auto-rebuild khi save file):

```bash
cd ~/Documents/ksp-image-ext && npm run dev
```

## 🔑 SETUP GEMINI API KEY (cho auto-translate VN→EN)

1. Lấy API key free tại: https://aistudio.google.com/app/apikey
2. Mở extension → tab **⚙️ Settings**
3. Paste key → Save → Test Key

## ✨ TÍNH NĂNG v0.4.1

### Magic Phrases (verbatim từ 18 docs)
- Engine inject nguyên văn các phrases từ 18 prompt docs đã verified
- Face lock 100% unchanged, Skin paradox với Natural Skin Texture
- BOKEH (Sony A7R V f/1.8) vs DOCUMENTARY (iPhone 15 Pro f/22 NO bokeh) — 2 style hoàn toàn tách biệt

### 5 Subject Types
- 👩 Nữ (default, full DNA editor)
- 👨 Nam (build, hair, beard, style vibe)
- 👫 Cặp đôi (1 nam + 1 nữ, custom group composition)
- 👨‍👩‍👧 Gia đình (cha mẹ + con)
- 👥 Nhóm bạn (3-10 người)

### 227 Themes Preset trong 12 categories
- 🌸 Mùa, 🎊 Lễ hội, 🇻🇳 Địa điểm VN (Bắc/Trung/Nam), 👗 Trang phục
- ☕ Lifestyle (gồm "Nhậu cụng ly 1-2-3 dzô", bia hơi Tạ Hiện, MRT, Grab bike, đám cưới...)
- 🌾 Đồng quê (chèo xuồng ba lá, hái sen, dừa nước, cấy lúa, cưỡi trâu...)
- 🏖 Du lịch, 💪 Thể thao, 💼 Career, 🌃 Time, 🎬 Cinema, 🛵 Phương tiện, 🎨 Style

### 8 Angle Presets — Auto-pick variation
Mỗi shot tự động pick góc khác nhau:
- 📐 Wide Front, ⬆️ Medium Low, 👁 Close-up Side, 🔄 3/4 View
- 👀 Over Shoulder, 🦅 Bird's Eye, 🌅 Back Facing, 🔍 Detail

### Pinterest right-click import
Right-click bất kỳ ảnh nào trên web → "Save to KSP Image" → category

### Library với download icon
Mỗi reference thumbnail có icon ⬇ để download nhanh

### Reference thumbnails next to Copy
Bên cạnh nút 📋 Copy mỗi shot có 2-5 thumbnail nhỏ — click để download từng ảnh

### Result tracking
Upload ảnh kết quả từ Banana Pro với tag ✅ Good / 🔄 Iter / ❌ Bad

## 📁 CẤU TRÚC FILES

```
ksp-image-ext/
├── setup.sh                  ← One-line install/reload script
├── manifest.json
├── package.json
├── src/
│   ├── components/           ← React UI
│   ├── engine/
│   │   ├── magicPhrases.ts   ← Verbatim phrases từ 18 docs
│   │   ├── blocks.ts         ← 13 block builders (subject-aware)
│   │   ├── assembler.ts
│   │   ├── angles.ts         ← 8 angle presets
│   │   ├── themes.ts         ← 119 base themes
│   │   ├── themesAdditional.ts ← 108 v0.4 themes
│   │   └── gemini.ts         ← VN→EN translation
│   ├── store/
│   ├── styles/
│   └── types/
├── scripts/
│   ├── install-extension.sh
│   └── reload-extension.sh
└── public/
```

## 🐛 TROUBLESHOOTING

**"Build fails":** `cd ~/Documents/ksp-image-ext && rm -rf node_modules dist && bash setup.sh`

**"Pinterest right-click không thấy":** Reload extension. Refresh trang web đang xem.

**"Auto-translate lỗi":** Settings → Test Key. Nếu fail, lấy key mới tại aistudio.google.com.

## 📋 CHANGELOG

Xem `CHANGELOG.md` cho lịch sử các phiên bản.
