import type { Hover, HoverParams } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { EntityStore } from "../entity/entity-store.js";
import { getJsonContext } from "../entity/json-utils.js";

export function handleEntityHover(
  params: HoverParams,
  document: TextDocument | undefined,
): Hover | null {
  if (!document) {
    return null;
  }

  const text = document.getText();
  const offset = document.offsetAt(params.position);
  const ctx = getJsonContext(text, offset);
  const { path, isAtPropertyKey } = ctx;

  // props[n].with 값 hover — 대상 entity 정보
  if (
    path.length === 3 &&
    path[0] === "props" &&
    typeof path[1] === "number" &&
    path[2] === "with" &&
    !isAtPropertyKey
  ) {
    const propIndex = path[1] as number;
    const withValue = getPropField(text, propIndex, "with");
    if (!withValue) {
      return null;
    }

    const entity = EntityStore.getEntityById(withValue);
    if (!entity) {
      return {
        contents: {
          kind: "markdown",
          value: `**${withValue}** — entity not found`,
        },
      };
    }

    const lines = [
      `**${entity.id}**${entity.title ? ` — ${entity.title}` : ""}`,
      "",
      `- table: \`${entity.table}\``,
      `- props: ${entity.propNames.join(", ") || "(none)"}`,
    ];

    if (entity.enumIds.length > 0) {
      lines.push(`- enums: ${entity.enumIds.join(", ")}`);
    }

    return {
      contents: {
        kind: "markdown",
        value: lines.join("\n"),
      },
    };
  }

  return null;
}

function getPropField(text: string, propIndex: number, field: string): string | undefined {
  try {
    const parsed = JSON.parse(text);
    return parsed?.props?.[propIndex]?.[field];
  } catch {
    return undefined;
  }
}
