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

  updateTraceLineNumbers(filePath: string, keyToLineMap: Map<string, number>): void {
    let updated = false;
    for (const testResult of this.currentTestResults) {
      for (const trace of testResult.traces) {
        const newLineNumber = keyToLineMap.get(trace.key);
        if (trace.filePath === filePath && newLineNumber !== undefined) {
          if (trace.lineNumber !== newLineNumber) {
            trace.lineNumber = newLineNumber;
            updated = true;
          }
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
