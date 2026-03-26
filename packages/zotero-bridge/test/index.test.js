import test from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildCitationKey,
  buildChildNoteTemplate,
  ZoteroLocalApiClient,
  createService
} from "../server/index.js";

test("buildCitationKey generates stable key", () => {
  const key = buildCitationKey({
    authors: ["Haotian Liu", "Other Author"],
    year: "2023",
    title: "Visual Instruction Tuning"
  });
  assert.equal(key, "Liu2023VisualInstructionTuning");
});

test("buildChildNoteTemplate includes core fields", () => {
  const note = buildChildNoteTemplate({
    canonicalTitle: "Visual Instruction Tuning",
    citationKey: "Liu2023VisualInstructionTuning",
    arxivId: "2304.08485",
    pdfUrl: "https://arxiv.org/pdf/2304.08485.pdf",
    absUrl: "https://arxiv.org/abs/2304.08485",
    topic: ["instruction tuning", "llava"],
    whySelected: ["origin paper"]
  });
  assert.match(note, /Canonical Title: Visual Instruction Tuning/);
  assert.match(note, /Citation Key: Liu2023VisualInstructionTuning/);
  assert.match(note, /arXiv: 2304.08485/);
});

test("updateItemFields sends GET then PATCH", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if ((options.method || "GET") === "GET") {
      return new Response(JSON.stringify({ version: 7, data: { key: "ABC123", title: "Old" } }), { status: 200 });
    }
    return new Response(JSON.stringify({ success: { "0": "ABC123" } }), { status: 200 });
  };

  const client = new ZoteroLocalApiClient({ fetchImpl, baseUrl: "http://127.0.0.1:23119/api", library: "user", libraryId: "0" });
  const result = await client.updateItemFields("ABC123", { title: "New Title", url: "https://x.org" });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.method, undefined);
  assert.equal(calls[1].options.method, "PATCH");
  const payload = JSON.parse(calls[1].options.body);
  assert.equal(payload[0].title, "New Title");
  assert.equal(payload[0].url, "https://x.org");
  assert.equal(result.itemKey, "ABC123");
});

test("importAttachment validates file and posts payload", async () => {
  const root = join(tmpdir(), "zotero-mcp-extension-test-file");
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  const filePath = join(root, "paper.pdf");
  writeFileSync(filePath, "fake-pdf");

  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    const method = options.method || "GET";
    if (method === "GET" && url === "http://127.0.0.1:23119/api/users/0/items/ITEM1") {
      return new Response(JSON.stringify({
        version: 7,
        data: {
          key: "ITEM1",
          title: "Item Title",
          url: "https://example.org/paper",
          collections: ["COLL1"]
        }
      }), { status: 200 });
    }
    if (method === "GET" && url === "http://127.0.0.1:23119/api/users/0/items?limit=1") {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Last-Modified-Version": "7" }
      });
    }
    if (method === "POST" && url.startsWith("http://127.0.0.1:23119/connector/saveStandaloneAttachment")) {
      return new Response(JSON.stringify({ canRecognize: true }), { status: 201 });
    }
    if (method === "GET" && url === "http://127.0.0.1:23119/api/users/0/items?since=7&sort=dateAdded&direction=desc&limit=25") {
      return new Response(JSON.stringify([
        {
          key: "DUP1",
          data: {
            key: "DUP1",
            itemType: "preprint",
            title: "Item Title",
            url: "https://example.org/paper"
          },
          links: {
            attachment: {
              href: "http://127.0.0.1:23119/api/users/0/items/ATTACH1"
            }
          }
        },
        {
          key: "ATTACH1",
          data: {
            key: "ATTACH1",
            itemType: "attachment",
            filename: "paper.pdf",
            url: "https://example.org/paper"
          }
        }
      ]), { status: 200 });
    }
    if (method === "POST" && url === "http://127.0.0.1:23120/mcp") {
      const request = JSON.parse(options.body);
      if (request.params.name === "write_item") {
        return new Response(JSON.stringify({
          result: {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                data: { successCount: 1 }
              })
            }]
          }
        }), { status: 200 });
      }
      if (request.params.name === "remove_items_from_collection") {
        return new Response(JSON.stringify({
          result: {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                removed: ["DUP1"]
              })
            }]
          }
        }), { status: 200 });
      }
    }
    if (method === "GET" && url === "http://127.0.0.1:23119/api/users/0/items/ATTACH1") {
      return new Response(JSON.stringify({
        version: 8,
        data: {
          key: "ATTACH1",
          itemType: "attachment",
          parentItem: "ITEM1"
        }
      }), { status: 200 });
    }

    throw new Error(`Unexpected request: ${method} ${url}`);
  };

  const client = new ZoteroLocalApiClient({ fetchImpl });
  const result = await client.importAttachment(filePath, "ITEM1", "Full Text PDF");
  const connectorCall = calls.find((call) => String(call.url).includes("/connector/saveStandaloneAttachment"));
  assert.ok(connectorCall, "connector save call should be issued");
  assert.equal(connectorCall.options.method, "POST");
  assert.equal(result.parentKey, "ITEM1");
  assert.equal(result.attachmentKey, "ATTACH1");
  assert.deepEqual(result.duplicateParentKeys, ["DUP1"]);
});

test("service wrapper validates required args", async () => {
  const service = createService({
    updateItemFields: async () => ({ ok: true }),
    importAttachment: async () => ({ ok: true })
  });

  await assert.rejects(() => service.updateItemFields({ fields: {} }), /itemKey is required/);
  await assert.rejects(() => service.importAttachment({ parentKey: "X" }), /filePath is required/);
});
