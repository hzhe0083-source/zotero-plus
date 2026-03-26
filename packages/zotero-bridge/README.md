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

### 现实限制

这个包假定：

- Zotero Desktop 正在运行
- 本地 API 可访问
- Zotero Plus bridge addon 已安装并在运行

如果这些条件缺失，真实写操作会失败，即使 mock 测试仍然可以通过。

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

### Practical Limitation

This package assumes:

- Zotero desktop is running
- The local API is reachable
- The Zotero Plus bridge addon is installed and running

If any of those are missing, real write operations will fail even though unit tests can still pass with mocks.
