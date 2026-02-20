import { Server as HttpServer } from "http";
import WebSocket, { WebSocketServer } from "ws";

type RealtimeEvent = {
  type: string;
  timestamp: string;
  payload: unknown;
};

export class WsHub {
  private wss: WebSocketServer | null = null;

  attach(server: HttpServer): void {
    this.wss = new WebSocketServer({ server });
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
