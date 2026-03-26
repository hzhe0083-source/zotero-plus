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

test("updateItemFields posts to Zotero Plus bridge", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if ((options.method || "GET") === "POST" && url === "http://127.0.0.1:23121/updateItemFields") {
      return new Response(JSON.stringify({ success: true, data: { itemKey: "ABC123" } }), { status: 200 });
    }
    throw new Error(`Unexpected request: ${options.method || "GET"} ${url}`);
  };

  const client = new ZoteroLocalApiClient({ fetchImpl, bridgeBaseUrl: "http://127.0.0.1:23121" });
  const result = await client.updateItemFields("ABC123", { title: "New Title", url: "https://x.org" });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, "POST");
  const payload = JSON.parse(calls[0].options.body);
  assert.equal(payload.itemKey, "ABC123");
  assert.equal(payload.fields.title, "New Title");
  assert.equal(result.data.itemKey, "ABC123");
});

test("importAttachment validates file and posts to Zotero Plus bridge", async () => {
  const root = join(tmpdir(), "zotero-bridge-test-file");
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  const filePath = join(root, "paper.pdf");
  writeFileSync(filePath, "fake-pdf");

  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if ((options.method || "GET") === "POST" && url === "http://127.0.0.1:23121/importAttachment") {
      return new Response(JSON.stringify({
        ok: true,
        parentKey: "ITEM1",
        attachmentKey: "ATTACH1"
      }), { status: 200 });
    }
    throw new Error(`Unexpected request: ${options.method || "GET"} ${url}`);
  };

  const client = new ZoteroLocalApiClient({ fetchImpl, bridgeBaseUrl: "http://127.0.0.1:23121" });
  const result = await client.importAttachment(filePath, "ITEM1", "Full Text PDF");
  const bridgeCall = calls.find((call) => String(call.url).includes("/importAttachment"));
  assert.ok(bridgeCall, "bridge call should be issued");
  assert.equal(bridgeCall.options.method, "POST");
  assert.equal(result.parentKey, "ITEM1");
  assert.equal(result.attachmentKey, "ATTACH1");
});

test("createItemWithMetadata posts to Zotero Plus bridge", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if ((options.method || "GET") === "POST" && url === "http://127.0.0.1:23121/createItem") {
      return new Response(JSON.stringify({ success: true, data: { itemKey: "ITEM1" } }), { status: 200 });
    }
    throw new Error(`Unexpected request: ${options.method || "GET"} ${url}`);
  };

  const client = new ZoteroLocalApiClient({ fetchImpl, bridgeBaseUrl: "http://127.0.0.1:23121" });
  const result = await client.createItemWithMetadata({
    itemType: "journalArticle",
    fields: { title: "Visual Instruction Tuning" }
  });
  assert.equal(calls.length, 1);
  assert.equal(result.data.itemKey, "ITEM1");
});

test("createChildNote posts to Zotero Plus bridge", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if ((options.method || "GET") === "POST" && url === "http://127.0.0.1:23121/createChildNote") {
      return new Response(JSON.stringify({ success: true, data: { noteKey: "NOTE1" } }), { status: 200 });
    }
    throw new Error(`Unexpected request: ${options.method || "GET"} ${url}`);
  };

  const client = new ZoteroLocalApiClient({ fetchImpl, bridgeBaseUrl: "http://127.0.0.1:23121" });
  const result = await client.createChildNote({
    parentKey: "ITEM1",
    content: "# Intake Note"
  });
  assert.equal(calls.length, 1);
  assert.equal(result.data.noteKey, "NOTE1");
});

test("service wrapper validates required args", async () => {
  const service = createService({
    updateItemFields: async () => ({ ok: true }),
    importAttachment: async () => ({ ok: true }),
    createItemWithMetadata: async () => ({ ok: true }),
    createChildNote: async () => ({ ok: true })
  });

  await assert.rejects(() => service.updateItemFields({ fields: {} }), /itemKey is required/);
  await assert.rejects(() => service.importAttachment({ parentKey: "X" }), /filePath is required/);
  await assert.rejects(() => service.createItemWithMetadata({}), /itemType is required/);
  await assert.rejects(() => service.createChildNote({ parentKey: "X" }), /content is required/);
});
