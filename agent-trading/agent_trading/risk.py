"""Gestionnaire de risque : il a toujours le dernier mot sur la stratégie."""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Position:
    symbol: str
    qty: float
    entry: float
    stop: float
    target: float
    highest: float
    opened_at: str = ""

    def to_dict(self):
        return self.__dict__.copy()


@dataclass
class RiskState:
    peak_equity: float
    day: str = ""
    day_start_equity: float = 0.0
    halted: bool = False
    halt_reason: str = ""
    cooldown: dict = field(default_factory=dict)   # symbol -> barres restantes
    cycle_start_equity: float = 0.0                # capital au début du cycle en cours
    target_reached: bool = False


class RiskManager:
    def __init__(self, cfg: dict, state: RiskState):
        self.r = cfg["risk"]
        self.fees = cfg["fees"]
        self.state = state

    # ---- coupe-circuits globaux -------------------------------------------------
    def update_equity(self, equity: float, day: str) -> None:
        s = self.state
        if s.day != day:                      # nouvelle journée
            s.day, s.day_start_equity = day, equity
            if s.halted and s.halt_reason.startswith("perte journalière"):
                s.halted, s.halt_reason = False, ""
        s.peak_equity = max(s.peak_equity, equity)
        dd = 1 - equity / s.peak_equity
        if dd >= self.r["max_drawdown"]:
            s.halted, s.halt_reason = True, f"drawdown maximal atteint ({dd:.1%}) — arrêt complet"
        elif s.day_start_equity and 1 - equity / s.day_start_equity >= self.r["max_daily_loss"]:
            if not s.halted:
                s.halted, s.halt_reason = True, "perte journalière maximale atteinte — pause jusqu'à demain"

    # ---- décision d'entrée ------------------------------------------------------
    def can_open(self, symbol: str, price: float, atr: float, n_open: int) -> tuple[bool, str]:
        if self.state.halted:
            return False, self.state.halt_reason
        if n_open >= self.r["max_open_positions"]:
            return False, "nombre maximal de positions ouvertes"
        if self.state.cooldown.get(symbol, 0) > 0:
            return False, "pause après un stop-loss"
        if atr <= 0 or price <= 0:
            return False, "données invalides"
        if atr / price > self.r["max_volatility_pct"]:
            return False, f"volatilité trop forte ({atr / price:.1%})"
        return True, "ok"

    def size(self, equity: float, cash: float, price: float, atr: float) -> tuple[float, float, float]:
        """Taille de position : on risque au plus risk_per_trade du capital si le stop est touché."""
        stop = price - self.r["stop_atr_mult"] * atr
        target = price + self.r["take_profit_atr_mult"] * atr
        risk_per_unit = price - stop + price * self.fees * 2
        qty = equity * self.r["risk_per_trade"] / risk_per_unit
        qty = min(qty, equity * self.r["max_position_pct"] / price, cash * 0.99 / (price * (1 + self.fees)))
        return max(qty, 0.0), stop, target

    # ---- gestion des positions ouvertes ----------------------------------------
    def check_exit(self, pos: Position, high: float, low: float, close: float, atr: float):
        """Retourne (raison, prix) si la position doit être clôturée, sinon None."""
        if low <= pos.stop:
            return ("stop suiveur" if pos.stop > pos.entry else "stop-loss"), pos.stop
        if high >= pos.target:
            return "take-profit", pos.target
        pos.highest = max(pos.highest, high)
        trail = pos.highest - self.r["trailing_atr_mult"] * atr
        if trail > pos.stop:
            pos.stop = trail                 # le stop ne fait que monter
        return None

    def on_closed(self, symbol: str, reason: str) -> None:
        if reason.startswith("stop-loss"):
            self.state.cooldown[symbol] = self.r["cooldown_bars"]

    def tick_cooldowns(self) -> None:
        self.state.cooldown = {k: v - 1 for k, v in self.state.cooldown.items() if v > 1}
