"""Agent autonome : tourne 24h/24, analyse le marché et gère les positions."""
from __future__ import annotations

import json
import logging
import os
import signal
import time
from pathlib import Path

import requests

from . import data, strategy
from .broker import BinanceBroker, PaperBroker
from .engine import Engine
from .risk import Position, RiskState

log = logging.getLogger("agent")


def setup_logging(path: str) -> None:
    fmt = logging.Formatter("%(asctime)s | %(levelname)s | %(message)s")
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    for h in (logging.StreamHandler(), logging.FileHandler(path, encoding="utf-8")):
        h.setFormatter(fmt)
        root.addHandler(h)


def telegram_notifier():
    """Notifications sur le téléphone (optionnel) via TELEGRAM_TOKEN et TELEGRAM_CHAT_ID."""
    token, chat = os.environ.get("TELEGRAM_TOKEN"), os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat:
        return None

    def send(msg: str):
        try:
            requests.post(f"https://api.telegram.org/bot{token}/sendMessage",
                          data={"chat_id": chat, "text": f"🤖 {msg}"}, timeout=10)
        except requests.RequestException as e:
            log.warning("notification Telegram impossible : %s", e)
    return send


class Agent:
    def __init__(self, cfg: dict):
        self.cfg = cfg
        self.state_path = Path(cfg["state_file"])
        self.running = True
        st = self._load_state()
        if cfg["mode"] == "live":
            broker = BinanceBroker(cfg["fees"])
            broker.stop_orders = st.get("stop_orders", {})
        else:
            broker = PaperBroker(st.get("cash", cfg["capital_initial"]), cfg["fees"])
        rs = RiskState(**st["risk"]) if "risk" in st else RiskState(peak_equity=broker.get_cash())
        positions = {s: Position(**p) for s, p in st.get("positions", {}).items()}
        self.engine = Engine(cfg, broker, rs, positions, telegram_notifier())
        self.engine.last_prices = st.get("last_prices", {})
        self.last_bar: dict = st.get("last_bar", {})

    def _load_state(self) -> dict:
        if self.state_path.exists():
            return json.loads(self.state_path.read_text(encoding="utf-8"))
        return {}

    def save_state(self) -> None:
        e = self.engine
        st = {
            "mode": self.cfg["mode"],
            "cash": e.broker.get_cash() if self.cfg["mode"] == "paper" else None,
            "positions": {s: p.to_dict() for s, p in e.positions.items()},
            "risk": e.risk.state.__dict__,
            "last_prices": e.last_prices,
            "last_bar": self.last_bar,
            "stop_orders": getattr(e.broker, "stop_orders", {}),
            "equity": e.equity(),
        }
        tmp = self.state_path.with_suffix(".tmp")
        tmp.write_text(json.dumps(st, indent=2, default=str), encoding="utf-8")
        tmp.replace(self.state_path)   # écriture atomique : pas de fichier corrompu en cas de coupure
        with open("historique_trades.jsonl", "a", encoding="utf-8") as f:
            for t in e.trades:
                f.write(json.dumps(t, default=str) + "\n")
        e.trades.clear()

    def step(self) -> None:
        p = self.cfg["strategy"]
        new_bar = False
        for sym in self.cfg["symbols"]:
            try:
                df = data.closed_only(data.fetch_klines(sym, self.cfg["interval"], strategy.warmup(p) + 50))
            except Exception as ex:  # réseau, API... on réessaie au prochain cycle
                log.warning("%s : données indisponibles (%s)", sym, ex)
                continue
            if len(df) < strategy.warmup(p):
                continue
            ts = str(df.index[-1])
            if self.last_bar.get(sym) == ts:
                continue                       # bougie déjà traitée
            self.last_bar[sym] = ts
            new_bar = True
            self.engine.on_bar(sym, strategy.add_indicators(df, p))
        if new_bar:
            self.engine.risk.tick_cooldowns()
            rs = self.engine.risk.state
            log.info("Capital : %.2f USDT | positions : %s%s", self.engine.equity(),
                     list(self.engine.positions) or "aucune",
                     f" | EN PAUSE : {rs.halt_reason}" if rs.halted else "")
        self.save_state()

    def run(self) -> None:
        signal.signal(signal.SIGINT, self._stop)
        signal.signal(signal.SIGTERM, self._stop)
        mode = "SIMULATION (aucun argent réel)" if self.cfg["mode"] == "paper" else "RÉEL — ARGENT RÉEL ENGAGÉ"
        log.info("Agent démarré en mode %s sur %s (%s)", mode, self.cfg["symbols"], self.cfg["interval"])
        if self.engine.notify:
            self.engine.notify(f"Agent démarré — mode {mode}")
        while self.running:
            try:
                self.step()
            except Exception:
                log.exception("Erreur inattendue — l'agent continue")
            for _ in range(int(self.cfg["loop_seconds"])):
                if not self.running:
                    break
                time.sleep(1)
        self.save_state()
        log.info("Agent arrêté proprement. Les positions ouvertes restent protégées par leur stop.")

    def _stop(self, *_):
        log.info("Arrêt demandé…")
        self.running = False
