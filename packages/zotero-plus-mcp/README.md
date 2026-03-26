# zotero-plus-mcp

A standalone MCP server for common Zotero workflows.

## Tools

- `updateItemFields`
- `createItemWithMetadata`
- `downloadPdf`
- `importAttachment`
- `buildCitationKey`
- `buildChildNoteTemplate`
- `createChildNote`

## Environment

- `ZOTERO_MCP_URL`
  Default: `http://127.0.0.1:23120/mcp`
- `ZOTERO_PLUS_DOWNLOAD_DIR`
  Default: `/tmp/zotero-plus-downloads`
- `ZOTERO_API_BASE_URL`
  Default: `http://127.0.0.1:23119/api`
- `ZOTERO_MCP_BASE_URL`
  Default: `http://127.0.0.1:23120`

## Run

```bash
node server.js
```
