const DB_NAME = "oxford-tracker";
const STORE = "handles";
const HANDLE_KEY = "folder";

const ENTITY_FILES = [
  "characters",
  "factions",
  "scenes",
  "plotlines",
  "relationships",
  "anomalies",
  "meta",
];

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveHandle(handle) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(handle, HANDLE_KEY);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function loadHandle() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(HANDLE_KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function connectFolder() {
  const handle = await window.showDirectoryPicker({ mode: "readwrite" });
  await handle.requestPermission({ mode: "readwrite" });
  await saveHandle(handle);
  return handle;
}

export async function restoreFolder() {
  const handle = await loadHandle();
  if (!handle) return null;
  const perm = await handle.queryPermission({ mode: "readwrite" });
  if (perm === "granted") return handle;
  const granted = await handle.requestPermission({ mode: "readwrite" });
  return granted === "granted" ? handle : null;
}

async function readJsonFile(folderHandle, filename) {
  try {
    const fh = await folderHandle.getFileHandle(filename);
    const file = await fh.getFile();
    return JSON.parse(await file.text());
  } catch {
    return null;
  }
}

async function readSeedFile(filename) {
  const resp = await fetch(`data/${filename}`);
  if (!resp.ok) throw new Error(`Seed file missing: ${filename}`);
  return resp.json();
}

async function writeJsonFile(folderHandle, filename, data) {
  const fh = await folderHandle.getFileHandle(filename, { create: true });
  const writable = await fh.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

export async function loadAll(folderHandle) {
  const result = {};
  for (const name of ENTITY_FILES) {
    const filename = `${name}.json`;
    let data = await readJsonFile(folderHandle, filename);
    if (data === null) {
      data = await readSeedFile(filename);
      await writeJsonFile(folderHandle, filename, data);
    }
    result[name] = data;
  }
  return result;
}

export async function save(folderHandle, entityType, data) {
  try {
    await writeJsonFile(folderHandle, `${entityType}.json`, data);
  } catch (err) {
    window.dispatchEvent(new CustomEvent("storage-error", {
      detail: { message: err.message, entityType },
    }));
    throw err;
  }
}
