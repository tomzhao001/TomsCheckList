import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addDays, todayInTimeZone } from "@checklist/shared";
import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

type Headers = { cookie: string };
type Bag = { id: string; name: string; checked: boolean; items: Array<{ id: string; name: string; description: string; checked: boolean }> };

const TODAY = todayInTimeZone("Asia/Shanghai");
const HANGZHOU = {
  id: 1,
  name: "杭州",
  latitude: 30.27,
  longitude: 120.15,
  timezone: "Asia/Shanghai",
  country: "中国",
  admin1: "浙江",
};

async function withApp(run: (app: FastifyInstance, headers: Headers) => Promise<void>) {
  const dir = mkdtempSync(join(tmpdir(), "checklist-"));
  const app = await buildApp({
    dbPath: join(dir, "checklist.db"),
    adminPassword: "secret",
    cookieSecure: false,
  });
  try {
    const login = await app.inject({ method: "POST", url: "/api/login", payload: { password: "secret" } });
    await run(app, { cookie: cookieFrom(login.headers) });
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

function cookieFrom(headers: Record<string, string | string[] | undefined>): string {
  const raw = headers["set-cookie"];
  const line = Array.isArray(raw) ? raw[0] : raw;
  return (line ?? "").split(";")[0] ?? "";
}

async function putTemplate(app: FastifyInstance, headers: Headers, bags: unknown): Promise<Bag[]> {
  const res = await app.inject({ method: "PUT", url: "/api/template", headers, payload: { bags } });
  expect(res.statusCode).toBe(200);
  return res.json().bags as Bag[];
}

async function createTrip(app: FastifyInstance, headers: Headers, startOffset: number, endOffset: number) {
  const res = await app.inject({
    method: "POST",
    url: "/api/trips",
    headers,
    payload: { startDate: addDays(TODAY, startOffset), endDate: addDays(TODAY, endOffset), place: HANGZHOU },
  });
  expect(res.statusCode).toBe(200);
  return res.json() as { id: string; bags: Bag[] };
}

async function getTrip(app: FastifyInstance, headers: Headers, id: string) {
  return (await app.inject({ method: "GET", url: `/api/trips/${id}`, headers })).json() as { bags: Bag[] };
}

describe("登录", () => {
  it("密码正确后可以访问接口，错误密码会被拒绝", async () => {
    const dir = mkdtempSync(join(tmpdir(), "checklist-"));
    const app = await buildApp({ dbPath: join(dir, "checklist.db"), adminPassword: "secret", cookieSecure: false });
    try {
      const denied = await app.inject({ method: "GET", url: "/api/me" });
      expect(denied.statusCode).toBe(401);

      const wrong = await app.inject({ method: "POST", url: "/api/login", payload: { password: "nope" } });
      expect(wrong.statusCode).toBe(401);

      const login = await app.inject({ method: "POST", url: "/api/login", payload: { password: "secret" } });
      expect(login.statusCode).toBe(200);
      const me = await app.inject({ method: "GET", url: "/api/me", headers: { cookie: cookieFrom(login.headers) } });
      expect(me.statusCode).toBe(200);
      expect(me.json()).toEqual({ username: "admin" });
    } finally {
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("清单配置", () => {
  it("一次保存整份配置：新增、改名、排序、删除", async () => {
    await withApp(async (app, headers) => {
      const first = await putTemplate(app, headers, [
        { name: "证件袋", items: [{ name: "护照", description: "原件" }, { name: "身份证" }] },
        { name: "洗漱袋", items: [] },
      ]);
      expect(first.map((bag) => bag.name)).toEqual(["证件袋", "洗漱袋"]);

      const [docs, wash] = first as [Bag, Bag];
      const next = await putTemplate(app, headers, [
        { id: wash.id, name: "洗漱包", items: [{ name: "牙刷", description: "" }] },
        { id: docs.id, name: "证件袋", items: [{ id: docs.items[1]!.id, name: "身份证", description: "" }] },
      ]);
      expect(next.map((bag) => bag.name)).toEqual(["洗漱包", "证件袋"]);
      expect(next[1]!.items.map((item) => item.name)).toEqual(["身份证"]);

      const stale = await app.inject({
        method: "PUT",
        url: "/api/template",
        headers,
        payload: { bags: [{ id: "missing", name: "x", items: [] }] },
      });
      expect(stale.statusCode).toBe(409);
    });
  });

  it("保存配置会同步到当前最新一次，并保留勾选状态", async () => {
    await withApp(async (app, headers) => {
      const [docs] = (await putTemplate(app, headers, [
        { name: "证件袋", items: [{ name: "护照", description: "原件，不要放托运" }, { name: "签证" }] },
      ])) as [Bag];
      const trip = await createTrip(app, headers, 2, 4);
      expect(trip.bags[0]!.items[0]).toMatchObject({ name: "护照", description: "原件，不要放托运", checked: false });

      const passportId = trip.bags[0]!.items[0]!.id;
      await app.inject({ method: "POST", url: `/api/trips/${trip.id}/items/${passportId}/check`, headers, payload: { checked: true } });

      const passport = docs.items[0]!;
      await putTemplate(app, headers, [
        {
          id: docs.id,
          name: "文件袋",
          items: [
            { id: passport.id, name: "护照", description: "放随身包" },
            { name: "机票行程单", description: "" },
          ],
        },
        { name: "药品袋", items: [] },
      ]);

      const synced = await getTrip(app, headers, trip.id);
      expect(synced.bags.map((bag) => bag.name)).toEqual(["文件袋", "药品袋"]);
      expect(synced.bags[0]!.items.map((item) => [item.name, item.description, item.checked])).toEqual([
        ["护照", "放随身包", true],
        ["机票行程单", "", false],
      ]);
      expect(synced.bags[0]!.checked).toBe(false);
    });
  });

  it("历史旅行和不是最新的那次都不会被改动", async () => {
    await withApp(async (app, headers) => {
      const [docs] = (await putTemplate(app, headers, [{ name: "证件袋", items: [{ name: "护照" }] }])) as [Bag];
      const older = await createTrip(app, headers, 1, 3);
      const latest = await createTrip(app, headers, 5, 6);
      const history = await createTrip(app, headers, -5, -1);

      await putTemplate(app, headers, [{ id: docs.id, name: "文件袋", items: [] }]);

      expect((await getTrip(app, headers, latest.id)).bags.map((bag) => [bag.name, bag.items.length])).toEqual([["文件袋", 0]]);
      expect((await getTrip(app, headers, older.id)).bags.map((bag) => [bag.name, bag.items.length])).toEqual([["证件袋", 1]]);
      expect((await getTrip(app, headers, history.id)).bags.map((bag) => [bag.name, bag.items.length])).toEqual([["证件袋", 1]]);
    });
  });
});

describe("勾选", () => {
  it("勾选袋子会勾上全部物品，取消一件后袋子也取消", async () => {
    await withApp(async (app, headers) => {
      await putTemplate(app, headers, [
        { name: "洗漱袋", items: [{ name: "牙刷", description: "充电线另放" }, { name: "牙膏" }] },
      ]);
      const trip = await createTrip(app, headers, 0, 1);
      const bagId = trip.bags[0]!.id;
      const checked = await app.inject({
        method: "POST",
        url: `/api/trips/${trip.id}/bags/${bagId}/check`,
        headers,
        payload: { checked: true },
      });
      expect(checked.json().bags[0].items.every((item: { checked: boolean }) => item.checked)).toBe(true);
      const partial = await app.inject({
        method: "POST",
        url: `/api/trips/${trip.id}/items/${trip.bags[0]!.items[0]!.id}/check`,
        headers,
        payload: { checked: false },
      });
      expect(partial.json().bags[0].checked).toBe(false);
    });
  });
});
