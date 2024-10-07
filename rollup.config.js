import terser from "@rollup/plugin-terser";
import { dts } from "rollup-plugin-dts";
import { preserveDirectives } from "rollup-plugin-preserve-directives";
import typescript from "rollup-plugin-typescript2";
import pkg from "./package.json" assert { type: "json" };

const createConfig = (input, output, format = "es") => [
  // JS build
  {
    input,
    output: {
      file: output,
      format,
      sourcemap: true,
    },
    external: [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.peerDependencies || {}),
      "cloudflare:workers",
    ],
    plugins: [
      typescript({
        typescript: require("typescript"),
      }),
      preserveDirectives(),
      terser({
        compress: { directives: false },
      }),
    ],
    onwarn(warning, warn) {
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
    plugins: [dts()],
  },
];

export default [
  ...createConfig("src/browser.ts", "./dist/browser.js"),
  ...createConfig("src/server.ts", "./dist/server.js"),
  ...createConfig("src/react.ts", "./dist/react.js"),
  ...createConfig("src/worker.ts", "./dist/worker.js"),
  ...createConfig("src/index.ts", "./dist/index.js"),
];
