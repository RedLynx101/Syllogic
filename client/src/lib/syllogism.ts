import { Argument, Premise, PremiseForm, Proof, ProofStep } from "@shared/schema";

// Helper to check if a premise is in a specific form
const isPremiseForm = (premise: Premise, form: PremiseForm) => premise.form === form;

// Helper to check if two premises are equal
const premisesEqual = (p1: Premise, p2: Premise) =>
  p1.form === p2.form &&
  p1.subject === p2.subject &&
  p1.predicate === p2.predicate;

// Apply obversion rules
const applyObversion = (premise: Premise): Premise => {
  switch (premise.form) {
    case "A": return { ...premise, form: "E", predicate: `non-${premise.predicate}` };
    case "E": return { ...premise, form: "A", predicate: `non-${premise.predicate}` };
    case "I": return { ...premise, form: "O", predicate: `non-${premise.predicate}` };
    case "O": return { ...premise, form: "I", predicate: `non-${premise.predicate}` };
    default: return premise;
  }
};

// Apply conversion rules for E and I statements
const applyConversion = (premise: Premise): Premise | null => {
  if (isPremiseForm(premise, "E") || isPremiseForm(premise, "I")) {
    return {
      ...premise,
      subject: premise.predicate,
      predicate: premise.subject,
    };
  }
  return null;
};

// Apply contraposition rules for A and O statements
const applyContraposition = (premise: Premise): Premise | null => {
  if (isPremiseForm(premise, "A") || isPremiseForm(premise, "O")) {
    return {
      ...premise,
      subject: `non-${premise.predicate}`,
      predicate: `non-${premise.subject}`,
    };
  }
  return null;
};

// Check if Barbara syllogism is applicable
const checkBarbara = (p1: Premise, p2: Premise): Premise | null => {
  if (isPremiseForm(p1, "A") && isPremiseForm(p2, "A") && p1.predicate === p2.subject) {
    return {
      form: "A",
      subject: p2.subject,
      predicate: p1.predicate,
    };
  }
  return null;
};

// Check if Darii syllogism is applicable
const checkDarii = (p1: Premise, p2: Premise): Premise | null => {
  if (isPremiseForm(p1, "A") && isPremiseForm(p2, "I") && p1.predicate === p2.subject) {
    return {
      form: "I",
      subject: p2.subject,
      predicate: p1.predicate,
    };
  }
  return null;
};

const MAX_STEPS = 100; // Prevent infinite loops

export const evaluateSyllogism = (argument: Argument): Proof => {
  const steps: ProofStep[] = [];
  const seenPremises = new Set<string>(); // Track unique premises
  let stepNumber = 1;

  // Helper to check if a premise has been seen before
  const isPremiseSeen = (premise: Premise): boolean => {
    const premiseStr = `${premise.form}:${premise.subject}:${premise.predicate}`;
    if (seenPremises.has(premiseStr)) return true;
    seenPremises.add(premiseStr);
    return false;
  };

  // Add initial premises as steps
  argument.premises.forEach(premise => {
    if (!isPremiseSeen(premise)) {
      steps.push({
        number: stepNumber++,
        premise,
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

  // Function to check if we found the conclusion
  const conclusionFound = () => steps.some(step => 
    premisesEqual(step.premise, argument.conclusion!)
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
    if (!isPremiseSeen(obversion)) {
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