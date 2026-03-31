import { describe, expect, it } from 'vitest';
import { SessionStore } from '../src/storage.js';
import { buildPromptPack } from '../src/exporter.js';
import fs from 'node:fs';
import path from 'node:path';

describe('buildPromptPack', () => {
  it('redacts sensitive headers and urls', () => {
    const tmpDir = fs.mkdtempSync(path.join(process.cwd(), 'tmp-trafficforge-'));
    const store = new SessionStore(tmpDir);
    store.upsert({
      id: '1',
      protocol: 'https',
      method: 'GET',
      url: 'https://example.com/foo?token=secret',
      path: '/foo?token=secret',
      host: 'example.com',
      startedAt: new Date('2026-03-31T00:00:00.000Z').toISOString(),
      statusCode: 401,
      durationMs: 120,
      source: 'http',
      tags: [],
      matchedRuleId: undefined,
      notes: ['auth-flow'],
      issues: ['auth-failure'],
      request: {
        headers: { authorization: 'Bearer secret' },
        body: { size: 0, truncated: false },
      },
      response: {
        headers: { 'set-cookie': 'abc' },
        body: { size: 0, truncated: false },
      },
    });

    const markdown = buildPromptPack(store, { format: 'markdown' }) as string;
    expect(markdown).toContain('[REDACTED]');
    expect(markdown).not.toContain('secret');
  });
});
