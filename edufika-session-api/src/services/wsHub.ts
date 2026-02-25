import { IncomingMessage, Server as HttpServer } from "http";
import WebSocket, { WebSocketServer } from "ws";

type RealtimeEvent = {
  type: string;
  timestamp: string;
  payload: unknown;
};

type WsHubOptions = {
  authToken?: string;
};

export class WsHub {
  private wss: WebSocketServer | null = null;
  private readonly authToken: string;

  constructor(options: WsHubOptions = {}) {
    this.authToken = options.authToken?.trim() || "";
  }

  attach(server: HttpServer): void {
    this.wss = new WebSocketServer({ noServer: true });

    server.on("upgrade", (request, socket, head) => {
      if (!this.wss) {
        socket.destroy();
        return;
      }

      if (!this.isAuthorizedUpgrade(request)) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.wss?.emit("connection", ws, request);
      });
    });

    this.wss.on("connection", (socket) => {
      socket.send(
        JSON.stringify({
          type: "hello",
          timestamp: new Date().toISOString(),
          payload: { message: "connected to edufika realtime telemetry" },
        })
      );
    });
  }

  private isAuthorizedUpgrade(request: IncomingMessage): boolean {
    if (!this.authToken) {
      return true;
    }

    const headerToken = normalizeHeaderValue(request.headers["x-realtime-token"]);
    const bearerToken = extractBearer(request.headers.authorization);
    const queryToken = extractQueryToken(request.url);
    const providedToken = headerToken || bearerToken || queryToken;

    return Boolean(providedToken && providedToken === this.authToken);
  }

  broadcast(type: string, payload: unknown): void {
    if (!this.wss) return;

    const event: RealtimeEvent = {
      type,
      timestamp: new Date().toISOString(),
      payload,
    };

    const serialized = JSON.stringify(event);
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(serialized);
      }
    }
  }
}

function normalizeHeaderValue(value: string | string[] | undefined): string | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    const first = value[0]?.trim();
    return first || null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function extractBearer(value: string | string[] | undefined): string | null {
  const normalized = normalizeHeaderValue(value);
  if (!normalized) return null;
  const match = normalized.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1]?.trim();
  return token || null;
}

function extractQueryToken(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;

  try {
    const parsed = new URL(rawUrl, "http://localhost");
    const candidate =
      parsed.searchParams.get("ws_token") ||
      parsed.searchParams.get("token") ||
      parsed.searchParams.get("auth");
    const normalized = candidate?.trim();
    return normalized || null;
  } catch {
    return null;
  }
}
