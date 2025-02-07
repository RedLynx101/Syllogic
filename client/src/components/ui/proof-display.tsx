import { ProofStep } from "@shared/schema";
import { cn } from "@/lib/utils";

interface ProofDisplayProps {
  steps: ProofStep[];
  isValid: boolean;
  explanation?: string;
}

export function ProofDisplay({ steps, isValid, explanation }: ProofDisplayProps) {
  return (
    <div className="space-y-4">
      <div className={cn(
        "text-lg font-semibold px-4 py-2 rounded-md",
        isValid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
      )}>
        {isValid ? "Valid Argument" : "Invalid Argument"}
      </div>

      {explanation && (
        <p className="text-muted-foreground">{explanation}</p>
      )}

      <div className="space-y-2">
        {steps.map((step) => (
          <div key={step.number} className="flex items-start gap-4 p-2 rounded-lg hover:bg-accent">
            <span className="font-mono w-8">{step.number}.</span>
            <div className="flex-1">
              <div className="font-medium">
                {step.premise.form} - {step.premise.subject} are {step.premise.predicate}
              </div>
              <div className="text-sm text-muted-foreground">
                {step.rule}
                {step.fromSteps && ` (from steps ${step.fromSteps.join(", ")})`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
