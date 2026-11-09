# 🤖 Agent de trading automatique

Un agent qui analyse le marché crypto (Binance) **24h/24**, prend des décisions d'achat et de vente,
et surtout **protège votre capital** grâce à un gestionnaire de risque qui a toujours le dernier mot.

> ⚠️ **À lire avant tout.** Aucun programme ne garantit des gains. Le trading peut faire perdre
> de l'argent, y compris avec cet agent. Il est livré **en mode simulation par défaut** :
> testez-le plusieurs semaines avant d'engager de l'argent réel, et n'engagez jamais
> une somme que vous ne pouvez pas vous permettre de perdre.

## Ce que fait l'agent

**Stratégie « tendance » (retenue après recherche sur 10 ans de prix réels du Bitcoin)**

Chaque jour, à la clôture de la bougie quotidienne, cinq signaux de tendance votent :
- prix au-dessus de sa moyenne sur 50, 100 et 150 jours ;
- cassure de Donchian sur 20 et 55 jours (méthode inspirée de Zarattini, Pagani & Barbon,
  *Catching Crypto Trends*, Swiss Finance Institute, 2025).

La part du capital investie = la proportion de signaux haussiers, **réduite quand le marché est agité**
(ciblage de volatilité, 20 % par an par défaut). Quand plus aucun signal n'est haussier, l'agent vend
tout et reste en USDT : c'est ce qui lui fait traverser les krachs avec de petites pertes.

**Résultats sur données réelles (BTC/USD, frais compris)**

| Année | Agent | Perte max de l'agent | Bitcoin (acheter et garder) |
|---|---|---|---|
| 2018 | -11,1 % | -11,3 % | -72,5 % |
| 2019 | +51,5 % | -10,8 % | +87,5 % |
| 2020 | +73,9 % | -7,2 % | +303,9 % |
| 2021 | +13,7 % | -8,0 % | +57,2 % |
| 2022 | -12,7 % | -12,8 % | -65,4 % |
| 2023 | +24,0 % | -12,8 % | +154,3 % |
| 2024 | +29,2 % | -12,4 % | +111,3 % |
| 2025 | +0,8 % | -11,3 % | -7,3 % |
| 2026 (au 9 nov.) | -0,2 % | -8,2 % | -15,3 % |

De 2018 à fin 2026 : environ **+285 %** pour l'agent avec une perte maximale de **-19 %**,
contre +459 % pour le Bitcoin avec des chutes allant jusqu'à **-77 %**.
Les réglages ont été choisis sur 2016-2021 puis vérifiés sur 2022-2026 (période jamais vue).

**Ce qu'il faut savoir honnêtement**
- Aucune stratégie n'est infaillible. Celle-ci perd de petites sommes dans les marchés sans
  direction (2025-2026) et gagne **moins** que le Bitcoin pendant les fortes hausses : c'est le prix
  de la protection contre les krachs.
- Les performances passées ne garantissent pas les résultats futurs.
- L'ancienne stratégie (`type: classique`, bougies 1 h) a été abandonnée : -15 % en backtest réel.

**Protection du capital**
| Protection | Réglage par défaut |
|---|---|
| Sortie complète | dès que plus aucun signal de tendance n'est haussier |
| Taille de position | ajustée à la volatilité (jamais plus de 100 % du capital, jamais d'emprunt) |
| Stop de secours | ≈ 6 × ATR sous le prix, **posé aussi sur Binance** en mode réel |
| Perte journalière | pause jusqu'au lendemain à -5 % |
| Coupe-circuit | arrêt complet et vente de tout à -25 % depuis le plus haut |
| Marché trop agité | aucun achat si le prix bouge de plus de 8 % par jour |

**Objectif de gain : 12 000 $**

Quand le gain du cycle atteint `objectif_gain` (12 000 $ par défaut, frais de vente compris), l'agent
**vend toutes ses positions, sécurise le gain, vous prévient et s'arrête**. Quand vous le relancez,
un **nouveau cycle** commence à partir du capital actuel : il visera à nouveau +12 000 $, puis s'arrêtera encore.
Le montant se change dans `config.yaml` (`objectif_gain`) ; mettez `0` pour désactiver.

Le programme refuse aussi une configuration trop risquée (plus de 3 % de risque par trade).

## Démarrage rapide sous Windows

1. Installez Python depuis https://www.python.org/downloads (cochez **« Add Python to PATH »**).
2. Double-cliquez sur `1-installer.bat` (une seule fois).
3. Double-cliquez sur `2-tester.bat` pour voir les résultats de la stratégie sur les derniers mois.
4. Double-cliquez sur `3-lancer-simulation.bat` et laissez la fenêtre ouverte.
5. `4-voir-statut.bat` affiche le capital et les positions à tout moment.

## Installation

```bash
cd agent-trading
pip install -r requirements.txt
```

## Utilisation

```bash
# 1. Tester la stratégie sur l'historique réel de Binance (depuis 2017)
python -m agent_trading backtest --bars 5000

#    ou à partir d'une date
python -m agent_trading backtest --bars 5000 --debut 2022-01-01

#    ou hors ligne, sur un marché simulé
python -m agent_trading backtest --demo

# 2. Voir l'analyse actuelle du marché (aucun ordre passé)
python -m agent_trading analyse

# 3. Lancer l'agent en SIMULATION (argent fictif, prix réels)
python -m agent_trading run

# 4. Consulter son état (capital, positions, pauses)
python -m agent_trading statut
```

Tout est journalisé dans `agent.log`, et chaque trade est enregistré dans `historique_trades.jsonl`.
Si l'agent s'arrête ou que l'ordinateur redémarre, il reprend exactement là où il en était (`etat_agent.json`).

## Le faire tourner pendant que vous dormez

Un ordinateur personnel se met en veille. Le plus fiable est un petit serveur (VPS, quelques euros par mois) :

```bash
sudo mkdir -p /opt/agent-trading && sudo cp -r . /opt/agent-trading
sudo useradd -r trader && sudo chown -R trader /opt/agent-trading
sudo cp agent-trading.service /etc/systemd/system/
sudo systemctl enable --now agent-trading     # démarre et redémarre tout seul
journalctl -u agent-trading -f                # suivre en direct
```

**Notifications sur votre téléphone (optionnel)** : créez un bot Telegram avec @BotFather, puis
renseignez `TELEGRAM_TOKEN` et `TELEGRAM_CHAT_ID` dans `.env`. Vous recevrez chaque achat, vente et pause.

## Passer en argent réel (seulement après la simulation)

1. Sur Binance, créez une clé API avec **uniquement « Spot Trading »**. **N'activez jamais les retraits.**
   Restreignez-la à l'adresse IP de votre serveur.
2. Copiez `.env.exemple` en `.env` et remplissez vos clés (ce fichier ne doit jamais être partagé).
3. Mettez un petit montant sur le compte, puis lancez : `python -m agent_trading run --live`.
   L'agent vous demandera de taper « JE COMPRENDS LES RISQUES » pour confirmer.

## Résultat d'exemple de l'ancienne stratégie (marché simulé, `--demo`)

Sur un marché simulé qui chute de 62 %, l'agent finit à **-6,7 %** et sa perte maximale reste sous
le coupe-circuit de 15 % : c'est la gestion du risque qui fait son travail. Ce test montre aussi qu'il
n'y a **pas d'avantage magique** : sur un marché aléatoire, les frais grignotent le capital.
Ne passez en réel que si le backtest **sur données réelles** et plusieurs semaines de simulation sont positifs.

## Structure

```
agent_trading/
  strategy.py    analyse du marché (signaux)
  risk.py        gestionnaire de risque
  engine.py      décisions (logique identique en backtest et en direct)
  broker.py      exécution : simulation ou Binance réel
  agent.py       boucle 24h/24, sauvegarde, notifications
  backtest.py    test sur l'historique
  data.py        données de marché
tests/           20 tests automatiques : python -m unittest discover -s tests
```

## Sources de la recherche

- Zarattini, Pagani & Barbon, *Catching Crypto Trends* (2025) : https://abarbon.com/papers/catching-crypto-trends
- Grayscale Research, *The Trend is Your Friend* : https://research.grayscale.com/reports/the-trend-is-your-friend-managing-bitcoins-volatility-with-momentum-signals
- Quantpedia, *Revisiting Trend-following and Mean-reversion Strategies in Bitcoin* : https://quantpedia.com/revisiting-trend-following-and-mean-reversion-strategies-in-bitcoin/
- Données : Bitstamp BTC/USD 1 minute, https://github.com/ff137/bitstamp-btcusd-minute-data
