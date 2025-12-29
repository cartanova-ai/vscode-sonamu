# naite-trace-viewer 아키텍처

이 문서는 코드베이스의 "인지적 기둥"을 정리합니다.
새로운 개발자가 어디부터 읽어야 할지, 어떤 파일이 핵심인지 안내합니다.

## Tier 1: 핵심 축 (이것만 이해하면 전체 그림이 보임)

| 파일 | 역할 | 중요도 |
|------|------|--------|
| **hooks/useTraceViewerState.ts** | 모든 상태의 원천. VSCode 통신, 상태 저장/복원, reducer 로직 | ★★★★★ |
| **App.tsx** | 글루 코드. 훅들을 조합하고 뷰를 분기 | ★★★★☆ |
| **types/index.ts** | 상태 구조 정의. TraceViewerState를 보면 앱의 관심사가 보임 | ★★★★☆ |

**이 3개만 읽으면**: "데이터가 어디서 오고, 어떤 모양이고, 어떻게 흐르는지" 전부 파악 가능.

## Tier 2: 주요 기능 블록 (필요할 때 깊이 들어감)

| 파일/폴더 | 역할 | 중요도 |
|-----------|------|--------|
| **features/trace-tree/** | 트리 뷰 렌더링 (Suite → Test → Trace) | ★★★☆☆ |
| **features/search/** | 검색 필터링 + 결과 렌더링 | ★★★☆☆ |
| **features/sticky-headers/** | 스크롤 시 헤더 고정 UX | ★★☆☆☆ |

이들은 **"어떻게 그리는가"**에 대한 것. 구조 이해 후 필요할 때 보면 됨.

## Tier 3: 유틸리티 (거의 안 봐도 됨)

| 파일 | 역할 |
|------|------|
| utils/*, components/ExpandArrow, JsonValue | 순수 렌더링/포맷팅 헬퍼 |
| hooks/useKeyCombination, useScrollToHighlight | 단일 책임 유틸 훅 |

## 인지 부하 분배

```
useTraceViewerState (40%)  ← 상태 + 로직의 심장
       │
       ▼
    App.tsx (25%)          ← 조립 + 분기
       │
       ├── NormalView (15%)  ← 트리 렌더링
       ├── SearchView (10%)  ← 검색 렌더링
       └── Header (5%)       ← UI 컨트롤

types/index.ts (5%)        ← 상태 구조 참조용
```

## extension 패키지와의 대응

| extension | trace-viewer |
|-----------|--------------|
| AST 스캐너 | - (해당 없음) |
| TraceStore | useTraceViewerState |
| 엔트리포인트 글루 | App.tsx |
| 프로바이더들 | features/* (React 렌더링 래퍼) |
