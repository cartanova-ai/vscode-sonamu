# vscode-sonamu 프로젝트

Sonamu 프레임워크 개발을 위한 에디터 확장 모노레포.

> **주의**: 이 문서와 각 패키지의 CLAUDE.md는 부정확할 수 있습니다.
> 코드 작업 시 명시된 기능/구조가 실제 코드와 일치하는지 확인하고,
> 불일치 발견 시 즉시 CLAUDE.md를 수정하여 최신 상태로 유지해야 합니다.

## 이것은 무슨 프로젝트인가?

Sonamu라는 TypeScript 웹 프레임워크의 개발을 지원하는 에디터 확장입니다. VSCode/Cursor와 Zed 에디터를 지원합니다.

현재 Sonamu의 기능 중 Naite라는 시스템과 entity.json 편집을 더욱 편하게 사용할 수 있게 초점을 두고 있습니다.

### Naite란 무엇인가?

Naite는 테스트 주도 개발을 돕기 위해 만들어진 시스템입니다. 
전통적인 디버그 방법 중 하나인, 코드 중간에 `console.log()`를 심어서 콘솔 출력 결과를 보는 방식을 현대적으로 대체하는 접근입니다.

코드 중간에 `Naite.t("key", value)` 형태로 키와 값을 기록하면, 이 값은 테스트 실행 맥락 동안 존재(Async Local Storage)하며, 이후 테스트 코드 내에서 `Naite.get("key")` 형태로 값을 조회할 수 있습니다.

### 이 익스텐션이 Naite를 더욱 편하게 사용할 수 있게 도와주는 방법

Sonamu에서 테스트가 끝날 때마다 `Naite.t("key", value)` 형태로 기록한 값들(=Trace라고 부릅니다)을 이 확장이 관리하는 소켓 서버로 전달합니다. 그러면 이 확장은 그걸 받아서 여러 방법(decorations, hover, tracer viewer 등)으로 표시해줍니다.

## 프로젝트 구조

```
vscode-sonamu/
├── packages/
│   ├── vscode-extension/   # VSCode 익스텐션 (LanguageClient 기반)
│   ├── sonamu-lsp/         # LSP 서버 (Naite + entity.json)
│   ├── naite-trace-viewer/ # 트레이스 뷰어 웹뷰 (React)
│   ├── naite-viewer/       # 독립 웹 기반 Trace Viewer (React SPA)
│   ├── naite-types/        # 공유 타입 정의
│   └── zed-extension/      # Zed 에디터 확장 (Rust/WASM, pnpm 워크스페이스 제외)
├── biome.json              # 린터/포매터 설정
└── pnpm-workspace.yaml     # pnpm 워크스페이스 설정
```

각 패키지별 상세 문서:
- [packages/vscode-extension/CLAUDE.md](packages/vscode-extension/CLAUDE.md)

> **Claude에게**: 하위 패키지(`packages/*`) 파일을 수정할 때는 반드시 해당 패키지의 CLAUDE.md를 먼저 읽어라.

이렇게 여러 패키지로 분리된 이유와 과정:
- 처음에는 `vscode-extension`이 별도의 이름도 없이 단일 패키지로 존재했습니다.
- Naite Trace Viewer가 점점 커지면서 React로 별도 분리하였습니다: `naite-trace-viewer`
- 두 패키지 사이에서 동일한 TypeScript 타입을 공유하기 위해 `naite-types`를 만들었습니다.
- language provider 로직을 에디터 독립적인 LSP 서버로 추출하였습니다: `sonamu-lsp`
- `sonamu-lsp`의 viewer-server와 WebSocket으로 통신하는 독립 웹 Trace Viewer를 만들었습니다: `naite-viewer`
- Zed 에디터에서도 `sonamu-lsp`를 사용할 수 있도록 Zed 확장을 만들었습니다: `zed-extension`

## 빌드 및 패키징

### 의존성 관계
- `vscode-extension` → `sonamu-lsp` (esbuild로 서버를 함께 번들링)
- `vscode-extension` → `naite-trace-viewer` (빌드 결과물을 인라인으로 포함)
- `vscode-extension` → `naite-types`
- `sonamu-lsp` → `naite-types`
- `naite-trace-viewer` → `naite-types`
- `naite-viewer` → `naite-trace-viewer`, `naite-types`

### 빌드 순서 (중요!)
extension 빌드 시 sonamu-lsp와 naite-trace-viewer가 먼저 빌드되어야 함:
```bash
# extension의 build 스크립트가 자동으로 처리:
# "build": "tsc --noEmit && pnpm --filter @sonamu-kit/lsp build && pnpm --filter naite-trace-viewer build && node esbuild.mjs --production"
cd packages/vscode-extension && pnpm build
```

### 익스텐션 설치/테스트
```bash
cd packages/vscode-extension && pnpm install-extension
# → 빌드 → .vsix 패키징 → VSCode에 설치
```

### 빌드 실패 시 체크리스트
1. `naite-trace-viewer/dist/` 폴더가 있는가?
2. `dist/assets/main.js`, `dist/assets/index.css` 파일이 있는가?
3. esbuild.mjs가 이 파일들을 인라인해서 HTML을 생성함

## 개발 모드

### trace-viewer UI 개발
```bash
cd packages/naite-trace-viewer && pnpm dev
# → localhost:5173에서 mock 데이터로 UI 확인 가능
```

## 린팅

```bash
# 루트에서 전체 린트
pnpm lint

# 특정 패키지
cd packages/naite-trace-viewer && pnpm lint
```

### biome.json 특이사항
- a11y 규칙 대부분 off (VSCode 웹뷰는 스크린리더 지원 불필요)
- `useExhaustiveDependencies: off` (의도적 deps 제어)
- `noArrayIndexKey: off` (정적 리스트에서 사용)

## 아키텍처

### LSP 기반 구조
language provider 로직은 모두 `sonamu-lsp` 패키지에 구현되어 있고, `vscode-extension`과 `zed-extension`은 이 LSP 서버의 클라이언트 역할만 한다.

- `vscode-extension`: esbuild.mjs에서 sonamu-lsp 서버를 `out/sonamu-lsp-server.mjs`로 번들링하여 LanguageClient로 연결
- `zed-extension`: Rust/WASM에서 node를 통해 sonamu-lsp 서버를 실행

## 주요 기능

### Naite 트레이스 시스템
- 테스트 실행 시 `Naite.t()` 호출을 수집
- Unix domain socket 서버로 실시간 수신 → 웹뷰에 표시
- 키 클릭 시 해당 코드 위치로 점프
- 독립 웹 뷰어(`naite-viewer`)로도 확인 가능 (sonamu-lsp의 viewer-server가 HTTP/WebSocket 서빙)

### 키 하이라이팅/네비게이션 (sonamu-lsp)
- `Naite.t("key", ...)` 형태의 키를 파싱
- 정의/참조 이동, 심볼 검색, 자동완성, 호버 정보, 인라인 값 표시, 미정의 키 경고

### entity.json 지원 (sonamu-lsp)
- `*.entity.json` 파일에 대한 자동완성 (prop 타입, relation, index, subset 등)
- Zod validation 기반 diagnostics
- relation의 with 값에 대상 entity 정보 hover 표시

## 자주 발생하는 문제

### "웹뷰가 비어있어요"
→ trace-viewer 빌드 안 됨. `pnpm --filter naite-trace-viewer build` 실행

### "빌드는 되는데 설치 후 안 보여요"
→ `.vsix` 재생성 필요. `pnpm install-extension` 재실행

### "린트 에러가 갑자기 많이 떠요"
→ biome 버전 불일치 가능. `$schema` 버전 확인

## 커밋 컨벤션
- `fix:`, `feat:`, `refactor:`, `chore:` 등 사용
- 한글 커밋 메시지 사용

## 버전 관리
- 익스텐션 버전: `packages/vscode-extension/package.json`의 `version`
- 마켓플레이스 배포 전 버전 업 필요

---

## 코드 작성 원칙

### 상태 관리
- **단일 진입점**: 하나의 기능 수정 시 하나의 파일만 보면 되도록 설계
- **분산 금지**: 관련 상태/로직이 여러 파일에 흩어지면 중앙 훅으로 통합
- **derived state는 useMemo**: 계산 가능한 값은 별도 상태로 관리하지 않음

### CSS/JS 동기화
- **매직 넘버 금지**: 같은 값이 CSS와 JS에 있으면 CSS 변수로 단일화
- **JS에서 CSS 변수 읽기**: `getComputedStyle`로 CSS 변수 값 사용
- **동적 측정 < 고정값**: ResizeObserver보다 고정 height + ellipsis 선호

### 코드 위치
- **사용처 근처 원칙**: 한 곳에서만 쓰이는 상수/함수는 해당 파일에 정의
- **추상화는 중복 발생 시**: 같은 패턴이 2곳 이상일 때만 훅/유틸로 추출
- **표준 폴더 구조**: components/, hooks/, utils/ (모호한 이름 지양)

### 코드 위생
- **죽은 코드 즉시 삭제**: 미사용 코드는 주석 처리 X, 바로 삭제
- **유지 코드엔 이유 주석**: 삭제하지 않은 데는 이유가 있어야 함
- **복잡한 CSS엔 "왜" 주석**: 트릭이나 workaround는 이유 명시

### 스타일
- **if문 중괄호 필수**: 단일 statement에도 {} 사용
- **파일 내 순서**: export 함수 → 내부 컴포넌트 → 헬퍼 함수
- **일반적인 컨벤션 따르기**: 특별한 이유 없으면 커뮤니티 표준 사용

---

## 의사결정 기록 정책

> **Claude에게**: 사용자가 코드 작성이나 구조에 대해 의사결정을 내렸을 때:
> 1. 해당 결정이 이 문서에 없으면 → 즉시 CLAUDE.md에 추가
> 2. 기존 내용과 배치되면 → 사용자에게 확인 후 수정
>
> 이를 통해 프로젝트의 암묵적 규칙이 명시적으로 문서화됩니다.
