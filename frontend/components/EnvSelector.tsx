"use client";
import { useEnv, type AppEnv } from "@/lib/env-context";

export function EnvSelector() {
  const { env, setEnv } = useEnv();

  return (
    <div className="flex items-center gap-1 rounded-full border p-0.5 text-xs font-medium">
      <EnvButton label="Dev" value="dev" active={env === "dev"} onClick={() => setEnv("dev")} />
      <EnvButton label="Prod" value="prod" active={env === "prod"} onClick={() => setEnv("prod")} />
    </div>
  );
}

function EnvButton({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: AppEnv;
  active: boolean;
  onClick: () => void;
}) {
  const colors = {
    dev:  active ? "bg-amber-100 text-amber-800 border border-amber-300" : "text-muted-foreground hover:text-foreground",
    prod: active ? "bg-red-100 text-red-800 border border-red-300"       : "text-muted-foreground hover:text-foreground",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full transition-colors ${colors[value]}`}
    >
      {label}
    </button>
  );
}
