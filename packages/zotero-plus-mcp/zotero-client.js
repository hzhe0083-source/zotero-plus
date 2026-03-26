import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildChildNoteTemplate, ensurePdfPath } from './lib.js';
import { ZoteroLocalApiClient } from '@zotero-plus/bridge';

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
    fetchImpl = fetch,
    downloadDir = path.join(tmpdir(), 'zotero-plus-downloads'),
    localClient = null
  } = {}) {
    this.fetch = fetchImpl;
    this.downloadDir = downloadDir;
    this.localClient = localClient || new ZoteroLocalApiClient({ fetchImpl });
  }

  async getItem(itemKey) {
    if (!itemKey) {
      throw new Error('itemKey is required');
    }
    return this.localClient.getItem(itemKey);
  }

  async updateItemFields(itemKey, fields, creators) {
    if (!itemKey) {
      throw new Error('itemKey is required');
    }
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
      throw new Error('fields must be an object');
    }

    const result = await this.localClient.updateItemFields(itemKey, fields, creators || []);
    return {
      ok: true,
      itemKey,
      updatedFields: Object.keys(fields),
      response: result
    };
  }

  async createItemWithMetadata({ itemType, fields = {}, creators = [], tags = [], attachmentKeys = [] }) {
    if (!itemType) {
      throw new Error('itemType is required');
    }

    const result = await this.localClient.createItemWithMetadata({
      itemType,
      fields,
      creators,
      tags,
      attachmentKeys
    });

    return {
      ok: true,
      itemType,
      response: result
    };
  }

  async createChildNote({ parentKey, item = {}, tags = [] }) {
    if (!parentKey) {
      throw new Error('parentKey is required');
    }

    const content = buildChildNoteTemplate(item);
    const result = await this.localClient.createChildNote({
      parentKey,
      content,
      tags
    });

    return {
      ok: true,
      parentKey,
      content,
      response: result
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
