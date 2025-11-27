# Sonamu VS Code Extension

Sonamu 개발 팀을 위한 VS Code 확장 프로그램입니다.

## 주요 기능

### Naite 키-값 저장소 지원

Naite는 테스트나 디버깅 시 데이터를 임시로 저장하고 가져오는 키-값 저장소입니다.

이 확장은 다음 기능을 제공합니다:

1. **자동완성**: `Naite.get("` 또는 `Naite.t("` 입력 시 프로젝트 내 모든 Naite 키 자동완성
2. **양방향 네비게이션**:
   - `Naite.t("key")` 위에서 Cmd+Click → 해당 키를 사용하는 `Naite.get("key")` 위치로 이동
   - `Naite.get("key")` 위에서 Cmd+Click → 해당 키를 정의하는 `Naite.t("key")` 위치로 이동

## 설치 방법 (로컬에서 사용)

### 빠른 설치

```bash
cd ~/Projects/vscode-sonamu
pnpm install
pnpm run compile
npx @vscode/vsce package --no-dependencies
code --install-extension vscode-sonamu-0.0.1.vsix
```

설치 후 VS Code를 재시작하고 Sonamu 프로젝트를 열면 자동으로 활성화됩니다!

### 업데이트 방법

코드를 수정한 후:

```bash
cd ~/Projects/vscode-sonamu
pnpm run compile
npx @vscode/vsce package --no-dependencies
code --install-extension vscode-sonamu-0.0.1.vsix --force
```

VS Code를 재시작하면 업데이트가 적용됩니다.

### 제거 방법

```bash
code --uninstall-extension sonamu-dev.vscode-sonamu
```

## 사용 방법

1. **VS Code에서 Sonamu 프로젝트 열기**
   ```bash
   code ~/Projects/sonamu
   ```

2. **확장이 자동으로 활성화됨**
   - 하단에 "Sonamu: Scanning Naite keys..." 메시지 표시
   - 스캔이 완료되면 모든 기능 사용 가능

3. **자동완성 사용**
   - TypeScript 파일에서 `Naite.get("` 입력
   - 자동으로 키 목록 표시

4. **네비게이션 사용**
   - `Naite.t("key")` 또는 `Naite.get("key")`의 문자열 위에서
   - **Cmd+Click** (Mac) 또는 **Ctrl+Click** (Windows/Linux)

## 테스트 방법 (VS Code 확장 개발 초보자용)

### 1. 프로젝트 준비

```bash
cd ~/Projects/vscode-sonamu
pnpm install
pnpm run compile
```

### 2. VS Code에서 프로젝트 열기

```bash
code ~/Projects/vscode-sonamu
```

### 3. 확장 디버깅 모드 실행

1. VS Code에서 `F5` 키 누르기 (또는 메뉴: Run → Start Debugging)
2. 새로운 VS Code 창이 열립니다 (제목: **[Extension Development Host]**)
3. 이 창이 확장이 활성화된 테스트 환경입니다

### 4. Sonamu 프로젝트 열기

Extension Development Host 창에서:

```
File → Open Folder → ~/Projects/sonamu 선택
```

### 5. 기능 테스트

#### 5.1 자동완성 테스트

1. 아무 TypeScript 파일 열기 (예: `modules/sonamu/src/migration/migrator.ts`)
2. 빈 줄에 다음 입력:
   ```typescript
   Naite.get("
   ```
3. 자동으로 완성 목록이 나타나고 다음과 같은 키들이 보임:
   - `getMigrationCodes:results`
   - `getStatus:status`
   - `runAction:action`
   - 등등...
4. 화살표 키로 선택하고 Enter

#### 5.2 Naite.t → Naite.get 네비게이션 테스트

1. `modules/sonamu/src/migration/migrator.ts:64` 열기
2. `Naite.t("getMigrationCodes:results", codes);` 라인 찾기
3. 문자열 `"getMigrationCodes:results"` 위에 커서 놓기
4. **Cmd+Click** (Mac) 또는 **Ctrl+Click** (Windows/Linux)
5. 해당 키를 사용하는 `Naite.get()` 위치로 이동됨

#### 5.3 Naite.get → Naite.t 네비게이션 테스트

1. `examples/miomock/api/src/sonamu-test/migrator.test.ts:32` 열기
2. `Naite.get("getStatus:status")` 라인 찾기
3. 문자열 `"getStatus:status"` 위에 커서 놓기
4. **Cmd+Click** (Mac) 또는 **Ctrl+Click** (Windows/Linux)
5. 해당 키를 정의하는 `Naite.t()` 위치로 이동됨

#### 5.4 키 스캔 상태 확인

1. Command Palette 열기: **Cmd+Shift+P** (Mac) 또는 **Ctrl+Shift+P** (Windows/Linux)
2. `Sonamu: Hello World` 입력 및 실행
3. 우측 하단에 알림 표시: `Sonamu is active! Found XX Naite keys.`

#### 5.5 수동 재스캔

새로운 Naite 키를 추가하고 자동완성에 반영되지 않으면:

1. Command Palette: **Cmd+Shift+P**
2. `Sonamu: Rescan Naite Keys` 실행
3. 스캔 완료 후 알림 표시

### 6. 디버깅

확장 코드를 수정하고 다시 테스트하려면:

1. Extension Development Host 창 닫기
2. 원래 VS Code 창에서 `F5` 다시 누르기

또는 코드 수정 후:

1. Command Palette: `Developer: Reload Window` 실행

### 7. 문제 해결

#### 자동완성이 안 나타나요

- 확장이 활성화되었는지 확인: Command Palette → `Sonamu: Hello World`
- TypeScript 파일에서 테스트하는지 확인 (.ts 파일)
- `Naite.get("` 또는 `Naite.t("` 정확히 입력했는지 확인 (따옴표 포함)

#### Cmd+Click이 작동하지 않아요

- 문자열 리터럴 위에 정확히 커서를 놓았는지 확인
- 해당 키가 실제로 프로젝트 내에 존재하는지 확인
- 재스캔 실행: `Sonamu: Rescan Naite Keys`

#### 컴파일 에러가 발생해요

```bash
cd ~/Projects/vscode-sonamu
pnpm run compile
```

에러 메시지를 확인하고 코드 수정

## 개발

### 파일 구조

- `src/extension.ts` - 확장의 메인 엔트리포인트, 프로바이더 등록
- `src/naite-tracker.ts` - Naite 키 추적 및 TypeScript AST 파싱
- `src/naite-completion-provider.ts` - 자동완성 기능
- `src/naite-definition-provider.ts` - Cmd+Click 네비게이션 기능

### 빌드

```bash
pnpm run compile      # 일회성 컴파일
pnpm run watch        # 파일 변경 시 자동 컴파일
```

## 라이선스

ISC
