import { Argument, Premise, PremiseForm, Proof, ProofStep } from "@shared/schema";

// Helper to check if a premise is in a specific form
const isPremiseForm = (premise: Premise, form: PremiseForm) => premise.form === form;

// Apply obversion rules
const applyObversion = (premise: Premise): Premise => {
  if (isPremiseForm(premise, "A")) {
    return { ...premise, form: "E", predicate: `non-${premise.predicate}` };
  }
  if (isPremiseForm(premise, "E")) {
    return { ...premise, form: "A", predicate: `non-${premise.predicate}` };
  }
  if (isPremiseForm(premise, "I")) {
    return { ...premise, form: "O", predicate: `non-${premise.predicate}` };
  }
  if (isPremiseForm(premise, "O")) {
    return { ...premise, form: "I", predicate: `non-${premise.predicate}` };
  }
  return premise;
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

export const evaluateSyllogism = (argument: Argument): Proof => {
  const steps: ProofStep[] = [];
  let stepNumber = 1;

  // Add initial premises as steps
  argument.premises.forEach(premise => {
    steps.push({
      number: stepNumber++,
      premise,
      rule: "Premise",
    });
  });

  // Apply rules and track new conclusions
  for (let i = 0; i < steps.length; i++) {
    for (let j = i + 1; j < steps.length; j++) {
      // Try Barbara
      const barbara = checkBarbara(steps[i].premise, steps[j].premise);
      if (barbara) {
        steps.push({
          number: stepNumber++,
          premise: barbara,
          rule: "Barbara",
          fromSteps: [steps[i].number, steps[j].number],
        });
      }

      // Try Darii
      const darii = checkDarii(steps[i].premise, steps[j].premise);
      if (darii) {
        steps.push({
          number: stepNumber++,
          premise: darii,
          rule: "Darii",
          fromSteps: [steps[i].number, steps[j].number],
        });
      }
    }

    // Try single premise rules
    const obversion = applyObversion(steps[i].premise);
    if (obversion) {
      steps.push({
        number: stepNumber++,
        premise: obversion,
        rule: "Obversion",
        fromSteps: [steps[i].number],
      });
    }

    const conversion = applyConversion(steps[i].premise);
    if (conversion) {
      steps.push({
        number: stepNumber++,
        premise: conversion,
        rule: "Conversion",
        fromSteps: [steps[i].number],
      });
    }

    const contraposition = applyContraposition(steps[i].premise);
    if (contraposition) {
      steps.push({
        number: stepNumber++,
        premise: contraposition,
        rule: "Contraposition",
        fromSteps: [steps[i].number],
      });
    }
  }

  // Check if conclusion is valid
  let isValid = false;
  if (argument.conclusion) {
    isValid = steps.some(step => 
      step.premise.form === argument.conclusion?.form &&
      step.premise.subject === argument.conclusion?.subject &&
      step.premise.predicate === argument.conclusion?.predicate
    );
  }

  return {
    steps,
    isValid,
    explanation: isValid 
      ? "The conclusion follows from the premises using valid syllogistic rules."
      : "The conclusion does not follow from the premises using the available rules.",
  };
};
