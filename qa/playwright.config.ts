import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }], ["json", { outputFile: process.env.PLAYWRIGHT_JSON_OUTPUT_NAME ?? "test-results/resultados.json" }]],
  use: {
    baseURL: process.env.BIBLIOTECA_URL ?? "http://127.0.0.1:62310",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
