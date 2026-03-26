import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ZoteroLocalApiClient } from "../server/index.js";

function startMockZotero() {
  const calls = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString("utf8");
    calls.push({ method: req.method, url: req.url, headers: req.headers, body });

    if (req.method === "GET" && req.url === "/api/users/0/items/ITEM1") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({
        version: 3,
        data: {
          key: "ITEM1",
          title: "Old title",
          extra: "",
          url: "https://arxiv.org/abs/2304.08485",
          collections: ["COLL1"]
        }
      }));
    }

    if (req.method === "PATCH" && req.url === "/api/users/0/items/ITEM1") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ success: { "0": "ITEM1" } }));
    }

    if (req.method === "GET" && req.url === "/api/users/0/items?limit=1") {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Last-Modified-Version": "3"
      });
      return res.end(JSON.stringify([]));
    }

    if (req.method === "POST" && req.url.startsWith("/connector/saveStandaloneAttachment")) {
      res.writeHead(201, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ canRecognize: true }));
    }

    if (req.method === "GET" && req.url === "/api/users/0/items?since=3&sort=dateAdded&direction=desc&limit=25") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify([
        {
          key: "DUP1",
          data: {
            key: "DUP1",
            itemType: "preprint",
            title: "Old title",
            url: "https://arxiv.org/abs/2304.08485"
          },
          links: {
            attachment: {
              href: "http://127.0.0.1:9999/api/users/0/items/ATT1"
            }
          }
        },
        {
          key: "ATT1",
          data: {
            key: "ATT1",
            itemType: "attachment",
            filename: "demo.pdf",
            url: "https://arxiv.org/abs/2304.08485"
          }
        }
      ]));
    }

    if (req.method === "POST" && req.url === "/mcp") {
      const request = JSON.parse(body);
      if (request.params.name === "write_item") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({
          result: {
            content: [{
              type: "text",
              text: JSON.stringify({ success: true, data: { successCount: 1 } })
            }]
          }
        }));
      }

      if (request.params.name === "remove_items_from_collection") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({
          result: {
            content: [{
              type: "text",
              text: JSON.stringify({ success: true, removed: ["DUP1"] })
            }]
          }
        }));
      }
    }

    if (req.method === "GET" && req.url === "/api/users/0/items/ATT1") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({
        version: 4,
        data: {
          key: "ATT1",
          itemType: "attachment",
          parentItem: "ITEM1"
        }
      }));
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
        baseUrl: `http://127.0.0.1:${address.port}/api`,
        mcpBaseUrl: `http://127.0.0.1:${address.port}`
      });
    });
  });
}

test("integration: updateItemFields and importAttachment work against mock Zotero API", async () => {
  const mock = await startMockZotero();
  const root = join(tmpdir(), "zotero-mcp-extension-integration");
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  const filePath = join(root, "demo.pdf");
  writeFileSync(filePath, "pdf");

  try {
    const client = new ZoteroLocalApiClient({
      baseUrl: mock.baseUrl,
      mcpBaseUrl: mock.mcpBaseUrl,
      library: "user",
      libraryId: "0"
    });

    const patch = await client.updateItemFields("ITEM1", {
      title: "Visual Instruction Tuning",
      url: "https://arxiv.org/abs/2304.08485",
      extra: "Citation Key: Liu2023VisualInstructionTuning"
    });

    const attachment = await client.importAttachment(filePath, "ITEM1", "Full Text PDF");

    assert.equal(patch.itemKey, "ITEM1");
    assert.equal(attachment.parentKey, "ITEM1");
    assert.equal(attachment.attachmentKey, "ATT1");
    assert.equal(mock.calls.length, 9);

    const patchPayload = JSON.parse(mock.calls[1].body);
    assert.equal(patchPayload[0].title, "Visual Instruction Tuning");
    assert.match(patchPayload[0].extra, /Citation Key/);
    assert.equal(mock.calls[2].method, "GET");
    assert.equal(mock.calls[3].method, "GET");
    assert.ok(mock.calls[4].url.startsWith("/connector/saveStandaloneAttachment"));
    assert.equal(mock.calls[4].method, "POST");
    assert.equal(mock.calls[5].method, "GET");
    assert.equal(mock.calls[6].url, "/mcp");
    assert.equal(mock.calls[7].url, "/mcp");
    assert.equal(mock.calls[8].method, "GET");
  } finally {
    await new Promise((resolve) => mock.server.close(resolve));
  }
});
