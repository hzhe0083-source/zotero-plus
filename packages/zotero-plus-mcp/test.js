import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildCitationKey, buildChildNoteTemplate, ensurePdfPath } from './lib.js';
import { ZoteroPlusService } from './zotero-client.js';

function makeJsonResponse(body, { status = 200, headers = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        return headers[name] || headers[name.toLowerCase()] || null;
      }
    },
    text: async () => JSON.stringify(body),
    json: async () => body
  };
}

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

test('updateItemFields initializes MCP session and calls write_metadata', async () => {
  const calls = [];
  const fakeFetch = async (url, options = {}) => {
    calls.push({ url, options });
    const body = JSON.parse(options.body || '{}');

    if (body.method === 'initialize') {
      return makeJsonResponse(
        {
          jsonrpc: '2.0',
          id: body.id,
          result: { protocolVersion: '2024-11-05', capabilities: {}, serverInfo: { name: 'z', version: '1' } }
        },
        { headers: { 'Mcp-Session-Id': 'sid-1' } }
      );
    }

    if (body.method === 'notifications/initialized') {
      return makeJsonResponse({}, { status: 202 });
    }

    if (body.method === 'tools/call') {
      assert.equal(body.params.name, 'write_metadata');
      assert.deepEqual(body.params.arguments, {
        itemKey: 'ABC123',
        fields: { title: 'New Title', date: '2024' }
      });
      return makeJsonResponse({
        jsonrpc: '2.0',
        id: body.id,
        result: {
          content: [{ type: 'text', text: JSON.stringify({ itemKey: 'ABC123', updated: ['title', 'date'] }) }]
        }
      });
    }

    throw new Error(`Unexpected request: ${body.method}`);
  };

  const service = new ZoteroPlusService({ fetchImpl: fakeFetch });
  const result = await service.updateItemFields('ABC123', { title: 'New Title', date: '2024' });
  assert.equal(result.ok, true);
  assert.equal(calls.length, 3);
});

test('createChildNote calls write_note with generated template', async () => {
  const calls = [];
  const fakeFetch = async (url, options = {}) => {
    calls.push({ url, options });
    const body = JSON.parse(options.body || '{}');

    if (body.method === 'initialize') {
      return makeJsonResponse(
        {
          jsonrpc: '2.0',
          id: body.id,
          result: { protocolVersion: '2024-11-05', capabilities: {}, serverInfo: { name: 'z', version: '1' } }
        },
        { headers: { 'Mcp-Session-Id': 'sid-2' } }
      );
    }

    if (body.method === 'notifications/initialized') {
      return makeJsonResponse({}, { status: 202 });
    }

    if (body.method === 'tools/call') {
      assert.equal(body.params.name, 'write_note');
      assert.equal(body.params.arguments.action, 'create');
      assert.equal(body.params.arguments.parentKey, 'PARENT1');
      assert.match(body.params.arguments.content, /Citation Key:/);
      return makeJsonResponse({
        jsonrpc: '2.0',
        id: body.id,
        result: { content: [{ type: 'text', text: JSON.stringify({ noteKey: 'NOTE1' }) }] }
      });
    }

    throw new Error(`Unexpected request: ${body.method}`);
  };

  const service = new ZoteroPlusService({ fetchImpl: fakeFetch });
  const result = await service.createChildNote({
    parentKey: 'PARENT1',
    item: {
      title: 'Visual Instruction Tuning',
      date: '2023',
      creators: [{ firstName: 'Haotian', lastName: 'Liu' }]
    }
  });

  assert.equal(result.ok, true);
  assert.equal(calls.length, 3);
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
