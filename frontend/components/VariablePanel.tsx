"use client";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { VARIABLES } from "@/lib/api";

export function VariablePanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="border rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium bg-muted/50 hover:bg-muted transition-colors"
      >
        <span>Available variables</span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && (
        <div className="px-4 py-3 grid grid-cols-1 gap-2">
          {VARIABLES.map((v) => (
            <div key={v.name} className="flex items-start gap-3 text-sm">
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-primary shrink-0">
                {v.name}
              </code>
              <span className="text-muted-foreground">{v.description}</span>
              <span className="ml-auto text-xs text-muted-foreground italic shrink-0">e.g. "{v.example}"</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
