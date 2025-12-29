# vscode-sonamu 프로젝트

Sonamu 프레임워크 개발을 위한 VSCode 익스텐션 모노레포.

> **주의**: 이 문서와 각 패키지의 CLAUDE.md는 부정확할 수 있습니다.
> 코드 작업 시 명시된 기능/구조가 실제 코드와 일치하는지 확인하고,
> 불일치 발견 시 즉시 CLAUDE.md를 수정하여 최신 상태로 유지해야 합니다.

## 이것은 무슨 프로젝트인가?

Sonamu라는 TypeScript 웹 프레임워크의 개발을 지원하는 VSCode/Cursor 확장입니다.

현재 Sonamu의 기능 중 Naite라는 시스템을 더욱 편하게 사용할 수 있게 초점을 두고 있습니다.

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
│   ├── extension/          # VSCode 익스텐션 (메인)
│   ├── naite-trace-viewer/ # 트레이스 뷰어 웹뷰 (React)
│   └── naite-types/        # 공유 타입 정의
├── biome.json              # 린터/포매터 설정
└── pnpm-workspace.yaml     # pnpm 워크스페이스 설정
```

이렇게 여러 패키지로 분리된 이유와 과정:
- 처음에는 `extension`이 별도의 이름도 없이 단일 패키지로 존재했습니다.
- 그런데 Naite Trace Viewer가 점점 커지면서 이 부분을 React로 개발하고 싶어, 별도로 분리하였습니다.
- 이로서 기존의 익스텐션이 패키지화된 `extension`과 새로 분리된 React 프로젝트인 `naite-trace-viewer`가 존재하게 되었습니다.
- 이 두 패키지 사이에서 동일한 TypeScript 타입을 공유해야 했습니다. 이를 위해 별도의 공유용 패키지를 만들었습니다: `naite-types`

## 빌드 및 패키징

### 의존성 관계
- `extension` → `naite-trace-viewer` (빌드 결과물을 인라인으로 포함)
- `extension` → `naite-types`
- `naite-trace-viewer` → `naite-types`

### 빌드 순서 (중요!)
extension 빌드 시 naite-trace-viewer가 먼저 빌드되어야 함:
```bash
# extension의 build 스크립트가 자동으로 처리:
# "build": "tsc --noEmit && pnpm --filter naite-trace-viewer build && node esbuild.js --production"
cd packages/extension && pnpm build
```

### 익스텐션 설치/테스트
```bash
cd packages/extension && pnpm install-extension
# → 빌드 → .vsix 패키징 → VSCode에 설치
```

### 빌드 실패 시 체크리스트
1. `naite-trace-viewer/dist/` 폴더가 있는가?
2. `dist/assets/main.js`, `dist/assets/index.css` 파일이 있는가?
3. esbuild.js가 이 파일들을 인라인해서 HTML을 생성함

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

## 주요 기능

### Naite 트레이스 시스템
- 테스트 실행 시 `naite.trace()` 호출을 수집
- 소켓 서버로 실시간 수신 → 웹뷰에 표시
- 키 클릭 시 해당 코드 위치로 점프

### 키 하이라이팅/네비게이션
- `naite.trace("key", ...)` 형태의 키를 파싱
- 정의/참조 이동, 심볼 검색, 자동완성 지원

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
- 익스텐션 버전: `packages/extension/package.json`의 `version`
- 마켓플레이스 배포 전 버전 업 필요
