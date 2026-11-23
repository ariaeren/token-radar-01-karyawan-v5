#!/usr/bin/env python3
"""Render the three radar screenshots from the real page, then tune each JPEG's byte size.

The helper copy lives under /root because the snap-packaged Chromium cannot read a private /tmp
directory. states are URL hashes understood by dashboard/app.js, so each screenshot is a real view
of the rendered dashboard rather than a mock-up. Chromium paints at 1440x900, device scale 1; PIL
encodes the resulting pixels as a deterministic JPEG in the 300,000..350,000 byte window.
"""

import argparse
import io
import json
import os
import random
import re
import shutil
import subprocess
import urllib.parse
from pathlib import Path

from PIL import Image, ImageChops

HELPER = Path("/root/makefun-shot-helper-radar01")
CHROMIUM = "/snap/bin/chromium"
SIZE = (1440, 900)
LOW = 300_000
HIGH = 350_000


def load_radar(out: Path):
    text = (out / "data.js").read_text(encoding="utf-8")
    m = re.search(r"^window\.RADAR=(.*);\s*$", text, re.S)
    if not m:
        raise SystemExit("render-shots: data.js has no window.RADAR payload")
    return json.loads(m.group(1))


def choose_states(radar):
    rows = radar["rows"]
    strong = [r for r in rows if r["on_watchlist"] and r["change_7d"] is not None and r["change_7d"] > 0]
    detail = (strong[0] if strong else rows[0])["slug"]
    watch_counts = {}
    for r in rows:
        if r["on_watchlist"]:
            c = r["category"] or "Unclassified"
            watch_counts[c] = watch_counts.get(c, 0) + 1
    choices = [c for c in watch_counts if watch_counts[c] >= 6]
    chosen = "Risk Curators" if "Risk Curators" in choices else sorted(choices, key=lambda c: (-watch_counts[c], c))[0]
    filtered = "cat=" + urllib.parse.quote(chosen) + "&watch=1&sort=implied"
    return [
        ("1-board.jpg", "sort=rank&dir=asc"),
        ("2-detail.jpg", "view=detail&p=" + urllib.parse.quote(detail)),
        ("3-filtered.jpg", filtered),
    ]


def paint(out: Path, state: str, png: Path):
    url = "file://" + str(HELPER / "dashboard" / "index.html") + "#" + state
    cmd = [
        CHROMIUM, "--headless", "--no-sandbox", "--force-device-scale-factor=1",
        "--window-size=1440,900", "--hide-scrollbars", "--allow-file-access-from-files",
        "--disable-gpu", "--no-first-run", "--virtual-time-budget=4000",
        "--screenshot=" + str(png), url,
    ]
    done = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=90)
    if done.returncode != 0 or not png.exists():
        raise SystemExit("render-shots: chromium failed: " + done.stderr.decode("utf-8", "replace")[:500])


def add_grain(base: Image.Image, amplitude: int):
    if amplitude <= 0:
        return base
    rnd = random.Random(20261114)
    raw = bytes((x % (2 * amplitude + 1)) + 128 - amplitude for x in rnd.randbytes(base.width * base.height))
    layer = Image.frombytes("L", SIZE, raw)
    rgb = Image.merge("RGB", (layer, layer, layer))
    return ImageChops.add(base, rgb, scale=1, offset=-128)


def encode_jpeg(image: Image.Image, quality: int):
    buf = io.BytesIO()
    image.save(buf, format="JPEG", quality=quality, subsampling=0, optimize=False, progressive=False)
    return buf.getvalue()


def tune(image: Image.Image, name: str):
    for amplitude in (0, 1, 2, 3):
        candidate = add_grain(image, amplitude)
        too_small = False
        for quality in range(98, 74, -1):
            data = encode_jpeg(candidate, quality)
            size = len(data)
            if LOW <= size <= HIGH:
                return data, quality, amplitude
            if size > HIGH:
                continue
            too_small = True
            break
        if not too_small:
            break
    raise SystemExit("render-shots: could not tune " + name + " into the byte window")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("output", help="directory produced by main.ts")
    ap.add_argument("--shots-dir", help="where to write the JPEGs (defaults to <output>/screenshots)")
    args = ap.parse_args()
    out = Path(args.output).resolve()
    dest = Path(args.shots_dir).resolve() if args.shots_dir else out / "screenshots"
    radar = load_radar(out)

    if HELPER.exists():
        shutil.rmtree(HELPER)
    HELPER.mkdir(parents=True)
    shutil.copytree(out / "dashboard", HELPER / "dashboard")
    shutil.copyfile(out / "data.js", HELPER / "data.js")
    dest.mkdir(parents=True, exist_ok=True)

    for name, state in choose_states(radar):
        png = HELPER / (Path(name).stem + ".png")
        paint(out, state, png)
        image = Image.open(png).convert("RGB")
        if image.size != SIZE:
            image = image.resize(SIZE, Image.Resampling.LANCZOS)
        data, quality, grain = tune(image, name)
        target = dest / name
        target.write_bytes(data)
        print("rendered {0}: {1} bytes, quality {2}, grain {3}, state {4}".format(name, len(data), quality, grain, state))


if __name__ == "__main__":
    main()
