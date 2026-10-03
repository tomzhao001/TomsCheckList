import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

export const DEFAULT_PORT = 3711;

type Env = Record<string, string | undefined>;

export type ChecklistConfig = {
  envFile: string;
  host: string;
  port: number;
  dataDir: string;
  dbPath: string;
  logDir: string;
  webDir: string;
  adminPassword: string;
  cookieSecure: boolean;
};

export function defaultDataDir(platform: NodeJS.Platform = process.platform, env: Env = process.env, home = homedir()): string {
  if (platform === "win32") return join(env.LOCALAPPDATA || join(home, "AppData", "Local"), "TomsCheckList");
  if (platform === "darwin") return join(home, "Library", "Application Support", "TomsCheckList");
  return join(env.XDG_DATA_HOME || join(home, ".local", "share"), "toms-checklist");
}

export function resolveEnvFile(platform: NodeJS.Platform = process.platform, env: Env = process.env, home = homedir()): string {
  if (env.CHECKLIST_ENV_FILE) return resolve(env.CHECKLIST_ENV_FILE);
  return join(defaultDataDir(platform, env, home), "checklist.env");
}

export function readEnvFile(file: string): Env {
  if (!existsSync(file)) return {};
  return parseEnv(readFileSync(file, "utf8"));
}

export function loadConfig(
  env: Env = process.env,
  platform: NodeJS.Platform = process.platform,
  home = homedir(),
): ChecklistConfig {
  const envFile = resolveEnvFile(platform, env, home);
  const merged: Env = { ...readEnvFile(envFile), ...definedOnly(env) };
  const adminPassword = merged.ADMIN_PASSWORD ?? "";
  if (!adminPassword) throw new Error(`ADMIN_PASSWORD is required (set it in ${envFile})`);
  const dataDir = resolve(merged.DATA_DIR || defaultDataDir(platform, env, home));
  return {
    envFile,
    host: merged.HOST || "127.0.0.1",
    port: toPort(merged.PORT, DEFAULT_PORT),
    dataDir,
    dbPath: join(dataDir, "checklist.db"),
    logDir: join(dataDir, "logs"),
    webDir: resolve(merged.WEB_DIR || join(dirname(fileURLToPath(import.meta.url)), "..", "public")),
    adminPassword,
    cookieSecure: merged.COOKIE_SECURE !== "false",
  };
}

function definedOnly(env: Env): Env {
  return Object.fromEntries(Object.entries(env).filter((entry) => entry[1] !== undefined));
}

function toPort(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`无效端口：${value}`);
  return port;
}
