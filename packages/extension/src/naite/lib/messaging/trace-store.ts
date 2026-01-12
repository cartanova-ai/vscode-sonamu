import type { NaiteMessagingTypes } from "naite-types";

type TestListener = () => void;

class TraceStoreClass {
  private currentTestResults: NaiteMessagingTypes.TestResult[] = [];
  private testResultAddedListeners: TestListener[] = [];
  private testResultChangeListeners: TestListener[] = [];
  private testResultAddedDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly TEST_RESULT_ADDED_DEBOUNCE_DELAY = 100;

  addRunStart(): void {
    // 이전 테스트 실행에서 남아있을 수 있는 debounce 타이머 정리
    if (this.testResultAddedDebounceTimer) {
      clearTimeout(this.testResultAddedDebounceTimer);
      this.testResultAddedDebounceTimer = null;
    }
    this.currentTestResults = [];
  }

  addTestResult(testResult: NaiteMessagingTypes.TestResult): void {
    this.currentTestResults.push(testResult);

    if (this.testResultAddedDebounceTimer) {
      clearTimeout(this.testResultAddedDebounceTimer);
    }
    this.testResultAddedDebounceTimer = setTimeout(() => {
      this.notifyTestResultAdded();
    }, this.TEST_RESULT_ADDED_DEBOUNCE_DELAY);
  }

  /**
   * NaiteSocketServer에서 "run/end" 메시지 수신 시 호출됩니다.
   * 현재는 특별한 처리가 없지만, 향후 확장될 수 있습니다.
   */
  addRunEnd(): void {
    // 현재는 처리할 작업 없음
  }

  getAllTestResults(): NaiteMessagingTypes.TestResult[] {
    return this.currentTestResults;
  }

  getAllTraces(): NaiteMessagingTypes.NaiteTrace[] {
    return this.currentTestResults.flatMap((r) => r.traces);
  }

  getTracesForLine(filePath: string, lineNumber: number): NaiteMessagingTypes.NaiteTrace[] {
    return this.getAllTraces().filter(
      (t) => t.filePath === filePath && t.lineNumber === lineNumber,
    );
  }

  onTestResultAdded(listener: TestListener): { dispose: () => void } {
    this.testResultAddedListeners.push(listener);
    return {
      dispose: () => {
        const index = this.testResultAddedListeners.indexOf(listener);
        if (index >= 0) {
          this.testResultAddedListeners.splice(index, 1);
        }
      },
    };
  }

  onTestResultChange(listener: TestListener): { dispose: () => void } {
    this.testResultChangeListeners.push(listener);
    return {
      dispose: () => {
        const index = this.testResultChangeListeners.indexOf(listener);
        if (index >= 0) {
          this.testResultChangeListeners.splice(index, 1);
        }
      },
    };
  }

  private notifyTestResultAdded(): void {
    for (const listener of this.testResultAddedListeners) {
      listener();
    }
  }

  private notifyTestResultChange(): void {
    for (const listener of this.testResultChangeListeners) {
      listener();
    }
  }

  /**
   * trace의 라인 번호를 현재 문서 기준으로 업데이트합니다.
   *
   * @param filePath 대상 파일 경로
   * @param keyLineEntries 현재 문서에서 스캔한 (key, lineNumber) 배열
   */
  updateTraceLineNumbers(
    filePath: string,
    keyLineEntries: Array<{ key: string; lineNumber: number }>,
  ): void {
    let updated = false;

    for (const testResult of this.currentTestResults) {
      for (const trace of testResult.traces) {
        if (trace.filePath !== filePath) {
          continue;
        }

        // 같은 key를 가진 엔트리들 중에서 가장 가까운 라인 번호를 찾음
        const matchingEntries = keyLineEntries.filter((e) => e.key === trace.key);
        if (matchingEntries.length === 0) {
          continue;
        }

        // 원래 라인 번호와 가장 가까운 엔트리 선택
        const closest = matchingEntries.reduce((prev, curr) =>
          Math.abs(curr.lineNumber - trace.lineNumber) <
          Math.abs(prev.lineNumber - trace.lineNumber)
            ? curr
            : prev,
        );

        if (trace.lineNumber !== closest.lineNumber) {
          trace.lineNumber = closest.lineNumber;
          updated = true;
        }
      }
    }

    // 변경사항이 있으면 리스너 알림
    if (updated) {
      this.notifyTestResultChange();
    }
  }
}

export const TraceStore = new TraceStoreClass();
