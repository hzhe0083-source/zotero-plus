import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildChildNoteTemplate, ensurePdfPath } from './lib.js';
import { ZoteroLocalApiClient } from '@zotero-plus/bridge';

function joinTextContent(result) {
  return (result?.content || [])
    .filter((entry) => entry?.type === 'text')
    .map((entry) => entry.text)
    .join('\n')
    .trim();
}

function parseJsonText(result) {
  const text = joinTextContent(result);
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function inferPdfFilename(url) {
  try {
    const parsed = new URL(url);
    const last = parsed.pathname.split('/').filter(Boolean).pop() || 'download.pdf';
    return last.toLowerCase().endsWith('.pdf') ? last : `${last}.pdf`;
  } catch {
    return 'download.pdf';
  }
}

export class ZoteroPlusService {
  constructor({
    mcpUrl = 'http://127.0.0.1:23120/mcp',
    fetchImpl = fetch,
    downloadDir = path.join(tmpdir(), 'zotero-plus-downloads'),
    localClient = null
  } = {}) {
    this.mcpUrl = mcpUrl.replace(/\/$/, '');
    this.fetch = fetchImpl;
    this.downloadDir = downloadDir;
    this.sessionId = null;
    this.requestId = 1;
    this.localClient = localClient || new ZoteroLocalApiClient({
      fetchImpl,
      mcpBaseUrl: this.mcpUrl.replace(/\/mcp$/, '')
    });
  }

  async _ensureSession() {
    if (this.sessionId) {
      return this.sessionId;
    }

    const initPayload = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'zotero-plus-mcp',
          version: '0.2.0'
        }
      }
    };

    const initRes = await this.fetch(this.mcpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(initPayload)
    });

    if (!initRes.ok) {
      const text = await initRes.text();
      throw new Error(`Failed to initialize Zotero MCP session: ${initRes.status} ${text}`);
    }

    this.sessionId = initRes.headers.get('Mcp-Session-Id');
    if (!this.sessionId) {
      throw new Error('Zotero MCP did not return Mcp-Session-Id');
    }

    const notifyPayload = {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: {}
    };

    await this.fetch(this.mcpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Mcp-Session-Id': this.sessionId
      },
      body: JSON.stringify(notifyPayload)
    });

    return this.sessionId;
  }

  async _callTool(name, args = {}) {
    const sessionId = await this._ensureSession();
    const payload = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'tools/call',
      params: {
        name,
        arguments: args
      }
    };

    const res = await this.fetch(this.mcpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Mcp-Session-Id': sessionId
      },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Zotero MCP tool ${name} failed: ${res.status} ${text}`);
    }

    const json = JSON.parse(text);
    if (json.error) {
      throw new Error(`Zotero MCP tool ${name} error: ${json.error.message}`);
    }

    return json.result;
  }

  async getItem(itemKey) {
    if (!itemKey) {
      throw new Error('itemKey is required');
    }

    return this._callTool('get_item_details', { itemKey, mode: 'complete' });
  }

  async updateItemFields(itemKey, fields, creators) {
    if (!itemKey) {
      throw new Error('itemKey is required');
    }
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
      throw new Error('fields must be an object');
    }

    const args = { itemKey, fields };
    if (Array.isArray(creators) && creators.length > 0) {
      args.creators = creators;
    }

    const result = await this._callTool('write_metadata', args);
    return {
      ok: true,
      itemKey,
      updatedFields: Object.keys(fields),
      response: parseJsonText(result) ?? joinTextContent(result)
    };
  }

  async createItemWithMetadata({ itemType, fields = {}, creators = [], tags = [], attachmentKeys = [] }) {
    if (!itemType) {
      throw new Error('itemType is required');
    }

    const result = await this._callTool('write_item', {
      action: 'create',
      itemType,
      fields,
      creators,
      tags,
      attachmentKeys
    });

    return {
      ok: true,
      itemType,
      response: parseJsonText(result) ?? joinTextContent(result)
    };
  }

  async createChildNote({ parentKey, item = {}, tags = [] }) {
    if (!parentKey) {
      throw new Error('parentKey is required');
    }

    const content = buildChildNoteTemplate(item);
    const result = await this._callTool('write_note', {
      action: 'create',
      parentKey,
      content,
      tags
    });

    return {
      ok: true,
      parentKey,
      content,
      response: parseJsonText(result) ?? joinTextContent(result)
    };
  }

  async downloadPdf({ url, outputPath = '', overwrite = false }) {
    if (!url) {
      throw new Error('url is required');
    }

    const targetPath = outputPath
      ? path.resolve(outputPath)
      : path.join(this.downloadDir, inferPdfFilename(url));

    await fs.mkdir(path.dirname(targetPath), { recursive: true });

    if (!overwrite) {
      try {
        await fs.access(targetPath);
        throw new Error(`File already exists: ${targetPath}`);
      } catch (error) {
        if (!String(error.message).startsWith('File already exists:')) {
          // File does not exist yet, continue.
        } else {
          throw error;
        }
      }
    }

    const res = await this.fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to download PDF: ${res.status}`);
    }

    const contentType = res.headers?.get?.('content-type') || '';
    if (!contentType.includes('pdf') && !url.toLowerCase().includes('.pdf')) {
      throw new Error(`URL does not look like a PDF download: ${url} (${contentType || 'unknown content type'})`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(targetPath, buffer);

    return {
      ok: true,
      url,
      outputPath: targetPath,
      bytes: buffer.length,
      contentType
    };
  }

  async importAttachment({ filePath, parentKey, title = 'Full Text PDF' }) {
    const normalized = ensurePdfPath(filePath);
    if (!parentKey) {
      throw new Error('parentKey is required');
    }
    return this.localClient.importAttachment(normalized, parentKey, title);
  }
}
