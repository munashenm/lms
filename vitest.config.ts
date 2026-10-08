import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Prisma client modules require DATABASE_URL at import time even for pure unit tests.
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ||
        "postgresql://postgres:password@127.0.0.1:5432/schoolhub_sa?schema=public",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
