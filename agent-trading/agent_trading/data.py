"""Données de marché : bougies Binance (API publique, sans clé) ou données synthétiques."""
from __future__ import annotations

import numpy as np
import pandas as pd
import requests

BINANCE = "https://api.binance.com"
COLS = ["open_time", "open", "high", "low", "close", "volume", "close_time",
        "qv", "trades", "tbb", "tbq", "ignore"]


def fetch_klines(symbol: str, interval: str = "1h", limit: int = 1000,
                 end_time: int | None = None, base: str = BINANCE) -> pd.DataFrame:
    params = {"symbol": symbol, "interval": interval, "limit": min(limit, 1000)}
    if end_time:
        params["endTime"] = end_time
    r = requests.get(f"{base}/api/v3/klines", params=params, timeout=15)
    r.raise_for_status()
    return _to_df(r.json())


def fetch_history(symbol: str, interval: str, bars: int, base: str = BINANCE) -> pd.DataFrame:
    """Récupère plus de 1000 bougies en paginant vers le passé."""
    frames, end = [], None
    while bars > 0:
        df = fetch_klines(symbol, interval, min(bars, 1000), end, base)
        if df.empty:
            break
        frames.insert(0, df)
        bars -= len(df)
        end = int(df.index[0].value // 1_000_000) - 1
    out = pd.concat(frames)
    return out[~out.index.duplicated()].sort_index()


def closed_only(df: pd.DataFrame) -> pd.DataFrame:
    """Retire la bougie en cours (non clôturée) pour ne décider que sur des données définitives."""
    now = pd.Timestamp.now(tz="UTC")
    return df[df["close_time"] < now]


def _to_df(rows) -> pd.DataFrame:
    df = pd.DataFrame(rows, columns=COLS)
    for c in ("open", "high", "low", "close", "volume"):
        df[c] = df[c].astype(float)
    df["open_time"] = pd.to_datetime(df["open_time"], unit="ms", utc=True)
    df["close_time"] = pd.to_datetime(df["close_time"], unit="ms", utc=True)
    return df.set_index("open_time")[["open", "high", "low", "close", "volume", "close_time"]]


def synthetic(bars: int = 3000, seed: int = 42, start_price: float = 30000.0) -> pd.DataFrame:
    """Marché simulé (alternance de tendances, krachs et phases calmes) pour tests et démo."""
    rng = np.random.default_rng(seed)
    regimes = rng.choice([0.0006, -0.0006, 0.0, -0.003], size=bars // 150 + 1, p=[0.4, 0.3, 0.25, 0.05])
    drift = np.repeat(regimes, 150)[:bars]
    vol = np.repeat(rng.uniform(0.004, 0.015, size=bars // 150 + 1), 150)[:bars]
    rets = drift + vol * rng.standard_normal(bars)
    close = start_price * np.exp(np.cumsum(rets))
    open_ = np.concatenate([[start_price], close[:-1]])
    spread = np.abs(rng.standard_normal(bars)) * vol * close * 0.6
    high = np.maximum(open_, close) + spread
    low = np.minimum(open_, close) - spread
    idx = pd.date_range("2024-01-01", periods=bars, freq="h", tz="UTC")
    return pd.DataFrame({"open": open_, "high": high, "low": low, "close": close,
                         "volume": rng.uniform(100, 1000, bars),
                         "close_time": idx + pd.Timedelta(hours=1) - pd.Timedelta(milliseconds=1)},
                        index=idx)
