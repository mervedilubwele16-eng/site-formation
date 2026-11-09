#!/usr/bin/env python3
"""
Génère la voix off « Le premier pas » en local, avec une voix française masculine
(modèles Piper/VITS exécutés par sherpa-onnx), sans service externe.

Pour une articulation nette, le programme :
  1. découpe le texte en phrases et synthétise chacune séparément
     (la voix ne « s'essouffle » pas sur les longues phrases) ;
  2. ralentit légèrement le débit (length_scale) et réduit l'aléa de prosodie
     (noise_scale / noise_scale_w), ce qui évite les syllabes avalées ;
  3. réécrit quelques mots pour guider la prononciation (phonétisation espeak) ;
  4. insère de vraies pauses entre les phrases et les paragraphes ;
  5. masterise l'audio : passe-haut, léger relief des consonnes (2,5–5 kHz),
     compression douce et normalisation du volume pour la diffusion (-16 LUFS).

Option --verifier : retranscrit chaque phrase avec Whisper et mesure le taux
d'erreur de mots (WER). Plus il est bas, mieux les mots sont compris.

Usage :
  python3 generer_voix_off.py --modeles DOSSIER_MODELES [--voix upmc --locuteur 1]
         [--vitesse 0.9] [--sortie voix-off.mp3] [--verifier]
"""
import argparse
import os
import re
import subprocess
import sys
import tempfile
import unicodedata

import numpy as np
import sherpa_onnx
import soundfile as sf

# --------------------------------------------------------------------------
# Texte : (phrase, pause après en secondes). Une pause plus longue marque
# la fin d'un paragraphe.
# --------------------------------------------------------------------------
SCRIPT = [
    ("Il y a toujours un premier pas.", 0.55),
    ("Celui qu'on repousse à demain,", 0.30),
    ("puis à la semaine prochaine.", 0.55),
    ("Et si c'était aujourd'hui ?", 1.00),
    ("Apprendre, ce n'est pas remplir des cases.", 0.45),
    ("C'est ouvrir des portes.", 0.70),
    ("Une compétence de plus, c'est un projet qui devient possible,", 0.30),
    ("un métier qui se dessine,", 0.25),
    ("une confiance qui grandit.", 1.00),
    ("Ici, chaque formation est pensée pour vous :", 0.35),
    ("des contenus clairs, des exercices concrets,", 0.25),
    ("et un accompagnement à chaque étape.", 0.60),
    ("À votre rythme.", 0.40),
    ("Depuis chez vous.", 0.40),
    ("Sans jamais être seul.", 1.00),
    ("Parce que le savoir ne sert à rien s'il reste dans un livre fermé.", 0.50),
    ("Il prend vie quand vous le mettez en pratique.", 1.00),
    ("Alors, prêt à faire ce premier pas ?", 0.60),
    ("Rejoignez-nous,", 0.35),
    ("et commencez à construire la suite, dès maintenant.", 0.80),
]

# Réécritures phonétiques : le texte affiché reste correct, seul ce qui est
# envoyé au moteur change. Ajoutez ici les mots mal prononcés.
PRONONCIATION = {
    # rien d'obligatoire pour l'instant ; exemple : "Rejoignez-nous": "Rejoignez nous",
}

VOIX = {
    # nom : (dossier, fichier .onnx)
    "upmc": ("vits-piper-fr_FR-upmc-medium", "fr_FR-upmc-medium.onnx"),
    "tom": ("vits-piper-fr_FR-tom-medium", "fr_FR-tom-medium.onnx"),
    "gilles": ("vits-piper-fr_FR-gilles-low", "fr_FR-gilles-low.onnx"),
}


def creer_tts(modeles, voix, noise, noise_w, length):
    dossier, onnx = VOIX[voix]
    d = os.path.join(modeles, dossier)
    cfg = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            vits=sherpa_onnx.OfflineTtsVitsModelConfig(
                model=os.path.join(d, onnx),
                tokens=os.path.join(d, "tokens.txt"),
                data_dir=os.path.join(d, "espeak-ng-data"),
                noise_scale=noise,
                noise_scale_w=noise_w,
                length_scale=length,
            ),
            num_threads=4,
        ),
    )
    return sherpa_onnx.OfflineTts(cfg)


def preparer(texte):
    for mot, rempl in PRONONCIATION.items():
        texte = texte.replace(mot, rempl)
    return texte


def rogner_silence(x, sr, seuil=0.004, marge=0.09):
    idx = np.where(np.abs(x) > seuil)[0]
    if len(idx) == 0:
        return x
    m = int(marge * sr)
    return x[max(0, idx[0] - m): min(len(x), idx[-1] + m)]


def fondu(x, sr, ms=12):
    n = min(len(x) // 2, int(sr * ms / 1000))
    if n > 0:
        r = np.linspace(0, 1, n)
        x[:n] *= r
        x[-n:] *= r[::-1]
    return x


def synthetiser(tts, sid, asr=None, prises=1, bavard=False):
    """Synthétise chaque phrase. Avec `asr` et prises > 1, génère plusieurs
    prises par phrase et garde celle que la reconnaissance vocale comprend le
    mieux (à égalité : celle dont la durée est la plus proche de la médiane,
    pour écarter les prises trop pressées ou trop traînantes)."""
    sr = tts.sample_rate
    phrases = []
    for texte, pause in SCRIPT:
        candidates = []
        for _ in range(max(1, prises)):
            audio = tts.generate(preparer(texte), sid=sid, speed=1.0)
            x = np.asarray(audio.samples, dtype=np.float32)
            x = fondu(rogner_silence(x, sr), sr)
            e = wer(texte, transcrire(asr, x, sr))[0] if asr and prises > 1 else 0
            candidates.append((e, x))
        med = np.median([len(x) for _, x in candidates])
        e, x = min(candidates, key=lambda c: (c[0], abs(len(c[1]) - med)))
        if bavard and prises > 1:
            print(f"  {texte[:45]:45} erreurs par prise {[c[0] for c in candidates]} -> {e}")
        phrases.append((texte, x, pause))
    return phrases, sr


def assembler(phrases, sr, intro=0.4):
    morceaux = [np.zeros(int(intro * sr), np.float32)]
    for _, x, pause in phrases:
        morceaux += [x, np.zeros(int(pause * sr), np.float32)]
    return np.concatenate(morceaux)


def masteriser(wav_in, sortie):
    filtres = ",".join([
        "highpass=f=80",
        "equalizer=f=250:t=q:w=1.2:g=-2",      # moins de boue
        "equalizer=f=3500:t=q:w=1.0:g=3",      # relief des consonnes
        "equalizer=f=7000:t=q:w=1.5:g=1.5",    # clarté des sifflantes
        "acompressor=threshold=-20dB:ratio=3:attack=5:release=80:makeup=2",
        "loudnorm=I=-16:TP=-1.5:LRA=9",
    ])
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", wav_in, "-af", filtres,
           "-ar", "44100"]
    cmd += ["-c:a", "libmp3lame", "-b:a", "192k"] if sortie.endswith(".mp3") else []
    subprocess.run(cmd + [sortie], check=True)


# ---------------------------- Vérification ----------------------------------
def normaliser(t):
    t = t.lower().replace("’", "'")
    t = re.sub(r"[^\w'\s-]", " ", t)
    t = t.replace("-", " ").replace("'", " ")
    return t.split()


def wer(ref, hyp):
    r, h = normaliser(ref), normaliser(hyp)
    d = np.arange(len(h) + 1)
    for i in range(1, len(r) + 1):
        prev, d[0] = d.copy(), i
        for j in range(1, len(h) + 1):
            d[j] = min(prev[j] + 1, d[j - 1] + 1,
                       prev[j - 1] + (r[i - 1] != h[j - 1]))
    return d[len(h)], len(r)


def creer_asr(modeles):
    d = os.path.join(modeles, "sherpa-onnx-whisper-small")
    return sherpa_onnx.OfflineRecognizer.from_whisper(
        encoder=os.path.join(d, "small-encoder.int8.onnx"),
        decoder=os.path.join(d, "small-decoder.int8.onnx"),
        tokens=os.path.join(d, "small-tokens.txt"),
        language="fr", task="transcribe", num_threads=4)


def creer_juge(modeles):
    """Second modèle de reconnaissance (Zipformer français, architecture
    différente de Whisper) : il sert de juge neutre, pour vérifier que la
    sélection des prises par Whisper améliore vraiment l'intelligibilité."""
    d = os.path.join(modeles, "sherpa-onnx-streaming-zipformer-fr-2023-04-14")
    f = lambda n: os.path.join(d, f"{n}-epoch-29-avg-9-with-averaged-model.int8.onnx")
    return sherpa_onnx.OnlineRecognizer.from_transducer(
        tokens=os.path.join(d, "tokens.txt"), encoder=f("encoder"),
        decoder=f("decoder"), joiner=f("joiner"), num_threads=4)


def transcrire(asr, x, sr):
    import math
    # les modèles de reconnaissance attendent du 16 kHz
    n = int(math.ceil(len(x) * 16000 / sr))
    x16 = np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x)
    x16 = np.pad(x16, 8000).astype(np.float32)  # 0,5 s de silence autour
    s = asr.create_stream()
    s.accept_waveform(16000, x16)
    if isinstance(asr, sherpa_onnx.OnlineRecognizer):
        s.input_finished()
        while asr.is_ready(s):
            asr.decode_stream(s)
        return asr.get_result(s).strip()
    asr.decode_stream(s)
    return s.result.text.strip()


def verifier(asr, phrases, sr, bavard=True):
    erreurs = total = 0
    for texte, x, _ in phrases:
        hyp = transcrire(asr, x, sr)
        e, n_mots = wer(texte, hyp)
        erreurs += e
        total += n_mots
        if bavard and e:
            print(f"  ✗ {texte!r}\n    entendu : {hyp!r}")
    return erreurs / total


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--modeles", required=True)
    p.add_argument("--voix", default="upmc", choices=VOIX)
    p.add_argument("--locuteur", type=int, default=1, help="upmc : 1 = Pierre")
    p.add_argument("--vitesse", type=float, default=1.1,
                   help="length_scale : >1 ralentit (articulation plus nette)")
    p.add_argument("--bruit", type=float, default=0.5)
    p.add_argument("--bruit-w", type=float, default=0.6)
    p.add_argument("--sortie", default="voix-off.mp3")
    p.add_argument("--prises", type=int, default=1,
                   help="prises par phrase ; la mieux comprise par Whisper est gardée")
    p.add_argument("--verifier", action="store_true")
    a = p.parse_args()

    tts = creer_tts(a.modeles, a.voix, a.bruit, a.bruit_w, a.vitesse)
    asr = creer_asr(a.modeles) if (a.verifier or a.prises > 1) else None
    phrases, sr = synthetiser(tts, a.locuteur, asr, a.prises, bavard=True)
    with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
        sf.write(tmp.name, assembler(phrases, sr), sr)
        masteriser(tmp.name, a.sortie)
    print(f"Écrit : {a.sortie}")
    if a.verifier:
        taux = verifier(asr, phrases, sr)
        print(f"Taux d'erreur de mots (Whisper) : {taux:.1%}")
        taux = verifier(creer_juge(a.modeles), phrases, sr)
        print(f"Taux d'erreur de mots (juge indépendant Zipformer) : {taux:.1%}")


if __name__ == "__main__":
    sys.exit(main())
