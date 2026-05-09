#!/usr/bin/env bash
# git-upload.sh — Upload KSP Image v0.9.0 lên GitHub
#
# Usage:
#   bash git-upload.sh                                    # Init + commit local
#   bash git-upload.sh git@github.com:USER/REPO.git      # Commit + push remote
#   bash git-upload.sh https://github.com/USER/REPO.git  # HTTPS variant
#
# Script này:
# 1. Init git repo nếu chưa có
# 2. Add tất cả files (respecting .gitignore)
# 3. Commit với message "v0.9.0 release: Multi-mode AI Cinema"
# 4. Nếu cung cấp REMOTE_URL: add remote + push
# 5. Hết. Repo lên GitHub.

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
REMOTE_URL="$1"

cd "$PROJECT_DIR"

echo ""
echo -e "${BOLD}🚀 KSP Image v0.9.0 — Git Upload${NC}"
echo ""

# Check git installed
if ! command -v git &> /dev/null; then
    err "Git chưa cài. Cài bằng: brew install git"
    exit 1
fi

# ===== Step 1: Init repo if not exist =====
if [ ! -d ".git" ]; then
    step "Initializing git repo..."
    git init
    git branch -M main
    ok "Git initialized"
else
    ok "Git repo đã tồn tại"
fi

# ===== Step 2: Configure local user nếu chưa có =====
if ! git config user.email > /dev/null 2>&1; then
    warn "Chưa config git user. Setup:"
    echo "   git config user.name \"Jason Nguyen\""
    echo "   git config user.email \"your@email.com\""
    echo ""
    echo "Hoặc dùng global config (khuyên):"
    echo "   git config --global user.name \"Jason Nguyen\""
    echo "   git config --global user.email \"your@email.com\""
    exit 1
fi

# ===== Step 3: Stage all files =====
step "Staging files (respecting .gitignore)..."
git add -A
ok "Staged"

# Show what's gonna commit
echo ""
echo -e "${BOLD}Files to commit:${NC}"
git status --short | head -20
TOTAL=$(git status --short | wc -l | tr -d ' ')
if [ "$TOTAL" -gt 20 ]; then
    echo "... and $((TOTAL - 20)) more files"
fi
echo ""

# ===== Step 4: Commit =====
COMMIT_MSG="v0.9.0 release: Multi-mode AI Cinema

Major rewrite từ v0.8.1 → multi-mode AI cinema toolkit.

Features:
- 4 modes: Photos / TVC Commercial / Product Photo / Film
- 7-step pipeline: Idea → Concept/Script → Storyboard → Image → Video → Voice → Music → Bundle
- Cast multi-character với face/body refs + AI Generate Hybrid
- Film Script (7-field per-scene) + TVC Concept (8-field treatment)
- Versioning với last-10 revert
- Storyboard hierarchy: Film → Scenes → Shots, mỗi shot = 1 grid
- Shot Detail Panel: frames + image prompt + animation chunks + frame replace
- Bundle Export ZIP package
- 7 English AI prompt templates (international cinema)
- API Keys management (Gemini/OpenAI/ElevenLabs/Google TTS/Suno)
- Per-task AI provider config
- Time format: decimal/integer/timecode

Test: 14/14 vitest runtime tests pass.
Build: 0 TypeScript errors, ~7s Vite build.

Bug fixed: infinite re-render loop trong ProjectSettingSectionV09 + CastSectionV09
(getApiKeysStatus() trong selector → object mới mỗi render → vòng lặp)."

if git diff --cached --quiet; then
    warn "Không có thay đổi để commit"
else
    step "Committing..."
    git commit -m "$COMMIT_MSG"
    ok "Committed"
fi

# ===== Step 5: Push to remote nếu cung cấp =====
if [ -n "$REMOTE_URL" ]; then
    step "Setting up remote..."

    # Check existing remote
    if git remote get-url origin > /dev/null 2>&1; then
        EXISTING=$(git remote get-url origin)
        if [ "$EXISTING" != "$REMOTE_URL" ]; then
            warn "Remote 'origin' đã tồn tại: $EXISTING"
            warn "Cập nhật về: $REMOTE_URL"
            git remote set-url origin "$REMOTE_URL"
        fi
    else
        git remote add origin "$REMOTE_URL"
    fi
    ok "Remote: $REMOTE_URL"

    step "Pushing to GitHub..."
    if git push -u origin main 2>&1; then
        ok "Pushed!"
    else
        err "Push failed. Có thể do:"
        echo "   - Repo chưa tạo trên GitHub (vào github.com → New repository)"
        echo "   - SSH key chưa setup (cho git@github.com:...)"
        echo "   - Cần --force nếu repo có file khác (hỏi cẩn thận!)"
        exit 1
    fi

    # Print final info
    REPO_HTTPS=$(echo "$REMOTE_URL" | sed -e 's|^git@github.com:|https://github.com/|' -e 's|\.git$||')
    echo ""
    echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}${BOLD}🎉 Repo lên GitHub:${NC}"
    echo -e "   ${GREEN}$REPO_HTTPS${NC}"
    echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

else
    # No remote provided — show instructions
    echo ""
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}📦 Local commit done. Push lên GitHub:${NC}"
    echo ""
    echo -e "${YELLOW}Bước 1:${NC} Tạo repo trên GitHub"
    echo "   → Vào https://github.com/new"
    echo "   → Repository name: ksp-image-extension (hoặc tên khác)"
    echo "   → Private hoặc Public tùy"
    echo "   → KHÔNG chọn 'Initialize with README' (đã có rồi)"
    echo "   → Click 'Create repository'"
    echo ""
    echo -e "${YELLOW}Bước 2:${NC} Chạy lại với URL:"
    echo -e "${GREEN}   bash git-upload.sh git@github.com:YOUR_USERNAME/ksp-image-extension.git${NC}"
    echo ""
    echo "   Hoặc HTTPS:"
    echo -e "${GREEN}   bash git-upload.sh https://github.com/YOUR_USERNAME/ksp-image-extension.git${NC}"
    echo ""
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
fi
