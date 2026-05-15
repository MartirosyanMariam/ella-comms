"use client";
import { useState } from "react";
import { Trash2, Plus, X, AlertTriangle, CheckCircle, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CONDITION_FIELDS, CONDITION_OPERATORS, api, type Condition } from "@/lib/api";
import { SavedQueryPicker } from "@/components/SavedQueryPicker";

interface Props {
  conditions: Condition[];
  conditionQuery: string | null;
  onChange: (updates: { conditions?: Condition[]; conditionQuery?: string | null }) => void;
}

export function ConditionBuilder({ conditions, conditionQuery, onChange }: Props) {
  const [testResult, setTestResult] = useState<{ count: number; error: string | null } | null>(null);
  const [testing, setTesting] = useState(false);

  const hasAdvanced = conditionQuery !== null;

  function addCondition() {
    onChange({ conditions: [...conditions, { field: "target_language", operator: "eq", value: "" }] });
  }

  function updateCondition(index: number, updates: Partial<Condition>) {
    onChange({ conditions: conditions.map((c, i) => (i === index ? { ...c, ...updates } : c)) });
  }

  function removeCondition(index: number) {
    onChange({ conditions: conditions.filter((_, i) => i !== index) });
  }

  function addAdvanced() {
    onChange({ conditionQuery: "" });
    setTestResult(null);
  }

  function removeAdvanced() {
    onChange({ conditionQuery: null });
    setTestResult(null);
  }

  async function handleTest() {
    if (!conditionQuery?.trim()) return;
    setTesting(true);
    try {
      const result = await api.testConditionQuery(conditionQuery);
      setTestResult(result);
    } catch {
      setTestResult({ count: 0, error: "Request failed" });
    } finally {
      setTesting(false);
    }
  }

  const isEmpty = conditions.length === 0 && !hasAdvanced;

  return (
    <div className="space-y-3">
      {isEmpty && (
        <p className="text-sm text-muted-foreground">
          No conditions — rule applies to all matched users.
        </p>
      )}

      {/* Standard condition rows */}
      {conditions.map((cond, i) => (
        <div key={i} className="flex items-center gap-2">
          <Select value={cond.field} onValueChange={(v) => updateCondition(i, { field: v })}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONDITION_FIELDS.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
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
                <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
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

      {/* Advanced SQL condition block */}
      {hasAdvanced && (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Code2 className="h-4 w-4 text-primary" />
              Advanced SQL condition
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={removeAdvanced} className="h-7 w-7">
              <X className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            A SQL <code className="bg-muted px-1 rounded">WHERE</code> clause applied on top of the conditions above.
            Reference the <code className="bg-muted px-1 rounded">users</code> table as{" "}
            <code className="bg-muted px-1 rounded">u</code>.
          </p>

          <div className="rounded bg-muted px-3 py-2 text-xs font-mono text-muted-foreground leading-relaxed">
            {"... AND ("}<span className="text-foreground font-semibold">your clause</span>{")"}
          </div>

          <Textarea
            value={conditionQuery ?? ""}
            onChange={(e) => {
              onChange({ conditionQuery: e.target.value });
              setTestResult(null);
            }}
            placeholder={`u.target_language = 'French' AND u.country != 'US'`}
            className="font-mono text-sm min-h-[80px]"
          />

          <SavedQueryPicker
            type="condition"
            currentSql={conditionQuery ?? ""}
            onLoad={(sql) => { onChange({ conditionQuery: sql }); setTestResult(null); }}
          />

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={testing || !conditionQuery?.trim()}
            >
              {testing ? "Testing…" : "Test clause"}
            </Button>
            {testResult && !testResult.error && (
              <div className="flex items-center gap-1.5 text-sm">
                {testResult.count === 0 ? (
                  <>
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="text-amber-700">Matches 0 users right now.</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-green-700">
                      Matches {testResult.count} user{testResult.count !== 1 ? "s" : ""}.
                    </span>
                  </>
                )}
              </div>
            )}
            {testResult?.error && (
              <span className="text-sm text-destructive">{testResult.error}</span>
            )}
          </div>
        </div>
      )}

      {/* Add links */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={addCondition}
          className="flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <Plus className="h-3.5 w-3.5" />
          Add condition
        </button>
        {!hasAdvanced && (
          <button
            type="button"
            onClick={addAdvanced}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            <Code2 className="h-3.5 w-3.5" />
            Add advanced condition
          </button>
        )}
      </div>
    </div>
  );
}
