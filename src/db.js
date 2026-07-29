/* ============================================================
 * AINA — Facturation
 * Couche base de données locale (SQLite via better-sqlite3)
 *
 * Ce module :
 *  - crée/ouvre facturation.db dans le dossier de données de
 *    l'application (emplacement Windows standard, PAS le dossier
 *    du projet) ;
 *  - expose une API "storage" (get/set/delete) qui reproduit
 *    exactement le comportement de l'ancien window.storage utilisé
 *    par index.html, pour ne rien casser côté interface ;
 *  - gère les sauvegardes automatiques/manuelles, la restauration,
 *    l'export/import complet et la réinitialisation.
 * ============================================================ */

const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DEFAULT_SETTINGS = {
  companyName: "AINA SECURITE SENEGAL",
  logoDataUrl: "",
  address: "Dakar, Sénégal",
  phone: "",
  email: "Ainasecurite33@gmail.com",
  ninea: "0054840432J1",
  arrete: "N°006094 (MINT/DGPN/BEM)",
  bankInfo: "",
  responsableName: "",
  responsableFonction: "Président"
};
const DEFAULT_CUSTOM = {
  primaryColor: "#1f2f45",
  brassColor: "#a9812f",
  font: "serif",
  logoSize: 70,
  logoPosition: "left",
  watermarkEnabled: false,
  watermarkText: "AINA SÉCURITÉ",
  watermarkOpacity: 6,
  watermarkSize: 90
};
const DEFAULT_TAX = {
  tvaActiveDefault: false,
  tvaTauxDefault: 18,
  extraTemplates: []
};

let db = null;
let dbPath = "";
let backupsDir = "";
let lastAutoBackupAt = 0;

/* ------------------------------------------------------------
   Initialisation
   ------------------------------------------------------------ */
function init(userDataDir) {
  const dataDir = path.join(userDataDir, "AINA-Facturation-Data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  backupsDir = path.join(dataDir, "backups");
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

  dbPath = path.join(dataDir, "facturation.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  createSchema();
  seedDefaults();
  return { dbPath, backupsDir };
}

function createSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS customization (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tax_defaults (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS counter (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      value INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      nom TEXT,
      adresse TEXT,
      telephone TEXT,
      email TEXT,
      ninea TEXT,
      responsable TEXT
    );
    CREATE TABLE IF NOT EXISTS prestations (
      id TEXT PRIMARY KEY,
      designation TEXT,
      prix_unitaire REAL
    );
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      numero TEXT,
      date_emission TEXT,
      date_creation TEXT,
      mois INTEGER,
      annee INTEGER,
      client_id TEXT,
      objet_prefix TEXT,
      objet_manual INTEGER,
      objet_custom TEXT,
      tva_active INTEGER,
      tva_taux REAL,
      statut TEXT,
      snapshot TEXT
    );
    CREATE TABLE IF NOT EXISTS invoice_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      line_id TEXT,
      designation TEXT,
      quantite REAL,
      prix_unitaire REAL,
      ordre INTEGER
    );
    CREATE TABLE IF NOT EXISTS extra_charges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      charge_id TEXT,
      label TEXT,
      type TEXT,
      amount REAL,
      ordre INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_extra_charges_invoice ON extra_charges(invoice_id);
  `);
}

function seedDefaults() {
  const s = db.prepare("SELECT id FROM settings WHERE id = 1").get();
  if (!s) db.prepare("INSERT INTO settings (id, data) VALUES (1, ?)").run(JSON.stringify(DEFAULT_SETTINGS));
  const c = db.prepare("SELECT id FROM customization WHERE id = 1").get();
  if (!c) db.prepare("INSERT INTO customization (id, data) VALUES (1, ?)").run(JSON.stringify(DEFAULT_CUSTOM));
  const t = db.prepare("SELECT id FROM tax_defaults WHERE id = 1").get();
  if (!t) db.prepare("INSERT INTO tax_defaults (id, data) VALUES (1, ?)").run(JSON.stringify(DEFAULT_TAX));
  const cnt = db.prepare("SELECT id FROM counter WHERE id = 1").get();
  if (!cnt) db.prepare("INSERT INTO counter (id, value) VALUES (1, 0)").run();
}

/* ------------------------------------------------------------
   Helpers internes
   ------------------------------------------------------------ */
function getKV(table) {
  const row = db.prepare(`SELECT data FROM ${table} WHERE id = 1`).get();
  return row ? row.data : "{}";
}
function setKV(table, jsonValue) {
  db.prepare(`
    INSERT INTO ${table} (id, data) VALUES (1, ?)
    ON CONFLICT(id) DO UPDATE SET data = excluded.data
  `).run(jsonValue);
}

function getCounterJSON() {
  const row = db.prepare("SELECT value FROM counter WHERE id = 1").get();
  return JSON.stringify(row ? row.value : 0);
}
function setCounterJSON(jsonValue) {
  const v = Number(JSON.parse(jsonValue)) || 0;
  db.prepare(`
    INSERT INTO counter (id, value) VALUES (1, ?)
    ON CONFLICT(id) DO UPDATE SET value = excluded.value
  `).run(v);
}

function getClientsJSON() {
  const rows = db.prepare("SELECT * FROM clients ORDER BY nom COLLATE NOCASE").all();
  const list = rows.map(r => ({
    id: r.id, nom: r.nom || "", adresse: r.adresse || "", telephone: r.telephone || "",
    email: r.email || "", ninea: r.ninea || "", responsable: r.responsable || ""
  }));
  return JSON.stringify(list);
}
function setClientsJSON(jsonValue) {
  const list = JSON.parse(jsonValue) || [];
  const tx = db.transaction((items) => {
    db.prepare("DELETE FROM clients").run();
    const ins = db.prepare(`
      INSERT INTO clients (id, nom, adresse, telephone, email, ninea, responsable)
      VALUES (@id, @nom, @adresse, @telephone, @email, @ninea, @responsable)
    `);
    for (const c of items) {
      ins.run({
        id: c.id, nom: c.nom || "", adresse: c.adresse || "", telephone: c.telephone || "",
        email: c.email || "", ninea: c.ninea || "", responsable: c.responsable || ""
      });
    }
  });
  tx(list);
}

function getPrestationsJSON() {
  const rows = db.prepare("SELECT * FROM prestations ORDER BY designation COLLATE NOCASE").all();
  const list = rows.map(r => ({ id: r.id, designation: r.designation || "", prixUnitaire: r.prix_unitaire || 0 }));
  return JSON.stringify(list);
}
function setPrestationsJSON(jsonValue) {
  const list = JSON.parse(jsonValue) || [];
  const tx = db.transaction((items) => {
    db.prepare("DELETE FROM prestations").run();
    const ins = db.prepare("INSERT INTO prestations (id, designation, prix_unitaire) VALUES (@id, @designation, @prixUnitaire)");
    for (const p of items) {
      ins.run({ id: p.id, designation: p.designation || "", prixUnitaire: Number(p.prixUnitaire) || 0 });
    }
  });
  tx(list);
}

function currentSnapshot() {
  return JSON.stringify({
    settings: JSON.parse(getKV("settings")),
    customization: JSON.parse(getKV("customization"))
  });
}

function getInvoicesJSON() {
  const invRows = db.prepare("SELECT * FROM invoices").all();
  const lineStmt = db.prepare("SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY ordre ASC, id ASC");
  const chargeStmt = db.prepare("SELECT * FROM extra_charges WHERE invoice_id = ? ORDER BY ordre ASC, id ASC");
  const list = invRows.map(r => {
    const lignes = lineStmt.all(r.id).map(l => ({
      id: l.line_id, designation: l.designation || "", quantite: l.quantite, prixUnitaire: l.prix_unitaire
    }));
    const extraCharges = chargeStmt.all(r.id).map(e => ({
      id: e.charge_id, label: e.label || "", type: e.type, amount: e.amount
    }));
    let snapshot = null;
    try { snapshot = r.snapshot ? JSON.parse(r.snapshot) : null; } catch (e) { snapshot = null; }
    return {
      id: r.id,
      numero: r.numero,
      dateEmission: r.date_emission,
      dateCreation: r.date_creation,
      mois: r.mois,
      annee: r.annee,
      clientId: r.client_id,
      objetPrefix: r.objet_prefix,
      objetManual: !!r.objet_manual,
      objetCustom: r.objet_custom,
      tvaActive: !!r.tva_active,
      tvaTaux: r.tva_taux,
      statut: r.statut,
      lignes,
      extraCharges,
      _snapshot: snapshot
    };
  });
  return JSON.stringify(list);
}

function setInvoicesJSON(jsonValue) {
  const list = JSON.parse(jsonValue) || [];
  maybeAutoBackup("avant-modification-factures");

  const existing = db.prepare("SELECT id, snapshot FROM invoices").all();
  const existingSnapshots = {};
  for (const row of existing) existingSnapshots[row.id] = row.snapshot;

  const tx = db.transaction((items) => {
    db.prepare("DELETE FROM invoice_lines").run();
    db.prepare("DELETE FROM extra_charges").run();
    db.prepare("DELETE FROM invoices").run();

    const insInv = db.prepare(`
      INSERT INTO invoices (id, numero, date_emission, date_creation, mois, annee, client_id,
        objet_prefix, objet_manual, objet_custom, tva_active, tva_taux, statut, snapshot)
      VALUES (@id, @numero, @dateEmission, @dateCreation, @mois, @annee, @clientId,
        @objetPrefix, @objetManual, @objetCustom, @tvaActive, @tvaTaux, @statut, @snapshot)
    `);
    const insLine = db.prepare(`
      INSERT INTO invoice_lines (invoice_id, line_id, designation, quantite, prix_unitaire, ordre)
      VALUES (@invoiceId, @lineId, @designation, @quantite, @prixUnitaire, @ordre)
    `);
    const insCharge = db.prepare(`
      INSERT INTO extra_charges (invoice_id, charge_id, label, type, amount, ordre)
      VALUES (@invoiceId, @chargeId, @label, @type, @amount, @ordre)
    `);

    for (const inv of items) {
      const snapshot = existingSnapshots[inv.id] || currentSnapshot();
      insInv.run({
        id: inv.id,
        numero: inv.numero,
        dateEmission: inv.dateEmission || "",
        dateCreation: inv.dateCreation || "",
        mois: Number(inv.mois) || null,
        annee: Number(inv.annee) || null,
        clientId: inv.clientId || "",
        objetPrefix: inv.objetPrefix || "",
        objetManual: inv.objetManual ? 1 : 0,
        objetCustom: inv.objetCustom || "",
        tvaActive: inv.tvaActive ? 1 : 0,
        tvaTaux: Number(inv.tvaTaux) || 0,
        statut: inv.statut || "brouillon",
        snapshot
      });
      (inv.lignes || []).forEach((l, i) => {
        insLine.run({
          invoiceId: inv.id, lineId: l.id || "", designation: l.designation || "",
          quantite: Number(l.quantite) || 0, prixUnitaire: Number(l.prixUnitaire) || 0, ordre: i
        });
      });
      (inv.extraCharges || []).forEach((e, i) => {
        insCharge.run({
          invoiceId: inv.id, chargeId: e.id || "", label: e.label || "",
          type: e.type || "frais", amount: Number(e.amount) || 0, ordre: i
        });
      });
    }
  });
  tx(list);
}

/* ------------------------------------------------------------
   API "storage" — même contrat que l'ancien window.storage
   ------------------------------------------------------------ */
const KEY_TABLE = { settings: "settings", customization: "customization", taxDefaults: "tax_defaults" };

function storageGet(key) {
  if (KEY_TABLE[key]) return { key, value: getKV(KEY_TABLE[key]), shared: false };
  if (key === "counter") return { key, value: getCounterJSON(), shared: false };
  if (key === "clients") return { key, value: getClientsJSON(), shared: false };
  if (key === "prestations") return { key, value: getPrestationsJSON(), shared: false };
  if (key === "invoices") return { key, value: getInvoicesJSON(), shared: false };
  return null;
}

function storageSet(key, value) {
  if (KEY_TABLE[key]) { setKV(KEY_TABLE[key], value); return { key, value, shared: false }; }
  if (key === "counter") { setCounterJSON(value); return { key, value, shared: false }; }
  if (key === "clients") { setClientsJSON(value); return { key, value, shared: false }; }
  if (key === "prestations") { setPrestationsJSON(value); return { key, value, shared: false }; }
  if (key === "invoices") { setInvoicesJSON(value); return { key, value, shared: false }; }
  return null;
}

function storageDelete(key) {
  // Non utilisé par l'application mais fourni pour compatibilité de l'API.
  if (key === "clients") setClientsJSON("[]");
  else if (key === "prestations") setPrestationsJSON("[]");
  else if (key === "invoices") setInvoicesJSON("[]");
  return { key, deleted: true, shared: false };
}

/* ------------------------------------------------------------
   Sauvegarde / restauration / export / import / reset
   ------------------------------------------------------------ */
function pad(n) { return String(n).padStart(2, "0"); }
function backupFileName(suffix) {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `AINA_Backup_${stamp}${suffix ? "_" + suffix : ""}.db`;
}

function backupNow(suffix) {
  db.pragma("wal_checkpoint(TRUNCATE)");
  const fileName = backupFileName(suffix);
  const dest = path.join(backupsDir, fileName);
  fs.copyFileSync(dbPath, dest);
  lastAutoBackupAt = Date.now();
  return { fileName, path: dest, date: new Date().toISOString() };
}

function maybeAutoBackup(label) {
  // Sauvegarde automatique avant chaque modification importante,
  // limitée à une fois par minute pour éviter les doublons inutiles.
  if (Date.now() - lastAutoBackupAt < 60 * 1000) return null;
  try { return backupNow("auto"); } catch (e) { console.error("Sauvegarde automatique échouée:", e); return null; }
}

function listBackups() {
  if (!fs.existsSync(backupsDir)) return [];
  return fs.readdirSync(backupsDir)
    .filter(f => f.toLowerCase().endsWith(".db"))
    .map(f => {
      const full = path.join(backupsDir, f);
      const stat = fs.statSync(full);
      return { fileName: f, path: full, size: stat.size, mtime: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.mtime.localeCompare(a.mtime));
}

function getLastBackupDate() {
  const list = listBackups();
  return list.length ? list[0].mtime : null;
}

function restoreBackup(filePath) {
  if (!fs.existsSync(filePath)) throw new Error("Fichier de sauvegarde introuvable.");
  // Sécurité : on sauvegarde l'état actuel avant d'écraser quoi que ce soit.
  backupNow("avant-restauration");
  db.close();
  fs.copyFileSync(filePath, dbPath);
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const check = db.prepare("PRAGMA integrity_check").get();
  createSchema();
  seedDefaults();
  return { ok: true, integrity: check ? check.integrity_check : "unknown" };
}

function exportCopy(destPath) {
  db.pragma("wal_checkpoint(TRUNCATE)");
  fs.copyFileSync(dbPath, destPath);
  return { ok: true, path: destPath };
}

function exportAllJSON(destPath) {
  const data = {
    exportedAt: new Date().toISOString(),
    settings: JSON.parse(getKV("settings")),
    customization: JSON.parse(getKV("customization")),
    taxDefaults: JSON.parse(getKV("tax_defaults")),
    counter: JSON.parse(getCounterJSON()),
    clients: JSON.parse(getClientsJSON()),
    prestations: JSON.parse(getPrestationsJSON()),
    invoices: JSON.parse(getInvoicesJSON())
  };
  fs.writeFileSync(destPath, JSON.stringify(data, null, 2), "utf-8");
  return { ok: true, path: destPath };
}

function importAllJSON(filePath) {
  if (!fs.existsSync(filePath)) throw new Error("Fichier d'import introuvable.");
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw);
  if (!data || typeof data !== "object") throw new Error("Fichier JSON invalide.");

  backupNow("avant-import");

  if (data.settings) setKV("settings", JSON.stringify(data.settings));
  if (data.customization) setKV("customization", JSON.stringify(data.customization));
  if (data.taxDefaults) setKV("tax_defaults", JSON.stringify(data.taxDefaults));
  if (typeof data.counter === "number") setCounterJSON(JSON.stringify(data.counter));
  if (Array.isArray(data.clients)) setClientsJSON(JSON.stringify(data.clients));
  if (Array.isArray(data.prestations)) setPrestationsJSON(JSON.stringify(data.prestations));
  if (Array.isArray(data.invoices)) {
    // On conserve les instantanés fournis dans le fichier importé plutôt que
    // d'en générer de nouveaux, pour préserver l'apparence des anciennes factures.
    const tx = db.transaction((items) => {
      db.prepare("DELETE FROM invoice_lines").run();
      db.prepare("DELETE FROM extra_charges").run();
      db.prepare("DELETE FROM invoices").run();
      const insInv = db.prepare(`
        INSERT INTO invoices (id, numero, date_emission, date_creation, mois, annee, client_id,
          objet_prefix, objet_manual, objet_custom, tva_active, tva_taux, statut, snapshot)
        VALUES (@id, @numero, @dateEmission, @dateCreation, @mois, @annee, @clientId,
          @objetPrefix, @objetManual, @objetCustom, @tvaActive, @tvaTaux, @statut, @snapshot)
      `);
      const insLine = db.prepare(`
        INSERT INTO invoice_lines (invoice_id, line_id, designation, quantite, prix_unitaire, ordre)
        VALUES (@invoiceId, @lineId, @designation, @quantite, @prixUnitaire, @ordre)
      `);
      const insCharge = db.prepare(`
        INSERT INTO extra_charges (invoice_id, charge_id, label, type, amount, ordre)
        VALUES (@invoiceId, @chargeId, @label, @type, @amount, @ordre)
      `);
      for (const inv of items) {
        const snapshot = inv._snapshot ? JSON.stringify(inv._snapshot) : currentSnapshot();
        insInv.run({
          id: inv.id, numero: inv.numero, dateEmission: inv.dateEmission || "", dateCreation: inv.dateCreation || "",
          mois: Number(inv.mois) || null, annee: Number(inv.annee) || null, clientId: inv.clientId || "",
          objetPrefix: inv.objetPrefix || "", objetManual: inv.objetManual ? 1 : 0, objetCustom: inv.objetCustom || "",
          tvaActive: inv.tvaActive ? 1 : 0, tvaTaux: Number(inv.tvaTaux) || 0, statut: inv.statut || "brouillon", snapshot
        });
        (inv.lignes || []).forEach((l, i) => insLine.run({
          invoiceId: inv.id, lineId: l.id || "", designation: l.designation || "",
          quantite: Number(l.quantite) || 0, prixUnitaire: Number(l.prixUnitaire) || 0, ordre: i
        }));
        (inv.extraCharges || []).forEach((e, i) => insCharge.run({
          invoiceId: inv.id, chargeId: e.id || "", label: e.label || "",
          type: e.type || "frais", amount: Number(e.amount) || 0, ordre: i
        }));
      }
    });
    tx(data.invoices);
  }
  return { ok: true };
}

function resetDatabase() {
  backupNow("avant-reinitialisation");
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM invoice_lines").run();
    db.prepare("DELETE FROM extra_charges").run();
    db.prepare("DELETE FROM invoices").run();
    db.prepare("DELETE FROM clients").run();
    db.prepare("DELETE FROM prestations").run();
    db.prepare("DELETE FROM settings").run();
    db.prepare("DELETE FROM customization").run();
    db.prepare("DELETE FROM tax_defaults").run();
    db.prepare("DELETE FROM counter").run();
  });
  tx();
  seedDefaults();
  return { ok: true };
}

function getDbPath() { return dbPath; }
function getBackupsDir() { return backupsDir; }

module.exports = {
  init,
  storageGet,
  storageSet,
  storageDelete,
  backupNow,
  maybeAutoBackup,
  listBackups,
  getLastBackupDate,
  restoreBackup,
  exportCopy,
  exportAllJSON,
  importAllJSON,
  resetDatabase,
  getDbPath,
  getBackupsDir
};
