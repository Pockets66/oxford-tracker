const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("oxford", {
  loadAll: () => ipcRenderer.invoke("storage:loadAll"),
  save: (entityType, data) => ipcRenderer.invoke("storage:save", entityType, data),
  getDataFolder: () => ipcRenderer.invoke("storage:getDataFolder"),
});
