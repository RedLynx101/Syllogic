const MAX_STEPS = 500;
const MAX_TERM_LENGTH = 100;

import {
  Argument,
  Premise,
  PremiseForm,
  Proof,
  ProofStep,
} from "@shared/schema";

// Normalize terms by reducing multiple negations
const normalizeTerm = (term: string): string => {
  const matches = term.match(/^(non-)+/);
  if (!matches) return term;
  const nonCount = matches[0].split("non-").length - 1;
  const baseTerm = term.replace(/^(non-)+/, "");
  return nonCount % 2 === 0 ? baseTerm : `non-${baseTerm}`;
};

// Helper to normalize a premise
const normalizePremise = (premise: Premise): Premise => ({
  ...premise,
  subject: normalizeTerm(premise.subject),
  predicate: normalizeTerm(premise.predicate),
});

// Given a premise, return all 4 equivalent forms with transformation information
const getEquivalents = (premise: Premise): Array<{ 
  premise: Premise; 
  transforms: Array<{ rule: string; result: Premise }>;
}> => {
  const norm = normalizePremise(premise);
  switch (norm.form) {
    case "A":
      return [
        // Original: All p are q
        { premise: norm, transforms: [] },
        // Obverse: No p are non-q
        { 
          premise: normalizePremise({ ...norm, form: "E", predicate: `non-${norm.predicate}` }),
          transforms: [{ 
            rule: "Obversion",
            result: normalizePremise({ ...norm, form: "E", predicate: `non-${norm.predicate}` })
          }]
        },
        // Contrapositive: All non-q are non-p
        {
          premise: normalizePremise({ ...norm, subject: `non-${norm.predicate}`, predicate: `non-${norm.subject}`, form: "A" }),
          transforms: [{
            rule: "Contraposition",
            result: normalizePremise({ ...norm, subject: `non-${norm.predicate}`, predicate: `non-${norm.subject}`, form: "A" })
          }]
        },
        // Obverse of contrapositive: No non-q are p
        {
          premise: normalizePremise({ ...norm, subject: `non-${norm.predicate}`, predicate: norm.subject, form: "E" }),
          transforms: [
            { rule: "Contraposition", result: normalizePremise({ ...norm, subject: `non-${norm.predicate}`, predicate: `non-${norm.subject}`, form: "A" }) },
            { rule: "Obversion", result: normalizePremise({ ...norm, subject: `non-${norm.predicate}`, predicate: norm.subject, form: "E" }) },
          ]
        }
      ];
    case "E":
      return [
        // Original: No p are q
        { premise: norm, transforms: [] },
        // Obverse: All p are non-q
        {
          premise: normalizePremise({ ...norm, form: "A", predicate: `non-${norm.predicate}` }),
          transforms: [{
            rule: "Obversion",
            result: normalizePremise({ ...norm, form: "A", predicate: `non-${norm.predicate}` })
          }]
        },
        // Converse: No q are p
        {
          premise: normalizePremise({ ...norm, subject: norm.predicate, predicate: norm.subject, form: "E" }),
          transforms: [{
            rule: "Conversion",
            result: normalizePremise({ ...norm, subject: norm.predicate, predicate: norm.subject, form: "E" })
          }]
        },
        // Obverse of converse: All q are non-p
        {
          premise: normalizePremise({ ...norm, subject: norm.predicate, predicate: `non-${norm.subject}`, form: "A" }),
          transforms: [
            { rule: "Conversion", result: normalizePremise({ ...norm, subject: norm.predicate, predicate: norm.subject, form: "E" }) },
            { rule: "Obversion", result: normalizePremise({ ...norm, subject: norm.predicate, predicate: `non-${norm.subject}`, form: "A" }) },
          ]
        }
      ];
    case "I":
      return [
        // Original: Some p are q
        { premise: norm, transforms: [] },
        // Obverse: Some p are not non-q
        {
          premise: normalizePremise({ ...norm, form: "O", predicate: `non-${norm.predicate}` }),
          transforms: [{
            rule: "Obversion",
            result: normalizePremise({ ...norm, form: "O", predicate: `non-${norm.predicate}` })
          }]
        },
        // Converse: Some q are p
        {
          premise: normalizePremise({ ...norm, subject: norm.predicate, predicate: norm.subject, form: "I" }),
          transforms: [{
            rule: "Conversion",
            result: normalizePremise({ ...norm, subject: norm.predicate, predicate: norm.subject, form: "I" })
          }]
        },
        // Obverse of converse: Some q are not non-p
        {
          premise: normalizePremise({ ...norm, subject: norm.predicate, predicate: `non-${norm.subject}`, form: "O" }),
          transforms: [
            { rule: "Conversion", result: normalizePremise({ ...norm, subject: norm.predicate, predicate: norm.subject, form: "I" }) },
            { rule: "Obversion", result: normalizePremise({ ...norm, subject: norm.predicate, predicate: `non-${norm.subject}`, form: "O" }) },
          ]
        }
      ];
    case "O":
      return [
        // Original: Some p are not q
        { premise: norm, transforms: [] },
        // Obverse: Some p are non-q
        {
          premise: normalizePremise({ ...norm, form: "I", predicate: `non-${norm.predicate}` }),
          transforms: [{
            rule: "Obversion",
            result: normalizePremise({ ...norm, form: "I", predicate: `non-${norm.predicate}` })
          }]
        },
        // Contrapositive: Some non-q are p
        {
          premise: normalizePremise({ ...norm, subject: `non-${norm.predicate}`, predicate: norm.subject, form: "O" }),
          transforms: [{
            rule: "Contraposition",
            result: normalizePremise({ ...norm, subject: `non-${norm.predicate}`, predicate: norm.subject, form: "O" })
          }]
        },
        // Obverse of contrapositive: Some non-q are non-p
        {
          premise: normalizePremise({ ...norm, subject: `non-${norm.predicate}`, predicate: `non-${norm.subject}`, form: "I" }),
          transforms: [
            { rule: "Contraposition", result: normalizePremise({ ...norm, subject: `non-${norm.predicate}`, predicate: norm.subject, form: "O" }) },
            { rule: "Obversion", result: normalizePremise({ ...norm, subject: `non-${norm.predicate}`, predicate: `non-${norm.subject}`, form: "I" }) },
          ]
        }
      ];
    default:
      return [{ premise: norm, transforms: [] }];
  }
};

// Helper to check if a premise is in a specific form
const isPremiseForm = (premise: Premise, form: PremiseForm) =>
  premise.form === form;

// Updated premisesEqual to check all equivalent forms
const premisesEqual = (p1: Premise, p2: Premise): boolean => {
  const equiv1 = getEquivalents(p1);
  const equiv2 = getEquivalents(p2);

  // Check if any equivalent form of p1 matches any equivalent form of p2
  for (const e1 of equiv1) {
    for (const e2 of equiv2) {
      const directEqual =
        e1.premise.form === e2.premise.form &&
        e1.premise.subject === e2.premise.subject &&
        e1.premise.predicate === e2.premise.predicate;

      if (directEqual) return true;
    }
  }
  return false;
};

// Updated isPremiseSeen to handle transform tracking
const isPremiseSeen = (premise: Premise, seenPremises: Set<string>): boolean => {
  const equivalents = getEquivalents(premise);
  for (const eq of equivalents) {
    const eqStr = `${eq.premise.form}:${eq.premise.subject}:${eq.premise.predicate}`;
    if (seenPremises.has(eqStr)) return true;
  }
  for (const eq of equivalents) {
    seenPremises.add(`${eq.premise.form}:${eq.premise.subject}:${eq.premise.predicate}`);
  }
  return false;
};

// Helper to find transformation path between two premises
const findTransformPath = (source: Premise, target: Premise): Array<{ rule: string; result: Premise }> | null => {
  const sourceEquivs = getEquivalents(source);
  for (const equiv of sourceEquivs) {
    if (premisesEqual(equiv.premise, target)) {
      return equiv.transforms;
    }
  }
  return null;
};

export const evaluateSyllogism = (argument: Argument): Proof => {
  const steps: ProofStep[] = [];
  const seenPremises = new Set<string>();
  let stepNumber = 1;

  // Track which steps were used in deriving the conclusion
  const usedSteps = new Set<number>();

  // Add initial premises
  argument.premises.forEach((premise) => {
    const normalized = normalizePremise(premise);
    if (!isPremiseSeen(normalized, seenPremises)) {
      steps.push({
        number: stepNumber++,
        premise: normalized,
        rule: "Premise",
      });
    }
  });

  if (!argument.conclusion) {
    return {
      steps,
      isValid: false,
      explanation: "No conclusion provided to evaluate.",
    };
  }

  const normalizedConclusion = normalizePremise(argument.conclusion);

  // Helper to try deriving new conclusions from a pair of premises
  const tryDerivingNewConclusions = (p1Index: number, p2Index: number) => {
    const results: Array<{
      premise: Premise;
      rule: string;
      fromSteps: number[];
      transforms?: Array<{ rule: string; result: Premise }>;
    }> = [];

    const p1 = steps[p1Index].premise;
    const p2 = steps[p2Index].premise;

    // Try all equivalent forms for Barbara
    const equiv1 = getEquivalents(p1);
    const equiv2 = getEquivalents(p2);

    for (const e1 of equiv1) {
      for (const e2 of equiv2) {
        if (e1.premise.form === "A" && e2.premise.form === "A" && 
            e1.premise.predicate === e2.premise.subject) {
          const conclusion = normalizePremise({
            form: "A",
            subject: e1.premise.subject,
            predicate: e2.premise.predicate,
          });

          if (!isPremiseSeen(conclusion, seenPremises)) {
            results.push({
              premise: conclusion,
              rule: "Barbara",
              fromSteps: [p1Index + 1, p2Index + 1],
              transforms: [...e1.transforms, ...e2.transforms]
            });
          }
        }
      }
    }

    // Similarly for Darii
    for (const e1 of equiv1) {
      for (const e2 of equiv2) {
        if (e1.premise.form === "A" && e2.premise.form === "I" &&
            e1.premise.subject === e2.premise.subject) {
          const conclusion = normalizePremise({
            form: "I",
            subject: e2.premise.subject,
            predicate: e1.premise.predicate,
          });

          if (!isPremiseSeen(conclusion, seenPremises)) {
            results.push({
              premise: conclusion,
              rule: "Darii",
              fromSteps: [p1Index + 1, p2Index + 1],
              transforms: [...e1.transforms, ...e2.transforms]
            });
          }
        }
      }
    }

    return results;
  };

  // Main derivation loop
  let madeProgress;
  do {
    madeProgress = false;
    const currentLength = steps.length;

    for (let i = 0; i < currentLength && stepNumber <= MAX_STEPS; i++) {
      if (premisesEqual(steps[i].premise, normalizedConclusion)) {
        // Found the conclusion - mark all steps in the path
        let current = i;
        while (current >= 0) {
          usedSteps.add(steps[current].number);
          if (steps[current].fromSteps) {
            steps[current].fromSteps.forEach(step => {
              usedSteps.add(step);
            });
          }
          current--;
        }
        break;
      }

      for (let j = i + 1; j < currentLength && stepNumber <= MAX_STEPS; j++) {
        const newConclusions = tryDerivingNewConclusions(i, j);

        for (const conclusion of newConclusions) {
          // Add any necessary transformation steps first
          if (conclusion.transforms && conclusion.transforms.length > 0) {
            conclusion.transforms.forEach(transform => {
              steps.push({
                number: stepNumber++,
                premise: transform.result,
                rule: transform.rule,
                fromSteps: [conclusion.fromSteps[conclusion.transforms!.indexOf(transform)]],
              });
            });
          }

          // Then add the derived conclusion
          steps.push({
            number: stepNumber++,
            premise: conclusion.premise,
            rule: conclusion.rule,
            fromSteps: conclusion.fromSteps,
          });

          madeProgress = true;
        }
      }
    }
  } while (madeProgress && stepNumber <= MAX_STEPS);

  const isValid = steps.some(step => premisesEqual(step.premise, normalizedConclusion));
  const finalSteps = isValid
    ? steps.filter(step => usedSteps.has(step.number))
    : steps;

  return {
    steps: finalSteps,
    isValid,
    explanation: isValid
      ? "The conclusion follows from the premises using valid syllogistic rules."
      : stepNumber > MAX_STEPS
      ? "Evaluation stopped: too many steps generated. The conclusion might not follow from the premises."
      : "The conclusion does not follow from the premises using the available rules.",
  };
};