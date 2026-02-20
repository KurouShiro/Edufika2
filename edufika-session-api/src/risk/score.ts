export type RiskEventInput = {
  focus: boolean;
  multi_window: boolean;
  network_state?: string;
  overlay_detected?: boolean;
  accessibility_active?: boolean;
  debug_detected?: boolean;
  emulator_detected?: boolean;
  rooted?: boolean;
};

export function calculateRisk(event: RiskEventInput): number {
  let score = 0;

  if (!event.focus) score += 3;
  if (event.multi_window) score += 5;
  if (event.network_state === "unstable") score += 2;
  if (event.overlay_detected) score += 5;
  if (event.accessibility_active) score += 5;
  if (event.debug_detected || event.emulator_detected || event.rooted) score += 2;

  return score;
}

export function violationSeverityFromType(type: string): number {
  switch (type) {
    case "APP_BACKGROUND":
      return 3;
    case "OVERLAY_DETECTED":
      return 5;
    case "ACCESSIBILITY_ACTIVE":
      return 5;
    case "NETWORK_DROP":
      return 2;
    case "REPEATED_VIOLATION":
      return 6;
    case "MULTI_WINDOW":
      return 4;
    case "FOCUS_LOST":
      return 3;
    case "MEDIA_PROJECTION_ATTEMPT":
      return 2;
    default:
      return 1;
  }
}
