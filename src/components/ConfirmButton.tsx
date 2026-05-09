/**
 * KSP Image v0.9.0 — Inline Confirm Button
 *
 * Replaces browser confirm() dialog (crashes Chrome extension sidepanel)
 * with inline 2-step confirm UI:
 *   - First click: shows "Xác nhận?" + Yes/No
 *   - Second click on Yes: triggers onConfirm
 *
 * Usage:
 *   <ConfirmButton onConfirm={() => doDelete()}>🗑 Delete</ConfirmButton>
 */

import React, { useState, useEffect } from "react";

export function ConfirmButton({
  onConfirm,
  className = "ksp-btn ksp-btn-sm ksp-btn-danger-ghost",
  confirmClassName = "ksp-btn ksp-btn-sm ksp-btn-danger-ghost",
  children,
  confirmText = "Xác nhận?",
  resetMs = 4000,
  title,
  stopPropagation = true,
}: {
  onConfirm: () => void;
  className?: string;
  confirmClassName?: string;
  children: React.ReactNode;
  confirmText?: string;
  resetMs?: number;
  title?: string;
  stopPropagation?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  // Auto-reset after timeout (so a stale confirm state doesn't linger)
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), resetMs);
    return () => clearTimeout(t);
  }, [confirming, resetMs]);

  const handleClick = (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    onConfirm();
  };

  return (
    <button
      type="button"
      className={confirming ? confirmClassName : className}
      onClick={handleClick}
      title={title}
      style={confirming ? { background: "rgba(226, 75, 74, 0.25)", borderColor: "#e24b4a", color: "#e24b4a" } : undefined}
    >
      {confirming ? `⚠ ${confirmText}` : children}
    </button>
  );
}
