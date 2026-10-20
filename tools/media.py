#!/usr/bin/env python3
"""Prépare les images du site (nécessite Pillow : pip install pillow).

    python3 tools/media.py

1. Télécharge les photos Instagram sélectionnées dans l'admin (src/content/instagram.json)
   vers src/media/ig-<id>.jpg, tant que leur lien Instagram est encore valide.
2. Convertit chaque original de src/media/ en WebP 480/800/1200 px dans src/assets/img/.
3. Réécrit src/assets/img/manifest.json (largeurs et ratio de chaque image), lu par build.py.
"""
from __future__ import annotations

import json
import re
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
MEDIA = ROOT / "src" / "media"
IMG = ROOT / "src" / "assets" / "img"
INSTAGRAM = ROOT / "src" / "content" / "instagram.json"
WIDTHS = (480, 800, 1200)


def download_instagram() -> None:
    if not INSTAGRAM.exists():
        return
    data = json.loads(INSTAGRAM.read_text(encoding="utf-8"))
    for post in data.get("posts", []):
        target = MEDIA / f"ig-{post['id']}.jpg"
        if target.exists():
            continue
        url = post.get("thumbnail_url") if post.get("media_type") == "VIDEO" else post.get("media_url")
        url = url or post.get("media_url") or post.get("thumbnail_url")
        if not url:
            continue
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "liv-curty-site"}), timeout=30) as r:
                raw = r.read()
            MEDIA.mkdir(parents=True, exist_ok=True)
            tmp = target.with_suffix(".tmp")
            tmp.write_bytes(raw)
            with Image.open(tmp) as im:
                ImageOps.exif_transpose(im).convert("RGB").save(target, "JPEG", quality=88)
            tmp.unlink()
            print(f"Instagram : {target.name} téléchargée")
        except Exception as exc:  # lien expiré, réseau…
            print(f"Instagram : impossible de télécharger {post['id']} ({exc}). Re-sélectionnez la photo dans l'admin.", file=sys.stderr)


def convert_originals() -> None:
    if not MEDIA.exists():
        return
    for src in sorted(MEDIA.iterdir()):
        if src.suffix.lower() not in (".jpg", ".jpeg", ".png", ".webp"):
            continue
        name = re.sub(r"[^a-z0-9-]+", "-", src.stem.lower()).strip("-")
        with Image.open(src) as im:
            im = ImageOps.exif_transpose(im).convert("RGB")
            widths = sorted({w for w in WIDTHS if w < im.width} | {min(im.width, WIDTHS[-1])})
            for w in widths:
                out = IMG / f"{name}-{w}.webp"
                if out.exists() and out.stat().st_mtime >= src.stat().st_mtime:
                    continue
                im.resize((w, round(im.height * w / im.width)), Image.LANCZOS).save(out, "WEBP", quality=78, method=6)
                print(f"{out.relative_to(ROOT)}")


def write_manifest() -> None:
    groups: dict[str, list[int]] = {}
    for f in IMG.glob("*.webp"):
        m = re.match(r"(.+)-(\d+)$", f.stem)
        if m:
            groups.setdefault(m.group(1), []).append(int(m.group(2)))
    manifest = {}
    for name, widths in sorted(groups.items()):
        widths.sort()
        with Image.open(IMG / f"{name}-{widths[-1]}.webp") as im:
            manifest[name] = {"widths": widths, "ratio": round(im.height / im.width, 4)}
    (IMG / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"manifest.json : {len(manifest)} images")


if __name__ == "__main__":
    download_instagram()
    convert_originals()
    write_manifest()
