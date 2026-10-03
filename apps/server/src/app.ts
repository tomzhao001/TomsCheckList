import { existsSync } from "node:fs";
import { join } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import type { DatabaseSync } from "node:sqlite";
import { registerAuth } from "./auth.js";
import { openDatabase } from "./db.js";
import { ApiError } from "./errors.js";
import {
  createTrip,
  defaultTripTitle,
  deleteTrip,
  getTrip,
  listTemplate,
  listTrips,
  saveTemplate,
  setTripBagChecked,
  setTripItemChecked,
} from "./store.js";
import { optionalTitle, requireChecked, requireDateRange, requirePlace, requireTemplate } from "./validate.js";
import { loadTripWeather, searchPlaces } from "./weather.js";

export type AppOptions = {
  dbPath: string;
  adminPassword: string;
  cookieSecure?: boolean;
  webDir?: string;
};

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const db = openDatabase(options.dbPath);
  app.addHook("onClose", async () => {
    db.close();
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) return reply.code(error.statusCode).send({ error: error.message });
    if (error instanceof SyntaxError) return reply.code(400).send({ error: "请求格式不对" });
    request.log.error(error);
    return reply.code(500).send({ error: "服务器出错了" });
  });

  app.get("/healthz", async () => ({ ok: true }));
  await registerAuth(app, db, {
    adminPassword: options.adminPassword,
    cookieSecure: options.cookieSecure !== false,
  });
  registerRoutes(app, db);

  if (options.webDir && existsSync(join(options.webDir, "index.html"))) {
    await app.register(fastifyStatic, { root: options.webDir, wildcard: false });
    app.setNotFoundHandler(async (request, reply) => {
      const path = request.url.split("?")[0] ?? "";
      if (request.method !== "GET" || path.startsWith("/api/") || path === "/healthz") {
        return reply.code(404).send({ error: "接口不存在" });
      }
      return reply.type("text/html").sendFile("index.html");
    });
  }

  return app;
}

function registerRoutes(app: FastifyInstance, db: DatabaseSync): void {
  app.get("/api/template", async () => ({ bags: listTemplate(db) }));

  app.put("/api/template", async (request) => {
    const body = request.body as { bags?: unknown };
    return { bags: saveTemplate(db, requireTemplate(body?.bags)) };
  });

  app.get("/api/places", async (request) => {
    const query = (request.query as { q?: string }).q ?? "";
    return { places: await searchPlaces(query) };
  });

  app.get("/api/trips", async () => listTrips(db));

  app.post("/api/trips", async (request) => {
    const body = request.body as { title?: unknown; startDate?: unknown; endDate?: unknown; place?: unknown };
    const range = requireDateRange(body?.startDate, body?.endDate);
    const place = requirePlace(body?.place);
    const title = optionalTitle(body?.title) || defaultTripTitle(place.label, range.startDate, range.endDate);
    return createTrip(db, {
      title,
      destinationName: place.name,
      destinationLabel: place.label,
      latitude: place.latitude,
      longitude: place.longitude,
      timezone: place.timezone,
      country: place.country,
      admin1: place.admin1,
      startDate: range.startDate,
      endDate: range.endDate,
    });
  });

  app.get("/api/trips/:id", async (request) => {
    const { id } = request.params as { id: string };
    const trip = getTrip(db, id);
    if (!trip) throw new ApiError(404, "找不到这次旅行");
    return trip;
  });

  app.delete("/api/trips/:id", async (request) => {
    const { id } = request.params as { id: string };
    deleteTrip(db, id);
    return { ok: true };
  });

  app.get("/api/trips/:id/weather", async (request) => {
    const { id } = request.params as { id: string };
    return loadTripWeather(db, id);
  });

  app.post("/api/trips/:tripId/bags/:bagId/check", async (request) => {
    const { tripId, bagId } = request.params as { tripId: string; bagId: string };
    const body = request.body as { checked?: unknown };
    return setTripBagChecked(db, tripId, bagId, requireChecked(body?.checked));
  });

  app.post("/api/trips/:tripId/items/:itemId/check", async (request) => {
    const { tripId, itemId } = request.params as { tripId: string; itemId: string };
    const body = request.body as { checked?: unknown };
    return setTripItemChecked(db, tripId, itemId, requireChecked(body?.checked));
  });
}
