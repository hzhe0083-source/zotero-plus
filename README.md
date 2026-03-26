# Zotero-Plus

Zotero-Plus is a small MCP-oriented toolkit for Zotero ingestion and metadata workflows.

Zotero-Plus 是一个面向 MCP 的 Zotero 工具集，主要解决 PDF 导入、条目元数据更新、子笔记生成和本地桥接问题。

## Repository Structure

This repository currently contains three parts:

- `packages/zotero-plus-mcp`
  A standalone MCP server that exposes user-facing tools.
- `packages/zotero-bridge`
  A Node bridge library that reads through Zotero local API and writes through the Zotero Plus bridge addon.
- `packages/zotero-plus-bridge-addon`
  Zotero addon source that exposes a tiny local HTTP write bridge.

仓库当前包含三个部分：

- `packages/zotero-plus-mcp`
  MCP server，本体。
- `packages/zotero-bridge`
  Node 侧桥接库，读取走 Zotero 本地 API，写入走 Zotero Plus bridge addon。
- `packages/zotero-plus-bridge-addon`
  Zotero 插件源码，在 Zotero 内部暴露本地 HTTP 写接口。

## What It Solves

Typical workflow:

1. Download a PDF
2. Import it into Zotero under an existing item
3. Update metadata or create notes programmatically
4. Expose the whole workflow as MCP tools

典型工作流：

1. 下载 PDF
2. 把 PDF 挂到已有 Zotero 条目下
3. 程序化更新元数据或创建子笔记
4. 通过 MCP 工具把整条链路暴露给 AI 客户端

## Runtime Model

Zotero-Plus no longer needs any separate Zotero MCP plugin for its current exposed MCP tools.

Current architecture:

- Reads:
  Zotero local API on `http://127.0.0.1:23119/api`
- Writes:
  Zotero Plus bridge addon on `http://127.0.0.1:23121`

Zotero-Plus 当前暴露的 MCP 工具不再依赖额外的 Zotero MCP 插件。

当前运行模型：

- 读取：
  Zotero 本地 API，默认 `http://127.0.0.1:23119/api`
- 写入：
  Zotero Plus bridge addon，默认 `http://127.0.0.1:23121`

## Prerequisites

- Node.js 20+
- Zotero desktop running locally
- Zotero local API available on `23119`
- Zotero Plus bridge addon installed in Zotero and listening on `23121`

前置条件：

- Node.js 20+
- 本机正在运行 Zotero Desktop
- Zotero 本地 API 可访问，默认 `23119`
- 已安装并启用 Zotero Plus bridge addon，默认监听 `23121`

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
- Real write operations require a running local Zotero environment.

## Can Others Use It Directly?

Mostly yes, but not with zero setup.

Portable now:

- No hard-coded `/home/ryan/...` imports remain in the repository
- Default download directory uses the platform temp directory
- The repo installs and tests cleanly with `npm install && npm test`

Still required locally:

- Zotero
- Zotero local API
- Zotero Plus bridge addon

也就是说：

- 代码路径层面已经基本可移植
- 运行层面仍然需要本地 Zotero 环境
- 现在已经更接近“Zotero + Zotero Plus”
