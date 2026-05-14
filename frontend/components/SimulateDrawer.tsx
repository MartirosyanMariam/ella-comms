"use client";
import { useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, type SimulateResult, type Rule } from "@/lib/api";
import { Bell, Smartphone, Mail, AlertTriangle, CheckCircle, ChevronDown, ChevronRight, Send, Loader2 } from "lucide-react";

const CHANNEL_ICON: Record<string, React.ReactNode> = {
  in_app: <Bell className="h-3.5 w-3.5" />,
  push: <Smartphone className="h-3.5 w-3.5" />,
  email: <Mail className="h-3.5 w-3.5" />,
};

interface PayloadContent { title?: string; body?: string; subject?: string }

function ContentPreview({ content }: { content: unknown }) {
  const c = content as PayloadContent;
  if (!c) return null;
  return (
    <div className="mt-2 rounded-md bg-muted/50 px-3 py-2 text-sm space-y-1">
      {c.subject && (
        <p className="text-xs text-muted-foreground">
          Subject: <span className="text-foreground">{c.subject}</span>
        </p>
      )}
      {c.title && <p className="font-medium">{c.title}</p>}
      {c.body && <p className="text-muted-foreground text-xs">{c.body}</p>}
    </div>
  );
}

function PayloadViewer({ payload }: { payload: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {open ? "Hide" : "Preview"} JSON payload
      </button>
      {open && (
        <pre className="mt-2 rounded-md bg-muted p-3 text-xs overflow-x-auto leading-relaxed">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}
    </div>
  );
}

interface Props {
  rule: Rule;
  open: boolean;
  onClose: () => void;
}

type TriggerState = { sent: number; failed: number; errors: string[] } | null;

export function SimulateDrawer({ rule, open, onClose }: Props) {
  const [result, setResult] = useState<SimulateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [triggerResult, setTriggerResult] = useState<TriggerState>(null);

  async function runSimulation() {
    setLoading(true);
    setError(null);
    setResult(null);
    setTriggerResult(null);
    try {
      const r = await api.simulateRule(rule.id);
      setResult(r);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function sendNow() {
    setSending(true);
    setTriggerResult(null);
    try {
      const r = await api.triggerRule(rule.id);
      setTriggerResult(r);
    } catch (e: unknown) {
      setTriggerResult({ sent: 0, failed: 0, errors: [(e as Error).message] });
    } finally {
      setSending(false);
    }
  }

  // Auto-run when drawer opens
  useState(() => { if (open) runSimulation(); });

  return (
    <Drawer open={open} onClose={onClose} title={`Dry Run — ${rule.name}`} width="max-w-2xl">
      {loading && (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          Evaluating rule…
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold text-primary">{result.unique_users_matched}</p>
              <p className="text-xs text-muted-foreground mt-1">Users matched</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold">{result.total_would_send}</p>
              <p className="text-xs text-muted-foreground mt-1">Notifications to send</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold text-muted-foreground">{result.skipped_already_notified}</p>
              <p className="text-xs text-muted-foreground mt-1">Already notified</p>
            </div>
          </div>

          {result.unique_users_matched === 0 && (
            <div className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              No users match this rule right now. Check the trigger and conditions.
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 space-y-1">
              <p className="text-sm font-medium text-destructive">Errors during simulation</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-destructive">{e}</p>
              ))}
            </div>
          )}

          {/* Preview list */}
          {result.preview.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  Preview{result.total_would_send > result.preview_capped_at && (
                    <span className="font-normal text-muted-foreground ml-1">
                      (first {result.preview_capped_at} of {result.total_would_send})
                    </span>
                  )}
                </h3>
                <div className="flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-full">
                  <CheckCircle className="h-3 w-3" />
                  Dry run — nothing sent
                </div>
              </div>

              {result.preview.map((item, i) => (
                <div key={i} className="border rounded-lg p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{item.learner_name}</span>
                      <span className="text-xs text-muted-foreground font-mono">{item.learner_id.slice(0, 8)}…</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {CHANNEL_ICON[item.channel]}
                      <span className="capitalize">{item.channel.replace("_", " ")}</span>
                    </div>
                  </div>

                  <ContentPreview content={item.payload.content} />

                  <PayloadViewer payload={item.payload} />
                </div>
              ))}
            </div>
          )}

          {triggerResult && (
            <div className={`rounded-md border px-4 py-3 text-sm ${
              triggerResult.errors.length > 0
                ? "bg-destructive/10 border-destructive/30 text-destructive"
                : "bg-green-50 border-green-200 text-green-800"
            }`}>
              <p className="font-medium">
                {triggerResult.errors.length === 0
                  ? `Sent successfully — ${triggerResult.sent} notification${triggerResult.sent !== 1 ? "s" : ""} delivered`
                  : `Finished with errors — ${triggerResult.sent} sent, ${triggerResult.failed} failed`}
              </p>
              {triggerResult.errors.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {triggerResult.errors.map((e, i) => <li key={i} className="text-xs">{e}</li>)}
                </ul>
              )}
              {triggerResult.sent > 0 && (
                <p className="text-xs mt-1 opacity-70">Check the History tab to see the log entries.</p>
              )}
            </div>
          )}

          <div className="pt-2 border-t flex justify-between items-center">
            <p className="text-xs text-muted-foreground">
              Rule status: <span className="font-medium capitalize">{result.rule_status}</span>
              {result.rule_status === "draft" && " — publish to enable scheduled sending"}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={runSimulation} disabled={loading || sending}>
                Re-run
              </Button>
              <Button
                size="sm"
                onClick={sendNow}
                disabled={sending || loading || result.unique_users_matched === 0}
              >
                {sending ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Sending…</>
                ) : (
                  <><Send className="h-3.5 w-3.5 mr-1.5" />Send Now</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}
