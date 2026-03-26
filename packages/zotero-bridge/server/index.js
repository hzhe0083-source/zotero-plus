import { createServer } from "node:http";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_BASE_URL = process.env.ZOTERO_API_BASE_URL || "http://127.0.0.1:23119/api";
const DEFAULT_LIBRARY = process.env.ZOTERO_LIBRARY || "user";
const DEFAULT_LIBRARY_ID = process.env.ZOTERO_LIBRARY_ID || "0";
const API_KEY = process.env.ZOTERO_API_KEY || "";
const DEFAULT_BRIDGE_BASE_URL = process.env.ZOTERO_PLUS_BRIDGE_URL || "http://127.0.0.1:23121";

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
    bridgeBaseUrl = DEFAULT_BRIDGE_BASE_URL,
    fetchImpl = fetch
  } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.library = library;
    this.libraryId = libraryId;
    this.apiKey = apiKey;
    this.bridgeBaseUrl = bridgeBaseUrl.replace(/\/$/, "");
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

  async updateItemFields(itemKey, fields, creators = []) {
    if (!itemKey) {
      throw new Error("itemKey is required");
    }
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
      throw new Error("fields must be an object");
    }
    return this.postBridge("/updateItemFields", { itemKey, fields, creators }, `Failed to update item ${itemKey}`);
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
    return this.postBridge("/importAttachment", {
      filePath: absPath,
      parentKey,
      title
    }, `Failed to import attachment for ${parentKey}`);
  }

  async createItemWithMetadata({ itemType, fields = {}, creators = [], tags = [], attachmentKeys = [] }) {
    if (!itemType) {
      throw new Error("itemType is required");
    }
    return this.postBridge("/createItem", {
      itemType,
      fields,
      creators,
      tags,
      attachmentKeys
    }, `Failed to create item of type ${itemType}`);
  }

  async createChildNote({ parentKey, content, tags = [] }) {
    if (!parentKey) {
      throw new Error("parentKey is required");
    }
    if (!content) {
      throw new Error("content is required");
    }
    return this.postBridge("/createChildNote", {
      parentKey,
      content,
      tags
    }, `Failed to create child note for ${parentKey}`);
  }

  async postBridge(path, payload, message) {
    const response = await this.fetchImpl(`${this.bridgeBaseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    return this.parseJsonResponse(response, message);
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
      const { itemKey, fields, creators = [] } = args || {};
      if (!itemKey) throw new Error("itemKey is required");
      if (!fields || typeof fields !== "object") throw new Error("fields is required");
      return client.updateItemFields(itemKey, fields, creators);
    },
    async importAttachment(args) {
      const { filePath, parentKey, title } = args || {};
      if (!filePath) throw new Error("filePath is required");
      if (!parentKey) throw new Error("parentKey is required");
      return client.importAttachment(filePath, parentKey, title);
    },
    async createItemWithMetadata(args) {
      const { itemType, fields = {}, creators = [], tags = [], attachmentKeys = [] } = args || {};
      if (!itemType) throw new Error("itemType is required");
      return client.createItemWithMetadata({ itemType, fields, creators, tags, attachmentKeys });
    },
    async createChildNote(args) {
      const { parentKey, content, tags = [] } = args || {};
      if (!parentKey) throw new Error("parentKey is required");
      if (!content) throw new Error("content is required");
      return client.createChildNote({ parentKey, content, tags });
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
      if (req.method === "POST" && req.url === "/createItem") {
        const body = await readBody(req);
        const result = await service.createItemWithMetadata(JSON.parse(body));
        return sendJson(res, 200, result);
      }
      if (req.method === "POST" && req.url === "/createChildNote") {
        const body = await readBody(req);
        const result = await service.createChildNote(JSON.parse(body));
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
    console.log(`zotero-bridge listening on http://127.0.0.1:${port}`);
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
