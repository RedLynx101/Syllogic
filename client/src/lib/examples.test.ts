import { describe, expect, it } from "vitest";
import { argumentSchema } from "@shared/schema";
import { EXAMPLES, findExample } from "./examples";
import { evaluateSyllogism } from "./syllogism";
import { formatStatement } from "./format";

describe("built-in examples", () => {
  it.each(EXAMPLES.map((example) => [example.name, example] as const))(
    "%s evaluates the way its label says",
    (_name, example) => {
      const argument = argumentSchema.parse({ premises: example.premises, conclusion: example.conclusion });
      expect(evaluateSyllogism(argument).isValid).toBe(example.expectValid);
    },
  );

  it("has unique ids and finds them", () => {
    expect(new Set(EXAMPLES.map((e) => e.id)).size).toBe(EXAMPLES.length);
    expect(findExample("barbara")?.name).toBe("Barbara");
    expect(findExample("nope")).toBeUndefined();
    expect(findExample(null)).toBeUndefined();
  });
});

describe("formatStatement", () => {
  it("reads each form in plain English", () => {
    expect(formatStatement({ form: "A", subject: "Greeks", predicate: "mortal" })).toBe("All Greeks are mortal");
    expect(formatStatement({ form: "E", subject: "snakes", predicate: "mammals" })).toBe("No snakes are mammals");
    expect(formatStatement({ form: "I", subject: "engineers", predicate: "poets" })).toBe("Some engineers are poets");
    expect(formatStatement({ form: "O", subject: "cats", predicate: "dogs" })).toBe("Some cats are not dogs");
  });

  it("keeps complements and fills blanks with S and P", () => {
    expect(formatStatement({ form: "A", subject: "non-mammals", predicate: "non-dogs" })).toBe(
      "All non-mammals are non-dogs",
    );
    expect(formatStatement({ form: "I", subject: " ", predicate: "" })).toBe("Some S are P");
  });
});
