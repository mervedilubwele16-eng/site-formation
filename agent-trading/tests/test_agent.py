import unittest

import pandas as pd

from agent_trading import backtest, data, strategy
from agent_trading.broker import PaperBroker
from agent_trading.config import DEFAULTS, load_config, parse_yaml, validate
from agent_trading.engine import Engine
from agent_trading.risk import Position, RiskManager, RiskState


class TestRisk(unittest.TestCase):
    def setUp(self):
        self.cfg = load_config(None)
        self.rm = RiskManager(self.cfg, RiskState(peak_equity=1000))

    def test_position_sizing_limits_loss_to_1_percent(self):
        qty, stop, _ = self.rm.size(1000, 1000, price=100, atr=1)
        loss_if_stopped = qty * (100 - stop)
        self.assertLessEqual(loss_if_stopped, 1000 * 0.01 + 1e-9)
        self.assertLess(stop, 100)

    def test_position_capped_by_max_position_pct(self):
        qty, _, _ = self.rm.size(1000, 1000, price=100, atr=0.01)
        self.assertLessEqual(qty * 100, 1000 * 0.25 + 1e-9)

    def test_drawdown_kill_switch(self):
        self.rm.update_equity(1000, "2025-01-01")
        self.rm.update_equity(840, "2025-01-02")
        self.assertTrue(self.rm.state.halted)
        ok, why = self.rm.can_open("BTCUSDT", 100, 1, 0)
        self.assertFalse(ok)
        self.assertIn("drawdown", why)

    def test_daily_loss_pause_resets_next_day(self):
        self.rm.update_equity(1000, "2025-01-01")
        self.rm.update_equity(960, "2025-01-01")
        self.assertTrue(self.rm.state.halted)
        self.rm.update_equity(960, "2025-01-02")
        self.assertFalse(self.rm.state.halted)

    def test_refuses_extreme_volatility(self):
        ok, why = self.rm.can_open("BTCUSDT", 100, 20, 0)
        self.assertFalse(ok)

    def test_trailing_stop_only_moves_up(self):
        pos = Position("X", 1, 100, 96, 108, 100)
        self.rm.check_exit(pos, high=106, low=101, close=105, atr=1)
        self.assertAlmostEqual(pos.stop, 106 - 2.5)
        self.rm.check_exit(pos, high=104, low=103.6, close=104, atr=1)
        self.assertAlmostEqual(pos.stop, 103.5)

    def test_stop_and_target_exits(self):
        pos = Position("X", 1, 100, 96, 108, 100)
        self.assertEqual(self.rm.check_exit(pos, 101, 95, 97, 1)[0], "stop-loss")
        pos = Position("X", 1, 100, 96, 108, 100)
        self.assertEqual(self.rm.check_exit(pos, 109, 99, 108, 1)[0], "take-profit")

    def test_config_rejects_reckless_risk(self):
        cfg = load_config(None)
        cfg["risk"]["risk_per_trade"] = 0.2
        with self.assertRaises(ValueError):
            validate(cfg)


class TestEngine(unittest.TestCase):
    def test_backtest_runs_and_respects_drawdown(self):
        cfg = load_config(None)
        res = backtest.run(cfg, {"AAA": data.synthetic(3000, seed=3)})
        self.assertGreater(res["nb_trades"], 0)
        # le coupe-circuit à 15 % + un écart d'exécution raisonnable
        self.assertGreater(res["drawdown_max"], -0.20)

    def test_no_buy_in_downtrend(self):
        cfg = load_config(None)
        idx = pd.date_range("2025-01-01", periods=400, freq="h", tz="UTC")
        close = pd.Series([1000 - i for i in range(400)], index=idx, dtype=float)
        df = pd.DataFrame({"open": close + 0.5, "high": close + 1, "low": close - 1, "close": close,
                           "volume": 1.0, "close_time": idx})
        df = strategy.add_indicators(df, cfg["strategy"])
        self.assertNotEqual(strategy.evaluate(df, cfg["strategy"]).action, "BUY")

    def test_paper_broker_accounts_fees(self):
        b = PaperBroker(1000, 0.001, slippage=0)
        qty, _ = b.buy("X", 1, 100)
        b.sell("X", qty, 100)
        self.assertLess(b.get_cash(), 1000)
        self.assertAlmostEqual(b.get_cash(), 1000 - 100 * 0.001 - 100 * 0.001, places=6)


class TestObjectif(unittest.TestCase):
    def _uptrend(self, n=800):
        import numpy as np
        idx = pd.date_range("2025-01-01", periods=n, freq="h", tz="UTC")
        rng = np.random.default_rng(1)
        close = pd.Series(100 * np.exp(np.cumsum(0.002 + 0.004 * rng.standard_normal(n))), index=idx)
        return pd.DataFrame({"open": close.shift(1).fillna(100), "high": close * 1.003,
                             "low": close * 0.997, "close": close, "volume": 1.0,
                             "close_time": idx + pd.Timedelta(minutes=59)})

    def test_stops_when_target_reached(self):
        cfg = load_config(None)
        cfg["objectif_gain"] = 20
        res = backtest.run(cfg, {"AAA": self._uptrend()})
        self.assertTrue(res["objectif_atteint"])
        self.assertGreaterEqual(res["capital_final"] - 1000, 20)
        self.assertLess(len(res["equity"]), 800 - strategy.warmup(cfg["strategy"]))  # arrêt avant la fin

    def test_target_disabled_with_zero(self):
        cfg = load_config(None)
        cfg["objectif_gain"] = 0
        res = backtest.run(cfg, {"AAA": self._uptrend()})
        self.assertFalse(res["objectif_atteint"])

    def test_new_cycle_after_restart(self):
        cfg = load_config(None)
        eng = Engine(cfg, PaperBroker(1500, cfg["fees"]),
                     RiskState(peak_equity=1500, cycle_start_equity=1000, target_reached=True, halted=True))
        eng.start_new_cycle()
        st = eng.risk.state
        self.assertFalse(st.target_reached or st.halted)
        self.assertEqual(st.cycle_start_equity, 1500)
        self.assertEqual(eng.gain(), 0)


class TestConfig(unittest.TestCase):
    def test_reads_config_without_pyyaml(self):
        cfg = parse_yaml("mode: paper  # commentaire\nsymbols: [BTCUSDT, ETHUSDT]\n"
                         "objectif_gain: 12000\nrisk:\n  risk_per_trade: 0.01\n  max_drawdown: 0.15\n")
        self.assertEqual(cfg["symbols"], ["BTCUSDT", "ETHUSDT"])
        self.assertEqual(cfg["objectif_gain"], 12000)
        self.assertEqual(cfg["risk"]["risk_per_trade"], 0.01)

    def test_shipped_config_loads(self):
        import os
        path = os.path.join(os.path.dirname(__file__), "..", "config.yaml")
        self.assertEqual(load_config(path)["objectif_gain"], 12000)


if __name__ == "__main__":
    unittest.main()
