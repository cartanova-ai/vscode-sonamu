# vscode-extension 패키지

VSCode 익스텐션 본체. LanguageClient를 통해 sonamu-lsp 서버에 연결하고, Naite 트레이스 웹뷰와 키 데코레이션 등 VSCode 전용 UI를 제공한다.

language provider 로직(자동완성, 정의 이동, 호버 등)은 모두 `sonamu-lsp`에 구현되어 있고, 이 패키지는 LSP 클라이언트 역할만 한다.

## 빌드

```bash
pnpm build
# 1. tsc --noEmit (타입 체크만)
# 2. pnpm --filter sonamu-lsp build (LSP 서버 빌드)
# 3. pnpm --filter naite-trace-viewer build (웹뷰 빌드)
# 4. node esbuild.mjs --production (익스텐션 번들링)
```

## esbuild.mjs의 역할

두 가지를 번들링한다:
1. **extension.js** (CJS): 익스텐션 본체. `naite-trace-viewer/dist/`의 JS/CSS를 읽어서 하나의 HTML 문자열로 인라인하여 웹뷰 컨텐츠로 사용.
2. **sonamu-lsp-server.mjs** (ESM): sonamu-lsp 서버를 함께 번들링. LanguageClient가 이 파일을 node로 실행.

### 주의사항
- `sonamu-lsp`와 `naite-trace-viewer`가 먼저 빌드되어야 함
- `dist/assets/main.js`, `dist/assets/index.css` 파일명 고정 (vite.config.ts에서 설정)

## 주요 파일 구조

```
src/
├── extension.ts                  # 진입점: LanguageClient 생성, custom notification 처리
├── webview-html.d.ts             # trace-viewer HTML 인라인 타입
└── naite/
    ├── features/
    │   ├── trace-viewer/         # 웹뷰 프로바이더 (trace-viewer-provider.ts)
    │   ├── key-highlighting/     # 키 데코레이션 (key-decorator.ts, 자체 정규식 기반)
    │   └── inline-value-display/ # 인라인 값 표시 (value-decorator.ts, LSP inlay hints 활용)
    └── lib/
        └── utils/
            ├── editor-navigation.ts  # 에디터 파일 열기/이동
            └── status-bar.ts         # 상태바 메시지
```

## 웹뷰 통신

익스텐션 ↔ 웹뷰 메시지:
- `updateTestResults`: 트레이스 데이터 전송
- `openFile`: 파일 열기 요청 (웹뷰 → 익스텐션)
- `revealTrace`: 특정 트레이스로 스크롤 (익스텐션 → 웹뷰)

## 배포

```bash
pnpm install-extension
# → build → vsce package → code --install-extension
```

Open VSX Registry 배포: main 브랜치 push 시 GitHub Actions로 자동 배포 (`.github/workflows/publish.yml`)
