# Sonamu for VS Code

Sonamu 프로젝트 개발을 위한 VS Code 확장입니다.

## 기능

### Naite 키 자동완성

`Naite.t("`, `Naite.del("`, 또는 `Naite.get("` 입력 시 프로젝트의 모든 Naite 키를 자동완성합니다.

### Naite 키 네비게이션

Naite 키 문자열에 대해 **Go to Definition**과 **Go to References**를 지원합니다.

- **정의로 이동** (F12): `Naite.t("key")` 위치로 이동
- **참조로 이동** (Shift+F12): `Naite.get("key")`, `Naite.del("key")` 위치 목록

Cmd+Click은 VS Code 설정에 따라 둘 중 하나가 동작합니다.

### Naite Traces

테스트 실행 중 `Naite.t()`로 기록한 값들을 실시간으로 확인합니다.

**Command Palette** → `Sonamu: Open Naite Trace Viewer`

- 테스트 suite/case별로 그룹화
- 각 trace의 키, 값, 위치, 시간 표시
- 클릭하면 해당 코드 위치로 이동
- 테스트 케이스 라인 번호 표시 (vitest `includeTaskLocation: true` 필요)

## 설치

```bash
cd ~/Projects/vscode-sonamu
pnpm install && pnpm run build
npx @vscode/vsce package --allow-missing-repository
code --install-extension vscode-sonamu-0.0.1.vsix
```

업데이트 시 `--force` 옵션 추가:
```bash
code --install-extension vscode-sonamu-0.0.1.vsix --force
```

## 활성화 조건

워크스페이스에 `sonamu.config.ts`가 있으면 자동 활성화됩니다.

## 명령어

| 명령어 | 설명 |
|--------|------|
| `Sonamu: Open Naite Trace Viewer` | Trace 뷰어 열기 |
| `Sonamu: Rescan Naite Keys` | Naite 키 재스캔 |

## 설정

| 설정 | 기본값 | 설명 |
|------|--------|------|
| `sonamu.decoration.enabled` | `true` | Naite 키 텍스트 데코레이션 |
| `sonamu.runtimeValue.enabled` | `true` | 실행 시 값 인라인 표시 |
| `sonamu.runtimeValue.maxLength` | `50` | 표시할 값의 최대 길이 |

## 개발

```bash
pnpm run dev    # 파일 변경 시 자동 빌드
```

디버깅: VS Code에서 `F5` → Extension Development Host 창에서 테스트
