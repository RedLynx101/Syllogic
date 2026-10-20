import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { PremiseForm, type Premise } from "@shared/schema";
import { STATEMENT_FORMS, copulaFor, formatStatement } from "@/lib/format";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface PremiseInputProps {
  value: Premise;
  onChange: (premise: Premise) => void;
  /** Visible name of the row, e.g. "Premise 1" or "Conclusion". */
  label: string;
  onRemove?: () => void;
  disabled?: boolean;
  /** Highlight blank terms (set after a failed Evaluate/Save attempt). */
  showErrors?: boolean;
}

const NEGATION = /^non-/;

interface TermFieldProps {
  id: string;
  label: string;
  role: "subject" | "predicate";
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid: boolean;
  errorId: string;
}

/** One term: a "non-" toggle for the complement, plus the term itself. */
function TermField({ id, label, role, value, onChange, disabled, invalid, errorId }: TermFieldProps) {
  const negated = NEGATION.test(value);
  const bare = value.replace(NEGATION, "");

  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="flex gap-1.5">
        <Toggle
          variant="outline"
          size="sm"
          pressed={negated}
          onPressedChange={(on) => onChange(on ? `non-${bare}` : bare)}
          disabled={disabled}
          aria-label={`non- (use the complement of the ${role})`}
          title={`Use the complement of the ${role}, e.g. non-${bare || role}`}
          className="h-10 shrink-0 px-2 font-mono text-xs data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          non-
        </Toggle>
        <Input
          id={id}
          value={bare}
          onChange={(e) => onChange(negated ? `non-${e.target.value}` : e.target.value)}
          placeholder={role === "subject" ? "e.g. Greeks" : "e.g. mortal"}
          disabled={disabled}
          maxLength={96}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          className={cn("min-w-0", invalid && "border-destructive focus-visible:ring-destructive")}
        />
      </div>
    </div>
  );
}

export function PremiseInput({ value, onChange, label, onRemove, disabled, showErrors }: PremiseInputProps) {
  const id = useId();
  const headingId = `${id}-label`;
  const errorId = `${id}-error`;
  const subjectMissing = !!showErrors && value.subject.replace(NEGATION, "").trim() === "";
  const predicateMissing = !!showErrors && value.predicate.replace(NEGATION, "").trim() === "";

  return (
    <div role="group" aria-labelledby={headingId} className="rounded-lg border bg-muted/30 p-3">
      <div className="mb-1.5 flex min-h-8 items-center justify-between gap-2">
        <span id={headingId} className="text-sm font-semibold">
          {label}
        </span>
        {onRemove && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-8 px-2 text-muted-foreground hover:text-foreground"
            aria-label={`Remove ${label.toLowerCase()}`}
          >
            <X aria-hidden="true" />
            <span className="hidden sm:inline">Remove</span>
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-[9.5rem_minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end sm:gap-2">
        <div className="space-y-1.5">
          <label htmlFor={`${id}-form`} className="text-xs font-medium text-muted-foreground">
            Form
          </label>
          <Select
            value={value.form}
            onValueChange={(form) => onChange({ ...value, form: form as PremiseForm })}
            disabled={disabled}
          >
            <SelectTrigger id={`${id}-form`} className="w-full">
              <SelectValue placeholder="Form" />
            </SelectTrigger>
            <SelectContent>
              {STATEMENT_FORMS.map(({ form, label: optionLabel, pattern }) => (
                <SelectItem key={form} value={form}>
                  <span>{optionLabel}</span>
                  <span className="sr-only">: {pattern}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <TermField
          id={`${id}-subject`}
          label="Subject (S)"
          role="subject"
          value={value.subject}
          onChange={(subject) => onChange({ ...value, subject })}
          disabled={disabled}
          invalid={subjectMissing}
          errorId={errorId}
        />

        <span
          className="flex h-10 items-center justify-center whitespace-nowrap px-1 text-sm text-muted-foreground max-sm:hidden"
          aria-hidden="true"
        >
          {copulaFor(value.form)}
        </span>

        <TermField
          id={`${id}-predicate`}
          label="Predicate (P)"
          role="predicate"
          value={value.predicate}
          onChange={(predicate) => onChange({ ...value, predicate })}
          disabled={disabled}
          invalid={predicateMissing}
          errorId={errorId}
        />
      </div>

      <p className="mt-1.5 text-sm text-muted-foreground">
        Reads as{" "}
        <span className="font-medium text-foreground">“{formatStatement(value)}”</span>
      </p>
      {(subjectMissing || predicateMissing) && (
        <p id={errorId} className="mt-1 text-sm font-medium text-destructive">
          {subjectMissing && predicateMissing
            ? "Enter a subject and a predicate."
            : subjectMissing
              ? "Enter a subject."
              : "Enter a predicate."}
        </p>
      )}
    </div>
  );
}
