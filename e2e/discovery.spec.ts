/**
 * End-to-end proof (real browser, offline backend) that the shipped app:
 *  - drives the gamified Mission Bench and runs a real discovery,
 *  - returns a REAL UniProt accession (not a template family),
 *  - surfaces physics provenance and renders a NON-BLANK 3Dmol WebGL structure,
 *  - surfaces the suggested measurement as an OUTPUT (never asks for it),
 *  - is ONE continuous result view (no workspace toggle) with an inline handoff download,
 *  - carries the honest RFdiffusion generation lane,
 *  - has a persistent non-blank world canvas, real wheel scroll, muted audio by default,
 *    zero horizontal overflow at every target viewport, keyboard operability, reduced motion.
 */
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PNG } from "pngjs";

const BG = { r: 7, g: 12, b: 24 }; // --d-bg / 3Dmol background 0x070c18 (navy palette)

/** Load the app and wait out the entry preloader overlay (it blocks clicks until gone). */
async function boot(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.waitForSelector(".preloader", { state: "detached", timeout: 15_000 });
}

// Mission Bench → search constructs → the single discovery atlas.
async function runToResult(page: import("@playwright/test").Page, world = "Field patch") {
  await boot(page);
  await expect(page.locator(".disc-nebula")).toHaveText("nebula");
  await expect(page.locator(".mb")).toBeVisible(); // the gamified objective bench, not a text form
  await page.getByRole("button", { name: new RegExp(`^${world}`, "i") }).click();
  await page.locator(".mb .btn-run").click();
  await expect(page.locator(".act-result")).toBeVisible({ timeout: 40_000 });
  await expect(page.locator(".atlas-hero")).toBeVisible({ timeout: 20_000 });
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

test("run returns a real accession, a non-blank structure, physics provenance, and a measurement scenario", async ({ page }) => {
  await runToResult(page);

  // a REAL UniProt accession appears in the discovery atlas (not a template family)
  await expect(page.locator(".atlas-candidate strong").first()).toHaveText(/^[A-Z][A-Z0-9]{5,9}$/);

  // the 3Dmol structure chapter renders a NON-BLANK WebGL canvas
  const canvas = page.locator(".struct-canvas canvas").first();
  await canvas.scrollIntoViewIfNeeded();
  await expect(canvas).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  const shot = await canvas.screenshot();
  const frac = nonBackgroundFraction(shot);
  expect(frac, `structure canvas should be non-blank (got ${(frac * 100).toFixed(2)}% non-bg)`).toBeGreaterThan(0.02);

  const atlas = page.locator(".atlas");
  await expect(atlas).toContainText(/candidate-specific QM|route-level evidence/i);
  await expect(atlas).toContainText(/next discriminating measurement/i);
  await expect(atlas).toContainText(/reject when/i);

  const body = (await page.locator("body").innerText()).toLowerCase();
  expect(body).not.toContain("validated sensor");
  expect(body).not.toContain("discovered a sensor");
});

test("one result view: no workspace toggle, inline handoff download", async ({ page }) => {
  await runToResult(page);
  await expect(page.locator(".view-toggle")).toHaveCount(0);
  await expect(page.locator(".narr-skip")).toHaveCount(0);
  await expect(page.locator(".atlas-download")).toContainText(/download brief/i);
});

test("the RFdiffusion generation lane is an honest preview", async ({ page }) => {
  await runToResult(page);
  const generation = page.locator(".atlas-generate");
  await generation.scrollIntoViewIfNeeded();
  await expect(generation).toContainText(/RFdiffusion proposes new backbone geometry/i);
  await expect(generation.locator(".atlas-design")).toHaveCount(3);
  await expect(generation).toContainText(/Backbone not generated in this run/i);
  await expect(generation).toContainText(/without coordinates/i);
});

test("measurement is never asked as an input", async ({ page }) => {
  await boot(page);
  await expect(page.locator(".mb")).toBeVisible();
  await expect(page.locator(".mb select")).toHaveCount(0); // no instrument picker on the objective
  const objText = (await page.locator(".act-objective").innerText()).toLowerCase();
  expect(objText).not.toContain("how would you measure");
  expect(objText).not.toContain("how will you measure");
});

test("objective and completed result have no serious WCAG violations", async ({ page }) => {
  await boot(page);
  const objectiveAudit = await new AxeBuilder({ page }).analyze();
  expect(
    objectiveAudit.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical"),
  ).toEqual([]);

  await page.getByRole("button", { name: /^Field patch/i }).click();
  await page.locator(".mb .btn-run").click();
  await expect(page.locator(".atlas-hero")).toBeVisible({ timeout: 40_000 });
  const resultAudit = await new AxeBuilder({ page }).analyze();
  expect(
    resultAudit.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical"),
  ).toEqual([]);
});

test("persistent world canvas exists and is sized", async ({ page }) => {
  await boot(page);
  const wc = page.locator(".world-canvas canvas").first();
  await expect(wc).toBeVisible();
  const box = await wc.boundingBox();
  expect(box && box.width > 200 && box.height > 100, "world canvas should be rendered and sized").toBeTruthy();
});

test("WebGL failure keeps the objective usable through a non-canvas fallback", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") return null;
      return original.call(this, type as never, ...(args as []));
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await boot(page);
  await expect(page.locator(".world-fallback")).toBeVisible();
  await expect(page.getByRole("button", { name: /continue to signals/i })).toBeEnabled();
  await page.getByRole("button", { name: /continue to signals/i }).click();
  await expect(page.locator(".mb .btn-run")).toBeEnabled();
  await ctx.close();
});

test("completes with prefers-reduced-motion (no motion-only meaning)", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await runToResult(page);
  await expect(page.locator(".atlas-candidate strong").first()).toHaveText(/^[A-Z][A-Z0-9]{5,9}$/);
  await ctx.close();
});

test("rationale facets are one keyboard tab stop with arrow-key navigation", async ({ page }) => {
  await runToResult(page);
  await page.getByRole("button", { name: /open rationale/i }).click();
  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveCount(5);
  await expect(page.locator('[role="tab"][tabindex="0"]')).toHaveCount(1);
  const active = page.getByRole("tab", { selected: true });
  const previousId = await active.getAttribute("id");
  await active.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { selected: true })).not.toHaveAttribute("id", previousId ?? "");
  await expect(page.locator('[role="tabpanel"]:visible')).toHaveCount(1);
});

test("mobile result navigation is touch-sized, current, and does not cover the hero", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await runToResult(page);
  const current = page.locator('.atlas-nav button[aria-current="location"]');
  await expect(current).toHaveCount(1);
  const navBox = await page.locator(".atlas-nav").boundingBox();
  const buttonBox = await page.locator(".atlas-nav button").first().boundingBox();
  const heroBox = await page.locator(".atlas-hero-copy > :first-child").boundingBox();
  expect(buttonBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(navBox && heroBox && navBox.y + navBox.height <= heroBox.y, "section navigation must sit above, not over, the hero copy").toBeTruthy();
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

test("ambient audio keeps running when another tab comes forward", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(() => {
    const originalSuspend = AudioContext.prototype.suspend;
    const originalResume = AudioContext.prototype.resume;
    const state = window as typeof window & {
      __nebulaAudioContext?: AudioContext;
      __nebulaSuspendCalls?: number;
    };
    state.__nebulaSuspendCalls = 0;
    AudioContext.prototype.suspend = function (...args) {
      state.__nebulaSuspendCalls = (state.__nebulaSuspendCalls ?? 0) + 1;
      return originalSuspend.apply(this, args);
    };
    AudioContext.prototype.resume = function (...args) {
      state.__nebulaAudioContext = this;
      return originalResume.apply(this, args);
    };
  });

  await boot(page);
  await page.locator(".audio-toggle").click();
  await expect(page.locator(".audio-toggle")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate(() => {
    const state = window as typeof window & { __nebulaAudioContext?: AudioContext };
    return state.__nebulaAudioContext?.state;
  })).toBe("running");

  const otherTab = await context.newPage();
  await otherTab.goto("about:blank");
  await otherTab.bringToFront();
  await page.waitForTimeout(500);
  await expect.poll(() => page.evaluate(() => {
    const state = window as typeof window & {
      __nebulaAudioContext?: AudioContext;
      __nebulaSuspendCalls?: number;
    };
    return {
      state: state.__nebulaAudioContext?.state,
      suspendCalls: state.__nebulaSuspendCalls ?? 0,
    };
  })).toEqual({ state: "running", suspendCalls: 0 });
  await context.close();
});

test("the signals and survival stages are keyboard-operable to a run", async ({ page }) => {
  await boot(page);
  await page.getByRole("button", { name: /continue to signals/i }).focus();
  await page.keyboard.press("Enter");
  const dive = page.locator(".mb .btn-run");
  await expect(dive).toBeVisible();
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
