"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { RuleForm } from "@/components/RuleForm";
import { api, type Rule } from "@/lib/api";

export default function EditRulePage({ params }: { params: { id: string } }) {
  const [rule, setRule] = useState<Rule | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getRule(params.id)
      .then(setRule)
      .catch((e) => setError(e.message));
  }, [params.id]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">{rule ? `Edit: ${rule.name}` : "Edit Rule"}</h1>
      </div>
      {error && <p className="text-sm text-destructive">Failed to load rule: {error}</p>}
      {rule ? <RuleForm existingRule={rule} /> : !error && <p className="text-sm text-muted-foreground">Loading…</p>}
    </div>
  );
}
