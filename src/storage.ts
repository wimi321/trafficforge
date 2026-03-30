import fs from 'node:fs';
import path from 'node:path';
import type { CaptureSession, SessionFilter, WebSocketFrame } from './types.js';

interface PersistedState {
  sessions: CaptureSession[];
  websocketFrames: WebSocketFrame[];
}

export class SessionStore {
  private readonly filePath: string;
  private readonly sessions = new Map<string, CaptureSession>();
  private websocketFrames: WebSocketFrame[] = [];

  constructor(dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.filePath = path.join(dataDir, 'sessions.json');
    this.load();
  }

  upsert(session: CaptureSession): void {
    this.sessions.set(session.id, session);
    this.persist();
  }

  get(id: string): CaptureSession | undefined {
    return this.sessions.get(id);
  }

  list(filter: SessionFilter = {}): CaptureSession[] {
    const { search, method, status, limit = 150 } = filter;
    const normalized = search?.toLowerCase();
    return [...this.sessions.values()]
      .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
      .filter((session) => {
        if (method && session.method.toLowerCase() !== method.toLowerCase()) return false;
        if (typeof status === 'number' && session.statusCode !== status) return false;
        if (!normalized) return true;
        return [session.method, session.url, session.host, session.path, session.statusCode?.toString()]
          .filter(Boolean)
          .some((item) => item?.toLowerCase().includes(normalized));
      })
      .slice(0, limit);
  }

  addFrame(frame: WebSocketFrame): void {
    this.websocketFrames.unshift(frame);
    this.websocketFrames = this.websocketFrames.slice(0, 2000);
    this.persist();
  }

  getFrames(streamId: string): WebSocketFrame[] {
    return this.websocketFrames.filter((frame) => frame.streamId === streamId);
  }

  stats() {
    const sessions = [...this.sessions.values()];
    const total = sessions.length;
    const failures = sessions.filter((item) => (item.statusCode ?? 0) >= 400).length;
    const uniqueHosts = new Set(sessions.map((item) => item.host)).size;
    return { total, failures, uniqueHosts, websocketFrames: this.websocketFrames.length };
  }

  private load(): void {
    if (!fs.existsSync(this.filePath)) return;
    const raw = fs.readFileSync(this.filePath, 'utf8');
    if (!raw.trim()) return;
    const state = JSON.parse(raw) as PersistedState;
    for (const session of state.sessions ?? []) {
      this.sessions.set(session.id, session);
    }
    this.websocketFrames = state.websocketFrames ?? [];
  }

  private persist(): void {
    const state: PersistedState = {
      sessions: [...this.sessions.values()].slice(-2000),
      websocketFrames: this.websocketFrames,
    };
    fs.writeFileSync(this.filePath, JSON.stringify(state, null, 2));
  }
}
