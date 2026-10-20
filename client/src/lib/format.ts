import { PremiseForm, type Premise } from "@shared/schema";

/** The four categorical statement forms, in the order the editor offers them. */
export const STATEMENT_FORMS: ReadonlyArray<{
  form: PremiseForm;
  /** Option label in the form selector. */
  label: string;
  /** Pattern with S (subject) and P (predicate). */
  pattern: string;
  name: string;
}> = [
  { form: PremiseForm.A, label: "All (A)", pattern: "All S are P", name: "Universal affirmative" },
  { form: PremiseForm.E, label: "No (E)", pattern: "No S are P", name: "Universal negative" },
  { form: PremiseForm.I, label: "Some (I)", pattern: "Some S are P", name: "Particular affirmative" },
  { form: PremiseForm.O, label: "Some … not (O)", pattern: "Some S are not P", name: "Particular negative" },
];

/** The verb between subject and predicate for a form ("are" or "are not"). */
export function copulaFor(form: PremiseForm): string {
  return form === PremiseForm.O ? "are not" : "are";
}

/** The quantifier that opens a statement of this form. */
export function quantifierFor(form: PremiseForm): string {
  switch (form) {
    case PremiseForm.A:
      return "All";
    case PremiseForm.E:
      return "No";
    default:
      return "Some";
  }
}

/**
 * Plain-English reading of a statement, e.g. `All Greeks are mortal`.
 * Blank terms are shown as S or P so a half-filled row still reads sensibly.
 */
export function formatStatement(premise: Premise): string {
  const subject = premise.subject.trim() || "S";
  const predicate = premise.predicate.trim() || "P";
  return `${quantifierFor(premise.form)} ${subject} ${copulaFor(premise.form)} ${predicate}`;
}
