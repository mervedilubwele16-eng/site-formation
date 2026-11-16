---
name: animation-66-styles
description: Créer une vidéo animée (texte animé, motion design, intro, Reel/TikTok/Short, slogan, citation, leçon, annonce) en MP4 dans l'un des 66 styles visuels prêts à l'emploi (néon, synthwave, minimal, cinéma, BD, TikTok, Matrix, aquarelle, Noël…), en 9:16, 16:9, 1:1 ou 4:5, avec voix-off ou musique en option. À utiliser dès que l'utilisateur veut « animer » un texte ou une vidéo dans un style, choisir un style d'animation, ou voir les styles disponibles.
---

# Animation vidéo — 66 styles

Moteur maison : chaque frame est dessinée dans un canvas (Chromium via Playwright), puis encodée en MP4 H.264 par ffmpeg. Rendu déterministe, aucune clé API, aucun crédit consommé.

Prérequis (déjà présents dans l'environnement cloud) : `node`, `ffmpeg`, `playwright` + Chromium.

Tous les chemins ci-dessous sont relatifs au dossier de ce skill : `.claude/skills/animation-66-styles/`.

## 1. Choisir le style

- Liste texte : `STYLES.txt` (ou `node scripts/render.mjs --list`).
- Planche visuelle des 66 styles : `catalogue.jpg`. Montre-la à l'utilisateur s'il hésite (avec SendUserFile).
- On peut désigner un style par son **numéro** (`12`), son **id** (`neon-nuit`) ou son **nom** (`"Néon nuit"`).

Familles pour orienter le choix :
| Besoin | Styles conseillés |
|---|---|
| Réseaux sociaux punchy | 37 instagram, 38 tiktok, 39 youtube, 48 sport, 63 graffiti |
| Pro / formation | 3–5 minimal & corporate, 59 education, 60 finance, 58 science, 28 suisse |
| Élégant | 6 luxe-or, 23 cinema, 44 mariage, 61 magazine, 62 japon |
| Rétro / geek | 1 neon-nuit, 2 synthwave, 7 retro-tv, 8 matrix, 9 terminal, 49–50 gaming/pixel, 31 vaporwave, 32 cyberpunk |
| Doux / nature | 13 aurore, 16 ocean, 18 foret, 51 nature, 57 glace, 64 aquarelle |
| Fun / enfants | 10 pop-bd, 11 bonbon, 12 enfant, 30 memphis, 43 fete |
| Événements | 45 noel, 46 halloween, 47 horreur, 42 disco |

## 2. Écrire les scènes

Une scène = un écran de texte. Fichier JSON (voir `examples/scenes.json`) :

```json
{ "scenes": [
  { "text": "Tu veux lancer ta *formation* ?", "kicker": "Astuce du jour" },
  { "text": "Commence par *une seule* promesse claire", "duration": 2.5 },
  { "text": "Abonne-toi 👉", "anim": "pop", "size": 1.2 }
] }
```

- `*mots*` entre astérisques = mis en valeur (couleur d'accent, ou surlignage plein pour tiktok/minimal/suisse/magazine/education/corporate/brutaliste).
- `kicker` : petit sur-titre au-dessus. `duration` (s) : sinon calculée selon la longueur. `size` : multiplicateur de taille.
- `anim` : remplace l'animation du style pour cette scène. Valeurs : `fade rise slideUp slideDown slideLeft pop bounce elastic dropIn zoomOut spin swing flip blurIn typewriter wave jitter neon flicker glitch scramble stamp drawIn`.
- Garder des phrases courtes (≤ 8 mots par scène) : la taille du texte s'adapte automatiquement.

Raccourci sans fichier : `--text "Scène 1|Scène 2|Scène 3"`.

## 3. Rendre

```bash
cd .claude/skills/animation-66-styles
node scripts/render.mjs --style neon-nuit --script scenes.json --out /chemin/video.mp4
```

Options :
- `--format 9:16` (défaut) | `16:9` | `1:1` | `4:5` | `LARGEURxHAUTEUR`
- `--fps 30` (défaut) ; `--scale 0.4` pour un aperçu rapide basse définition
- `--audio voix.mp3` : ajoute la voix-off/musique et **étire les scènes pour finir avec l'audio** (les `duration` explicites sont gardées si toutes les scènes en ont)
- `--colors '{"acc":"#ff0055","txt":"#ffffff","b1":"#000000","b2":"#222222"}'` : couleurs de marque (accent, texte, fond 1, fond 2)
- `--upper` : texte en majuscules ; `--watermark "@moncompte"` : signature en bas

Autres modes :
- `--catalogue --out planche.png [--format 16:9]` : planche des 66 styles
- `--showreel --out demo.mp4 [--styles 1,8,38] [--text "Mon slogan"]` : 1,8 s par style, pour comparer plusieurs styles sur le même texte

Vitesse : ~1 s de calcul par seconde de vidéo en 1080×1920.

## 4. Méthode conseillée

1. Si le style n'est pas précisé, proposer 3 styles adaptés (tableau ci-dessus) ou générer un `--showreel --styles a,b,c --scale 0.4` avec le texte de l'utilisateur.
2. Découper le message en scènes courtes, mettre 1–2 mots-clés en `*valeur*`.
3. Faire un aperçu rapide `--scale 0.4`, extraire une image (`ffmpeg -ss 2 -i v.mp4 -frames:v 1 f.png`) et la regarder pour vérifier lisibilité et coupures.
4. Rendu final en pleine définition, puis l'envoyer avec SendUserFile.
5. Pour une vidéo filmée existante : rendre l'animation puis l'incruster ou l'enchaîner avec ffmpeg (ex. intro animée + `concat`, ou superposition sur fond vert via `colorkey`).

## Ajouter un style

Dans `scripts/engine.js`, ajouter une ligne au tableau `S` :
`['id', 'Nom', fond, animation, police (sans|serif|mono), graisse, [fond1, fond2, texte, accent], [effets]]`.
Fonds disponibles = clés de `BG`, animations = clés de `A`, effets : `glow vignette grain scan rgb shake letterbox border stroke scratches`.
