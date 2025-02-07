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
const premisesEqual = (p1: Premise, p2: Premise) =>
  p1.form === p2.form &&
  normalizeTerm(p1.subject) === normalizeTerm(p2.subject) &&
  normalizeTerm(p1.predicate) === normalizeTerm(p2.predicate);

// Helper to normalize a premise
const normalizePremise = (premise: Premise): Premise => ({
  ...premise,
  subject: normalizeTerm(premise.subject),
  predicate: normalizeTerm(premise.predicate),
});

// Apply obversion rules
const applyObversion = (premise: Premise): Premise => {
  const normalized = normalizePremise(premise);
  switch (normalized.form) {
    case "A": return { ...normalized, form: "E", predicate: `non-${normalized.predicate}` };
    case "E": return { ...normalized, form: "A", predicate: `non-${normalized.predicate}` };
    case "I": return { ...normalized, form: "O", predicate: `non-${normalized.predicate}` };
    case "O": return { ...normalized, form: "I", predicate: `non-${normalized.predicate}` };
    default: return normalized;
  }
};

// Apply conversion rules for E and I statements
const applyConversion = (premise: Premise): Premise | null => {
  if (isPremiseForm(premise, "E") || isPremiseForm(premise, "I")) {
    const normalized = normalizePremise(premise);
    return {
      ...normalized,
      subject: normalized.predicate,
      predicate: normalized.subject,
    };
  }
  return null;
};

// Apply contraposition rules for A and O statements
const applyContraposition = (premise: Premise): Premise | null => {
  if (isPremiseForm(premise, "A") || isPremiseForm(premise, "O")) {
    const normalized = normalizePremise(premise);
    return {
      ...normalized,
      subject: `non-${normalized.predicate}`,
      predicate: `non-${normalized.subject}`,
    };
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
      subject: n2.subject,
      predicate: n1.predicate,
    };
  }
  return null;
};

// Check if Darii syllogism is applicable
const checkDarii = (p1: Premise, p2: Premise): Premise | null => {
  const n1 = normalizePremise(p1);
  const n2 = normalizePremise(p2);
  if (isPremiseForm(n1, "A") && isPremiseForm(n2, "I") && n1.predicate === n2.subject) {
    return {
      form: "I",
      subject: n2.subject,
      predicate: n1.predicate,
    };
  }
  return null;
};

const MAX_STEPS = 50; // Reduced from 100 to prevent excessive computation
const MAX_TERM_LENGTH = 100; // Prevent extremely long terms

export const evaluateSyllogism = (argument: Argument): Proof => {
  const steps: ProofStep[] = [];
  const seenPremises = new Set<string>(); // Track unique premises
  let stepNumber = 1;

  // Helper to check if a premise has been seen before
  const isPremiseSeen = (premise: Premise): boolean => {
    const normalized = normalizePremise(premise);
    const premiseStr = `${normalized.form}:${normalized.subject}:${normalized.predicate}`;
    if (seenPremises.has(premiseStr)) return true;

    // Prevent extremely long terms
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

  // Early return if no conclusion to check
  if (!argument.conclusion) {
    return {
      steps,
      isValid: false,
      explanation: "No conclusion provided to evaluate.",
    };
  }

  // Normalize the conclusion for comparison
  const normalizedConclusion = normalizePremise(argument.conclusion);

  // Function to check if we found the conclusion
  const conclusionFound = () => steps.some(step => 
    premisesEqual(step.premise, normalizedConclusion)
  );

  // Apply rules and track new conclusions
  for (let i = 0; i < steps.length && stepNumber <= MAX_STEPS; i++) {
    // Check if we already found the conclusion
    if (conclusionFound()) break;

    for (let j = i + 1; j < steps.length && stepNumber <= MAX_STEPS; j++) {
      // Try Barbara
      const barbara = checkBarbara(steps[i].premise, steps[j].premise);
      if (barbara && !isPremiseSeen(barbara)) {
        steps.push({
          number: stepNumber++,
          premise: barbara,
          rule: "Barbara",
          fromSteps: [steps[i].number, steps[j].number],
        });
      }

      // Try Darii
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

  return {
    steps,
    isValid,
    explanation: isValid 
      ? "The conclusion follows from the premises using valid syllogistic rules."
      : stepNumber > MAX_STEPS 
        ? "Evaluation stopped: too many steps generated. The conclusion might not follow from the premises."
        : "The conclusion does not follow from the premises using the available rules.",
  };
};