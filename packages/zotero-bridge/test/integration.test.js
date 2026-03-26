import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ZoteroLocalApiClient } from "../server/index.js";

function startMockBridge() {
  const calls = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString("utf8");
    calls.push({ method: req.method, url: req.url, headers: req.headers, body });

    if (req.method === "POST" && req.url === "/updateItemFields") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ success: true, data: { itemKey: "ITEM1" } }));
    }

    if (req.method === "POST" && req.url === "/importAttachment") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ parentKey: "ITEM1", attachmentKey: "ATT1" }));
    }

    if (req.method === "POST" && req.url === "/createItem") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ success: true, data: { itemKey: "CREATED1" } }));
    }

    if (req.method === "POST" && req.url === "/createChildNote") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ success: true, data: { noteKey: "NOTE1" } }));
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        server,
        calls,
        bridgeBaseUrl: `http://127.0.0.1:${address.port}`
      });
    });
  });
}

test("integration: bridge-backed write operations work against the Zotero Plus bridge", async () => {
  const mock = await startMockBridge();
  const root = join(tmpdir(), "zotero-bridge-integration");
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  const filePath = join(root, "demo.pdf");
  writeFileSync(filePath, "pdf");

  try {
    const client = new ZoteroLocalApiClient({
      bridgeBaseUrl: mock.bridgeBaseUrl
    });

    const patch = await client.updateItemFields("ITEM1", {
      title: "Visual Instruction Tuning",
      url: "https://arxiv.org/abs/2304.08485"
    });

    const attachment = await client.importAttachment(filePath, "ITEM1", "Full Text PDF");
    const created = await client.createItemWithMetadata({
      itemType: "journalArticle",
      fields: { title: "Visual Instruction Tuning" }
    });
    const note = await client.createChildNote({
      parentKey: "ITEM1",
      content: "# Intake Note"
    });

    assert.equal(patch.data.itemKey, "ITEM1");
    assert.equal(attachment.parentKey, "ITEM1");
    assert.equal(attachment.attachmentKey, "ATT1");
    assert.equal(created.data.itemKey, "CREATED1");
    assert.equal(note.data.noteKey, "NOTE1");
    assert.equal(mock.calls.length, 4);

    const patchPayload = JSON.parse(mock.calls[0].body);
    assert.equal(patchPayload.itemKey, "ITEM1");
    assert.equal(patchPayload.fields.title, "Visual Instruction Tuning");
    assert.equal(mock.calls[1].url, "/importAttachment");
    assert.equal(mock.calls[2].url, "/createItem");
    assert.equal(mock.calls[3].url, "/createChildNote");
  } finally {
    await new Promise((resolve) => mock.server.close(resolve));
  }
});
