"use client";
import { Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CONDITION_FIELDS, CONDITION_OPERATORS, type Condition } from "@/lib/api";

interface Props {
  conditions: Condition[];
  onChange: (conditions: Condition[]) => void;
}

export function ConditionBuilder({ conditions, onChange }: Props) {
  function addCondition() {
    onChange([...conditions, { field: "target_language", operator: "eq", value: "" }]);
  }

  function updateCondition(index: number, updates: Partial<Condition>) {
    onChange(conditions.map((c, i) => (i === index ? { ...c, ...updates } : c)));
  }

  function removeCondition(index: number) {
    onChange(conditions.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      {conditions.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No conditions — rule applies to all matched users.
        </p>
      )}
      {conditions.map((cond, i) => (
        <div key={i} className="flex items-center gap-2">
          <Select value={cond.field} onValueChange={(v) => updateCondition(i, { field: v })}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONDITION_FIELDS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={cond.operator}
            onValueChange={(v) => updateCondition(i, { operator: v as Condition["operator"] })}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONDITION_OPERATORS.map((op) => (
                <SelectItem key={op.value} value={op.value}>
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            value={cond.value}
            onChange={(e) => updateCondition(i, { value: e.target.value })}
            placeholder="value"
            className="flex-1"
          />

          <Button type="button" variant="ghost" size="icon" onClick={() => removeCondition(i)}>
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      ))}

      <button
        type="button"
        onClick={addCondition}
        className="flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        <Plus className="h-3.5 w-3.5" />
        Add condition
      </button>
    </div>
  );
}
