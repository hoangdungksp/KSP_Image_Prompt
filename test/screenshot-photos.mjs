/**
 * KSP Image v0.9.1 — Photos mode screenshot walkthrough.
 *
 * Tests Photos mode UI fixes for Camera Style overflow + outfit slot size.
 * 4 states captured at sidebar viewport 380px:
 *   01 — Initial Photos mode (empty cast, no theme, no shots)
 *   02 — Cast added (Female "Model A", 1 face ref)
 *   03 — Theme picked (Áo dài) — Idea section shows summary
 *   04 — Auto-pick 6 shots — full Photos pipeline rendered
 */

import puppeteer from "puppeteer-core";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import http from "http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "screenshots-v091");

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const distAssets = fs.readdirSync(path.join(ROOT, "dist", "assets"));
const allCss = distAssets.filter((f) => f.endsWith(".css"));
const sidepanelJs = distAssets.find((f) => f.startsWith("sidepanel.html-") && f.endsWith(".js"));
const phaseJs = distAssets.find((f) => f.startsWith("v0_9_0_phase34") && f.endsWith(".js"));

const cssLinks = allCss.map((f) => `<link rel="stylesheet" crossorigin href="/assets/${f}">`).join("\n    ");

const TEST_HTML = `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=380" />
    <title>KSP v0.9.1 Photos Test</title>
    ${cssLinks}
    <style>body { width: 380px; margin: 0; background: #0e0e10; }</style>
  </head>
  <body class="bg-ksp-bg text-ksp-text">
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
// Tiny 1x1 transparent PNG as base64
const TINY_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

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

async function main() {
  const server = await startServer();
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    executablePath: "/home/claude/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome",
  });

  const errors = [];
  let stepCount = 0;
  const log = (msg) => console.log(`[${++stepCount}] ${msg}`);

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 380, height: 1400, deviceScaleFactor: 2 });
    page.on("pageerror", (err) => {
      console.error("❌ PAGE ERROR:", err.message);
      errors.push(err.message);
    });
    page.on("console", (msg) => {
      if (msg.type() === "error" && !msg.text().includes("Failed to load resource")) {
        const t = msg.text();
        if (!t.includes("Warning: Each child")) errors.push(t.slice(0, 200));
      }
    });

    log("Loading page...");
    await page.goto(`http://localhost:${PORT}`, { waitUntil: "networkidle0", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1500));

    // STEP 0: Default mode is "lifestyle" (legacy default in createEmptyProject).
    // Switch to Photos via the Mode dropdown.
    log("Switching mode → Photos...");
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll("select"));
      for (const sel of selects) {
        const opts = Array.from(sel.options).map((o) => o.value);
        if (opts.includes("photos")) {
          sel.value = "photos";
          sel.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        }
      }
      return false;
    });
    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(OUT_DIR, "01-initial-photos.png"), fullPage: true });
    log("✓ Screenshot 01: Photos mode initial (empty cast)");

    // STEP 1: Add cast member directly via store action
    log("Adding cast member via store...");
    await page.evaluate((tinyPng) => {
      // Access Zustand stores via React DevTools? No — we eval store actions directly.
      // The app exposes useAppStore globally? It doesn't. So we trigger via UI.
      // Click the "+ Thêm" button in CAST section.
      const btns = Array.from(document.querySelectorAll("button"));
      const addBtn = btns.find((b) => (b.textContent || "").trim().includes("+ Thêm") || (b.textContent || "").trim() === "+ Thêm");
      if (addBtn) addBtn.click();
    }, TINY_PNG_DATA_URL);
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({ path: path.join(OUT_DIR, "02-cast-added.png"), fullPage: true });
    log("✓ Screenshot 02: cast added (Female default)");

    // STEP 2: Mock face ref upload by simulating file input change
    log("Simulating face ref upload...");
    const fileInputCount = await page.evaluate(async (tinyPng) => {
      // Decode base64 to Uint8Array → File
      const base64 = tinyPng.split(",")[1];
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const file = new File([bytes], "model-a-front.png", { type: "image/png" });

      const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
      if (inputs.length === 0) return 0;

      // Use DataTransfer to set file on input + dispatch change event
      const dt = new DataTransfer();
      dt.items.add(file);
      inputs[0].files = dt.files;
      inputs[0].dispatchEvent(new Event("change", { bubbles: true }));
      return inputs.length;
    }, TINY_PNG_DATA_URL);
    log(`File inputs found: ${fileInputCount}`);
    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(OUT_DIR, "03-face-uploaded.png"), fullPage: true });
    log("✓ Screenshot 03: face ref uploaded (1/6 slot filled)");

    // STEP 3: Click first theme in list to verify camera style + idea summary render
    log("Picking first theme in list...");
    await page.evaluate(() => {
      const themeItems = Array.from(document.querySelectorAll(".ksp-theme-item"));
      if (themeItems.length > 0) themeItems[0].click();
    });
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({ path: path.join(OUT_DIR, "04-theme-picked.png"), fullPage: true });
    log("✓ Screenshot 04: theme selected (Idea summary visible)");

    // STEP 3.5: Type Vietnamese into custom intent textarea after theme picked
    log("Typing custom intent in Vietnamese...");
    await page.evaluate(() => {
      const ta = document.querySelector(".ksp-custom-intent-textarea");
      if (ta) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        setter.call(ta, "cô gái cầm bó hoa hồng đỏ thay vì hoa cúc, cười rạng rỡ");
        ta.dispatchEvent(new Event("input", { bubbles: true }));
      }
      // Scroll to show custom intent block
      const intent = document.querySelector(".ksp-custom-intent");
      if (intent) intent.scrollIntoView({ block: "center" });
    });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: path.join(OUT_DIR, "08-custom-intent-typed.png"), fullPage: false });
    log("✓ Screenshot 08: custom intent typed");

    // STEP 4: Auto-pick shots
    log("Clicking Auto-pick angles...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const autoBtn = btns.find((b) => (b.textContent || "").includes("Auto-pick"));
      if (autoBtn) autoBtn.click();
    });
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({ path: path.join(OUT_DIR, "05-shots-picked.png"), fullPage: true });
    log("✓ Screenshot 05: 6 shots auto-picked");

    // STEP 5: Capture brand specificity field + Library buttons in cast section
    log("Scrolling back to Cast section to capture brand + library buttons...");
    await page.evaluate(() => {
      const cast = document.querySelector(".ksp-cast-photos");
      if (cast) cast.scrollIntoView({ block: "start" });
    });
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: path.join(OUT_DIR, "06-cast-with-brand-and-library-btns.png"), fullPage: true });
    log("✓ Screenshot 06: brand specificity + library buttons");

    // STEP 6: Open Library Picker overlay (click 📁 icon for outfit slot)
    log("Opening Library Picker for outfit...");
    await page.evaluate(() => {
      // Icon buttons have class .ksp-btn-ref-icon. There are 4 (2 for face, 2 for outfit).
      // Order in DOM: [face📁, face📷, outfit📁, outfit📷]. Click outfit📁 (index 2).
      const iconBtns = Array.from(document.querySelectorAll(".ksp-btn-ref-icon"));
      const folderBtns = iconBtns.filter((b) => (b.textContent || "").trim() === "📁");
      // Outfit folder is the 2nd 📁 button
      if (folderBtns.length >= 2) folderBtns[1].click();
      else if (folderBtns.length === 1) folderBtns[0].click();
    });
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({ path: path.join(OUT_DIR, "07-library-picker-overlay.png"), fullPage: false });
    log("✓ Screenshot 07: Library Picker overlay");

    const pickerCheck = await page.evaluate(() => {
      const picker = document.querySelector(".ksp-library-picker");
      const backdrop = document.querySelector(".ksp-library-picker-backdrop");
      return {
        pickerVisible: !!picker,
        backdropVisible: !!backdrop,
        title: document.querySelector(".ksp-library-picker-title")?.textContent || "",
      };
    });

    // STEP 5: Check Camera Style card layout — measure widths to verify no overflow
    const cardCheck = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll(".ksp-radio-card"));
      const sidebar = document.querySelector(".ksp-sidebar-v09");
      if (!cards.length || !sidebar) return { found: false };
      const sidebarRect = sidebar.getBoundingClientRect();
      const results = cards.map((c) => {
        const r = c.getBoundingClientRect();
        return {
          width: Math.round(r.width),
          height: Math.round(r.height),
          fits: r.right <= sidebarRect.right + 1,
        };
      });
      return { found: true, sidebarWidth: Math.round(sidebarRect.width), cards: results };
    });

    // STEP 6: Check outfit slot size — should match face slot dimensions
    const outfitCheck = await page.evaluate(() => {
      const faceSlot = document.querySelector(".ksp-face-slot");
      const outfitSlot = document.querySelector(".ksp-outfit-slot, .ksp-outfit-preview");
      if (!faceSlot) return { faceFound: false };
      if (!outfitSlot) return { faceFound: true, outfitFound: false };
      const fr = faceSlot.getBoundingClientRect();
      const or = outfitSlot.getBoundingClientRect();
      return {
        faceFound: true,
        outfitFound: true,
        faceSize: { w: Math.round(fr.width), h: Math.round(fr.height) },
        outfitSize: { w: Math.round(or.width), h: Math.round(or.height) },
        sizesClose: Math.abs(fr.width - or.width) <= 2,
      };
    });

    // VERDICT
    console.log("\n========== VERDICT ==========");
    console.log(`Runtime errors: ${errors.length}`);
    if (errors.length > 0) errors.slice(0, 5).forEach((e) => console.error("  -", e.slice(0, 150)));
    console.log("\nCamera Style cards layout:");
    console.log(JSON.stringify(cardCheck, null, 2));
    console.log("\nOutfit slot vs face slot:");
    console.log(JSON.stringify(outfitCheck, null, 2));
    console.log("\nLibrary Picker overlay:");
    console.log(JSON.stringify(pickerCheck, null, 2));
    console.log("\n📁 Screenshots:", OUT_DIR);

    return { errors, cardCheck, outfitCheck, pickerCheck };
  } finally {
    await browser.close();
    server.close();
  }
}

main()
  .then((result) => {
    const noErrors = result.errors.length === 0;
    const cardsFit = result.cardCheck.found && result.cardCheck.cards.every((c) => c.fits);
    const outfitMatchesFace = result.outfitCheck.faceFound && result.outfitCheck.outfitFound && result.outfitCheck.sizesClose;
    const pickerOpens = result.pickerCheck.pickerVisible;
    const ok = noErrors && cardsFit && outfitMatchesFace && pickerOpens;
    console.log(ok ? "\n✅ ALL CHECKS PASSED" : "\n⚠ CHECKS:");
    console.log(`  errors: ${noErrors ? "✓" : "✗"}`);
    console.log(`  Camera Style fits container: ${cardsFit ? "✓" : "✗"}`);
    console.log(`  Outfit ≈ Face slot size: ${outfitMatchesFace ? "✓" : "✗"}`);
    console.log(`  Library Picker overlay opens: ${pickerOpens ? "✓" : "✗"}`);
    process.exit(ok ? 0 : 1);
  })
  .catch((err) => {
    console.error("FATAL:", err);
    process.exit(1);
  });
// (extra step — capture custom intent area)
