(function() {
  const config = {
    addonName: "Zotero Plus Bridge",
    addonID: "zotero-plus-bridge@local.ryan",
    addonInstance: "ZoteroPlusBridge",
    prefsPrefix: "extensions.zotero.zotero-plus-bridge"
  };

  const PREF_PORT = `${config.prefsPrefix}.http.port`;
  const PREF_ENABLED = `${config.prefsPrefix}.http.enabled`;
  const DEFAULT_PORT = 23121;

  function log(message) {
    try {
      Zotero.debug(`[ZoteroPlusBridge] ${message}`);
    } catch (err) {
    }
  }

  function setDefaultPrefs() {
    const currentPort = Zotero.Prefs.get(PREF_PORT, true);
    const currentEnabled = Zotero.Prefs.get(PREF_ENABLED, true);

    if (currentPort === undefined || currentPort === null) {
      Zotero.Prefs.set(PREF_PORT, DEFAULT_PORT, true);
    }
    if (currentEnabled === undefined || currentEnabled === null) {
      Zotero.Prefs.set(PREF_ENABLED, true, true);
    }
  }

  function buildJsonResponse(status, statusText, payload) {
    const body = JSON.stringify(payload);
    return (
      `HTTP/1.1 ${status} ${statusText}\r\n` +
      `Content-Type: application/json; charset=utf-8\r\n` +
      `Connection: close\r\n` +
      `Content-Length: ${body.length}\r\n\r\n` +
      body
    );
  }

  function getUserLibraryID() {
    return Zotero.Libraries.userLibraryID;
  }

  function getItemByKey(itemKey) {
    return Zotero.Items.getByLibraryAndKey(getUserLibraryID(), itemKey);
  }

  function normalizeCreators(creators = []) {
    return creators.map((creator) => {
      const normalized = { creatorType: creator.creatorType || "author" };
      if (creator.name) {
        normalized.name = creator.name;
      } else {
        normalized.firstName = creator.firstName || "";
        normalized.lastName = creator.lastName || "";
      }
      return normalized;
    });
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function contentToHtml(content) {
    const lines = String(content || "").split(/\r?\n/);
    const parts = [];
    let inList = false;

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      const trimmed = line.trim();

      if (!trimmed) {
        if (inList) {
          parts.push("</ul>");
          inList = false;
        }
        continue;
      }

      if (trimmed.startsWith("# ")) {
        if (inList) {
          parts.push("</ul>");
          inList = false;
        }
        parts.push(`<h1>${escapeHtml(trimmed.slice(2))}</h1>`);
        continue;
      }

      if (trimmed.startsWith("## ")) {
        if (inList) {
          parts.push("</ul>");
          inList = false;
        }
        parts.push(`<h2>${escapeHtml(trimmed.slice(3))}</h2>`);
        continue;
      }

      if (trimmed.startsWith("- ")) {
        if (!inList) {
          parts.push("<ul>");
          inList = true;
        }
        parts.push(`<li>${escapeHtml(trimmed.slice(2))}</li>`);
        continue;
      }

      if (inList) {
        parts.push("</ul>");
        inList = false;
      }
      parts.push(`<p>${escapeHtml(trimmed)}</p>`);
    }

    if (inList) {
      parts.push("</ul>");
    }

    return parts.join("");
  }

  async function importAttachment(payload) {
    const filePath = payload?.filePath;
    const parentKey = payload?.parentKey;
    const title = payload?.title || "Full Text PDF";
    const link = Boolean(payload?.link);
    const contentType = payload?.contentType || "application/pdf";

    if (!filePath) throw new Error("filePath is required");
    if (!parentKey) throw new Error("parentKey is required");
    if (!/\.pdf$/i.test(filePath)) throw new Error(`Attachment must be a PDF: ${filePath}`);

    const parentItem = getItemByKey(parentKey);
    if (!parentItem) throw new Error(`Parent item not found: ${parentKey}`);

    let attachmentItem;
    if (link) {
      attachmentItem = await Zotero.Attachments.linkFromFile({
        file: filePath,
        parentItemID: parentItem.id,
        contentType,
        title
      });
    } else {
      attachmentItem = await Zotero.Attachments.importFromFile({
        file: filePath,
        parentItemID: parentItem.id,
        contentType,
        title
      });
    }

    return {
      ok: true,
      parentKey,
      attachmentKey: attachmentItem.key,
      attachmentID: attachmentItem.id,
      title,
      stored: !link
    };
  }

  async function updateItemFields(payload) {
    const itemKey = payload?.itemKey;
    const fields = payload?.fields || {};
    const creators = payload?.creators || null;

    if (!itemKey) throw new Error("itemKey is required");
    if (!fields || typeof fields !== "object") throw new Error("fields must be an object");

    const item = getItemByKey(itemKey);
    if (!item) throw new Error(`Item not found: ${itemKey}`);

    const updatedFields = {};
    for (const [field, value] of Object.entries(fields)) {
      const before = item.getField(field);
      item.setField(field, value);
      updatedFields[field] = { before, after: value };
    }

    if (Array.isArray(creators) && creators.length) {
      item.setCreators(normalizeCreators(creators));
    }

    await item.saveTx();

    return {
      success: true,
      data: {
        itemKey,
        updatedFields,
        creatorsUpdated: Array.isArray(creators) && creators.length > 0
      }
    };
  }

  async function createItem(payload) {
    const itemType = payload?.itemType;
    const fields = payload?.fields || {};
    const creators = payload?.creators || [];
    const tags = payload?.tags || [];
    const attachmentKeys = payload?.attachmentKeys || [];

    if (!itemType) throw new Error("itemType is required");

    const item = new Zotero.Item(itemType);
    item.libraryID = getUserLibraryID();

    for (const [field, value] of Object.entries(fields)) {
      item.setField(field, value);
    }

    if (Array.isArray(creators) && creators.length) {
      item.setCreators(normalizeCreators(creators));
    }

    if (Array.isArray(tags)) {
      for (const tag of tags) {
        item.addTag(tag);
      }
    }

    await item.saveTx();

    if (Array.isArray(attachmentKeys) && attachmentKeys.length) {
      for (const attachmentKey of attachmentKeys) {
        const attachment = getItemByKey(attachmentKey);
        if (!attachment || !attachment.isAttachment()) continue;
        attachment.parentID = item.id;
        await attachment.saveTx();
      }
    }

    return {
      success: true,
      data: {
        itemKey: item.key,
        itemID: item.id,
        itemType
      }
    };
  }

  async function createChildNote(payload) {
    const parentKey = payload?.parentKey;
    const content = payload?.content;
    const tags = payload?.tags || [];

    if (!parentKey) throw new Error("parentKey is required");
    if (!content) throw new Error("content is required");

    const parentItem = getItemByKey(parentKey);
    if (!parentItem) throw new Error(`Parent item not found: ${parentKey}`);

    const note = new Zotero.Item("note");
    note.libraryID = parentItem.libraryID;
    note.parentID = parentItem.id;
    note.setNote(contentToHtml(content));

    if (Array.isArray(tags)) {
      for (const tag of tags) {
        note.addTag(tag);
      }
    }

    await note.saveTx();

    return {
      success: true,
      data: {
        noteKey: note.key,
        noteID: note.id,
        parentKey
      }
    };
  }

  async function handleRequest(method, path, requestBody) {
    if (method === "GET" && path === "/health") {
      return buildJsonResponse(200, "OK", {
        ok: true,
        addon: config.addonName,
        port: Zotero.Prefs.get(PREF_PORT, true),
        version: "0.2.0"
      });
    }

    const payload = requestBody ? JSON.parse(requestBody) : {};

    if (method === "POST" && path === "/importAttachment") {
      return buildJsonResponse(200, "OK", await importAttachment(payload));
    }

    if (method === "POST" && path === "/updateItemFields") {
      return buildJsonResponse(200, "OK", await updateItemFields(payload));
    }

    if (method === "POST" && path === "/createItem") {
      return buildJsonResponse(200, "OK", await createItem(payload));
    }

    if (method === "POST" && path === "/createChildNote") {
      return buildJsonResponse(200, "OK", await createChildNote(payload));
    }

    return buildJsonResponse(404, "Not Found", {
      error: `No endpoint found for ${method} ${path}`
    });
  }

  class BridgeServer {
    constructor() {
      this.serverSocket = null;
      this.isRunning = false;
      this.listener = {
        onSocketAccepted: async (_socket, transport) => {
          let input = null;
          let output = null;
          let scriptable = null;
          let converter = null;
          try {
            input = transport.openInputStream(0, 0, 0);
            output = transport.openOutputStream(0, 0, 0);

            converter = Cc["@mozilla.org/intl/converter-input-stream;1"].createInstance(Ci.nsIConverterInputStream);
            converter.init(input, "UTF-8", 0, 0);

            scriptable = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
            scriptable.init(input);

            let requestText = "";
            let waitAttempts = 0;
            let headersComplete = false;
            let contentLength = 0;
            let bodyStartIndex = -1;

            while (!headersComplete && waitAttempts < 50) {
              const available = input.available();
              if (!available) {
                waitAttempts++;
                await new Promise(resolve => setTimeout(resolve, 10));
                continue;
              }

              const str = {};
              const bytesRead = converter.readString(Math.min(available, 4096), str);
              if (!bytesRead) break;
              requestText += str.value || "";
              bodyStartIndex = requestText.indexOf("\r\n\r\n");
              if (bodyStartIndex !== -1) {
                headersComplete = true;
                const headersSection = requestText.substring(0, bodyStartIndex);
                const match = headersSection.match(/Content-Length:\s*(\d+)/i);
                if (match) {
                  contentLength = parseInt(match[1], 10);
                }
              }
            }

            if (headersComplete && contentLength > 0) {
              const bodyStart = bodyStartIndex + 4;
              while (requestText.length - bodyStart < contentLength) {
                const available = input.available();
                if (!available) {
                  await new Promise(resolve => setTimeout(resolve, 10));
                  continue;
                }
                const str = {};
                const bytesRead = converter.readString(
                  Math.min(available, contentLength - (requestText.length - bodyStart)),
                  str
                );
                if (!bytesRead) break;
                requestText += str.value || "";
              }
            }

            if (!requestText) return;

            const requestLine = requestText.split("\r\n")[0];
            const [method, rawPath] = requestLine.split(" ");
            const path = new URL(rawPath, "http://127.0.0.1").pathname;
            const bodyStart = requestText.indexOf("\r\n\r\n");
            const requestBody = bodyStart === -1 ? "" : requestText.substring(bodyStart + 4);

            let response;
            try {
              response = await handleRequest(method, path, requestBody);
            } catch (error) {
              response = buildJsonResponse(500, "Internal Server Error", {
                error: String(error?.message || error)
              });
            }

            output.write(response, response.length);
          } catch (error) {
            log(`Request handling failed: ${error}`);
          } finally {
            try { if (converter) converter.close(); } catch (e) {}
            try { if (scriptable) scriptable.close(); } catch (e) {}
            try { if (input) input.close(); } catch (e) {}
            try { if (output) output.close(); } catch (e) {}
            try { transport.close(0); } catch (e) {}
          }
        },
        onStopListening: (_socket, status) => {
          log(`Server stopped listening with status ${status}`);
        }
      };
    }

    start() {
      if (this.isRunning) return;

      const port = Zotero.Prefs.get(PREF_PORT, true) || DEFAULT_PORT;
      this.serverSocket = Cc["@mozilla.org/network/server-socket;1"].createInstance(Ci.nsIServerSocket);
      this.serverSocket.init(port, true, -1);
      this.serverSocket.asyncListen(this.listener);
      this.isRunning = true;
      log(`Bridge listening on 127.0.0.1:${port}`);
    }

    stop() {
      if (!this.serverSocket) return;
      try { this.serverSocket.close(); } catch (error) {}
      this.serverSocket = null;
      this.isRunning = false;
      log("Bridge stopped");
    }
  }

  const bridgeServer = new BridgeServer();

  Zotero[config.addonInstance] = {
    hooks: {
      onStartup: async () => {
        setDefaultPrefs();
        if (Zotero.Prefs.get(PREF_ENABLED, true) !== false) {
          bridgeServer.start();
        }
      },
      onShutdown: async () => {
        bridgeServer.stop();
      }
    },
    api: {
      startServer: () => bridgeServer.start(),
      stopServer: () => bridgeServer.stop()
    }
  };
})();
