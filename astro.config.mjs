import { defineConfig } from "astro/config";

// Static build. src/pages/verse.astro -> dist/verse.html, which the Worker
// serves at /verse (and /verse.htm) with the day's verse filled in.
export default defineConfig({
  site: "https://031600.xyz",
  output: "static",
  build: { format: "file" },
});
