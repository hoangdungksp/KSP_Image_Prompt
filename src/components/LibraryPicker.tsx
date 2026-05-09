/**
 * KSP Image v0.9.1 — Library Picker Overlay
 *
 * Modal grid that lists all references from Dexie Library filtered by category.
 * Used by Cast Photos face/outfit slots to pick existing images saved via:
 *   1. Manual upload to Library tab
 *   2. Right-click "Save to KSP Image" → category (Pinterest, Google Images, etc.)
 *
 * On open: calls processPendingImports() to flush chrome.storage queue first,
 * so newly saved Pinterest images appear immediately.
 */

import React, { useEffect, useState } from "react";
import { db, listReferenceImages, processPendingImports, type RefCategory, type StoredReferenceImage } from "../store/db";

interface LibraryPickerProps {
  category: "face" | "outfit";
  onPick: (data: { dataUrl: string; mimeType: string; filename: string }) => void;
  onClose: () => void;
}

export function LibraryPicker({ category, onPick, onClose }: LibraryPickerProps) {
  const [refs, setRefs] = useState<StoredReferenceImage[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      // First flush Pinterest right-click queue → Library so they appear immediately
      await processPendingImports();
      const items = await listReferenceImages(category as RefCategory);
      setRefs(items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // Listen for new pending imports while picker is open (e.g. user right-clicks
    // a Pinterest image in another tab while overlay is showing).
    const handler = (msg: any) => {
      if (msg?.type === "PENDING_IMPORT_ADDED" || msg?.type === "SNIP_DONE") {
        // Small delay to ensure Library tab finished processing the queue
        setTimeout(() => refresh(), 300);
      }
    };
    if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(handler);
      return () => {
        try {
          chrome.runtime.onMessage.removeListener(handler);
        } catch {
          // Ignore — onMessage may not be a real Chrome API in test/dev env
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const handlePick = async (ref: StoredReferenceImage) => {
    // Convert blob → dataUrl
    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(ref.blob);
    });
    onPick({
      dataUrl,
      mimeType: ref.blob.type || "image/jpeg",
      filename: ref.name || `${category}-${ref.id.slice(-6)}.jpg`,
    });
    onClose();
  };

  const categoryLabel = category === "face" ? "👤 Face" : "👗 Outfit";

  return (
    <div className="ksp-library-picker-backdrop" onClick={onClose}>
      <div
        className="ksp-library-picker"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="ksp-library-picker-header">
          <span className="ksp-library-picker-title">
            Chọn {categoryLabel} từ Library
          </span>
          <button
            type="button"
            className="ksp-btn-icon"
            onClick={onClose}
            aria-label="Đóng"
            title="Đóng"
          >
            ✕
          </button>
        </header>

        <div className="ksp-library-picker-body">
          {loading && (
            <div className="ksp-library-picker-empty">Đang tải...</div>
          )}
          {!loading && refs.length === 0 && (
            <div className="ksp-library-picker-empty">
              <p style={{ margin: "0 0 8px" }}>
                Chưa có {category === "face" ? "face ref" : "outfit"} nào trong Library.
              </p>
              <p style={{ margin: 0, fontSize: 11, color: "#888" }}>
                💡 Right-click ảnh trên Pinterest / Google Images →{" "}
                <strong>Save to KSP Image</strong> →{" "}
                <strong>{category === "face" ? "Save as Face" : "Save as Outfit"}</strong>.
              </p>
            </div>
          )}
          {!loading && refs.length > 0 && (
            <div className="ksp-library-picker-grid">
              {refs.map((ref) => (
                <RefThumb key={ref.id} ref0={ref} onClick={() => handlePick(ref)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RefThumb({ ref0, onClick }: { ref0: StoredReferenceImage; onClick: () => void }) {
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    const url = URL.createObjectURL(ref0.blob);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [ref0.id, ref0.blob]);

  return (
    <button
      type="button"
      className="ksp-library-picker-thumb"
      onClick={onClick}
      title={ref0.name || ref0.id}
    >
      {src && <img src={src} alt={ref0.name || "ref"} />}
      {ref0.source === "pinterest" && (
        <span className="ksp-library-picker-badge">📌</span>
      )}
    </button>
  );
}
