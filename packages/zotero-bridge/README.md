# @zotero-plus/bridge

## 中文说明

Zotero 本地桥接层。

### 它连接什么

它封装了两个本地接口：

- Zotero 本地只读 API
- Zotero Plus bridge addon

### 当前写操作

- 更新条目元数据
- 创建条目
- 创建子笔记
- 把附件直接挂到已有条目下

### 环境变量

- `ZOTERO_API_BASE_URL`
- `ZOTERO_PLUS_BRIDGE_URL`
- `ZOTERO_LIBRARY`
- `ZOTERO_LIBRARY_ID`
- `ZOTERO_API_KEY`

## English

Local bridge helpers for Zotero.

### What It Talks To

It wraps two local surfaces:

- Zotero local API on `23119`
- Zotero Plus bridge addon on `23121`

### Current Write Operations

- update item fields
- create item
- create child note
- import attachment directly under an existing item

### Environment

- `ZOTERO_API_BASE_URL`
- `ZOTERO_PLUS_BRIDGE_URL`
- `ZOTERO_LIBRARY`
- `ZOTERO_LIBRARY_ID`
- `ZOTERO_API_KEY`
