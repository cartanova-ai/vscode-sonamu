# naite-trace-viewer 패키지

트레이스 결과를 보여주는 React 웹뷰 UI.

## 개발

```bash
pnpm dev
# → localhost:5173에서 mock 데이터로 UI 확인
```

mock 데이터: `src/lib/mock-data.ts` (8개 스위트, 24개 테스트 케이스)

## 빌드

```bash
pnpm build
# → dist/assets/main.js, dist/assets/index.css 생성
# 파일명이 고정되어야 extension의 esbuild.js가 인라인 가능
```

## 주요 아키텍처

### 뷰 모드
- **NormalView**: 스위트 > 테스트 > 트레이스 계층 구조
- **SearchView**: 검색 결과를 플랫 리스트로 표시

### 스티키 헤더 시스템 (복잡함!)

3단계 스티키 헤더가 중첩됨:
1. `suite-header` (top: 7px, z-index: 30)
2. `test-header` (top: suite높이 + 7px, z-index: 20)
3. `trace-header` (top: suite + test + 6px, z-index: 10)

#### 관련 파일들
- `src/index.css`: CSS top 값 정의
- `src/utils/stickyOffsets.ts`: JS에서 같은 오프셋 계산 (**CSS와 반드시 일치해야 함!**)
- `src/hooks/useStickyState.ts`: .stuck 클래스 토글 (그림자 표시용)
- `src/hooks/useStickyToggle.ts`: 스티키 상태에서 접을 때 스크롤 보정

#### 스티키 관련 버그 수정 시 주의
CSS의 `top` 값을 바꾸면 **반드시** `stickyOffsets.ts`와 `useStickyState.ts`의 오프셋도 동일하게 수정해야 함.
그렇지 않으면:
- 스티키 상태 판단이 틀려서 그림자가 안 나오거나
- 접을 때 스크롤이 튀는 현상 발생

### 레이아웃 구조

```
#root (flex column, height: 100%)
├── .header (고정, flex-shrink: 0)
└── #traces-container (스크롤, flex: 1, overflow-y: auto)
    └── ::before (스티키 마스크 - 둥근 모서리 효과)
```

- 스크롤바는 `#traces-container` 내부에 있음
- `#traces-container::before`가 상단 둥근 모서리 마스크 역할

### 검색 기능

- `useSearch.ts`: fuzzy 검색 로직
- `fuzzyMatch.ts`: 매칭 알고리즘
- 검색 시 NormalView → SearchView로 전환

## CSS 특이사항

### VSCode 테마 변수
`:root`에 fallback 정의되어 있지만, 실제 웹뷰에서는 VSCode가 주입한 값 사용.

### biome.json
- a11y 규칙 off (웹뷰는 스크린리더 지원 불필요)
- `useExhaustiveDependencies: off`

## 테스트

```bash
pnpm test        # 단일 실행
pnpm test:watch  # watch 모드
```

`*.test.ts` 파일들: `escapeId.test.ts`, `fuzzyMatch.test.ts` 등
