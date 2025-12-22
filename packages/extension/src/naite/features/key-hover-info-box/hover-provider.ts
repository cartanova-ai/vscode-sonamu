import vscode from "vscode";
import { NaiteTracker } from "../../lib/tracking/tracker";

export class NaiteHoverProvider implements vscode.HoverProvider {
  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.Hover | undefined> {
    const key = NaiteTracker.getKeyAtPosition(document, position);
    if (!key) {
      return undefined;
    }

    const setLocs = NaiteTracker.getKeyLocations(key, "set");
    const getLocs = NaiteTracker.getKeyLocations(key, "get");

    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.appendCodeblock(`(Naite key) "${key}"`, "typescript");

    const args = encodeURIComponent(JSON.stringify([key]));
    md.appendMarkdown(
      `[정의 ${setLocs.length}](command:sonamu.naite.key.goToDefinition?${args}) | [참조 ${getLocs.length}](command:sonamu.naite.key.goToReferences?${args})`,
    );

    return new vscode.Hover(md);
  }
}
