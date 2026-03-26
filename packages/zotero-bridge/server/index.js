import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";

const DEFAULT_BASE_URL = process.env.ZOTERO_API_BASE_URL || "http://127.0.0.1:23119/api";
const DEFAULT_LIBRARY = process.env.ZOTERO_LIBRARY || "user";
const DEFAULT_LIBRARY_ID = process.env.ZOTERO_LIBRARY_ID || "0";
const API_KEY = process.env.ZOTERO_API_KEY || "";
const DEFAULT_MCP_BASE_URL = process.env.ZOTERO_MCP_BASE_URL || "http://127.0.0.1:23120";

export function buildCitationKey({ authors = [], year = "n.d.", title = "Untitled" }) {
  const firstAuthor = authors[0] || "Unknown";
  const authorToken = transliterate(firstAuthor.split(/\s+/).slice(-1)[0] || "Unknown");
  const shortTitle = transliterate(title)
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .filter((token) => !STOP_WORDS.has(token.toLowerCase()))
    .slice(0, 3)
    .join("");
  return `${authorToken}${year}${shortTitle || "Paper"}`;
}

const STOP_WORDS = new Set(["a", "an", "the", "of", "and", "for", "with", "on", "to", "after", "into"]);

export function transliterate(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function buildChildNoteTemplate({ canonicalTitle, citationKey, arxivId, pdfUrl, absUrl, topic = [], whySelected = [] }) {
  return [
    "# Intake Note",
    "",
    `- Canonical Title: ${canonicalTitle}`,
    `- Citation Key: ${citationKey}`,
    `- arXiv: ${arxivId || ""}`,
    `- PDF: ${pdfUrl || ""}`,
    `- URL: ${absUrl || ""}`,
    `- Topic: ${topic.join(", ")}`,
    "",
    "## Why selected",
    ...whySelected.map((line) => `- ${line}`),
    "",
    "## Next actions",
    "- skim",
    "- extract key tables",
    "- compare with related papers"
  ].join("\n");
}

export class ZoteroLocalApiClient {
  constructor({
    baseUrl = DEFAULT_BASE_URL,
    library = DEFAULT_LIBRARY,
    libraryId = DEFAULT_LIBRARY_ID,
    apiKey = API_KEY,
    mcpBaseUrl = DEFAULT_MCP_BASE_URL,
    fetchImpl = fetch
  } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.library = library;
    this.libraryId = libraryId;
    this.apiKey = apiKey;
    this.mcpBaseUrl = mcpBaseUrl.replace(/\/$/, "");
    this.fetchImpl = fetchImpl;
  }

  itemUrl(itemKey) {
    return `${this.baseUrl}/${this.library}s/${this.libraryId}/items/${encodeURIComponent(itemKey)}`;
  }

  async getItem(itemKey) {
    const response = await this.fetchImpl(this.itemUrl(itemKey), {
      headers: this.headers()
    });
    return this.parseJsonResponse(response, `Failed to load item ${itemKey}`);
  }

  async getLibraryVersion() {
    const response = await this.fetchImpl(`${this.baseUrl}/${this.library}s/${this.libraryId}/items?limit=1`, {
      headers: this.headers()
    });
    await this.parseJsonResponse(response, "Failed to load library version");
    const versionHeader = response.headers.get("Last-Modified-Version");
    const version = Number(versionHeader);
    if (!Number.isFinite(version)) {
      throw new Error("Missing Last-Modified-Version header from local Zotero API");
    }
    return version;
  }

  async updateItemFields(itemKey, fields) {
    const existing = await this.getItem(itemKey);
    const version = existing.version ?? existing.data?.version;
    if (version == null) {
      throw new Error(`Missing item version for ${itemKey}`);
    }

    const data = { ...(existing.data || {}) };
    for (const [key, value] of Object.entries(fields || {})) {
      if (value !== undefined) {
        data[key] = value;
      }
    }

    const response = await this.fetchImpl(this.itemUrl(itemKey), {
      method: "PATCH",
      headers: {
        ...this.headers(),
        "Content-Type": "application/json",
        "If-Unmodified-Since-Version": String(version)
      },
      body: JSON.stringify([data])
    });

    const parsed = await this.parseJsonResponse(response, `Failed to update item ${itemKey}`);
    return { itemKey, version, result: parsed };
  }

  async importAttachment(filePath, parentKey, title = "Full Text PDF") {
    const absPath = resolve(filePath);
    if (!existsSync(absPath)) {
      throw new Error(`Attachment file not found: ${absPath}`);
    }
    const stats = statSync(absPath);
    if (!stats.isFile()) {
      throw new Error(`Attachment path is not a file: ${absPath}`);
    }
    const parentItem = await this.getItem(parentKey);
    const filename = basename(absPath);
    const libraryVersion = await this.getLibraryVersion();
    const sourceUrl = parentItem.data?.url || parentItem.url || `zotero://select/library/items/${parentKey}`;
    const sessionID = `zotero-mcp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const connectorResult = await this.saveStandaloneAttachment({
      filePath: absPath,
      sessionID,
      title,
      url: sourceUrl
    });

    const imported = await this.waitForImportedAttachment({
      sinceVersion: libraryVersion,
      filename,
      sourceUrl,
      parentKey,
      parentTitle: parentItem.data?.title || parentItem.title || ""
    });

    await this.reparentAttachment(imported.attachmentKey, parentKey);

    if (imported.duplicateParentKeys.length && parentItem.data?.collections?.length) {
      for (const collectionKey of parentItem.data.collections) {
        await this.removeItemsFromCollection(collectionKey, imported.duplicateParentKeys);
      }
    }

    const verifiedAttachment = await this.getItem(imported.attachmentKey);
    if (verifiedAttachment.data?.parentItem !== parentKey) {
      throw new Error(`Attachment ${imported.attachmentKey} was not re-parented to ${parentKey}`);
    }

    return {
      parentKey,
      filePath: absPath,
      title,
      attachmentKey: imported.attachmentKey,
      duplicateParentKeys: imported.duplicateParentKeys,
      result: {
        connector: connectorResult,
        attachmentKey: imported.attachmentKey,
        duplicateParentKeys: imported.duplicateParentKeys,
        verifiedParentKey: verifiedAttachment.data?.parentItem || null
      }
    };
  }

  connectorBaseUrl() {
    return this.baseUrl.replace(/\/api\/?$/, "");
  }

  async saveStandaloneAttachment({ filePath, sessionID, title, url }) {
    const metadata = JSON.stringify({ sessionID, title, url });
    const response = await this.fetchImpl(
      `${this.connectorBaseUrl()}/connector/saveStandaloneAttachment?sessionID=${encodeURIComponent(sessionID)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/pdf",
          "X-Metadata": metadata
        },
        body: readFileSync(filePath)
      }
    );

    return this.parseJsonResponse(response, "Failed to save standalone attachment via Zotero connector");
  }

  async listItemsSince(version, limit = 20) {
    const response = await this.fetchImpl(
      `${this.baseUrl}/${this.library}s/${this.libraryId}/items?since=${version}&sort=dateAdded&direction=desc&limit=${limit}`,
      { headers: this.headers() }
    );
    return this.parseJsonResponse(response, `Failed to list items since version ${version}`);
  }

  async waitForImportedAttachment({ sinceVersion, filename, sourceUrl, parentKey, parentTitle }) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const items = await this.listItemsSince(sinceVersion, 25);
      const attachment = items.find((item) => {
        const data = item?.data || {};
        return data.itemType === "attachment"
          && (data.filename === filename || data.url === sourceUrl);
      });

      if (attachment) {
        const attachmentKey = attachment.data.key;
        const duplicateParentKeys = items
          .filter((item) => {
            const data = item?.data || {};
            const attachmentHref = item?.links?.attachment?.href || "";
            return data.itemType !== "attachment"
              && data.key !== parentKey
              && (
                attachmentHref.endsWith(`/${attachmentKey}`)
                || (parentTitle && data.title === parentTitle)
                || data.url === sourceUrl
              );
          })
          .map((item) => item.data.key);

        return {
          attachmentKey,
          duplicateParentKeys
        };
      }

      await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
    }

    throw new Error(`Timed out waiting for imported attachment ${filename}`);
  }

  async callMcpTool(name, args) {
    const response = await this.fetchImpl(`${this.mcpBaseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Mcp-Session-Id": "zotero-mcp-extension"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name,
          arguments: args
        }
      })
    });

    const payload = await this.parseJsonResponse(response, `Failed to call MCP tool ${name}`);
    if (payload.error) {
      throw new Error(payload.error.message || `MCP tool ${name} failed`);
    }

    const text = payload.result?.content?.[0]?.text;
    if (!text) {
      return payload.result ?? null;
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  async reparentAttachment(attachmentKey, parentKey) {
    const result = await this.callMcpTool("write_item", {
      action: "reparent",
      parentKey,
      attachmentKeys: [attachmentKey]
    });

    if (!result?.success || result?.data?.successCount !== 1) {
      throw new Error(`Failed to re-parent attachment ${attachmentKey} to ${parentKey}`);
    }

    return result;
  }

  async removeItemsFromCollection(collectionKey, itemKeys) {
    if (!itemKeys.length) {
      return { success: true, removed: [] };
    }
    return this.callMcpTool("remove_items_from_collection", {
      collectionKey,
      itemKeys
    });
  }

  headers() {
    const headers = { Accept: "application/json" };
    if (this.apiKey) {
      headers["Zotero-API-Key"] = this.apiKey;
    }
    return headers;
  }

  async parseJsonResponse(response, message) {
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!response.ok) {
      throw new Error(`${message}: ${response.status} ${response.statusText} ${typeof data === "string" ? data : JSON.stringify(data)}`);
    }
    return data;
  }
}

export function createService(client = new ZoteroLocalApiClient()) {
  return {
    async updateItemFields(args) {
      const { itemKey, fields } = args || {};
      if (!itemKey) throw new Error("itemKey is required");
      if (!fields || typeof fields !== "object") throw new Error("fields is required");
      return client.updateItemFields(itemKey, fields);
    },
    async importAttachment(args) {
      const { filePath, parentKey, title } = args || {};
      if (!filePath) throw new Error("filePath is required");
      if (!parentKey) throw new Error("parentKey is required");
      return client.importAttachment(filePath, parentKey, title);
    },
    buildCitationKey,
    buildChildNoteTemplate
  };
}

if (process.env.ZOTERO_MCP_EXTENSION_HTTP === "1") {
  const service = createService();
  const server = createServer(async (req, res) => {
    try {
      if (req.method === "POST" && req.url === "/updateItemFields") {
        const body = await readBody(req);
        const result = await service.updateItemFields(JSON.parse(body));
        return sendJson(res, 200, result);
      }
      if (req.method === "POST" && req.url === "/importAttachment") {
        const body = await readBody(req);
        const result = await service.importAttachment(JSON.parse(body));
        return sendJson(res, 200, result);
      }
      if (req.method === "GET" && req.url === "/health") {
        return sendJson(res, 200, { ok: true });
      }
      sendJson(res, 404, { error: "Not found" });
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  const port = Number(process.env.PORT || 23200);
  server.listen(port, "127.0.0.1", () => {
    console.log(`zotero-mcp-extension listening on http://127.0.0.1:${port}`);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolveBody(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
