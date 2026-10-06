#!/usr/bin/env python3
"""Train DriveLab's optional synthetic-only motion predictor and print measured JSON."""
import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from drivelab.forecast import DEFAULT_CHECKPOINT, train_model


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_CHECKPOINT)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--epochs", type=int, default=100)
    args = parser.parse_args()
    print(json.dumps(train_model(args.output, seed=args.seed, epochs=args.epochs), indent=2))


if __name__ == "__main__":
    main()
