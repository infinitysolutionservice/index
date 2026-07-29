/* ============================================================
 * AINA — Facturation — Script de préchargement
 *
 * Expose à la page (index.html) :
 *   - window.storage.{get,set,delete}  → reproduit l'ancienne API
 *     window.storage utilisée par l'application, mais branchée sur
 *     la vraie base SQLite locale via IPC.
 *   - window.dbTools.*                  → sauvegarde, restauration,
 *     export, import, réinitialisation.
 *   - window.html2canvas / window.jspdf / window.XLSX → chargés
 *     depuis les modules npm locaux (fonctionnement 100% hors ligne,
 *     plus besoin d'Internet ni de CDN).
 * ============================================================ */
const { ipcRenderer } = require("electron");

window.storage = {
  get: (key /*, shared */) => ipcRenderer.invoke("storage:get", key),
  set: (key, value /*, shared */) => ipcRenderer.invoke("storage:set", key, value),
  delete: (key /*, shared */) => ipcRenderer.invoke("storage:delete", key)
};

window.dbTools = {
  backupNow: () => ipcRenderer.invoke("db:backupNow"),
  listBackups: () => ipcRenderer.invoke("db:listBackups"),
  lastBackupDate: () => ipcRenderer.invoke("db:lastBackupDate"),
  dbInfo: () => ipcRenderer.invoke("db:dbInfo"),
  restoreBackupDialog: () => ipcRenderer.invoke("db:restoreBackupDialog"),
  exportCopyDialog: () => ipcRenderer.invoke("db:exportCopyDialog"),
  exportJSONDialog: () => ipcRenderer.invoke("db:exportJSONDialog"),
  importJSONDialog: () => ipcRenderer.invoke("db:importJSONDialog"),
  resetDatabase: () => ipcRenderer.invoke("db:resetDatabase")
};

// Bibliothèques utilisées pour l'export PDF / Word / Excel des factures,
// chargées localement (npm) pour un fonctionnement 100% hors ligne.
window.html2canvas = require("html2canvas");
window.jspdf = require("jspdf");
window.XLSX = require("xlsx");
