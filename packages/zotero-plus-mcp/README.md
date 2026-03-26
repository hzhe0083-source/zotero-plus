# zotero-plus-mcp

A standalone MCP server for common Zotero workflows.

一个独立的 MCP server，用来给 Zotero 提供可调用工具。

## Tools

- `updateItemFields`
- `createItemWithMetadata`
- `downloadPdf`
- `importAttachment`
- `buildCitationKey`
- `buildChildNoteTemplate`
- `createChildNote`

## Typical Use

- Update Zotero metadata
- Create a new item with metadata
- Download a PDF
- Import a PDF as an attachment under an existing item
- Generate intake-note templates

## Environment

- `ZOTERO_MCP_URL`
  Default: `http://127.0.0.1:23120/mcp`
- `ZOTERO_PLUS_DOWNLOAD_DIR`
  Default: platform temp directory + `zotero-plus-downloads`
- `ZOTERO_API_BASE_URL`
  Default: `http://127.0.0.1:23119/api`
- `ZOTERO_MCP_BASE_URL`
  Default: `http://127.0.0.1:23120`

环境变量说明：

- `ZOTERO_MCP_URL`
  MCP endpoint，默认 `http://127.0.0.1:23120/mcp`
- `ZOTERO_API_BASE_URL`
  Zotero 本地 API，默认 `http://127.0.0.1:23119/api`
- `ZOTERO_MCP_BASE_URL`
  `zotero-mcp-plugin` 的基础地址，默认 `http://127.0.0.1:23120`
- `ZOTERO_PLUS_DOWNLOAD_DIR`
  PDF 下载目录；默认使用当前平台临时目录

## Run

```bash
node server.js
```

## Note

This package is portable at the source-code level, but real attachment import still depends on a working local Zotero setup.
