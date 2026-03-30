# Zhuabao

Zhuabao is an AI-native traffic capture workspace: a local proxy that records HTTP flows, attaches light semantic hints, supports declarative rewrite/mock rules, replays captured requests, and exports sanitized prompt packs for agents.

## Why this exists

Classic tools like mitmproxy, HTTP Toolkit, Charles, Proxyman, Requestly, and Fiddler are excellent for humans. They are much less opinionated about what agents need:

- stable JSON instead of giant raw HAR blobs
- built-in redaction before LLM handoff
- semantic notes like auth-flow, graphql-like, json-request
- one-click replay over captured traffic
- searchable local API for automation

Zhuabao is the missing glue layer.

## What ships in this repo

- Real local proxy powered by `mockttp`
- Live dashboard on `http://127.0.0.1:8788`
- Session persistence in `.zhuabao/sessions.json`
- Declarative rules via `zhuabao.rules.yaml`
- Prompt-pack export in JSON or Markdown
- Replay endpoint for captured requests
- WebSocket frame capture hooks

## Quick start

```bash
npm install
npm run dev
```

Then point your app or shell at Zhuabao:

```bash
export HTTP_PROXY=http://127.0.0.1:8787
export HTTPS_PROXY=http://127.0.0.1:8787
curl https://httpbin.org/anything
```

Open the dashboard:

- [http://127.0.0.1:8788](http://127.0.0.1:8788)

## Example rules

Create `zhuabao.rules.yaml`:

```yaml
rules:
  - id: stub-profile
    match:
      method: GET
      urlIncludes: /api/profile
    action:
      type: stub-json
      status: 200
      body:
        name: demo-user
        plan: pro

  - id: add-lab-header
    match:
      urlIncludes: api.example.com
    action:
      type: rewrite-request
      updateHeaders:
        x-zhuabao-lab: enabled
```

Reload rules from the UI or call:

```bash
curl -X POST http://127.0.0.1:8788/api/rules/reload
```

## API

- `GET /api/meta`
- `GET /api/sessions?search=login`
- `GET /api/sessions/:id`
- `POST /api/export`
- `POST /api/replay/:id`
- `POST /api/rules/reload`

Example prompt-pack export:

```bash
curl -X POST http://127.0.0.1:8788/api/export \
  -H 'content-type: application/json' \
  -d '{"search":"auth","format":"markdown"}'
```

## Positioning

Recent research on `2026-03-31` suggests there is still no dominant agent-first capture tool. `mitmproxy` is the best open foundation, `HTTP Toolkit` is the closest product to semantic analysis, and `Proxyman`/`Requestly` shine in workflow UX. Zhuabao is intentionally narrower and more composable: capture, normalize, redact, replay, export.

## Roadmap

- Generated OpenAPI from clustered sessions
- MCP server for agent tool calls
- Approval-gated replay policies
- Better HTTPS onboarding with local CA bootstrap
- Streaming-first protocol views for SSE and gRPC
