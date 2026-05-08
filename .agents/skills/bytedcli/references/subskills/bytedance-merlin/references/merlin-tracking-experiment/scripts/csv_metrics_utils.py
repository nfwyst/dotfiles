#!/usr/bin/env python3
import argparse
import csv
import sys
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Set


def _read_rows(path: Path, delimiter: str, encoding: str) -> Iterable[Dict[str, str]]:
    with open(path, "r", encoding=encoding, newline="") as f:
        reader = csv.DictReader(f, delimiter=delimiter)
        if not reader.fieldnames:
            raise RuntimeError(f"CSV has no header: {path}")
        for row in reader:
            yield row


def _write_rows(path: Path, rows: Sequence[Dict[str, str]], fieldnames: Sequence[str], delimiter: str, encoding: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding=encoding, newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(fieldnames), delimiter=delimiter)
        writer.writeheader()
        for row in rows:
            writer.writerow({k: row.get(k, "") for k in fieldnames})


def cmd_select(args: argparse.Namespace) -> int:
    src = Path(args.input)
    cols = [c.strip() for c in args.columns.split(",") if c.strip()]
    if not cols:
        raise RuntimeError("--columns is empty")

    rows_out: List[Dict[str, str]] = []
    for row in _read_rows(src, delimiter=args.delimiter, encoding=args.encoding):
        rows_out.append({c: row.get(c, "") for c in cols})

    _write_rows(Path(args.out), rows_out, fieldnames=cols, delimiter=args.delimiter, encoding=args.encoding)
    return 0


def cmd_concat(args: argparse.Namespace) -> int:
    inputs = [Path(p) for p in args.inputs]
    all_fieldnames: List[str] = []
    field_set: Set[str] = set()

    rows_out: List[Dict[str, str]] = []
    for p in inputs:
        with open(p, "r", encoding=args.encoding, newline="") as f:
            reader = csv.DictReader(f, delimiter=args.delimiter)
            if not reader.fieldnames:
                raise RuntimeError(f"CSV has no header: {p}")
            for fn in reader.fieldnames:
                if fn not in field_set:
                    field_set.add(fn)
                    all_fieldnames.append(fn)
            for row in reader:
                row2 = dict(row)
                row2[args.run_column] = p.stem
                rows_out.append(row2)

    out_fieldnames = [args.run_column] + [f for f in all_fieldnames if f != args.run_column]
    _write_rows(Path(args.out), rows_out, fieldnames=out_fieldnames, delimiter=args.delimiter, encoding=args.encoding)
    return 0


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Small CSV utilities for metrics analysis.")
    parser.add_argument("--delimiter", default=",", help="CSV delimiter (default: ,)")
    parser.add_argument("--encoding", default="utf-8", help="file encoding (default: utf-8)")

    sub = parser.add_subparsers(dest="cmd", required=True)

    p_select = sub.add_parser("select", help="select columns and output a smaller CSV")
    p_select.add_argument("input", help="input CSV path")
    p_select.add_argument("--columns", required=True, help="comma separated column names to keep")
    p_select.add_argument("--out", required=True, help="output CSV path")
    p_select.set_defaults(func=cmd_select)

    p_concat = sub.add_parser("concat", help="concat multiple CSVs and add a run column")
    p_concat.add_argument("inputs", nargs="+", help="input CSV paths")
    p_concat.add_argument("--run-column", default="run", help="run column name (default: run)")
    p_concat.add_argument("--out", required=True, help="output CSV path")
    p_concat.set_defaults(func=cmd_concat)

    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())

