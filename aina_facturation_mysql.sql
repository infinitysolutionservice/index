-- ============================================================
-- AINA — Facturation
-- Script de création de la base de données MySQL
-- Compatible MySQL 5.7+ / MySQL 8+ / MariaDB 10.2+
--
-- Utilisation :
--   mysql -u root -p < aina_facturation_mysql.sql
-- ou bien copier-coller tout le contenu dans phpMyAdmin / MySQL Workbench.
-- ============================================================

CREATE DATABASE IF NOT EXISTS aina_facturation
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE aina_facturation;

-- ------------------------------------------------------------
-- Paramètres de l'entreprise (logo, nom, adresse, téléphone,
-- email, NINEA, arrêté, responsable, coordonnées bancaires...)
-- Une seule ligne (id = 1), stockée en JSON pour rester flexible.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  id   TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  data JSON NOT NULL,
  CONSTRAINT chk_settings_id CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Personnalisation visuelle (couleurs, police, logo, filigrane...)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customization (
  id   TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  data JSON NOT NULL,
  CONSTRAINT chk_customization_id CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Valeurs par défaut de TVA / frais additionnels proposées à la
-- création d'une nouvelle facture.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_defaults (
  id   TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  data JSON NOT NULL,
  CONSTRAINT chk_tax_defaults_id CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Compteur global utilisé pour générer le numéro de facture
-- suivant, afin de ne jamais générer deux fois le même numéro.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS counter (
  id    TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  value INT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT chk_counter_id CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Clients
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clients (
  id          VARCHAR(64) NOT NULL PRIMARY KEY,
  nom         VARCHAR(255) NOT NULL,
  adresse     VARCHAR(255) DEFAULT '',
  telephone   VARCHAR(50)  DEFAULT '',
  email       VARCHAR(255) DEFAULT '',
  ninea       VARCHAR(100) DEFAULT '',
  responsable VARCHAR(255) DEFAULT '',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_clients_nom (nom)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Bibliothèque de prestations / tarifs réutilisables
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prestations (
  id            VARCHAR(64) NOT NULL PRIMARY KEY,
  designation   VARCHAR(255) NOT NULL,
  prix_unitaire DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_prestations_designation (designation)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Factures
-- `snapshot` fige les informations de l'entreprise (nom, logo,
-- adresse, téléphone, email, NINEA, couleurs...) telles qu'elles
-- étaient au moment de la création de la facture : une facture
-- déjà enregistrée ne change jamais automatiquement si les
-- paramètres de l'entreprise sont modifiés plus tard.
-- `numero` est UNIQUE pour ne jamais dupliquer un numéro.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
  id            VARCHAR(64) NOT NULL PRIMARY KEY,
  numero        VARCHAR(50) NOT NULL,
  date_emission DATE,
  date_creation DATETIME,
  mois          TINYINT UNSIGNED,
  annee         SMALLINT UNSIGNED,
  client_id     VARCHAR(64),
  objet_prefix  VARCHAR(255) DEFAULT '',
  objet_manual  TINYINT(1) NOT NULL DEFAULT 0,
  objet_custom  VARCHAR(255) DEFAULT '',
  tva_active    TINYINT(1) NOT NULL DEFAULT 0,
  tva_taux      DECIMAL(6,2) NOT NULL DEFAULT 0,
  statut        ENUM('brouillon','envoyee','payee','impayee') NOT NULL DEFAULT 'brouillon',
  snapshot      JSON,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_invoices_numero (numero),
  KEY idx_invoices_client (client_id),
  KEY idx_invoices_statut (statut),
  KEY idx_invoices_date_creation (date_creation),
  CONSTRAINT fk_invoices_client
    FOREIGN KEY (client_id) REFERENCES clients(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Lignes de prestation d'une facture
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_lines (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  invoice_id    VARCHAR(64) NOT NULL,
  line_id       VARCHAR(64),
  designation   VARCHAR(255) DEFAULT '',
  quantite      DECIMAL(14,2) NOT NULL DEFAULT 0,
  prix_unitaire DECIMAL(14,2) NOT NULL DEFAULT 0,
  ordre         INT UNSIGNED NOT NULL DEFAULT 0,
  KEY idx_invoice_lines_invoice (invoice_id),
  CONSTRAINT fk_invoice_lines_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Frais supplémentaires / remises d'une facture
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS extra_charges (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  invoice_id VARCHAR(64) NOT NULL,
  charge_id  VARCHAR(64),
  label      VARCHAR(255) DEFAULT '',
  type       ENUM('frais','remise') NOT NULL DEFAULT 'frais',
  amount     DECIMAL(14,2) NOT NULL DEFAULT 0,
  ordre      INT UNSIGNED NOT NULL DEFAULT 0,
  KEY idx_extra_charges_invoice (invoice_id),
  CONSTRAINT fk_extra_charges_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Données par défaut (identiques aux valeurs par défaut de
-- l'application). Ne s'insèrent que si les tables sont vides.
-- ============================================================

INSERT INTO settings (id, data)
SELECT 1, JSON_OBJECT(
  'companyName', 'AINA SECURITE SENEGAL',
  'logoDataUrl', '',
  'address', 'Dakar, Sénégal',
  'phone', '',
  'email', 'Ainasecurite33@gmail.com',
  'ninea', '0054840432J1',
  'arrete', 'N°006094 (MINT/DGPN/BEM)',
  'bankInfo', '',
  'responsableName', '',
  'responsableFonction', 'Président'
)
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE id = 1);

INSERT INTO customization (id, data)
SELECT 1, JSON_OBJECT(
  'primaryColor', '#1f2f45',
  'brassColor', '#a9812f',
  'font', 'serif',
  'logoSize', 70,
  'logoPosition', 'left',
  'watermarkEnabled', FALSE,
  'watermarkText', 'AINA SÉCURITÉ',
  'watermarkOpacity', 6,
  'watermarkSize', 90
)
WHERE NOT EXISTS (SELECT 1 FROM customization WHERE id = 1);

INSERT INTO tax_defaults (id, data)
SELECT 1, JSON_OBJECT(
  'tvaActiveDefault', FALSE,
  'tvaTauxDefault', 18,
  'extraTemplates', JSON_ARRAY()
)
WHERE NOT EXISTS (SELECT 1 FROM tax_defaults WHERE id = 1);

INSERT INTO counter (id, value)
SELECT 1, 0
WHERE NOT EXISTS (SELECT 1 FROM counter WHERE id = 1);

-- ============================================================
-- Exemple de vue pratique : total HT / TVA / TTC par facture
-- (pratique pour des rapports ou un tableau de bord en SQL pur)
-- ============================================================
CREATE OR REPLACE VIEW v_invoice_totals AS
SELECT
  i.id,
  i.numero,
  i.date_emission,
  i.client_id,
  i.statut,
  COALESCE(SUM(l.quantite * l.prix_unitaire), 0) AS total_ht_lignes,
  COALESCE((
    SELECT SUM(CASE WHEN e.type = 'remise' THEN -e.amount ELSE e.amount END)
    FROM extra_charges e WHERE e.invoice_id = i.id
  ), 0) AS total_frais_remises,
  (COALESCE(SUM(l.quantite * l.prix_unitaire), 0) + COALESCE((
    SELECT SUM(CASE WHEN e.type = 'remise' THEN -e.amount ELSE e.amount END)
    FROM extra_charges e WHERE e.invoice_id = i.id
  ), 0)) AS total_ht,
  CASE WHEN i.tva_active = 1
    THEN (COALESCE(SUM(l.quantite * l.prix_unitaire), 0) + COALESCE((
      SELECT SUM(CASE WHEN e.type = 'remise' THEN -e.amount ELSE e.amount END)
      FROM extra_charges e WHERE e.invoice_id = i.id
    ), 0)) * i.tva_taux / 100
    ELSE 0
  END AS total_tva,
  (COALESCE(SUM(l.quantite * l.prix_unitaire), 0) + COALESCE((
    SELECT SUM(CASE WHEN e.type = 'remise' THEN -e.amount ELSE e.amount END)
    FROM extra_charges e WHERE e.invoice_id = i.id
  ), 0)) * (1 + CASE WHEN i.tva_active = 1 THEN i.tva_taux / 100 ELSE 0 END) AS total_ttc
FROM invoices i
LEFT JOIN invoice_lines l ON l.invoice_id = i.id
GROUP BY i.id;
