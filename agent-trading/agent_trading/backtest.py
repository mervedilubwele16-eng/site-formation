"""Backtest : rejoue la stratégie sur l'historique pour mesurer ses performances AVANT de risquer de l'argent."""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import strategy
from .broker import PaperBroker
from .engine import Engine


def run(cfg: dict, data: dict[str, pd.DataFrame]) -> dict:
    p = cfg["strategy"]
    broker = PaperBroker(cfg["capital_initial"], cfg["fees"])
    eng = Engine(cfg, broker)
    enriched = {s: strategy.add_indicators(df, p) for s, df in data.items()}
    index = sorted(set().union(*[df.index for df in enriched.values()]))
    w = strategy.warmup(p)
    pos_of = {s: {t: i for i, t in enumerate(df.index)} for s, df in enriched.items()}
    curve = []
    for ts in index:
        for s, df in enriched.items():
            i = pos_of[s].get(ts)
            if i is not None and i >= w:
                eng.on_bar(s, df.iloc[: i + 1])
        eng.risk.tick_cooldowns()
        curve.append((ts, eng.equity()))
    # clôture des positions restantes pour le bilan
    for s in list(eng.positions):
        eng._record(s, eng.positions[s], eng.last_prices[s], "fin du backtest", index[-1])
    equity = pd.Series([v for _, v in curve], index=[t for t, _ in curve])
    return summarize(cfg, equity, eng.trades, enriched)


def summarize(cfg, equity: pd.Series, trades: list, data: dict) -> dict:
    start = cfg["capital_initial"]
    rets = equity.pct_change().dropna()
    dd = (equity / equity.cummax() - 1).min()
    wins = [t for t in trades if t["pnl"] > 0]
    losses = [t for t in trades if t["pnl"] <= 0]
    gross_win = sum(t["pnl"] for t in wins)
    gross_loss = -sum(t["pnl"] for t in losses)
    bh = np.mean([df["close"].iloc[-1] / df["close"].iloc[strategy.warmup(cfg["strategy"])] - 1
                  for df in data.values()])
    periods_per_year = 24 * 365 if cfg["interval"].endswith("h") else 365
    sharpe = rets.mean() / rets.std() * np.sqrt(periods_per_year) if rets.std() > 0 else 0.0
    return {
        "capital_initial": start,
        "capital_final": round(float(equity.iloc[-1]), 2),
        "rendement": float(equity.iloc[-1] / start - 1),
        "achat_conserve": float(bh),
        "drawdown_max": float(dd),
        "sharpe": float(sharpe),
        "nb_trades": len(trades),
        "taux_reussite": len(wins) / len(trades) if trades else 0.0,
        "profit_factor": gross_win / gross_loss if gross_loss else float("inf"),
        "trades": trades,
        "equity": equity,
    }


def print_report(res: dict) -> None:
    print("\n========== RÉSULTATS DU BACKTEST ==========")
    print(f"Capital initial      : {res['capital_initial']:.2f} USDT")
    print(f"Capital final        : {res['capital_final']:.2f} USDT")
    print(f"Rendement agent      : {res['rendement']:+.2%}")
    print(f"Achat-conservation   : {res['achat_conserve']:+.2%}  (référence)")
    print(f"Perte max (drawdown) : {res['drawdown_max']:.2%}")
    print(f"Ratio de Sharpe      : {res['sharpe']:.2f}")
    print(f"Nombre de trades     : {res['nb_trades']}")
    print(f"Taux de réussite     : {res['taux_reussite']:.1%}")
    print(f"Profit factor        : {res['profit_factor']:.2f}")
    print("============================================")
    print("Rappel : les performances passées ne garantissent pas les résultats futurs.\n")
