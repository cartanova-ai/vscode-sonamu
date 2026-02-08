import { CompletionItem, CompletionItemKind, type CompletionParams } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { NaiteCallPatterns } from "../core/patterns.js";
import { NaiteTracker } from "../core/tracker.js";

export function handleCompletion(
  params: CompletionParams,
  document: TextDocument | undefined,
): CompletionItem[] | null {
  if (!document) {
    return null;
  }

  const linePrefix = document
    .getText()
    .split("\n")
    [params.position.line]?.substring(0, params.position.character);

  if (!linePrefix) {
    return null;
  }

  const allPatterns = NaiteCallPatterns.all();

  const methodsByObject = new Map<string, string[]>();
  for (const pattern of allPatterns) {
    const [obj, method] = pattern.split(".");
    if (!obj || !method) {
      continue;
    }
    if (!methodsByObject.has(obj)) {
      methodsByObject.set(obj, []);
    }
    methodsByObject.get(obj)?.push(method);
  }

  let matched = false;
  for (const [obj, methods] of methodsByObject) {
    const regex = new RegExp(`${obj}\\.(${methods.join("|")})\\(["'\`]$`);
    if (regex.test(linePrefix)) {
      matched = true;
      break;
    }
  }

  if (!matched) {
    return null;
  }

  const keys = NaiteTracker.getAllKeys();
  return keys.map((key) => {
    const setLocs = NaiteTracker.getKeyLocations(key, "set");
    const getLocs = NaiteTracker.getKeyLocations(key, "get");

    const definedIn =
      setLocs.length > 0 ? setLocs[0].uri.split("/").pop() || "(정의 없음)" : "(정의 없음)";

    const item = CompletionItem.create(key);
    item.kind = CompletionItemKind.Constant;
    item.detail = definedIn;
    item.documentation = `정의: ${setLocs.length}개 | 사용: ${getLocs.length}개`;

    return item;
  });
}
