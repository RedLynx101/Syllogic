import type { Premise, ProofStep } from "@shared/schema";
import { cn } from "@/lib/utils";
import { STATEMENT_FORMS, formatStatement } from "@/lib/format";
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";

interface ProofDisplayProps {
  steps: ProofStep[];
  isValid: boolean;
  explanation?: string;
  /** The conclusion that was tested, used to mark (or report) the target step. */
  conclusion?: Premise;
  /** The argument changed after this proof was produced. */
  stale?: boolean;
}

const sameStatement = (a: Premise, b: Premise) =>
  a.form === b.form && a.subject === b.subject && a.predicate === b.predicate;

const formName = (form: Premise["form"]) => STATEMENT_FORMS.find((f) => f.form === form)?.name ?? form;

export function ValidityBanner({ isValid, explanation }: { isValid: boolean; explanation?: string }) {
  const Icon = isValid ? CheckCircle2 : XCircle;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-l-4 p-4",
        isValid
          ? "border-emerald-200 border-l-emerald-600 bg-emerald-50 text-emerald-950"
          : "border-red-200 border-l-red-600 bg-red-50 text-red-950",
      )}
    >
      <Icon
        className={cn("mt-0.5 h-5 w-5 shrink-0", isValid ? "text-emerald-700" : "text-red-700")}
        aria-hidden="true"
      />
      <div className="space-y-1">
        <p className="font-semibold leading-tight">{isValid ? "Valid argument" : "Invalid argument"}</p>
        {explanation && <p className="text-sm">{explanation}</p>}
      </div>
    </div>
  );
}

export function ProofDisplay({ steps, isValid, explanation, conclusion, stale }: ProofDisplayProps) {
  // Display numbers run 1..n; the engine's internal step numbers may have gaps after trimming.
  const numberMap = new Map(steps.map((step, index) => [step.number, index + 1]));
  const targetIndex = conclusion ? steps.findIndex((step) => sameStatement(step.premise, conclusion)) : -1;

  return (
    <div className="space-y-4">
      {stale && (
        <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <RefreshCw className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          The argument changed after this result. Evaluate again to update it.
        </p>
      )}

      <ValidityBanner isValid={isValid} explanation={explanation} />

      <ol className="divide-y overflow-hidden rounded-lg border" aria-label="Proof steps">
        {steps.map((step, index) => {
          const derived = step.rule !== "Premise";
          const isTarget = index === targetIndex;
          const from = (step.fromSteps ?? [])
            .map((n) => numberMap.get(n))
            .filter((n): n is number => n !== undefined);

          return (
            <li
              key={step.number}
              className={cn(
                "grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-0.5 px-3 py-2.5 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-baseline",
                derived && "bg-muted/40",
                isTarget && isValid && "bg-emerald-50",
              )}
            >
              <span className="font-mono text-sm tabular-nums text-muted-foreground">{index + 1}.</span>
              <div className="min-w-0">
                <span className="break-words font-medium">
                  {isTarget && isValid && (
                    <span className="mr-1 text-emerald-700" aria-label="Therefore">
                      ∴
                    </span>
                  )}
                  {formatStatement(step.premise)}
                </span>
                <abbr
                  title={formName(step.premise.form)}
                  className="ml-2 inline-flex translate-y-[-1px] rounded border bg-background px-1.5 font-mono text-xs text-muted-foreground no-underline"
                >
                  {step.premise.form}
                </abbr>
                {step.intermediateSteps && step.intermediateSteps.length > 0 && (
                  <ul className="mt-1 space-y-0.5 border-l-2 pl-3 text-sm text-muted-foreground">
                    {step.intermediateSteps.map((transform, i) => (
                      <li key={i}>
                        {transform.type}: {formatStatement(transform.premise)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <span className="col-start-2 text-sm text-muted-foreground sm:col-start-3 sm:text-right">
                <span className={cn(derived && "font-medium text-foreground")}>{step.rule}</span>
                {from.length > 0 && <> · from {from.join(", ")}</>}
              </span>
            </li>
          );
        })}
      </ol>

      {isValid ? (
        <div className="space-y-2">
          {conclusion && targetIndex === -1 && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">∴ {formatStatement(conclusion)}</span> is an
              equivalent form of a listed statement (by obversion, conversion or contraposition), so no
              extra step is needed.
            </p>
          )}
          <p className="text-sm font-semibold">
            <span aria-hidden="true">■ </span>End of proof
          </p>
        </div>
      ) : (
        conclusion && (
          <p className="flex items-start gap-2 text-sm">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
            <span>
              Not derived: <span className="font-medium">“{formatStatement(conclusion)}”</span>. The steps
              above are what the checker derived from the premises.
            </span>
          </p>
        )
      )}
    </div>
  );
}
