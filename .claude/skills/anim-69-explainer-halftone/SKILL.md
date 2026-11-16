---
name: anim-69-explainer-halftone
description: Vidéo animée en style n° 69 « Explainer halftone » (raccourci du skill animation-66-styles).
argument-hint: "Texte scène 1|Texte scène 2|… (+ format, voix-off, logo en option)"
disable-model-invocation: true
---

Crée une vidéo animée dans le style **n° 69 « Explainer halftone »** (id `explainer-halftone`, fond `pastel`, animation `rise`).

Demande de l'utilisateur : $ARGUMENTS

Marche à suivre :
1. Lis `.claude/skills/animation-66-styles/SKILL.md` (à la racine du dépôt) et suis sa méthode, en imposant `--style explainer-halftone`.
2. Si la demande ci-dessus est vide, demande seulement le texte ou le sujet de la vidéo, puis continue.
3. Découpe le texte en scènes courtes (`|` = nouvelle scène si l'utilisateur l'a utilisé), mets 1–2 mots-clés en `*valeur*`, écris le JSON dans le scratchpad.
4. Format par défaut 9:16 sauf indication contraire ; si un audio (voix-off, musique) ou un logo a été joint ou mentionné, utilise `--audio` / `--logo`.
5. Aperçu rapide `--scale 0.4`, vérifie une image, puis rendu final et envoie le MP4 avec SendUserFile.
Ce style est un style « Reel explicatif » : lis la section « 2 bis » du SKILL.md principal et exploite les éléments riches adaptés au texte (cartes, compteur, téléphone, carte lumineuse, fenêtre d'appli, sous-titres `caption`, gros titre `big`, scène finale `burst`, selon le style). Pars de `examples/explainer-halftone.json` comme modèle.
