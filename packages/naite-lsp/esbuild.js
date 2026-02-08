import esbuild from "esbuild";

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

async function main() {
  const context = await esbuild.context({
    entryPoints: ["src/server.ts"],
    bundle: true,
    outfile: "out/server.js",
    format: "esm",
    platform: "node",
    target: "node20",
    sourcemap: !production,
    minify: production,
    external: [],
  });

  if (watch) {
    await context.watch();
    console.log("[esbuild] Watching for changes...");
  } else {
    await context.rebuild();
    await context.dispose();
  }
}

main().catch(() => process.exit(1));
