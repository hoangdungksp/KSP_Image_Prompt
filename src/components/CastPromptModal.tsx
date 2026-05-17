/**
 * Sprint G1d (Item 6) — Cast Prompt Modal
 *
 * Shows AI-generated face + body EN prompts for ONE character. User copies
 * each prompt → pastes into Banana Pro / Nano Banana / Imagen 4 → generates
 * image → uploads back into Face/Body refs (slot 0 = "front").
 *
 * Tabs:
 *   - Face portrait prompt (1:1 close-up)
 *   - Full body prompt (3:4 portrait)
 *
 * Action buttons per tab:
 *   - 📋 Copy → clipboard
 *   - 🔄 Regen → re-run engine (costs 1 AI call, replaces both prompts)
 *
 * Anchor tokens panel (collapsible) — consistency lock checklist.
 */
import React, { useState } from "react";
import type { CastPromptSet } from "../engine/filmCastGeneration";
import type { FilmCharacter } from "../types/film";

type TabKey = "face" | "body";

export interface CastPromptModalProps {
  character: FilmCharacter;
  result: CastPromptSet;
  /** Whether the multimodal (faceRef-matched) mode is enabled. Modal shows a badge. */
  matchedToRefs: boolean;
  /** Re-run engine. Caller handles loading state + replaces result. */
  onRegen: (useFaceRefForMatch: boolean) => void;
  /** True while a regen call is in flight. Disables buttons + shows spinner label. */
  isRegenerating: boolean;
  onClose: () => void;
  /** Required for clipboard toast feedback. */
  showToast: (msg: string, kind?: "success" | "error" | "info") => void;
}

export function CastPromptModal({
  character,
  result,
  matchedToRefs,
  onRegen,
  isRegenerating,
  onClose,
  showToast,
}: CastPromptModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("face");
  const [showAnchorTokens, setShowAnchorTokens] = useState(false);
  const [useFaceRefForMatch, setUseFaceRefForMatch] = useState(matchedToRefs);

  const hasFaceRef = (character.faceRefs?.length ?? 0) > 0;
  const activePrompt = activeTab === "face" ? result.facePrompt : result.bodyPrompt;
  const charName = character.name.trim() || `Character ${character.order}`;

  function handleCopy() {
    navigator.clipboard.writeText(activePrompt);
    showToast(
      `Copied ${activeTab === "face" ? "face" : "body"} prompt (${activePrompt.length} chars)`,
      "success"
    );
  }

  function handleRegen() {
    onRegen(useFaceRefForMatch);
  }

  return (
    <div className="ksp-cast-prompt-modal-backdrop" onClick={onClose}>
      <div className="ksp-cast-prompt-modal" onClick={(e) => e.stopPropagation()}>
        <header className="ksp-cast-prompt-modal-header">
          <h3 className="ksp-cast-prompt-modal-title">
            📝 Prompt cho {charName}
          </h3>
          {matchedToRefs && hasFaceRef && (
            <span className="ksp-cast-prompt-modal-badge" title="AI đã đọc face ref đã upload">
              ✓ Matched to refs
            </span>
          )}
          <button
            type="button"
            className="ksp-cast-prompt-modal-close"
            onClick={onClose}
            aria-label="Đóng modal"
          >
            ✕
          </button>
        </header>

        <div className="ksp-cast-prompt-modal-tabs">
          <button
            type="button"
            className={`ksp-cast-prompt-modal-tab ${
              activeTab === "face" ? "ksp-cast-prompt-modal-tab-active" : ""
            }`}
            onClick={() => setActiveTab("face")}
          >
            👤 Face portrait
            <span className="ksp-cast-prompt-modal-tab-chars">
              {result.facePrompt.length} chars
            </span>
          </button>
          <button
            type="button"
            className={`ksp-cast-prompt-modal-tab ${
              activeTab === "body" ? "ksp-cast-prompt-modal-tab-active" : ""
            }`}
            onClick={() => setActiveTab("body")}
          >
            🧍 Full body
            <span className="ksp-cast-prompt-modal-tab-chars">
              {result.bodyPrompt.length} chars
            </span>
          </button>
        </div>

        <div className="ksp-cast-prompt-modal-body">
          <textarea
            className="ksp-cast-prompt-modal-textarea"
            readOnly
            value={activePrompt}
            rows={10}
          />

          <div className="ksp-cast-prompt-modal-actions">
            <button
              type="button"
              className="ksp-btn ksp-btn-primary ksp-btn-sm"
              onClick={handleCopy}
              disabled={isRegenerating}
            >
              📋 Copy
            </button>
            <button
              type="button"
              className="ksp-btn ksp-btn-ghost ksp-btn-sm"
              onClick={handleRegen}
              disabled={isRegenerating}
            >
              {isRegenerating ? "⏳ Đang sinh..." : "🔄 Regen"}
            </button>
            {hasFaceRef && (
              <label
                className="ksp-cast-prompt-modal-match-toggle"
                title="AI đọc face ref đã upload để match appearance (multimodal call, tốn token hơn)"
              >
                <input
                  type="checkbox"
                  checked={useFaceRefForMatch}
                  onChange={(e) => setUseFaceRefForMatch(e.target.checked)}
                  disabled={isRegenerating}
                />
                <span>Match refs</span>
              </label>
            )}
          </div>

          {/* Anchor tokens — consistency lock checklist */}
          {result.anchorTokens.length > 0 && (
            <div className="ksp-cast-prompt-modal-anchor">
              <button
                type="button"
                className="ksp-cast-prompt-modal-anchor-toggle"
                onClick={() => setShowAnchorTokens(!showAnchorTokens)}
              >
                {showAnchorTokens ? "▼" : "▶"} 🔒 Anchor tokens ({result.anchorTokens.length})
              </button>
              {showAnchorTokens && (
                <ul className="ksp-cast-prompt-modal-anchor-list">
                  {result.anchorTokens.map((tok, i) => (
                    <li key={i}>{tok}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="ksp-cast-prompt-modal-workflow">
            <strong>Workflow:</strong>
            <ol>
              <li>Click 📋 Copy</li>
              <li>Paste vào Banana Pro / Nano Banana / Imagen 4 → generate → download</li>
              <li>Đóng modal → upload ảnh vào Face refs (slot 0 = "front") hoặc Body refs</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
