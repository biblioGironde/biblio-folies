# Biblio-Folies

Musée numérique des bibliothèques de Gironde, inspiré des Micro-Folies : des planches illustrées issues de [Gallica](https://gallica.bnf.fr) (BnF) défilent lentement en grand, et le public suit l'histoire de chaque planche sur son téléphone grâce à un QR code.

**Site :** https://bibliogironde.github.io/biblio-folies/
**Application de bureau :** [dernière version](https://github.com/biblioGironde/biblio-folies/releases/latest) (macOS, Windows, Linux)

## Les pages

| Page | Rôle |
|---|---|
| `index.html` | Accueil : les thématiques, classées par thème, avec leurs planches et leurs textes |
| `diaporama.html` | Projection plein écran : fondu enchaîné lent, légende, QR code |
| `compagnon.html` | Page ouverte par le QR code sur le téléphone : texte de médiation et musique, synchronisés avec l'écran |

Au lancement d'une thématique accompagnée de musique, la personne qui lance la projection choisit où la musique joue :

- **Dans la salle** : la musique sort de l'ordinateur de projection. Un bouton de réglages apparaît en haut à gauche quand on bouge la souris. Il ouvre le lecteur (lecture, position, volume).
- **Sur les téléphones** : chacun écoute avec ses écouteurs. Le lecteur s'affiche en bas de la page ouverte par le QR code.

La projection utilise l’API Fullscreen du navigateur, ce qui masque toute son interface. Le navigateur exige un clic pour cela : si la page n’est pas déjà en plein écran, un grand bouton « Afficher en plein écran » s’affiche. Dans l’application de bureau, la projection passe d’elle-même en plein écran.

Touches de la projection : `F` plein écran, `Espace` pause, `←` `→` planche précédente ou suivante, `C` cadrage (plein écran ou planche entière), `K` effet Ken Burns ou images fixes, `M` menu.

La synchronisation se fait sans serveur. Le QR code transmet la thématique et l'heure de départ, et chaque téléphone calcule lui-même la planche affichée.

## Ajouter ou modifier du contenu

Tout le contenu est décrit dans `programmes.json`. Chaque thématique (programme) contient :

```json
{
  "id": "haeckel", "theme": "Biologie",
  "titre": "Les formes artistiques de la nature",
  "sousTitre": "Ernst Haeckel, Kunstformen der Natur, 1899-1904",
  "intro": "…", "duree": 45,
  "audio": { "src": "musique/lehmann-1907-du-bist-der-lenz.mp3", "titre": "…", "credit": "…", "ark": "bpt6k1287336" },
  "slides": [{
    "ark": "btv1b525055842", "f": 67, "image": "images/btv1b525055842-f67.jpg",
    "titre": "Kunstformen der Natur", "planche": "Planche 8", "legende": "Discomedusae, méduses",
    "auteur": "Ernst Haeckel", "date": "1899-1904", "cote": "…",
    "texte": "Paragraphe 1\n\nParagraphe 2"
  }]
}
```

- `ark` et `f` identifient la vue sur Gallica (`gallica.bnf.fr/ark:/12148/<ark>/f<f>`).
- `image` pointe vers le fichier du dépôt. Sans fichier local, l'image est chargée depuis Gallica.
- `theme` regroupe les thématiques sur la page d'accueil.
- `cadrage` peut valoir `"plein"` (par défaut : l'image remplit l'écran et défile) ou `"entier"` (planche entière sur fond flou). Il se règle par thématique ou par planche.
- `audio` est facultatif. Les fichiers vont dans `musique/`. `ark` renvoie vers l'enregistrement sur Gallica. Vérifiez les droits de l'œuvre comme ceux de l'enregistrement : les disques de Gallica marqués « domaine public » conviennent.

Les images vont dans `images/`, nommées `<ark>-f<numéro de vue>.jpg` :

- **haute définition** (`images/`), pour la projection : la zone recadrée est demandée à Gallica en PNG, sans perte, sur 3200 px de haut (`…/<x>,<y>,<l>,<h>/,3200/0/native.png`), puis encodée une seule fois en JPEG qualité 94, sans sous-échantillonnage des couleurs (environ 3 Mo). L'effet Ken Burns agrandit l'image : une compression plus forte y devient visible ;
- **version légère** (`images/web/`, 1400 px, environ 400 Ko), pour l'accueil et les téléphones. Gallica bloque les téléchargements automatiques : pour récupérer les liens à ouvrir dans le navigateur, utilisez `python3 outils/telecharger_images.py --liste`.

## Ce qui se passe à chaque envoi sur `main`

1. **Site.** Le workflow *Site GitHub Pages* republie le site et régénère `contenu.json`, le manifeste des fichiers avec leurs empreintes.
2. **Application.** Si des images, des textes, des pages ou le code de l'application ont changé, le workflow *Releases Electron* construit l'application pour macOS, Windows et Linux, puis publie une release `v1.0.<n>`.
3. **Postes déjà équipés :**
   - **Contenu** : au lancement, puis toutes les 30 minutes, l'application compare son contenu au manifeste publié et télécharge seulement les images et textes modifiés. Pendant une projection, le nouveau contenu est pris en compte à la planche suivante.
   - **Application** : sous Windows et Linux, la nouvelle version s'installe d'elle-même. Sous macOS, l'application n'étant pas signée, une fenêtre propose de télécharger la nouvelle version.

## Développement

```bash
npm install
npm start          # lance l'application de bureau
npm run dist       # construit l'installateur pour le système courant
python3 -m http.server 8000   # ou tester le site dans un navigateur
```

## Musique

| Thématique | Enregistrement | Source |
|---|---|---|
| Haeckel, *Kunstformen der Natur* | Richard Wagner, *Die Walküre* : « Du bist der Lenz ». Lilli Lehmann (soprano), orchestre dirigé par Friedrich Kark. Disque Odeon, Berlin, 1907 | [Gallica bpt6k1287336](https://gallica.bnf.fr/ark:/12148/bpt6k1287336), domaine public |

### Nettoyage du son

Les enregistrements bruts de Gallica sont gardés dans `musique/originaux/`. Ce dossier n'est publié ni sur le site ni dans l'application. La version diffusée, dans `musique/`, est obtenue avec :

```bash
python3 outils/nettoyer_son.py musique/originaux/disque.mp3 musique/disque.mp3 --bruit 0.8 1.6
```

`--bruit` indique un passage de sillon vide, en secondes, qui sert d'empreinte du souffle. Le script :

- soustrait ce souffle, avec une réduction limitée à −9 dB et lissée ;
- coupe au-dessus de 5,5 kHz, où un disque acoustique ne contient plus que du bruit.

Ni le volume ni la vitesse ne sont modifiés. Pour l'enregistrement de Lilli Lehmann, le souffle baisse de 13 dB, et la voix comme l'orchestre restent inchangés. Écoutez toujours le résultat au casque avant de publier.

## Droits

Code sous licence MIT. Images : « Source gallica.bnf.fr / Bibliothèque nationale de France » (non couvertes par la licence MIT). La réutilisation non commerciale est libre avec mention de la source. Les textes de médiation sont rédigés pour biblio.gironde.
