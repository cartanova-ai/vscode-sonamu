import vscode from "vscode";
import type NaiteTracker from "./tracking/tracker";

export class NaiteHoverProvider implements vscode.HoverProvider {
  constructor(private tracker: NaiteTracker) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.Hover | undefined> {
    const key = this.tracker.getKeyAtPosition(document, position);
    if (!key) return undefined;

    const setLocs = this.tracker.getKeyLocations(key, "set");
    const getLocs = this.tracker.getKeyLocations(key, "get");

    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.appendCodeblock(`(Naite key) "${key}"`, "typescript");

    const args = encodeURIComponent(JSON.stringify([key]));
    md.appendMarkdown(
      `[정의 ${setLocs.length} | 참조 ${getLocs.length}](command:sonamu.showNaiteLocationsByKey?${args})`,
    );

    return new vscode.Hover(md);
  }
}
