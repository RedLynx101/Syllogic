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

// Given a premise, return all 4 equivalent forms
const getEquivalents = (premise: Premise): Premise[] => {
  const norm = normalizePremise(premise);
  switch (norm.form) {
    case "A":
      return [
        // Original: All p are q
        norm,
        // Obverse: No p are non-q
        { ...norm, form: "E", predicate: `non-${norm.predicate}` },
        // Contrapositive: All non-q are non-p
        { ...norm, subject: `non-${norm.predicate}`, predicate: `non-${norm.subject}`, form: "A" },
        // Obverse of contrapositive: No non-q are p
        { ...norm, subject: `non-${norm.predicate}`, predicate: norm.subject, form: "E" },
      ].map(normalizePremise);
    case "E":
      return [
        // Original: No p are q
        norm,
        // Obverse: All p are non-q
        { ...norm, form: "A", predicate: `non-${norm.predicate}` },
        // Converse: No q are p
        { ...norm, subject: norm.predicate, predicate: norm.subject, form: "E" },
        // Obverse of converse: All q are non-p
        { ...norm, subject: norm.predicate, predicate: `non-${norm.subject}`, form: "A" },
      ].map(normalizePremise);
    case "I":
      return [
        // Original: Some p are q
        norm,
        // Obverse: Some p are not non-q
        { ...norm, form: "O", predicate: `non-${norm.predicate}` },
        // Converse: Some q are p
        { ...norm, subject: norm.predicate, predicate: norm.subject, form: "I" },
        // Obverse of converse: Some q are not non-p
        { ...norm, subject: norm.predicate, predicate: `non-${norm.subject}`, form: "O" },
      ].map(normalizePremise);
    case "O":
      return [
        // Original: Some p are not q
        norm,
        // Obverse: Some p are non-q
        { ...norm, form: "I", predicate: `non-${norm.predicate}` },
        // Contrapositive: Some non-q are p
        { ...norm, subject: `non-${norm.predicate}`, predicate: norm.subject, form: "O" },
        // Obverse of contrapositive: Some non-q are non-p
        { ...norm, subject: `non-${norm.predicate}`, predicate: `non-${norm.subject}`, form: "I" },
      ].map(normalizePremise);
    default:
      return [norm];
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
        e1.form === e2.form &&
        e1.subject === e2.subject &&
        e1.predicate === e2.predicate;

      // For I statements, also check conversion equality
      const iConversionEqual =
        e1.form === "I" &&
        e2.form === "I" &&
        e1.subject === e2.predicate &&
        e1.predicate === e2.subject;

      if (directEqual || iConversionEqual) {
        return true;
      }
    }
  }
  return false;
};

// Updated check for Barbara that uses equivalents and is order-agnostic
const checkBarbaraWithEquivalents = (p1: Premise, p2: Premise): Premise | null => {
  const equiv1 = getEquivalents(p1);
  const equiv2 = getEquivalents(p2);

  // Try both orderings of the premises with their equivalents
  for (const e1 of equiv1) {
    for (const e2 of equiv2) {
      // Try first ordering: e1 -> e2
      if (e1.form === "A" && e2.form === "A" && e1.predicate === e2.subject) {
        return normalizePremise({
          form: "A",
          subject: e1.subject,
          predicate: e2.predicate,
        });
      }
      // Try reverse ordering: e2 -> e1
      if (e2.form === "A" && e1.form === "A" && e2.predicate === e1.subject) {
        return normalizePremise({
          form: "A",
          subject: e2.subject,
          predicate: e1.predicate,
        });
      }
    }
  }
  return null;
};

// Updated check for Darii that uses equivalents and is order-agnostic
const checkDariiWithEquivalents = (p1: Premise, p2: Premise): Premise | null => {
  const equiv1 = getEquivalents(p1);
  const equiv2 = getEquivalents(p2);

  // Try both orderings of the premises with their equivalents
  for (const e1 of equiv1) {
    for (const e2 of equiv2) {
      // Try first ordering: A premise -> I premise
      if (e1.form === "A" && e2.form === "I" && e1.subject === e2.subject) {
        return normalizePremise({
          form: "I",
          subject: e2.subject,
          predicate: e1.predicate,
        });
      }
      // Try reverse ordering: I premise -> A premise
      if (e2.form === "A" && e1.form === "I" && e2.subject === e1.subject) {
        return normalizePremise({
          form: "I",
          subject: e1.subject,
          predicate: e2.predicate,
        });
      }
    }
  }
  return null;
};

const MAX_STEPS = 500;
const MAX_TERM_LENGTH = 100;

// Updated isPremiseSeen to check all equivalent forms
const isPremiseSeen = (premise: Premise, seenPremises: Set<string>): boolean => {
  const equivalents = getEquivalents(premise);
  for (const eq of equivalents) {
    const eqStr = `${eq.form}:${eq.subject}:${eq.predicate}`;
    if (seenPremises.has(eqStr)) return true;
  }
  for (const eq of equivalents) {
    seenPremises.add(`${eq.form}:${eq.subject}:${eq.predicate}`);
  }
  return false;
};

export const evaluateSyllogism = (argument: Argument): Proof => {
  const steps: ProofStep[] = [];
  const seenPremises = new Set<string>();
  let stepNumber = 1;

  // Track which steps were used in deriving the conclusion
  const usedSteps = new Set<number>();

  // Add initial premises (and for each, add all equivalents to our seen set)
  argument.premises.forEach((premise) => {
    const equivalents = getEquivalents(premise);
    equivalents.forEach((eq) => {
      if (!isPremiseSeen(eq, seenPremises)) {
        steps.push({
          number: stepNumber++,
          premise: eq,
          rule: "Premise",
        });
      }
    });
  });

  if (!argument.conclusion) {
    return {
      steps,
      isValid: false,
      explanation: "No conclusion provided to evaluate.",
    };
  }

  const normalizedConclusion = normalizePremise(argument.conclusion);

  // Helper to mark steps as used
  const markStepsAsUsed = (step: ProofStep) => {
    usedSteps.add(step.number);
    if (step.fromSteps) {
      step.fromSteps.forEach((num) => {
        usedSteps.add(num);
        steps.filter((s) => s.number === num).forEach(markStepsAsUsed);
      });
    }
  };

  const conclusionFound = (): boolean => {
    // Check each derived step against all equivalent forms of the conclusion
    const found = steps.find((step) => premisesEqual(step.premise, normalizedConclusion));
    if (found) {
      markStepsAsUsed(found);
      return true;
    }
    return false;
  };

  // Helper to try deriving new conclusions from a pair of premises
  const tryDerivingNewConclusions = (p1Index: number, p2Index: number) => {
    const newConclusions: { premise: Premise; rule: string; fromSteps: number[] }[] = [];

    // Try Barbara with both orderings
    const barbara = checkBarbaraWithEquivalents(steps[p1Index].premise, steps[p2Index].premise);
    if (barbara && !isPremiseSeen(barbara, seenPremises)) {
      newConclusions.push({
        premise: barbara,
        rule: "Barbara",
        fromSteps: [steps[p1Index].number, steps[p2Index].number],
      });
    }

    // Try Darii with both orderings
    const darii = checkDariiWithEquivalents(steps[p1Index].premise, steps[p2Index].premise);
    if (darii && !isPremiseSeen(darii, seenPremises)) {
      newConclusions.push({
        premise: darii,
        rule: "Darii",
        fromSteps: [steps[p1Index].number, steps[p2Index].number],
      });
    }

    return newConclusions;
  };

  let lastCheckedIndex = 0;
  let madeProgress;

  do {
    madeProgress = false;
    const currentLength = steps.length;

    // Try all pairs of existing steps
    for (let i = 0; i < currentLength; i++) {
      if (conclusionFound()) break;

      for (let j = i + 1; j < currentLength; j++) {
        const newConclusions = tryDerivingNewConclusions(i, j);

        for (const conclusion of newConclusions) {
          steps.push({
            number: stepNumber++,
            ...conclusion
          });
          madeProgress = true;

          // Check if this new conclusion leads directly to the target conclusion
          if (conclusionFound()) break;
        }

        if (conclusionFound()) break;
      }

      if (conclusionFound()) break;
    }

    // If we've made progress, we need to check the new conclusions 
    // against all existing premises in the next iteration
    lastCheckedIndex = currentLength;
  } while (madeProgress && stepNumber <= MAX_STEPS);

  const isValid = conclusionFound();
  const finalSteps = isValid
    ? steps.filter((s) => usedSteps.has(s.number))
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