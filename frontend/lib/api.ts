const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

let _env: "dev" | "prod" = "dev";
export function setApiEnv(env: "dev" | "prod") { _env = env; }

export interface Condition {
  field: string;
  operator: "eq" | "neq" | "gt" | "lt" | "gte" | "lte";
  value: string;
}

export interface ChannelContent {
  channel: "in_app" | "push" | "email";
  title: string;
  body: string;
  subject?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
}

export interface Rule {
  id: string;
  name: string;
  status: "draft" | "published" | "paused";
  trigger_type: "standard" | "advanced";
  trigger_event?: string | null;
  trigger_query?: string | null;
  condition_query?: string | null;
  conditions: Condition[];
  delay_days: number;
  channels: ChannelContent[];
  is_repeatable: boolean;
  created_at: string;
  updated_at: string;
  last_run_at?: string | null;
}

export type RuleCreate = Omit<Rule, "id" | "created_at" | "updated_at" | "last_run_at">;

export interface SimulatePreviewItem {
  learner_id: string;
  learner_name: string;
  channel: string;
  payload: Record<string, unknown>;
}

export interface SimulateResult {
  rule_id: string;
  rule_name: string;
  rule_status: string;
  total_would_send: number;
  unique_users_matched: number;
  skipped_already_notified: number;
  preview: SimulatePreviewItem[];
  preview_capped_at: number;
  errors: string[];
}

export interface LogItem {
  id: string;
  rule_id: string;
  rule_name: string | null;
  learner_id: string;
  channel: string;
  status: "sent" | "failed";
  error_message: string | null;
  sent_at: string;
}

export interface LogsResponse {
  total: number;
  offset: number;
  limit: number;
  items: LogItem[];
}

export interface LogsSummary {
  total_sent: number;
  total_failed: number;
  sent_today: number;
  failed_today: number;
}

export interface LogParams {
  rule_id?: string;
  channel?: string;
  status?: string;
  learner_id?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export interface SavedQuery {
  id: string;
  name: string;
  type: "trigger" | "condition";
  sql: string;
  created_at: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    headers: {
      "Content-Type": "application/json",
      "X-App-Env": _env,
      ...(options?.headers as Record<string, string> ?? {}),
    },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  getRules: () => request<Rule[]>("/rules"),
  getRule: (id: string) => request<Rule>(`/rules/${id}`),
  createRule: (data: RuleCreate) =>
    request<Rule>("/rules", { method: "POST", body: JSON.stringify(data) }),
  updateRule: (id: string, data: RuleCreate) =>
    request<Rule>(`/rules/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteRule: (id: string) =>
    request<void>(`/rules/${id}`, { method: "DELETE" }),
  testQuery: (sql: string) =>
    request<{ count: number; error: string | null }>("/rules/test-query", {
      method: "POST",
      body: JSON.stringify({ sql }),
    }),
  testConditionQuery: (sql: string) =>
    request<{ count: number; error: string | null }>("/rules/test-condition-query", {
      method: "POST",
      body: JSON.stringify({ sql }),
    }),
  simulateRule: (id: string) =>
    request<SimulateResult>(`/rules/${id}/simulate`, { method: "POST" }),
  triggerRule: (id: string) =>
    request<{ sent: number; failed: number; errors: string[] }>(`/rules/${id}/trigger`, { method: "POST" }),
  getSavedQueries: (type?: "trigger" | "condition") =>
    request<SavedQuery[]>(`/saved-queries${type ? `?type=${type}` : ""}`),
  createSavedQuery: (name: string, type: "trigger" | "condition", sql: string) =>
    request<SavedQuery>("/saved-queries", { method: "POST", body: JSON.stringify({ name, type, sql }) }),
  deleteSavedQuery: (id: string) =>
    request<void>(`/saved-queries/${id}`, { method: "DELETE" }),
  getLogs: (params: LogParams) => {
    const q = new URLSearchParams();
    if (params.rule_id) q.set("rule_id", params.rule_id);
    if (params.channel) q.set("channel", params.channel);
    if (params.status) q.set("status", params.status);
    if (params.learner_id) q.set("learner_id", params.learner_id);
    if (params.date_from) q.set("date_from", params.date_from);
    if (params.date_to) q.set("date_to", params.date_to);
    if (params.limit) q.set("limit", String(params.limit));
    if (params.offset) q.set("offset", String(params.offset));
    return request<LogsResponse>(`/logs?${q.toString()}`);
  },
  getLogsSummary: () => request<LogsSummary>("/logs/summary"),
};

export const TRIGGER_EVENTS = [
  { value: "user_signed_up",        label: "User signs up (app_started)" },
  { value: "first_session_started", label: "User starts first session" },
  { value: "onboarding_completed",  label: "User completes onboarding" },
  { value: "library_viewed",        label: "User views Library" },
  { value: "start_learning_clicked",label: 'User clicks "Start Learning"' },
  { value: "content_added",         label: 'User adds content ("Send to Ella")' },
  { value: "add_content_viewed",    label: "User visits Add Content page" },
  { value: "user_inactive",         label: "User has been inactive for N days" },
] as const;

export const CONDITION_FIELDS = [
  { value: "target_language",  label: "Learning language (from Mixpanel)", type: "string" },
  { value: "country",          label: "Country (ISO code, e.g. US, AM)",   type: "string" },
  { value: "platform",         label: "Platform (iOS / Android / web)",    type: "string" },
  { value: "days_inactive",    label: "Days inactive",                     type: "number" },
  { value: "content_count",    label: "Content items opened",              type: "number" },
  { value: "days_since_signup",label: "Days since first seen",             type: "number" },
] as const;

export const CONDITION_OPERATORS = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "does not equal" },
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" },
  { value: "gte", label: "greater than or equal" },
  { value: "lte", label: "less than or equal" },
] as const;

export const VARIABLES = [
  { name: "{{user_name}}", description: "User's first name", example: "Alice" },
  { name: "{{language}}", description: "Target language", example: "French" },
  { name: "{{native_language}}", description: "Native language", example: "English" },
  { name: "{{days_inactive}}", description: "Days since last session", example: "5" },
  { name: "{{content_count}}", description: "Content items imported", example: "3" },
  { name: "{{content_title}}", description: "Most recently added content title", example: "Le Monde" },
] as const;
