import type { Location, ReferenceParams } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { NaiteTracker } from "../core/tracker.js";

export async function handleReferences(
  params: ReferenceParams,
  document: TextDocument | undefined,
): Promise<Location[] | null> {
  if (!document) {
    return null;
  }

  const key = NaiteTracker.getKeyAtPosition(document, params.position);
  if (!key) {
    return null;
  }

  let locations = NaiteTracker.getKeyLocations(key, "get");

  if (locations.length === 0) {
    await NaiteTracker.scanFile(document.uri);
    locations = NaiteTracker.getKeyLocations(key, "get");
  }

  if (locations.length === 0) {
    return null;
  }

  return locations;
}
