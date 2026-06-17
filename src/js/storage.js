export async function loadAll() {
  try {
    return await window.oxford.loadAll();
  } catch (err) {
    window.dispatchEvent(new CustomEvent("storage-error", {
      detail: { message: err.message, entityType: "loadAll" },
    }));
    throw err;
  }
}

export async function save(entityType, data) {
  try {
    await window.oxford.save(entityType, data);
  } catch (err) {
    window.dispatchEvent(new CustomEvent("storage-error", {
      detail: { message: err.message, entityType },
    }));
    throw err;
  }
}

export async function getDataFolder() {
  return await window.oxford.getDataFolder();
}
