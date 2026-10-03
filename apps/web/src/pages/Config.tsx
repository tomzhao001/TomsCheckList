import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { ChevronDownIcon, ChevronUpIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import type { TemplateBag, TemplateDraftBag } from "@checklist/shared";
import { api } from "@/api";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EntryDialog } from "@/components/EntryDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { moveAt } from "@/format";
import { cn } from "@/lib/utils";

type DraftItem = { key: string; id?: string; name: string; description: string };
type DraftBag = { key: string; id?: string; name: string; items: DraftItem[] };
type DialogState = { kind: "bag" } | { kind: "item"; bagKey: string; itemKey?: string };
type DeleteState = { bagKey: string; itemKey?: string };

let sequence = 0;
function newKey(): string {
  sequence += 1;
  return `new-${sequence}`;
}

function fromTemplate(bags: TemplateBag[]): DraftBag[] {
  return bags.map((bag) => ({
    key: bag.id,
    id: bag.id,
    name: bag.name,
    items: bag.items.map((item) => ({ key: item.id, id: item.id, name: item.name, description: item.description })),
  }));
}

function toPayload(draft: DraftBag[]): TemplateDraftBag[] {
  return draft.map((bag) => ({
    id: bag.id,
    name: bag.name.trim(),
    items: bag.items.map((item) => ({ id: item.id, name: item.name, description: item.description })),
  }));
}

export function ConfigPage({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const [saved, setSaved] = useState<DraftBag[]>([]);
  const [draft, setDraft] = useState<DraftBag[]>([]);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [deleting, setDeleting] = useState<DeleteState | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const dirty = useMemo(() => JSON.stringify(toPayload(draft)) !== JSON.stringify(toPayload(saved)), [draft, saved]);

  useEffect(() => {
    void api<{ bags: TemplateBag[] }>("/api/template")
      .then((body) => {
        setSaved(fromTemplate(body.bags));
        setDraft(fromTemplate(body.bags));
        setReady(true);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "配置没有加载出来"));
  }, []);

  useEffect(() => {
    onDirtyChange(dirty);
    if (!dirty) return;
    setNotice("");
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, onDirtyChange]);

  function updateBag(bagKey: string, update: (bag: DraftBag) => DraftBag) {
    setDraft((list) => list.map((bag) => (bag.key === bagKey ? update(bag) : bag)));
  }

  function openDialog(next: DialogState) {
    setDialogKey((value) => value + 1);
    setDialog(next);
    setDialogOpen(true);
  }

  function confirmDelete(next: DeleteState) {
    setDeleting(next);
    setDeleteOpen(true);
  }

  async function save() {
    if (draft.some((bag) => !bag.name.trim())) {
      setError("袋名不能为空");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = await api<{ bags: TemplateBag[] }>("/api/template", {
        method: "PUT",
        body: JSON.stringify({ bags: toPayload(draft) }),
      });
      setSaved(fromTemplate(body.bags));
      setDraft(fromTemplate(body.bags));
      setNotice("已保存，并同步到当前最新的一次旅行");
    } catch (err) {
      setError(err instanceof Error ? err.message : "没有保存成功");
    } finally {
      setSaving(false);
    }
  }

  const editingBag = dialog?.kind === "item" ? draft.find((bag) => bag.key === dialog.bagKey) : undefined;
  const editingItem = dialog?.kind === "item" && dialog.itemKey ? editingBag?.items.find((item) => item.key === dialog.itemKey) : undefined;
  const deletingBag = deleting ? draft.find((bag) => bag.key === deleting.bagKey) : undefined;
  const deletingItem = deleting?.itemKey ? deletingBag?.items.find((item) => item.key === deleting.itemKey) : undefined;

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl leading-tight font-semibold tracking-tight">清单配置</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          这里的袋子和物品会在新建旅行时复制一份。保存后会同步修改当前最新的一次旅行；已经结束的历史旅行不会改动。
        </p>
      </header>
      <Button size="sm" className="self-start" disabled={!ready} onClick={() => openDialog({ kind: "bag" })}>
        <PlusIcon />
        添加袋子
      </Button>
      <div className="flex flex-col gap-3">
        {draft.map((bag, bagIndex) => (
          <Card key={bag.key} size="sm" className="gap-0 py-0">
            <div className="flex items-center gap-1 border-b border-dashed px-3 py-2">
              <Input
                aria-label="袋名"
                value={bag.name}
                maxLength={40}
                placeholder="袋名"
                className="h-8 flex-1 border-transparent px-1.5 text-base font-medium shadow-none hover:border-input md:text-base"
                onChange={(event) => updateBag(bag.key, (current) => ({ ...current, name: event.target.value }))}
              />
              <IconButton label="上移袋子" disabled={bagIndex === 0} onClick={() => setDraft((list) => moveAt(list, bagIndex, -1))}>
                <ChevronUpIcon />
              </IconButton>
              <IconButton
                label="下移袋子"
                disabled={bagIndex === draft.length - 1}
                onClick={() => setDraft((list) => moveAt(list, bagIndex, 1))}
              >
                <ChevronDownIcon />
              </IconButton>
              <IconButton label="删除袋子" danger onClick={() => confirmDelete({ bagKey: bag.key })}>
                <Trash2Icon />
              </IconButton>
            </div>
            <ul className="px-3 py-1.5">
              {bag.items.map((item, itemIndex) => (
                <li key={item.key} className="flex items-start gap-2 py-1 pl-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">{item.name}</p>
                    {item.description ? <p className="text-xs text-muted-foreground">{item.description}</p> : null}
                  </div>
                  <div className="flex shrink-0 items-center">
                    <IconButton label="编辑物品" onClick={() => openDialog({ kind: "item", bagKey: bag.key, itemKey: item.key })}>
                      <PencilIcon />
                    </IconButton>
                    <IconButton
                      label="上移物品"
                      disabled={itemIndex === 0}
                      onClick={() => updateBag(bag.key, (current) => ({ ...current, items: moveAt(current.items, itemIndex, -1) }))}
                    >
                      <ChevronUpIcon />
                    </IconButton>
                    <IconButton
                      label="下移物品"
                      disabled={itemIndex === bag.items.length - 1}
                      onClick={() => updateBag(bag.key, (current) => ({ ...current, items: moveAt(current.items, itemIndex, 1) }))}
                    >
                      <ChevronDownIcon />
                    </IconButton>
                    <IconButton label="删除物品" danger onClick={() => confirmDelete({ bagKey: bag.key, itemKey: item.key })}>
                      <Trash2Icon />
                    </IconButton>
                  </div>
                </li>
              ))}
              {bag.items.length === 0 ? <li className="py-1 pl-1.5 text-xs text-muted-foreground">还没有物品</li> : null}
            </ul>
            <div className="px-3 pb-2">
              <Button
                variant="ghost"
                size="xs"
                className="text-muted-foreground"
                onClick={() => openDialog({ kind: "item", bagKey: bag.key })}
              >
                <PlusIcon />
                添加物品
              </Button>
            </div>
          </Card>
        ))}
        {ready && draft.length === 0 ? <p className="text-sm text-muted-foreground">还没有袋子。先加一个，再往里面放物品。</p> : null}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {ready ? (
        <div className="flex items-center gap-3">
          <Button className="min-w-32" disabled={!dirty || saving} onClick={() => void save()}>
            {saving ? "正在保存…" : "保存"}
          </Button>
          <span className="text-xs text-muted-foreground">{dirty ? "有未保存的修改" : notice}</span>
        </div>
      ) : null}

      <EntryDialog
        key={dialogKey}
        open={dialogOpen}
        title={dialog?.kind === "bag" ? "添加袋子" : editingItem ? "编辑物品" : `往「${editingBag?.name ?? ""}」添加物品`}
        nameLabel={dialog?.kind === "bag" ? "袋名" : "物品名称"}
        namePlaceholder={dialog?.kind === "bag" ? "例如：洗漱袋" : "例如：牙刷"}
        withDescription={dialog?.kind === "item"}
        initial={editingItem}
        confirmLabel={editingItem ? "确定" : "添加"}
        onOpenChange={setDialogOpen}
        onSubmit={(entry) => {
          if (dialog?.kind === "bag") {
            setDraft((list) => [...list, { key: newKey(), name: entry.name, items: [] }]);
          } else if (dialog?.kind === "item") {
            const itemKey = dialog.itemKey;
            updateBag(dialog.bagKey, (bag) => ({
              ...bag,
              items: itemKey
                ? bag.items.map((item) => (item.key === itemKey ? { ...item, ...entry } : item))
                : [...bag.items, { key: newKey(), ...entry }],
            }));
          }
          setDialogOpen(false);
        }}
      />
      <ConfirmDialog
        open={deleteOpen}
        title={deletingItem ? "删除这个物品？" : "删除这个袋子？"}
        description={
          deletingItem
            ? `「${deletingItem.name}」会从「${deletingBag?.name ?? ""}」里移除，点保存后生效。`
            : `「${deletingBag?.name ?? ""}」和里面的 ${deletingBag?.items.length ?? 0} 件物品会一起移除，点保存后生效。`
        }
        onOpenChange={setDeleteOpen}
        onConfirm={() => {
          if (!deleting) return;
          const { bagKey, itemKey } = deleting;
          if (itemKey) updateBag(bagKey, (bag) => ({ ...bag, items: bag.items.filter((item) => item.key !== itemKey) }));
          else setDraft((list) => list.filter((bag) => bag.key !== bagKey));
        }}
      />
    </div>
  );
}

function IconButton({
  label,
  danger = false,
  className,
  ...props
}: ComponentProps<typeof Button> & { label: string; danger?: boolean }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      title={label}
      className={cn("text-muted-foreground", danger && "hover:bg-destructive/10 hover:text-destructive", className)}
      {...props}
    />
  );
}
