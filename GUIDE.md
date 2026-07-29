# Guide d'installation — AINA Facturation (application Windows locale)

Ce guide part du principe que vous n'avez **jamais** programmé. Suivez les étapes
dans l'ordre, sans en sauter. Chaque étape dit exactement quoi cliquer et quoi
écrire.

Votre logiciel fonctionnera **entièrement hors ligne**. Toutes vos données
(clients, prestations, factures) sont enregistrées dans un vrai fichier de
base de données `facturation.db` stocké sur votre ordinateur, dans le dossier
de données de l'application Windows — pas dans un dossier temporaire. Elles
restent là même si vous fermez le logiciel, redémarrez l'ordinateur, ou
rouvrez le logiciel plusieurs jours plus tard.

---

## ÉTAPE 1 — Installer Node.js

1. Allez sur **https://nodejs.org**.
2. Téléchargez la version **LTS** (le gros bouton vert, "Recommandé pour la
   plupart des utilisateurs").
3. Ouvrez le fichier téléchargé (`.msi`) et cliquez **Suivant** à chaque écran,
   en laissant toutes les options par défaut, jusqu'à **Installer** puis
   **Terminer**.
4. Redémarrez votre ordinateur une fois l'installation terminée (recommandé).

## ÉTAPE 2 — Installer Visual Studio Code

1. Allez sur **https://code.visualstudio.com**.
2. Cliquez sur **Download for Windows**.
3. Ouvrez le fichier téléchargé, acceptez la licence, laissez les options par
   défaut cochées (notamment "Ajouter au PATH"), cliquez **Suivant** jusqu'à
   **Installer**, puis **Terminer**.

## ÉTAPE 3 — Créer le dossier du projet

1. Sur votre Bureau (ou dans "Documents"), créez un nouveau dossier nommé
   par exemple : `AINA-Facturation`.
   - Clic droit sur le Bureau → **Nouveau** → **Dossier** → tapez le nom →
     Entrée.

## ÉTAPE 4 — Placer les fichiers

1. Copiez **tous les fichiers et dossiers** fournis avec ce projet
   (`package.json`, `main.js`, `preload.js`, `index.html`, le dossier `src`,
   le dossier `assets`, ce fichier `GUIDE.md`) directement **à l'intérieur**
   du dossier `AINA-Facturation` que vous venez de créer.
2. Vérifiez que `package.json` se trouve bien directement dans
   `AINA-Facturation` (et pas dans un sous-dossier).

## ÉTAPE 5 — Ouvrir le terminal (dans VS Code)

1. Ouvrez **Visual Studio Code**.
2. Menu **Fichier** → **Ouvrir un dossier...** → sélectionnez
   `AINA-Facturation` → **Sélectionner un dossier**.
3. Menu **Terminal** → **Nouveau terminal**. Une zone de texte s'ouvre en bas
   de l'écran : c'est le terminal, c'est là que vous allez taper des
   commandes.

## ÉTAPE 6 — Installer les dépendances

Dans le terminal, tapez la commande suivante puis appuyez sur **Entrée** :

```
npm install
```

Cela télécharge et installe automatiquement tout ce dont le logiciel a
besoin (Electron, la base de données SQLite, etc.). Cela peut prendre
plusieurs minutes selon votre connexion internet — c'est normal.

> Si une fenêtre noire Windows apparaît brièvement pendant l'installation,
> c'est normal (compilation de la base de données SQLite pour votre
> ordinateur).
>
> Si la commande `npm install` affiche une erreur mentionnant
> `better-sqlite3` ou `node-gyp`, relancez simplement :
> ```
> npm run rebuild
> ```

## ÉTAPE 7 — Lancer le logiciel

Toujours dans le terminal, tapez :

```
npm start
```

Une fenêtre du logiciel **AINA — Facturation** doit s'ouvrir, avec exactement
le même design que votre application HTML d'origine.

> Pour relancer le logiciel une prochaine fois, il suffit de refaire
> ÉTAPE 5 puis `npm start` (plus besoin de refaire `npm install`, sauf si
> vous modifiez les fichiers du projet).

## ÉTAPE 8 — Tester la création d'un client

1. Dans le menu de gauche, cliquez sur **Clients**.
2. Cliquez sur **＋ Nouveau client**.
3. Remplissez au moins le **nom de l'entreprise / client**.
4. Cliquez sur **Enregistrer**.
5. Le client doit apparaître dans la liste.

## ÉTAPE 9 — Créer une facture

1. Cliquez sur **Nouvelle facture** dans le menu de gauche.
2. Sélectionnez le client que vous venez de créer.
3. Ajoutez une ligne de prestation (désignation, quantité, prix unitaire).
4. Vérifiez l'aperçu à droite, qui se met à jour automatiquement.
5. Cliquez sur **Enregistrer** (en haut de la page).
6. Vous êtes redirigé vers **Mes factures**, où la facture apparaît.

## ÉTAPE 10 — Fermer le logiciel

Fermez simplement la fenêtre du logiciel (croix en haut à droite), ou
appuyez sur `Ctrl+C` dans le terminal puis Entrée.

## ÉTAPE 11 — Rouvrir le logiciel

Dans VS Code, ouvrez à nouveau un terminal (ÉTAPE 5) sur le dossier du
projet, et tapez :

```
npm start
```

## ÉTAPE 12 — Vérifier que les données sont toujours là

1. Allez dans **Clients** : votre client créé à l'ÉTAPE 8 doit toujours être
   là.
2. Allez dans **Mes factures** : votre facture créée à l'ÉTAPE 9 doit
   toujours être là.

Si c'est le cas, la base de données locale fonctionne parfaitement : vos
données survivent à la fermeture du logiciel et au redémarrage de
l'ordinateur.

## ÉTAPE 13 — Tester une sauvegarde

1. Dans le menu de gauche, allez dans **Base de données & Sauvegarde**.
2. Cliquez sur **💾 Sauvegarder maintenant**.
3. Un message confirme la création de la sauvegarde, et elle apparaît dans
   le tableau "Sauvegardes récentes" avec un nom du type
   `AINA_Backup_2026-07-25_1930.db`.

> Une sauvegarde automatique est aussi créée :
> - une fois par jour, à l'ouverture du logiciel ;
> - automatiquement avant chaque modification importante des factures ;
> - automatiquement avant toute restauration, import ou réinitialisation
>   (sauvegarde de sécurité).

## ÉTAPE 14 — Tester une restauration

1. Toujours dans **Base de données & Sauvegarde**, cliquez sur
   **📥 Restaurer une sauvegarde**.
2. Confirmez le message d'avertissement.
3. Choisissez un fichier `.db` dans la fenêtre qui s'ouvre (par exemple celui
   créé à l'ÉTAPE 13, situé dans le dossier de sauvegardes indiqué en haut de
   la page).
4. Le logiciel se recharge automatiquement avec les données restaurées.

---

## Autres fonctionnalités de la section "Base de données & Sauvegarde"

- **📤 Exporter une copie de la base** : enregistre une copie du fichier
  `facturation.db` à l'endroit de votre choix (clé USB, autre dossier...).
- **📤 Exporter toutes les données (JSON)** : crée un fichier `.json` lisible
  contenant toutes vos données, utile pour les transférer vers un autre
  ordinateur.
- **📂 Importer les données (JSON)** : recharge des données depuis un fichier
  `.json` exporté précédemment (par exemple sur un autre ordinateur).
- **🗑️ Réinitialiser la base de données** : supprime définitivement toutes
  les données après **deux confirmations**. Une sauvegarde de sécurité est
  tout de même créée automatiquement juste avant.

Toutes vos factures déjà enregistrées **gardent leur ancien logo, leurs
anciennes couleurs et anciennes coordonnées d'entreprise**, même si vous
changez ensuite le logo ou les paramètres de l'entreprise dans le logiciel :
chaque facture conserve un instantané figé de ces informations au moment de
sa création.

---

## Créer un fichier .exe pour installer le logiciel sur Windows

Une fois que tout fonctionne avec `npm start`, vous pouvez créer un
installateur Windows (`.exe`) que vous pourrez copier sur n'importe quel
ordinateur Windows, sans avoir besoin de Node.js ni de VS Code dessus.

1. Dans le terminal (dossier du projet ouvert), tapez :
   ```
   npm run dist
   ```
2. Cela peut prendre quelques minutes. Un dossier `dist` est créé à la racine
   du projet.
3. Dans le dossier `dist`, vous trouverez un fichier du type
   `AINA Facturation Setup 1.0.0.exe`.
4. Double-cliquez sur ce fichier sur n'importe quel ordinateur Windows pour
   installer le logiciel normalement, avec une icône sur le Bureau et dans
   le menu Démarrer.

> Chaque ordinateur sur lequel vous installez le logiciel aura **sa propre**
> base de données locale, indépendante des autres. Utilisez
> "Exporter toutes les données (JSON)" puis "Importer les données (JSON)"
> pour transférer vos données d'un ordinateur à l'autre.

---

## En cas de problème

- **`npm install` échoue** avec une erreur liée à `better-sqlite3` ou
  `node-gyp` : relancez `npm run rebuild`, puis `npm start`.
- **La fenêtre du logiciel reste blanche** : fermez-la, retournez dans le
  terminal, appuyez sur `Ctrl+C`, puis relancez `npm start`.
- **J'ai perdu des données** : allez dans **Base de données & Sauvegarde** →
  **📥 Restaurer une sauvegarde**, et choisissez la sauvegarde la plus
  récente qui contenait encore vos données (elles sont classées par date
  dans le dossier de sauvegardes indiqué en haut de la page).
