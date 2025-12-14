const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const production = process.argv.includes('--production');

// Webview HTML 파일을 import하면 같은 디렉토리의 style.css와 script.js를 합쳐서 반환
const webviewHtmlLoader = {
  name: 'webview-html-loader',
  setup(build) {
    build.onLoad({ filter: /\/ui\/index\.html$/ }, async (args) => {
      const dir = path.dirname(args.path);

      const html = await fs.promises.readFile(args.path, 'utf8');
      const css = await fs.promises.readFile(path.join(dir, 'style.css'), 'utf8');
      const js = await fs.promises.readFile(path.join(dir, 'script.js'), 'utf8');

      const combined = html
        .replace('/* __STYLE__ */', css)
        .replace('/* __SCRIPT__ */', js);

      return {
        contents: `export default ${JSON.stringify(combined)};`,
        loader: 'js'
      };
    });
  }
};

esbuild.build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'out/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  sourcemap: !production,
  minify: production,
  plugins: [webviewHtmlLoader],
}).catch(() => process.exit(1));
