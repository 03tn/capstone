#!/usr/bin/env python3
"""Download and verify the official CUAD v1 archive for offline evaluation."""

from __future__ import annotations

import argparse
import hashlib
import pathlib
import urllib.request

URL = "https://zenodo.org/records/4595826/files/CUAD_v1.zip?download=1"
EXPECTED_MD5 = "c38f490a984420b8a62600db401fafd5"


def md5(path: pathlib.Path) -> str:
    digest = hashlib.md5(usedforsecurity=False)
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output",
        type=pathlib.Path,
        default=pathlib.Path("evaluation/data/CUAD_v1.zip"),
    )
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    if not args.output.exists():
        print(f"Downloading CUAD v1 to {args.output}...")
        urllib.request.urlretrieve(URL, args.output)
    actual = md5(args.output)
    if actual != EXPECTED_MD5:
        raise SystemExit(
            f"Checksum mismatch: expected {EXPECTED_MD5}, received {actual}. "
            "Delete the file and download it again."
        )
    print(f"Verified {args.output} ({actual})")


if __name__ == "__main__":
    main()
