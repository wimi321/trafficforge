import { getLocal } from 'mockttp';
import type { CompletedRequest, CompletedResponse, Mockttp, WebSocketMessage } from 'mockttp';
import type { TrafficForgeConfig } from './config.js';
import type { CaptureSession } from './types.js';
import { SessionStore } from './storage.js';
import { loadRules, type TrafficForgeRule } from './rules.js';

type MinimalResponse = Pick<CompletedResponse, 'id' | 'statusCode' | 'headers' | 'body' | 'timingEvents'>;

export class ProxyService {
  private proxy: Mockttp | undefined;
  private rules: TrafficForgeRule[] = [];

  constructor(
    private readonly config: TrafficForgeConfig,
    private readonly store: SessionStore,
  ) {}

  async start(): Promise<{ port: number }> {
    this.rules = loadRules(this.config.rulesPath);
    this.proxy = getLocal({
      maxBodySize: this.config.bodyLimit,
      suggestChanges: false,
      recordTraffic: false,
    });
    await this.proxy.start(this.config.proxyPort);
    await this.registerRules();
    await this.bindEvents();
    return { port: this.config.proxyPort };
  }

  async reloadRules(): Promise<number> {
    if (!this.proxy) throw new Error('Proxy not started');
    this.rules = loadRules(this.config.rulesPath);
    await this.proxy.reset();
    await this.registerRules();
    return this.rules.length;
  }

  proxyEnv(): Record<string, string> {
    if (!this.proxy) throw new Error('Proxy not started');
    return {
      HTTP_PROXY: this.proxy.proxyEnv.HTTP_PROXY,
      HTTPS_PROXY: this.proxy.proxyEnv.HTTPS_PROXY,
    };
  }

  async stop(): Promise<void> {
    await this.proxy?.stop();
  }

  private async registerRules(): Promise<void> {
    if (!this.proxy) return;
    for (const rule of this.rules) {
      const builder = createRuleBuilder(this.proxy, rule);
      if (rule.match.urlIncludes) builder.withUrlMatching(new RegExp(escapeRegExp(rule.match.urlIncludes)));
      if (rule.match.urlRegex) builder.withUrlMatching(new RegExp(rule.match.urlRegex));

      if (rule.action.type === 'stub-json') {
        const action = rule.action;
        await builder.thenCallback(async (request) => {
          const body = JSON.stringify(action.body);
          const headers = {
            'content-type': 'application/json',
            ...(action.headers ?? {}),
          };
          this.store.upsert(await buildStubSession(request, rule.id, action.status, headers, body));
          return {
            statusCode: action.status,
            headers,
            body,
          };
        });
        continue;
      }
      if (rule.action.type === 'stub-text') {
        const action = rule.action;
        await builder.thenCallback(async (request) => {
          const headers = {
            'content-type': 'text/plain; charset=utf-8',
            ...(action.headers ?? {}),
          };
          this.store.upsert(await buildStubSession(request, rule.id, action.status, headers, action.body));
          return {
            statusCode: action.status,
            headers,
            body: action.body,
          };
        });
        continue;
      }
      if (rule.action.type === 'rewrite-request') {
        const action = rule.action;
        await builder.thenPassThrough({
          beforeRequest: async () => ({
            headers: action.updateHeaders,
            body: action.replaceBody,
          }),
        });
        continue;
      }
      if (rule.action.type === 'rewrite-response') {
        const action = rule.action;
        await builder.thenPassThrough({
          beforeResponse: async () => ({
            headers: action.updateHeaders,
            body: action.replaceBody,
          }),
        });
      }
    }

    await this.proxy.forUnmatchedRequest().thenPassThrough();
    await this.proxy.forAnyWebSocket().thenPassThrough();
  }

  private async bindEvents(): Promise<void> {
    if (!this.proxy) return;

    await this.proxy.on('request', async (request) => {
      const existing = this.store.get(request.id);
      const session = await toBaseSession(request);
      session.matchedRuleId = matchRuleId(this.rules, request.method, request.url);
      session.notes = existing?.notes ?? inferNotes(session);
      session.issues = existing?.issues ?? [];
      session.statusCode = existing?.statusCode;
      session.durationMs = existing?.durationMs;
      session.response = existing?.response;
      this.store.upsert(session);
    });

    await this.proxy.on('response', async (response) => {
      const existing = this.store.get(response.id);
      if (!existing) return;
      const updated = await applyResponse(existing, response as MinimalResponse);
      this.store.upsert(updated);
    });

    await this.proxy.on('websocket-message-received', async (message) => {
      this.recordFrame(message, 'received');
    });

    await this.proxy.on('websocket-message-sent', async (message) => {
      this.recordFrame(message, 'sent');
    });
  }

  private recordFrame(message: WebSocketMessage, direction: 'sent' | 'received'): void {
    this.store.addFrame({
      streamId: message.streamId,
      direction,
      isBinary: message.isBinary,
      text: message.isBinary ? undefined : Buffer.from(message.content).toString('utf8'),
      timestamp: new Date(message.timingEvents.startTime + (message.eventTimestamp - message.timingEvents.startTimestamp)).toISOString(),
    });
  }
}

function createRuleBuilder(proxy: Mockttp, rule: TrafficForgeRule) {
  const method = rule.match.method?.toUpperCase();
  switch (method) {
    case 'GET':
      return proxy.forGet();
    case 'POST':
      return proxy.forPost();
    case 'PUT':
      return proxy.forPut();
    case 'PATCH':
      return proxy.forPatch();
    case 'DELETE':
      return proxy.forDelete();
    case 'HEAD':
      return proxy.forHead();
    case 'OPTIONS':
      return proxy.forOptions();
    default:
      return proxy.forAnyRequest();
  }
}

function matchRuleId(rules: TrafficForgeRule[], method: string, url: string): string | undefined {
  return rules.find((rule) => {
    if (rule.match.method && rule.match.method.toUpperCase() !== method.toUpperCase()) return false;
    if (rule.match.urlIncludes && !url.includes(rule.match.urlIncludes)) return false;
    if (rule.match.urlRegex && !new RegExp(rule.match.urlRegex).test(url)) return false;
    return true;
  })?.id;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function toBaseSession(request: CompletedRequest): Promise<CaptureSession> {
  const requestText = await safeText(request.body.getText.bind(request.body));
  return {
    id: request.id,
    protocol: request.protocol,
    method: request.method,
    url: request.url,
    path: request.path,
    host: request.destination.hostname,
    startedAt: new Date(request.timingEvents.startTime).toISOString(),
    durationMs: undefined,
    statusCode: undefined,
    source: 'http',
    tags: request.tags,
    matchedRuleId: request.matchedRuleId,
    notes: [],
    issues: [],
    request: {
      headers: request.headers,
      body: {
        size: request.body.buffer.length,
        text: requestText,
        truncated: request.body.buffer.length >= 512_000,
      },
    },
  };
}

async function buildStubSession(
  request: CompletedRequest,
  ruleId: string,
  statusCode: number,
  headers: Record<string, string>,
  bodyText: string,
): Promise<CaptureSession> {
  const base = await toBaseSession(request);
  return {
    ...base,
    matchedRuleId: ruleId,
    statusCode,
    durationMs: 0,
    notes: [...inferNotes(base), 'stubbed'],
    issues: inferIssues(statusCode, bodyText),
    response: {
      headers,
      body: {
        size: Buffer.byteLength(bodyText),
        text: bodyText,
        truncated: false,
      },
    },
  };
}

async function applyResponse(session: CaptureSession, response: MinimalResponse): Promise<CaptureSession> {
  const text = await safeText(response.body.getText.bind(response.body));
  const durationMs = Math.max(0, Math.round((response.timingEvents.responseSentTimestamp ?? response.timingEvents.startTimestamp) - response.timingEvents.startTimestamp));
  const updated: CaptureSession = {
    ...session,
    statusCode: response.statusCode,
    durationMs,
    response: {
      headers: response.headers,
      body: {
        size: response.body.buffer.length,
        text,
        truncated: response.body.buffer.length >= 512_000,
      },
    },
    issues: inferIssues(response.statusCode, text),
  };
  return updated;
}

function inferNotes(session: CaptureSession): string[] {
  const notes: string[] = [];
  const contentType = String(session.request.headers['content-type'] ?? '');
  if (contentType.includes('application/json')) notes.push('json-request');
  if (session.url.includes('/graphql')) notes.push('graphql-like');
  if (session.url.includes('/auth') || session.url.includes('/login')) notes.push('auth-flow');
  return notes;
}

function inferIssues(statusCode: number, bodyText?: string): string[] {
  const issues: string[] = [];
  if (statusCode >= 500) issues.push('server-error');
  if (statusCode === 401 || statusCode === 403) issues.push('auth-failure');
  if (bodyText?.toLowerCase().includes('rate limit')) issues.push('rate-limited');
  return issues;
}

async function safeText(factory: () => Promise<string | undefined>): Promise<string | undefined> {
  try {
    return await factory();
  } catch {
    return undefined;
  }
}
