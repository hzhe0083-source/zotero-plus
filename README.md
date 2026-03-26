# Zotero-Plus

Zotero-Plus is a small MCP-oriented toolkit for Zotero ingestion and metadata workflows.

It is organized as two packages:

- `packages/zotero-plus-mcp`
  A standalone MCP server that exposes user-facing tools for Zotero item updates, note generation, PDF download, and attachment import.
- `packages/zotero-bridge`
  A local bridge library that talks to Zotero's local read API, connector endpoints, and a running `zotero-mcp-plugin` instance.

## What It Solves

This repository focuses on a pragmatic local workflow:

1. Download a PDF
2. Import it into Zotero through a supported local path
3. Re-parent the imported attachment to an existing Zotero item
4. Keep metadata and notes accessible through MCP tools

## Current Import Path

Attachment import does **not** use `POST /api/users/0/items`, because Zotero's local API is read-only for write operations.

The current working path is:

1. `POST /connector/saveStandaloneAttachment`
2. Poll `/api/users/0/items?since=...`
3. Re-parent the imported attachment through `zotero-mcp-plugin` on `http://127.0.0.1:23120/mcp`

## Prerequisites

- Node.js 20+
- Zotero desktop running locally
- Zotero local API available on `http://127.0.0.1:23119/api`
- `zotero-mcp-plugin` running locally on `http://127.0.0.1:23120/mcp`

## Repository Layout

```text
packages/
  zotero-plus-mcp/
  zotero-bridge/
```

## Install

```bash
npm install
```

## Test

```bash
npm test
```

## Notes

- This repository contains original integration code. It does not bundle Zotero source code.
- A running local Zotero environment is still required for real attachment import.

