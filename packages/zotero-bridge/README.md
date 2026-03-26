# @zotero-plus/bridge

Local bridge helpers for Zotero.

It wraps three local surfaces:

- Zotero local API on `23119`
- Zotero connector endpoints on `23119/connector/*`
- `zotero-mcp-plugin` on `23120/mcp`

## Main Capability

The bridge implements a working attachment import path for existing Zotero items:

1. Save PDF as a standalone attachment via `saveStandaloneAttachment`
2. Detect the imported attachment through the local API
3. Re-parent it to the intended existing item through `write_item`

## Environment

- `ZOTERO_API_BASE_URL`
- `ZOTERO_MCP_BASE_URL`
- `ZOTERO_LIBRARY`
- `ZOTERO_LIBRARY_ID`
- `ZOTERO_API_KEY`

