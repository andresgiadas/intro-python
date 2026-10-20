# Liv Curty · site internet

Site vitrine et blog de **Liv Curty**, conseillère en image & style à Genève.
L’identité visuelle (crème, prune, brun, grand « CURTY » taupe et signature « Liv ») est reprise du *Guide de Services*.

- **Accueil en une page** : à propos, conseil en image, bénéfices, services, déroulement, tarifs, FAQ, blog, contact.
- **Pages dédiées au référencement** : une page par prestation, un blog de 7 articles, mentions légales.
- **SEO** : titres et descriptions uniques, URL propres, données structurées (ProfessionalService, Service, BlogPosting, FAQ, fil d’Ariane), sitemap, robots.txt, images de partage pour chaque page.
- **Léger et respectueux** : HTML/CSS statique, polices hébergées sur le site, aucun cookie ni traceur.

## Structure

```
build.py              génère le site (Python 3.9+, sans dépendance)
src/content/blog/     articles du blog (un fichier .html par article)
src/assets/           CSS, JS, polices, photos, logo, images de partage
tools/og.js           (optionnel) régénère les images de partage
docs/                 site généré, prêt à publier
```

## Mettre à jour le site

```bash
python3 build.py
```

Puis commitez le dossier `docs/`. Le site se consulte aussi en local :
`cd docs && python3 -m http.server` puis http://localhost:8000.

## Ajouter un article

1. Copiez un fichier de `src/content/blog/` et renommez-le : le nom devient l’adresse (`mon-article.html` → `/blog/mon-article/`).
2. Modifiez l’en-tête JSON (titre, `seo_title` de 48 caractères max, `description` de 140 à 158 caractères, date, catégorie, mots de couverture, FAQ…).
3. Écrivez le texte en HTML simple (`<p>`, `<h2 id="...">`, `<ul>`, `<strong>`…). Liens internes : `href="{{root}}services/colorimetrie-personnelle/"`.
   `{{image}}` insère la photo de l’article, `{{cta}}` un encadré de réservation.
4. Lancez `python3 build.py`. Pour l’image de partage : `node tools/og.js` (demande Playwright).

## Mise en ligne

### GitHub Pages (gratuit)

1. Sur GitHub : **Settings → Pages → Build and deployment → Source : Deploy from a branch**.
2. Choisissez la branche qui contient le site et le dossier **`/docs`**, puis **Save**.
3. Le site est publié à l’adresse https://andresgiadas.github.io/intro-python/ après une ou deux minutes.

### Nom de domaine (ex. livcurty.ch)

1. Dans `build.py`, remplacez `SITE_URL` par l’adresse définitive (ex. `https://www.livcurty.ch`), puis relancez `python3 build.py` (un fichier `CNAME` est créé).
2. Chez le registraire du domaine, ajoutez un enregistrement `CNAME` `www` → `andresgiadas.github.io`.
3. Dans **Settings → Pages**, indiquez le domaine et cochez **Enforce HTTPS**.
4. Déclarez le site dans [Google Search Console](https://search.google.com/search-console) et envoyez `sitemap.xml`. Créez aussi une fiche [Google Business Profile](https://business.google.com) pour le référencement local à Genève.

## Crédits

- Polices : Parkinsans, Bodoni Moda et Mrs Saint Delafield, sous licence SIL Open Font License, choisies pour rester proches des polices du guide (Agrandir, Coterie, Abramo Script).
- Logo et photos : extraits du *Guide de Services* de Liv Curty.
