#!/usr/bin/env bash
# reload-extension.sh
# Rebuilds extension. Chrome will auto-pick up changes when you click reload
# in chrome://extensions, or when extension is loaded with HMR via dev mode.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "🔨 Rebuilding extension..."
npm run build

echo "✅ Done. In Chrome:"
echo "   - Go to chrome://extensions"
echo "   - Click the reload icon (↻) on the KSP ImagePrompt card"
echo "   - Or close and reopen the side panel"
echo ""
echo "💡 Tip: Use 'npm run dev' for auto-rebuild on file changes."
echo "   Then just click reload (↻) in chrome://extensions when you save."
