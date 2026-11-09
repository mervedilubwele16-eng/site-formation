"""Stratégie : suivi de tendance multi-signaux avec filtres de risque.

L'agent n'achète que si plusieurs signaux indépendants sont d'accord :
  1. tendance de fond haussière (prix > EMA 200)
  2. momentum court terme (EMA rapide > EMA lente)
  3. MACD positif et en hausse
  4. RSI sain (entre 45 et le seuil de surchauffe)
Il vend quand la tendance se retourne, ou via stop-loss / take-profit / stop suiveur.
"""
from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from . import indicators as ind


@dataclass
class Signal:
    action: str        # "BUY", "SELL" ou "HOLD"
    score: int
    price: float
    atr: float
    reasons: list


def add_indicators(df: pd.DataFrame, p: dict) -> pd.DataFrame:
    df = df.copy()
    df["ema_fast"] = ind.ema(df["close"], p["ema_fast"])
    df["ema_slow"] = ind.ema(df["close"], p["ema_slow"])
    df["ema_trend"] = ind.ema(df["close"], p["ema_trend"])
    df["rsi"] = ind.rsi(df["close"], p["rsi_period"])
    df["atr"] = ind.atr(df, p["atr_period"])
    df["macd_h"] = ind.macd_hist(df["close"])
    return df


def evaluate(df: pd.DataFrame, p: dict) -> Signal:
    """Analyse la dernière bougie clôturée (df doit déjà contenir les indicateurs)."""
    last, prev = df.iloc[-1], df.iloc[-2]
    price, atr = float(last["close"]), float(last["atr"])
    checks = {
        "tendance de fond haussière (prix > EMA200)": last["close"] > last["ema_trend"],
        "momentum haussier (EMA rapide > EMA lente)": last["ema_fast"] > last["ema_slow"],
        "MACD positif et en hausse": last["macd_h"] > 0 and last["macd_h"] > prev["macd_h"],
        "RSI sain": 45 <= last["rsi"] <= p["rsi_max_entry"],
    }
    score = sum(bool(v) for v in checks.values())
    reasons = [k for k, v in checks.items() if v]

    crossed_down = last["ema_fast"] < last["ema_slow"] and prev["ema_fast"] >= prev["ema_slow"]
    if crossed_down or last["close"] < last["ema_trend"] * 0.98:
        return Signal("SELL", score, price, atr, ["retournement de tendance"])
    if score >= p["min_score"] and checks["tendance de fond haussière (prix > EMA200)"]:
        return Signal("BUY", score, price, atr, reasons)
    return Signal("HOLD", score, price, atr, reasons)


def warmup(p: dict) -> int:
    return max(p["ema_trend"], p["ema_slow"]) + 10
