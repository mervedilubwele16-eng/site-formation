# Voix off — « Le premier pas »

Voix off originale de présentation pour le site de formation (≈ 45 secondes).

- **Voix :** Perle — voix féminine française, chaleureuse et professionnelle (ElevenLabs)
- **Modèle :** eleven_v4 (les balises entre crochets indiquent le ton)

---

[chaleureux] Il y a toujours un premier pas.
Celui qu'on repousse à demain… puis à la semaine prochaine.
[pause] Et si c'était aujourd'hui ?

[assuré] Apprendre, ce n'est pas remplir des cases. C'est ouvrir des portes.
Une compétence de plus, c'est un projet qui devient possible, un métier qui se dessine, une confiance qui grandit.

[engageant] Ici, chaque formation est pensée pour vous : des contenus clairs, des exercices concrets, et un accompagnement à chaque étape.
À votre rythme. Depuis chez vous. Sans jamais être seul.

[doux] Parce que le savoir ne sert à rien s'il reste dans un livre fermé.
[inspirant] Il prend vie quand vous le mettez en pratique.

[chaleureux] Alors, prêt à faire ce premier pas ?
Rejoignez-nous… et commencez à construire la suite, dès maintenant.

---

## Version voix masculine, générée en local

Fichier : `voix-off-masculine-tom.mp3` (≈ 58 s, MP3 192 kb/s, −17 LUFS).

Générée entièrement dans l'environnement, sans service externe, par
`generer_voix_off.py` avec la voix française masculine **Tom** (modèle
Piper/VITS exécuté par sherpa-onnx).

### Comment le programme fait bien articuler la voix

| Étape | Effet |
|---|---|
| Choix de la voix | Tom, Pierre et Gilles comparés : Tom fait 2–3 % d'erreurs contre 8–13 % pour les autres |
| Débit ralenti de 20 % (`length_scale` 1.2) | les syllabes ne sont plus avalées |
| Une phrase à la fois + vraies pauses | la voix ne s'essouffle pas sur les phrases longues |
| Règles de prononciation testées | « dessine » n'est plus entendu « décide », « cases » n'est plus entendu « casses », « contenus clairs » n'est plus entendu « comptes nucléaires » |
| 6 prises par phrase, la meilleure est gardée | chaque prise est écoutée en contexte par deux modèles de reconnaissance vocale (Whisper + Zipformer) |
| Mastering ffmpeg | relief des consonnes (3,5 kHz), compression douce, volume normalisé |

### Résultat mesuré

Taux de mots mal compris, voix off écoutée en continu :

| | Au départ | Version finale |
|---|---|---|
| Whisper | 9,4 % | 0 % |
| Zipformer | 18,1 % | 1,6 % |
| **Parakeet (juge indépendant, jamais utilisé pour choisir)** | — | **0,8 %** |

### Régénérer

```bash
pip install "sherpa-onnx<2" soundfile numpy   # ffmpeg doit être installé
./telecharger_modeles.sh modeles               # ~1,6 Go
python3 generer_voix_off.py --modeles modeles --prises 6 --verifier \
        --sortie voix-off-masculine-tom.mp3
```

Options utiles : `--vitesse 1.1` (un peu plus rapide), `--prises 10`
(plus de choix), `--voix upmc --locuteur 1` (voix « Pierre »). Le texte et les
règles de prononciation se modifient en haut de `generer_voix_off.py`
(`SCRIPT` et `PRONONCIATION`).
