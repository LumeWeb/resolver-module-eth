import { defineConfig } from "vite";
import optimizer from "vite-plugin-optimizer";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import dynamicImport from "vite-plugin-dynamic-import";
import commonjs from "vite-plugin-commonjs";

export default defineConfig({
  build: {
    outDir: "lib",
    lib: {
      entry: "build/index.js",
      name: "main",
      formats: ["cjs"],
      fileName: "index",
    },
    minify: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
  define: {
    "globalThis.process.env.NODE_ENV": null,
    "window.": "globalThis.",
  },
  resolve: {
    dedupe: ["@lumeweb/libportal", "@lumeweb/libweb", "@lumeweb/libkernel"],
  },
  plugins: [
    dynamicImport({
      filter(id) {
        if (id.includes("@ensdomains/ensjs/dist/esm")) {
          return true;
        }
      },
    }),
    optimizer({
      "node-fetch":
        "const e = undefined; export default e;export {e as Response, e as FormData, e as Blob};",
    }),
    nodePolyfills({
      exclude: ["fs"],
      globals: { Buffer: true, global: true, process: true },
    }),
    commonjs({
      filter(id) {
        if (id.includes("@ensdomains/address-encoder")) {
          return true;
        }
      },
    }),
  ],
});
