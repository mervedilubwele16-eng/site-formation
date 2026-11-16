---
name: anim-19-papier
description: Vidéo animée en style n° 19 « Papier craft » (raccourci du skill animation-66-styles).
argument-hint: "Texte scène 1|Texte scène 2|… (+ format, voix-off, logo en option)"
disable-model-invocation: true
---

Crée une vidéo animée dans le style **n° 19 « Papier craft »** (id `papier`, fond `paper`, animation `jitter`).

Demande de l'utilisateur : $ARGUMENTS

Marche à suivre :
1. Lis `.claude/skills/animation-66-styles/SKILL.md` (à la racine du dépôt) et suis sa méthode, en imposant `--style papier`.
2. Si la demande ci-dessus est vide, demande seulement le texte ou le sujet de la vidéo, puis continue.
3. Découpe le texte en scènes courtes (`|` = nouvelle scène si l'utilisateur l'a utilisé), mets 1–2 mots-clés en `*valeur*`, écris le JSON dans le scratchpad.
4. Format par défaut 9:16 sauf indication contraire ; si un audio (voix-off, musique) ou un logo a été joint ou mentionné, utilise `--audio` / `--logo`.
5. Aperçu rapide `--scale 0.4`, vérifie une image, puis rendu final et envoie le MP4 avec SendUserFile.
