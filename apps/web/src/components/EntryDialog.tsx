import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type Entry = { name: string; description: string };

export function EntryDialog({
  open,
  title,
  nameLabel,
  namePlaceholder,
  withDescription = false,
  initial,
  confirmLabel,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  title: string;
  nameLabel: string;
  namePlaceholder?: string;
  withDescription?: boolean;
  initial?: Entry;
  confirmLabel: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (entry: Entry) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), description: description.trim() });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="entry-name">{nameLabel}</Label>
            <Input
              id="entry-name"
              autoFocus
              value={name}
              maxLength={40}
              placeholder={namePlaceholder}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          {withDescription ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="entry-description">描述（可空）</Label>
              <Textarea
                id="entry-description"
                value={description}
                maxLength={200}
                placeholder="清单页会用小字显示在名称下面"
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
