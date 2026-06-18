const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs/promises");

const ENTITY_FILES = ["characters", "factions", "scenes", "plotlines", "relationships", "anomalies", "secrets", "timelineEvents", "meta"];

function getDataFolder() {
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
    backgroundColor: "#1a1a1e",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
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
