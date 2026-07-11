/**
 * End-to-end proof (real browser, offline backend) that the shipped app:
 *  - compiles an objective and runs a real discovery,
 *  - returns a REAL UniProt accession (not a template family),
 *  - shows candidate-specific QM and renders a NON-BLANK 3Dmol WebGL structure,
 *  - has zero horizontal overflow at every target viewport,
 *  - completes with prefers-reduced-motion and is keyboard-operable.
 */
import { expect, test } from "@playwright/test";
import { PNG } from "pngjs";

const BG = { r: 7, g: 12, b: 24 }; // --d-bg / 3Dmol background 0x070c18 (navy+gold palette)

/** Load the app and wait out the entry preloader overlay (it blocks clicks until gone). */
async function boot(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.waitForSelector(".preloader", { state: "detached", timeout: 15_000 });
}

// Act I → compile → run → Act III (the scroll narrative is the default result).
async function runToResult(page: import("@playwright/test").Page) {
  await boot(page);
  await expect(page.locator(".disc-brand")).toContainText("Nebula Discover");
  await page.locator("button.btn-primary").click(); // compile (Act I)
  await expect(page.locator(".obj-sheet")).toBeVisible();
  await page.locator("button.btn-run").click(); // run (Act II, self-advancing)
  // on completion the shell enters Act III (phase=workspace) — the header view-toggle appears
  await expect(page.locator(".view-toggle")).toBeVisible({ timeout: 40_000 });
}

// …then switch to the calm workspace (expert surface).
async function runToWorkspace(page: import("@playwright/test").Page) {
  await runToResult(page);
  await page.locator(".view-toggle").click();
  await expect(page.locator(".ws")).toBeVisible({ timeout: 30_000 });
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

test("offline discovery run returns a real accession with candidate-specific QM and a rendered structure", async ({ page }) => {
  await runToWorkspace(page);

  // the candidate universe (R3F) mounts and produces a sized WebGL canvas
  const universe = page.locator(".universe canvas").first();
  await expect(universe).toBeVisible({ timeout: 20_000 });
  const ubox = await universe.boundingBox();
  expect(ubox && ubox.width > 200 && ubox.height > 100, "universe canvas should be rendered and sized").toBeTruthy();

  // a REAL UniProt accession appears on the evidence lane (not "Protein B" / a family)
  const acc = page.locator(".cand-acc").first();
  await expect(acc).toHaveText(/^[A-Z][A-Z0-9]{5,9}$/); // UniProt accession shape

  // select the candidate-specific-QM candidate (carries the QM badge)
  const qmCandidate = page.locator(".cand", { has: page.locator(".badge.cs") }).first();
  await expect(qmCandidate).toBeVisible();
  await qmCandidate.click();

  // detail header shows a clickable real UniProt link
  await expect(page.locator(".acc-link")).toContainText(/UniProt Q8LPD9/);
  // physics panel states it is candidate-specific
  await expect(page.locator(".phys-badge.cs")).toContainText(/candidate-specific QM/i);

  // the 3Dmol WebGL canvas renders NON-BLANK
  const canvas = page.locator(".struct-canvas canvas").first();
  await expect(canvas).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1500); // let the first WebGL frame paint
  const shot = await canvas.screenshot();
  const frac = nonBackgroundFraction(shot);
  expect(frac, `structure canvas should be non-blank (got ${(frac * 100).toFixed(2)}% non-bg)`).toBeGreaterThan(0.02);

  // no unvalidated-sensor overclaim in the workspace copy
  const body = (await page.locator("body").innerText()).toLowerCase();
  expect(body).not.toContain("validated sensor");
  expect(body).not.toContain("discovered a sensor");
});

test("completes with prefers-reduced-motion (no motion-only meaning)", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await runToWorkspace(page);
  await expect(page.locator(".cand-acc").first()).toBeVisible(); // full content reached without animation
  await ctx.close();
});

test("ambient audio is muted by default", async ({ page }) => {
  await boot(page);
  const toggle = page.locator(".audio-toggle");
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "false"); // no autoplay; opt-in only
});

test("objective is keyboard-operable", async ({ page }) => {
  await boot(page);
  const compile = page.locator("button.btn-primary");
  await compile.focus();
  await expect(compile).toBeFocused(); // visible focus target
  await page.keyboard.press("Enter"); // activate via keyboard
  await expect(page.locator(".obj-sheet")).toBeVisible();
});

test("the scroll narrative is the default result and opens the workspace", async ({ page }) => {
  await runToResult(page); // Act III is the default landing after a run
  // the lazy narrative chunk mounts; chapter 1 carries the real objective
  await expect(page.locator(".narr-kicker").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".narr-chapter").first()).toContainText(/report/i);
  // a real accession chapter + the measure-next falsifier render
  await expect(page.locator(".narr-acc").first()).toHaveText(/^[A-Z][A-Z0-9]{5,9}$/);
  const measure = page.locator(".narr-chapter").last();
  await measure.scrollIntoViewIfNeeded();
  await expect(measure).toContainText(/Falsification/i);
  // the final CTA opens the calm workspace
  await page.locator(".narr-chapter .btn-run").click();
  await expect(page.locator(".ws")).toBeVisible();
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
    await expect(page.locator(".obj-panel")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow at ${vp.width}px`).toBeLessThanOrEqual(1);
  }
});
