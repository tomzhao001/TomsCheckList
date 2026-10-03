import { useEffect, useState } from "react";
import { SearchIcon } from "lucide-react";
import type { Place } from "@checklist/shared";
import { api } from "@/api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function CityPickerDialog({
  open,
  selected,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  selected: Place | null;
  onOpenChange: (open: boolean) => void;
  onPick: (place: Place) => void;
}) {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setPlaces([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    let stale = false;
    const timer = window.setTimeout(() => {
      void api<{ places: Place[] }>(`/api/places?q=${encodeURIComponent(q)}`)
        .then((body) => {
          if (stale) return;
          setPlaces(body.places);
          setError("");
        })
        .catch((err: unknown) => {
          if (stale) return;
          setPlaces([]);
          setError(err instanceof Error ? err.message : "搜索失败");
        })
        .finally(() => {
          if (!stale) setSearching(false);
        });
    }, 300);
    return () => {
      stale = true;
      window.clearTimeout(timer);
    };
  }, [open, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4">
        <DialogHeader>
          <DialogTitle>选择目的地</DialogTitle>
          <DialogDescription>输入城市名搜索，点一下即可选中。</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            placeholder="例如：杭州、京都"
            className="pl-8"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="-mx-2 flex max-h-72 min-h-24 flex-col overflow-y-auto">
          {places.map((item) => {
            const [name, ...rest] = item.label.split("，");
            const active = selected?.label === item.label && selected.latitude === item.latitude;
            return (
              <button
                type="button"
                key={`${item.id}-${item.latitude}-${item.longitude}`}
                className={cn("rounded-md px-2 py-2 text-left text-sm hover:bg-muted", active && "bg-muted")}
                onClick={() => onPick(item)}
              >
                <span className="font-medium">{name}</span>
                {rest.length ? <span className="ml-2 text-xs text-muted-foreground">{rest.join("，")}</span> : null}
              </button>
            );
          })}
          {places.length === 0 ? (
            <p className="px-2 py-2 text-sm text-muted-foreground">
              {error || (searching ? "正在搜索…" : query.trim() ? "没有找到这个地方" : "先输入一个城市名")}
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
