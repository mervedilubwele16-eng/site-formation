# 🤖 Agent de trading automatique

Un agent qui analyse le marché crypto (Binance) **24h/24**, prend des décisions d'achat et de vente,
et surtout **protège votre capital** grâce à un gestionnaire de risque qui a toujours le dernier mot.

> ⚠️ **À lire avant tout.** Aucun programme ne garantit des gains. Le trading peut faire perdre
> de l'argent, y compris avec cet agent. Il est livré **en mode simulation par défaut** :
> testez-le plusieurs semaines avant d'engager de l'argent réel, et n'engagez jamais
> une somme que vous ne pouvez pas vous permettre de perdre.

## Ce que fait l'agent

**Analyse : 4 signaux indépendants, l'agent n'achète que s'ils sont d'accord (au moins 3 sur 4)**
1. Tendance de fond haussière (prix au-dessus de la moyenne mobile 200)
2. Momentum court terme (EMA 20 au-dessus de l'EMA 50)
3. MACD positif et en accélération
4. RSI sain (pas d'achat sur un marché surchauffé)

**Protection du capital (gestionnaire de risque)**
| Protection | Réglage par défaut |
|---|---|
| Perte maximale par trade | 1 % du capital (taille de position calculée automatiquement) |
| Stop-loss | 2 × ATR sous le prix d'entrée, **posé aussi sur Binance** en mode réel |
| Prise de bénéfice | 4 × ATR (gain visé 2 fois supérieur au risque) |
| Stop suiveur | remonte avec le prix pour sécuriser les gains, ne descend jamais |
| Taille maximale d'une position | 25 % du capital |
| Positions simultanées | 2 maximum |
| Perte journalière | pause automatique jusqu'au lendemain à -3 % |
| Coupe-circuit | arrêt complet et vente de tout à -15 % depuis le plus haut |
| Marché trop agité | aucun achat si la volatilité dépasse 8 % |
| Après un stop-loss | pause de 3 bougies sur ce marché (évite la « vengeance ») |

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
# 1. Tester la stratégie sur l'historique réel (environ 7 mois en bougies 1h)
python -m agent_trading backtest --bars 5000

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

## Résultat d'exemple (marché simulé, `--demo`)

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
tests/           14 tests automatiques : python -m unittest discover -s tests
```
