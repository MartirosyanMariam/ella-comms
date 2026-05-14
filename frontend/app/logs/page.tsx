"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api, type LogItem, type LogsSummary, type Rule } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Smartphone, Mail, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 50;

const CHANNEL_ICON: Record<string, React.ReactNode> = {
  in_app: <Bell className="h-3.5 w-3.5" />,
  push: <Smartphone className="h-3.5 w-3.5" />,
  email: <Mail className="h-3.5 w-3.5" />,
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function LogsPage() {
  const [items, setItems] = useState<LogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<LogsSummary | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);

  // Filters
  const [filterRule, setFilterRule] = useState("all");
  const [filterChannel, setFilterChannel] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterLearner, setFilterLearner] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const fetchLogs = useCallback(async (off = 0) => {
    setLoading(true);
    try {
      const [logsRes, summaryRes] = await Promise.all([
        api.getLogs({
          rule_id: filterRule !== "all" ? filterRule : undefined,
          channel: filterChannel !== "all" ? filterChannel : undefined,
          status: filterStatus !== "all" ? filterStatus : undefined,
          learner_id: filterLearner || undefined,
          date_from: filterDateFrom || undefined,
          date_to: filterDateTo || undefined,
          limit: PAGE_SIZE,
          offset: off,
        }),
        api.getLogsSummary(),
      ]);
      setItems(logsRes.items);
      setTotal(logsRes.total);
      setSummary(summaryRes);
      setOffset(off);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filterRule, filterChannel, filterStatus, filterLearner, filterDateFrom, filterDateTo]);

  useEffect(() => {
    api.getRules().then(setRules).catch(() => {});
    fetchLogs(0);
  }, []);

  function applyFilters() { fetchLogs(0); }
  function clearFilters() {
    setFilterRule("all"); setFilterChannel("all"); setFilterStatus("all");
    setFilterLearner(""); setFilterDateFrom(""); setFilterDateTo("");
    setTimeout(() => fetchLogs(0), 0);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notification History</h1>
          <p className="text-muted-foreground text-sm mt-1">All notifications sent or attempted by the engine.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchLogs(offset)} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Sent today", value: summary.sent_today, color: "text-green-600" },
            { label: "Failed today", value: summary.failed_today, color: "text-red-600" },
            { label: "Total sent", value: summary.total_sent, color: "text-foreground" },
            { label: "Total failed", value: summary.total_failed, color: "text-muted-foreground" },
          ].map(({ label, value, color }) => (
            <div key={label} className="border rounded-lg px-4 py-3">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
        <p className="text-sm font-medium">Filters</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Select value={filterRule} onValueChange={setFilterRule}>
            <SelectTrigger><SelectValue placeholder="All rules" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All rules</SelectItem>
              {rules.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterChannel} onValueChange={setFilterChannel}>
            <SelectTrigger><SelectValue placeholder="All channels" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All channels</SelectItem>
              <SelectItem value="in_app">In-App</SelectItem>
              <SelectItem value="push">Push</SelectItem>
              <SelectItem value="email">Email</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="Learner ID"
            value={filterLearner}
            onChange={e => setFilterLearner(e.target.value)}
          />
          <Input
            type="datetime-local"
            placeholder="From"
            value={filterDateFrom}
            onChange={e => setFilterDateFrom(e.target.value)}
          />
          <Input
            type="datetime-local"
            placeholder="To"
            value={filterDateTo}
            onChange={e => setFilterDateTo(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={applyFilters}>Apply</Button>
          <Button size="sm" variant="outline" onClick={clearFilters}>Clear</Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16 text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-xl gap-3 text-center">
          <Bell className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">No notifications match the current filters.</p>
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Time</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Rule</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Learner</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Channel</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map(item => (
                  <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{fmt(item.sent_at)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/rules/${item.rule_id}`} className="hover:underline font-medium">
                        {item.rule_name ?? item.rule_id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.learner_id.slice(0, 16)}…</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        {CHANNEL_ICON[item.channel]}
                        <span className="capitalize text-xs">{item.channel.replace("_", " ")}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {item.status === "sent"
                        ? <Badge variant="success">Sent</Badge>
                        : <Badge variant="destructive">Failed</Badge>}
                    </td>
                    <td className="px-4 py-3 text-xs text-destructive max-w-[200px] truncate">
                      {item.error_message ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Page {currentPage} of {totalPages} · {total} total</span>
              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm"
                  disabled={offset === 0}
                  onClick={() => fetchLogs(offset - PAGE_SIZE)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline" size="sm"
                  disabled={offset + PAGE_SIZE >= total}
                  onClick={() => fetchLogs(offset + PAGE_SIZE)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
