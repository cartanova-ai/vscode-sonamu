import * as vscode from 'vscode';
import { NaiteTracker } from './naite-tracker';

interface NaiteCallInfo {
  key: string;
  type: 'set' | 'get';
  pattern: string; // 매칭된 패턴 (예: "Naite.t")
}

export class NaiteDefinitionProvider implements vscode.DefinitionProvider {
  constructor(private tracker: NaiteTracker) {}

  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.Location[] | undefined> {
    const callInfo = this.getNaiteCallAtPosition(document, position);
    if (!callInfo) return undefined;

    const { key, type } = callInfo;

    // 컨텍스트 인식 점프:
    // - 정의 패턴에서 클릭 → 사용처로 이동
    // - 사용 패턴에서 클릭 → 정의로 이동
    const targetType = type === 'set' ? 'get' : 'set';
    let locations = this.tracker.getKeyLocations(key, targetType);

    // 타겟이 없으면 현재 문서 스캔 후 재시도
    if (locations.length === 0) {
      await this.tracker.scanFile(document.uri);
      locations = this.tracker.getKeyLocations(key, targetType);
    }

    // 그래도 없으면 반대쪽이라도 보여줌
    if (locations.length === 0) {
      locations = this.tracker.getKeyLocations(key);
    }

    if (locations.length === 0) return undefined;

    return locations;
  }

  /**
   * 현재 위치에서 Naite 호출 정보를 추출 (regex 기반)
   */
  private getNaiteCallAtPosition(document: vscode.TextDocument, position: vscode.Position): NaiteCallInfo | null {
    const line = document.lineAt(position.line).text;
    const config = this.tracker.getConfig();

    // 모든 패턴에 대해 매칭 시도
    for (const patternStr of [...config.setPatterns, ...config.getPatterns]) {
      const [obj, method] = patternStr.split('.');
      if (!obj || !method) continue;

      const regex = new RegExp(`${obj}\\.${method}\\s*\\(\\s*["'\`]([^"'\`]+)["'\`]`, 'g');

      let match;
      while ((match = regex.exec(line)) !== null) {
        const matchStart = match.index;
        const matchEnd = match.index + match[0].length;

        // 커서가 이 매치 범위 안에 있는지 확인
        if (position.character >= matchStart && position.character <= matchEnd) {
          const isSet = config.setPatterns.includes(patternStr);
          return {
            key: match[1],
            type: isSet ? 'set' : 'get',
            pattern: patternStr
          };
        }
      }
    }

    return null;
  }
}
