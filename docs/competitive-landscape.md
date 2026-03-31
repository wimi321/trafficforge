# Competitive Landscape

Date checked: 2026-03-31

## Summary

There is still no dominant open-source project that treats AI agents as first-class users of traffic capture workflows. The strongest current tools split across two camps:

- low-level powerhouses like `mitmproxy`, `whistle`, and `proxify`
- polished human-facing products like `HTTP Toolkit`, `Requestly`, `Proxyman`, and `Charles`

TrafficForge is positioned in the gap between those camps: local-first capture plus agent-ready normalization.

## What the market already does well

- `mitmproxy`: programmable interception, replay, protocol depth
- `HTTP Toolkit`: developer-facing product story, explainability, API-focused workflow
- `Requestly`: rule UX, session workflows, migration path from browser extensions
- `Bruno`: local-first philosophy, repository-friendly collaboration model
- `proxify`: sharp CLI information architecture and single-binary distribution

## Market gaps worth owning

- structured session export designed for LLMs instead of raw HAR
- built-in redaction before model handoff
- semantic labels on flows and failures
- approval-aware replay for agents
- a local query surface for automation and future MCP integration

## Primary references

- mitmproxy: https://github.com/mitmproxy/mitmproxy
- HTTP Toolkit: https://github.com/httptoolkit/httptoolkit
- Requestly: https://github.com/requestly/requestly
- whistle: https://github.com/avwo/whistle
- proxify: https://github.com/projectdiscovery/proxify
- Bruno: https://github.com/usebruno/bruno
