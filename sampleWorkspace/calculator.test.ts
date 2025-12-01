import { add } from "./calculator";
import { Naite } from "./naite";

suite("Calculator", () => {
  test("add", () => {
    add(1, 2);

    Naite.get("add:params");
    Naite.get("add:result");
    Naite.get("add:*");
  });
});
