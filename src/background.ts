/// <reference types="chrome" />

/**
 * KSP Image - Background Service Worker
 *
 * Responsibilities:
 * 1. Open side panel when extension icon clicked
 * 2. Right-click "Save to KSP Image" on any image
 * 3. Fetch image (with Pinterest hi-res trick) → save to IndexedDB via message
 *
 * v0.6.3: Improved context menu reliability with heartbeat + defensive registration
 * to fix issue where context menu sometimes disappears (Chrome MV3 service worker
 * gets killed after 30s idle, taking listeners with it).
 */

// ============================================================================
// Side panel setup
// ============================================================================

// ============================================================================
// Action click → Open side panel (v0.9.0 UI is now in side panel)
// ============================================================================

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Side panel setup error:", error));

// ============================================================================
// Context menu setup — register defensively on multiple events
// ============================================================================

function setupContextMenus() {
  try {
    chrome.contextMenus.removeAll(() => {
      // Parent menu
      chrome.contextMenus.create({
        id: "ksp-save-image-parent",
        title: "💾 Save to KSP Image",
        contexts: ["image"],
      }, () => {
        if (chrome.runtime.lastError) {
          console.warn("[KSP Image] Parent menu create:", chrome.runtime.lastError.message);
        }
      });

      // Children with category
      chrome.contextMenus.create({
        id: "ksp-save-as-face",
        parentId: "ksp-save-image-parent",
        title: "📷 Save as Face",
        contexts: ["image"],
      });
      chrome.contextMenus.create({
        id: "ksp-save-as-outfit",
        parentId: "ksp-save-image-parent",
        title: "👗 Save as Outfit",
        contexts: ["image"],
      });
      chrome.contextMenus.create({
        id: "ksp-save-as-product",
        parentId: "ksp-save-image-parent",
        title: "📦 Save as Product",
        contexts: ["image"],
      });
      chrome.contextMenus.create({
        id: "ksp-save-as-inspiration",
        parentId: "ksp-save-image-parent",
        title: "💡 Save as Inspiration",
        contexts: ["image"],
      });
      chrome.contextMenus.create({
        id: "ksp-save-as-general",
        parentId: "ksp-save-image-parent",
        title: "📁 Save (uncategorized)",
        contexts: ["image"],
      });

      console.log("[KSP Image] Context menus registered");
    });
  } catch (e) {
    console.error("[KSP Image] Context menu setup error:", e);
  }
}

// Register on install (fresh install / extension update)
chrome.runtime.onInstalled.addListener(() => {
  setupContextMenus();
});

// Register on Chrome startup (in case service worker was killed)
chrome.runtime.onStartup.addListener(() => {
  setupContextMenus();
});

// v0.6.3: Also setup immediately when service worker wakes up (top-level)
// This handles the case where SW was killed after idle and woken up by an event
setupContextMenus();

// v0.6.3: Heartbeat keep-alive to prevent SW from being killed after 30s idle
// Best practice from Chrome docs: periodic API call resets the idle timer
let heartbeatInterval: number | undefined;

function startHeartbeat() {
  if (heartbeatInterval) return;
  // Touch storage every 20s to keep SW alive (under 30s idle threshold)
  heartbeatInterval = setInterval(() => {
    chrome.storage.local.get("__ksp_heartbeat__").catch(() => {
      // ignore errors
    });
  }, 20_000) as unknown as number;
}

// Start heartbeat on SW activation
startHeartbeat();

// v0.6.3: Re-register context menu on tab activation (extra safety net)
// If user switches tabs, we know SW is alive again — verify menus exist
let lastMenuCheck = 0;
chrome.tabs.onActivated.addListener(() => {
  const now = Date.now();
  // Throttle: only re-check every 5 minutes
  if (now - lastMenuCheck < 5 * 60 * 1000) return;
  lastMenuCheck = now;

  // Check if our parent menu exists, re-register if not
  // (chrome.contextMenus has no list API, so we just re-register defensively)
  setupContextMenus();
});

// ============================================================================
// Pinterest hi-res URL trick
// ============================================================================

/**
 * Pinterest serves images at multiple resolutions:
 *   /236x/...   - thumbnail
 *   /474x/...   - medium
 *   /564x/...   - medium-large
 *   /736x/...   - large
 *   /originals/... - full resolution (best quality)
 *
 * If the image is from pinimg.com, replace any size segment with /originals/
 */
function getPinterestHiResUrl(url: string): string | null {
  if (!url.includes("pinimg.com")) return null;
  // Match patterns like /236x/, /474x/, /564x/, /736x/
  const hiRes = url.replace(/\/\d+x\//, "/originals/");
  return hiRes !== url ? hiRes : null;
}

// ============================================================================
// Image fetcher - tries hi-res first, falls back to original
// ============================================================================

async function fetchImageBlob(url: string): Promise<Blob> {
  // Try Pinterest hi-res first
  const hiResUrl = getPinterestHiResUrl(url);
  if (hiResUrl) {
    try {
      const r = await fetch(hiResUrl);
      if (r.ok) {
        const blob = await r.blob();
        if (blob.size > 0) return blob;
      }
    } catch (e) {
      console.log("Hi-res fetch failed, falling back:", e);
    }
  }

  // Fallback: original URL
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const blob = await r.blob();
  if (blob.size === 0) throw new Error("Empty blob");
  return blob;
}

// ============================================================================
// Show notification
// ============================================================================

function showNotification(title: string, message: string, isError = false) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: chrome.runtime.getURL("public/icon128.png"),
    title,
    message,
    priority: isError ? 2 : 0,
  });
}

// ============================================================================
// Context menu click handler
// ============================================================================

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const menuId = String(info.menuItemId);
  if (!menuId.startsWith("ksp-save-as-")) return;

  if (!info.srcUrl) {
    showNotification("KSP Image", "Không tìm thấy URL ảnh", true);
    return;
  }

  // Extract category from menuId
  const category = menuId.replace("ksp-save-as-", "") as
    | "face"
    | "outfit"
    | "product"
    | "inspiration"
    | "general";

  try {
    const blob = await fetchImageBlob(info.srcUrl);

    // Convert blob to base64 for message passing (Service Workers can't pass Blobs directly to other contexts reliably)
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    await addPendingImport({
      data: base64,
      type: blob.type,
      category,
      sourceUrl: info.pageUrl || info.srcUrl,
    });

    showNotification(
      "✅ Đã lưu vào KSP Image",
      `Category: ${category}. Mở side panel để xem.`
    );
  } catch (e: any) {
    console.error("Image save failed:", e);
    showNotification(
      "❌ KSP Image — Lỗi",
      `Không thể lưu ảnh: ${e.message}`,
      true
    );
  }
});

// ============================================================================
// SHARED: addPendingImport — used by both right-click context menu + snip
// ============================================================================
async function addPendingImport(payload: {
  data: string;          // base64 data URL
  type: string;          // mime type
  category: "face" | "outfit" | "product" | "inspiration" | "general";
  sourceUrl: string;
  source?: "pinterest" | "snip";
}) {
  const queueKey = `ksp_pending_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const pending = {
    key: queueKey,
    data: payload.data,
    type: payload.type,
    category: payload.category,
    sourceUrl: payload.sourceUrl,
    source: payload.source || "pinterest",
    createdAt: Date.now(),
  };

  const result = await chrome.storage.local.get("ksp_pending_imports");
  const queue = result.ksp_pending_imports || [];
  queue.push(pending);
  await chrome.storage.local.set({ ksp_pending_imports: queue });

  // Notify sidepanel if it's open
  chrome.runtime.sendMessage({ type: "PENDING_IMPORT_ADDED" }).catch(() => {
    // Side panel not open, that's ok
  });
}

// ============================================================================
// SNIP-TO-SAVE — region capture from any tab (Pinterest pins without <img> tags etc.)
// ============================================================================
//
// Flow:
//   1. Sidebar sends { type: "SNIP_START", category }
//   2. Background persists category to chrome.storage (survives SW sleep)
//   3. Background gets active tab → injects snipper.js content script
//   4. Snipper script renders fullscreen overlay with crosshair
//   5. User drags region → mouse up → snipper sends { type: "SNIP_REGION", region, dpr, sourceUrl, category }
//   6. Background calls captureVisibleTab → crop with OffscreenCanvas → addPendingImport
//   7. Background notifies sidebar via SNIP_DONE so toast can show

const SNIP_CATEGORY_KEY = "ksp_snip_category";
const SNIP_LOG_KEY = "ksp_snip_log";

async function snipLog(step: string, data?: any) {
  try {
    const r = await chrome.storage.local.get(SNIP_LOG_KEY);
    const log = (r[SNIP_LOG_KEY] as any[]) || [];
    log.push({ t: Date.now(), step, data: data === undefined ? null : data });
    if (log.length > 100) log.shift();
    await chrome.storage.local.set({ [SNIP_LOG_KEY]: log });
  } catch {
    // ignore log errors
  }
  console.log("[KSP Snip]", step, data ?? "");
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "SNIP_START") {
    (async () => {
      try {
        await snipLog("snip_start_request", { category: msg.category });
        await handleSnipStart(msg.category);
        sendResponse({ ok: true });
      } catch (err: any) {
        await snipLog("snip_start_error", { message: err?.message });
        sendResponse({ ok: false, error: err?.message || String(err) });
      }
    })();
    return true;
  }
  if (msg?.type === "SNIP_REGION") {
    (async () => {
      try {
        const info = await handleSnipRegion(msg, sender);
        await snipLog("region_response_ok", info);
        sendResponse({ ok: true, ...info });
      } catch (err: any) {
        await snipLog("region_response_error", { message: err?.message, stack: err?.stack });
        // Send response FIRST, before doing anything else that could throw
        try {
          sendResponse({ ok: false, error: err?.message || String(err) });
        } catch (e) {
          console.error("[KSP] sendResponse failed:", e);
        }
        // ALSO send error via tabs.sendMessage to be doubly sure snipper hears it
        if (sender.tab?.id) {
          chrome.tabs
            .sendMessage(sender.tab.id, {
              type: "SNIP_DONE",
              ok: false,
              error: err?.message || String(err),
            })
            .catch(() => {});
        }
        // Notification last — if it throws, sendResponse already sent
        try {
          showNotification("❌ KSP Image — Lỗi snip", err?.message || String(err), true);
        } catch {
          // ignore
        }
      }
    })();
    return true;
  }
  if (msg?.type === "SNIP_CANCELLED") {
    chrome.storage.local.remove(SNIP_CATEGORY_KEY).catch(() => {});
    return false;
  }
  if (msg?.type === "SNIP_GET_LOG") {
    (async () => {
      const r = await chrome.storage.local.get(SNIP_LOG_KEY);
      sendResponse({ ok: true, log: r[SNIP_LOG_KEY] || [] });
    })();
    return true;
  }
  if (msg?.type === "SNIP_CLEAR_LOG") {
    chrome.storage.local.set({ [SNIP_LOG_KEY]: [] }).catch(() => {});
    return false;
  }
  return false;
});

async function handleSnipStart(category: string) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("Không tìm thấy tab đang active");
  if (tab.url?.startsWith("chrome://") || tab.url?.startsWith("chrome-extension://")) {
    throw new Error("Không snip được trên Chrome internal page. Mở Pinterest hoặc trang web bình thường.");
  }
  await snipLog("snip_start_tab", { tabId: tab.id, url: tab.url?.slice(0, 100) });
  await chrome.storage.local.set({ [SNIP_CATEGORY_KEY]: category });
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["assets/snipper.js"],
  });
  await snipLog("snip_start_injected", { tabId: tab.id });
}

async function handleSnipRegion(
  msg: {
    type: "SNIP_REGION";
    region: { x: number; y: number; w: number; h: number };
    dpr: number;
    sourceUrl: string;
  },
  sender: chrome.runtime.MessageSender
) {
  await snipLog("region_received", { region: msg.region, dpr: msg.dpr, senderTab: sender.tab?.id });

  // Recover category from chrome.storage
  const stored = await chrome.storage.local.get(SNIP_CATEGORY_KEY);
  const category = stored[SNIP_CATEGORY_KEY] as
    | "face"
    | "outfit"
    | "product"
    | "inspiration"
    | "general"
    | undefined;
  await snipLog("category_lookup", { category });
  if (!category) {
    throw new Error("Snip session expired (state lost). Click 📷 lại để thử.");
  }
  await chrome.storage.local.remove(SNIP_CATEGORY_KEY);

  // Use sender's window for captureVisibleTab to ensure we capture the right tab
  const windowId = sender.tab?.windowId;
  await snipLog("capturing", { windowId });

  let fullDataUrl: string;
  try {
    fullDataUrl = await chrome.tabs.captureVisibleTab(windowId as any, { format: "png" });
  } catch (e: any) {
    await snipLog("capture_failed", { error: e?.message });
    throw new Error(`captureVisibleTab failed: ${e?.message || e}`);
  }
  if (!fullDataUrl) {
    await snipLog("capture_empty");
    throw new Error("captureVisibleTab returned empty data URL");
  }
  await snipLog("captured", { dataUrlLength: fullDataUrl.length });

  // Decode + crop
  const blob = await (await fetch(fullDataUrl)).blob();
  await snipLog("blob_decoded", { size: blob.size });

  const bitmap = await createImageBitmap(blob);
  await snipLog("bitmap", { w: bitmap.width, h: bitmap.height });

  const sx = Math.max(0, Math.round(msg.region.x * msg.dpr));
  const sy = Math.max(0, Math.round(msg.region.y * msg.dpr));
  const sw = Math.max(1, Math.round(msg.region.w * msg.dpr));
  const sh = Math.max(1, Math.round(msg.region.h * msg.dpr));
  await snipLog("region_pixels", { sx, sy, sw, sh });

  const canvas = new OffscreenCanvas(sw, sh);
  const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new Error("OffscreenCanvas context không khả dụng");
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
  const croppedBlob = await canvas.convertToBlob({ type: "image/png" });
  await snipLog("cropped", { size: croppedBlob.size });

  const reader = new FileReader();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(croppedBlob);
  });
  await snipLog("dataurl_ready", { length: dataUrl.length });

  await addPendingImport({
    data: dataUrl,
    type: "image/png",
    category,
    sourceUrl: msg.sourceUrl,
    source: "snip",
  });
  await snipLog("pending_added");

  // Notify sidebar (don't fail if sidebar not open)
  chrome.runtime
    .sendMessage({
      type: "SNIP_DONE",
      ok: true,
      category,
      width: Math.round(msg.region.w),
      height: Math.round(msg.region.h),
    })
    .catch(() => {});

  // ALSO notify the originating tab (where snipper is running) — more reliable than sendResponse
  if (sender.tab?.id) {
    chrome.tabs
      .sendMessage(sender.tab.id, {
        type: "SNIP_DONE",
        ok: true,
        category,
        width: Math.round(msg.region.w),
        height: Math.round(msg.region.h),
      })
      .catch(() => {});
  }

  // Notification (best-effort, don't throw if it fails)
  try {
    showNotification(
      "📷 Đã snip vào KSP Image",
      `Category: ${category}. Vùng ${Math.round(msg.region.w)}×${Math.round(msg.region.h)}px.`
    );
  } catch {
    // ignore
  }

  return { category, w: Math.round(msg.region.w), h: Math.round(msg.region.h) };
}

console.log("[KSP Image] Background worker started v0.9.1-r7");
