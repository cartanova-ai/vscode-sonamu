import type { CompletionItem, CompletionParams } from "vscode-languageserver";
import { CompletionItemKind } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { EntityStore } from "../entity/entity-store.js";
import { getExistingArrayValues, getExistingKeys, getJsonContext } from "../entity/json-utils.js";

// 루트 레벨 속성 키
const ROOT_KEYS = [
  "id",
  "title",
  "table",
  "parentId",
  "postIt",
  "props",
  "indexes",
  "subsets",
  "enums",
];

// 기본 prop 필드 (모든 타입 공통)
const BASE_PROP_KEYS = [
  "name",
  "type",
  "desc",
  "nullable",
  "toFilter",
  "dbDefault",
  "generated",
  "postIt",
];

// 타입별 추가 필드
const TYPE_EXTRA_KEYS: Record<string, string[]> = {
  string: ["length", "zodFormat"],
  "string[]": ["length", "zodFormat"],
  enum: ["id", "length"],
  "enum[]": ["id"],
  number: ["precision", "scale", "numberType"],
  "number[]": ["precision", "scale", "numberType"],
  numeric: ["precision", "scale"],
  "numeric[]": ["precision", "scale"],
  date: ["precision"],
  "date[]": ["precision"],
  json: ["id"],
  virtual: ["id", "virtualType"],
  vector: ["dimensions"],
  "vector[]": ["dimensions"],
  relation: ["with", "relationType"],
};

// relation 타입별 추가 필드
const RELATION_TYPE_EXTRA_KEYS: Record<string, string[]> = {
  BelongsToOne: ["customJoinClause", "useConstraint", "onUpdate", "onDelete"],
  HasMany: ["joinColumn", "fromColumn"],
  ManyToMany: ["joinTable", "onUpdate", "onDelete"],
  OneToOne: ["customJoinClause", "hasJoinColumn", "useConstraint", "onUpdate", "onDelete"],
};

// prop 타입 값
const PROP_TYPES = [
  "integer",
  "integer[]",
  "bigInteger",
  "bigInteger[]",
  "string",
  "string[]",
  "enum",
  "enum[]",
  "number",
  "number[]",
  "numeric",
  "numeric[]",
  "boolean",
  "boolean[]",
  "date",
  "date[]",
  "uuid",
  "uuid[]",
  "json",
  "virtual",
  "vector",
  "vector[]",
  "tsvector",
  "relation",
];

const RELATION_TYPES = ["BelongsToOne", "HasMany", "ManyToMany", "OneToOne"];
const RELATION_ON_VALUES = ["CASCADE", "SET NULL", "NO ACTION", "SET DEFAULT", "RESTRICT"];

const ZOD_FORMATS = [
  "email",
  "uuid",
  "url",
  "httpUrl",
  "hostname",
  "emoji",
  "base64",
  "base64url",
  "hex",
  "jwt",
  "nanoid",
  "cuid",
  "cuid2",
  "ulid",
  "ipv4",
  "ipv6",
  "mac",
  "cidrv4",
  "cidrv6",
  "date",
  "time",
  "datetime",
  "duration",
  "isoDuration",
];

const NUMBER_TYPES = ["real", "double precision", "numeric"];
const VIRTUAL_TYPES = ["query", "code"];
const INDEX_TYPES = ["index", "unique", "hnsw", "ivfflat"];
const INDEX_USING = ["btree", "hash", "gin", "gist", "pgroonga"];
const SORT_ORDERS = ["ASC", "DESC"];
const VECTOR_OPS = ["vector_cosine_ops", "vector_ip_ops", "vector_l2_ops"];

function toCompletionItems(values: string[], kind: CompletionItemKind): CompletionItem[] {
  return values.map((v, i) => ({
    label: v,
    kind,
    sortText: String(i).padStart(4, "0"),
  }));
}

/**
 * 현재 prop의 type 값을 파싱된 JSON에서 가져옵니다.
 */
function getPropType(text: string, propIndex: number): string | undefined {
  try {
    const parsed = JSON.parse(text);
    return parsed?.props?.[propIndex]?.type;
  } catch {
    return undefined;
  }
}

/**
 * 현재 prop의 relationType 값을 파싱된 JSON에서 가져옵니다.
 */
function getPropRelationType(text: string, propIndex: number): string | undefined {
  try {
    const parsed = JSON.parse(text);
    return parsed?.props?.[propIndex]?.relationType;
  } catch {
    return undefined;
  }
}

export function handleEntityCompletion(
  params: CompletionParams,
  document: TextDocument | undefined,
): CompletionItem[] | null {
  if (!document) {
    return null;
  }

  const text = document.getText();
  const offset = document.offsetAt(params.position);
  const ctx = getJsonContext(text, offset);
  const { path, isAtPropertyKey } = ctx;

  // 루트 레벨 property key
  if (path.length === 1 && isAtPropertyKey) {
    const existing = getExistingKeys(text, []);
    const available = ROOT_KEYS.filter((k) => !existing.includes(k));
    return toCompletionItems(available, CompletionItemKind.Property);
  }

  // props[n] property key
  if (path.length === 3 && path[0] === "props" && typeof path[1] === "number" && isAtPropertyKey) {
    const propIndex = path[1] as number;
    const propType = getPropType(text, propIndex);
    const existing = getExistingKeys(text, ["props", propIndex]);

    const keys = [...BASE_PROP_KEYS];

    if (propType && TYPE_EXTRA_KEYS[propType]) {
      keys.push(...TYPE_EXTRA_KEYS[propType]);
    }

    if (propType === "relation") {
      const relationType = getPropRelationType(text, propIndex);
      if (relationType && RELATION_TYPE_EXTRA_KEYS[relationType]) {
        keys.push(...RELATION_TYPE_EXTRA_KEYS[relationType]);
      }
    }

    const available = keys.filter((k) => !existing.includes(k));
    return toCompletionItems(available, CompletionItemKind.Property);
  }

  // props[n].type value
  if (
    path.length === 3 &&
    path[0] === "props" &&
    typeof path[1] === "number" &&
    path[2] === "type" &&
    !isAtPropertyKey
  ) {
    return toCompletionItems(PROP_TYPES, CompletionItemKind.EnumMember);
  }

  // props[n].relationType value
  if (
    path.length === 3 &&
    path[0] === "props" &&
    typeof path[1] === "number" &&
    path[2] === "relationType" &&
    !isAtPropertyKey
  ) {
    return toCompletionItems(RELATION_TYPES, CompletionItemKind.EnumMember);
  }

  // props[n].with value — entity IDs
  if (
    path.length === 3 &&
    path[0] === "props" &&
    typeof path[1] === "number" &&
    path[2] === "with" &&
    !isAtPropertyKey
  ) {
    return toCompletionItems(EntityStore.getAllEntityIds(), CompletionItemKind.Reference);
  }

  // props[n].onUpdate / props[n].onDelete value
  if (
    path.length === 3 &&
    path[0] === "props" &&
    typeof path[1] === "number" &&
    (path[2] === "onUpdate" || path[2] === "onDelete") &&
    !isAtPropertyKey
  ) {
    return toCompletionItems(RELATION_ON_VALUES, CompletionItemKind.EnumMember);
  }

  // props[n].zodFormat value
  if (
    path.length === 3 &&
    path[0] === "props" &&
    typeof path[1] === "number" &&
    path[2] === "zodFormat" &&
    !isAtPropertyKey
  ) {
    return toCompletionItems(ZOD_FORMATS, CompletionItemKind.EnumMember);
  }

  // props[n].numberType value
  if (
    path.length === 3 &&
    path[0] === "props" &&
    typeof path[1] === "number" &&
    path[2] === "numberType" &&
    !isAtPropertyKey
  ) {
    return toCompletionItems(NUMBER_TYPES, CompletionItemKind.EnumMember);
  }

  // props[n].virtualType value
  if (
    path.length === 3 &&
    path[0] === "props" &&
    typeof path[1] === "number" &&
    path[2] === "virtualType" &&
    !isAtPropertyKey
  ) {
    return toCompletionItems(VIRTUAL_TYPES, CompletionItemKind.EnumMember);
  }

  // props[n].id value (enum/json/virtual type) — enums 키 목록
  if (
    path.length === 3 &&
    path[0] === "props" &&
    typeof path[1] === "number" &&
    path[2] === "id" &&
    !isAtPropertyKey
  ) {
    const propIndex = path[1] as number;
    const propType = getPropType(text, propIndex);
    if (propType === "enum" || propType === "enum[]") {
      // 같은 파일의 enums 키 목록
      try {
        const parsed = JSON.parse(text);
        if (parsed?.enums && typeof parsed.enums === "object") {
          return toCompletionItems(Object.keys(parsed.enums), CompletionItemKind.EnumMember);
        }
      } catch {
        // ignore
      }
    }
    return null;
  }

  // indexes[n] property key
  if (
    path.length === 3 &&
    path[0] === "indexes" &&
    typeof path[1] === "number" &&
    isAtPropertyKey
  ) {
    const indexKeys = [
      "type",
      "columns",
      "name",
      "using",
      "nullsNotDistinct",
      "m",
      "efConstruction",
      "lists",
    ];
    const existing = getExistingKeys(text, ["indexes", path[1] as number]);
    const available = indexKeys.filter((k) => !existing.includes(k));
    return toCompletionItems(available, CompletionItemKind.Property);
  }

  // indexes[n].type value
  if (
    path.length === 3 &&
    path[0] === "indexes" &&
    typeof path[1] === "number" &&
    path[2] === "type" &&
    !isAtPropertyKey
  ) {
    return toCompletionItems(INDEX_TYPES, CompletionItemKind.EnumMember);
  }

  // indexes[n].using value
  if (
    path.length === 3 &&
    path[0] === "indexes" &&
    typeof path[1] === "number" &&
    path[2] === "using" &&
    !isAtPropertyKey
  ) {
    return toCompletionItems(INDEX_USING, CompletionItemKind.EnumMember);
  }

  // indexes[n].columns[m] property key
  if (
    path.length === 5 &&
    path[0] === "indexes" &&
    typeof path[1] === "number" &&
    path[2] === "columns" &&
    typeof path[3] === "number" &&
    isAtPropertyKey
  ) {
    const colKeys = ["name", "sortOrder", "nullsFirst", "vectorOps"];
    const existing = getExistingKeys(text, [
      "indexes",
      path[1] as number,
      "columns",
      path[3] as number,
    ]);
    const available = colKeys.filter((k) => !existing.includes(k));
    return toCompletionItems(available, CompletionItemKind.Property);
  }

  // indexes[n].columns[m].name value — prop 이름
  if (
    path.length === 5 &&
    path[0] === "indexes" &&
    typeof path[1] === "number" &&
    path[2] === "columns" &&
    typeof path[3] === "number" &&
    path[4] === "name" &&
    !isAtPropertyKey
  ) {
    return getPropNamesFromText(text, document.uri);
  }

  // indexes[n].columns[m].sortOrder value
  if (
    path.length === 5 &&
    path[0] === "indexes" &&
    typeof path[1] === "number" &&
    path[2] === "columns" &&
    typeof path[3] === "number" &&
    path[4] === "sortOrder" &&
    !isAtPropertyKey
  ) {
    return toCompletionItems(SORT_ORDERS, CompletionItemKind.EnumMember);
  }

  // indexes[n].columns[m].vectorOps value
  if (
    path.length === 5 &&
    path[0] === "indexes" &&
    typeof path[1] === "number" &&
    path[2] === "columns" &&
    typeof path[3] === "number" &&
    path[4] === "vectorOps" &&
    !isAtPropertyKey
  ) {
    return toCompletionItems(VECTOR_OPS, CompletionItemKind.EnumMember);
  }

  // subsets.<name> 배열 내 값 — prop 이름
  if (
    path.length === 3 &&
    path[0] === "subsets" &&
    typeof path[1] === "string" &&
    typeof path[2] === "number" &&
    !isAtPropertyKey
  ) {
    return getPropNamesFromText(text, document.uri, ["subsets", path[1]]);
  }

  // subsets.<name>.fields 배열 내 값 — prop 이름
  if (
    path.length === 4 &&
    path[0] === "subsets" &&
    typeof path[1] === "string" &&
    path[2] === "fields" &&
    typeof path[3] === "number" &&
    !isAtPropertyKey
  ) {
    return getPropNamesFromText(text, document.uri, ["subsets", path[1], "fields"]);
  }

  return null;
}

function getPropNamesFromText(
  text: string,
  uri: string,
  existingArrayPath?: (string | number)[],
): CompletionItem[] | null {
  const entity = EntityStore.getEntityByFilePath(uri);
  const propNames = entity?.propNames ?? getPropNamesFromParsed(text);

  if (propNames.length === 0) {
    return null;
  }

  // 이미 선택된 값을 제외
  if (existingArrayPath) {
    const existing = getExistingArrayValues(text, existingArrayPath);
    const available = propNames.filter((p) => !existing.includes(p));
    return toCompletionItems(available, CompletionItemKind.Field);
  }

  return toCompletionItems(propNames, CompletionItemKind.Field);
}

function getPropNamesFromParsed(text: string): string[] {
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed?.props)) {
      return [];
    }
    return parsed.props
      .filter(
        (p: unknown) =>
          p && typeof p === "object" && typeof (p as Record<string, unknown>).name === "string",
      )
      .map((p: Record<string, unknown>) => p.name as string);
  } catch {
    return [];
  }
}
