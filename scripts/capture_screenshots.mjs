// Refresh the README's homogeneous 16:9 product tour from a running Nebula.
//
//   NEBULA_URL=http://127.0.0.1:5173 node scripts/capture_screenshots.mjs
//   NEBULA_URL=https://your-deployment.example node scripts/capture_screenshots.mjs
//
// Live provider data and WebGL timing can change. Inspect every frame before committing.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.NEBULA_URL || "http://127.0.0.1:5173";
const OUT = "docs/media/readme";
const WIDTH = 1280;
const HEIGHT = 720;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
  colorScheme: "dark",
  reducedMotion: "reduce",
});

const settle = async (ms = 900) => {
  await page.waitForTimeout(ms);
  await page.evaluate(() => document.fonts.ready);
};

const frame = async (name) => {
  await settle();
  await page.screenshot({ path: `${OUT}/${name}.png`, animations: "disabled" });
  console.log("captured", name);
};

const clickButton = async (name, timeout = 7000) => {
  await page.getByRole("button", { name }).first().click({ timeout });
};

const showSection = async (name, selector) => {
  await clickButton(name);
  await page.locator(selector).waitFor({ state: "visible", timeout: 10000 });
  await settle(1200);
};

const placeAt = async (selector, top = 104) => {
  await page.locator(selector).waitFor({ state: "visible", timeout: 10000 });
  await page.evaluate(({ selector, top }) => {
    const target = document.querySelector(selector);
    if (!target) throw new Error(`capture target not found: ${selector}`);
    const y = target.getBoundingClientRect().top + window.scrollY - top;
    window.scrollTo({ top: y, behavior: "instant" });
  }, { selector, top });
  await settle(500);
};

try {
  console.log("opening", BASE);
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".preloader", { state: "detached", timeout: 30000 }).catch(() => {});
  await settle(1800);
  await frame("00-hero");

  // Wider effective canvas keeps metadata and long control text complete at 1280×720.
  await page.evaluate(() => { document.documentElement.style.zoom = "0.86"; });

  // Mission Bench: field patch → magnetic field + optical/RF readouts → context → discover.
  // Selecting a world currently advances directly to Signals; keep the optional button check
  // so this capture survives either interaction model.
  await page.locator(".mb-world").filter({ hasText: /field patch/i }).first().click({ timeout: 7000 });
  if (await page.getByRole("button", { name: /continue to signals/i }).count()) {
    await clickButton(/continue to signals/i);
  }
  const magnetic = page.locator(".mb-sense-grid button").filter({ hasText: /magnetic/i }).first();
  await magnetic.click({ timeout: 7000 });
  await page.locator(".mb-modality-grid button").filter({ hasText: /^fluorescence/i }).first().click({ timeout: 7000 }).catch(() => {});
  await page.locator(".mb-modality-grid button").filter({ hasText: /^rf magnetic/i }).first().click({ timeout: 7000 }).catch(() => {});
  await clickButton(/continue to survival/i);
  await page.getByRole("button", { name: /body warmth/i }).click({ timeout: 7000 }).catch(() => {});
  await page.getByRole("button", { name: /oxygen present/i }).click({ timeout: 7000 }).catch(() => {});
  await clickButton(/discover constructs/i);

  await page.waitForSelector(".act-result", { timeout: 180000 });
  await page.waitForSelector(".atlas-hero", { timeout: 30000 });
  await settle(2000);

  await showSection(/^outcome$/i, "#atlas-outcome");
  await placeAt("#atlas-outcome", 88);
  await frame("01-outcome");

  await showSection(/^discover$/i, "#atlas-nature");
  await page.waitForSelector(".struct-canvas", { timeout: 30000 });
  await settle(2200);
  await placeAt(".atlas-inspector", 116);
  await frame("02-verified-structure");

  await showSection(/^rationale$/i, "#atlas-dossier");
  // The constellation is a navigator above the active panel. Hide it without reflow while
  // capturing detail frames so no off-screen satellite label intrudes below the fixed header.
  await page.addStyleTag({ content: ".rc, .dossier-cluetip { visibility: hidden !important; }" });
  await page.locator('[role="tab"][data-id="physics"]').evaluate((node) => node.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  await placeAt("#dossier-panel-physics", 112);
  await frame("03-assumption-envelope");

  await page.locator('[role="tab"][data-id="decisive"]').evaluate((node) => node.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  await placeAt("#dossier-panel-decisive", 112);
  await frame("04-falsification-plan");

  await showSection(/^handoff$/i, "#atlas-handoff");
  await placeAt("#atlas-handoff", 88);
  await frame("05-handoff");
} finally {
  await browser.close();
}

console.log(`done · ${WIDTH}×${HEIGHT} · ${OUT}`);
