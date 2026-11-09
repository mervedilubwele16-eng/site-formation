"""Exécution des ordres : simulation (paper) ou Binance réel (live)."""
from __future__ import annotations

import hashlib
import hmac
import math
import os
import time
from urllib.parse import urlencode

import requests


class PaperBroker:
    """Courtier simulé : aucun argent réel n'est engagé."""

    def __init__(self, cash: float, fees: float, slippage: float = 0.0005):
        self.cash, self.fees, self.slippage = cash, fees, slippage

    def buy(self, symbol: str, qty: float, price: float):
        px = price * (1 + self.slippage)
        cost = qty * px * (1 + self.fees)
        if cost > self.cash:
            qty = self.cash / (px * (1 + self.fees))
            cost = qty * px * (1 + self.fees)
        self.cash -= cost
        return qty, px

    def sell(self, symbol: str, qty: float, price: float):
        px = price * (1 - self.slippage)
        self.cash += qty * px * (1 - self.fees)
        return qty, px

    def set_stop(self, symbol: str, qty: float, stop: float):
        pass  # les stops sont gérés par l'agent en simulation

    def get_cash(self) -> float:
        return self.cash


class BinanceBroker:
    """Courtier réel Binance Spot. Place aussi un stop-loss côté plateforme
    pour protéger le capital même si l'ordinateur s'éteint."""

    def __init__(self, fees: float, base: str = "https://api.binance.com", quote: str = "USDT"):
        self.key = os.environ.get("BINANCE_API_KEY")
        self.secret = os.environ.get("BINANCE_API_SECRET")
        if not self.key or not self.secret:
            raise RuntimeError("BINANCE_API_KEY et BINANCE_API_SECRET doivent être définis (voir .env.exemple)")
        self.base, self.fees, self.quote = base, fees, quote
        self.filters: dict = {}
        self.stop_orders: dict = {}

    # ---- bas niveau ---------------------------------------------------------
    def _req(self, method: str, path: str, params: dict | None = None, signed: bool = True):
        params = dict(params or {})
        headers = {"X-MBX-APIKEY": self.key}
        if signed:
            params["timestamp"] = int(time.time() * 1000)
            params["recvWindow"] = 5000
            q = urlencode(params)
            params["signature"] = hmac.new(self.secret.encode(), q.encode(), hashlib.sha256).hexdigest()
        r = requests.request(method, self.base + path, params=params, headers=headers, timeout=15)
        if r.status_code >= 400:
            raise RuntimeError(f"Binance {r.status_code}: {r.text}")
        return r.json()

    def _filters(self, symbol: str) -> dict:
        if symbol not in self.filters:
            info = self._req("GET", "/api/v3/exchangeInfo", {"symbol": symbol}, signed=False)
            f = {x["filterType"]: x for x in info["symbols"][0]["filters"]}
            self.filters[symbol] = {
                "step": float(f["LOT_SIZE"]["stepSize"]),
                "tick": float(f["PRICE_FILTER"]["tickSize"]),
                "min_notional": float((f.get("NOTIONAL") or f.get("MIN_NOTIONAL") or {}).get("minNotional", 10)),
            }
        return self.filters[symbol]

    @staticmethod
    def _round(x: float, step: float) -> str:
        decimals = max(0, -int(math.floor(math.log10(step)))) if step < 1 else 0
        return f"{math.floor(x / step) * step:.{decimals}f}"

    # ---- interface ----------------------------------------------------------
    def get_cash(self) -> float:
        acct = self._req("GET", "/api/v3/account")
        for b in acct["balances"]:
            if b["asset"] == self.quote:
                return float(b["free"])
        return 0.0

    def buy(self, symbol: str, qty: float, price: float):
        f = self._filters(symbol)
        q = self._round(qty, f["step"])
        if float(q) * price < f["min_notional"]:
            return 0.0, price
        o = self._req("POST", "/api/v3/order", {"symbol": symbol, "side": "BUY", "type": "MARKET", "quantity": q})
        filled = float(o["executedQty"])
        avg = float(o["cummulativeQuoteQty"]) / filled if filled else price
        return filled * (1 - self.fees), avg   # frais prélevés sur l'actif acheté

    def sell(self, symbol: str, qty: float, price: float):
        self._cancel_stop(symbol)
        f = self._filters(symbol)
        q = self._round(qty, f["step"])
        o = self._req("POST", "/api/v3/order", {"symbol": symbol, "side": "SELL", "type": "MARKET", "quantity": q})
        filled = float(o["executedQty"])
        avg = float(o["cummulativeQuoteQty"]) / filled if filled else price
        return filled, avg

    def set_stop(self, symbol: str, qty: float, stop: float):
        self._cancel_stop(symbol)
        f = self._filters(symbol)
        o = self._req("POST", "/api/v3/order", {
            "symbol": symbol, "side": "SELL", "type": "STOP_LOSS_LIMIT", "timeInForce": "GTC",
            "quantity": self._round(qty, f["step"]),
            "stopPrice": self._round(stop, f["tick"]),
            "price": self._round(stop * 0.995, f["tick"]),
        })
        self.stop_orders[symbol] = o["orderId"]

    def stop_filled(self, symbol: str) -> bool:
        oid = self.stop_orders.get(symbol)
        if not oid:
            return False
        o = self._req("GET", "/api/v3/order", {"symbol": symbol, "orderId": oid})
        return o["status"] == "FILLED"

    def _cancel_stop(self, symbol: str):
        oid = self.stop_orders.pop(symbol, None)
        if oid:
            try:
                self._req("DELETE", "/api/v3/order", {"symbol": symbol, "orderId": oid})
            except RuntimeError:
                pass  # déjà exécuté ou annulé
