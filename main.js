/* ============================================================
 * AINA — Facturation — Processus principal Electron
 * ============================================================ */
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const store = require("./src/db");

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 650,
    title: "AINA — Facturation",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(() => {
  store.init(app.getPath("userData"));

  // Sauvegarde automatique quotidienne : une seule fois par jour, au
  // démarrage, puis vérifiée toutes les 6 heures si le logiciel reste ouvert.
  runDailyAutoBackupIfNeeded();
  setInterval(runDailyAutoBackupIfNeeded, 6 * 60 * 60 * 1000);

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function runDailyAutoBackupIfNeeded() {
  try {
    const last = store.getLastBackupDate();
    const todayKey = new Date().toISOString().slice(0, 10);
    const lastKey = last ? new Date(last).toISOString().slice(0, 10) : null;
    if (lastKey !== todayKey) {
      store.backupNow("quotidienne");
    }
  } catch (e) {
    console.error("Sauvegarde quotidienne échouée:", e);
  }
}

/* ------------------------------------------------------------
   IPC — stockage (remplace window.storage)
   ------------------------------------------------------------ */
ipcMain.handle("storage:get", (event, key) => store.storageGet(key));
ipcMain.handle("storage:set", (event, key, value) => store.storageSet(key, value));
ipcMain.handle("storage:delete", (event, key) => store.storageDelete(key));

/* ------------------------------------------------------------
   IPC — outils base de données & sauvegarde
   ------------------------------------------------------------ */
ipcMain.handle("db:backupNow", () => store.backupNow());
ipcMain.handle("db:listBackups", () => store.listBackups());
ipcMain.handle("db:lastBackupDate", () => store.getLastBackupDate());
ipcMain.handle("db:dbInfo", () => ({ dbPath: store.getDbPath(), backupsDir: store.getBackupsDir() }));

ipcMain.handle("db:restoreBackupDialog", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Choisir une sauvegarde à restaurer",
    defaultPath: store.getBackupsDir(),
    properties: ["openFile"],
    filters: [{ name: "Base de données AINA (.db)", extensions: ["db"] }]
  });
  if (result.canceled || !result.filePaths.length) return { canceled: true };
  const filePath = result.filePaths[0];
  const res = store.restoreBackup(filePath);
  return { canceled: false, ...res };
});

ipcMain.handle("db:exportCopyDialog", async () => {
  const defaultName = `AINA_Copie_${new Date().toISOString().slice(0, 10)}.db`;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Exporter une copie de la base de données",
    defaultPath: defaultName,
    filters: [{ name: "Base de données AINA (.db)", extensions: ["db"] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  const res = store.exportCopy(result.filePath);
  return { canceled: false, ...res };
});

ipcMain.handle("db:exportJSONDialog", async () => {
  const defaultName = `AINA_Export_${new Date().toISOString().slice(0, 10)}.json`;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Exporter toutes les données (JSON)",
    defaultPath: defaultName,
    filters: [{ name: "Fichier JSON", extensions: ["json"] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  const res = store.exportAllJSON(result.filePath);
  return { canceled: false, ...res };
});

ipcMain.handle("db:importJSONDialog", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Importer des données (JSON)",
    properties: ["openFile"],
    filters: [{ name: "Fichier JSON", extensions: ["json"] }]
  });
  if (result.canceled || !result.filePaths.length) return { canceled: true };
  const res = store.importAllJSON(result.filePaths[0]);
  return { canceled: false, ...res };
});

ipcMain.handle("db:resetDatabase", () => store.resetDatabase());
