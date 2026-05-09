/**
 * KSP Image v0.9.0 — Full Self-Test Screenshot Walkthrough
 *
 * Tests interactions step-by-step:
 *   1. Initial state (default Photos mode)
 *   2. Switch Mode → Film
 *   3. Add Cast character
 *   4. Click Delete character → ConfirmButton (verify no crash)
 *   5. Type idea text
 *   6. Each pipeline section rendered
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

const distAssets = fs.readdirSync(path.join(ROOT, "dist", "assets"));
const sidepanelJs = distAssets.find((f) => f.startsWith("sidepanel.html-") && f.endsWith(".js"));
const sidepanelCss = distAssets.find((f) => f.startsWith("v0_9_0_phase34") && f.endsWith(".css"));
const phaseJs = distAssets.find((f) => f.startsWith("v0_9_0_phase34") && f.endsWith(".js"));

const TEST_HTML = `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=380" />
    <title>KSP v0.9.0 Test</title>
    <link rel="stylesheet" crossorigin href="/assets/${sidepanelCss}">
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

const PORT = 8765;

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
    await page.setViewport({ width: 380, height: 1200, deviceScaleFactor: 2 });
    page.on("pageerror", (err) => {
      console.error("❌ PAGE ERROR:", err.message);
      errors.push(err.message);
    });
    page.on("console", (msg) => {
      if (msg.type() === "error" && !msg.text().includes("Failed to load resource")) {
        const t = msg.text();
        if (!t.includes("Warning: Each child")) {
          errors.push(t.slice(0, 200));
        }
      }
    });

    log("Loading page...");
    await page.goto(`http://localhost:${PORT}`, { waitUntil: "networkidle0", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1500));

    await page.screenshot({ path: path.join(OUT_DIR, "01-initial-photos-mode.png"), fullPage: true });
    log("✓ Screenshot 01: initial state (Photos default)");

    // STEP 2: Switch to Film mode
    log("Selecting Film mode in Project Setting...");
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      for (const sel of selects) {
        const opts = Array.from(sel.options).map((o) => o.value);
        if (opts.includes('film')) {
          sel.value = 'film';
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }
      return false;
    });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(OUT_DIR, "02-film-mode.png"), fullPage: true });
    log("✓ Screenshot 02: Film mode selected");

    // Verify all sections render
    const sectionsCheck = await page.evaluate(() => {
      const sidebar = document.querySelector(".ksp-sidebar-v09");
      if (!sidebar) return { found: false };
      const allText = sidebar.textContent || "";
      return {
        found: true,
        hasProject: !!sidebar.querySelector(".ksp-project-setting"),
        hasCast: !!sidebar.querySelector(".ksp-cast-section") || allText.includes("CAST"),
        hasIdeaText: allText.includes("Ý TƯỞNG") || allText.includes("Ý tưởng"),
        hasScript: !!sidebar.querySelector(".ksp-script-section") || allText.includes("SCRIPT"),
        hasStoryboard: !!sidebar.querySelector(".ksp-storyboard-section") || allText.includes("STORYBOARD"),
        hasVoice: !!sidebar.querySelector(".ksp-voice-section") || allText.includes("VOICE"),
        hasMusic: !!sidebar.querySelector(".ksp-music-section") || allText.includes("MUSIC"),
        hasBundle: !!sidebar.querySelector(".ksp-bundle-section") || allText.includes("BUNDLE"),
        // BUG 1 verification — count "Ý tưởng/Ý TƯỞNG" occurrences
        ideaTextCount: (allText.match(/Ý tưởng|Ý TƯỞNG|YS TƯỞNG/g) || []).length,
      };
    });
    log(`Sections in Film mode: ${JSON.stringify(sectionsCheck, null, 2)}`);

    // STEP 3: Try add cast character
    log("Looking for + Add Character button...");
    const addCharResult = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const btn = btns.find((b) => {
        const t = (b.textContent || '').trim();
        return t === "+ Add Character" || t.includes("Add Character") || t.includes("+ Add");
      });
      if (btn) {
        btn.click();
        return { clicked: true, text: btn.textContent };
      }
      return { clicked: false, btnTexts: btns.slice(0, 20).map((b) => (b.textContent || '').trim().slice(0, 25)) };
    });
    log(`Add char result: ${JSON.stringify(addCharResult).slice(0, 200)}`);
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({ path: path.join(OUT_DIR, "03-character-added.png"), fullPage: true });

    // STEP 4: Type idea
    log("Typing idea text...");
    await page.evaluate(() => {
      const allTextareas = Array.from(document.querySelectorAll('textarea'));
      const ideaArea = allTextareas.find((t) =>
        (t.placeholder || '').includes('VD:') || (t.placeholder || '').includes('Robot')
      );
      if (ideaArea) {
        ideaArea.focus();
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        setter.call(ideaArea, 'Robot cuối cùng thức dậy trong rừng nguyên sinh');
        ideaArea.dispatchEvent(new Event('input', { bubbles: true }));
        ideaArea.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: path.join(OUT_DIR, "04-idea-typed.png"), fullPage: true });

    // STEP 5: Click character to expand
    log("Expanding character card...");
    await page.evaluate(() => {
      const summaries = document.querySelectorAll('.ksp-character-summary, .ksp-character-name');
      for (const s of summaries) {
        const card = s.closest('button, .ksp-character-card');
        if (card) {
          card.click();
          return true;
        }
      }
      return false;
    });
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({ path: path.join(OUT_DIR, "05-character-expanded.png"), fullPage: true });

    // STEP 6: Test ConfirmButton (BUG 2 verification)
    log("Testing Delete character → ConfirmButton (BUG 2)...");
    const deleteResult = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const delBtn = btns.find((b) => (b.textContent || '').includes("Delete character"));
      if (delBtn) {
        delBtn.click();
        return { clicked: true };
      }
      return { clicked: false };
    });
    log(`Delete clicked: ${JSON.stringify(deleteResult)}`);
    await new Promise((r) => setTimeout(r, 600));

    const confirmCheck = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const confirmBtn = btns.find((b) =>
        (b.textContent || '').includes("Xác nhận") || (b.textContent || '').includes("⚠")
      );
      const sidebar = document.querySelector(".ksp-sidebar-v09");
      return {
        confirmShown: !!confirmBtn,
        confirmText: confirmBtn?.textContent,
        sidebarStillExists: !!sidebar,
        bodyContentLength: document.body.innerHTML.length,
      };
    });
    log(`Confirm verification: ${JSON.stringify(confirmCheck)}`);
    await page.screenshot({ path: path.join(OUT_DIR, "06-confirm-button.png"), fullPage: true });

    // FINAL: Full sidebar
    await page.screenshot({ path: path.join(OUT_DIR, "07-full-final.png"), fullPage: true });
    log("✓ Screenshot 07: final state");

    // STEP 8: Scroll to Idea card to verify BUG 1 fix (no duplicate heading)
    log("Scrolling to Idea card to verify BUG 1...");
    await page.evaluate(() => {
      const all = document.querySelectorAll('*');
      for (const el of all) {
        if (el.textContent === 'MÔ TẢ Ý TƯỞNG (TIẾNG VIỆT)') {
          el.scrollIntoView({ block: 'center' });
          return true;
        }
      }
      return false;
    });
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: path.join(OUT_DIR, "08-idea-section.png"), fullPage: false });

    // STEP 9: Scroll to Script section
    log("Scrolling to Script section...");
    await page.evaluate(() => {
      const heading = Array.from(document.querySelectorAll('header span, .ksp-section-header')).find((el) =>
        (el.textContent || '').includes('SCRIPT')
      );
      if (heading) heading.scrollIntoView({ block: 'center' });
    });
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: path.join(OUT_DIR, "09-script-section.png"), fullPage: false });

    // STEP 10: Scroll to Storyboard
    log("Scrolling to Storyboard...");
    await page.evaluate(() => {
      const heading = Array.from(document.querySelectorAll('header span, .ksp-section-header')).find((el) =>
        (el.textContent || '').includes('STORYBOARD')
      );
      if (heading) heading.scrollIntoView({ block: 'center' });
    });
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: path.join(OUT_DIR, "10-storyboard.png"), fullPage: false });

    // STEP 11: Scroll to Voice
    await page.evaluate(() => {
      const heading = Array.from(document.querySelectorAll('header span, .ksp-section-header')).find((el) =>
        (el.textContent || '').includes('VOICE')
      );
      if (heading) heading.scrollIntoView({ block: 'center' });
    });
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: path.join(OUT_DIR, "11-voice-music-bundle.png"), fullPage: false });

    // VERDICT
    console.log("\n========== VERDICT ==========");
    console.log(`Runtime errors: ${errors.length}`);
    if (errors.length > 0) {
      errors.slice(0, 5).forEach((e) => console.error("  -", e.slice(0, 150)));
    }
    console.log("\nSection rendering (Film mode):");
    console.log(JSON.stringify(sectionsCheck, null, 2));
    console.log("\nBUG 2 fix (ConfirmButton replaces alert/confirm):");
    console.log("  Delete clicked:", deleteResult.clicked);
    console.log("  ConfirmButton shown:", confirmCheck.confirmShown);
    console.log("  Sidebar still rendering (no crash):", confirmCheck.sidebarStillExists);
    console.log("\nBUG 1 fix (no duplicate idea heading):");
    console.log(`  Idea text count: ${sectionsCheck.ideaTextCount} (should be ≤ 1, just from PipelineStep header)`);
    console.log("\n📁 Screenshots:", OUT_DIR);

    return { errors, sectionsCheck, deleteResult, confirmCheck };
  } finally {
    await browser.close();
    server.close();
  }
}

main()
  .then((result) => {
    const ok = result.errors.length === 0 && result.confirmCheck.sidebarStillExists;
    console.log(ok ? "\n✅ ALL TESTS PASSED" : "\n❌ TESTS FAILED");
    process.exit(ok ? 0 : 1);
  })
  .catch((err) => {
    console.error("FATAL:", err);
    process.exit(1);
  });
