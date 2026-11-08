#!/usr/bin/env python3
"""Télécharge depuis Gallica (IIIF) les images des planches listées dans
programmes.json, les range dans images/ et renseigne le champ "image" de
chaque planche. Le diaporama utilise alors les fichiers du dépôt et ne dépend
plus de Gallica pour s'afficher.

  python3 outils/telecharger_images.py              # toutes les planches manquantes
  python3 outils/telecharger_images.py --hauteur 2000

À lancer depuis votre ordinateur : Gallica filtre les requêtes venant de
serveurs. Le script attend entre deux images pour ne pas être bloqué.
Seule la bibliothèque standard de Python est utilisée.
"""
import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
UA = "Mozilla/5.0 (planches-gallica; biblio.gironde)"


def telecharger(url: str, dest: Path, essais: int = 4) -> bool:
    attente = 5
    for n in range(essais):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "image/jpeg,image/*"})
            with urllib.request.urlopen(req, timeout=60) as r:
                corps = r.read()
            if not corps.startswith(b"\xff\xd8"):
                raise ValueError("la réponse n'est pas une image JPEG")
            dest.write_bytes(corps)
            return True
        except urllib.error.HTTPError as e:
            if e.code == 403:
                raise SystemExit(
                    "\nGallica refuse les téléchargements automatiques (403, protection anti-robots).\n"
                    "Téléchargez les images depuis votre navigateur :\n"
                    "  python3 outils/telecharger_images.py --liste\n"
                    "puis, une fois les fichiers placés dans images/ :\n"
                    "  python3 outils/telecharger_images.py --enregistrer")
            if e.code in (429, 503) and n < essais - 1:
                print(f"  Gallica répond {e.code}, nouvel essai dans {attente} s")
                time.sleep(attente)
                attente *= 2
                continue
            print(f"  échec : HTTP {e.code}")
            return False
        except Exception as e:  # réseau, contenu inattendu
            print(f"  échec : {e}")
            return False
    return False


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--programmes", default=str(RACINE / "programmes.json"))
    ap.add_argument("--dossier", default="images")
    ap.add_argument("--hauteur", type=int, default=1600, help="hauteur en pixels (défaut 1600)")
    ap.add_argument("--pause", type=float, default=2.0, help="secondes entre deux images")
    ap.add_argument("--forcer", action="store_true", help="retélécharger même si le fichier existe")
    ap.add_argument("--liste", action="store_true", help="afficher les liens à ouvrir dans le navigateur et les noms de fichiers attendus")
    ap.add_argument("--enregistrer", action="store_true", help="ne rien télécharger : relier à programmes.json les fichiers déjà présents dans images/")
    a = ap.parse_args()

    chemin = Path(a.programmes)
    data = json.loads(chemin.read_text(encoding="utf-8"))
    dossier = RACINE / a.dossier
    dossier.mkdir(exist_ok=True)

    if a.liste:
        print(f"Ouvrez chaque lien dans votre navigateur, enregistrez l'image (clic droit > Enregistrer l'image)\n"
              f"dans le dossier {dossier} sous le nom indiqué.\n")
        for prog in data["programmes"]:
            for s in prog["slides"]:
                if (dossier / f"{s['ark']}-f{s['f']}.jpg").exists():
                    continue
                print(f"{s['ark']}-f{s['f']}.jpg")
                print(f"  https://gallica.bnf.fr/iiif/ark:/12148/{s['ark']}/f{s['f']}/full/,{a.hauteur}/0/native.jpg\n")
        return

    if a.enregistrer:
        n = 0
        for prog in data["programmes"]:
            for s in prog["slides"]:
                nom = f"{s['ark']}-f{s['f']}.jpg"
                if (dossier / nom).exists():
                    s["image"] = f"{a.dossier}/{nom}"; n += 1
        chemin.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        total = sum(len(p["slides"]) for p in data["programmes"])
        print(f"{n}/{total} planches reliées à un fichier local. Les autres restent servies par Gallica.")
        return

    ok = ko = 0
    for prog in data["programmes"]:
        for s in prog["slides"]:
            nom = f"{s['ark']}-f{s['f']}.jpg"
            dest = dossier / nom
            relatif = f"{a.dossier}/{nom}"
            if dest.exists() and not a.forcer:
                s["image"] = relatif
                continue
            url = f"https://gallica.bnf.fr/iiif/ark:/12148/{s['ark']}/f{s['f']}/full/,{a.hauteur}/0/native.jpg"
            print(f"{prog['id']} · {s.get('planche', '')} → {nom}")
            if telecharger(url, dest):
                s["image"] = relatif
                ok += 1
            else:
                ko += 1
            time.sleep(a.pause)

    chemin.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{ok} image(s) téléchargée(s), {ko} échec(s). programmes.json mis à jour.")
    if ko:
        print("Les planches en échec restent affichées depuis Gallica. Relancez le script plus tard.")
        sys.exit(1)


if __name__ == "__main__":
    main()
