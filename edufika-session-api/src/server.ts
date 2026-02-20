import "dotenv/config";
import http from "node:http";
import os from "node:os";
import express from "express";
import { ZodError } from "zod";
import { config } from "./config";
import { dbPool } from "./db/pool";
import { startHeartbeatTimeoutWatcher } from "./heartbeat/timeoutWatcher";
import { createAdminRouter } from "./routes/admin";
import { createExamRouter } from "./routes/exam";
import { createSessionRouter } from "./routes/session";
import { ApiError, SessionService } from "./services/sessionService";
import { WsHub } from "./services/wsHub";
import { httpsOnlyMiddleware } from "./middleware/httpsOnly";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(httpsOnlyMiddleware);

const wsHub = new WsHub();
const sessionService = new SessionService(wsHub);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "edufika-session-api", now: new Date().toISOString() });
});

app.use("/session", createSessionRouter(sessionService));
app.use("/admin", createAdminRouter(sessionService));
app.use("/exam", createExamRouter(sessionService));

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({ error: "Invalid payload", details: error.flatten() });
    return;
  }

  console.error("Unhandled server error", error);
  res.status(500).json({ error: "Internal server error" });
});

const server = http.createServer(app);
wsHub.attach(server);

const stopWatcher = startHeartbeatTimeoutWatcher(sessionService, wsHub);

server.listen(config.port, config.host, () => {
  console.log(`Edufika Session API listening on ${config.host}:${config.port}`);
  const lanIps = getLanIpv4Addresses();
  if (lanIps.length > 0) {
    console.log("Phone test URLs:");
    lanIps.forEach((ip) => {
      console.log(`  HTTP  : http://${ip}:${config.port}`);
      console.log(`  WS    : ws://${ip}:${config.port}`);
    });
  }
});

async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}. Shutting down...`);
  stopWatcher();
  server.close();
  await dbPool.end();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

function getLanIpv4Addresses(): string[] {
  const nets = os.networkInterfaces();
  const output: string[] = [];
  for (const entries of Object.values(nets)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry.family === "IPv4" && !entry.internal) {
        output.push(entry.address);
      }
    }
  }
  return Array.from(new Set(output));
}
