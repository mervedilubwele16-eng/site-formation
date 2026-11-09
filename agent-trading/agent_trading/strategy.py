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
    if p.get("type", "classique") == "tendance":
        return add_trend_indicators(df, p)
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
    if p.get("type", "classique") == "tendance":
        return max(max(p["sma_periods"]), max(p["donchian_periods"]), p["vol_window"]) + 10
    return max(p["ema_trend"], p["ema_slow"]) + 10


# ============================================================================
# Stratégie « tendance » (retenue après recherche sur 10 ans de données réelles)
#
# Cinq signaux de tendance votent : prix au-dessus des moyennes mobiles 50/100/150
# et cassures de Donchian 20/55 jours (méthode inspirée de Zarattini, Pagani & Barbon,
# « Catching Crypto Trends », 2025). La part investie = proportion de signaux haussiers,
# réduite quand le marché est agité (ciblage de volatilité). Quand aucun signal
# n'est haussier, l'agent est 100 % en USDT : c'est ce qui limite les pertes en krach.
# ============================================================================

def _donchian_state(df: pd.DataFrame, n: int, exit_frac: float) -> pd.Series:
    hi = df["high"].rolling(n).max().shift(1)
    lo = df["low"].rolling(max(2, int(n * exit_frac))).min().shift(1)
    state = pd.Series(float("nan"), index=df.index)
    state[df["close"] > hi] = 1.0
    state[df["close"] < lo] = 0.0
    return state.ffill().fillna(0.0)


def add_trend_indicators(df: pd.DataFrame, p: dict) -> pd.DataFrame:
    df = df.copy()
    votes = []
    for n in p["sma_periods"]:
        col = f"sma{n}"
        df[col] = df["close"].rolling(n).mean()
        votes.append((df["close"] > df[col]).astype(float).rename(f"prix > moyenne {n} j"))
    for n in p["donchian_periods"]:
        votes.append(_donchian_state(df, n, p["donchian_exit_frac"]).rename(f"tendance Donchian {n} j"))
    v = pd.concat(votes, axis=1)
    for c in v.columns:
        df["vote: " + c] = v[c]
    df["signal"] = v.mean(axis=1)
    step = df.index.to_series().diff().median()
    per_year = pd.Timedelta(days=365) / step if pd.notna(step) and step.total_seconds() > 0 else 365
    df["vol_an"] = df["close"].pct_change().rolling(p["vol_window"]).std() * (per_year ** 0.5)
    df["exposition"] = (df["signal"] * (p["vol_cible"] / df["vol_an"]).clip(upper=1.0)).fillna(0.0)
    df["atr"] = ind.atr(df, 14)
    return df


@dataclass
class TrendSignal:
    exposure: float     # part du capital à investir (0 à 1)
    price: float
    atr: float
    reasons: list


def evaluate_trend(df: pd.DataFrame) -> TrendSignal:
    last = df.iloc[-1]
    reasons = [c[6:] for c in df.columns if c.startswith("vote: ") and last[c] > 0]
    return TrendSignal(float(last["exposition"]), float(last["close"]), float(last["atr"]), reasons)
