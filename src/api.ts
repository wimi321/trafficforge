import path from 'node:path';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fetch } from 'undici';
import type { TrafficForgeConfig } from './config.js';
import { buildPromptPack } from './exporter.js';
import { SessionStore } from './storage.js';
import { ProxyService } from './proxy.js';

export async function createApiServer(config: TrafficForgeConfig, store: SessionStore, proxy: ProxyService) {
  const app = Fastify({ logger: false });

  await app.register(fastifyStatic, {
    root: path.join(process.cwd(), 'public'),
    prefix: '/',
  });

  app.get('/api/meta', async () => ({
    stats: store.stats(),
    proxyEnv: proxy.proxyEnv(),
    proxyPort: config.proxyPort,
    dashboardPort: config.dashboardPort,
    rulesPath: config.rulesPath,
  }));

  app.get('/api/sessions', async (request) => {
    const query = request.query as { search?: string; method?: string; status?: string; limit?: string };
    return {
      items: store.list({
        search: query.search,
        method: query.method,
        status: query.status ? Number(query.status) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
      }),
    };
  });

  app.get('/api/sessions/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const session = store.get(params.id);
    if (!session) return reply.status(404).send({ error: 'Not found' });
    return { session, frames: store.getFrames(params.id) };
  });

  app.post('/api/export', async (request) => {
    const body = (request.body as { ids?: string[]; search?: string; format?: 'json' | 'markdown' }) ?? {};
    const format = body.format ?? 'markdown';
    const output = buildPromptPack(store, { ids: body.ids, search: body.search, format });
    return { format, output };
  });

  app.post('/api/replay/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const session = store.get(params.id);
    if (!session) return reply.status(404).send({ error: 'Not found' });

    const response = await fetch(session.url, {
      method: session.method,
      headers: flattenHeaders(session.request.headers),
      body: mayHaveBody(session.method) ? session.request.body.text : undefined,
    });

    return {
      statusCode: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: await response.text(),
    };
  });

  app.post('/api/rules/reload', async () => ({ count: await proxy.reloadRules() }));

  await app.listen({ port: config.dashboardPort, host: '0.0.0.0' });
  return app;
}

function mayHaveBody(method: string): boolean {
  return !['GET', 'HEAD'].includes(method.toUpperCase());
}

function flattenHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers)
      .filter((entry): entry is [string, string | string[]] => Boolean(entry[1]))
      .map(([key, value]) => [key, Array.isArray(value) ? value.join('; ') : value]),
  );
}
