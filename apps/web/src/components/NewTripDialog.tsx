import { useState, type FormEvent } from "react";
import { MapPinIcon } from "lucide-react";
import type { Place, TripDetail } from "@checklist/shared";
import { api } from "@/api";
import { CityPickerDialog } from "@/components/CityPickerDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { localISO } from "@/format";
import { cn } from "@/lib/utils";

export function NewTripDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (trip: TripDetail) => void;
}) {
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(localISO());
  const [endDate, setEndDate] = useState(localISO(3));
  const [place, setPlace] = useState<Place | null>(null);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!place) {
      setError("请先选一个目的地");
      return;
    }
    setPending(true);
    setError("");
    try {
      const trip = await api<TripDetail>("/api/trips", {
        method: "POST",
        body: JSON.stringify({ title, startDate, endDate, place }),
      });
      onCreated(trip);
    } catch (err) {
      setError(err instanceof Error ? err.message : "没有建成这次旅行");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <form className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
            <DialogHeader>
              <DialogTitle>新建旅行</DialogTitle>
              <DialogDescription>会按当前配置复制一份袋子和物品，这次旅行之后单独勾选。</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="trip-title">标题（可空）</Label>
              <Input
                id="trip-title"
                value={title}
                maxLength={40}
                placeholder="留空则用目的地和日期"
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="trip-start">出发</Label>
                <Input id="trip-start" type="date" value={startDate} required onChange={(event) => setStartDate(event.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="trip-end">返回</Label>
                <Input id="trip-end" type="date" value={endDate} required onChange={(event) => setEndDate(event.target.value)} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="trip-place">目的地</Label>
              <Button
                id="trip-place"
                type="button"
                variant="outline"
                className="justify-between font-normal"
                onClick={() => setPicking(true)}
              >
                <span className={cn("truncate", !place && "text-muted-foreground")}>{place?.label ?? "选择目的地城市"}</span>
                <MapPinIcon className="text-muted-foreground" />
              </Button>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "正在建立…" : "建立旅行清单"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <CityPickerDialog
        open={picking}
        selected={place}
        onOpenChange={setPicking}
        onPick={(picked) => {
          setPlace(picked);
          setError("");
          setPicking(false);
        }}
      />
    </>
  );
}
