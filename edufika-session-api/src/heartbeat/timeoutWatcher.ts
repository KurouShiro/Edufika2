import { WsHub } from "../services/wsHub";
import { SessionService } from "../services/sessionService";
import { config } from "../config";

export function startHeartbeatTimeoutWatcher(service: SessionService, wsHub: WsHub): () => void {
  const intervalMs = config.heartbeatWatchIntervalSeconds * 1000;
  const timer = setInterval(async () => {
    try {
      const locked = await service.lockTimedOutSessions();
      for (const item of locked) {
        wsHub.broadcast("session_locked", {
          session_id: item.sessionId,
          binding_id: item.bindingId,
          reason: item.reason,
        });
      }

      const archived = await service.archiveAndCleanupEndedSessions();
      for (const item of archived) {
        wsHub.broadcast("session_archived", {
          session_id: item.sessionId,
          status: item.status,
          archived_at: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Heartbeat timeout watcher error", error);
    }
  }, intervalMs);

  return () => clearInterval(timer);
}
