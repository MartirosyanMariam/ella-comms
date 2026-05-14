"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Pause, Play, Bell, Smartphone, Mail, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SimulateDrawer } from "@/components/SimulateDrawer";
import { api, type Rule, TRIGGER_EVENTS } from "@/lib/api";

function StatusBadge({ status }: { status: Rule["status"] }) {
  if (status === "published") return <Badge variant="success">Published</Badge>;
  if (status === "paused") return <Badge variant="warning">Paused</Badge>;
  return <Badge variant="muted">Draft</Badge>;
}

function ChannelIcons({ channels }: { channels: Rule["channels"] }) {
  const keys = new Set(channels.map((c) => c.channel));
  return (
    <div className="flex gap-1.5">
      {keys.has("in_app") && <span title="In-App"><Bell className="h-4 w-4 text-muted-foreground" /></span>}
      {keys.has("push") && <span title="Push"><Smartphone className="h-4 w-4 text-muted-foreground" /></span>}
      {keys.has("email") && <span title="Email"><Mail className="h-4 w-4 text-muted-foreground" /></span>}
    </div>
  );
}

function triggerLabel(rule: Rule) {
  if (rule.trigger_type === "advanced") return "Custom SQL";
  return TRIGGER_EVENTS.find((e) => e.value === rule.trigger_event)?.label ?? rule.trigger_event ?? "—";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function RuleList() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [simulatingRule, setSimulatingRule] = useState<Rule | null>(null);
  const router = useRouter();

  useEffect(() => {
    api.getRules()
      .then(setRules)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(rule: Rule) {
    if (!confirm(`Delete rule "${rule.name}"?`)) return;
    await api.deleteRule(rule.id);
    setRules((prev) => prev.filter((r) => r.id !== rule.id));
  }

  async function handleTogglePause(rule: Rule) {
    const newStatus = rule.status === "paused" ? "published" : "paused";
    const updated = await api.updateRule(rule.id, { ...rule, status: newStatus });
    setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
        Loading rules…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <p className="text-sm text-destructive">Failed to load rules: {error}</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notification Rules</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Define who gets notified, when, and with what message.
          </p>
        </div>
        <Button asChild>
          <Link href="/rules/new">
            <Plus className="h-4 w-4 mr-2" />
            New Rule
          </Link>
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 border-2 border-dashed rounded-xl text-center">
          <Bell className="h-10 w-10 text-muted-foreground/40" />
          <div>
            <p className="font-medium">No rules yet.</p>
            <p className="text-muted-foreground text-sm">Create your first to start communicating with learners.</p>
          </div>
          <Button asChild>
            <Link href="/rules/new">Create first rule</Link>
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Trigger</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Channels</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Delay</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last modified</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{rule.name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={rule.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{triggerLabel(rule)}</td>
                  <td className="px-4 py-3">
                    <ChannelIcons channels={rule.channels} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {rule.delay_days === 0 ? "Immediate" : `${rule.delay_days}d`}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(rule.updated_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSimulatingRule(rule)}
                        title="Dry Run"
                      >
                        <FlaskConical className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push(`/rules/${rule.id}`)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {rule.status !== "draft" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleTogglePause(rule)}
                          title={rule.status === "paused" ? "Resume" : "Pause"}
                        >
                          {rule.status === "paused" ? (
                            <Play className="h-4 w-4" />
                          ) : (
                            <Pause className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(rule)}
                        title="Delete"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {simulatingRule && (
        <SimulateDrawer
          rule={simulatingRule}
          open={!!simulatingRule}
          onClose={() => setSimulatingRule(null)}
        />
      )}
    </div>
  );
}
