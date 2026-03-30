export type Direction = 'request' | 'response';

export interface CaptureBody {
  size: number;
  text?: string;
  encoding?: string;
  truncated: boolean;
}

export interface CaptureMessage {
  headers: Record<string, string | string[] | undefined>;
  body: CaptureBody;
}

export interface CaptureSession {
  id: string;
  protocol: string;
  method: string;
  url: string;
  path: string;
  host: string;
  statusCode?: number;
  request: CaptureMessage;
  response?: CaptureMessage;
  startedAt: string;
  durationMs?: number;
  tags: string[];
  source: 'http' | 'websocket';
  matchedRuleId?: string;
  notes: string[];
  issues: string[];
}

export interface WebSocketFrame {
  streamId: string;
  direction: 'sent' | 'received';
  text?: string;
  isBinary: boolean;
  timestamp: string;
}

export interface SessionFilter {
  search?: string;
  method?: string;
  status?: number;
  limit?: number;
}

export interface ExportOptions {
  ids?: string[];
  search?: string;
  format: 'json' | 'markdown';
}

export interface RedactionOptions {
  headerNames?: string[];
  queryParams?: string[];
}
