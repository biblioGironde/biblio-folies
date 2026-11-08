/* Mise à jour du contenu sans réinstaller l'application.

   Le contenu livré avec l'application (pages, programmes.json, images, audio) sert de base.
   Les fichiers plus récents publiés sur GitHub Pages sont téléchargés dans un cache
   (dossier de données de l'utilisateur) et servis en priorité. Le manifeste contenu.json,
   généré à chaque publication, indique l'empreinte de chaque fichier : seuls les fichiers
   modifiés sont téléchargés. */
"use strict";
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { net } = require("electron");

const URL_PUBLIQUE = "https://bibliogironde.github.io/biblio-folies/";

class Contenu {
  constructor(dossierAppli, dossierCache) {
    this.appli = dossierAppli;
    this.cache = dossierCache;
    fs.mkdirSync(this.cache, { recursive: true });
    this.manifesteCache = this.lire(path.join(this.cache, "contenu.json"));
    const embarque = this.lire(path.join(this.appli, "contenu.json"));
    // Si l'application a été mise à jour avec un contenu plus récent que le cache, on repart du contenu embarqué.
    if (this.manifesteCache && embarque && new Date(embarque.genere) > new Date(this.manifesteCache.genere)) {
      fs.rmSync(this.cache, { recursive: true, force: true });
      fs.mkdirSync(this.cache, { recursive: true });
      this.manifesteCache = null;
    }
    this.reference = this.manifesteCache || embarque || { fichiers: [] };
  }

  lire(fichier) {
    try { return JSON.parse(fs.readFileSync(fichier, "utf8")); } catch { return null; }
  }

  /* Chemin réel d'un fichier demandé (cache d'abord, puis contenu embarqué). */
  resoudre(rel) {
    const propre = path.posix.normalize("/" + rel).slice(1);
    if (!propre || propre.startsWith("..")) return null;
    for (const base of [this.cache, this.appli]) {
      const p = path.join(base, propre);
      if (p.startsWith(base) && fs.existsSync(p) && fs.statSync(p).isFile()) return p;
    }
    return null;
  }

  async telecharger(rel) {
    const r = await net.fetch(URL_PUBLIQUE + rel.split("/").map(encodeURIComponent).join("/"), { cache: "no-store" });
    if (!r.ok) throw new Error(`${rel} : HTTP ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  }

  /* Compare le manifeste publié au manifeste local et télécharge les fichiers modifiés.
     Renvoie le nombre de fichiers mis à jour. */
  async synchroniser() {
    const distant = JSON.parse((await this.telecharger("contenu.json")).toString("utf8"));
    if (distant.version === this.reference.version) return 0;
    const connus = new Map(this.reference.fichiers.map(f => [f.chemin, f.sha256]));
    const aJour = distant.fichiers.filter(f => connus.get(f.chemin) !== f.sha256);
    for (const f of aJour) {
      const buf = await this.telecharger(f.chemin);
      if (crypto.createHash("sha256").update(buf).digest("hex") !== f.sha256) throw new Error(`${f.chemin} : empreinte inattendue`);
      const dest = path.join(this.cache, f.chemin);
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      await fsp.writeFile(dest + ".part", buf);
      await fsp.rename(dest + ".part", dest);
    }
    // Le manifeste est écrit en dernier : une synchronisation interrompue sera reprise au prochain lancement.
    await fsp.writeFile(path.join(this.cache, "contenu.json"), JSON.stringify(distant, null, 2));
    this.reference = this.manifesteCache = distant;
    return aJour.length;
  }
}

module.exports = { Contenu, URL_PUBLIQUE };
