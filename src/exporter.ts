import type { CaptureSession, ExportOptions } from './types.js';
import { redactHeaders, redactUrl } from './redact.js';
import type { SessionStore } from './storage.js';

export function buildPromptPack(store: SessionStore, options: ExportOptions): string | object {
  const sessions = options.ids?.length
    ? options.ids.map((id) => store.get(id)).filter(Boolean) as CaptureSession[]
    : store.list({ search: options.search, limit: 50 });

  const normalized = sessions.map((session) => ({
    id: session.id,
    method: session.method,
    url: redactUrl(session.url),
    statusCode: session.statusCode,
    startedAt: session.startedAt,
    durationMs: session.durationMs,
    source: session.source,
    matchedRuleId: session.matchedRuleId,
    notes: session.notes,
    issues: session.issues,
    request: {
      headers: redactHeaders(session.request.headers),
      body: session.request.body,
    },
    response: session.response
      ? {
          headers: redactHeaders(session.response.headers),
          body: session.response.body,
        }
      : undefined,
  }));

  if (options.format === 'json') {
    return {
      generatedAt: new Date().toISOString(),
      summary: summarize(sessions),
      sessions: normalized,
    };
  }

  const summary = summarize(sessions);
  const lines = [
    '# Zhuabao Prompt Pack',
    '',
    `Generated at: ${new Date().toISOString()}`,
    `Captured requests: ${summary.total}`,
    `Failure count: ${summary.failures}`,
    `Top hosts: ${summary.topHosts.join(', ') || 'none'}`,
    '',
    '## Key flows',
    ...normalized.flatMap((session) => [
      `- [${session.statusCode ?? 'pending'}] ${session.method} ${session.url}`,
      `  duration: ${session.durationMs ?? 0}ms; rule: ${session.matchedRuleId ?? 'none'}; notes: ${session.notes.join('; ') || 'none'}`,
      `  request headers: ${inlineJson(session.request.headers)}`,
      `  response headers: ${inlineJson(session.response?.headers ?? {})}`,
    ]),
  ];

  return lines.join('\n');
}

function inlineJson(value: unknown): string {
  return JSON.stringify(value);
}

function summarize(sessions: CaptureSession[]) {
  const failures = sessions.filter((session) => (session.statusCode ?? 0) >= 400).length;
  const hostCounts = new Map<string, number>();
  for (const session of sessions) {
    hostCounts.set(session.host, (hostCounts.get(session.host) ?? 0) + 1);
  }
  const topHosts = [...hostCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([host]) => host);
  return { total: sessions.length, failures, topHosts };
}
