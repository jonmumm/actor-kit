import terser from "@rollup/plugin-terser";
import { dts } from "rollup-plugin-dts";
import typescript from "rollup-plugin-typescript2";
import pkg from "./package.json" assert { type: "json" };

const createConfig = (input, output, format = "es", isReact = false) => [
  // JS build
  {
    input,
    output: {
      file: output,
      format,
      sourcemap: true,
      banner: isReact ? '"use client";\n' : '',
    },
    external: [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.peerDependencies || {}),
      "cloudflare:workers",
      "@cloudflare/workers-types"
    ],
    plugins: [
      typescript({
        typescript: require("typescript"),
        tsconfig: "tsconfig.json",
      }),
      terser({
        compress: { directives: false },
      }),
    ],
    onwarn(warning, warn) {
      if (warning.code === "UNRESOLVED_IMPORT" && warning.source === "cloudflare:workers") {
        return;
      }
      if (warning.code !== "MODULE_LEVEL_DIRECTIVE") {
        warn(warning);
      }
    },
  },
  // DTS build
  {
    input,
    output: {
      file: output.replace(".js", ".d.ts"),
      format: "es",
    },
    external: ["cloudflare:workers", "@cloudflare/workers-types"],
    plugins: [dts()],
  },
];

export default [
  ...createConfig("src/browser.ts", "./dist/browser.js"),
  ...createConfig("src/server.ts", "./dist/server.js"),
  ...createConfig("src/react.ts", "./dist/react.js", "es", true),
  ...createConfig("src/worker.ts", "./dist/worker.js"),
  ...createConfig("src/index.ts", "./dist/index.js"),
];