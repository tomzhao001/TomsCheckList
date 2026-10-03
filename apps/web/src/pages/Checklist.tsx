import { useEffect, useState } from "react";
import { CheckIcon, ChevronDownIcon, HistoryIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toggleBagChecked, toggleItemChecked, type TripBag, type TripDetail, type TripSummary } from "@checklist/shared";
import { api } from "@/api";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { NewTripDialog } from "@/components/NewTripDialog";
import { WeatherStrip } from "@/components/WeatherStrip";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatShortRange, localISO } from "@/format";

const STORAGE_KEY = "checklist.tripId";

function isHistory(trip: Pick<TripSummary, "endDate">, today = localISO()): boolean {
  return trip.endDate < today;
}

function pickDefault(trips: TripSummary[]): TripSummary | undefined {
  const stored = localStorage.getItem(STORAGE_KEY);
  const current = trips.filter((item) => !isHistory(item)).sort((a, b) => a.startDate.localeCompare(b.startDate));
  return trips.find((item) => item.id === stored) ?? current[0] ?? trips[0];
}

export function ChecklistPage() {
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [createKey, setCreateKey] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [ready, setReady] = useState(false);

  async function loadTrips(): Promise<TripSummary[]> {
    const body = await api<{ trips: TripSummary[] }>("/api/trips");
    setTrips(body.trips);
    return body.trips;
  }

  async function openTrip(id: string) {
    setError("");
    try {
      const detail = await api<TripDetail>(`/api/trips/${id}`);
      localStorage.setItem(STORAGE_KEY, id);
      setTrip(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "没有打开这次旅行");
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const pick = pickDefault(await loadTrips());
        if (pick) setTrip(await api<TripDetail>(`/api/trips/${pick.id}`));
      } catch (err) {
        setError(err instanceof Error ? err.message : "清单没有加载出来");
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const readOnly = trip ? isHistory(trip) : true;

  async function checkBag(bag: TripBag, checked: boolean) {
    if (!trip || readOnly) return;
    const previous = trip;
    setTrip({ ...trip, bags: trip.bags.map((item) => (item.id === bag.id ? toggleBagChecked(item, checked) : item)) });
    try {
      setTrip(await api<TripDetail>(`/api/trips/${trip.id}/bags/${bag.id}/check`, { method: "POST", body: JSON.stringify({ checked }) }));
    } catch (err) {
      setTrip(previous);
      setError(err instanceof Error ? err.message : "勾选失败");
    }
  }

  async function checkItem(bag: TripBag, itemId: string, checked: boolean) {
    if (!trip || readOnly) return;
    const previous = trip;
    setTrip({
      ...trip,
      bags: trip.bags.map((item) => (item.id === bag.id ? toggleItemChecked(item, itemId, checked) : item)),
    });
    try {
      setTrip(await api<TripDetail>(`/api/trips/${trip.id}/items/${itemId}/check`, { method: "POST", body: JSON.stringify({ checked }) }));
    } catch (err) {
      setTrip(previous);
      setError(err instanceof Error ? err.message : "勾选失败");
    }
  }

  async function removeTrip(id: string) {
    setError("");
    try {
      await api(`/api/trips/${id}`, { method: "DELETE" });
      localStorage.removeItem(STORAGE_KEY);
      setTrip(null);
      const pick = pickDefault(await loadTrips());
      if (pick) await openTrip(pick.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "没有删掉这次旅行");
    }
  }

  function startCreating() {
    setCreateKey((value) => value + 1);
    setCreating(true);
  }

  if (!ready) return <p className="text-sm text-muted-foreground">正在打开清单…</p>;

  const progress = countProgress(trip?.bags ?? []);

  return (
    <div className="flex flex-col gap-4">
      {trip ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <Button size="sm" onClick={startCreating}>
              <PlusIcon />
              新建
            </Button>
            <TripMenu trips={trips} currentId={trip.id} onOpen={(id) => void openTrip(id)} onDelete={() => setConfirmDelete(true)} />
          </div>
          <header>
            <h1 className="text-2xl leading-tight font-semibold tracking-tight">{trip.title}</h1>
            <p className="mt-1 text-sm">{formatShortRange(trip.startDate, trip.endDate)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {trip.destinationLabel} · 已勾选 {progress.done} / {progress.total}
              {readOnly ? " · 历史记录，只能查看" : ""}
            </p>
          </header>
          <WeatherStrip tripId={trip.id} />
          <div className="flex flex-col gap-3">
            {trip.bags.map((bag) => (
              <BagCard
                key={bag.id}
                bag={bag}
                readOnly={readOnly}
                onCheckBag={(checked) => void checkBag(bag, checked)}
                onCheckItem={(itemId, checked) => void checkItem(bag, itemId, checked)}
              />
            ))}
            {trip.bags.length === 0 ? (
              <p className="text-sm text-muted-foreground">这次旅行还没有袋子，可以去「配置」里添加。</p>
            ) : null}
          </div>
        </>
      ) : (
        <Card className="items-center text-center">
          <CardHeader className="w-full">
            <CardTitle className="text-xl">还没有旅行</CardTitle>
            <CardDescription>新建一次，就会按配置里的袋子抄一份清单。</CardDescription>
          </CardHeader>
          <Button onClick={startCreating}>
            <PlusIcon />
            新建旅行
          </Button>
        </Card>
      )}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <NewTripDialog
        key={createKey}
        open={creating}
        onOpenChange={setCreating}
        onCreated={(created) => {
          setCreating(false);
          setTrip(created);
          localStorage.setItem(STORAGE_KEY, created.id);
          void loadTrips();
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="删除这次旅行？"
        description={trip ? `「${trip.title}」的清单和勾选记录都会被删除，不能恢复。` : undefined}
        onOpenChange={setConfirmDelete}
        onConfirm={() => {
          if (trip) void removeTrip(trip.id);
        }}
      />
    </div>
  );
}

function BagCard({
  bag,
  readOnly,
  onCheckBag,
  onCheckItem,
}: {
  bag: TripBag;
  readOnly: boolean;
  onCheckBag: (checked: boolean) => void;
  onCheckItem: (itemId: string, checked: boolean) => void;
}) {
  const done = bag.items.filter((item) => item.checked).length;
  return (
    <Card size="sm" className="gap-0 py-0">
      <label className="flex items-center gap-2.5 border-b border-dashed px-4 py-2.5">
        <Checkbox checked={bag.checked} disabled={readOnly} onCheckedChange={(value) => onCheckBag(value === true)} />
        <span className={cn("min-w-0 flex-1 text-base font-medium", bag.checked && "text-muted-foreground line-through")}>
          {bag.name}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {bag.items.length === 0 ? "空袋子" : `${done}/${bag.items.length}`}
        </span>
      </label>
      <ul className="px-4 py-1.5">
        {bag.items.map((item) => (
          <li key={item.id}>
            <label className="flex items-start gap-2.5 py-1">
              <Checkbox
                className="mt-0.5"
                checked={item.checked}
                disabled={readOnly}
                onCheckedChange={(value) => onCheckItem(item.id, value === true)}
              />
              <span className="min-w-0">
                <span className={cn("block text-sm leading-snug", item.checked && "text-muted-foreground line-through")}>
                  {item.name}
                </span>
                {item.description ? <span className="block text-xs text-muted-foreground">{item.description}</span> : null}
              </span>
            </label>
          </li>
        ))}
        {bag.items.length === 0 ? <li className="py-1 text-xs text-muted-foreground">没有物品，直接勾选袋子即可</li> : null}
      </ul>
    </Card>
  );
}

function TripMenu({
  trips,
  currentId,
  onOpen,
  onDelete,
}: {
  trips: TripSummary[];
  currentId: string;
  onOpen: (id: string) => void;
  onDelete: () => void;
}) {
  const today = localISO();
  const current = trips.filter((item) => !isHistory(item, today));
  const history = trips.filter((item) => isHistory(item, today));
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <HistoryIcon />
          历史
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <TripGroup label="当前" trips={current} currentId={currentId} onOpen={onOpen} />
        <DropdownMenuSeparator />
        <TripGroup label="历史" trips={history} currentId={currentId} onOpen={onOpen} />
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2Icon />
          删除这次旅行
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TripGroup({
  label,
  trips,
  currentId,
  onOpen,
}: {
  label: string;
  trips: TripSummary[];
  currentId: string;
  onOpen: (id: string) => void;
}) {
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel className="text-xs text-muted-foreground">{label}</DropdownMenuLabel>
      {trips.length === 0 ? (
        <DropdownMenuItem disabled className="text-xs">
          暂无
        </DropdownMenuItem>
      ) : null}
      {trips.map((item) => (
        <DropdownMenuItem key={item.id} onSelect={() => onOpen(item.id)}>
          <span className="min-w-0 flex-1">
            <span className="block truncate">{item.title}</span>
            <span className="block text-xs text-muted-foreground">{formatShortRange(item.startDate, item.endDate)}</span>
          </span>
          {item.id === currentId ? <CheckIcon /> : null}
        </DropdownMenuItem>
      ))}
    </DropdownMenuGroup>
  );
}

function countProgress(bags: TripBag[]): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const bag of bags) {
    if (bag.items.length === 0) {
      total += 1;
      if (bag.checked) done += 1;
    } else {
      total += bag.items.length;
      done += bag.items.filter((item) => item.checked).length;
    }
  }
  return { done, total };
}
