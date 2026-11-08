#!/usr/bin/env node
/* Génère contenu.json : la liste des fichiers de contenu (pages, programmes, images, audio)
   avec leur empreinte SHA-256. L'application de bureau compare ce manifeste à celui publié
   sur GitHub Pages pour ne télécharger que ce qui a changé.

   node outils/manifeste.js            → écrit contenu.json à la racine du dépôt */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const RACINE = path.resolve(__dirname, "..");
const INCLURE = [/^[^/]+\.html$/, /^programmes\.json$/, /^lib\/.+\.js$/, /^images\/.+\.(jpe?g|png|webp)$/i, /^audio\/.+\.(mp3|ogg|m4a|opus)$/i];

function parcourir(dossier, base = "") {
  return fs.readdirSync(dossier, { withFileTypes: true }).flatMap(e => {
    if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "dist") return [];
    const rel = base ? `${base}/${e.name}` : e.name;
    return e.isDirectory() ? parcourir(path.join(dossier, e.name), rel) : [rel];
  });
}

const fichiers = parcourir(RACINE)
  .filter(rel => INCLURE.some(re => re.test(rel)))
  .sort()
  .map(rel => {
    const buf = fs.readFileSync(path.join(RACINE, rel));
    return { chemin: rel, sha256: crypto.createHash("sha256").update(buf).digest("hex"), taille: buf.length };
  });

const empreinte = crypto.createHash("sha256").update(fichiers.map(f => f.chemin + f.sha256).join("\n")).digest("hex").slice(0, 16);
const manifeste = { version: empreinte, genere: new Date().toISOString(), fichiers };
fs.writeFileSync(path.join(RACINE, "contenu.json"), JSON.stringify(manifeste, null, 2) + "\n");
console.log(`contenu.json : ${fichiers.length} fichiers, version ${empreinte}`);
