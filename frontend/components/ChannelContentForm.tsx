"use client";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VariablePanel } from "./VariablePanel";
import type { ChannelContent } from "@/lib/api";
import { Bell, Mail, Smartphone } from "lucide-react";

const CHANNEL_DEFS = [
  {
    key: "in_app" as const,
    label: "In-App",
    icon: Bell,
    titleMax: 60,
    bodyMax: 200,
    hasEmail: false,
  },
  {
    key: "push" as const,
    label: "Push",
    icon: Smartphone,
    titleMax: 50,
    bodyMax: 100,
    hasEmail: false,
  },
  {
    key: "email" as const,
    label: "Email",
    icon: Mail,
    titleMax: 80,
    bodyMax: 2000,
    hasEmail: true,
  },
];

interface Props {
  channels: ChannelContent[];
  onChange: (channels: ChannelContent[]) => void;
}

export function ChannelContentForm({ channels, onChange }: Props) {
  const enabledKeys = new Set(channels.map((c) => c.channel));

  function toggleChannel(key: ChannelContent["channel"]) {
    if (enabledKeys.has(key)) {
      onChange(channels.filter((c) => c.channel !== key));
    } else {
      onChange([
        ...channels,
        { channel: key, title: "", body: "", subject: null, cta_label: null, cta_url: null },
      ]);
    }
  }

  function updateChannel(key: ChannelContent["channel"], updates: Partial<ChannelContent>) {
    onChange(channels.map((c) => (c.channel === key ? { ...c, ...updates } : c)));
  }

  function getChannel(key: ChannelContent["channel"]) {
    return channels.find((c) => c.channel === key);
  }

  return (
    <div className="space-y-4">
      {/* Channel toggle cards */}
      <div className="flex gap-3">
        {CHANNEL_DEFS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => toggleChannel(key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors",
              enabledKeys.has(key)
                ? "border-primary bg-primary/5 text-primary"
                : "border-border text-muted-foreground hover:border-muted-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Expanded content per enabled channel */}
      {CHANNEL_DEFS.map(({ key, label, titleMax, bodyMax, hasEmail }) => {
        const ch = getChannel(key);
        if (!ch) return null;
        return (
          <div key={key} className="border rounded-lg p-5 space-y-4">
            <h4 className="font-medium text-sm">{label} content</h4>

            {hasEmail && (
              <div className="space-y-2">
                <Label htmlFor={`${key}-subject`}>Subject line</Label>
                <Input
                  id={`${key}-subject`}
                  value={ch.subject ?? ""}
                  onChange={(e) => updateChannel(key, { subject: e.target.value || null })}
                  placeholder="Subject…"
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={`${key}-title`}>Title</Label>
                <span className={cn("text-xs", (ch.title?.length ?? 0) > titleMax ? "text-destructive" : "text-muted-foreground")}>
                  {ch.title?.length ?? 0}/{titleMax}
                </span>
              </div>
              <Input
                id={`${key}-title`}
                value={ch.title}
                onChange={(e) => updateChannel(key, { title: e.target.value })}
                placeholder="Title…"
                maxLength={titleMax + 20}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={`${key}-body`}>Body</Label>
                <span className={cn("text-xs", (ch.body?.length ?? 0) > bodyMax ? "text-destructive" : "text-muted-foreground")}>
                  {ch.body?.length ?? 0}/{bodyMax}
                </span>
              </div>
              <Textarea
                id={`${key}-body`}
                value={ch.body}
                onChange={(e) => updateChannel(key, { body: e.target.value })}
                placeholder="Message body…"
                className="min-h-[80px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor={`${key}-cta-label`}>CTA label (optional)</Label>
                <Input
                  id={`${key}-cta-label`}
                  value={ch.cta_label ?? ""}
                  onChange={(e) => updateChannel(key, { cta_label: e.target.value || null })}
                  placeholder="e.g. Start learning"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${key}-cta-url`}>CTA URL (optional)</Label>
                <Input
                  id={`${key}-cta-url`}
                  value={ch.cta_url ?? ""}
                  onChange={(e) => updateChannel(key, { cta_url: e.target.value || null })}
                  placeholder="https://…"
                />
              </div>
            </div>

            <VariablePanel />
          </div>
        );
      })}
    </div>
  );
}
