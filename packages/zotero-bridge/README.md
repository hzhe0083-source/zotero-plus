# @zotero-plus/bridge

Local bridge helpers for Zotero.

Zotero 本地桥接层。

It wraps three local surfaces:

- Zotero local API on `23119`
- Zotero connector endpoints on `23119/connector/*`
- `zotero-mcp-plugin` on `23120/mcp`

它封装了三个本地接口：

- Zotero 本地只读 API
- Zotero connector 端点
- `zotero-mcp-plugin`

## Main Capability

The bridge implements a working attachment import path for existing Zotero items:

1. Save PDF as a standalone attachment via `saveStandaloneAttachment`
2. Detect the imported attachment through the local API
3. Re-parent it to the intended existing item through `write_item`

核心用途是给“已有 Zotero 条目挂本地 PDF”提供一条真实可用的路径。

## Environment

- `ZOTERO_API_BASE_URL`
- `ZOTERO_MCP_BASE_URL`
- `ZOTERO_LIBRARY`
- `ZOTERO_LIBRARY_ID`
- `ZOTERO_API_KEY`

## Practical Limitation

This package assumes:

- Zotero desktop is running
- The local API is reachable
- The local connector endpoint is reachable
- `zotero-mcp-plugin` is installed and running

If any of those are missing, real attachment import will fail even though unit tests can still pass with mocks.
