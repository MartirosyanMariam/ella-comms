"use client";
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { setApiEnv } from "@/lib/api";

export type AppEnv = "dev" | "prod";

const EnvContext = createContext<{ env: AppEnv; setEnv: (e: AppEnv) => void }>({
  env: "dev",
  setEnv: () => {},
});

export function EnvProvider({ children }: { children: ReactNode }) {
  const [env, _setEnv] = useState<AppEnv>("dev");

  useEffect(() => {
    const stored = localStorage.getItem("ella-app-env") as AppEnv | null;
    const initial = stored === "prod" ? "prod" : "dev";
    _setEnv(initial);
    setApiEnv(initial);
  }, []);

  function setEnv(e: AppEnv) {
    _setEnv(e);
    setApiEnv(e);
    localStorage.setItem("ella-app-env", e);
  }

  return <EnvContext.Provider value={{ env, setEnv }}>{children}</EnvContext.Provider>;
}

export const useEnv = () => useContext(EnvContext);
