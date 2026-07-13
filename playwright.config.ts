import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config. Boots the discovery backend OFFLINE (deterministic, no network, QM cache
 * warm) + the Vite app, then drives the real browser. Two projects so the WebGL
 * non-blank assertion is proven both with a real GPU (system Chrome) and without one
 * (software SwiftShader — the CI case). Never pass --disable-gpu (it kills WebGL).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:15173",
    trace: "off",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "python -m uvicorn app.api.main:app --host 127.0.0.1 --port 18001 --log-level warning",
      cwd: "backend",
      env: { NEBULA_OFFLINE: "1", NEBULA_RUN_DB: ":memory:" },
      port: 18001,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 15173 --strictPort",
      env: { NEBULA_API: "http://127.0.0.1:18001" },
      port: 15173,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
  projects: [
    {
      name: "chrome",
      testIgnore: /backend-flow\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], channel: "chrome", launchOptions: { args: ["--ignore-gpu-blocklist"] } },
    },
    {
      name: "chromium-swiftshader",
      testIgnore: /backend-flow\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: ["--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
        },
      },
    },
    {
      name: "backend-api",
      testMatch: /backend-flow\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
