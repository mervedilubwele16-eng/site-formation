"""Ligne de commande :  python -m agent_trading <commande>"""
from __future__ import annotations

import argparse
import json
import sys

from . import backtest, data, strategy
from .config import load_config


def main(argv=None):
    ap = argparse.ArgumentParser(prog="agent_trading", description="Agent de trading automatique")
    ap.add_argument("-c", "--config", default="config.yaml")
    sub = ap.add_subparsers(dest="cmd", required=True)

    b = sub.add_parser("backtest", help="tester la stratégie sur l'historique")
    b.add_argument("--bars", type=int, default=5000, help="nombre de bougies d'historique")
    b.add_argument("--demo", action="store_true", help="utiliser un marché simulé (hors ligne)")

    sub.add_parser("analyse", help="afficher l'analyse actuelle du marché, sans trader")

    r = sub.add_parser("run", help="lancer l'agent en continu")
    r.add_argument("--live", action="store_true", help="trader avec de l'argent réel")

    sub.add_parser("statut", help="afficher l'état de l'agent")
    args = ap.parse_args(argv)
    cfg = load_config(args.config)

    if args.cmd == "backtest":
        if args.demo:
            series = {s: data.synthetic(args.bars, seed=i + 1, start_price=100 * (i + 1))
                      for i, s in enumerate(cfg["symbols"])}
        else:
            series = {s: data.fetch_history(s, cfg["interval"], args.bars) for s in cfg["symbols"]}
        res = backtest.run(cfg, series)
        backtest.print_report(res)
        for t in res["trades"][-10:]:
            print(f"  {t['symbol']:9} {t['exit_time'][:16]}  {t['pct']:+7.2%}  {t['reason']}")

    elif args.cmd == "analyse":
        p = cfg["strategy"]
        for s in cfg["symbols"]:
            df = strategy.add_indicators(data.closed_only(
                data.fetch_klines(s, cfg["interval"], strategy.warmup(p) + 50)), p)
            sig = strategy.evaluate(df, p)
            last = df.iloc[-1]
            print(f"\n{s} — prix {sig.price:.2f} — décision : {sig.action} (score {sig.score}/4)")
            print(f"  RSI {last['rsi']:.1f} | volatilité (ATR) {sig.atr / sig.price:.2%}")
            for reason in sig.reasons:
                print(f"  ✓ {reason}")

    elif args.cmd == "run":
        if args.live:
            cfg["mode"] = "live"
        if cfg["mode"] == "live":
            print("⚠️  MODE RÉEL : l'agent va passer des ordres avec votre argent.")
            if input("Tapez exactement « JE COMPRENDS LES RISQUES » pour continuer : ").strip() \
                    != "JE COMPRENDS LES RISQUES":
                print("Annulé.")
                sys.exit(1)
        from .agent import Agent, setup_logging
        setup_logging(cfg["log_file"])
        Agent(cfg).run()

    elif args.cmd == "statut":
        try:
            with open(cfg["state_file"], encoding="utf-8") as f:
                print(json.dumps(json.load(f), indent=2, ensure_ascii=False))
        except FileNotFoundError:
            print("Aucun état enregistré : l'agent n'a pas encore tourné.")


if __name__ == "__main__":
    main()
