# Liv Curty · site internet

Site vitrine et blog de **Liv Curty**, conseillère en image & style à Genève.
L’identité visuelle (crème, prune, brun, grand « CURTY » taupe et signature « Liv ») est reprise du *Guide de Services*.

- **Accueil en une page** : à propos, conseil en image, bénéfices, services, déroulement, tarifs, FAQ, blog, contact.
- **Pages dédiées au référencement** : une page par prestation, un blog de 7 articles, mentions légales.
- **SEO** : titres et descriptions uniques, URL propres, données structurées (ProfessionalService, Service, BlogPosting, FAQ, fil d’Ariane), sitemap, robots.txt, images de partage pour chaque page.
- **Réservation en ligne** (`/reservation/`) : choix de la prestation, calendrier des créneaux libres selon vos horaires, demande envoyée par e-mail.
- **Admin** (`/admin/`) : articles de blog, photos Instagram, médiathèque, horaires de réservation, tarifs et bandeau d’annonce.
- **Léger et respectueux** : HTML/CSS statique, polices hébergées sur le site, aucun cookie ni traceur.

## Structure

```
build.py                    génère le site (Python 3.9+, sans dépendance)
src/content/settings.json   coordonnées, tarifs, services, FAQ, horaires de réservation, bandeau
src/content/blog/           articles du blog (un fichier .html par article)
src/content/instagram.json  photos Instagram choisies dans l’admin
src/media/                  photos envoyées depuis l’admin (originaux)
src/admin/                  l’application d’administration
src/assets/                 CSS, JS, polices, photos optimisées, logo, images de partage
tools/media.py              télécharge les photos Instagram et crée les WebP (Pillow)
tools/og.js                 (optionnel) régénère les images de partage
.github/workflows/site.yml  régénère et publie le site après chaque modification
docs/                       site généré, prêt à publier
```

## Administration (`/admin/`)

L’admin enregistre directement dans ce dépôt GitHub. Chaque enregistrement déclenche l’action **site** qui
traite les images, régénère le site et le publie en 2 à 3 minutes. Un mode démo permet de tout essayer sans rien enregistrer.

1. **Connexion** : créez un jeton GitHub *fine-grained* (github.com → Settings → Developer settings → Personal access tokens →
   Fine-grained tokens), limité à ce dépôt, avec les permissions **Contents : Read and write** et **Actions : Read and write**.
   Collez-le dans l’admin avec le nom du dépôt et la branche publiée.
2. **Articles** : éditeur visuel, aide SEO (longueurs, mot-clé, liens internes, textes alternatifs), brouillons, publication
   programmée (date future : l’article paraît automatiquement le jour venu grâce à la régénération quotidienne).
   Le dépôt est public : un brouillon n’apparaît pas sur le site, mais son fichier reste lisible sur GitHub.
3. **Instagram** : nécessite un compte Instagram **professionnel** (Créateur ou Entreprise) et une application
   sur [developers.facebook.com](https://developers.facebook.com) avec le produit *Instagram API with Instagram Login*.
   Générez un jeton longue durée (60 jours, prolongé automatiquement à chaque visite de l’admin) et collez-le dans l’onglet Instagram :
   il reste dans votre navigateur. Les photos choisies sont copiées sur le site (les liens Instagram expirent).
4. **Réservations** : horaires par jour, fermetures (vacances), créneaux déjà pris, délai minimum, mode de réception
   (messagerie du client, ou [Web3Forms](https://web3forms.com) pour recevoir les demandes directement par e-mail).
5. **Réglages** : coordonnées, tarifs, durées, contenus des prestations, FAQ, bandeau d’annonce.

## Mettre à jour le site à la main

```bash
python3 tools/media.py   # seulement si de nouvelles photos ont été ajoutées (pip install pillow)
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
4. **Settings → Actions → General → Workflow permissions** : cochez *Read and write permissions* pour que l’action **site** puisse publier.
   La régénération quotidienne (articles programmés) ne tourne que sur la branche par défaut (`master`).

### Nom de domaine (ex. livcurty.ch)

1. Dans `build.py`, remplacez `SITE_URL` par l’adresse définitive (ex. `https://www.livcurty.ch`), puis relancez `python3 build.py` (un fichier `CNAME` est créé).
2. Chez le registraire du domaine, ajoutez un enregistrement `CNAME` `www` → `andresgiadas.github.io`.
3. Dans **Settings → Pages**, indiquez le domaine et cochez **Enforce HTTPS**.
4. Déclarez le site dans [Google Search Console](https://search.google.com/search-console) et envoyez `sitemap.xml`. Créez aussi une fiche [Google Business Profile](https://business.google.com) pour le référencement local à Genève.

## Crédits

- Polices : Parkinsans, Bodoni Moda et Mrs Saint Delafield, sous licence SIL Open Font License, choisies pour rester proches des polices du guide (Agrandir, Coterie, Abramo Script).
- Logo et photos : extraits du *Guide de Services* de Liv Curty.
