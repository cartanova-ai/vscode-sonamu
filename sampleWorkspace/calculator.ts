import { Naite } from "./naite";

export function add(a: number, b: number) {
  Naite.t("add:params", { a, b });

  const result = a + b;
  Naite.t("add:result", result);

  return result;
}
