import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    browser: {
      name: "chromium",
      provider: "playwright",
    },
    coverage: {
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["tests/**/*.{ts,tsx}", "node_modules"],
    },
  },
});
