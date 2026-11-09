#!/usr/bin/env bash
# Télécharge les modèles nécessaires à generer_voix_off.py dans le dossier donné
# (par défaut ./modeles). ~1,6 Go au total.
set -euo pipefail
DEST="${1:-modeles}"
mkdir -p "$DEST" && cd "$DEST"
BASE=https://github.com/k2-fsa/sherpa-onnx/releases/download
for m in \
  tts-models/vits-piper-fr_FR-tom-medium \
  asr-models/sherpa-onnx-whisper-small \
  asr-models/sherpa-onnx-streaming-zipformer-fr-2023-04-14 \
  asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8; do
  nom=$(basename "$m")
  [ -d "$nom" ] && { echo "déjà présent : $nom"; continue; }
  echo "téléchargement : $nom"
  curl -fSL "$BASE/$m.tar.bz2" | tar xj
done
echo "Modèles prêts dans $(pwd)"
