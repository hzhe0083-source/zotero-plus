# zotero-plus-mcp

## 中文说明

一个独立的 MCP server，用来给 Zotero 提供可调用工具。

### 工具列表

- `updateItemFields`
- `createItemWithMetadata`
- `downloadPdf`
- `importAttachment`
- `buildCitationKey`
- `buildChildNoteTemplate`
- `createChildNote`

### 典型用途

- 更新 Zotero 元数据
- 创建新 Zotero 条目
- 下载 PDF
- 把 PDF 挂到已有条目下
- 生成并创建子笔记

### 环境变量

- `ZOTERO_API_BASE_URL`
  Zotero 本地 API，默认 `http://127.0.0.1:23119/api`
- `ZOTERO_PLUS_BRIDGE_URL`
  Zotero Plus bridge addon 地址，默认 `http://127.0.0.1:23121`
- `ZOTERO_PLUS_DOWNLOAD_DIR`
  PDF 下载目录；默认使用当前平台临时目录

### 运行

```bash
node server.js
```

## English

A standalone MCP server for common Zotero workflows.

### Tools

- `updateItemFields`
- `createItemWithMetadata`
- `downloadPdf`
- `importAttachment`
- `buildCitationKey`
- `buildChildNoteTemplate`
- `createChildNote`

### Typical Use

- Update Zotero metadata
- Create a new Zotero item
- Download a PDF
- Import a PDF under an existing item
- Generate and create child notes

### Environment

- `ZOTERO_API_BASE_URL`
  Default: `http://127.0.0.1:23119/api`
- `ZOTERO_PLUS_BRIDGE_URL`
  Default: `http://127.0.0.1:23121`
- `ZOTERO_PLUS_DOWNLOAD_DIR`
  Default: platform temp directory + `zotero-plus-downloads`

### Run

```bash
node server.js
```
