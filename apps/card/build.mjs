import { build, context } from "esbuild";
import { rm } from "node:fs/promises";
import path from "node:path";

// HACS serves a plugin straight from the repository, so the bundle is written to
// the repository root and committed. HACS builds its dashboard resource URL from
// the bare file name and logs a warning when `hacs.json` names a path, so the
// root is both the convention and the quiet option.
const root = import.meta.dirname;
const outfile = path.join(root, "..", "..", "autiplanner-card.js");
const watch = process.argv.includes("--watch");

const options = {
  entryPoints: [path.join(root, "src", "index.ts")],
  outfile,
  bundle: true,
  format: "esm",
  target: ["es2020"],
  platform: "browser",
  sourcemap: false,
  // Deliberately not minified. The icons are inlined, which took this from 23 KB
  // to 64 KB raw, but gzip brings it to 18 KB and minifying saves only another
  // 2.5 KB on the wire. This file is committed and reviewed in diffs, so the
  // readable copy is worth more than the bytes.
  minify: false,
  logLevel: "info",
};

await rm(outfile, { force: true });

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("[card] watching for changes");
} else {
  await build(options);
  console.log("[card] built autiplanner-card.js");
}
