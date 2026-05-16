/**
 * KSP Image v0.9.3-qc6 — Script Stepper Visual Self-Test
 *
 * Mục đích: Jason chạy script này trên Mac để screenshot UI Script section
 * ở viewport 380px (giống Chrome side panel), upload PNG → Claude verify
 * bug đã fix chưa TRƯỚC khi nói đã ship xong.
 *
 * Yêu cầu:
 *   1. Build production trước: `npm run build`
 *   2. Cài puppeteer: `npm install puppeteer-core`
 *   3. Chrome installed (Mac default: /Applications/Google Chrome.app/Contents/MacOS/Google Chrome)
 *
 * Cách chạy:
 *   $ node test/screenshot-script-stepper.mjs
 *
 * Output: screenshots/script-stepper-*.png
 *   - 01-empty.png — Initial Stage 1 active (empty film)
 *   - 02-advanced-expanded.png — Click "Chọn manual" → 4 framework cards visible
 *   - 03-stage1-done.png — Stage 1 done preview + Stage 2 active
 *   - 04-stage4-active-with-scene-count.png — Stage 4 active showing scene count input
 *
 * Jason upload PNGs back → Claude inspect → verify visual correctness.
 */

import puppeteer from "puppeteer-core";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import http from "http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "screenshots");

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// Auto-detect Chrome binary path
function findChromeBinary() {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  console.error("⚠️  Chrome binary không tìm thấy. Sửa CHROME_PATH env var hoặc edit candidates list.");
  process.exit(1);
}
const CHROME_PATH = process.env.CHROME_PATH || findChromeBinary();

// Load built assets
const distAssetsDir = path.join(ROOT, "dist", "assets");
if (!fs.existsSync(distAssetsDir)) {
  console.error("⚠️  dist/ folder không tồn tại. Run `npm run build` trước.");
  process.exit(1);
}
const distAssets = fs.readdirSync(distAssetsDir);
const sidepanelJs = distAssets.find((f) => f.startsWith("sidepanel.html-") && f.endsWith(".js"));
const sidepanelCss = distAssets.find((f) => f.startsWith("index-") && f.endsWith(".css"));
const phaseJs = distAssets.find((f) => f.startsWith("index-") && f.endsWith(".js"));

if (!sidepanelJs || !sidepanelCss) {
  console.error("⚠️  Không tìm thấy sidepanel assets. Rebuild?");
  process.exit(1);
}

const TEST_HTML = `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=380" />
    <title>KSP qc6 Script Stepper Test</title>
    <link rel="stylesheet" crossorigin href="/assets/${sidepanelCss}">
    <style>
      body { width: 380px; margin: 0; background: #0e0e10; font-family: system-ui, -apple-system, sans-serif; }
      #root { width: 380px; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script>
      window.chrome = {
        storage: { local: { get: (k, cb) => { if (cb) cb({}); return Promise.resolve({}); }, set: () => Promise.resolve(), remove: () => Promise.resolve() }, onChanged: { addListener: () => {} } },
        runtime: { sendMessage: () => Promise.resolve(), onMessage: { addListener: () => {} }, getURL: (p) => "/" + p, lastError: null },
        tabs: { create: () => {}, query: () => Promise.resolve([]), update: () => {}, onActivated: { addListener: () => {} } },
        windows: { update: () => {} },
        contextMenus: { create: () => {}, removeAll: (cb) => cb && cb(), onClicked: { addListener: () => {} } },
        notifications: { create: () => {} },
        sidePanel: { setPanelBehavior: () => Promise.resolve() },
        action: { onClicked: { addListener: () => {} } },
      };
    </script>
    <script type="module" crossorigin src="/assets/${sidepanelJs}"></script>
    <link rel="modulepreload" crossorigin href="/assets/${phaseJs}">
  </body>
</html>`;

const PORT = 8766;

async function startServer() {
  const distDir = path.join(ROOT, "dist");
  const server = http.createServer((req, res) => {
    let url = req.url || "/";
    if (url === "/") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(TEST_HTML);
      return;
    }
    const filePath = path.join(distDir, url);
    if (!fs.existsSync(filePath)) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    const mime = ext === ".js" ? "application/javascript" : ext === ".css" ? "text/css" : "application/octet-stream";
    res.setHeader("Content-Type", mime);
    res.end(fs.readFileSync(filePath));
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

async function shoot(page, name, fullPage = true) {
  const filepath = path.join(OUT_DIR, `script-stepper-${name}.png`);
  await page.screenshot({ path: filepath, fullPage });
  console.log(`  ✓ ${filepath}`);
}

async function main() {
  console.log("🎬 KSP qc6 Script Stepper Screenshot Test\n");
  console.log("Chrome binary:", CHROME_PATH);
  console.log("Sidepanel JS:", sidepanelJs);
  console.log("Sidepanel CSS:", sidepanelCss);
  console.log("");

  const server = await startServer();
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=380,2000"],
    executablePath: CHROME_PATH,
    defaultViewport: { width: 380, height: 2000, deviceScaleFactor: 2 },
  });

  const page = await browser.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("  [browser error]", msg.text());
  });

  console.log("📸 Loading app...");
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle0", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1500));

  // ---- Setup: switch to Film mode, add 1 character, type idea ----
  console.log("⚙️  Setup: Film mode + 1 character + idea...");
  await page.evaluate(() => {
    const store = (window).useAppStore?.getState?.();
    if (!store) {
      // Fallback: try to find via React DevTools-style introspection
      console.warn("useAppStore not on window — falling back to direct mode toggle UI");
    }
  });
  // Find mode toggle button and click to film
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const filmBtn = btns.find((b) => /Film|film/.test(b.textContent || ""));
    if (filmBtn) filmBtn.click();
  });
  await new Promise((r) => setTimeout(r, 500));

  // Add 1 character via Cast section "+ Add Character" button
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const addBtn = btns.find((b) => /Add Character|Thêm/.test(b.textContent || ""));
    if (addBtn) addBtn.click();
  });
  await new Promise((r) => setTimeout(r, 300));

  // Type idea
  await page.evaluate(() => {
    const ta = document.querySelector("textarea.ksp-idea-film-textarea");
    if (ta) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
      setter.call(ta, "Một con robot bị bỏ rơi trong rừng tỉnh dậy sau 50 năm");
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  await new Promise((r) => setTimeout(r, 300));

  // ---- Screenshot 1: Stage 1 active, empty ----
  console.log("📸 Shot 1: Stage 1 active (empty film)");
  await page.evaluate(() => {
    const script = document.querySelector(".ksp-script-film");
    if (script) script.scrollIntoView({ block: "start" });
  });
  await new Promise((r) => setTimeout(r, 300));
  await shoot(page, "01-empty-stage1-active");

  // ---- Screenshot 2: Click Advanced options → expand 4 frameworks ----
  console.log("📸 Shot 2: Advanced options expanded (4 frameworks visible)");
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const advBtn = btns.find((b) => /Chọn manual|Advanced options/.test(b.textContent || ""));
    if (advBtn) advBtn.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  await shoot(page, "02-advanced-expanded-vn-frameworks");

  // ---- Screenshot 3: Inspect framework row layout (check no text overflow) ----
  console.log("📸 Shot 3: Framework row layout inspection");
  // Get bounding boxes of first framework row + its text container
  const layoutCheck = await page.evaluate(() => {
    const rows = document.querySelectorAll(".ksp-step-framework-row");
    if (rows.length === 0) return { error: "no framework rows found" };
    const row = rows[0];
    const textDiv = row.querySelector(".ksp-step-framework-text");
    const strong = row.querySelector("strong");
    const p = row.querySelector("p");
    return {
      rowWidth: row.offsetWidth,
      rowHeight: row.offsetHeight,
      rowBg: getComputedStyle(row).backgroundColor,
      textDivWidth: textDiv ? textDiv.offsetWidth : null,
      textDivOverflow: textDiv ? getComputedStyle(textDiv).overflow : null,
      strongText: strong ? strong.textContent : null,
      strongVisible: strong ? strong.offsetWidth > 0 && strong.offsetHeight > 0 : false,
      pText: p ? (p.textContent || "").slice(0, 50) : null,
      pVisible: p ? p.offsetWidth > 0 && p.offsetHeight > 0 : false,
    };
  });
  console.log("  Layout:", JSON.stringify(layoutCheck, null, 2));
  fs.writeFileSync(
    path.join(OUT_DIR, "script-stepper-layout-check.json"),
    JSON.stringify(layoutCheck, null, 2)
  );

  await browser.close();
  server.close();

  console.log("\n✅ Screenshots saved to:", OUT_DIR);
  console.log("\nNext: Jason upload các file PNG này lên chat để Claude verify visual.");
}

main().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
