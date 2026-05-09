/**
 * KSP Image — Region Snipper Content Script (v0.9.1 r6)
 *
 * Renders fullscreen overlay with crosshair on injection, captures user's
 * drag region, sends region coords + dpr back to background for
 * captureVisibleTab + OffscreenCanvas crop.
 *
 * Built standalone (no module imports) and emitted to dist/assets/snipper.js
 * for chrome.scripting.executeScript injection.
 *
 * r6 fixes vs r5:
 *   - Always cleanup any leftover overlay first (no `__kspSnipperActive` guard
 *     blocking re-inject after a failed cleanup).
 *   - Visible status messages right on the page for every state — no console
 *     needed to debug. Green ✅ on success, red ❌ on error with explicit
 *     instruction.
 *   - Explicit handling of `response === undefined` (service worker terminated
 *     mid-async, channel closed without sendResponse). Previous `response?.ok
 *     === false` check let this case fall through silently.
 *   - Snipper waits for response BEFORE cleaning up (success message visible).
 *   - `processed` flag prevents double-mouseup race.
 */

(() => {
  // CRITICAL: Always remove any existing overlay first.
  const existing = document.getElementById("ksp-snipper-overlay");
  if (existing) {
    console.log("[KSP Snipper] Removing leftover overlay from previous attempt");
    existing.remove();
  }

  console.log("[KSP Snipper] Initializing overlay v0.9.1-r6");

  const overlay = document.createElement("div");
  overlay.id = "ksp-snipper-overlay";
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647",
    cursor: "crosshair",
    background: "rgba(0, 0, 0, 0.35)",
    userSelect: "none",
  } as Partial<CSSStyleDeclaration>);

  const hint = document.createElement("div");
  Object.assign(hint.style, {
    position: "absolute",
    top: "16px",
    left: "50%",
    transform: "translateX(-50%)",
    padding: "10px 18px",
    background: "rgba(0, 0, 0, 0.9)",
    color: "white",
    fontSize: "13px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontWeight: "500",
    borderRadius: "6px",
    pointerEvents: "none",
    boxShadow: "0 2px 12px rgba(0,0,0,0.6)",
    transition: "background 0.2s",
    maxWidth: "80vw",
    textAlign: "center",
  } as Partial<CSSStyleDeclaration>);
  hint.textContent = "📷 Kéo chuột để chọn vùng outfit · ESC để hủy";
  overlay.appendChild(hint);

  const selection = document.createElement("div");
  Object.assign(selection.style, {
    position: "absolute",
    border: "2px solid #6a4a8a",
    background: "rgba(106, 74, 138, 0.15)",
    boxShadow: "0 0 0 2px rgba(255,255,255,0.3), inset 0 0 0 1px rgba(255,255,255,0.5)",
    display: "none",
    pointerEvents: "none",
  } as Partial<CSSStyleDeclaration>);
  overlay.appendChild(selection);

  const dimensions = document.createElement("div");
  Object.assign(dimensions.style, {
    position: "absolute",
    padding: "3px 6px",
    background: "rgba(106, 74, 138, 0.95)",
    color: "white",
    fontSize: "11px",
    fontFamily: "-apple-system, monospace",
    borderRadius: "3px",
    pointerEvents: "none",
    display: "none",
  } as Partial<CSSStyleDeclaration>);
  overlay.appendChild(dimensions);

  document.body.appendChild(overlay);

  let startX = 0;
  let startY = 0;
  let dragging = false;
  let processed = false;

  const showStatus = (msg: string, kind: "info" | "ok" | "error") => {
    hint.textContent = msg;
    hint.style.background =
      kind === "ok"
        ? "rgba(60, 180, 100, 0.95)"
        : kind === "error"
        ? "rgba(220, 60, 60, 0.95)"
        : "rgba(0, 0, 0, 0.9)";
  };

  const cleanup = (sendCancel: boolean) => {
    if (!document.body.contains(overlay)) return;
    overlay.remove();
    document.removeEventListener("keydown", onKey, true);
    if (sendCancel) {
      chrome.runtime.sendMessage({ type: "SNIP_CANCELLED" }).catch(() => {});
    }
  };

  const showErrorAndWaitClose = (errorMsg: string) => {
    overlay.style.opacity = "1";
    overlay.style.pointerEvents = "auto";
    overlay.style.cursor = "pointer";
    selection.style.display = "none";
    dimensions.style.display = "none";
    showStatus(`❌ ${errorMsg} — Click bất kỳ đâu để đóng`, "error");
    overlay.addEventListener("click", () => cleanup(true), { once: true });
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cleanup(true);
    }
  };
  document.addEventListener("keydown", onKey, true);

  overlay.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    if (processed) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    selection.style.left = `${startX}px`;
    selection.style.top = `${startY}px`;
    selection.style.width = "0px";
    selection.style.height = "0px";
    selection.style.display = "block";
    dimensions.style.display = "block";
    e.preventDefault();
  });

  overlay.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const x = Math.min(startX, e.clientX);
    const y = Math.min(startY, e.clientY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);
    selection.style.left = `${x}px`;
    selection.style.top = `${y}px`;
    selection.style.width = `${w}px`;
    selection.style.height = `${h}px`;
    dimensions.style.left = `${x + w + 6}px`;
    dimensions.style.top = `${y}px`;
    dimensions.textContent = `${w} × ${h}px`;
  });

  overlay.addEventListener("mouseup", async (e) => {
    if (!dragging || processed) return;
    dragging = false;
    processed = true;

    const x = Math.min(startX, e.clientX);
    const y = Math.min(startY, e.clientY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);

    if (w < 20 || h < 20) {
      console.log("[KSP Snipper] Region too small, cancelling");
      cleanup(true);
      return;
    }

    console.log("[KSP Snipper] mouseup at region:", { x, y, w, h, dpr: window.devicePixelRatio });

    showStatus(`📸 Đang capture vùng ${w}×${h}px...`, "info");
    selection.style.display = "none";
    dimensions.style.display = "none";

    overlay.style.opacity = "0";
    overlay.style.pointerEvents = "none";

    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
    await new Promise<void>((resolve) => setTimeout(resolve, 80));

    // Set up listener for SNIP_DONE message from background (reliable channel,
    // independent of sendResponse). This fires regardless of sendResponse outcome.
    let resultReceived = false;
    const resultListener = (incoming: any) => {
      if (incoming?.type !== "SNIP_DONE") return;
      if (resultReceived) return;
      resultReceived = true;
      chrome.runtime.onMessage.removeListener(resultListener);

      if (incoming.ok === false) {
        console.error("[KSP Snipper] SNIP_DONE error:", incoming.error);
        showErrorAndWaitClose(incoming.error || "Unknown error");
        return;
      }

      // Success
      overlay.style.opacity = "1";
      overlay.style.pointerEvents = "none";
      showStatus(
        `✅ Đã save ${incoming.width || w}×${incoming.height || h}px vào "${incoming.category}". Quay về sidebar KSP.`,
        "ok"
      );
      setTimeout(() => cleanup(false), 1800);
    };
    chrome.runtime.onMessage.addListener(resultListener);

    // Send the SNIP_REGION request. We DON'T rely on sendResponse for the
    // result — we wait for SNIP_DONE via the listener above. This works around
    // unreliable sendResponse channels in MV3 service workers.
    let response: any;
    try {
      response = await chrome.runtime.sendMessage({
        type: "SNIP_REGION",
        region: { x, y, w, h },
        dpr: window.devicePixelRatio || 1,
        sourceUrl: window.location.href,
      });
      console.log("[KSP Snipper] background sendResponse:", response);
    } catch (err: any) {
      console.error("[KSP Snipper] sendMessage threw:", err);
      // Channel error means service worker is gone or extension reloaded.
      // SNIP_DONE listener won't fire either. Show error.
      chrome.runtime.onMessage.removeListener(resultListener);
      showErrorAndWaitClose(`Lỗi gửi message: ${err?.message || err} (extension có thể đã reload — reload Chrome tab)`);
      return;
    }

    // sendResponse arrived with explicit error — show it (don't wait for SNIP_DONE)
    if (response && response.ok === false) {
      console.error("[KSP Snipper] sendResponse error:", response.error);
      chrome.runtime.onMessage.removeListener(resultListener);
      showErrorAndWaitClose(response.error || "Unknown error");
      return;
    }

    // Otherwise: wait for SNIP_DONE message. If sendResponse came back ok or
    // is undefined, we trust SNIP_DONE will arrive shortly.
    showStatus("📸 Đang xử lý — đang đợi background...", "info");

    // Timeout after 8s
    setTimeout(() => {
      if (resultReceived) return;
      resultReceived = true;
      chrome.runtime.onMessage.removeListener(resultListener);

      // If sendResponse came back with success (even partial), assume success.
      if (response && response.ok === true) {
        const cat = response.category || "saved";
        const ww = response.w || w;
        const hh = response.h || h;
        showStatus(
          `✅ Đã save ${ww}×${hh}px vào "${cat}". Quay về sidebar KSP.`,
          "ok"
        );
        setTimeout(() => cleanup(false), 1800);
        return;
      }

      // Otherwise show "likely saved, check sidebar" message
      overlay.style.opacity = "1";
      overlay.style.pointerEvents = "auto";
      overlay.style.cursor = "pointer";
      showStatus(
        "⚠️ Background không phản hồi (timeout 8s). Kiểm tra sidebar Library — ảnh có thể đã được save. Click để đóng.",
        "info"
      );
      hint.style.background = "rgba(232, 200, 116, 0.95)";
      hint.style.color = "black";
      overlay.addEventListener("click", () => cleanup(true), { once: true });
    }, 8000);
  });
})();

export {};
