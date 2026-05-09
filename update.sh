#!/usr/bin/env bash
# update.sh — Update KSP Image với 1 lệnh
#
# Cách dùng:
#   bash ~/Downloads/ksp-image-ext-v0_9_0/update.sh
#   hoặc bất kỳ folder đã setup nào
#
# Script này:
# 1. Tìm zip mới hơn trong ~/Downloads
# 2. Sync source files vào folder hiện tại (KHÔNG xóa folder → Chrome nhớ path)
# 3. npm install nếu package.json đổi
# 4. npm run build
# 5. Hết. Vào chrome://extensions click ↻ là xong.

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

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOWNLOADS="$HOME/Downloads"

cd "$PROJECT_DIR"

echo ""
echo -e "${BOLD}🔄 KSP Image — Update${NC}"
echo -e "📂 ${PROJECT_DIR}"
echo ""

# Verify project
if [ ! -f "package.json" ]; then
    err "Không tìm thấy package.json. Anh chạy update.sh ở đâu?"
    exit 1
fi

# ===== Step 1: Check for newer zip in Downloads =====
LATEST_ZIP=$(ls -t "$DOWNLOADS"/ksp-image-ext-*.zip 2>/dev/null | grep -v "DIST-READY" | head -1)

if [ -n "$LATEST_ZIP" ]; then
    ZIP_MTIME=$(stat -f "%m" "$LATEST_ZIP" 2>/dev/null || stat -c "%Y" "$LATEST_ZIP" 2>/dev/null)
    PROJECT_MTIME=$(stat -f "%m" "$PROJECT_DIR/package.json" 2>/dev/null || stat -c "%Y" "$PROJECT_DIR/package.json" 2>/dev/null)

    if [ "$ZIP_MTIME" -gt "$PROJECT_MTIME" ]; then
        step "Phát hiện zip mới hơn: $(basename "$LATEST_ZIP")"
        step "Updating source files (giữ nguyên folder path)..."

        TMP=$(mktemp -d)
        unzip -q "$LATEST_ZIP" -d "$TMP"

        # Find source folder inside zip
        SRC_FOLDER=$(find "$TMP" -maxdepth 3 -name "package.json" -exec dirname {} \; | head -1)

        if [ -z "$SRC_FOLDER" ]; then
            err "Zip không hợp lệ (không tìm thấy package.json)"
            rm -rf "$TMP"
            exit 1
        fi

        # Sync source (preserve node_modules + dist)
        if command -v rsync &> /dev/null; then
            rsync -a --delete \
                --exclude='node_modules' \
                --exclude='dist' \
                --exclude='.installed' \
                --exclude='.DS_Store' \
                --exclude='screenshots' \
                "$SRC_FOLDER/" "$PROJECT_DIR/"
        else
            for item in "$SRC_FOLDER"/*; do
                name=$(basename "$item")
                if [ "$name" != "node_modules" ] && [ "$name" != "dist" ] && [ "$name" != ".installed" ]; then
                    rm -rf "$PROJECT_DIR/$name"
                    cp -R "$item" "$PROJECT_DIR/$name"
                fi
            done
        fi

        rm -rf "$TMP"
        ok "Source updated từ $(basename "$LATEST_ZIP")"
    else
        ok "Source đã là bản mới nhất (skip extract)"
    fi
else
    warn "Không tìm thấy ksp-image-ext-*.zip trong ~/Downloads"
    warn "Sẽ chỉ rebuild source hiện có"
fi

# ===== Step 2: npm install if needed =====
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules/.package-lock.json" 2>/dev/null ]; then
    step "Installing/updating dependencies..."
    npm install --silent 2>&1 | tail -3
    ok "Dependencies updated"
fi

# ===== Step 3: Build =====
step "Building..."
rm -rf dist
npm run build > /tmp/ksp-build.log 2>&1 || {
    err "Build failed:"
    tail -25 /tmp/ksp-build.log
    exit 1
}

VERSION=$(grep '"version"' "$PROJECT_DIR/dist/manifest.json" | head -1 | sed 's/.*"version": "\([^"]*\)".*/\1/')
ok "Built v$VERSION → $PROJECT_DIR/dist"

# ===== Step 4: Done =====
echo ""
echo -e "${GREEN}${BOLD}✅ Done. Vào Chrome:${NC}"
echo "   1. Mở chrome://extensions"
echo "   2. Click reload (↻) trên card 'KSP Image'"
echo "   3. Đóng/mở lại side panel"
echo ""
