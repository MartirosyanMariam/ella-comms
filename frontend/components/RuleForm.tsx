"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { TriggerSelector } from "./TriggerSelector";
import { ConditionBuilder } from "./ConditionBuilder";
import { ChannelContentForm } from "./ChannelContentForm";
import { api, type Rule, type RuleCreate, type Condition, type ChannelContent } from "@/lib/api";

type FormState = {
  name: string;
  triggerType: "standard" | "advanced";
  triggerEvent: string;
  triggerQuery: string;
  conditions: Condition[];
  sendImmediately: boolean;
  delayDays: number;
  channels: ChannelContent[];
  isRepeatable: boolean;
};

function initialState(rule?: Rule): FormState {
  return {
    name: rule?.name ?? "",
    triggerType: rule?.trigger_type ?? "standard",
    triggerEvent: rule?.trigger_event ?? "",
    triggerQuery: rule?.trigger_query ?? "",
    conditions: rule?.conditions ?? [],
    sendImmediately: (rule?.delay_days ?? 0) === 0,
    delayDays: rule?.delay_days ?? 1,
    channels: rule?.channels ?? [],
    isRepeatable: rule?.is_repeatable ?? false,
  };
}

function validateForm(form: FormState): string[] {
  const errors: string[] = [];
  if (!form.name.trim()) errors.push("Rule name is required.");
  if (form.triggerType === "standard" && !form.triggerEvent) errors.push("Select a trigger event.");
  if (form.triggerType === "advanced" && !form.triggerQuery.trim()) errors.push("Custom SQL query is required.");
  if (form.channels.length === 0) errors.push("Enable at least one channel.");
  form.channels.forEach((ch) => {
    if (!ch.title.trim()) errors.push(`${ch.channel} channel: title is required.`);
    if (!ch.body.trim()) errors.push(`${ch.channel} channel: body is required.`);
  });
  return errors;
}

function formToPayload(form: FormState, status: "draft" | "published"): RuleCreate {
  return {
    name: form.name,
    status,
    trigger_type: form.triggerType,
    trigger_event: form.triggerType === "standard" ? form.triggerEvent : null,
    trigger_query: form.triggerType === "advanced" ? form.triggerQuery : null,
    conditions: form.conditions,
    delay_days: form.sendImmediately ? 0 : form.delayDays,
    channels: form.channels,
    is_repeatable: form.isRepeatable,
  };
}

interface Props {
  existingRule?: Rule;
}

export function RuleForm({ existingRule }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => initialState(existingRule));
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function update(patch: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...patch }));
    setErrors([]);
  }

  async function save(status: "draft" | "published") {
    if (status === "published") {
      const errs = validateForm(form);
      if (errs.length > 0) { setErrors(errs); return; }
    } else if (!form.name.trim()) {
      setErrors(["Rule name is required."]);
      return;
    }

    setSaving(true);
    try {
      const payload = formToPayload(form, status);
      if (existingRule) {
        await api.updateRule(existingRule.id, payload);
      } else {
        await api.createRule(payload);
      }
      router.push("/");
    } catch (e: unknown) {
      setErrors([(e as Error).message ?? "Save failed."]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* 1. Rule name */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Rule name</h2>
        <div className="space-y-2">
          <Label htmlFor="rule-name">Name</Label>
          <Input
            id="rule-name"
            value={form.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="e.g. New user welcome"
          />
        </div>
      </section>

      <hr />

      {/* 2. Trigger */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Trigger</h2>
        <TriggerSelector
          triggerType={form.triggerType}
          triggerEvent={form.triggerEvent}
          triggerQuery={form.triggerQuery}
          onChange={(u) => update({
            triggerType: u.triggerType ?? form.triggerType,
            triggerEvent: u.triggerEvent ?? form.triggerEvent,
            triggerQuery: u.triggerQuery ?? form.triggerQuery,
          })}
        />
      </section>

      <hr />

      {/* 3. Conditions */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Conditions <span className="text-muted-foreground font-normal text-sm">(optional)</span></h2>
        <ConditionBuilder
          conditions={form.conditions}
          onChange={(c) => update({ conditions: c })}
        />
      </section>

      <hr />

      {/* 4. Timing */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold">Timing</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Switch
              id="send-immediately"
              checked={form.sendImmediately}
              onCheckedChange={(v) => update({ sendImmediately: v })}
            />
            <Label htmlFor="send-immediately" className="cursor-pointer">
              Send immediately
            </Label>
          </div>
          {!form.sendImmediately && (
            <div className="flex items-center gap-3 pl-1">
              <span className="text-sm text-muted-foreground">Send</span>
              <Input
                type="number"
                min={1}
                max={365}
                value={form.delayDays}
                onChange={(e) => update({ delayDays: Math.max(1, parseInt(e.target.value) || 1) })}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">day(s) after trigger</span>
            </div>
          )}
        </div>
      </section>

      <hr />

      {/* 5. Channels & Content */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Channels & Content</h2>
        <ChannelContentForm
          channels={form.channels}
          onChange={(c) => update({ channels: c })}
        />
      </section>

      <hr />

      {/* 6. Options */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Options</h2>
        <div className="flex items-center gap-3">
          <Switch
            id="repeatable"
            checked={form.isRepeatable}
            onCheckedChange={(v) => update({ isRepeatable: v })}
          />
          <Label htmlFor="repeatable" className="cursor-pointer">
            Repeatable — send to the same learner more than once
          </Label>
        </div>
      </section>

      {/* Inline errors */}
      {errors.length > 0 && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 space-y-1">
          {errors.map((e, i) => (
            <p key={i} className="text-sm text-destructive">{e}</p>
          ))}
        </div>
      )}

      {/* Action bar */}
      <div className="sticky bottom-0 bg-background border-t pt-4 pb-2 flex items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={() => save("draft")} disabled={saving}>
          {saving ? "Saving…" : "Save as Draft"}
        </Button>
        <Button type="button" onClick={() => save("published")} disabled={saving}>
          {saving ? "Publishing…" : "Publish"}
        </Button>
      </div>
    </div>
  );
}
