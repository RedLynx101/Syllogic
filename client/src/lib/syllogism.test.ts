import { describe, expect, it } from "vitest";
import type { Premise } from "@shared/schema";
import { evaluateSyllogism } from "./syllogism";

const A = (subject: string, predicate: string): Premise => ({ form: "A", subject, predicate });
const E = (subject: string, predicate: string): Premise => ({ form: "E", subject, predicate });
const I = (subject: string, predicate: string): Premise => ({ form: "I", subject, predicate });
const O = (subject: string, predicate: string): Premise => ({ form: "O", subject, predicate });

// The schema requires at least two premises; this one shares no terms with the tests.
const filler = A("triangles", "polygons");

const check = (premises: Premise[], conclusion: Premise) =>
  evaluateSyllogism({ premises, conclusion });

describe("evaluateSyllogism", () => {
  it("proves Barbara and numbers the derived step", () => {
    const proof = check([A("humans", "mortal"), A("Greeks", "humans")], A("Greeks", "mortal"));
    expect(proof.isValid).toBe(true);
    const last = proof.steps[proof.steps.length - 1];
    expect(last.rule).toBe("Barbara");
    expect(last.premise).toEqual(A("Greeks", "mortal"));
  });

  it("proves Darii", () => {
    const proof = check([A("poets", "dreamers"), I("engineers", "poets")], I("engineers", "dreamers"));
    expect(proof.isValid).toBe(true);
    expect(proof.steps.some((s) => s.rule === "Darii")).toBe(true);
  });

  it("reaches Celarent and Ferio by obverting to Barbara and Darii", () => {
    expect(check([E("reptiles", "mammals"), A("snakes", "reptiles")], E("snakes", "mammals")).isValid).toBe(true);
    expect(check([E("cats", "reptiles"), I("pets", "cats")], O("pets", "reptiles")).isValid).toBe(true);
  });

  it("rejects an undistributed middle", () => {
    expect(check([A("humans", "mortal"), A("cats", "mortal")], A("cats", "humans")).isValid).toBe(false);
  });

  it("rejects simple conversion of an A statement", () => {
    expect(check([A("dogs", "mammals"), filler], A("mammals", "dogs")).isValid).toBe(false);
  });

  it("accepts valid immediate inferences", () => {
    expect(check([E("reptiles", "mammals"), filler], E("mammals", "reptiles")).isValid).toBe(true); // conversion
    expect(check([A("dogs", "mammals"), filler], E("dogs", "non-mammals")).isValid).toBe(true); // obversion
    expect(check([A("dogs", "mammals"), filler], A("non-mammals", "non-dogs")).isValid).toBe(true); // contraposition
  });

  it("contraposes O statements soundly", () => {
    const some = O("cats", "dogs"); // Some cats are not dogs
    expect(check([some, filler], O("non-dogs", "non-cats")).isValid).toBe(true);
    expect(check([some, filler], I("non-dogs", "cats")).isValid).toBe(true);
    // Neither of these follows from "Some cats are not dogs".
    expect(check([some, filler], I("non-dogs", "non-cats")).isValid).toBe(false);
    expect(check([some, filler], O("non-dogs", "cats")).isValid).toBe(false);
  });

  it("never derives tautologies such as 'All M are M'", () => {
    const proof = check([A("a", "b"), A("b", "c")], A("c", "a"));
    expect(proof.isValid).toBe(false);
    expect(proof.steps.some((s) => s.premise.subject === s.premise.predicate)).toBe(false);
  });
});
