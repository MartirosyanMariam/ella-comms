"use client";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { TRIGGER_EVENTS, api } from "@/lib/api";
import { AlertTriangle, CheckCircle } from "lucide-react";

interface Props {
  triggerType: "standard" | "advanced";
  triggerEvent: string;
  triggerQuery: string;
  onChange: (updates: { triggerType?: "standard" | "advanced"; triggerEvent?: string; triggerQuery?: string }) => void;
}

export function TriggerSelector({ triggerType, triggerEvent, triggerQuery, onChange }: Props) {
  const [testResult, setTestResult] = useState<{ count: number; error: string | null } | null>(null);
  const [testing, setTesting] = useState(false);

  async function handleTest() {
    if (!triggerQuery.trim()) return;
    setTesting(true);
    try {
      const result = await api.testQuery(triggerQuery);
      setTestResult(result);
    } catch {
      setTestResult({ count: 0, error: "Request failed" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Switch
          id="advanced-mode"
          checked={triggerType === "advanced"}
          onCheckedChange={(checked) =>
            onChange({ triggerType: checked ? "advanced" : "standard" })
          }
        />
        <Label htmlFor="advanced-mode" className="cursor-pointer">
          Advanced mode (custom SQL)
        </Label>
      </div>

      {triggerType === "standard" ? (
        <div className="space-y-2">
          <Label>Trigger event</Label>
          <Select value={triggerEvent} onValueChange={(v) => onChange({ triggerEvent: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Select a trigger event…" />
            </SelectTrigger>
            <SelectContent>
              {TRIGGER_EVENTS.map((e) => (
                <SelectItem key={e.value} value={e.value}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="space-y-3">
          <Label htmlFor="trigger-query">Custom SQL query</Label>
          <p className="text-xs text-muted-foreground">
            Must return a column named <code className="bg-muted px-1 rounded">user_id</code>. Runs read-only against Ella's DB.
          </p>
          <Textarea
            id="trigger-query"
            value={triggerQuery}
            onChange={(e) => onChange({ triggerQuery: e.target.value })}
            placeholder="SELECT id::text AS user_id FROM users WHERE ..."
            className="font-mono text-sm min-h-[120px]"
          />
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={handleTest} disabled={testing || !triggerQuery.trim()}>
              {testing ? "Testing…" : "Test query"}
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
                    <span className="text-green-700">Matches {testResult.count} user{testResult.count !== 1 ? "s" : ""}.</span>
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
    </div>
  );
}
