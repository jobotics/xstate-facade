import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      reporter: ["text", "json", "html"], // Report types
      reportsDirectory: "./coverage", // Directory where coverage reports will be saved
      include: ["src/**/*.{ts,tsx}"], // Files to include in coverage report
      exclude: ["tests/**/*.{ts,tsx}", "node_modules"], // Exclude test files and node_modules
      // all: true, // Measure coverage for all files, even if they are not directly tested
      // lines: 90, // Optional: enforce coverage thresholds
      // functions: 90,
      // branches: 90,
      // statements: 90,
    },
  },
});
