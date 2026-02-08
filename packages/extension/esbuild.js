const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

// naite-trace-viewer 빌드 결과물을 로드하는 플러그인
const traceViewerLoader = {
  name: "trace-viewer-loader",
  setup(build) {
    // @vscode-sonamu/naite-trace-viewer import 처리
    build.onResolve({ filter: /^@vscode-sonamu\/naite-trace-viewer$/ }, () => {
      return {
        path: "naite-trace-viewer",
        namespace: "trace-viewer",
      };
    });

    build.onLoad({ filter: /.*/, namespace: "trace-viewer" }, async () => {
      // naite-trace-viewer 빌드 결과물 경로
      const traceViewerDist = path.resolve(
        __dirname,
        "../naite-trace-viewer/dist",
      );

      // 빌드 결과물이 없으면 placeholder 반환
      if (!fs.existsSync(traceViewerDist)) {
        console.warn(
          "[esbuild] naite-trace-viewer dist not found, using placeholder",
        );
        const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body>
  <div style="padding: 20px; color: #ccc;">
    <h2>Naite Trace Viewer</h2>
    <p>Run <code>pnpm build:ui</code> first to build the UI.</p>
  </div>
</body>
</html>`;
        return {
          contents: `export default ${JSON.stringify(html)};`,
          loader: "js",
        };
      }

      // JS, CSS 파일 인라인화
      const jsPath = path.join(traceViewerDist, "assets/main.js");
      const cssPath = path.join(traceViewerDist, "assets/index.css");

      let jsContent = "";
      let cssContent = "";

      if (fs.existsSync(jsPath)) {
        jsContent = await fs.promises.readFile(jsPath, "utf8");
      }

      if (fs.existsSync(cssPath)) {
        cssContent = await fs.promises.readFile(cssPath, "utf8");
      }

      // HTML 직접 생성 (JS/CSS 인라인)
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Naite Trace Viewer</title>
  <style>${cssContent}</style>
</head>
<body>
  <div id="root"></div>
  <script>${jsContent}</script>
</body>
</html>`;

      return {
        contents: `export default ${JSON.stringify(html)};`,
        loader: "js",
      };
    });
  },
};

async function main() {
  // 1. Extension 빌드
  const extContext = await esbuild.context({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    outfile: "out/extension.js",
    external: ["vscode"],
    format: "cjs",
    platform: "node",
    sourcemap: !production,
    minify: production,
    plugins: [traceViewerLoader],
  });

  // 2. naite-lsp 서버 번들 (extension에 포함)
  const naiteLspServerPath = path.resolve(__dirname, "../naite-lsp/src/server.ts");
  const lspContext = await esbuild.context({
    entryPoints: [naiteLspServerPath],
    bundle: true,
    outfile: "out/naite-lsp-server.js",
    format: "cjs",
    platform: "node",
    sourcemap: !production,
    minify: production,
  });

  if (watch) {
    await Promise.all([extContext.watch(), lspContext.watch()]);
    console.log("[esbuild] Watching for changes...");
  } else {
    await Promise.all([extContext.rebuild(), lspContext.rebuild()]);
    await Promise.all([extContext.dispose(), lspContext.dispose()]);
  }
}

main().catch(() => process.exit(1));
