import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { main: "src/main.ts" },
    format: ["esm"],
    bundle: false,
    splitting: false,
    clean: true,
    dts: false
  },
  {
    entry: { preload: "src/preload.ts" },
    format: ["cjs"],
    bundle: false,
    splitting: false,
    clean: false,
    dts: false,
    outExtension() {
      return {
        js: ".cjs"
      };
    }
  }
]);
