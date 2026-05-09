#!/usr/bin/env bash
# setup.sh — 1-LỆNH cài đặt KSP Image v0.9.0
#
# Cách dùng (1 trong 2):
#
# Cách 1 — Từ Downloads (tự động):
#   bash ~/Downloads/ksp-image-ext-v0_9_0/setup.sh
#
# Cách 2 — Đã unzip rồi:
#   cd ~/Downloads/ksp-image-ext-v0_9_0 && bash setup.sh
#
# Script này tự:
# 1. Check Node + npm
# 2. npm install (nếu chưa có node_modules)
# 3. npm run build → tạo dist/
# 4. Copy path dist/ vào clipboard (Mac)
# 5. In ra hướng dẫn load Chrome
# 6. Mark .installed → setup.sh sẽ skip lần sau

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

step() { echo -e "${BLUE}${BOLD}▶ $1${NC}"; }
ok() { echo -e "${GREEN}✓ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
err() { echo -e "${RED}✗ $1${NC}"; }

# Resolve project dir (folder chứa script này)
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo ""
echo -e "${BOLD}🚀 KSP Image v0.9.0 — Install${NC}"
echo -e "📂 ${PROJECT_DIR}"
echo ""

# ===== Step 1: Check Node =====
if ! command -v node &> /dev/null; then
    err "Node.js chưa cài."
    echo ""
    echo "Cài Node.js 20+ trước:"
    echo "  ${GREEN}brew install node${NC}"
    echo "  hoặc download: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v)
ok "Node $NODE_VERSION"

# ===== Step 2: Verify package.json =====
if [ ! -f "package.json" ]; then
    err "Không tìm thấy package.json trong $(pwd)"
    echo ""
    echo "Có vẻ anh chưa unzip hoặc chạy script ở thư mục sai."
    echo ""
    echo "Hướng dẫn:"
    echo "  1. Download ksp-image-ext-v0_9_0.zip về ~/Downloads"
    echo "  2. Unzip:"
    echo -e "     ${GREEN}cd ~/Downloads && unzip -o ksp-image-ext-v0_9_0.zip -d ksp-image-ext${NC}"
    echo "  3. Chạy lại:"
    echo -e "     ${GREEN}cd ~/Downloads/ksp-image-ext && bash setup.sh${NC}"
    exit 1
fi

# ===== Step 3: Install deps =====
if [ ! -d "node_modules" ]; then
    step "Installing dependencies (lần đầu, ~1 phút)..."
    npm install --silent 2>&1 | tail -5 || {
        err "npm install thất bại"
        exit 1
    }
    ok "Dependencies installed"
else
    ok "Dependencies đã có (skip)"
fi

# ===== Step 4: Build =====
step "Building production..."
rm -rf dist
npm run build > /tmp/ksp-build.log 2>&1 || {
    err "Build failed:"
    tail -25 /tmp/ksp-build.log
    exit 1
}

if [ ! -f "dist/manifest.json" ]; then
    err "Build xong nhưng không tìm thấy dist/manifest.json"
    exit 1
fi

VERSION=$(grep '"version"' "dist/manifest.json" | head -1 | sed 's/.*"version": "\([^"]*\)".*/\1/')
DIST_PATH="$PROJECT_DIR/dist"
ok "Built v$VERSION → $DIST_PATH"

# ===== Step 5: Copy path to clipboard (Mac) =====
if [[ "$OSTYPE" == "darwin"* ]] && command -v pbcopy &> /dev/null; then
    echo -n "$DIST_PATH" | pbcopy
    PATH_COPIED=true
else
    PATH_COPIED=false
fi

# ===== Step 6: Mark installed =====
touch "$PROJECT_DIR/.installed"

# ===== Step 7: Print Chrome instructions =====
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}📦 LOAD VÀO CHROME (1 lần duy nhất):${NC}"
echo ""

if [ "$PATH_COPIED" = true ]; then
    echo -e "Đường dẫn ${YELLOW}đã copy vào clipboard${NC}:"
else
    echo -e "Đường dẫn (copy thủ công):"
fi
echo -e "  ${GREEN}$DIST_PATH${NC}"
echo ""
echo -e "1. Mở Chrome → ${BOLD}chrome://extensions${NC}"
echo -e "2. Bật ${BOLD}'Developer mode'${NC} (góc phải trên)"
echo -e "3. Click ${BOLD}'Load unpacked'${NC}"
if [ "$PATH_COPIED" = true ]; then
    echo -e "4. Trong dialog Finder: ${BOLD}Cmd+Shift+G → Cmd+V${NC} (paste path) → Enter → Open"
else
    echo "4. Chọn folder dist/ ở đường dẫn trên"
fi
echo "5. Pin extension vào toolbar"
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BOLD}🎬 v0.9.0 — Multi-mode AI Cinema${NC}"
echo ""
echo -e "  Click extension icon → ${GREEN}sidebar v0.9.0${NC} mở (vertical 380px)"
echo "  Sidebar có 7-step pipeline: Project → Cast → Idea → Script → Storyboard → Voice → Music → Bundle"
echo "  Modes: Photos / TVC / Product / Film"
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}${BOLD}🔄 LẦN SAU MUỐN UPDATE CODE:${NC}"
echo ""
echo "   Khi có ZIP mới trong ~/Downloads, chỉ cần chạy:"
echo -e "     ${GREEN}bash $PROJECT_DIR/update.sh${NC}"
echo ""
echo "   → Tự rebuild → Vào chrome://extensions click ↻ là xong."
echo "   → KHÔNG cần Load unpacked lại (Chrome nhớ path)."
echo ""
