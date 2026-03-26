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

1. Build the addon package:

```bash
npm run build
```

2. The built artifact will be placed at:

```text
release/zotero-plus-bridge-0.2.0.xpi
```

3. Install the `.xpi` into Zotero as an addon
4. Restart Zotero
5. Confirm `http://127.0.0.1:23121/health` is reachable

After that, `zotero-plus-mcp` can use Zotero Plus without any separate Zotero MCP plugin.

## 中文说明

1. 运行：

```bash
npm run build
```

2. 会生成：

```text
release/zotero-plus-bridge-0.2.0.xpi
```

3. 在 Zotero 中安装这个 `.xpi`
4. 重启 Zotero
5. 访问 `http://127.0.0.1:23121/health` 确认插件已生效
