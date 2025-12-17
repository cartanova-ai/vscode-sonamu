import type { NaiteMessagingTypes } from "./messaging-types";

type TestResultChangeListener = (testResults: NaiteMessagingTypes.TestResult[]) => void;

class TraceStoreClass {
  private currentTestResults: NaiteMessagingTypes.TestResult[] = [];
  private testResultChangeListeners: TestResultChangeListener[] = [];

  addRunStart(): void {
    this.currentTestResults = [];
  }

  addTestResult(testResult: NaiteMessagingTypes.TestResult): void {
    this.currentTestResults.push(testResult);
  }

  addRunEnd(): void {
    //
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

  onTestResultChange(listener: TestResultChangeListener): { dispose: () => void } {
    this.testResultChangeListeners.push(listener);
    return {
      dispose: () => {
        const index = this.testResultChangeListeners.indexOf(listener);
        if (index >= 0) this.testResultChangeListeners.splice(index, 1);
      },
    };
  }

  notifyTestResultChange(): void {
    for (const listener of this.testResultChangeListeners) {
      listener(this.currentTestResults);
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
        if (trace.filePath !== filePath) continue;

        // 같은 key를 가진 엔트리들 중에서 가장 가까운 라인 번호를 찾음
        const matchingEntries = keyLineEntries.filter((e) => e.key === trace.key);
        if (matchingEntries.length === 0) continue;

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
