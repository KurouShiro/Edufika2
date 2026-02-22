import { WsHub } from "../services/wsHub";
import { SessionService } from "../services/sessionService";
import { config } from "../config";

export function startHeartbeatTimeoutWatcher(service: SessionService, wsHub: WsHub): () => void {
  const intervalMs = config.heartbeatWatchIntervalSeconds * 1000;
  const timer = setInterval(async () => {
    try {
      const transitions = await service.lockTimedOutSessions();
      for (const item of transitions) {
        if (item.state === "LOCKED") {
          wsHub.broadcast("session_locked", {
            session_id: item.sessionId,
            binding_id: item.bindingId,
            reason: item.reason,
          });
          continue;
        }

        if (item.state === "DEGRADED") {
          wsHub.broadcast("session_degraded", {
            session_id: item.sessionId,
            binding_id: item.bindingId,
            reason: item.reason,
          });
          continue;
        }

        if (item.state === "SUSPENDED") {
          wsHub.broadcast("session_suspended", {
            session_id: item.sessionId,
            binding_id: item.bindingId,
            reason: item.reason,
          });
          continue;
        }

        if (item.state === "IN_PROGRESS") {
          wsHub.broadcast("session_recovered", {
            session_id: item.sessionId,
            binding_id: item.bindingId,
            reason: item.reason,
          });
        }
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
