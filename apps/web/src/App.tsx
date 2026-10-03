import { useEffect, useState } from "react";
import { api } from "@/api";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChecklistPage } from "@/pages/Checklist";
import { ConfigPage } from "@/pages/Config";
import { LoginPage } from "@/pages/Login";

type Tab = "list" | "config";

export function App() {
  const [user, setUser] = useState<string | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("list");
  const [configDirty, setConfigDirty] = useState(false);
  const [pendingTab, setPendingTab] = useState<Tab | null>(null);

  useEffect(() => {
    void api<{ username: string }>("/api/me")
      .then((body) => setUser(body.username))
      .catch(() => setUser(null));
  }, []);

  if (user === undefined) {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-10">
        <p className="text-sm text-muted-foreground">正在打开…</p>
      </main>
    );
  }
  if (!user) return <LoginPage onLoggedIn={setUser} />;

  function changeTab(next: Tab) {
    if (next === tab) return;
    if (tab === "config" && configDirty) {
      setPendingTab(next);
      return;
    }
    setTab(next);
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <Tabs value={tab} onValueChange={(value) => changeTab(value as Tab)}>
        <TabsList className="w-full">
          <TabsTrigger value="list">清单</TabsTrigger>
          <TabsTrigger value="config">配置</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="mt-3">
          <ChecklistPage />
        </TabsContent>
        <TabsContent value="config" className="mt-3">
          <ConfigPage onDirtyChange={setConfigDirty} />
        </TabsContent>
      </Tabs>
      <ConfirmDialog
        open={pendingTab !== null}
        title="放弃未保存的修改？"
        description="配置里还有没保存的修改，离开后这些修改会丢失。"
        confirmLabel="放弃修改"
        onOpenChange={(open) => {
          if (!open) setPendingTab(null);
        }}
        onConfirm={() => {
          if (pendingTab) setTab(pendingTab);
          setConfigDirty(false);
          setPendingTab(null);
        }}
      />
    </main>
  );
}
