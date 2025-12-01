import vscode from "vscode";
import type NaiteTracker from "./tracker/index";

export class NaiteCodeLensProvider implements vscode.CodeLensProvider {
	constructor(private tracker: NaiteTracker) {}

	provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
		if (document.languageId !== "typescript") return [];

		// 설정에서 CodeLens 활성화 여부 확인
		const config = vscode.workspace.getConfiguration("sonamu");
		if (!config.get<boolean>("codeLens.enabled", true)) {
			return [];
		}

		// tracker에서 스캔된 데이터 사용 (주석 자동 제외)
		const entries = this.tracker.getEntriesForFile(document.uri);
		const lenses: vscode.CodeLens[] = [];

		for (const entry of entries) {
			const range = new vscode.Range(
				entry.location.range.start,
				entry.location.range.start,
			);

			const setLocs = this.tracker.getKeyLocations(entry.key, "set");
			const getLocs = this.tracker.getKeyLocations(entry.key, "get");

			lenses.push(
				new vscode.CodeLens(range, {
					title: `정의 ${setLocs.length} | 참조 ${getLocs.length}`,
					command: "sonamu.showNaiteLocations",
					arguments: [entry.key, setLocs, getLocs],
				}),
			);
		}

		return lenses;
	}
}

export function showNaiteLocations(
	key: string,
	setLocs: vscode.Location[],
	getLocs: vscode.Location[],
) {
	const items: vscode.QuickPickItem[] = [];

	if (setLocs.length > 0) {
		items.push({
			label: "── 정의 ──",
			kind: vscode.QuickPickItemKind.Separator,
		});
		for (const loc of setLocs) {
			items.push({
				label: `$(symbol-method) ${vscode.workspace.asRelativePath(loc.uri)}`,
				description: `Line ${loc.range.start.line + 1}`,
				detail: loc.uri.fsPath,
			});
		}
	}

	if (getLocs.length > 0) {
		items.push({
			label: "── 참조 ──",
			kind: vscode.QuickPickItemKind.Separator,
		});
		for (const loc of getLocs) {
			items.push({
				label: `$(symbol-variable) ${vscode.workspace.asRelativePath(loc.uri)}`,
				description: `Line ${loc.range.start.line + 1}`,
				detail: loc.uri.fsPath,
			});
		}
	}

	const allLocs = [...setLocs, ...getLocs];

	vscode.window
		.showQuickPick(items, { placeHolder: `"${key}" 위치 선택` })
		.then((selected) => {
			if (!selected || selected.kind === vscode.QuickPickItemKind.Separator)
				return;
			const idx = items
				.filter((i) => i.kind !== vscode.QuickPickItemKind.Separator)
				.indexOf(selected);
			if (idx >= 0 && allLocs[idx]) {
				vscode.window.showTextDocument(allLocs[idx].uri, {
					selection: allLocs[idx].range,
				});
			}
		});
}
