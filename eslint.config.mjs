import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Every game's published release and shared engine (minified build output), including
    // Mini Golf's Emscripten engine, and the copies the build scripts write to public/.
    "src/games/*/bundle/**",
    "public/games/**",
  ]),
]);

export default eslintConfig;
