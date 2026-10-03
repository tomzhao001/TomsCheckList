import { useState, type FormEvent } from "react";
import { api } from "@/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginPage({ onLoggedIn }: { onLoggedIn: (username: string) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const body = await api<{ username: string }>("/api/login", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      onLoggedIn(body.username);
    } catch (err) {
      const status = err instanceof Error && "status" in err ? (err as { status: number }).status : 0;
      setError(status === 429 ? "尝试次数过多，请稍后再试" : "密码不正确");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-xl">旅行清单</CardTitle>
          <CardDescription>输入管理员密码，直接进入这一次要带的东西。</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                name="password"
                value={password}
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" disabled={pending || !password}>
              {pending ? "正在进入…" : "进入清单"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
