/**
 * End-to-end proof (real browser, offline backend) that the shipped app:
 *  - drives the gamified Mission Bench and runs a real discovery,
 *  - returns a REAL UniProt accession (not a template family),
 *  - narrates candidate-specific QM and renders a NON-BLANK 3Dmol WebGL structure,
 *  - surfaces the suggested measurement as an OUTPUT (never asks for it),
 *  - is ONE continuous result view (no workspace toggle) with an inline handoff download,
 *  - carries the honest generative-frontier preview ("the unmade"),
 *  - has a persistent non-blank world canvas, real wheel scroll, muted audio by default,
 *    zero horizontal overflow at every target viewport, keyboard operability, reduced motion.
 */
import { expect, test } from "@playwright/test";
import { PNG } from "pngjs";

const BG = { r: 7, g: 12, b: 24 }; // --d-bg / 3Dmol background 0x070c18 (navy palette)

/** Load the app and wait out the entry preloader overlay (it blocks clicks until gone). */
async function boot(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.waitForSelector(".preloader", { state: "detached", timeout: 15_000 });
}

// Mission Bench (default objective) → take the dive → the single result narrative.
async function runToResult(page: import("@playwright/test").Page) {
  await boot(page);
  await expect(page.locator(".disc-brand")).toContainText("Nebula Discover");
  await expect(page.locator(".mb")).toBeVisible(); // the gamified objective bench, not a text form
  await page.locator(".mb .btn-run").click(); // "take the dive": compiles + runs (offline seeds)
  await expect(page.locator(".act-result")).toBeVisible({ timeout: 40_000 });
  await expect(page.locator(".narr-kicker").first()).toBeVisible({ timeout: 20_000 });
}

function nonBackgroundFraction(buf: Buffer): number {
  const png = PNG.sync.read(buf);
  let nonBg = 0;
  const n = png.width * png.height;
  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    if (Math.abs(r - BG.r) > 12 || Math.abs(g - BG.g) > 12 || Math.abs(b - BG.b) > 12) nonBg++;
  }
  return nonBg / n;
}

test("run returns a real accession, a non-blank structure, candidate-specific QM, and a suggested instrument", async ({ page }) => {
  await runToResult(page);

  // a REAL UniProt accession appears in the search chapter (not a template family)
  await expect(page.locator(".narr-acc").first()).toHaveText(/^[A-Z][A-Z0-9]{5,9}$/);

  // the 3Dmol structure chapter renders a NON-BLANK WebGL canvas
  const canvas = page.locator(".struct-canvas canvas").first();
  await canvas.scrollIntoViewIfNeeded();
  await expect(canvas).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  const shot = await canvas.screenshot();
  const frac = nonBackgroundFraction(shot);
  expect(frac, `structure canvas should be non-blank (got ${(frac * 100).toFixed(2)}% non-bg)`).toBeGreaterThan(0.02);

  const narr = page.locator(".narr");
  await expect(narr).toContainText(/candidate specific/i); // physics computed on real coordinates
  await expect(narr).toContainText(/Suggested instrument/i); // measurement surfaced as OUTPUT
  await expect(narr).toContainText(/Falsification/i); // the decisive kill criterion

  const body = (await page.locator("body").innerText()).toLowerCase();
  expect(body).not.toContain("validated sensor");
  expect(body).not.toContain("discovered a sensor");
});

test("one result view: no workspace toggle, inline handoff download", async ({ page }) => {
  await runToResult(page);
  await expect(page.locator(".view-toggle")).toHaveCount(0);
  await expect(page.locator(".narr-skip")).toHaveCount(0);
  await expect(page.locator(".narr .btn-run")).toContainText(/download the handoff/i);
});

test("the unmade generative frontier is an honest preview", async ({ page }) => {
  await runToResult(page);
  await page.locator(".narr-unmade").scrollIntoViewIfNeeded();
  await expect(page.locator(".unmade-badge").first()).toContainText(/generative preview/i);
  await expect(page.locator(".narr-unmade-note")).toContainText(/not wired in this build/i);
});

test("measurement is never asked as an input", async ({ page }) => {
  await boot(page);
  await expect(page.locator(".mb")).toBeVisible();
  await expect(page.locator(".mb select")).toHaveCount(0); // no instrument picker on the objective
  const objText = (await page.locator(".act-objective").innerText()).toLowerCase();
  expect(objText).not.toContain("how would you measure");
  expect(objText).not.toContain("how will you measure");
});

test("persistent world canvas exists and is sized", async ({ page }) => {
  await boot(page);
  const wc = page.locator(".world-canvas canvas").first();
  await expect(wc).toBeVisible();
  const box = await wc.boundingBox();
  expect(box && box.width > 200 && box.height > 100, "world canvas should be rendered and sized").toBeTruthy();
});

test("completes with prefers-reduced-motion (no motion-only meaning)", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await runToResult(page);
  await expect(page.locator(".narr-acc").first()).toHaveText(/^[A-Z][A-Z0-9]{5,9}$/);
  await ctx.close();
});

test("wheel / trackpad scroll actually moves the page", async ({ page }) => {
  await runToResult(page);
  await page.waitForTimeout(700);
  const scrollable = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  expect(scrollable, "result page should be taller than the viewport").toBeGreaterThan(300);
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.move(700, 400);
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => window.scrollY);
  expect(after, `wheel should move the page (before=${before} after=${after} scrollable=${scrollable})`).toBeGreaterThan(before + 30);
});

test("ambient audio is muted by default", async ({ page }) => {
  await boot(page);
  const toggle = page.locator(".audio-toggle");
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
});

test("the objective bench is keyboard-operable to a run", async ({ page }) => {
  await boot(page);
  const dive = page.locator(".mb .btn-run");
  await dive.focus();
  await expect(dive).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".act-result")).toBeVisible({ timeout: 40_000 });
});

test("zero horizontal overflow at every target viewport", async ({ page }) => {
  for (const vp of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(vp);
    await boot(page);
    await expect(page.locator(".mb")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow at ${vp.width}px`).toBeLessThanOrEqual(1);
  }
});
