import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));

// Runs the proof-engine tests (client/src) and the API tests (server) from the repo root.
export default defineConfig({
  root,
  resolve: {
    alias: {
      "@": path.resolve(root, "client", "src"),
      "@shared": path.resolve(root, "shared"),
    },
  },
  test: {
    include: ["client/src/**/*.test.ts", "server/**/*.test.ts"],
    environment: "node",
  },
});
