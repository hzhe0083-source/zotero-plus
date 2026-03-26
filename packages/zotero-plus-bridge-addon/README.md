# zotero-plus-bridge-addon

## 中文说明

Zotero Plus 的本地 bridge 插件源码。

这个插件会在 Zotero 内部开启一个很小的本地 HTTP 服务，让 `zotero-plus-mcp` 能在不依赖第三方 Zotero MCP 插件的情况下完成写操作。

### 当前端点

- `GET /health`
- `POST /importAttachment`
- `POST /updateItemFields`
- `POST /createItem`
- `POST /createChildNote`

### 默认地址

- `127.0.0.1:23121`

### 安装到 Zotero

这个目录是插件源码，不是 npm 包。

推荐安装流程：

1. 构建插件包：

```bash
npm run build
```

2. 产物位置：

```text
release/zotero-plus-bridge-0.2.0.xpi
```

3. 在 Zotero 中安装这个 `.xpi`
4. 重启 Zotero
5. 访问 `http://127.0.0.1:23121/health` 确认插件已启动

## English

Zotero plugin source for the Zotero Plus local bridge.

This addon exposes a small local HTTP server inside Zotero so `zotero-plus-mcp` can perform write operations without any third-party Zotero MCP plugin.

### Current Endpoints

- `GET /health`
- `POST /importAttachment`
- `POST /updateItemFields`
- `POST /createItem`
- `POST /createChildNote`

### Default Bind Address

- `127.0.0.1:23121`

### Install Into Zotero

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
