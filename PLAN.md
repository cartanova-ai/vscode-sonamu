# Naite 실행 값 표시 기능 설계

## 목표
`Naite.t("key", value)` 호출문 오른쪽에 실제 실행된 값을 inline으로 표시

예시:
```typescript
Naite.t("user:id", userId)  // → 123
Naite.t("result", data)     // → { name: "John", age: 30 }
```

---

## 현재 상태 분석

### Naite 구현 (naite.ts)
- `Naite.t(name, value)` 호출 시 이미 **콜스택 정보**를 수집 중
- `NaiteTrace` 타입에 `filePath`, `lineNumber` 포함
- `process.env.NODE_ENV === "test"` 일 때만 동작

```typescript
interface NaiteTrace {
  key: string;
  data: any;
  stack: StackFrame[];  // { filePath, lineNumber }
  at: Date;
}
```

---

## 통신 방식 비교

| 방식 | 장점 | 단점 |
|------|------|------|
| **파일 기반** | 구현 간단, 디버깅 쉬움, 결합도 낮음 | 파일 I/O 오버헤드 |
| HTTP (익스텐션=서버) | 실시간 | 매 호출마다 HTTP 오버헤드 |
| WebSocket | 실시간, 효율적 | 구현 복잡, 연결 관리 |
| IPC | 빠름 | 플랫폼 의존성 |

### 추천: 파일 기반

이유:
1. Naite는 테스트 환경에서만 동작 (짧은 실행 시간)
2. Sonamu ↔ VSCode 익스텐션 간 결합도 최소화
3. 디버깅 용이 (JSON 파일 직접 확인 가능)
4. 구현 복잡도 낮음

---

## 설계

### 1. 데이터 흐름

```
[테스트 실행]
     │
     ▼
[Naite.t() 호출]
     │
     ├── 기존: naiteStore에 저장
     │
     └── 추가: JSON 파일에 기록
              ~/.sonamu/naite-traces.json
                   │
                   ▼
          [VSCode 익스텐션]
                   │
                   ├── 파일 watch
                   │
                   └── inline decoration 업데이트
```

### 2. JSON 파일 구조

경로: `~/.sonamu/naite-traces.json`

```json
{
  "version": 1,
  "clearedAt": "2024-01-01T00:00:00.000Z",
  "traces": [
    {
      "key": "user:id",
      "value": 123,
      "filePath": "/Users/.../syncer.ts",
      "lineNumber": 42,
      "at": "2024-01-01T00:00:01.000Z"
    }
  ]
}
```

### 3. 클리어 타이밍

**옵션 A: Naite 측에서 처리** (추천)
- 테스트 러너의 setup hook에서 `Naite.clearTraceFile()` 호출
- 또는 `runWithContext()` 시작 시 자동 클리어

**옵션 B: 익스텐션 측에서 처리**
- 터미널에서 `vitest`, `jest` 등 명령어 감지
- TaskProvider API 활용

→ **옵션 A 추천**: 더 정확하고 간단함

### 4. 구현 항목

#### Sonamu 측 (naite.ts 수정)

```typescript
// 1. 파일 경로 상수
const TRACE_FILE_PATH = path.join(os.homedir(), '.sonamu', 'naite-traces.json');

// 2. Naite.t() 수정 - 파일에도 기록
t(name: string, value: any) {
  // 기존 로직 유지...

  // 추가: 파일에 기록
  this.appendToTraceFile({
    key: name,
    value,
    filePath: stack[0]?.filePath,
    lineNumber: stack[0]?.lineNumber,
    at: new Date().toISOString()
  });
}

// 3. 파일 클리어 메서드
clearTraceFile() {
  fs.writeFileSync(TRACE_FILE_PATH, JSON.stringify({
    version: 1,
    clearedAt: new Date().toISOString(),
    traces: []
  }));
}

// 4. 파일에 append
private appendToTraceFile(trace: TraceEntry) {
  // 파일 읽기 → traces에 추가 → 파일 쓰기
}
```

#### VSCode 익스텐션 측

```typescript
// 1. 새 파일: naite-runtime-decorator.ts
// - ~/.sonamu/naite-traces.json watch
// - 파일 변경 시 decoration 업데이트

// 2. inline decoration
// - after pseudo-element로 값 표시
// - contentText: `// → ${formatValue(value)}`
// - 스타일: 회색, 이탤릭
```

### 5. 표시 형식

```typescript
// 짧은 값
Naite.t("count", 42)           // → 42
Naite.t("name", "John")        // → "John"
Naite.t("flag", true)          // → true

// 객체 (요약)
Naite.t("user", { id: 1, name: "John" })  // → { id: 1, name: "John" }

// 긴 객체 (truncate)
Naite.t("data", { ... })       // → { id: 1, name: "John", ... }

// 배열
Naite.t("ids", [1, 2, 3])      // → [1, 2, 3]

// 긴 배열
Naite.t("items", [...])        // → [1, 2, 3, ... +7]
```

### 6. 설정 옵션

```json
{
  "sonamu.runtimeValue.enabled": true,
  "sonamu.runtimeValue.maxLength": 50
}
```

---

## 구현 순서

1. **Sonamu 측**
   - [ ] `clearTraceFile()` 메서드 추가
   - [ ] `appendToTraceFile()` 메서드 추가
   - [ ] `Naite.t()` 수정 - 파일에도 기록
   - [ ] vitest setup에서 `Naite.clearTraceFile()` 호출

2. **VSCode 익스텐션 측**
   - [ ] `naite-runtime-decorator.ts` 생성
   - [ ] JSON 파일 watch 로직
   - [ ] inline decoration (after pseudo-element)
   - [ ] 값 포맷팅 유틸리티
   - [ ] 설정 옵션 추가
   - [ ] extension.ts에 연결

---

## 고려사항

### 성능
- 파일 I/O는 비동기로 처리 (테스트 실행 blocking 방지)
- 익스텐션 측 debounce (파일 변경 빈번할 수 있음)

### 동시성
- 여러 테스트가 동시에 실행될 경우?
  - 현재 Sonamu는 단일 프로세스 테스트 가정
  - 필요시 워커별 파일 분리 또는 lock 고려

### 정리
- 테스트 완료 후 파일 정리?
  - 굳이 필요 없음 (다음 테스트 시작 시 클리어)
