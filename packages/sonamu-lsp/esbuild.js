import esbuild from "esbuild";

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

async function main() {
  const context = await esbuild.context({
    entryPoints: ["src/server.ts"],
    bundle: true,
    outfile: "out/server.mjs",
    format: "esm",
    platform: "node",
    mainFields: ["module", "main"],
    sourcemap: !production,
    minify: production,
    banner: {
      js: [
        'import { createRequire } from "module";',
        'import { fileURLToPath as __fileURLToPath } from "url";',
        'import { dirname as __dirname_ } from "path";',
        'const require = createRequire(import.meta.url);',
        'const __filename = __fileURLToPath(import.meta.url);',
        'const __dirname = __dirname_(__filename);',
      ].join(" "),
    },
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
