var chromeHandle;

function install(data, reason) {}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  var aomStartup = Components.classes[
    "@mozilla.org/addons/addon-manager-startup;1"
  ].getService(Components.interfaces.amIAddonManagerStartup);
  var manifestURI = Services.io.newURI(rootURI + "manifest.json");
  chromeHandle = aomStartup.registerChrome(manifestURI, [
    ["content", "zotero-plus-bridge", rootURI + "content/"]
  ]);

  const ctx = { rootURI };
  ctx._globalThis = ctx;

  Services.scriptloader.loadSubScript(
    `${rootURI}/content/scripts/zotero-plus-bridge.js`,
    ctx
  );
  await Zotero.ZoteroPlusBridge.hooks.onStartup();
}

async function shutdown({ id, version, resourceURI, rootURI }, reason) {
  await Zotero.ZoteroPlusBridge?.hooks.onShutdown();

  if (reason === APP_SHUTDOWN) {
    return;
  }

  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }
}

async function onMainWindowLoad({ window }, reason) {}
async function onMainWindowUnload({ window }, reason) {}
async function uninstall(data, reason) {}

