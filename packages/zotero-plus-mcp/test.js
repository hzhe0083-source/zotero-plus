import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildCitationKey, buildChildNoteTemplate, ensurePdfPath } from './lib.js';
import { ZoteroPlusService } from './zotero-client.js';

test('buildCitationKey generates stable key', () => {
  const key = buildCitationKey({
    creators: [{ firstName: 'Bo', lastName: 'Luo', creatorType: 'author' }],
    date: '2024',
    title: 'An Image is Worth 1/2 Tokens After Layer 2'
  });
  assert.equal(key, 'Luo2024ImageIsWorth');
});

test('buildChildNoteTemplate contains key fields', () => {
  const note = buildChildNoteTemplate({
    title: 'Visual Instruction Tuning',
    date: '2023',
    creators: [{ firstName: 'Haotian', lastName: 'Liu' }],
    url: 'https://arxiv.org/abs/2304.08485'
  });
  assert.match(note, /Visual Instruction Tuning/);
  assert.match(note, /Citation Key:/);
  assert.match(note, /Relation to my research/);
});

test('ensurePdfPath validates pdf files', () => {
  const tempDir = fs.mkdtempSync(path.join(tmpdir(), 'zotero-plus-test-'));
  const pdfPath = path.join(tempDir, 'test.pdf');
  fs.writeFileSync(pdfPath, 'dummy');
  assert.equal(ensurePdfPath(pdfPath), pdfPath);
});

test('updateItemFields delegates to local bridge client', async () => {
  const fakeBridge = {
    async updateItemFields(itemKey, fields, creators) {
      return { itemKey, fields, creators, ok: true };
    }
  };

  const service = new ZoteroPlusService({ localClient: fakeBridge });
  const result = await service.updateItemFields('ABC123', { title: 'New Title', date: '2024' });
  assert.equal(result.ok, true);
  assert.equal(result.response.itemKey, 'ABC123');
});

test('createChildNote delegates to local bridge client', async () => {
  const fakeBridge = {
    async createChildNote({ parentKey, content, tags }) {
      return { ok: true, parentKey, content, tags, noteKey: 'NOTE1' };
    }
  };

  const service = new ZoteroPlusService({ localClient: fakeBridge });
  const result = await service.createChildNote({
    parentKey: 'PARENT1',
    item: {
      title: 'Visual Instruction Tuning',
      date: '2023',
      creators: [{ firstName: 'Haotian', lastName: 'Liu' }]
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.response.noteKey, 'NOTE1');
});

test('downloadPdf saves response body to disk', async () => {
  const tempDir = fs.mkdtempSync(path.join(tmpdir(), 'zotero-plus-download-'));
  const fakeFetch = async () => ({
    ok: true,
    headers: { get: () => 'application/pdf' },
    arrayBuffer: async () => Buffer.from('%PDF-1.4 test').buffer
  });

  const service = new ZoteroPlusService({ fetchImpl: fakeFetch, downloadDir: tempDir });
  const result = await service.downloadPdf({ url: 'https://example.com/paper.pdf' });
  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(result.outputPath), true);
});

test('importAttachment delegates to local bridge client', async () => {
  const tempDir = fs.mkdtempSync(path.join(tmpdir(), 'zotero-plus-import-'));
  const pdfPath = path.join(tempDir, 'sample.pdf');
  fs.writeFileSync(pdfPath, 'dummy');

  const fakeBridge = {
    async importAttachment(filePath, parentKey, title) {
      return { ok: true, filePath, parentKey, title, attachmentKey: 'ATTACH1' };
    }
  };

  const service = new ZoteroPlusService({ localClient: fakeBridge });
  const result = await service.importAttachment({ filePath: pdfPath, parentKey: 'P1' });
  assert.equal(result.ok, true);
  assert.equal(result.attachmentKey, 'ATTACH1');
});

test('createItemWithMetadata delegates to local bridge client', async () => {
  const fakeBridge = {
    async createItemWithMetadata(args) {
      return { success: true, data: { itemKey: 'ITEM1', ...args } };
    }
  };

  const service = new ZoteroPlusService({ localClient: fakeBridge });
  const result = await service.createItemWithMetadata({
    itemType: 'journalArticle',
    fields: { title: 'Visual Instruction Tuning' }
  });
  assert.equal(result.ok, true);
  assert.equal(result.response.data.itemKey, 'ITEM1');
});
