
import { ProofStep } from "@shared/schema";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Button } from "./button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

interface ProofDisplayProps {
  steps: ProofStep[];
  isValid: boolean;
  explanation?: string;
}

export function ProofDisplay({ steps, isValid, explanation }: ProofDisplayProps) {
  // Create a mapping of step numbers to display numbers
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

      <div className="mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleImplicit}
          className="w-full sm:w-auto"
        >
          {showImplicit ? "Hide" : "Show"} Implicit Steps
        </Button>
      </div>

      <div className="space-y-2">
        {visibleSteps.map((step, index) => (
          <div key={step.number} className="flex items-start gap-4 p-2 rounded-lg hover:bg-accent">
            <span className="font-mono w-8">{index + 1}.</span>
            <div className="flex-1">
              {step.intermediateSteps ? (
                <div className="space-y-2">
                  <div className="font-medium">
                    {step.premise.form} - {step.premise.subject} are {step.premise.predicate}
                  </div>
                  <div className="pl-4 space-y-1 text-sm text-muted-foreground border-l-2">
                    {step.intermediateSteps.map((transform, i) => (
                      <div key={i}>
                        {transform.type}: {transform.premise.form} - {transform.premise.subject} are {transform.premise.predicate}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="font-medium">
                  {step.premise.form} - {step.premise.subject} are {step.premise.predicate}
                </div>
              )}
              <div className="text-sm text-muted-foreground">
                {step.rule}
                {step.fromSteps && step.fromSteps.length > 0 && ` (from steps ${step.fromSteps.map(s => numberMap.get(s)).filter(Boolean).join(", ")})`}
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
