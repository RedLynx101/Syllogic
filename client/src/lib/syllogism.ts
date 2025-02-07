import { Argument, Premise, PremiseForm, Proof, ProofStep } from "@shared/schema";

// Normalize terms by reducing multiple negations
const normalizeTerm = (term: string): string => {
  const matches = term.match(/^(non-)+/);
  if (!matches) return term;
  const nonCount = matches[0].split("non-").length - 1;
  const baseTerm = term.replace(/^(non-)+/, "");
  return nonCount % 2 === 0 ? baseTerm : `non-${baseTerm}`;
};

// Helper to check if a premise is in a specific form
const isPremiseForm = (premise: Premise, form: PremiseForm) => premise.form === form;

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

// Helper to normalize a premise
const normalizePremise = (premise: Premise): Premise => ({
  ...premise,
  subject: normalizeTerm(premise.subject),
  predicate: normalizeTerm(premise.predicate),
});

// Apply obversion rules
const applyObversion = (premise: Premise): Premise => {
  const normalized = normalizePremise(premise);
  let newPremise;
  switch (normalized.form) {
    case "A":
      newPremise = { ...normalized, form: "E", predicate: `non-${normalized.predicate}` };
      break;
    case "E":
      newPremise = { ...normalized, form: "A", predicate: `non-${normalized.predicate}` };
      break;
    case "I":
      newPremise = { ...normalized, form: "O", predicate: `non-${normalized.predicate}` };
      break;
    case "O":
      newPremise = { ...normalized, form: "I", predicate: `non-${normalized.predicate}` };
      break;
    default:
      newPremise = normalized;
  }
  return normalizePremise(newPremise);
};

// Apply conversion rules for E and I statements
const applyConversion = (premise: Premise): Premise | null => {
  if (isPremiseForm(premise, "E") || isPremiseForm(premise, "I")) {
    const normalized = normalizePremise(premise);
    const newPremise = {
      ...normalized,
      subject: normalized.predicate,
      predicate: normalized.subject,
    };
    return normalizePremise(newPremise);
  }
  return null;
};

// Apply contraposition rules for A and O statements
const applyContraposition = (premise: Premise): Premise | null => {
  if (isPremiseForm(premise, "A") || isPremiseForm(premise, "O")) {
    const normalized = normalizePremise(premise);
    const newPremise = {
      ...normalized,
      subject: `non-${normalized.predicate}`,
      predicate: `non-${normalized.subject}`,
    };
    return normalizePremise(newPremise);
  }
  return null;
};

// Check if Barbara syllogism is applicable
const checkBarbara = (p1: Premise, p2: Premise): Premise | null => {
  const n1 = normalizePremise(p1);
  const n2 = normalizePremise(p2);
  if (isPremiseForm(n1, "A") && isPremiseForm(n2, "A") && n1.predicate === n2.subject) {
    return {
      form: "A",
      subject: n1.subject,     // Use subject from the first premise
      predicate: n2.predicate, // Use predicate from the second premise
    };
  }
  return null;
};

// Check if Darii syllogism is applicable
const checkDarii = (p1: Premise, p2: Premise): Premise | null => {
  const n1 = normalizePremise(p1);
  const n2 = normalizePremise(p2);

  // Try: n1 is A and n2 is I and they share the same subject
  if (isPremiseForm(n1, "A") && isPremiseForm(n2, "I") && n1.subject === n2.subject) {
    // Conclusion: Some [n2.predicate] are [n1.predicate]
    return normalizePremise({
      form: "I",
      subject: n2.predicate,   // Minor term from the I-premise
      predicate: n1.predicate, // Major term from the A-premise
    });
  }

  // Try the reverse: n2 is A and n1 is I
  if (isPremiseForm(n2, "A") && isPremiseForm(n1, "I") && n2.subject === n1.subject) {
    return normalizePremise({
      form: "I",
      subject: n1.predicate,
      predicate: n2.predicate,
    });
  }

  return null;
};

const MAX_STEPS = 50;
const MAX_TERM_LENGTH = 100;

export const evaluateSyllogism = (argument: Argument): Proof => {
  const steps: ProofStep[] = [];
  const seenPremises = new Set<string>();
  let stepNumber = 1;

  // Track which steps were used to derive the conclusion
  const usedSteps = new Set<number>();

  const isPremiseSeen = (premise: Premise): boolean => {
    const normalized = normalizePremise(premise);
    const premiseStr = `${normalized.form}:${normalized.subject}:${normalized.predicate}`;
    if (seenPremises.has(premiseStr)) return true;

    if (normalized.subject.length > MAX_TERM_LENGTH ||
      normalized.predicate.length > MAX_TERM_LENGTH) {
      return true;
    }

    seenPremises.add(premiseStr);
    return false;
  };

  // Add initial premises as steps
  argument.premises.forEach(premise => {
    const normalized = normalizePremise(premise);
    if (!isPremiseSeen(normalized)) {
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

  // Helper to track steps used in deriving a conclusion
  const markStepsAsUsed = (step: ProofStep) => {
    usedSteps.add(step.number);
    if (step.fromSteps) {
      step.fromSteps.forEach(fromStep => {
        usedSteps.add(fromStep);
        // Recursively mark steps that led to the fromSteps
        steps.filter(s => s.number === fromStep).forEach(markStepsAsUsed);
      });
    }
  };

  const conclusionFound = () => {
    const foundStep = steps.find(step => premisesEqual(step.premise, normalizedConclusion));
    if (foundStep) {
      markStepsAsUsed(foundStep);
      return true;
    }
    return false;
  };

  for (let i = 0; i < steps.length && stepNumber <= MAX_STEPS; i++) {
    if (conclusionFound()) break;

    for (let j = i + 1; j < steps.length && stepNumber <= MAX_STEPS; j++) {
      const barbara = checkBarbara(steps[i].premise, steps[j].premise);
      if (barbara && !isPremiseSeen(barbara)) {
        steps.push({
          number: stepNumber++,
          premise: barbara,
          rule: "Barbara",
          fromSteps: [steps[i].number, steps[j].number],
        });
      }

      const darii = checkDarii(steps[i].premise, steps[j].premise);
      if (darii && !isPremiseSeen(darii)) {
        steps.push({
          number: stepNumber++,
          premise: darii,
          rule: "Darii",
          fromSteps: [steps[i].number, steps[j].number],
        });
      }

      if (conclusionFound()) break;
    }

    // Try single premise rules
    const obversion = applyObversion(steps[i].premise);
    if (obversion && !isPremiseSeen(obversion)) {
      steps.push({
        number: stepNumber++,
        premise: obversion,
        rule: "Obversion",
        fromSteps: [steps[i].number],
      });
    }

    const conversion = applyConversion(steps[i].premise);
    if (conversion && !isPremiseSeen(conversion)) {
      steps.push({
        number: stepNumber++,
        premise: conversion,
        rule: "Conversion",
        fromSteps: [steps[i].number],
      });
    }

    const contraposition = applyContraposition(steps[i].premise);
    if (contraposition && !isPremiseSeen(contraposition)) {
      steps.push({
        number: stepNumber++,
        premise: contraposition,
        rule: "Contraposition",
        fromSteps: [steps[i].number],
      });
    }

    if (conclusionFound()) break;
  }

  const isValid = conclusionFound();

  // For valid proofs, only include steps that were used to derive the conclusion
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