/* Biblio-Folies — code partagé entre l'écran de projection (diaporama.html)
   et le compagnon mobile (compagnon.html).

   Principe de synchronisation : aucun serveur. L'écran choisit un programme et
   une heure de départ t0 (en secondes Unix). Le QR code transmet ces deux valeurs.
   Chaque appareil calcule ensuite, avec sa propre horloge, quelle planche est
   affichée : (maintenant - t0) modulo la durée totale du programme.
   Les horloges des ordinateurs et téléphones étant synchronisées par Internet,
   l'écart reste en général sous la seconde, ce qui suffit pour un défilement lent. */
"use strict";
const Musee = (() => {
  const G = "https://gallica.bnf.fr";

  async function charger() {
    const r = await fetch("programmes.json", { cache: "no-cache" });
    if (!r.ok) throw new Error("programmes.json introuvable (" + r.status + ")");
    return r.json();
  }

  /* Durée par planche imposée par la projection (paramètre d du QR code). */
  function imposerDuree(data, d) { if (d > 0) data.programmes.forEach(x => { x.duree = d; x.slides.forEach(s => delete s.duree); }); }

  /* Liste ordonnée des planches pour un programme, ou pour tous ("tout"). */
  function playlist(data, p) {
    const progs = p === "tout" ? data.programmes : data.programmes.filter(x => x.id === p);
    const out = [];
    progs.forEach(prog => {
      const d = prog.duree || data.dureeParDefaut || 45;
      prog.slides.forEach((s, i) => out.push({ ...s, prog, duree: s.duree || d, rang: i + 1, total: prog.slides.length }));
    });
    return out;
  }

  /* Position dans la boucle à l'instant `now` (ms). */
  function position(list, t0, now = Date.now()) {
    if (!list.length) return null;
    const cycle = list.reduce((a, s) => a + s.duree, 0);
    let e = ((now / 1000 - t0) % cycle + cycle) % cycle;
    for (let i = 0; i < list.length; i++) {
      if (e < list[i].duree) return { index: i, slide: list[i], progress: e / list[i].duree, restant: list[i].duree - e };
      e -= list[i].duree;
    }
    return { index: 0, slide: list[0], progress: 0, restant: list[0].duree };
  }

  /* Image : fichier du dépôt si présent, sinon IIIF Gallica. size = taille IIIF (",1600", "900,"). */
  /* Image d'une planche. La projection (taille ",1600") utilise le fichier haute définition
     (images/, ~3 Mo) ; l'accueil et les téléphones utilisent la version légère (images/web/, ~400 Ko).
     Sans fichier local, l'image est demandée à Gallica. */
  function image(s, size) {
    if (!s.image) return `${G}/iiif/ark:/12148/${s.ark}/f${s.f}/full/${size}/0/native.jpg`;
    return size === ",1600" ? s.image : s.image.replace(/^images\//, "images/web/");
  }
  const lienGallica = s => `${G}/ark:/12148/${s.ark}/f${s.f}.item`;

  function lireHash() {
    const h = new URLSearchParams(location.hash.slice(1));
    const t = parseInt(h.get("t"), 10);
    // m : où joue la musique — "salle" (avec la projection) ou "mobile" (sur les téléphones, par défaut).
    const d = parseInt(h.get("d"), 10);
    return { d: d > 0 ? d : null, p: h.get("p"), t: Number.isFinite(t) ? t : null, m: h.get("m") === "salle" ? "salle" : (h.get("m") === "mobile" ? "mobile" : null) };
  }

  /* Musique d'une planche : la sienne, sinon celle de sa thématique. */
  function musique(s) { const a = s.audio || s.prog.audio; return a && a.src ? a : null; }

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const paragraphes = t => String(t || "").split(/\n\s*\n/).map(p => `<p>${esc(p.trim())}</p>`).join("");

  return { charger, imposerDuree, playlist, position, image, lienGallica, lireHash, musique, esc, paragraphes };
})();
