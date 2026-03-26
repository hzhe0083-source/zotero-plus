# @zotero-plus/bridge

Local bridge helpers for Zotero.

Zotero 本地桥接层。

## What It Talks To

It wraps two local surfaces:

- Zotero local API on `23119`
- Zotero Plus bridge addon on `23121`

它封装了两个本地接口：

- Zotero 本地只读 API
- Zotero Plus bridge addon

## Current Write Operations

- update item fields
- create item
- create child note
- import attachment directly under an existing item

## Environment

- `ZOTERO_API_BASE_URL`
- `ZOTERO_PLUS_BRIDGE_URL`
- `ZOTERO_LIBRARY`
- `ZOTERO_LIBRARY_ID`
- `ZOTERO_API_KEY`

## Practical Limitation

This package assumes:

- Zotero desktop is running
- The local API is reachable
- The Zotero Plus bridge addon is installed and running

If any of those are missing, real write operations will fail even though unit tests can still pass with mocks.
