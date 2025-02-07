import React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PremiseForm, type Premise } from "@shared/schema";
import { X } from "lucide-react";

interface PremiseInputProps {
  value: Premise;
  onChange: (premise: Premise) => void;
  onRemove?: () => void;
  isConclusion?: boolean;
}

export function PremiseInput({ value, onChange, onRemove, isConclusion }: PremiseInputProps) {
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

      <Input
        placeholder="Subject"
        value={value.subject}
        onChange={(e) => onChange({ ...value, subject: e.target.value })}
        className="w-[200px]"
      />

      <span className="text-muted-foreground">are</span>

      <Input
        placeholder="Predicate"
        value={value.predicate}
        onChange={(e) => onChange({ ...value, predicate: e.target.value })}
        className="w-[200px]"
      />

      {!isConclusion && onRemove && (
        <Button variant="ghost" size="icon" onClick={onRemove}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
