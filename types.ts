export interface WindowState {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  mouseX: number;
  mouseY: number;
  lastSeen: number;
}

export type MessageType = 'HELLO' | 'UPDATE' | 'GOODBYE' | 'EVENT';

export interface AppEvent {
  type: 'SHOCKWAVE';
  x: number; // World coordinates
  y: number;
  timestamp: number;
  originId: string;
}

export interface SyncMessage extends Partial<WindowState> {
  type: MessageType;
  event?: AppEvent;
}

export interface WorldBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}