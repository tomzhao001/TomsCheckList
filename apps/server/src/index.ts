import { mkdirSync } from "node:fs";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
mkdirSync(config.dataDir, { recursive: true });
mkdirSync(config.logDir, { recursive: true });

const app = await buildApp({
  dbPath: config.dbPath,
  adminPassword: config.adminPassword,
  cookieSecure: config.cookieSecure,
  webDir: config.webDir,
});

let closing = false;
async function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  console.log(`收到 ${signal}，正在退出`);
  await app.close();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ port: config.port, host: config.host });
} catch (error) {
  if ((error as NodeJS.ErrnoException).code === "EADDRINUSE") {
    console.error(`端口 ${config.port} 已被占用。请先运行 status 查看，或运行 stop 停掉旧进程。`);
    process.exit(1);
  }
  throw error;
}
console.log(`旅行清单已启动：http://${config.host}:${config.port}（数据目录 ${config.dataDir}）`);
