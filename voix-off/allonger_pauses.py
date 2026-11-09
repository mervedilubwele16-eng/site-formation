#!/usr/bin/env python3
"""
Allonge les pauses entre les phrases d'une voix off, sans toucher à la voix.

Les silences d'au moins --min secondes (fins de phrase ; les virgules sont plus
courtes) sont portés à --cible secondes en ajoutant du silence en leur milieu.

Usage :
  python3 allonger_pauses.py entree.mp3 sortie.mp3 [--min 0.3] [--cible 0.8]
"""
import argparse
import re
import subprocess
import tempfile

import numpy as np
import soundfile as sf


def silences(fichier, seuil_db, duree_min):
    log = subprocess.run(
        ["ffmpeg", "-nostats", "-i", fichier, "-af",
         f"silencedetect=noise={seuil_db}dB:d={duree_min}", "-f", "null", "-"],
        capture_output=True, text=True).stderr
    debuts = [float(v) for v in re.findall(r"silence_start: ([0-9.]+)", log)]
    fins = [float(v) for v in re.findall(r"silence_end: ([0-9.]+)", log)]
    return list(zip(debuts, fins))


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("entree")
    p.add_argument("sortie")
    p.add_argument("--min", type=float, default=0.3,
                   help="durée minimale d'un silence considéré comme fin de phrase")
    p.add_argument("--cible", type=float, default=0.8, help="durée visée des pauses")
    p.add_argument("--seuil", type=float, default=-38, help="seuil de silence en dB")
    a = p.parse_args()

    with tempfile.NamedTemporaryFile(suffix=".wav") as wav:
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", a.entree, wav.name],
                       check=True)
        x, sr = sf.read(wav.name, dtype="float32", always_2d=True)
        morceaux, pos, n = [], 0, 0
        for debut, fin in silences(wav.name, a.seuil, a.min):
            manque = a.cible - (fin - debut)
            if manque <= 0 or fin >= len(x) / sr - 0.05:   # pas la fin du fichier
                continue
            milieu = int((debut + fin) / 2 * sr)
            morceaux += [x[pos:milieu], np.zeros((int(manque * sr), x.shape[1]), np.float32)]
            pos, n = milieu, n + 1
        morceaux.append(x[pos:])
        sf.write(wav.name, np.concatenate(morceaux), sr)
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", wav.name,
                        "-c:a", "libmp3lame", "-b:a", "192k", a.sortie], check=True)
    print(f"{n} pauses allongées à {a.cible} s -> {a.sortie}")


if __name__ == "__main__":
    main()
