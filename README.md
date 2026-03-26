# Zotero-Plus

Zotero-Plus is a small MCP-oriented toolkit for Zotero ingestion and metadata workflows.

Zotero-Plus 是一个面向 MCP 的 Zotero 工具集，主要解决 PDF 导入、条目元数据更新、子笔记生成和本地桥接问题。

It is organized as two packages:

- `packages/zotero-plus-mcp`
  A standalone MCP server that exposes user-facing tools for Zotero item updates, note generation, PDF download, and attachment import.
- `packages/zotero-bridge`
  A local bridge library that talks to Zotero's local read API, connector endpoints, and a running `zotero-mcp-plugin` instance.

仓库当前拆成两个包：

- `packages/zotero-plus-mcp`
  MCP server，本体，直接暴露可供 AI 客户端调用的工具。
- `packages/zotero-bridge`
  本地桥接层，负责和 Zotero 本地 API、connector 端点、`zotero-mcp-plugin` 通信。

## What It Solves

This repository focuses on a pragmatic local workflow:

1. Download a PDF
2. Import it into Zotero through a supported local path
3. Re-parent the imported attachment to an existing Zotero item
4. Keep metadata and notes accessible through MCP tools

它解决的是这样一条实际工作流：

1. 下载 PDF
2. 通过 Zotero 支持的本地写入路径导入
3. 把导入的 attachment 挂到已有条目上
4. 通过 MCP 工具继续读写元数据、笔记和内容

## Current Import Path

Attachment import does **not** use `POST /api/users/0/items`, because Zotero's local API is read-only for write operations.

The current working path is:

1. `POST /connector/saveStandaloneAttachment`
2. Poll `/api/users/0/items?since=...`
3. Re-parent the imported attachment through `zotero-mcp-plugin` on `http://127.0.0.1:23120/mcp`

当前真实可用的导入路径不是直接写 `/api/users/0/items`。

原因是 Zotero 本地只读 API 不支持常规写入。

因此现在走的是：

1. `POST /connector/saveStandaloneAttachment`
2. 轮询 `/api/users/0/items?since=...`
3. 通过 `zotero-mcp-plugin` 的 `write_item` 做 re-parent

## Prerequisites

- Node.js 20+
- Zotero desktop running locally
- Zotero local API available on `http://127.0.0.1:23119/api`
- `zotero-mcp-plugin` running locally on `http://127.0.0.1:23120/mcp`

前置条件：

- Node.js 20+
- 本机正在运行 Zotero Desktop
- Zotero 本地 API 可访问，默认 `http://127.0.0.1:23119/api`
- 本机装有并启用了 `zotero-mcp-plugin`，默认 `http://127.0.0.1:23120/mcp`

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

## Quick Start

```bash
npm install
npm test
```

如果你只是想启动 MCP server：

```bash
cd packages/zotero-plus-mcp
node server.js
```

## Test

```bash
npm test
```

## Notes

- This repository contains original integration code. It does not bundle Zotero source code.
- A running local Zotero environment is still required for real attachment import.

## Can Others Use It Directly?

Mostly yes, but not with zero setup.

What is already portable:

- No hard-coded `/home/ryan/...` source imports remain in the repository
- The default download directory now uses the platform temp directory
- The repo can be installed and tested with `npm install && npm test`

What others still need locally:

- Zotero running
- Local Zotero API enabled
- `zotero-mcp-plugin` installed and running on the expected port, or equivalent configuration via environment variables

如果问“别人 clone 下来是不是完全不用配路径就能直接用”，答案是：

- 代码路径层面：基本可以
- Zotero 本地环境层面：还需要有 Zotero 和 `zotero-mcp-plugin`
- 所以它已经接近可用，但不是“零配置即插即用”
