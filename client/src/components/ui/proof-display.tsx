
import { ProofStep } from "@shared/schema";
import { cn } from "@/lib/utils";

interface ProofDisplayProps {
  steps: ProofStep[];
  isValid: boolean;
  explanation?: string;
}

export function ProofDisplay({ steps, isValid, explanation }: ProofDisplayProps) {
  // Create a mapping of old step numbers to new sequential numbers
  const numberMap = new Map(steps.map((step, index) => [step.number, index + 1]));

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
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-start gap-4 p-2 rounded-lg hover:bg-accent">
            <span className="font-mono w-8">{index + 1}.</span>
            <div className="flex-1">
              <div className="font-medium">
                {step.premise.form} - {step.premise.subject} are {step.premise.predicate}
              </div>
              <div className="text-sm text-muted-foreground">
                {step.rule}
                {step.fromSteps && ` (from steps ${step.fromSteps.map(s => numberMap.get(s)).join(", ")})`}
              </div>
            </div>
          </div>
        ))}

        {isValid && (
          <div className="flex items-center gap-4 p-2 mt-4 border-t border-border">
            <div className="font-mono w-8"></div>
            <div className="flex-1 font-medium text-primary">■ End of Proof</div>
          </div>
        )}
      </div>
    </div>
  );
}
