// Génère les images de partage (Open Graph 1200×630), logo.png et apple-touch-icon.png
// dans src/assets/. Optionnel : nécessite Node et Playwright (npx playwright install chromium).
//   node tools/og.js
const fs = require("fs");
const os = require("os");
const path = require("path");
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("/opt/node22/lib/node_modules/playwright")); }

const ROOT = path.resolve(__dirname, "..");
const A = path.join(ROOT, "src", "assets");
const OUT = path.join(A, "og");
const url = (p) => "file://" + path.join(A, p);

const SERVICES = [
  { slug: "conseil-en-image-geneve", name: "Conseil en image & style", sub: "En ligne ou à Genève · 2 à 3 heures", img: "style-tailleur-orange-800.webp" },
  { slug: "lookbook-digital", name: "Lookbook Digital", sub: "En ligne · 1 h 30 à 2 h", img: "lookbook-digital-tablette-800.webp" },
  { slug: "colorimetrie-personnelle", name: "Colorimétrie personnelle", sub: "En ligne · 1 h à 1 h 30", img: "colorimetrie-nuanciers-681.webp" },
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const base = `
<style>
@font-face { font-family: P; src: url(${url("fonts/parkinsans-latin.woff2")}); font-weight: 300 800; }
@font-face { font-family: B; src: url(${url("fonts/bodoni-moda-latin.woff2")}); }
@font-face { font-family: S; src: url(${url("fonts/mrs-saint-delafield-latin.woff2")}); }
* { box-sizing: border-box; margin: 0; }
body { width: 1200px; height: 630px; background: #F7F1EE; color: #54351E; font-family: P; position: relative; overflow: hidden; }
.l1, .l2 { position: absolute; height: 4px; background: #860F53; }
.l1 { left: 0; top: 56px; width: 62%; } .l2 { right: 0; bottom: 56px; width: 52%; }
.photo { position: absolute; right: 80px; top: 92px; width: 330px; height: 446px; border: 5px solid #fff; border-radius: 22px; overflow: hidden; box-shadow: 0 30px 60px -30px rgba(84,53,30,.5); }
.photo img { width: 100%; height: 100%; object-fit: cover; }
.txt { position: absolute; left: 80px; top: 120px; width: 660px; display: grid; gap: 22px; }
.k { font-size: 20px; letter-spacing: .16em; text-transform: uppercase; color: #7A5C47; }
.t { font-size: 56px; font-weight: 300; line-height: 1.08; letter-spacing: -.02em; }
.t i { color: #860F53; }
.s { font-size: 24px; color: #7A5C47; }
.logo { position: absolute; left: 80px; bottom: 92px; width: 230px; }
.word { position: absolute; left: 50%; top: 47%; transform: translate(-50%, -50%); font-family: B; color: #D4CFCA; text-transform: uppercase; white-space: nowrap; line-height: 1; }
.script { position: absolute; left: 50%; top: 47%; font-family: S; color: #860F53; white-space: nowrap; transform: translate(-25%, -5%) rotate(-8deg); paint-order: stroke fill; -webkit-text-stroke: 8px #F7F1EE; }
</style>`;

function home() {
  return `${base}<div class="l1"></div><div class="l2"></div>
  <div class="txt"><p class="k">Conseillère en image & style · Genève</p><p class="t">Une image qui vous <i>ressemble</i>.</p><p class="s">Colorimétrie, lookbook digital et conseil en image, en ligne ou à Genève.</p></div>
  <img class="logo" src="${url("logo.svg")}"><div class="photo"><img src="${url("img/liv-curty-portrait-563.webp")}" style="object-position:50% 20%"></div>`;
}
function service(s) {
  return `${base}<div class="l1"></div><div class="l2"></div>
  <div class="txt"><p class="k">Services · Liv Curty</p><p class="t"><i>${esc(s.name)}</i></p><p class="s">${esc(s.sub)}</p></div>
  <img class="logo" src="${url("logo.svg")}"><div class="photo"><img src="${url("img/" + s.img)}"></div>`;
}
function article(a) {
  const size = Math.min(230, Math.round(1250 / Math.max(a.cover[0].length, 4)));
  return `${base}<div class="l1"></div><div class="l2"></div>
  <p class="word" style="font-size:${size}px;top:40%">${esc(a.cover[0])}</p>
  <p class="script" style="font-size:${Math.round(size * 0.85)}px;top:40%">${esc(a.cover[1])}</p>
  <div style="position:absolute;left:80px;right:80px;bottom:96px;display:grid;gap:10px">
    <p class="k">${esc(a.category)} · Le blog de Liv Curty</p>
    <p style="font-size:40px;font-style:italic;font-weight:380;line-height:1.15;max-width:900px">${esc(a.title)}</p>
  </div>`;
}
function blog() {
  return `${base}<div class="l1"></div><div class="l2"></div>
  <p class="word" style="font-size:300px;top:42%">Blog</p><p class="script" style="font-size:220px;top:42%">le</p>
  <div style="position:absolute;left:80px;bottom:96px;display:grid;gap:10px"><p class="k">Le blog de Liv Curty</p>
  <p style="font-size:40px;font-style:italic;font-weight:380">Conseils d’image, de style et de couleurs</p></div>`;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  const tmp = path.join(os.tmpdir(), "liv-curty-og.html");
  const load = async (p, html) => { fs.writeFileSync(tmp, "<!doctype html><meta charset=utf-8>" + html); await p.goto("file://" + tmp, { waitUntil: "load" }); };
  const shoot = async (html, file) => {
    await load(page, html);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: file, type: "jpeg", quality: 86 });
    console.log(path.relative(ROOT, file));
  };
  await shoot(home(), path.join(OUT, "default.jpg"));
  await shoot(blog(), path.join(OUT, "blog.jpg"));
  for (const s of SERVICES) await shoot(service(s), path.join(OUT, s.slug + ".jpg"));
  const dir = path.join(ROOT, "src", "content", "blog");
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".html"))) {
    const meta = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8").match(/<!--([\s\S]*?)-->/)[1]);
    await shoot(article(meta), path.join(OUT, f.replace(/\.html$/, ".jpg")));
  }
  // Logo raster (données structurées) et icône iOS
  const icon = await browser.newPage({ viewport: { width: 600, height: 214 } });
  await load(icon, `<body style="margin:0;background:transparent"><img src="${url("logo.svg")}" style="width:600px;display:block"></body>`);
  await icon.screenshot({ path: path.join(A, "logo.png"), omitBackground: true });
  await icon.setViewportSize({ width: 180, height: 180 });
  await load(icon, `<body style="margin:0;background:#F7F1EE;display:grid;place-items:center;width:180px;height:180px"><img src="${url("signature.svg")}" style="height:150px"></body>`);
  await icon.screenshot({ path: path.join(A, "apple-touch-icon.png") });
  console.log("src/assets/logo.png, src/assets/apple-touch-icon.png");
  await browser.close();
})();
