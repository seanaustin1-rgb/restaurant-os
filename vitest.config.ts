import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit tests for the financial core. Node environment; the `@` alias mirrors
// tsconfig so tests import modules exactly as the app does. A dummy DATABASE_URL
// is provided because some module files instantiate PrismaClient at import time
// (construction is lazy — it never connects during these pure-function tests).
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      DIRECT_URL: "postgresql://user:pass@localhost:5432/db",
    },
  },
});
