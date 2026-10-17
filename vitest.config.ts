import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    // Réutilise l'environnement jsdom par worker (isolation par fichier
    // conservée) : la création de l'environnement dominait le temps total.
    pool: "vmThreads",
  },
});
