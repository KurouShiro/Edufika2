
export type AppScreen = 
  | 'SPLASH' 
  | 'LOGIN' 
  | 'EXAM_SELECTION' 
  | 'MANUAL_INPUT' 
  | 'QR_SCAN'
  | 'EXAM_BROWSER' 
  | 'VIOLATION' 
  | 'SUCCESS' 
  | 'ADMIN_DASHBOARD' 
  | 'DEV_PANEL'
  | 'SETTINGS';

export interface SessionInfo {
  token: string;
  type: 'STUDENT' | 'ADMIN' | 'DEVELOPER';
  expiresAt: number;
}

export interface ViolationEvent {
  id: string;
  type: string;
  timestamp: number;
  score: number;
}

export interface TokenStatus {
  id: string;
  studentName: string;
  status: 'ACTIVE' | 'EXPIRED' | 'LOCKED' | 'FINISHED';
  riskScore: number;
}
