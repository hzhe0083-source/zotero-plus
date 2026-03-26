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
- Create a new Zotero item
- Download a PDF
- Import a PDF under an existing item
- Generate and create child notes

## Environment

- `ZOTERO_API_BASE_URL`
  Default: `http://127.0.0.1:23119/api`
- `ZOTERO_PLUS_BRIDGE_URL`
  Default: `http://127.0.0.1:23121`
- `ZOTERO_PLUS_DOWNLOAD_DIR`
  Default: platform temp directory + `zotero-plus-downloads`

环境变量说明：

- `ZOTERO_API_BASE_URL`
  Zotero 本地 API，默认 `http://127.0.0.1:23119/api`
- `ZOTERO_PLUS_BRIDGE_URL`
  Zotero Plus bridge addon 地址，默认 `http://127.0.0.1:23121`
- `ZOTERO_PLUS_DOWNLOAD_DIR`
  PDF 下载目录；默认使用当前平台临时目录

## Run

```bash
node server.js
```

## Note

This package no longer requires any separate Zotero MCP plugin for its current exposed tools, but it still requires Zotero plus the Zotero Plus bridge addon running locally.
