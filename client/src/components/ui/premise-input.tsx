import React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PremiseForm, type Premise } from "@shared/schema";
import { X } from "lucide-react";

interface PremiseInputProps {
  value: Premise;
  onChange: (premise: Premise) => void;
  onRemove?: () => void;
  isConclusion?: boolean;
}

export function PremiseInput({ value, onChange, onRemove, isConclusion }: PremiseInputProps) {
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
    <div className="flex gap-2 items-center">
      <Select
        value={value.form}
        onValueChange={(form) => onChange({ ...value, form: form as PremiseForm })}
      >
        <SelectTrigger className="w-[100px]">
          <SelectValue placeholder="Form" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={PremiseForm.A}>All (A)</SelectItem>
          <SelectItem value={PremiseForm.E}>No (E)</SelectItem>
          <SelectItem value={PremiseForm.I}>Some (I)</SelectItem>
          <SelectItem value={PremiseForm.O}>Some not (O)</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <Checkbox
          id={`subject-not-${isConclusion ? 'conclusion' : value.subject}`}
          checked={value.subject.startsWith('non-')}
          onCheckedChange={handleSubjectNegation}
        />
        <Input
          placeholder="Subject"
          value={value.subject.replace(/^non-/, '')}
          onChange={(e) => onChange({ ...value, subject: value.subject.startsWith('non-') ? `non-${e.target.value}` : e.target.value })}
          className="w-[200px]"
        />
      </div>

      <span className="text-muted-foreground">are</span>

      <div className="flex items-center gap-2">
        <Checkbox
          id={`predicate-not-${isConclusion ? 'conclusion' : value.predicate}`}
          checked={value.predicate.startsWith('non-')}
          onCheckedChange={handlePredicateNegation}
        />
        <Input
          placeholder="Predicate"
          value={value.predicate.replace(/^non-/, '')}
          onChange={(e) => onChange({ ...value, predicate: value.predicate.startsWith('non-') ? `non-${e.target.value}` : e.target.value })}
          className="w-[200px]"
        />
      </div>

      {!isConclusion && onRemove && (
        <Button variant="ghost" size="icon" onClick={onRemove}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}