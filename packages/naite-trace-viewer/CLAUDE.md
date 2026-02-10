# naite-trace-viewer 패키지

트레이스 결과를 보여주는 React 웹뷰 UI.

## 역사

이 패키지는 `extension` 패키지에서 분리된 React 프로젝트로, 웹뷰 형태로 Naite 트레이스 결과를 시각화하는 Naite Trace Viewer의 구현체입니다.

처음에는 날코딩된 정적 HTML, CSS, JS로 `extension` 패키지 내에 존재하였으나, 이를 React로 개발하고 싶어 분리하였습니다.

## 목표

이 패키지는 "Claude 없이도 아무나 보고 바로 수정할 수 있도록 하자"는 취지로 시작되었습니다. 따라서 모든 코드와 구성요소들은 이해하기 쉬울 뿐만 아니라 최소 수정으로도 원하는 기능을 달성할 수 있도록 직관적이고 간단한 아키텍쳐를 지향합니다.

현재 이 목표는 아직 달성되지 않았습니다. 아직 진행중입니다.
따라서 모든 작업을 진행할 때에는 이 점(**사람이 바로 알아볼 수 있게 직관적이어야 하고, 빠르게 수정할 수 있게 투명해야 한다**)을 항상 명심해야 합니다.

## 개발

```bash
pnpm dev
# → localhost:5173에서 mock 데이터로 UI 확인
```

mock 데이터: `src/lib/mock-data.ts` (8개 스위트, 26개 테스트 케이스)

## 빌드

```bash
pnpm build
# → dist/assets/main.js, dist/assets/index.css 생성
# 파일명이 고정되어야 extension의 esbuild.js가 인라인 가능
```

## 폴더 구조 (기능 기반)

```
src/
├── features/
│   ├── trace-tree/       # 메인 트리 뷰 (Suite > Test > Trace 계층)
│   ├── search/           # 검색 기능 (퍼지 매칭, 하이라이트)
│   └── sticky-headers/   # 스티키 헤더 시스템
├── components/           # 재사용 UI (ExpandArrow, JsonValue, Header)
├── hooks/                # 앱 전반 훅 (상태관리, VSCode 동기화, 하이라이트, 키보드)
├── utils/                # 공용 유틸 (formatters, keys, escapeId)
├── types/
├── lib/
├── App.tsx
└── main.tsx
```

**"기능 X를 수정하려면?"** → `features/X/` 폴더만 보면 됨

## 주요 기능별 설명

### features/trace-tree/
Suite > Test > Trace 계층 구조 렌더링
- NormalView.tsx - Suite 목록 그룹화
- SuiteItem.tsx, TestItem.tsx, TraceItem.tsx - 각 계층 컴포넌트

### features/search/
검색 기능 전체
- SearchView.tsx - 검색 결과 플랫 리스트
- filterBySearchQuery.ts - 검색 필터링 로직
- fuzzyMatch.ts - 퍼지 매칭 알고리즘
- HighlightedText.tsx - 매칭 문자 하이라이트

> **참고**: 검색어 입력 디바운싱(100ms)은 `hooks/useTraceViewerState.ts`에서 처리됨. 실제 필터링 로직은 `features/search/filterBySearchQuery.ts`에 있음

### features/sticky-headers/
3단계 스티키 헤더 시스템:
1. suite-header (top: 7px)
2. test-header (top: suite높이 + 7px)
3. trace-header (top: suite + test + 6px)

**파일들:**
- useStickyState.ts - .stuck 클래스 토글, CSS 변수에서 오프셋 읽음
- useStickyToggle.ts - 접을 때 스크롤 보정

**⚠️ CSS top 값은 CSS 변수(`--test-header-height`, `--sticky-offset-base`, `--sticky-offset-trace`)로 관리됨. index.css 수정 시 useStickyState.ts에서 올바르게 읽히는지 확인 필요**

### hooks/ (VSCode 동기화 포함)
앱 전반 훅들:
- useTraceViewerState.ts - 메인 상태 관리, VSCode 상태 저장/복원, 메시지 처리
- useScrollToHighlight.ts - 하이라이트된 항목으로 스크롤
- useKeyCombination.ts - 키보드 단축키 처리

> **참고**: VSCode 통신(goToLocation, sendFollowStateChanged)은 useTraceViewerState.ts에 포함됨

### 레이아웃 구조

```
#root (flex column, height: 100%)
├── .header (고정, flex-shrink: 0)
└── #traces-container (스크롤, flex: 1, overflow-y: auto)
    └── ::before (스티키 마스크 - 둥근 모서리 효과)
```

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

`*.test.ts` 파일들:
- `src/utils/escapeId.test.ts`
- `src/features/search/fuzzyMatch.test.ts`
