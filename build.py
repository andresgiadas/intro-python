#!/usr/bin/env python3
"""Génère le site statique Liv Curty.

    python3 build.py                 -> écrit le site dans docs/ (prêt pour GitHub Pages)
    python3 build.py --preview DIR   -> variante d'aperçu (Artifact claude.ai) dans DIR

Aucune dépendance : uniquement la bibliothèque standard de Python 3.9+.
Pour ajouter un article, créez un fichier dans src/content/blog/ (voir README.md).
"""
from __future__ import annotations

import argparse
import html
import json
import math
import re
import shutil
from datetime import date, datetime
from pathlib import Path
from urllib.parse import urlparse

# --------------------------------------------------------------------------
# Réglages du site
# --------------------------------------------------------------------------

# Adresse publique du site, sans « / » final. À remplacer par le nom de domaine
# définitif (ex. https://www.livcurty.ch) puis relancer le build.
SITE_URL = "https://andresgiadas.github.io/intro-python"
SITE_UPDATED = "2026-10-20"
HOSTING = "GitHub Pages (GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis)"


ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
ASSETS = SRC / "assets"
BLOG_SRC = SRC / "content" / "blog"

# Photos (WebP générées dans src/assets/img) : largeurs disponibles et ratio hauteur/largeur
IMAGES = {
    "liv-curty-portrait": ([480, 563], 1000 / 563),
    "conseil-en-image-blazer": ([480, 800, 1200], 1805 / 1205),
    "style-tailleur-orange": ([480, 800, 1200], 1800 / 1200),
    "lookbook-digital-tablette": ([480, 800, 1200], 1577 / 1226),
    "colorimetrie-nuanciers": ([480, 681], 1024 / 681),
    "manteau-rouge": ([480, 800, 1200], 1828 / 1249),
}
# Clés courtes utilisées dans les articles
PHOTO_KEYS = {
    "blazer": "conseil-en-image-blazer",
    "orange": "style-tailleur-orange",
    "lookbook": "lookbook-digital-tablette",
    "colorimetrie": "colorimetrie-nuanciers",
    "redcoat": "manteau-rouge",
    "portrait": "liv-curty-portrait",
}

MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
          "août", "septembre", "octobre", "novembre", "décembre"]

# --------------------------------------------------------------------------
# Contenus modifiables depuis l'admin : src/content/settings.json
# --------------------------------------------------------------------------

def load_settings() -> tuple[dict, dict, list[dict], list[tuple[str, str]]]:
    data = json.loads((SRC / "content" / "settings.json").read_text(encoding="utf-8"))
    c = data["contact"]
    brand = {**c, "phone_href": re.sub(r"[^\d+]", "", c["phone"])}
    services = []
    for raw in data["services"]:
        svc = dict(raw)
        svc["prices"] = [(p["amount"], p.get("label", "")) for p in raw["prices"]]
        svc["steps"] = [(x["title"], x["text"]) for x in raw.get("steps", [])]
        svc["faq"] = [(x["q"], x["a"]) for x in raw.get("faq", [])]
        services.append(svc)
    return data, brand, services, [(x["q"], x["a"]) for x in data.get("home_faq", [])]


SETTINGS, BRAND, SERVICES, HOME_FAQ = load_settings()
SERVICE_BY_SLUG = {s["slug"]: s for s in SERVICES}

_manifest = ASSETS / "img" / "manifest.json"
if _manifest.exists():  # images ajoutées depuis l'admin (générées par tools/media.py)
    IMAGES.update({k: (v["widths"], v["ratio"]) for k, v in json.loads(_manifest.read_text(encoding="utf-8")).items()})

INSTAGRAM = json.loads((SRC / "content" / "instagram.json").read_text(encoding="utf-8")) \
    if (SRC / "content" / "instagram.json").exists() else {"posts": []}


def today_geneva() -> date:
    try:
        from zoneinfo import ZoneInfo
        return datetime.now(ZoneInfo("Europe/Zurich")).date()
    except Exception:
        return date.today()


TODAY = today_geneva()

# --------------------------------------------------------------------------
# Outils
# --------------------------------------------------------------------------

def esc(text: str) -> str:
    return html.escape(text, quote=True)


def fr_typo(text: str) -> str:
    """Espaces insécables de la typographie française (texte et attributs)."""
    text = re.sub(r" ([:])(?=[\s<\"]|$)", " \\1", text)
    text = re.sub(r" ([?!;])", " \\1", text)
    text = text.replace("« ", "« ").replace(" »", " »")
    return text


def format_text(formats: list[str]) -> str:
    """["En ligne", "Présentiel à Genève"] -> "En ligne ou présentiel à Genève"."""
    return " ou ".join(f if i == 0 else f[0].lower() + f[1:] for i, f in enumerate(formats))


def chf(amount: int) -> str:
    return f"CHF {amount}.–"


def fr_date(iso: str) -> str:
    d = date.fromisoformat(iso)
    return f"{d.day}{'er' if d.day == 1 else ''} {MONTHS[d.month - 1]} {d.year}"


def img(name: str, alt: str, sizes: str, *, eager: bool = False, cls: str = "") -> str:
    widths, ratio = IMAGES[name]
    srcset = ", ".join(f"~/assets/img/{name}-{w}.webp {w}w" for w in widths)
    w = widths[-1]
    attrs = [
        f'src="~/assets/img/{name}-{widths[min(1, len(widths) - 1)]}.webp"',
        f'srcset="{srcset}"',
        f'sizes="{sizes}"',
        f'width="{w}" height="{round(w * ratio)}"',
        f'alt="{esc(alt)}"',
        'decoding="async"',
        'fetchpriority="high"' if eager else 'loading="lazy"',
    ]
    if cls:
        attrs.append(f'class="{cls}"')
    return "<img " + " ".join(attrs) + ">"


def json_ld(data) -> str:
    raw = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    return f'<script type="application/ld+json">{raw}</script>'


def abs_url(path: str) -> str:
    path = path.removesuffix("index.html")
    return f"{SITE_URL}/{path}"


ICON_MAIL = '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="3" y="9" width="34" height="23"/><path d="M3 9l17 13 17-13M3 32l13-12M37 32L24 20"/></svg>'
ICON_PHONE = '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 4.5c-2.2 1.1-4.4 3.5-4 7 1 8.6 13.4 22.5 23 24.3 3 .6 5.6-1 6.8-3.3l-5.2-4.6c-.7-.6-1.7-.6-2.4 0l-2 1.8c-4.5-2-8.6-6.6-10.2-11l2-2c.6-.7.7-1.7.1-2.5L13.4 4.6c-1-1-2.6-.9-3.9-.1z"/></svg>'

# --------------------------------------------------------------------------
# Articles du blog
# --------------------------------------------------------------------------

def read_article_files() -> list[dict]:
    """Tous les fichiers d'articles, brouillons et articles programmés compris."""
    items = []
    for path in sorted(BLOG_SRC.glob("*.html")):
        raw = path.read_text(encoding="utf-8")
        m = re.match(r"\s*<!--(.*?)-->(.*)", raw, re.S)
        if not m:
            raise SystemExit(f"{path}: en-tête JSON manquant")
        items.append({"slug": path.stem, "meta": json.loads(m.group(1)), "body": m.group(2).strip()})
    return items


def is_live(meta: dict) -> bool:
    return not meta.get("draft") and date.fromisoformat(meta["date"]) <= TODAY


def load_articles() -> list[dict]:
    articles, hidden = [], 0
    for item in read_article_files():
        meta = dict(item["meta"])
        if not is_live(meta):
            hidden += 1
            continue
        meta["slug"] = item["slug"]
        meta.setdefault("updated", meta["date"])
        meta.setdefault("order", 50)
        body = render_media(item["body"].replace("{{root}}", "~/"))
        meta["body"] = body
        text = re.sub(r"<[^>]+>", " ", body)
        meta["words"] = len(text.split())
        meta["minutes"] = max(1, math.ceil(meta["words"] / 200))
        meta["toc"] = [(i, re.sub(r"<[^>]+>", "", t)) for i, t in re.findall(r'<h2 id="([^"]+)">(.*?)</h2>', body)]
        articles.append(meta)
    if hidden:
        print(f"{hidden} article(s) en brouillon ou programmé(s), non publiés")
    # Les plus récents d'abord, puis l'ordre choisi
    articles.sort(key=lambda a: (-date.fromisoformat(a["date"]).toordinal(), a["order"], a["slug"]))
    return articles


def media_key(name: str | None) -> str | None:
    """Nom d'image d'un article : clé courte historique ou nom de la médiathèque."""
    if not name:
        return None
    key = PHOTO_KEYS.get(name, name)
    return key if key in IMAGES else None


def render_media(body: str) -> str:
    """<figure class="media"><img data-media="NOM" alt="…"> → image responsive du site."""
    def fig(m):
        attrs, inner = m.group(1), m.group(2)
        name = re.search(r'data-media="([^"]+)"', inner)
        alt = re.search(r'alt="([^"]*)"', inner)
        cap = re.search(r"<figcaption>(.*?)</figcaption>", inner, re.S)
        key = media_key(name.group(1) if name else None)
        if not key:
            print(f"Image « {name.group(1) if name else '?'} » pas encore prête : ignorée")
            return ""
        ig = re.search(r'data-instagram="([^"]+)"', attrs)
        caption = cap.group(1).strip() if cap else ""
        if ig:
            caption += f' <a href="{ig.group(1)}" target="_blank" rel="noopener">Voir sur Instagram</a>'
        alt_text = html.unescape(alt.group(1)) if alt else ""
        out = f'<figure class="media"><div class="frame">{img(key, alt_text, "(max-width: 1020px) 92vw, 720px")}</div>'
        return out + (f"<figcaption>{caption.strip()}</figcaption>" if caption.strip() else "") + "</figure>"
    return re.sub(r'<figure class="media"([^>]*)>(.*?)</figure>', fig, body, flags=re.S)


def cover(serif: str, script: str, cls: str = "") -> str:
    return (f'<div class="cover {cls}" aria-hidden="true" style="--len:{max(len(serif), 4)}">'
            f'<span class="cover-word">{esc(serif)}</span>'
            f'<span class="cover-script">{esc(script)}</span></div>')


def article_card(a: dict, *, featured: bool = False, heading: str = "h3") -> str:
    href = f"~/blog/{a['slug']}/"
    text = (f'<div class="card-text"><p class="card-meta"><span>{esc(a["category"])}</span><span>{a["minutes"]} min de lecture</span></p>'
            f'<{heading}>{esc(a["title"])}</{heading}><p>{esc(a["excerpt"])}</p>'
            f'<span class="link-arrow">Lire l’article</span></div>')
    return (f'<a class="card{" card--featured" if featured else ""}" href="{href}">'
            f'{cover(*a["cover"])}{text}</a>')


# --------------------------------------------------------------------------
# Gabarit commun
# --------------------------------------------------------------------------

NAV = [("À propos", "#a-propos"), ("Services", "#services"), ("Tarifs", "#tarifs"), ("Blog", "blog/")]


def header(is_home: bool, current: str | None) -> str:
    items = []
    for label, target in NAV:
        href = target if (is_home and target.startswith("#")) else f"~/{target}"
        cur = ' aria-current="page"' if current == target else ""
        items.append(f'<li><a href="{href}"{cur}>{label}</a></li>')
    cur = ' aria-current="page"' if current == "reservation/" else ""
    items.append(f'<li><a class="btn btn--small" href="~/reservation/"{cur}>Réserver</a></li>')
    return f"""<a class="skip" href="#contenu">Aller au contenu</a>
{banner()}<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="~/" aria-label="Liv Curty, accueil"><img src="~/assets/logo.svg" alt="Liv Curty" width="572" height="204"></a>
    <nav class="nav" aria-label="Navigation principale">
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="menu"><span class="bars" aria-hidden="true"></span><span class="nav-toggle-label">Menu</span></button>
      <ul id="menu">{''.join(items)}</ul>
    </nav>
  </div>
</header>"""


def footer(articles: list[dict]) -> str:
    services = "".join(f'<li><a href="~/services/{s["slug"]}/">{esc(s["name"])}</a></li>' for s in SERVICES)
    posts = "".join(f'<li><a href="~/blog/{a["slug"]}/">{esc(a["seo_title"])}</a></li>' for a in articles[:4])
    year = SITE_UPDATED[:4]
    return f"""<footer class="site-footer">
  <div class="wrap">
    <div class="footer-grid">
      <div class="footer-brand">
        <img src="~/assets/logo.svg" alt="Liv Curty" width="572" height="204" loading="lazy">
        <p>Conseil en image &amp; style à Genève et en ligne. Une approche bienveillante, sans jugement ni recettes toutes faites.</p>
      </div>
      <div class="footer-col"><h2>Services</h2><ul>{services}<li><a href="~/#tarifs">Tarifs</a></li><li><a href="~/reservation/">Réserver une séance</a></li></ul></div>
      <div class="footer-col"><h2>Blog</h2><ul>{posts}<li><a href="~/blog/">Tous les articles</a></li></ul></div>
      <div class="footer-col"><h2>Contact</h2><ul>
        <li><a href="mailto:{BRAND['email']}">{BRAND['email']}</a></li>
        <li><a href="tel:{BRAND['phone_href']}">{BRAND['phone']}</a></li>
        <li>Genève, Suisse</li>
      </ul></div>
    </div>
    <div class="footer-bottom">
      <p>© {year} Liv Curty · Olivia Curty</p>
      <p><a href="~/mentions-legales/">Mentions légales &amp; confidentialité</a> · <a href="~/admin/" rel="nofollow">Espace admin</a></p>
    </div>
  </div>
</footer>"""


def internal(link: str) -> str:
    """Lien saisi dans l'admin : interne (relatif à la racine) ou externe."""
    if re.match(r"^(https?:|mailto:|tel:|#)", link):
        return link
    return "~/" + link.lstrip("/")


def banner() -> str:
    b = SETTINGS.get("banner") or {}
    if not (b.get("active") and b.get("text")):
        return ""
    link = f' <a href="{esc(internal(b["link"]))}">{esc(b.get("link_label") or "En savoir plus")}</a>' if b.get("link") else ""
    return f'<div class="banner"><p class="wrap">{esc(b["text"])}{link}</p></div>\n'


def instagram_posts(limit: int = 8) -> list[dict]:
    return [p for p in INSTAGRAM.get("posts", []) if p.get("show_on_home") and f"ig-{p['id']}" in IMAGES][:limit]


def instagram_section() -> str:
    conf = SETTINGS.get("instagram") or {}
    posts = instagram_posts()
    if not (conf.get("show_on_home", True) and posts):
        return ""
    user = conf.get("username") or INSTAGRAM.get("username") or ""
    follow = (f'<p><a class="link-arrow" href="https://www.instagram.com/{esc(user)}/" target="_blank" rel="noopener">Suivre @{esc(user)}</a></p>'
              if user else "")
    tiles = []
    for p in posts:
        photo = img(f"ig-{p['id']}", p.get("alt") or "Publication Instagram de Liv Curty", "(max-width: 600px) 46vw, 280px")
        tiles.append(f'<li><a href="{esc(p["permalink"])}" target="_blank" rel="noopener"><div class="frame">{photo}</div>'
                     '<span class="visually-hidden">Voir la publication sur Instagram</span></a></li>')
    return f"""<section class="section section--tight insta" aria-labelledby="ig-title">
  <div class="wrap">
    <div class="section-head"><h2 class="section-title" id="ig-title">{esc(conf.get("home_title") or "Sur Instagram")}</h2>{follow}</div>
    <ul class="insta-grid" style="--cols:{len(tiles) if len(tiles) <= 4 else 3 if len(tiles) <= 6 else 4}">{"".join(tiles)}</ul>
  </div>
</section>"""


def breadcrumbs(items: list[tuple[str, str | None]]) -> tuple[str, dict]:
    lis, elements = [], []
    for pos, (label, href) in enumerate(items, 1):
        if href is not None:
            lis.append(f'<li><a href="~/{href}">{esc(label)}</a></li>')
        else:
            lis.append(f'<li aria-current="page">{esc(label)}</li>')
        el = {"@type": "ListItem", "position": pos, "name": label}
        if href is not None:
            el["item"] = abs_url(href)
        elements.append(el)
    nav = f'<nav class="crumbs wrap" aria-label="Fil d’Ariane"><ol>{"".join(lis)}</ol></nav>'
    return nav, {"@type": "BreadcrumbList", "itemListElement": elements}


def faq_block(items: list[tuple[str, str]]) -> str:
    rows = "".join(f'<details><summary>{esc(q)}</summary><div class="answer"><p>{esc(a)}</p></div></details>' for q, a in items)
    return f'<div class="faq">{rows}</div>'


def faq_schema(items: list[tuple[str, str]]) -> dict:
    return {"@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in items]}


def business_ref() -> dict:
    return {"@id": f"{SITE_URL}/#business"}


# Aperçu claude.ai : le visualiseur conserve la position de défilement d'une page à l'autre.
# On remet chaque nouvelle page en haut (sauf lien vers une section #ancre ou rechargement).
PREVIEW_SCROLL_TOP = (
    "(function(){try{if(location.hash)return;"
    "var n=performance.getEntriesByType&&performance.getEntriesByType('navigation')[0];"
    "if(n&&n.type==='reload')return;"
    "if('scrollRestoration' in history)history.scrollRestoration='manual';"
    "var stop=false,top=function(){if(!stop)window.scrollTo(0,0);};"
    "['wheel','touchstart','keydown','mousedown'].forEach(function(e){addEventListener(e,function(){stop=true;},{once:true,passive:true});});"
    "top();addEventListener('DOMContentLoaded',top);"
    "addEventListener('load',function(){top();[60,200,500,900].forEach(function(t){setTimeout(top,t);});});"
    "}catch(e){}})();"
)


class Site:
    def __init__(self, out: Path, preview: bool):
        self.out = out
        self.preview = preview
        self.pages: list[tuple[str, str]] = []  # (chemin, lastmod) pour le sitemap
        self.css = (ASSETS / "css" / "fonts.css").read_text(encoding="utf-8") + "\n" + (ASSETS / "css" / "main.css").read_text(encoding="utf-8")
        self.js = (ASSETS / "js" / "main.js").read_text(encoding="utf-8")

    def og_image(self, slug: str | None) -> str:
        if slug and (ASSETS / "og" / f"{slug}.jpg").exists():
            return f"assets/og/{slug}.jpg"
        return "assets/og/default.jpg"

    def render(self, *, path: str, title: str, description: str, body: str, schema: list[dict] | None = None,
               og_slug: str | None = None, og_type: str = "website", noindex: bool = False,
               lastmod: str = SITE_UPDATED, preload: str | None = None, root: str | None = None,
               extra_meta: str = "", extra_js: tuple[str, ...] = ()) -> None:
        if self.preview and path == "index.html":
            title = "Liv Curty"  # nom de l'aperçu dans la galerie claude.ai
        depth = path.count("/")
        if root is None:
            root = "../" * depth or "./"
        canonical = abs_url(path)
        og = f"{SITE_URL}/{self.og_image(og_slug)}"
        graph = {"@context": "https://schema.org", "@graph": schema or []}

        if self.preview:
            styles = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
                      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
                      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz@6..96&amp;family=Mrs+Saint+Delafield&amp;family=Parkinsans:wght@300..700&amp;display=swap">'
                      "<style>@@CSS@@</style>")
            script = (f"<script>{PREVIEW_SCROLL_TOP}</script><script>@@JS@@</script>"
                      + "".join(f"<script>@@JS:{n}@@</script>" for n in extra_js))
        else:
            styles = ('<link rel="preload" href="~/assets/fonts/parkinsans-latin.woff2" as="font" type="font/woff2" crossorigin>'
                      '<link rel="stylesheet" href="~/assets/css/site.css">')
            script = "".join(f'<script src="~/assets/js/{n}" defer></script>' for n in ("main.js", *extra_js))

        head = f"""<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{esc(title)}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="{esc(description)}">
<meta name="robots" content="{'noindex, follow' if noindex else 'index, follow, max-image-preview:large'}">
<link rel="canonical" href="{canonical}">
<link rel="alternate" hreflang="fr-CH" href="{canonical}">
<meta name="theme-color" content="#F7F1EE">
<meta name="author" content="{BRAND['person']}">
<meta property="og:type" content="{og_type}">
<meta property="og:locale" content="fr_CH">
<meta property="og:site_name" content="Liv Curty">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(description)}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
{extra_meta}<link rel="icon" href="~/assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="~/assets/apple-touch-icon.png">
{f'<link rel="preload" as="image" href="~/assets/img/{preload}-480.webp" imagesrcset="' + ", ".join(f"~/assets/img/{preload}-{w}.webp {w}w" for w in IMAGES[preload][0]) + '" imagesizes="(max-width: 860px) 78vw, 420px" fetchpriority="high">' if preload else ''}
{styles}
{json_ld(graph) if schema else ''}"""

        page_body = f'{body}\n{script}'
        if self.preview and path == "index.html":
            doc = f"{head}\n{page_body}"  # la page principale d'un Artifact reçoit son propre squelette
        else:
            doc = f'<!doctype html>\n<html lang="fr-CH">\n<head>\n{head}\n</head>\n<body>\n{page_body}\n</body>\n</html>\n'

        doc = fr_typo(doc).replace("~/", root)
        if self.preview:
            doc = self._explicit_index(doc)
            doc = doc.replace("@@CSS@@", self._preview_css()).replace("@@JS@@", self.js)
            for n in extra_js:
                doc = doc.replace(f"@@JS:{n}@@", (ASSETS / "js" / n).read_text(encoding="utf-8"))
        target = self.out / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(re.sub(r"\n{3,}", "\n\n", doc), encoding="utf-8")
        if not noindex:
            self.pages.append((path, lastmod))

    def _preview_css(self) -> str:
        css = re.sub(r"@font-face\s*\{.*?\}", "", self.css, flags=re.S)
        return css.replace("../img/", "assets/img/")

    @staticmethod
    def _explicit_index(doc: str) -> str:
        """Dans l'aperçu, les liens vers un dossier pointent vers son index.html."""
        def fix(m):
            url = m.group(1)
            if re.match(r"^(https?:|mailto:|tel:|#|data:)", url):
                return m.group(0)
            path, sep, frag = url.partition("#")
            if path in ("", "./"):
                path = "index.html"
            elif path.endswith("/"):
                path += "index.html"
            return f'href="{path}{sep}{frag}"'
        return re.sub(r'href="([^"]*)"', fix, doc)


# --------------------------------------------------------------------------
# Pages
# --------------------------------------------------------------------------

def page_home(site: Site, articles: list[dict]) -> None:
    portrait = img("liv-curty-portrait", "Olivia Curty, conseillère en image et style à Genève", "(max-width: 860px) 78vw, 420px", eager=True)

    service_rows = []
    for s in SERVICES:
        prices = " · ".join(f'{chf(p)}{f" <small>{esc(l)}</small>" if l else ""}' for p, l in s["prices"])
        fmt = ' <span class="sep">|</span> '.join(esc(f) for f in s["format"])
        included = "".join(f"<li>{esc(i)}</li>" for i in s["included"])
        service_rows.append(f"""
    <article class="service">
      <div class="service-media"><a href="~/services/{s['slug']}/" tabindex="-1" aria-hidden="true"><div class="frame">{img(s['image'], s['image_alt'], '(max-width: 860px) 92vw, 460px')}</div></a></div>
      <div class="service-body">
        <div class="service-top">
          <h3><a href="~/services/{s['slug']}/">{esc(s['name'])}</a></h3>
          <p class="meta"><span><b>Format :</b> {fmt}</span><span><b>Durée :</b> {esc(s['duration'])}</span></p>
        </div>
        <p>{esc(s['lead'])}</p>
        <div><p class="included-label">Inclus :</p><ul class="dots">{included}</ul></div>
        <div class="service-foot"><p class="price">{prices}</p><a class="link-arrow" href="~/services/{s['slug']}/">Découvrir la prestation</a></div>
      </div>
    </article>""")

    price_items = []
    for s in sorted(SERVICES, key=lambda s: s["prices"][0][0]):
        amounts = "".join(f'<span class="line"><b>{chf(p)}</b>{f" <span>· {esc(l)}</span>" if l else ""}</span>' for p, l in s["prices"])
        fmt = format_text(s["format"])
        price_items.append(f'<li><h3><a href="~/services/{s["slug"]}/">{esc(s["name"])}</a></h3>'
                           f'<p class="amount">{amounts}</p><p class="detail">{esc(fmt)} · {esc(s["duration"])}</p></li>')

    cards = "".join(article_card(a) for a in articles[:3])

    body = f"""{header(True, None)}
<main id="contenu">
<section class="hero" aria-labelledby="hero-title">
  <span class="hero-rule hero-rule--top" aria-hidden="true"></span>
  <div class="wrap hero-grid">
    <div class="hero-text">
      <h1 id="hero-title"><span class="kicker">Conseillère en image &amp; style à Genève</span><span class="hero-title">Une image qui vous <em>ressemble</em>.</span></h1>
      <p class="lead">Je vous accompagne pour construire une image qui renforce votre confiance en vous et exprime votre personnalité avec authenticité. Séances en ligne ou en présentiel à Genève.</p>
      <div class="hero-cta"><a class="btn" href="~/reservation/">Réserver une séance</a><a class="link-arrow" href="#services">Découvrir les services</a></div>
    </div>
    <figure class="hero-visual">
      <div class="frame">{portrait}</div>
      <img class="hero-sign" src="~/assets/signature.svg" alt="" width="162" height="204">
      <figcaption>Olivia « Liv » Curty</figcaption>
    </figure>
  </div>
  <span class="hero-rule hero-rule--bottom" aria-hidden="true"></span>
</section>

<section class="facts" aria-label="En bref">
  <ul class="wrap facts-list">
    <li><strong>10<small>+</small></strong><span>ans d’expérience dans l’univers de la mode et du commerce de détail</span></li>
    <li><strong>2016</strong><span>diplômée en design de mode, formée au conseil en image</span></li>
    <li><strong>9 ans</strong><span>de vie en Suisse, au contact de profils et de cultures variés</span></li>
    <li><strong>2</strong><span>formats : en ligne, ou en présentiel à Genève</span></li>
  </ul>
</section>

<section class="section" id="a-propos" aria-labelledby="about-title">
  <div class="wrap">
    <div class="section-head"><h2 class="section-title" id="about-title">À propos de moi</h2></div>
    <div class="about-grid">
      <div class="about-mission">
        <h3 class="subhead">Ma mission</h3>
        <blockquote><p>Vous aider à construire une image qui vous ressemble, renforce votre confiance en vous et exprime votre personnalité avec authenticité.</p></blockquote>
        <p class="script sign-script">Olivia Curty</p>
      </div>
      <div class="about-blocks">
        <div>
          <h3 class="subhead">Mon parcours</h3>
          <ul class="dots">
            <li>Plus de <strong>10 ans d’expérience</strong> dans l’univers de la mode et du commerce de détail.</li>
            <li>Diplômée en design de mode depuis 2016 et formée au conseil en image.</li>
            <li>Une expérience en marketing de la mode, visual merchandising, vente, gestion d’équipe et expérience client.</li>
            <li>Plus de <strong>9 ans de vie en Suisse</strong>, au contact de profils, de cultures et de besoins variés.</li>
          </ul>
        </div>
        <div>
          <h3 class="subhead">Ce que vous pouvez attendre</h3>
          <ul class="dots">
            <li>Un regard professionnel et personnalisé.</li>
            <li>Des recommandations adaptées à votre réalité et à votre mode de vie.</li>
            <li>Une approche bienveillante, sans jugement ni recettes toutes faites.</li>
            <li>Des outils concrets pour valoriser votre image de manière naturelle et réfléchie.</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section section--tight" id="conseil-en-image" aria-labelledby="ci-title">
  <div class="wrap">
    <div class="section-head"><h2 class="section-title" id="ci-title">Qu’est-ce que le conseil en image ?</h2></div>
    <div class="split">
      <div class="prose-lg">
        <p>Le conseil en image va bien au-delà de la mode. C’est une <strong>démarche stratégique</strong> qui vise à aligner votre image avec votre personnalité, vos objectifs de vie et votre parcours professionnel.</p>
        <p>À travers un travail sur l’apparence, le comportement et la communication, <strong>le conseil en image vous aide à construire une image cohérente, authentique et réfléchie.</strong></p>
        <p>Il ne s’agit pas simplement de savoir comment s’habiller, mais d’apprendre à exprimer son identité, à renforcer sa présence et à transmettre clairement le message que l’on souhaite faire passer.</p>
        <p><a class="link-arrow" href="~/blog/conseil-en-image-definition/">Lire le guide complet</a></p>
      </div>
      <div class="frame">{img('conseil-en-image-blazer', 'Femme en blazer brun oversize et lunettes de soleil, sac noir à la main, en ville', '(max-width: 860px) 92vw, 480px')}</div>
    </div>
  </div>
</section>

<section class="section section--tight" aria-labelledby="benefits-title">
  <div class="wrap">
    <div class="section-head"><h2 class="section-title" id="benefits-title">Les bénéfices</h2></div>
    <div class="benefits">
      <div class="benefit"><h3>Confiance en soi</h3><p>Renforce la perception que vous avez de vous-même et la manière dont vous vous affirmez, en vous aidant à vous sentir plus sûre de vous et à gagner en présence, quel que soit l’environnement.</p></div>
      <div class="benefit"><h3>Affirmation de soi</h3><p>Une image en accord avec qui vous êtes réduit les hésitations et vous aide à communiquer avec clarté et assurance, sans avoir constamment besoin de vous justifier.</p></div>
      <div class="benefit"><h3>Efficacité</h3><p>Des choix plus rapides et pertinents au quotidien, ainsi que des achats plus réfléchis, pour gagner du temps et éviter les dépenses inutiles.</p></div>
      <div class="benefit"><h3>Praticité</h3><p>Une garde-robe fonctionnelle simplifie le quotidien, avec des tenues adaptées à votre mode de vie et faciles à associer, pour ne plus avoir l’impression de n’avoir rien à vous mettre.</p></div>
    </div>
  </div>
</section>

<section class="section section--paper" id="services" aria-labelledby="services-title">
  <div class="wrap">
    <div class="section-head">
      <h2 class="section-title" id="services-title">Services</h2>
      <p class="lead">Trois accompagnements pour avancer à votre rythme : des couleurs qui vous mettent en valeur jusqu’au conseil en image complet.</p>
    </div>
    <div class="services">{''.join(service_rows)}
    </div>
  </div>
</section>

<section class="section section--tight" aria-labelledby="steps-title">
  <div class="wrap">
    <div class="section-head"><h2 class="section-title" id="steps-title">Le déroulement</h2></div>
    <ol class="steps">
      <li><h3>Prise de contact</h3><p>Vous m’écrivez ou m’appelez. Nous parlons de vos besoins et choisissons ensemble l’accompagnement le plus adapté.</p></li>
      <li><h3>Préparation</h3><p>Pour le conseil en image et le lookbook, un questionnaire préparatoire me permet de cerner votre quotidien, vos envies et vos objectifs.</p></li>
      <li><h3>La séance</h3><p>En ligne ou en présentiel à Genève selon la prestation : entretien, analyse et conseils personnalisés, sans jugement.</p></li>
      <li><h3>Vos outils</h3><p>Guide personnalisé, palette de couleurs ou lookbook digital : vous repartez avec des repères concrets pour le quotidien.</p></li>
    </ol>
  </div>
</section>

<section class="section" id="tarifs" aria-labelledby="pricing-title">
  <div class="wrap">
    <div class="section-head"><h2 class="section-title" id="pricing-title">Investissement</h2></div>
    <div class="pricing">
      <div class="frame">{img('manteau-rouge', 'Silhouette en long manteau rouge et bottines rouges, sac blanc à la main', '(max-width: 860px) 92vw, 460px')}</div>
      <div>
        <ul class="price-list">{''.join(price_items)}</ul>
        <p class="pricing-note">Chaque accompagnement est personnalisé selon vos besoins, votre mode de vie et vos objectifs, afin de vous proposer des recommandations concrètes et adaptées à votre quotidien.</p>
        <div class="pricing-cta"><a class="btn" href="~/reservation/">Réserver une séance</a><a class="link-arrow" href="~/blog/prix-conseil-en-image-geneve/">Bien choisir sa prestation</a></div>
      </div>
    </div>
  </div>
</section>

<section class="section section--paper section--tight" id="faq" aria-labelledby="faq-title">
  <div class="wrap">
    <div class="section-head"><h2 class="section-title" id="faq-title">Questions fréquentes</h2></div>
    {faq_block(HOME_FAQ)}
  </div>
</section>

<section class="section section--tight" aria-labelledby="blog-title">
  <div class="wrap">
    <div class="section-head">
      <h2 class="section-title" id="blog-title">Le blog</h2>
      <p class="lead">Conseils, méthodes et repères pour affiner votre image au quotidien.</p>
    </div>
    <div class="cards">{cards}</div>
    <p class="blog-more"><a class="btn btn--ghost" href="~/blog/">Voir tous les articles</a></p>
  </div>
</section>

{instagram_section()}
{contact_section()}
</main>
{footer(articles)}"""

    schema = [
        {
            "@type": "ProfessionalService",
            "@id": f"{SITE_URL}/#business",
            "name": "Liv Curty",
            "alternateName": "Liv Curty · Conseil en image & style",
            "description": "Conseil en image & style, colorimétrie personnelle et lookbook digital, en ligne ou en présentiel à Genève.",
            "url": f"{SITE_URL}/",
            "logo": f"{SITE_URL}/assets/logo.png",
            "image": f"{SITE_URL}/assets/img/liv-curty-portrait-563.webp",
            "email": BRAND["email"],
            "telephone": BRAND["phone_href"],
            "priceRange": "CHF 99–390",
            "currenciesAccepted": "CHF",
            "address": {"@type": "PostalAddress", "addressLocality": "Genève", "addressRegion": "GE", "addressCountry": "CH"},
            "areaServed": [{"@type": "City", "name": "Genève"}, {"@type": "Country", "name": "Suisse"}],
            "founder": {"@id": f"{SITE_URL}/#liv"},
            "hasOfferCatalog": {
                "@type": "OfferCatalog",
                "name": "Prestations",
                "itemListElement": [service_offer(s) for s in SERVICES],
            },
        },
        {
            "@type": "Person",
            "@id": f"{SITE_URL}/#liv",
            "name": BRAND["person"],
            "alternateName": "Liv Curty",
            "jobTitle": BRAND["job"],
            "image": f"{SITE_URL}/assets/img/liv-curty-portrait-563.webp",
            "worksFor": business_ref(),
            "knowsAbout": ["Conseil en image", "Colorimétrie", "Stylisme", "Design de mode", "Visual merchandising"],
        },
        {
            "@type": "WebSite",
            "@id": f"{SITE_URL}/#website",
            "url": f"{SITE_URL}/",
            "name": "Liv Curty",
            "inLanguage": "fr-CH",
            "publisher": business_ref(),
        },
        faq_schema(HOME_FAQ),
    ]
    site.render(
        path="index.html",
        title="Liv Curty · Conseillère en image & style à Genève",
        description="Conseil en image & style à Genève et en ligne : colorimétrie personnelle, lookbook digital et accompagnement sur mesure pour une image qui vous ressemble.",
        body=body, schema=schema, preload="liv-curty-portrait",
    )


def service_offer(s: dict) -> dict:
    offers = [{"@type": "Offer", "price": f"{p}.00", "priceCurrency": "CHF", **({"description": l} if l else {})} for p, l in s["prices"]]
    return {
        "@type": "Offer",
        "itemOffered": {"@type": "Service", "name": s["name"], "url": abs_url(f"services/{s['slug']}/")},
        "price": f"{s['prices'][0][0]}.00",
        "priceCurrency": "CHF",
    } if len(offers) == 1 else {
        "@type": "AggregateOffer",
        "itemOffered": {"@type": "Service", "name": s["name"], "url": abs_url(f"services/{s['slug']}/")},
        "lowPrice": f"{min(p for p, _ in s['prices'])}.00",
        "highPrice": f"{max(p for p, _ in s['prices'])}.00",
        "priceCurrency": "CHF",
        "offerCount": len(offers),
    }


def contact_section(heading: str = "h2") -> str:
    options = ["Je ne sais pas encore", "Colorimétrie personnelle", "Lookbook Digital",
               "Conseil en image & style · en ligne", "Conseil en image & style · à Genève"]
    opts = "".join(f"<option>{esc(o)}</option>" for o in options)
    return f"""<section class="section contact" id="contact" aria-labelledby="contact-title">
  <div class="wrap">
    <img class="contact-logo" src="~/assets/logo.svg" alt="" width="572" height="204" loading="lazy">
    <div class="contact-grid">
      <div class="contact-info">
        <{heading} class="section-title" id="contact-title">Contacts</{heading}>
        <p class="lead">Une question, une envie de changement ? Écrivez-moi ou appelez-moi : nous trouverons ensemble l’accompagnement qui vous correspond.</p>
        <ul class="contact-lines">
          <li>{ICON_MAIL}<a href="mailto:{BRAND['email']}">{BRAND['email']}</a><button class="copy-btn" type="button" data-copy="{BRAND['email']}">Copier</button></li>
          <li>{ICON_PHONE}<a href="tel:{BRAND['phone_href']}">{BRAND['phone']}</a></li>
        </ul>
        <p class="contact-place">Basée à Genève · séances en ligne ou en présentiel à Genève</p>
        <p><a class="link-arrow" href="~/reservation/">Réserver directement un créneau</a></p>
      </div>
      <form class="form" id="contact-form" data-to="{BRAND['email']}">
        <h3>Demander un rendez-vous</h3>
        <div class="form-row">
          <div class="field"><label for="f-name">Prénom et nom</label><input id="f-name" name="name" autocomplete="name" required></div>
          <div class="field"><label for="f-email">E-mail</label><input id="f-email" name="email" type="email" autocomplete="email" required></div>
        </div>
        <div class="form-row">
          <div class="field"><label for="f-phone">Téléphone (facultatif)</label><input id="f-phone" name="phone" type="tel" autocomplete="tel"></div>
          <div class="field"><label for="f-service">Prestation</label><select id="f-service" name="service">{opts}</select></div>
        </div>
        <div class="field"><label for="f-message">Votre message</label><textarea id="f-message" name="message" required placeholder="Vos envies, vos objectifs, vos disponibilités…"></textarea></div>
        <button class="btn" type="submit">Préparer mon e-mail</button>
        <p class="form-note">Ce bouton ouvre votre messagerie avec un message prérempli. Aucune donnée n’est enregistrée sur ce site.</p>
        <p class="form-status" role="status" aria-live="polite"></p>
      </form>
    </div>
  </div>
</section>"""


def page_service(site: Site, s: dict, articles: list[dict]) -> None:
    path = f"services/{s['slug']}/index.html"
    crumbs, crumb_schema = breadcrumbs([("Accueil", ""), ("Services", None), (s["name"], None)])
    crumbs = crumbs.replace('<li aria-current="page">Services</li>', '<li><a href="~/#services">Services</a></li>', 1)
    crumb_schema["itemListElement"] = [crumb_schema["itemListElement"][0], {**crumb_schema["itemListElement"][2], "position": 2}]

    prices = "".join(f"<dd>{chf(p)}{f' · {esc(l)}' if l else ''}</dd>" for p, l in s["prices"])
    fmt = format_text(s["format"])
    included = "".join(f"<li>{esc(i)}</li>" for i in s["included"])
    for_whom = "".join(f"<li>{esc(i)}</li>" for i in s["for_whom"])
    steps = "".join(f"<li><h3>{esc(t)}</h3><p>{esc(d)}</p></li>" for t, d in s["steps"])
    related = [a for a in articles if a["service"] == s["slug"]][:3]
    if len(related) < 3:
        related += [a for a in articles if a not in related][: 3 - len(related)]
    cards = "".join(article_card(a) for a in related)
    others = "".join(
        f'<a class="mini-service" href="~/services/{o["slug"]}/"><div class="frame">{img(o["image"], "", "120px")}</div>'
        f'<div><h3>{esc(o["name"])}</h3><p>{esc(o["format"][0] if len(o["format"]) == 1 else "En ligne ou à Genève")} · {esc(o["duration"])} · dès {chf(o["prices"][0][0])}</p></div></a>'
        for o in SERVICES if o is not s)

    body = f"""{header(False, None)}
<main id="contenu">
{crumbs}
<section class="page-head">
  <div class="wrap service-hero">
    <div class="service-hero-text">
      <p class="section-title" aria-hidden="true">Services</p>
      <h1 class="page-title">{esc(s['h1'])}</h1>
      <p class="lead">{esc(s['lead'])}</p>
      <dl class="fact-row">
        <div><dt>Format</dt><dd>{esc(fmt)}</dd></div>
        <div><dt>Durée</dt><dd>{esc(s['duration'])}</dd></div>
        <div><dt>Tarif</dt>{prices}</div>
      </dl>
      <div class="hero-cta"><a class="btn" href="~/reservation/#{s['slug']}">Réserver cette prestation</a><a class="link-arrow" href="#inclus">Ce qui est inclus</a></div>
    </div>
    <div class="frame">{img(s['image'], s['image_alt'], '(max-width: 860px) 92vw, 460px', eager=True)}</div>
  </div>
</section>

<section class="section section--paper section--tight" id="inclus" aria-labelledby="inc-title">
  <div class="wrap two-col">
    <div>
      <h2 class="subhead" id="inc-title">Ce qui est inclus</h2>
      <ul class="dots dots--lg">{included}</ul>
    </div>
    <div>
      <h2 class="subhead">Pour qui ?</h2>
      <ul class="dots dots--lg">{for_whom}</ul>
    </div>
  </div>
</section>

<section class="section section--tight" aria-labelledby="steps-title">
  <div class="wrap">
    <div class="section-head"><h2 class="section-title" id="steps-title">Le déroulement</h2></div>
    <ol class="steps">{steps}</ol>
  </div>
</section>

<section class="section section--tight cta-band">
  <div class="wrap">
    <div class="cta-box">
      <span class="giant" aria-hidden="true">{esc(s['name'].split()[0])}</span>
      <div><p class="cta-title">{esc(s['name'])}</p>
      <p>{' · '.join(chf(p) + (f' {esc(l)}' if l else '') for p, l in s['prices'])} · {esc(s['duration'])}. Chaque accompagnement est personnalisé selon vos besoins, votre mode de vie et vos objectifs.</p></div>
      <a class="btn" href="~/reservation/#{s['slug']}">Réserver une séance</a>
    </div>
  </div>
</section>

<section class="section section--paper section--tight" aria-labelledby="faq-title">
  <div class="wrap">
    <div class="section-head"><h2 class="section-title" id="faq-title">Questions fréquentes</h2></div>
    {faq_block(s['faq'])}
  </div>
</section>

<section class="section section--tight" aria-labelledby="other-title">
  <div class="wrap">
    <div class="section-head"><h2 class="section-title" id="other-title">Autres prestations</h2></div>
    <div class="other-services">{others}</div>
  </div>
</section>

<section class="section section--tight" aria-labelledby="read-title">
  <div class="wrap">
    <div class="section-head"><h2 class="section-title" id="read-title">À lire sur le blog</h2></div>
    <div class="cards">{cards}</div>
  </div>
</section>

{contact_section()}
</main>
{footer(articles)}"""

    service_schema = {
        "@type": "Service",
        "@id": abs_url(path) + "#service",
        "name": s["name"],
        "serviceType": s["name"],
        "description": s["lead"],
        "url": abs_url(path),
        "image": f"{SITE_URL}/assets/img/{s['image']}-{IMAGES[s['image']][0][-1]}.webp",
        "provider": business_ref(),
        "areaServed": [{"@type": "City", "name": "Genève"}, {"@type": "Country", "name": "Suisse"}],
        "availableChannel": {"@type": "ServiceChannel", "serviceUrl": abs_url(path)},
        "offers": [{"@type": "Offer", "price": f"{p}.00", "priceCurrency": "CHF", "url": abs_url(path), **({"description": l} if l else {})} for p, l in s["prices"]],
    }
    site.render(
        path=path,
        title=f"{s['seo_title']} · Liv Curty",
        description=s["description"],
        body=body,
        schema=[service_schema, crumb_schema, faq_schema(s["faq"])],
        og_slug=s["slug"],
    )


def page_blog_index(site: Site, articles: list[dict]) -> None:
    crumbs, crumb_schema = breadcrumbs([("Accueil", ""), ("Blog", None)])
    featured, rest = articles[0], articles[1:]
    cats = sorted({a["category"] for a in articles})
    chips = "".join(f"<li>{esc(c)}</li>" for c in cats)
    body = f"""{header(False, 'blog/')}
<main id="contenu">
{crumbs}
<section class="page-head blog-head">
  <div class="wrap">
    <p class="section-title" aria-hidden="true">Le blog</p>
    <h1 class="page-title">Conseils d’image, de style et de <em>couleurs</em></h1>
    <p class="lead page-intro">Des repères concrets pour mieux vous connaître, composer vos tenues plus facilement et faire des choix qui vous ressemblent, à Genève comme ailleurs.</p>
    <ul class="chips" aria-label="Thèmes abordés">{chips}</ul>
  </div>
</section>
<section class="section section--tight" style="padding-top:0">
  <div class="wrap">
    <div class="cards">
      {article_card(featured, featured=True, heading='h2')}
      {''.join(article_card(a, heading='h2') for a in rest)}
    </div>
  </div>
</section>
{contact_section()}
</main>
{footer(articles)}"""
    blog_schema = {
        "@type": "Blog",
        "@id": abs_url("blog/") + "#blog",
        "name": "Le blog de Liv Curty",
        "url": abs_url("blog/"),
        "inLanguage": "fr-CH",
        "publisher": business_ref(),
        "blogPost": [{"@type": "BlogPosting", "headline": a["title"], "url": abs_url(f"blog/{a['slug']}/"), "datePublished": a["date"]} for a in articles],
    }
    site.render(
        path="blog/index.html",
        title="Blog conseil en image, style & colorimétrie · Liv Curty",
        description="Le blog de Liv Curty, conseillère en image à Genève : colorimétrie, garde-robe capsule, silhouettes, lookbook et image professionnelle.",
        body=body, schema=[blog_schema, crumb_schema], og_slug="blog",
        lastmod=max(a["updated"] for a in articles),
    )


def page_article(site: Site, a: dict, articles: list[dict]) -> None:
    path = f"blog/{a['slug']}/index.html"
    crumbs, crumb_schema = breadcrumbs([("Accueil", ""), ("Blog", "blog/"), (a["title"], None)])
    service = SERVICE_BY_SLUG[a["service"]]

    body_html = a["body"]
    key = media_key(a.get("image"))
    if key:
        fig = (f'<figure><div class="frame">{img(key, a.get("image_alt", ""), "(max-width: 1020px) 92vw, 720px")}</div>'
               f'<figcaption>{esc(a.get("image_alt", ""))}</figcaption></figure>')
        if "{{image}}" not in body_html:  # articles créés dans l'admin : photo après l'introduction
            body_html = body_html.replace("</p>", "</p>\n{{image}}", 1)
        body_html = body_html.replace("{{image}}", fig, 1)
    body_html = re.sub(r"(<p>)?\{\{image\}\}(</p>)?", "", body_html)
    inline_cta = (f'<div class="inline-cta"><div class="cta-box"><div><p class="cta-title">{esc(service["name"])}</p>'
                  f'<p>{esc(service["lead"])} {esc(service["duration"])} · dès {chf(service["prices"][0][0])}.</p></div>'
                  f'<a class="btn" href="~/services/{service["slug"]}/">Découvrir la prestation</a></div></div>')
    body_html = re.sub(r"(<p>)?\{\{cta\}\}(</p>)?", lambda m: inline_cta, body_html)

    toc = "".join(f'<li><a href="#{i}">{esc(t)}</a></li>' for i, t in a["toc"])
    faq = ""
    if a.get("faq"):
        items = [(f["q"], f["a"]) for f in a["faq"]]
        faq = f'<h2 id="questions-frequentes">Questions fréquentes</h2>{faq_block(items)}'
    related = [r for r in articles if r is not a]
    related.sort(key=lambda r: (r["service"] != a["service"], r.get("order", 99)))
    cards = "".join(article_card(r) for r in related[:3])

    body = f"""{header(False, 'blog/')}
<main id="contenu">
{crumbs}
<article>
  <header class="article-head wrap">
    <p class="section-title" aria-hidden="true">{esc(a['category'])}</p>
    <h1 class="article-title">{esc(a['title'])}</h1>
    <p class="article-meta"><span>Par {BRAND['name']}</span><span class="dot"></span><time datetime="{a['date']}">{fr_date(a['date'])}</time><span class="dot"></span><span>{a['minutes']} min de lecture</span></p>
  </header>
  <div class="wrap">{cover(*a['cover'], cls='article-cover')}</div>
  <div class="wrap article-layout">
    <aside class="toc" aria-label="Sommaire"><p class="toc-title">Sommaire</p><ol>{toc}</ol></aside>
    <div class="prose">
      {body_html}
      {faq}
      <div class="author">
        <div class="frame">{img('liv-curty-portrait', 'Olivia Curty', '96px')}</div>
        <p><strong>Olivia « Liv » Curty</strong> est conseillère en image &amp; style à Genève. Diplômée en design de mode et forte de plus de 10 ans d’expérience dans la mode et le commerce de détail, elle accompagne chaque personne vers une image qui lui ressemble. <a href="~/#a-propos">En savoir plus</a></p>
      </div>
    </div>
  </div>
</article>
<section class="section section--tight" aria-labelledby="related-title">
  <div class="wrap">
    <div class="section-head"><h2 class="section-title" id="related-title">À lire aussi</h2></div>
    <div class="cards">{cards}</div>
  </div>
</section>
{contact_section()}
</main>
{footer(articles)}"""

    post_schema = {
        "@type": "BlogPosting",
        "@id": abs_url(path) + "#article",
        "headline": a["title"],
        "description": a["description"],
        "datePublished": a["date"],
        "dateModified": a["updated"],
        "inLanguage": "fr-CH",
        "wordCount": a["words"],
        "articleSection": a["category"],
        "mainEntityOfPage": abs_url(path),
        "image": f"{SITE_URL}/{site.og_image(a['slug'])}",
        "author": {"@type": "Person", "@id": f"{SITE_URL}/#liv", "name": BRAND["person"], "url": f"{SITE_URL}/#a-propos"},
        "publisher": {"@type": "Organization", "name": "Liv Curty", "logo": {"@type": "ImageObject", "url": f"{SITE_URL}/assets/logo.png"}},
    }
    schema = [post_schema, crumb_schema]
    if a.get("faq"):
        schema.append(faq_schema([(f["q"], f["a"]) for f in a["faq"]]))
    extra = (f'<meta property="article:published_time" content="{a["date"]}">\n'
             f'<meta property="article:modified_time" content="{a["updated"]}">\n'
             f'<meta property="article:section" content="{esc(a["category"])}">\n')
    site.render(
        path=path,
        title=f"{a['seo_title']} · Liv Curty",
        description=a["description"],
        body=body, schema=schema, og_slug=a["slug"], og_type="article",
        lastmod=a["updated"], extra_meta=extra,
    )


def booking_options() -> list[dict]:
    """Une option par prestation et par format tarifé (ex. conseil en image en ligne / à Genève)."""
    options = []
    for s in SERVICES:
        if len(s["prices"]) > 1:
            for amount, label in s["prices"]:
                options.append({"id": f"{s['slug']}:{re.sub(r'[^a-z]+', '-', label.lower()).strip('-')}", "service": s["slug"],
                                "name": s["name"], "format": label[0].upper() + label[1:], "price": amount,
                                "duration": s["duration"], "minutes": s.get("duration_minutes", 120)})
        else:
            options.append({"id": f"{s['slug']}:{'en-ligne' if s['format'] == ['En ligne'] else 'standard'}", "service": s["slug"],
                            "name": s["name"], "format": format_text(s["format"]), "price": s["prices"][0][0],
                            "duration": s["duration"], "minutes": s.get("duration_minutes", 120)})
    return sorted(options, key=lambda o: o["price"])


def page_booking(site: Site, articles: list[dict]) -> None:
    conf = SETTINGS.get("booking") or {}
    crumbs, crumb_schema = breadcrumbs([("Accueil", ""), ("Réservation", None)])
    options = booking_options()
    radios = "".join(
        f'<label class="b-option"><input type="radio" name="option" value="{o["id"]}" required>'
        f'<span class="b-option-body"><span class="b-option-name">{esc(o["name"])}</span>'
        f'<span class="b-option-meta">{esc(o["format"])} · {esc(o["duration"])}</span>'
        f'<span class="b-option-price">{chf(o["price"])}</span></span></label>'
        for o in options)
    data = {
        "email": BRAND["email"],
        "provider": conf.get("provider", "email"),
        "key": conf.get("web3forms_key", "") if conf.get("provider") == "web3forms" else "",
        "rules": {k: conf.get(k) for k in ("timezone", "min_notice_hours", "horizon_days", "slot_step_minutes",
                                             "buffer_minutes", "weekly", "closed", "booked")},
        "options": options,
    }
    if conf.get("enabled", True):
        app = f"""<div class="wrap booking-layout">
    <form class="booking" id="booking-form">
      <fieldset class="b-step">
        <legend><span class="b-num">1</span>Votre prestation</legend>
        <div class="b-options">{radios}</div>
      </fieldset>
      <fieldset class="b-step">
        <legend><span class="b-num">2</span>Date et heure</legend>
        <div class="b-cal" id="b-cal" hidden></div>
        <div class="b-slots" id="b-slots" aria-live="polite"></div>
        <div class="field b-nojs"><label for="b-dispo">Vos disponibilités</label><textarea id="b-dispo" name="dispo" placeholder="Par exemple : mardi ou jeudi après-midi"></textarea></div>
        <p class="b-tz">Horaires affichés à l’heure de Genève.</p>
      </fieldset>
      <fieldset class="b-step">
        <legend><span class="b-num">3</span>Vos coordonnées</legend>
        <div class="form-row">
          <div class="field"><label for="b-name">Prénom et nom</label><input id="b-name" name="name" autocomplete="name" required></div>
          <div class="field"><label for="b-email">E-mail</label><input id="b-email" name="email" type="email" autocomplete="email" required></div>
        </div>
        <div class="field"><label for="b-phone">Téléphone (facultatif)</label><input id="b-phone" name="phone" type="tel" autocomplete="tel"></div>
        <div class="field"><label for="b-message">Un mot sur vos attentes (facultatif)</label><textarea id="b-message" name="message" placeholder="Votre objectif, une occasion particulière, une question…"></textarea></div>
      </fieldset>
    </form>
    <div class="b-done" id="booking-done" tabindex="-1" hidden>
      <p class="script b-done-sign">Merci</p>
      <h2 class="subhead">Votre demande est bien envoyée</h2>
      <p data-recap></p>
      <p>{esc(conf.get("note", ""))}</p>
      <p><a class="link-arrow" href="~/blog/">En attendant, découvrir le blog</a></p>
    </div>
    <aside class="b-summary" aria-label="Récapitulatif">
      <p class="b-summary-title">Récapitulatif</p>
      <dl>
        <div><dt>Prestation</dt><dd id="sum-service">—</dd></div>
        <div><dt>Format</dt><dd id="sum-format">—</dd></div>
        <div><dt>Date</dt><dd id="sum-date">—</dd></div>
        <div><dt>Heure</dt><dd id="sum-time">—</dd></div>
        <div><dt>Tarif</dt><dd id="sum-price">—</dd></div>
      </dl>
      <p class="b-summary-note">Une question avant de réserver ? <a href="mailto:{BRAND['email']}">{BRAND['email']}</a> · <a href="tel:{BRAND['phone_href']}">{BRAND['phone']}</a></p>
    </aside>
    <div class="b-submit" id="b-submit">
      <button class="btn" type="submit" form="booking-form">Envoyer ma demande</button>
      <p class="form-note">{esc(conf.get("note", ""))}</p>
      <p class="form-status" role="status" aria-live="polite"></p>
    </div>
  </div>
  <script type="application/json" id="booking-data">{json.dumps(data, ensure_ascii=False).replace("</", "<\\/")}</script>"""
    else:
        app = f"""<div class="wrap"><div class="cta-box"><div><p class="cta-title">Réservations en ligne momentanément fermées</p>
    <p>Écrivez-moi à <a href="mailto:{BRAND['email']}">{BRAND['email']}</a> ou appelez le {BRAND['phone']} : nous trouverons une date ensemble.</p></div></div></div>"""

    body = f"""{header(False, 'reservation/')}
<main id="contenu">
{crumbs}
<section class="page-head">
  <div class="wrap">
    <p class="section-title" aria-hidden="true">Réservation</p>
    <h1 class="page-title">Réserver une <em>séance</em></h1>
    <p class="lead page-intro">Choisissez votre accompagnement et le créneau qui vous convient, en ligne ou en présentiel à Genève. Je vous confirme ensuite le rendez-vous par e-mail.</p>
  </div>
</section>
<section class="section section--tight" style="padding-top:0">
  {app}
</section>
</main>
{footer(articles)}"""
    site.render(path="reservation/index.html", title="Réserver une séance de conseil en image · Liv Curty",
                description="Réservez votre séance avec Liv Curty : colorimétrie personnelle, lookbook digital ou conseil en image & style, en ligne ou à Genève.",
                body=body, schema=[crumb_schema], og_slug=None, extra_js=("booking.js",))


def page_legal(site: Site, articles: list[dict]) -> None:
    crumbs, crumb_schema = breadcrumbs([("Accueil", ""), ("Mentions légales & confidentialité", None)])
    if (SETTINGS.get("booking") or {}).get("provider") == "web3forms":
        booking_channel = ("par l’intermédiaire du service d’envoi de formulaires Web3Forms, qui la relaie par e-mail à Liv Curty "
                           "sans la conserver au-delà de ce qui est nécessaire à l’envoi.")
    else:
        booking_channel = "par votre propre messagerie : le site prépare l’e-mail, rien n’est envoyé ni enregistré sans votre action."
    insta_par = ("<p>Les photos Instagram affichées sur le site sont hébergées sur le site lui-même. Les liens « Voir sur Instagram » "
                 "ouvrent le service Instagram (Meta), soumis à sa propre politique de confidentialité.</p>") if instagram_posts() or INSTAGRAM.get("posts") else ""
    body = f"""{header(False, None)}
<main id="contenu">
{crumbs}
<section class="page-head">
  <div class="wrap">
    <p class="section-title" aria-hidden="true">Informations</p>
    <h1 class="page-title">Mentions légales &amp; confidentialité</h1>
  </div>
</section>
<section class="section section--tight" style="padding-top:0">
  <div class="wrap legal">
    <h2>Éditrice du site</h2>
    <p>{BRAND['person']} (Liv Curty), conseillère en image &amp; style<br>Genève, Suisse<br>E-mail : <a href="mailto:{BRAND['email']}">{BRAND['email']}</a><br>Téléphone : <a href="tel:{BRAND['phone_href']}">{BRAND['phone']}</a></p>
    <h2>Hébergement</h2>
    <p>Ce site est hébergé par {HOSTING}.</p>
    <h2>Propriété intellectuelle</h2>
    <p>Les textes, le logo et l’identité visuelle de ce site appartiennent à Liv Curty. Toute reproduction, même partielle, nécessite un accord écrit préalable.</p>
    <h2>Protection des données</h2>
    <p>Ce site respecte la loi fédérale sur la protection des données (nLPD). Il n’utilise ni cookies, ni outil de mesure d’audience, ni traceur publicitaire. Les polices de caractères sont hébergées sur le site lui-même : aucune donnée n’est transmise à un service tiers lors de votre visite.</p>
    <p>Le formulaire de contact n’envoie et n’enregistre aucune donnée : il prépare simplement un e-mail dans votre propre messagerie. Les informations que vous transmettez par e-mail ou par téléphone servent uniquement à répondre à votre demande et à organiser votre accompagnement. Elles ne sont ni vendues, ni cédées à des tiers.</p>
    <p>La page de réservation transmet votre demande (prestation, créneau, nom, e-mail, téléphone et message) {booking_channel} Ces informations servent uniquement à confirmer et organiser votre rendez-vous.</p>
    {insta_par}
    <p>Comme tout serveur web, l’hébergeur peut enregistrer des journaux techniques (adresse IP, date, page consultée) à des fins de sécurité. Vous pouvez à tout moment demander l’accès, la rectification ou la suppression de vos données en écrivant à <a href="mailto:{BRAND['email']}">{BRAND['email']}</a>.</p>
    <h2>Responsabilité</h2>
    <p>Les contenus du blog sont fournis à titre informatif et ne remplacent pas un accompagnement personnalisé. Liv Curty s’efforce de maintenir des informations exactes et à jour, sans garantie d’exhaustivité.</p>
  </div>
</section>
</main>
{footer(articles)}"""
    site.render(path="mentions-legales/index.html", title="Mentions légales & confidentialité · Liv Curty",
                description="Mentions légales et politique de confidentialité du site de Liv Curty, conseillère en image & style à Genève.",
                body=body, schema=[crumb_schema])


def page_404(site: Site, articles: list[dict]) -> None:
    base = urlparse(SITE_URL).path.rstrip("/") + "/"
    body = f"""{header(False, None)}
<main id="contenu">
<section class="section">
  <div class="wrap notfound">
    <p class="section-title" aria-hidden="true">Erreur 404</p>
    <h1 class="page-title">Cette page n’existe pas <em>(ou plus)</em>.</h1>
    <p class="lead">Le lien est peut-être incomplet. Voici quelques pistes pour retrouver votre chemin.</p>
    <div class="hero-cta"><a class="btn" href="~/">Retour à l’accueil</a><a class="link-arrow" href="~/blog/">Lire le blog</a><a class="link-arrow" href="~/#services">Voir les services</a></div>
  </div>
</section>
</main>
{footer(articles)}"""
    site.render(path="404.html", title="Page introuvable · Liv Curty", description="Cette page n’existe pas.",
                body=body, noindex=True, root=None if site.preview else base)


def write_admin(site: Site) -> None:
    """Copie l'admin (src/admin) et ses données de démonstration (contenus déjà publics)."""
    src = SRC / "admin"
    if not src.exists():
        return
    out = site.out / "admin"
    shutil.copytree(src, out, dirs_exist_ok=True)
    manifest = ASSETS / "img" / "manifest.json"
    demo = {
        "articles": [{"slug": i["slug"], "meta": i["meta"], "body": i["body"]} for i in read_article_files() if is_live(i["meta"])],
        "settings": SETTINGS,
        "instagram": INSTAGRAM,
        "manifest": json.loads(manifest.read_text(encoding="utf-8")) if manifest.exists() else {},
    }
    (out / "demo-data.json").write_text(json.dumps(demo, ensure_ascii=False), encoding="utf-8")
    if manifest.exists():
        shutil.copy2(manifest, site.out / "assets" / "img" / "manifest.json")
    if site.preview:  # aperçu claude.ai : styles et script intégrés à la page
        page = out / "index.html"
        doc = page.read_text(encoding="utf-8")
        fonts = ('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz@6..96&amp;'
                 'family=Mrs+Saint+Delafield&amp;family=Parkinsans:wght@300..700&amp;display=swap">')
        site_css = f"<style>{site._preview_css()}</style>"
        admin_css = f"<style>{(src / 'admin.css').read_text(encoding='utf-8')}</style>"
        doc = re.sub(r'<link[^>]+href="\.\./assets/css/site\.css"[^>]*>', lambda m: fonts + site_css, doc)
        doc = re.sub(r'<link[^>]+href="(\./)?admin\.css"[^>]*>', lambda m: admin_css, doc)
        js = (src / "admin.js").read_text(encoding="utf-8")
        doc = re.sub(r'<script[^>]+src="(\./)?admin\.js"[^>]*></script>', "", doc)
        doc = doc.replace("</body>", f"<script>{PREVIEW_SCROLL_TOP}</script><script>{js}</script>\n</body>")
        page.write_text(doc, encoding="utf-8")
        for name in ("admin.css", "admin.js"):
            (out / name).unlink(missing_ok=True)


def write_static(site: Site) -> None:
    out = site.out
    assets_out = out / "assets"
    for sub in ("img", "fonts", "og"):
        src = ASSETS / sub
        if src.exists():
            shutil.copytree(src, assets_out / sub, dirs_exist_ok=True)
    for name in ("logo.svg", "signature.svg", "favicon.svg", "apple-touch-icon.png", "logo.png"):
        if (ASSETS / name).exists():
            shutil.copy2(ASSETS / name, assets_out / name)
    write_admin(site)
    if site.preview:
        return
    (assets_out / "css").mkdir(parents=True, exist_ok=True)
    (assets_out / "css" / "site.css").write_text(site.css, encoding="utf-8")
    (assets_out / "js").mkdir(parents=True, exist_ok=True)
    for js in (ASSETS / "js").glob("*.js"):
        shutil.copy2(js, assets_out / "js" / js.name)
    urls = "\n".join(
        f"  <url><loc>{abs_url(p)}</loc><lastmod>{m}</lastmod></url>" for p, m in site.pages)
    (out / "sitemap.xml").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}\n</urlset>\n',
        encoding="utf-8")
    base = urlparse(SITE_URL).path.rstrip("/")
    (out / "robots.txt").write_text(f"User-agent: *\nAllow: /\nDisallow: {base}/admin/\n\nSitemap: {SITE_URL}/sitemap.xml\n", encoding="utf-8")
    (out / ".nojekyll").write_text("", encoding="utf-8")
    domain = urlparse(SITE_URL).hostname or ""
    if not domain.endswith("github.io"):
        (out / "CNAME").write_text(domain + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--preview", metavar="DIR", help="générer la variante d'aperçu dans DIR")
    args = parser.parse_args()
    out = Path(args.preview).resolve() if args.preview else ROOT / "docs"
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)

    site = Site(out, preview=bool(args.preview))
    articles = load_articles()
    page_home(site, articles)
    for s in SERVICES:
        page_service(site, s, articles)
    page_booking(site, articles)
    page_blog_index(site, articles)
    for a in articles:
        page_article(site, a, articles)
    page_legal(site, articles)
    page_404(site, articles)
    write_static(site)
    print(f"{len(site.pages)} pages indexables générées dans {out}")


if __name__ == "__main__":
    main()
