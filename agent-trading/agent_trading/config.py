"""Chargement de la configuration (config.yaml) avec valeurs par défaut prudentes."""
from __future__ import annotations

import copy
from pathlib import Path

import yaml

DEFAULTS = {
    "mode": "paper",              # "paper" (simulation) ou "live" (argent réel)
    "exchange": "binance",
    "symbols": ["BTCUSDT", "ETHUSDT"],
    "interval": "1h",
    "loop_seconds": 300,          # fréquence d'analyse
    "capital_initial": 1000.0,    # capital fictif en mode paper (USDT)
    "fees": 0.001,                # 0,1 % par ordre
    "objectif_gain": 12000.0,     # gain (USDT) à atteindre ; l'agent vend tout et s'arrête (0 = désactivé)
    "strategy": {
        "ema_fast": 20,
        "ema_slow": 50,
        "ema_trend": 200,
        "rsi_period": 14,
        "rsi_max_entry": 70,      # pas d'achat si le marché est surchauffé
        "atr_period": 14,
        "min_score": 3,           # nombre de signaux concordants requis (sur 4)
    },
    "risk": {
        "risk_per_trade": 0.01,       # 1 % du capital risqué par trade
        "stop_atr_mult": 2.0,         # stop-loss = 2 x ATR
        "take_profit_atr_mult": 4.0,  # objectif = 4 x ATR (ratio 1:2)
        "trailing_atr_mult": 2.5,     # stop suiveur
        "max_position_pct": 0.25,     # max 25 % du capital par position
        "max_open_positions": 2,
        "max_daily_loss": 0.03,       # arrêt pour la journée à -3 %
        "max_drawdown": 0.15,         # arrêt complet à -15 % depuis le plus haut
        "max_volatility_pct": 0.08,   # pas d'entrée si ATR > 8 % du prix
        "cooldown_bars": 3,           # pause après un stop-loss
    },
    "state_file": "etat_agent.json",
    "log_file": "agent.log",
}


def _merge(base: dict, override: dict) -> dict:
    out = copy.deepcopy(base)
    for k, v in (override or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _merge(out[k], v)
        else:
            out[k] = v
    return out


def load_config(path: str | Path | None = None) -> dict:
    cfg = copy.deepcopy(DEFAULTS)
    if path and Path(path).exists():
        with open(path, encoding="utf-8") as f:
            cfg = _merge(cfg, yaml.safe_load(f) or {})
    validate(cfg)
    return cfg


def validate(cfg: dict) -> None:
    r = cfg["risk"]
    if cfg["mode"] not in ("paper", "live"):
        raise ValueError("mode doit être 'paper' ou 'live'")
    if not 0 < r["risk_per_trade"] <= 0.03:
        raise ValueError("risk_per_trade doit être entre 0 et 3 % (au-delà, c'est du jeu, pas du trading)")
    if not 0 < r["max_drawdown"] <= 0.5:
        raise ValueError("max_drawdown doit être entre 0 et 50 %")
    if cfg["objectif_gain"] < 0:
        raise ValueError("objectif_gain doit être positif (0 = désactivé)")
    if r["stop_atr_mult"] <= 0:
        raise ValueError("stop_atr_mult doit être > 0")
