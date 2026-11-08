#!/usr/bin/env python3
"""Atténue le souffle d'un enregistrement ancien (78 tours, cylindre) téléchargé sur Gallica.

    python3 outils/nettoyer_son.py musique/originaux/disque.mp3 musique/disque.mp3 --bruit 0.8 1.6

Deux traitements prudents, qui ne retirent que ce qui est mesuré comme du bruit :
  1. Soustraction du souffle (filtre de Wiener) à partir d'une empreinte prise sur le sillon
     vide (--bruit début fin, en secondes). Réduction limitée à -9 dB et lissée dans le temps,
     pour éviter l'effet « gazouillis ».
  2. Coupure au-dessus de --coupure Hz (5500 par défaut) : un enregistrement acoustique
     d'avant 1925 ne contient plus que du souffle au-delà de 5 kHz environ.

Ni le volume ni la vitesse ne sont modifiés. Gardez l'original dans musique/originaux/
et écoutez toujours le résultat au casque avant de publier.
Dépendances : ffmpeg, numpy, scipy.
"""
import argparse
import subprocess

import numpy as np
from scipy.ndimage import uniform_filter1d
from scipy.signal import istft, stft

SR = 44100


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("entree")
    ap.add_argument("sortie")
    ap.add_argument("--bruit", nargs=2, type=float, metavar=("DEBUT", "FIN"), required=True,
                    help="passage de sillon vide servant d'empreinte du bruit (secondes)")
    ap.add_argument("--plancher", type=float, default=9, help="réduction maximale en dB (défaut 9)")
    ap.add_argument("--coupure", type=float, default=5500, help="fréquence de coupure des aigus en Hz (défaut 5500)")
    a = ap.parse_args()

    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", a.entree, "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768

    N, H = 4096, 1024
    _, t, Z = stft(x, fs=SR, nperseg=N, noverlap=N - H)
    P = np.abs(Z) ** 2
    sel = (t >= a.bruit[0]) & (t <= a.bruit[1])
    if not sel.any():
        raise SystemExit("Le passage --bruit est vide : vérifiez les temps indiqués.")
    bruit = np.median(P[:, sel], axis=1, keepdims=True)

    G = np.sqrt(np.maximum(1 - 1.3 * bruit / (P + 1e-12), 0))
    G = uniform_filter1d(uniform_filter1d(G, size=5, axis=1), size=3, axis=0)
    G = np.maximum(G, 10 ** (-a.plancher / 20))
    _, y = istft(Z * G, fs=SR, nperseg=N, noverlap=N - H)
    pcm = (np.clip(y[: len(x)], -1, 1) * 32767).astype(np.int16).tobytes()

    c = a.coupure
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "1", "-i", "-",
                    "-af", f"lowpass=f={c}:p=2,lowpass=f={c}:p=2", "-c:a", "libmp3lame", "-b:a", "320k", a.sortie],
                   input=pcm, check=True)
    print(f"Nettoyé : {a.sortie}")


if __name__ == "__main__":
    main()
