import React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PremiseForm, type Premise } from "@shared/schema";
import { X } from "lucide-react";

interface PremiseInputProps {
  value: Premise;
  onChange: (premise: Premise) => void;
  onRemove?: () => void;
  isConclusion?: boolean;
  disabled?: boolean;
}

export function PremiseInput({ value, onChange, onRemove, isConclusion, disabled }: PremiseInputProps) {
  const handleSubjectNegation = (checked: boolean) => {
    onChange({
      ...value,
      subject: checked ? `non-${value.subject.replace(/^non-/, '')}` : value.subject.replace(/^non-/, ''),
    });
  };

  const handlePredicateNegation = (checked: boolean) => {
    onChange({
      ...value,
      predicate: checked ? `non-${value.predicate.replace(/^non-/, '')}` : value.predicate.replace(/^non-/, ''),
    });
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-2">
      <Select
        value={value.form}
        onValueChange={(form) => onChange({ ...value, form: form as PremiseForm })}
        disabled={disabled}
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="Form" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={PremiseForm.A}>All (A)</SelectItem>
          <SelectItem value={PremiseForm.E}>No (E)</SelectItem>
          <SelectItem value={PremiseForm.I}>Some (I)</SelectItem>
          <SelectItem value={PremiseForm.O}>Some not (O)</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`subject-not-${isConclusion ? 'conclusion' : value.subject}`}
                    checked={value.subject.startsWith('non-')}
                    onCheckedChange={handleSubjectNegation}
                    disabled={disabled}
                  />
                  <Label htmlFor={`subject-not-${isConclusion ? 'conclusion' : value.subject}`} className="text-sm font-medium">
                    Negative
                  </Label>
                </div>
                <Input
                  placeholder="Subject"
                  value={value.subject.replace(/^non-/, '')}
                  onChange={(e) => onChange({ ...value, subject: value.subject.startsWith('non-') ? `non-${e.target.value}` : e.target.value })}
                  className="w-[180px] sm:w-[200px]"
                  disabled={disabled}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Check to negate the subject (add "non-")</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <span className="hidden sm:block text-muted-foreground">are</span>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`predicate-not-${isConclusion ? 'conclusion' : value.predicate}`}
                    checked={value.predicate.startsWith('non-')}
                    onCheckedChange={handlePredicateNegation}
                    disabled={disabled}
                  />
                  <Label htmlFor={`predicate-not-${isConclusion ? 'conclusion' : value.predicate}`} className="text-sm font-medium">
                    Negative
                  </Label>
                </div>
                <Input
                  placeholder="Predicate"
                  value={value.predicate.replace(/^non-/, '')}
                  onChange={(e) => onChange({ ...value, predicate: value.predicate.startsWith('non-') ? `non-${e.target.value}` : e.target.value })}
                  className="w-[180px] sm:w-[200px]"
                  disabled={disabled}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Check to negate the predicate (add "non-")</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {!isConclusion && onRemove && !disabled && (
        <Button variant="ghost" size="icon" onClick={onRemove} className="self-center">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}