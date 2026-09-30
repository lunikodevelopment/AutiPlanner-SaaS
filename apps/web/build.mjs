import { build, context } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const root = import.meta.dirname;
const dist = path.join(root, "dist");
const watch = process.argv.includes("--watch");

const options = {
  entryPoints: [path.join(root, "src", "main.ts")],
  outfile: path.join(dist, "app.js"),
  bundle: true,
  format: "esm",
  target: ["es2020"],
  platform: "browser",
  sourcemap: true,
  logLevel: "info",
};

async function copyPublic() {
  await mkdir(dist, { recursive: true });
  await cp(path.join(root, "public"), dist, { recursive: true });
}

await rm(dist, { recursive: true, force: true });
await copyPublic();

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("[web] watching for changes");
} else {
  await build(options);
  console.log("[web] built dist/");
}
