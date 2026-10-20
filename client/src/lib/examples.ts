import type { Premise } from "@shared/schema";

export interface ExampleArgument {
  /** URL-safe id, used by `/?example=<id>`. */
  id: string;
  name: string;
  /** One line on what the example shows. */
  summary: string;
  premises: Premise[];
  conclusion: Premise;
  /** What the engine reports; the test suite checks every example against this. */
  expectValid: boolean;
}

const A = (subject: string, predicate: string): Premise => ({ form: "A", subject, predicate });
const E = (subject: string, predicate: string): Premise => ({ form: "E", subject, predicate });
const I = (subject: string, predicate: string): Premise => ({ form: "I", subject, predicate });

export const EXAMPLES: readonly ExampleArgument[] = [
  {
    id: "barbara",
    name: "Barbara",
    summary: "The classic: two universal premises chain into a universal conclusion.",
    premises: [A("humans", "mortal"), A("Greeks", "humans")],
    conclusion: A("Greeks", "mortal"),
    expectValid: true,
  },
  {
    id: "darii",
    name: "Darii",
    summary: "A universal and a particular premise give a particular conclusion.",
    premises: [A("poets", "dreamers"), I("engineers", "poets")],
    conclusion: I("engineers", "dreamers"),
    expectValid: true,
  },
  {
    id: "celarent",
    name: "Celarent",
    summary: "A negative premise, reduced to Barbara by obversion.",
    premises: [E("reptiles", "mammals"), A("snakes", "reptiles")],
    conclusion: E("snakes", "mammals"),
    expectValid: true,
  },
  {
    id: "undistributed-middle",
    name: "Undistributed middle",
    summary: "A tempting fallacy: sharing a predicate links nothing.",
    premises: [A("humans", "mortal"), A("cats", "mortal")],
    conclusion: A("cats", "humans"),
    expectValid: false,
  },
];

export function findExample(id: string | null | undefined): ExampleArgument | undefined {
  return id ? EXAMPLES.find((example) => example.id === id) : undefined;
}
