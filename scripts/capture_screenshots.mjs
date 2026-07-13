// One-off: capture README screenshots from a running Nebula (default: the live app).
//   node scripts/capture_screenshots.mjs
//   NEBULA_URL=http://localhost:5173 node scripts/capture_screenshots.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.NEBULA_URL || "https://nebula-discover.greenforest-ed82ac43.westeurope.azurecontainerapps.io";
const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

const clickText = async (re, to = 4000) => {
  try { await page.getByRole("button", { name: re }).first().click({ timeout: to }); return true; } catch { return false; }
};

console.log("goto", BASE);
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForSelector(".preloader", { state: "detached", timeout: 30000 }).catch(() => {});
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/objective.png` });
console.log("captured objective");

// Mission bench: World -> pick -> Signals -> pick magnetic -> Survival -> discover
try { await page.locator(".mb-world").first().click({ timeout: 5000 }); } catch {}
await page.waitForTimeout(400);
await clickText(/continue to signals/i);
await page.waitForTimeout(700);
const mag = page.locator(".mb-sense-grid button").filter({ hasText: /magnetic/i });
try { if (await mag.count()) await mag.first().click(); else await page.locator(".mb-sense-grid button").first().click(); } catch {}
await page.waitForTimeout(400);
await clickText(/continue to survival/i);
await page.waitForTimeout(700);
await clickText(/discover constructs/i, 7000);
console.log("run started");

await page.waitForSelector(".act-result", { timeout: 100000 });
await page.waitForSelector(".atlas-hero", { timeout: 30000 });
await page.waitForTimeout(3500);
console.log("result ready");

// clean viewport shots at scroll positions (avoids the duplicated sticky header + over-tall images)
for (const [sel, name] of [[".atlas-field-figure", "candidate-map"], ["#atlas-dossier .dossier-constellation", "dossier"]]) {
  try {
    await page.locator(sel).first().scrollIntoViewIfNeeded({ timeout: 8000 });
    await page.evaluate(() => window.scrollBy(0, -80)); // nudge below the sticky header
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/${name}.png` }); // viewport, not element
    console.log("captured", name);
  } catch (e) { console.log("FAILED", name, e.message); }
}

await browser.close();
console.log("done");
