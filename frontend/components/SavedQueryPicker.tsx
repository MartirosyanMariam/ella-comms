"use client";
import { useState, useEffect } from "react";
import { BookMarked, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, type SavedQuery } from "@/lib/api";

interface Props {
  type: "trigger" | "condition";
  currentSql: string;
  onLoad: (sql: string) => void;
}

export function SavedQueryPicker({ type, currentSql, onLoad }: Props) {
  const [queries, setQueries] = useState<SavedQuery[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getSavedQueries(type).then(setQueries).catch(() => {});
  }, [type]);

  async function handleSave() {
    if (!saveName.trim() || !currentSql.trim()) return;
    setSaving(true);
    try {
      const q = await api.createSavedQuery(saveName.trim(), type, currentSql);
      setQueries(prev => [...prev, q].sort((a, b) => a.name.localeCompare(b.name)));
      setSaveName("");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await api.deleteSavedQuery(id);
    setQueries(prev => prev.filter(q => q.id !== id));
    if (queries.length <= 1) setListOpen(false);
  }

  return (
    <div className="space-y-2">
      {/* Save current SQL */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Save current query as…"
          value={saveName}
          onChange={e => setSaveName(e.target.value)}
          className="h-7 text-xs"
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSave(); } }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs shrink-0"
          onClick={handleSave}
          disabled={saving || !saveName.trim() || !currentSql.trim()}
        >
          <Save className="h-3.5 w-3.5 mr-1" />
          Save
        </Button>
      </div>

      {/* Saved list */}
      {queries.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setListOpen(v => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <BookMarked className="h-3.5 w-3.5" />
            {listOpen ? "Hide saved" : `Load saved (${queries.length})`}
          </button>

          {listOpen && (
            <div className="mt-2 border rounded-md divide-y text-sm bg-background shadow-sm">
              {queries.map(q => (
                <div
                  key={q.id}
                  className="flex items-center justify-between px-3 py-2 hover:bg-muted/40 cursor-pointer group"
                  onClick={() => { onLoad(q.sql); setListOpen(false); }}
                >
                  <span className="font-medium truncate">{q.name}</span>
                  <button
                    type="button"
                    title="Delete"
                    onClick={e => handleDelete(q.id, e)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive ml-3 shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
