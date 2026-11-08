"use strict";
const path = require("path");
const { pathToFileURL } = require("url");
const { app, BrowserWindow, Menu, protocol, net, shell, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const { Contenu } = require("./contenu");

const PAGE_RELEASES = "https://github.com/biblioGironde/biblio-folies/releases/latest";
const INTERVALLE_SYNCHRO = 30 * 60 * 1000;

// Le contenu est servi par un protocole « app:// » : les pages peuvent ainsi charger
// programmes.json avec fetch(), ce qui est impossible depuis file://.
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
]);

let fenetre = null;
let contenu = null;

function creerFenetre() {
  fenetre = new BrowserWindow({
    width: 1400, height: 900, backgroundColor: "#121413", show: false,
    title: "Biblio-Folies", autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  fenetre.once("ready-to-show", () => { fenetre.maximize(); fenetre.show(); });
  fenetre.loadURL("app://contenu/index.html");

  // Une projection s'affiche en vrai plein écran, sans aucune barre, dès son démarrage ;
  // retour en fenêtre sur l'accueil. (Le plein écran de l'API web exige un clic ; ici, non.)
  const ajusterEcran = url => {
    if (url.includes("diaporama.html#p=")) fenetre.setFullScreen(true);
    else if (url.includes("index.html")) fenetre.setFullScreen(false);
  };
  fenetre.webContents.on("did-navigate", (e, url) => ajusterEcran(url));
  fenetre.webContents.on("did-navigate-in-page", (e, url) => ajusterEcran(url));

  // Les liens externes (Gallica, GitHub) s'ouvrent dans le navigateur du poste.
  fenetre.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
  fenetre.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith("app://")) { e.preventDefault(); shell.openExternal(url); }
  });
}

function menu() {
  const mac = process.platform === "darwin";
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(mac ? [{ role: "appMenu" }] : []),
    { label: "Affichage", submenu: [
      { label: "Accueil des thématiques", accelerator: "CmdOrCtrl+H", click: () => fenetre && fenetre.loadURL("app://contenu/index.html") },
      { label: "Projection", accelerator: "CmdOrCtrl+P", click: () => fenetre && fenetre.loadURL("app://contenu/diaporama.html") },
      { type: "separator" },
      { role: "togglefullscreen", label: "Plein écran" },
      { role: "reload", label: "Recharger" },
      { role: "toggleDevTools", label: "Outils de développement" }
    ] },
    { label: "Mises à jour", submenu: [
      { label: "Mettre à jour les images et les textes", click: () => synchroniser(true) },
      { label: "Rechercher une nouvelle version de l'application", click: () => verifierAppli(true) },
      { label: `Version ${app.getVersion()}`, enabled: false }
    ] }
  ]));
}

async function synchroniser(manuel = false) {
  try {
    const n = await contenu.synchroniser();
    if (n > 0 && fenetre) {
      // Sur l'accueil, on recharge tout de suite ; pendant une projection, le nouveau contenu
      // sera pris en compte au prochain changement de page pour ne pas couper la séance.
      if (fenetre.webContents.getURL().includes("index.html")) fenetre.reload();
    }
    if (manuel) dialog.showMessageBox(fenetre, { type: "info", message: n > 0 ? `${n} fichier(s) mis à jour.` : "Le contenu est déjà à jour." });
  } catch (e) {
    if (manuel) dialog.showMessageBox(fenetre, { type: "warning", message: "Mise à jour impossible pour le moment.", detail: `Vérifiez la connexion Internet. (${e.message})` });
  }
}

function verifierAppli(manuel = false) {
  if (!app.isPackaged) return;
  // macOS n'installe pas seul une application non signée : on propose le téléchargement.
  autoUpdater.autoDownload = process.platform !== "darwin";
  autoUpdater.checkForUpdates().then(r => {
    if (manuel && (!r || !r.isUpdateAvailable)) dialog.showMessageBox(fenetre, { type: "info", message: "L'application est à jour." });
  }).catch(() => { if (manuel) dialog.showMessageBox(fenetre, { type: "warning", message: "Impossible de vérifier les mises à jour pour le moment." }); });
}

autoUpdater.on("update-available", info => {
  if (process.platform !== "darwin") return;
  dialog.showMessageBox(fenetre, {
    type: "info", buttons: ["Télécharger", "Plus tard"], defaultId: 0,
    message: `Une nouvelle version (${info.version}) est disponible.`,
    detail: "Le contenu (images et textes) se met déjà à jour tout seul. Cette version apporte aussi les dernières améliorations de l'application."
  }).then(({ response }) => { if (response === 0) shell.openExternal(PAGE_RELEASES); });
});
autoUpdater.on("update-downloaded", info => {
  dialog.showMessageBox(fenetre, {
    type: "info", buttons: ["Redémarrer maintenant", "Au prochain lancement"], defaultId: 1,
    message: `La version ${info.version} est prête.`
  }).then(({ response }) => { if (response === 0) autoUpdater.quitAndInstall(); });
});

app.whenReady().then(() => {
  contenu = new Contenu(app.getAppPath(), path.join(app.getPath("userData"), "contenu"));
  protocol.handle("app", req => {
    const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, "") || "index.html";
    const fichier = contenu.resoudre(rel);
    if (!fichier) return new Response("Introuvable", { status: 404 });
    return net.fetch(pathToFileURL(fichier).toString());
  });
  menu();
  creerFenetre();
  synchroniser();
  setInterval(synchroniser, INTERVALLE_SYNCHRO);
  verifierAppli();
});

app.on("window-all-closed", () => app.quit());
