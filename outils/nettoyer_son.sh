#!/usr/bin/env bash
# Nettoie un enregistrement ancien (78 tours, cylindre) téléchargé sur Gallica.
#
#   outils/nettoyer_son.sh musique/originaux/mon-disque.mp3 musique/mon-disque.mp3 [doux|fort]
#
# Étapes (ffmpeg) :
#   1. passe-haut 70 Hz       : enlève le ronflement du moteur et les chocs graves
#   2. passe-bas 7 kHz (doux) : enlève le souffle aigu ; ces disques n'enregistrent presque rien au-delà
#   3. adeclick               : supprime les clics et craquements ponctuels
#   4. afftdn                 : atténue le souffle continu (suivi du bruit de fond)
#   5. loudnorm               : volume homogène d'un morceau à l'autre (−18 LUFS)
#   6. fondus de début et de fin, pour une lecture en boucle sans à-coup
#
# Gardez toujours l'original (musique/originaux/) : un nettoyage trop fort rend la voix métallique.
set -euo pipefail
ENTREE="$1"; SORTIE="$2"; FORCE="${3:-doux}"

case "$FORCE" in
  doux) PB=7000; CLIC="adeclick=w=55:o=75:a=2:t=2"; DEBRUIT="afftdn=nr=10:nf=-42:tn=1" ;;
  fort) PB=6000; CLIC="adeclick=w=55:o=75:a=2:t=1.5,adeclick=w=20:o=50:a=2:t=2"; DEBRUIT="afftdn=nr=18:nf=-38:tn=1" ;;
  *) echo "Niveau inconnu : $FORCE (doux ou fort)"; exit 1 ;;
esac

DUREE=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$ENTREE")
FIN=$(python3 -c "print(max(0, float('$DUREE') - 2))")

ffmpeg -hide_banner -loglevel error -y -i "$ENTREE" -af \
"highpass=f=70:p=2,lowpass=f=${PB}:p=2,${CLIC},${DEBRUIT},loudnorm=I=-18:TP=-1.5:LRA=11,afade=t=in:d=1,afade=t=out:st=${FIN}:d=2" \
  -ar 44100 -ac 1 -c:a libmp3lame -q:a 2 "$SORTIE"
echo "Nettoyé ($FORCE) : $SORTIE"
