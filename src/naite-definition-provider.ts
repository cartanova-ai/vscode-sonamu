import * as vscode from 'vscode';
import { NaiteTracker } from './naite-tracker';

interface NaiteCallInfo {
  key: string;
  type: 'set' | 'get'; // Naite.t = set, Naite.get = get
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
    // - Naite.t (정의)에서 클릭 → 사용처(Naite.get)로 이동
    // - Naite.get (사용)에서 클릭 → 정의(Naite.t)로 이동
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
    const pattern = /Naite\.(t|get)\s*\(\s*["'`]([^"'`]+)["'`]/g;

    let match;
    while ((match = pattern.exec(line)) !== null) {
      const matchStart = match.index;
      const matchEnd = match.index + match[0].length;

      // 커서가 이 매치 범위 안에 있는지 확인
      if (position.character >= matchStart && position.character <= matchEnd) {
        return {
          key: match[2],
          type: match[1] === 't' ? 'set' : 'get'
        };
      }
    }

    return null;
  }
}
