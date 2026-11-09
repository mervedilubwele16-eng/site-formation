"""Cœur de décision, partagé par le backtest et l'agent en direct (même logique partout)."""
from __future__ import annotations

import logging

import pandas as pd

from . import strategy
from .risk import Position, RiskManager, RiskState

log = logging.getLogger("agent")


class Engine:
    def __init__(self, cfg: dict, broker, risk_state: RiskState | None = None,
                 positions: dict | None = None, notify=None):
        self.cfg = cfg
        self.broker = broker
        self.risk = RiskManager(cfg, risk_state or RiskState(peak_equity=broker.get_cash()))
        self.positions: dict[str, Position] = positions or {}
        self.last_prices: dict[str, float] = {}
        self.trades: list[dict] = []
        self.notify = notify or (lambda msg: None)

    def equity(self) -> float:
        val = sum(p.qty * self.last_prices.get(s, p.entry) for s, p in self.positions.items())
        return self.broker.get_cash() + val

    def on_bar(self, symbol: str, df: pd.DataFrame) -> None:
        """df : historique avec indicateurs, la dernière ligne étant la bougie qui vient de clôturer."""
        bar = df.iloc[-1]
        ts = df.index[-1]
        self.last_prices[symbol] = float(bar["close"])
        self.risk.update_equity(self.equity(), str(ts.date()))
        sig = strategy.evaluate(df, self.cfg["strategy"])

        pos = self.positions.get(symbol)
        if pos:
            stop_before = pos.stop
            # stop déjà exécuté par la plateforme (mode live) ?
            if hasattr(self.broker, "stop_filled") and self.broker.stop_filled(symbol):
                self._record(symbol, pos, pos.stop, "stop-loss (plateforme)", ts, sell=False)
                return
            exit_ = self.risk.check_exit(pos, float(bar["high"]), float(bar["low"]),
                                         float(bar["close"]), sig.atr)
            if exit_ is None and sig.action == "SELL":
                exit_ = ("signal de sortie : " + ", ".join(sig.reasons), float(bar["close"]))
            if exit_ is None and self.risk.state.halted and self.risk.state.halt_reason.startswith("drawdown"):
                exit_ = ("coupe-circuit drawdown", float(bar["close"]))
            if exit_:
                self._record(symbol, pos, exit_[1], exit_[0], ts)
            elif pos.stop > stop_before:
                self.broker.set_stop(symbol, pos.qty, pos.stop)
            return

        if sig.action != "BUY":
            return
        ok, why = self.risk.can_open(symbol, sig.price, sig.atr, len(self.positions))
        if not ok:
            log.info("%s : achat refusé par le gestionnaire de risque (%s)", symbol, why)
            return
        qty, stop, target = self.risk.size(self.equity(), self.broker.get_cash(), sig.price, sig.atr)
        if qty * sig.price < 10:
            log.info("%s : position trop petite, ignorée", symbol)
            return
        filled, px = self.broker.buy(symbol, qty, sig.price)
        if filled <= 0:
            return
        self.positions[symbol] = Position(symbol, filled, px, stop, target, px, str(ts))
        self.broker.set_stop(symbol, filled, stop)
        msg = (f"ACHAT {symbol} {filled:.6f} @ {px:.2f} | stop {stop:.2f} | objectif {target:.2f} "
               f"| score {sig.score}/4 : {', '.join(sig.reasons)}")
        log.info(msg)
        self.notify(msg)

    def _record(self, symbol, pos: Position, price, reason, ts, sell=True):
        if sell:
            _, price = self.broker.sell(symbol, pos.qty, price)
        elif hasattr(self.broker, "cash"):
            self.broker.cash += pos.qty * price * (1 - self.cfg["fees"])
        pnl = (price * (1 - self.cfg["fees"]) - pos.entry * (1 + self.cfg["fees"])) * pos.qty
        pct = price / pos.entry - 1
        self.trades.append({"symbol": symbol, "entry_time": pos.opened_at, "exit_time": str(ts),
                            "entry": pos.entry, "exit": price, "qty": pos.qty,
                            "pnl": pnl, "pct": pct, "reason": reason})
        del self.positions[symbol]
        self.risk.on_closed(symbol, reason)
        msg = f"VENTE {symbol} @ {price:.2f} ({pct:+.2%}, {pnl:+.2f} USDT) — {reason}"
        log.info(msg)
        self.notify(msg)
