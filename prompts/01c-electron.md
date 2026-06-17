# Slice 1.6: Electron conversion

Read CLAUDE.md and ROADMAP.md. Slice 1 must be done. Slice 1.5 (styling) can be done or not, does not matter.

## Goal

Wrap the existing web app as a native desktop application using Electron. The user double-clicks an exe (or `npm start` during development) and the app opens in its own window. No browser, no localhost, no permission prompts, no folder picker on first run. Data lives in a `user-data/` folder next to the app, automatically.

## Why this works

Electron bundles Chromium plus Node.js. The renderer process (the existing HTML/CSS/JS) keeps running unchanged. The main process (new code) creates the window and exposes filesystem operations to the renderer via a secure preload bridge. We swap the browser File System Access API for Node `fs` calls. That is the only meaningful change.

## Scope

This slice rewrites the storage layer and adds the Electron shell. It does **not** modify views, the router, the filter module, the schema (when it exists), or any CSS. If something tempts you to refactor those, stop and ask.

## Deliverables

### New files

```
package.json
main.js                  Electron main process
preload.js               secure bridge between main and renderer
src/js/storage.js        rewritten to use the bridge instead of File System Access
```

### Files to touch

- `src/js/app.js`: remove the welcome overlay logic and folder-picker flow. The app boots straight into the data view since storage is automatic now. Delete the settings button handler for "open folder" but keep the button (it will route to a settings view in a later slice).
- `src/index.html`: remove the welcome overlay markup entirely
- `src/css/layout.css`: remove welcome overlay styles
- `README.md`: rewrite the run instructions
- `.gitignore`: add Node and Electron build artifacts

### Files to leave alone

- `src/js/router.js`
- `src/js/dom.js`
- `src/js/filters.js`
- `src/css/theme.css` (slice 1.5 may have rewritten this; do not touch)
- All `src/data/` seed files

## package.json

```json
{
  "name": "oxford-tracker",
  "version": "0.1.0",
  "description": "Local desktop app for tracking the Oxford RP campaign",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder",
    "build:win": "electron-builder --win"
  },
  "devDependencies": {
    "electron": "^32.0.0",
    "electron-builder": "^25.0.0"
  },
  "build": {
    "appId": "com.oxford.tracker",
    "productName": "Oxford Tracker",
    "directories": {
      "output": "dist"
    },
    "files": [
      "main.js",
      "preload.js",
      "src/**/*",
      "!src/data/**"
    ],
    "extraResources": [
      {
        "from": "src/data",
        "to": "seed-data"
      }
    ],
    "win": {
      "target": "nsis",
      "icon": "src/assets/icon.ico"
    }
  }
}
```

Do not create the icon yet. Comment out the `icon` line with a note that the user will provide one later.

## main.js

The Electron main process. Responsibilities:

1. Create the application window (1400x900 default, minimum 1100x700, dark titlebar matching the app theme)
2. Load `src/index.html`
3. Resolve the user-data folder path (see "Data folder location" below)
4. On first launch, copy seed files from the bundled resources into the user-data folder
5. Register IPC handlers for filesystem operations
6. Quit when all windows are closed (Windows convention, even though macOS does it differently, this app is Windows-first)

Code structure roughly:

```js
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs/promises");
const fsSync = require("fs");

const ENTITY_FILES = ["characters", "factions", "scenes", "plotlines", "relationships", "anomalies", "meta"];

function getDataFolder() {
  // In development: <repo>/user-data/
  // In production: <app-install-dir>/user-data/  (portable install) or app.getPath("userData") (system install)
  // For simplicity in this slice, use a sibling folder of the app:
  if (app.isPackaged) {
    return path.join(path.dirname(app.getPath("exe")), "user-data");
  }
  return path.join(__dirname, "user-data");
}

function getSeedFolder() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "seed-data");
  }
  return path.join(__dirname, "src", "data");
}

async function ensureSeeded(dataFolder) {
  await fs.mkdir(dataFolder, { recursive: true });
  const seedFolder = getSeedFolder();
  for (const name of ENTITY_FILES) {
    const target = path.join(dataFolder, `${name}.json`);
    try {
      await fs.access(target);
    } catch {
      const source = path.join(seedFolder, `${name}.json`);
      await fs.copyFile(source, target);
    }
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#1a1814",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.loadFile(path.join(__dirname, "src", "index.html"));
}

app.whenReady().then(async () => {
  const dataFolder = getDataFolder();
  await ensureSeeded(dataFolder);

  ipcMain.handle("storage:loadAll", async () => {
    const result = {};
    for (const name of ENTITY_FILES) {
      const filepath = path.join(dataFolder, `${name}.json`);
      const text = await fs.readFile(filepath, "utf-8");
      result[name] = JSON.parse(text);
    }
    return result;
  });

  ipcMain.handle("storage:save", async (_event, entityType, data) => {
    if (!ENTITY_FILES.includes(entityType)) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }
    const filepath = path.join(dataFolder, `${entityType}.json`);
    await fs.writeFile(filepath, JSON.stringify(data, null, 2), "utf-8");
  });

  ipcMain.handle("storage:getDataFolder", () => dataFolder);

  createWindow();
});

app.on("window-all-closed", () => {
  app.quit();
});
```

Notes:
- `contextIsolation: true` and `nodeIntegration: false` are non-negotiable for security
- The dark background color matches the app theme so there is no white flash on launch
- `autoHideMenuBar: true` removes the file/edit/view menu bar (cleaner look, Alt brings it back if needed)

## preload.js

The bridge between renderer and main. Exposes a narrow API on `window.oxford` that the renderer can call.

```js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("oxford", {
  loadAll: () => ipcRenderer.invoke("storage:loadAll"),
  save: (entityType, data) => ipcRenderer.invoke("storage:save", entityType, data),
  getDataFolder: () => ipcRenderer.invoke("storage:getDataFolder")
});
```

That is the entire file. Keep it tight. Adding more here in future slices is allowed but only when needed.

## Rewritten src/js/storage.js

Replace the entire file. The new version uses `window.oxford` instead of the File System Access API:

```js
export async function loadAll() {
  try {
    return await window.oxford.loadAll();
  } catch (err) {
    window.dispatchEvent(new CustomEvent("storage-error", {
      detail: { message: err.message, entityType: "loadAll" }
    }));
    throw err;
  }
}

export async function save(entityType, data) {
  try {
    await window.oxford.save(entityType, data);
  } catch (err) {
    window.dispatchEvent(new CustomEvent("storage-error", {
      detail: { message: err.message, entityType }
    }));
    throw err;
  }
}

export async function getDataFolder() {
  return await window.oxford.getDataFolder();
}
```

Note that `connectFolder` and `restoreFolder` are gone. The renderer no longer manages folder handles.

## Updated src/js/app.js

Simplify the boot sequence. The folder selection flow disappears entirely.

```js
import { loadAll } from "./storage.js";
import { navigate, initRouter } from "./router.js";
import { qs, el, clear } from "./dom.js";

// ... TABS and COMING_SLICE arrays stay the same ...

let appData = null;

// mountView, setActiveTab, showBanner, hideBanner stay the same

async function init() {
  // Wire tab clicks.
  for (const btn of document.querySelectorAll(".tab-btn")) {
    btn.addEventListener("click", () => navigate(btn.dataset.tab));
  }

  // Wire error banner dismiss.
  qs("#banner-dismiss").addEventListener("click", hideBanner);

  // Listen for storage errors.
  window.addEventListener("storage-error", (e) => {
    showBanner(`Storage error (${e.detail.entityType}): ${e.detail.message}`);
  });

  // Listen for route changes.
  window.addEventListener("route-change", (e) => {
    const { tab } = e.detail;
    setActiveTab(tab);
    mountView(tab);
  });

  // Load data and boot.
  try {
    appData = await loadAll();
    initRouter();
  } catch (err) {
    showBanner(`Could not load data: ${err.message}`);
  }
}

init();
```

The settings button stays in the markup but its click handler is removed for now. It will route to a settings view in a later slice.

## Updated src/index.html

Remove the welcome overlay markup block entirely. Everything else stays.

## .gitignore additions

Add these lines to the existing .gitignore:

```
node_modules/
dist/
user-data/
package-lock.json
```

(`user-data/` was already there from slice 1, that is fine.)

## Updated README.md

Replace the run instructions with:

```markdown
## How to run (development)

1. Install Node.js 20 or higher from https://nodejs.org
2. From the project folder, run `npm install` once
3. Then `npm start` to launch the app

## How to build a Windows installer

Run `npm run build:win`. The installer appears in `dist/`.

## Where your data lives

The app reads and writes a `user-data/` folder next to itself. In development, that means the project root. After installing the built app, it lives next to the exe. The folder is created automatically on first launch with empty seed data.
```

## Definition of done

- `npm install` runs cleanly
- `npm start` opens the app in a desktop window
- The window has no menu bar visible
- The five tabs work, hash routing works, no welcome overlay appears
- A `user-data/` folder appears next to the project on first run with the seven JSON files
- Closing the window quits the app
- Reopening picks up where it left off
- No console errors in DevTools (Ctrl+Shift+I to open)

## Out of scope

- Auto-updates
- App icon (deferred until user provides one)
- macOS or Linux builds
- Code signing
- A settings view (the settings button is wired up in a later slice)
- Touching any view or styling

## Followups to log

Add to ROADMAP.md a "Future slice" entry: "Settings view: data folder location display, theme override beyond toggle, export/import shortcuts, app version display."
