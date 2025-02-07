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

// Helper to check if two premises are equal
const premisesEqual = (p1: Premise, p2: Premise): boolean => {
  const n1 = normalizePremise(p1);
  const n2 = normalizePremise(p2);

  // Direct equality check
  const directEqual =
    n1.form === n2.form &&
    n1.subject === n2.subject &&
    n1.predicate === n2.predicate;

  // For I statements, check conversion equality as well
  const iConversionEqual =
    n1.form === "I" &&
    n2.form === "I" &&
    n1.subject === n2.predicate &&
    n1.predicate === n2.subject;

  return directEqual || iConversionEqual;
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
          subject: e2.predicate,
          predicate: e1.predicate,
        });
      }
      // Try reverse ordering: I premise -> A premise
      if (e2.form === "A" && e1.form === "I" && e2.subject === e1.subject) {
        return normalizePremise({
          form: "I",
          subject: e1.predicate,
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
    const found = steps.find((s) => {
      return premisesEqual(s.premise, normalizedConclusion);
    });
    if (found) {
      markStepsAsUsed(found);
      return true;
    }
    return false;
  };

  for (let i = 0; i < steps.length && stepNumber <= MAX_STEPS; i++) {
    if (conclusionFound()) break;

    for (let j = i + 1; j < steps.length && stepNumber <= MAX_STEPS; j++) {
      // Try Barbara using equivalent forms
      const barbara = checkBarbaraWithEquivalents(steps[i].premise, steps[j].premise);
      if (barbara && !isPremiseSeen(barbara, seenPremises)) {
        steps.push({
          number: stepNumber++,
          premise: barbara,
          rule: "Barbara",
          fromSteps: [steps[i].number, steps[j].number],
        });
      }

      // Try Darii using equivalent forms
      const darii = checkDariiWithEquivalents(steps[i].premise, steps[j].premise);
      if (darii && !isPremiseSeen(darii, seenPremises)) {
        steps.push({
          number: stepNumber++,
          premise: darii,
          rule: "Darii",
          fromSteps: [steps[i].number, steps[j].number],
        });
      }

      if (conclusionFound()) break;
    }

    if (conclusionFound()) break;
  }

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