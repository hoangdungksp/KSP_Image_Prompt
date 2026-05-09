#!/usr/bin/env bash
# install-extension.sh
# One-time setup: builds extension and opens Chrome with it loaded.
# Subsequent reloads use reload-extension.sh.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$PROJECT_DIR/dist"

cd "$PROJECT_DIR"

echo "🔨 Building extension..."
npm run build

if [ ! -d "$DIST_DIR" ]; then
  echo "❌ Build failed - dist/ not found"
  exit 1
fi

echo "✅ Built to: $DIST_DIR"
echo ""
echo "📦 Manual install (one-time):"
echo "   1. Open Chrome → chrome://extensions"
echo "   2. Enable 'Developer mode' (toggle top right)"
echo "   3. Click 'Load unpacked'"
echo "   4. Select this folder:"
echo "      $DIST_DIR"
echo ""
echo "🔁 After this, just run 'npm run reload-ext' to rebuild."
echo ""

# Auto-open Chrome on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
  echo "🚀 Opening chrome://extensions..."
  open -a "Google Chrome" "chrome://extensions"
fi
