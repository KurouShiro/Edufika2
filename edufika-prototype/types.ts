
export type AppState =
  | 'SPLASH'
  | 'LOGIN'
  | 'SELECTION'
  | 'MANUAL'
  | 'SCAN'
  | 'EXAM'
  | 'VIOLATION'
  | 'ADMIN'
  | 'DEV_PANEL'
  | 'SUCCESS'
  | 'SETTINGS';

export interface UserSession {
  token: string;
  role: 'STUDENT' | 'ADMIN' | 'DEVELOPER' | null;
  startTime?: number;
}

export interface ExamConfig {
  url: string;
  isWhitelisted: boolean;
  proctorPin: string;
}

export interface ViolationRecord {
  type: 'BACKGROUND' | 'SCREEN_OFF' | 'RESTART';
  timestamp: number;
}
