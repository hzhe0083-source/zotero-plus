# zotero-plus-bridge-addon

Zotero plugin source for the Zotero Plus local bridge.

This addon exposes a small local HTTP server inside Zotero so `zotero-plus-mcp` can perform write operations without any third-party Zotero MCP plugin.

Current endpoints:

- `GET /health`
- `POST /importAttachment`
- `POST /updateItemFields`
- `POST /createItem`
- `POST /createChildNote`

Default bind address:

- `127.0.0.1:23121`

## Install Into Zotero

This folder is addon source, not an npm package.

Typical manual install flow:

1. Package the contents of this folder into a `.xpi`
2. Install the `.xpi` into Zotero as an addon
3. Restart Zotero
4. Confirm `http://127.0.0.1:23121/health` is reachable

After that, `zotero-plus-mcp` can use Zotero Plus without any separate Zotero MCP plugin.
