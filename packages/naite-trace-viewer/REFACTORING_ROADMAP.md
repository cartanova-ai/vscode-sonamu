# naite-trace-viewer 리팩토링 로드맵

> 목표: "Claude 없이도 아무나 보고 바로 수정할 수 있는" 직관적인 React 앱

## 현재 폴더 구조 (기능 기반으로 변경 완료 ✅)

```
src/
├── features/
│   ├── trace-tree/       # Suite > Test > Trace 계층
│   ├── search/           # 검색 기능
│   ├── sticky-headers/   # 스티키 헤더 시스템
│   └── vscode-sync/      # VSCode 동기화
├── shared/
│   ├── ui/               # 재사용 UI
│   ├── hooks/            # 앱 전반 훅
│   └── utils/            # 공용 유틸
├── types/
├── lib/
├── App.tsx
└── main.tsx
```

**효과:** "기능 X를 수정하려면?" → `features/X/` 폴더만 보면 됨

---

## 남은 개선 과제

### 2. 메시지 처리 로직 통합

**현재 문제:**
- App.tsx에 focusKey/focusTest 처리 로직 있음 (48~91줄)
- useVSCodeSync.ts에 다른 메시지 처리 있음
- 같은 패턴(trace.key 검색 루프)이 중복됨

**목표:**
- 모든 메시지 처리를 `features/sync/useVSCodeSync.ts`로 통합
- App.tsx는 순수하게 UI 조합만 담당

---

### 3. ResizeObserver 로직 추출

**현재 문제:**
- SuiteItem.tsx와 SearchView.tsx에 동일한 ResizeObserver 패턴 반복

**목표:**
- `shared/hooks/useDynamicHeight.ts`로 추출

---

### 4. 상수 파일 통합

**현재 문제:**
- Magic numbers가 여기저기 흩어져 있음
  - HIGHLIGHT_DURATION_MS = 2000
  - DEBOUNCE_MS = 100
  - 스티키 오프셋 7, 6 등

**목표:**
- `shared/constants.ts`에 모두 모음
- CSS와 동기화 필요한 값들은 주석으로 명시

---

## 진행 상황

- [x] 1. 폴더 구조 기능 기반 변경
- [ ] 2. 메시지 처리 통합
- [ ] 3. ResizeObserver 훅 추출
- [ ] 4. 상수 파일 통합
