/* Liv Curty — administration du site.
   Les contenus vivent dans le dépôt GitHub : chaque enregistrement crée un commit,
   puis l'action « site » régénère et republie le site en 2 à 3 minutes.
   Aucune dépendance, aucun service tiers en dehors de GitHub et d'Instagram. */
(function () {
  "use strict";

  // ==========================================================================
  // Constantes
  // ==========================================================================

  var DEFAULT_REPO = "andresgiadas/intro-python";
  var DEFAULT_BRANCH = "claude/website-blog-seo-hhhfr0";
  var BLOG_DIR = "src/content/blog";
  var MEDIA_DIR = "src/media";
  var IMG_DIR = "src/assets/img";
  var SETTINGS_PATH = "src/content/settings.json";
  var INSTAGRAM_PATH = "src/content/instagram.json";
  var AUTH_KEY = "lc-admin-auth";
  var IG_KEY = "lc-ig-token";
  var AUTOSAVE_PREFIX = "lc-autosave:";
  var DAY_NAMES = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
  var FORMATS = ["En ligne", "Présentiel à Genève"];
  var SAVED_MSG = "Enregistré. Le site se met à jour dans 2 à 3 minutes.";
  var DEMO_MSG = "Mode démo : rien n’est enregistré.";

  var ICONS = {
    tableau: '<path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z"/>',
    articles: '<path d="M5 3h10l4 4v14H5z"/><path d="M14 3v5h5M8 12h8M8 16h8"/>',
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.8"/>',
    medias: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    reservations: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    reglages: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
    aide: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.1"/>'
  };
  var NAV = [
    ["tableau", "Tableau de bord"],
    ["articles", "Articles"],
    ["instagram", "Instagram"],
    ["medias", "Médiathèque"],
    ["reservations", "Réservations"],
    ["reglages", "Réglages"],
    ["aide", "Aide"]
  ];

  // ==========================================================================
  // Utilitaires
  // ==========================================================================

  function h(tag, props) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v === null || v === undefined || v === false) return;
        if (k === "class") node.className = v;
        else if (k === "text") node.textContent = v;
        else if (k === "html") node.innerHTML = v; // uniquement pour du balisage statique interne
        else if (k === "value") node.value = v;
        else if (k === "checked") node.checked = !!v;
        else if (k === "selected") node.selected = !!v;
        else if (k === "disabled") node.disabled = !!v;
        else if (k === "dataset") Object.keys(v).forEach(function (d) { node.dataset[d] = v[d]; });
        else if (k.slice(0, 2) === "on" && typeof v === "function") node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? "" : String(v));
      });
    }
    for (var i = 2; i < arguments.length; i++) append(node, arguments[i]);
    return node;
  }
  function append(node, kid) {
    if (kid === null || kid === undefined || kid === false) return;
    if (Array.isArray(kid)) { kid.forEach(function (k) { append(node, k); }); return; }
    node.append(kid instanceof Node ? kid : String(kid));
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function icon(name) {
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("fill", "none");
    s.setAttribute("stroke", "currentColor");
    s.setAttribute("stroke-width", "1.6");
    s.setAttribute("stroke-linecap", "round");
    s.setAttribute("stroke-linejoin", "round");
    s.setAttribute("aria-hidden", "true");
    s.innerHTML = ICONS[name] || "";
    return s;
  }
  function slugify(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/, "");
  }
  function norm(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function uid() { return Math.random().toString(36).slice(2, 9); }
  var store = {
    get: function (area, key) { try { return window[area].getItem(key); } catch (e) { return null; } },
    set: function (area, key, value) { try { window[area].setItem(key, value); return true; } catch (e) { return false; } },
    del: function (area, key) { try { window[area].removeItem(key); } catch (e) { /* stockage indisponible */ } }
  };
  function getJSON(area, key) { try { return JSON.parse(store.get(area, key) || "null"); } catch (e) { return null; } }

  // Encodage base64 compatible UTF-8 et binaire
  function utf8ToB64(text) { return bytesToB64(new TextEncoder().encode(text)); }
  function bytesToB64(buf) {
    var bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    var bin = "";
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function b64ToUtf8(b64) {
    var bin = atob(String(b64 || "").replace(/\s/g, ""));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }

  // Dates à l'heure de Genève
  function zurichNow(tz) {
    var parts = {};
    new Intl.DateTimeFormat("en-GB", {
      timeZone: tz || "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(new Date()).forEach(function (p) { parts[p.type] = p.value; });
    return { date: parts.year + "-" + parts.month + "-" + parts.day, minutes: (+parts.hour % 24) * 60 + (+parts.minute) };
  }
  function today() { return zurichNow().date; }
  function dayIndex(iso) { var p = iso.split("-"); return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000); }
  function addDays(iso, n) { return new Date((dayIndex(iso) + n) * 86400000).toISOString().slice(0, 10); }
  function isoWeekday(iso) { var d = new Date(dayIndex(iso) * 86400000).getUTCDay(); return d === 0 ? 7 : d; }
  function toMin(hhmm) { var p = String(hhmm || "0:0").split(":"); return (+p[0] || 0) * 60 + (+p[1] || 0); }
  function fromMin(m) { return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); }
  function frDate(iso, opts) {
    if (!iso) return "";
    var p = iso.split("-");
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).toLocaleDateString("fr-CH", Object.assign({ timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }, opts || {}));
  }
  function frDateTime(ts) {
    try { return new Date(ts).toLocaleString("fr-CH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; }
  }

  // ==========================================================================
  // Toasts & dialogue (jamais alert/confirm/prompt)
  // ==========================================================================

  function toast(message, kind) {
    var box = document.getElementById("ad-toasts");
    var t = h("div", { class: "ad-toast" + (kind ? " ad-toast--" + kind : ""), text: message });
    box.append(t);
    setTimeout(function () { t.remove(); }, kind === "err" ? 9000 : 5000);
  }

  // openDialog({ title, body: Node, actions: [{label, kind, value}], wide }) -> Promise<valeur>
  function openDialog(opts) {
    var dlg = document.getElementById("ad-dialog");
    dlg.className = "ad-dialog" + (opts.wide ? " ad-dialog--wide" : "");
    dlg.textContent = "";
    return new Promise(function (resolve) {
      var done = false;
      function finish(v) {
        if (done) return;
        done = true;
        if (dlg.open) dlg.close();
        resolve(v);
      }
      var actions = (opts.actions || [{ label: "Fermer", value: null }]).map(function (a) {
        return h("button", {
          type: "button",
          class: a.kind === "primary" ? "btn btn--small" : a.kind === "danger" ? "ad-btn-plain ad-btn-danger" : "ad-btn-plain",
          text: a.label,
          onclick: function () {
            if (a.validate && !a.validate()) return;
            finish(typeof a.value === "function" ? a.value() : a.value);
          }
        });
      });
      dlg.append(h("form", { class: "ad-dialog-inner", method: "dialog", onsubmit: function (e) { e.preventDefault(); } },
        h("h2", { id: "ad-dialog-title", text: opts.title || "" }),
        opts.body ? h("div", { class: "ad-dialog-body" }, opts.body) : null,
        h("div", { class: "ad-actions ad-actions--end" }, actions)
      ));
      dlg.addEventListener("cancel", function onCancel(e) { e.preventDefault(); dlg.removeEventListener("cancel", onCancel); finish(null); });
      if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
      var first = dlg.querySelector("input, textarea, select");
      if (first) first.focus();
    });
  }
  function confirmDialog(title, message, okLabel, danger) {
    return openDialog({
      title: title,
      body: h("p", { text: message }),
      actions: [{ label: "Annuler", value: false }, { label: okLabel || "Confirmer", kind: danger ? "danger" : "primary", value: true }]
    });
  }

  // ==========================================================================
  // Stockage : GitHub (réel) ou démo (en mémoire)
  // ==========================================================================

  function encPath(p) { return p.split("/").map(encodeURIComponent).join("/"); }

  function GitHubStore(cfg) {
    this.mode = "github";
    this.token = cfg.token;
    this.repo = cfg.repo;
    this.branch = cfg.branch;
  }
  GitHubStore.prototype.api = function (path, opts) {
    opts = opts || {};
    var self = this;
    return fetch("https://api.github.com" + path, {
      method: opts.method || "GET",
      headers: {
        "Authorization": "Bearer " + self.token,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json"
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: "no-store"
    }).then(function (res) {
      if (res.status === 204) return null;
      return res.json().catch(function () { return null; }).then(function (data) {
        if (!res.ok) {
          var err = new Error(githubMessage(res.status, data));
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  };
  function githubMessage(status, data) {
    var detail = data && data.message ? " (" + data.message + ")" : "";
    if (status === 401) return "Jeton GitHub refusé : il est peut-être expiré ou mal copié." + detail;
    if (status === 403) return "Accès refusé par GitHub : vérifiez les autorisations du jeton (Contents en lecture et écriture)." + detail;
    if (status === 404) return "Introuvable sur GitHub : vérifiez le dépôt, la branche et les autorisations du jeton." + detail;
    if (status === 409 || status === 422) return "Le dépôt a changé pendant l’enregistrement. Réessayez." + detail;
    return "Erreur GitHub " + status + detail;
  }
  GitHubStore.prototype.check = function () {
    var self = this;
    return self.api("/repos/" + self.repo).then(function (repo) {
      return self.api("/repos/" + self.repo + "/branches/" + encPath(self.branch)).then(function () { return repo; });
    });
  };
  GitHubStore.prototype.readFile = function (path) {
    return this.api("/repos/" + this.repo + "/contents/" + encPath(path) + "?ref=" + encodeURIComponent(this.branch))
      .then(function (d) { return { text: b64ToUtf8(d.content), sha: d.sha }; })
      .catch(function (e) { if (e.status === 404) return null; throw e; });
  };
  GitHubStore.prototype.listDir = function (path) {
    return this.api("/repos/" + this.repo + "/contents/" + encPath(path) + "?ref=" + encodeURIComponent(this.branch))
      .then(function (d) { return Array.isArray(d) ? d.map(function (f) { return { name: f.name, path: f.path, type: f.type, sha: f.sha }; }) : []; })
      .catch(function (e) { if (e.status === 404) return []; throw e; });
  };
  // Un seul commit atomique par action : changes = [{ path, text } | { path, bytes } | { path, delete: true }]
  GitHubStore.prototype.commit = function (message, changes, retried) {
    var self = this, repo = "/repos/" + self.repo, head;
    return self.api(repo + "/git/ref/heads/" + encPath(self.branch)).then(function (ref) {
      head = ref.object.sha;
      return self.api(repo + "/git/commits/" + head);
    }).then(function (commit) {
      var tree = [];
      var chain = Promise.resolve();
      changes.forEach(function (c) {
        chain = chain.then(function () {
          if (c.delete) { tree.push({ path: c.path, mode: "100644", type: "blob", sha: null }); return; }
          var content = c.bytes ? bytesToB64(c.bytes) : utf8ToB64(c.text);
          return self.api(repo + "/git/blobs", { method: "POST", body: { content: content, encoding: "base64" } })
            .then(function (blob) { tree.push({ path: c.path, mode: "100644", type: "blob", sha: blob.sha }); });
        });
      });
      return chain.then(function () {
        return self.api(repo + "/git/trees", { method: "POST", body: { base_tree: commit.tree.sha, tree: tree } });
      });
    }).then(function (newTree) {
      return self.api(repo + "/git/commits", { method: "POST", body: { message: message, tree: newTree.sha, parents: [head] } });
    }).then(function (newCommit) {
      return self.api(repo + "/git/refs/heads/" + encPath(self.branch), { method: "PATCH", body: { sha: newCommit.sha } })
        .then(function () { return newCommit.sha; });
    }).catch(function (e) {
      if (!retried && (e.status === 409 || e.status === 422)) return self.commit(message, changes, true);
      throw e;
    });
  };
  GitHubStore.prototype.runs = function () {
    return this.api("/repos/" + this.repo + "/actions/runs?branch=" + encodeURIComponent(this.branch) + "&per_page=5")
      .then(function (d) { return (d && d.workflow_runs) || []; });
  };
  GitHubStore.prototype.dispatch = function () {
    return this.api("/repos/" + this.repo + "/actions/workflows/site.yml/dispatches", { method: "POST", body: { ref: this.branch } });
  };
  GitHubStore.prototype.loadManifest = function () {
    return fetch("../assets/img/manifest.json", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; });
  };

  function DemoStore() {
    this.mode = "demo";
    this.repo = "démo";
    this.branch = "démo";
    this.files = new Map();
    this.manifest = {};
  }
  DemoStore.prototype.init = function () {
    var self = this;
    return fetch("./demo-data.json", { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("Données de démonstration introuvables (demo-data.json).");
      return r.json();
    }).then(function (d) {
      (d.articles || []).forEach(function (a) {
        self.files.set(BLOG_DIR + "/" + a.slug + ".html", serializeArticle(a.meta || {}, a.body || ""));
      });
      self.files.set(SETTINGS_PATH, JSON.stringify(d.settings || {}, null, 2) + "\n");
      self.files.set(INSTAGRAM_PATH, JSON.stringify(d.instagram || { username: "", updated: null, posts: [] }, null, 2) + "\n");
      self.manifest = d.manifest || {};
      if (!Object.keys(self.manifest).length) {
        return fetch("../assets/img/manifest.json").then(function (r) { return r.ok ? r.json() : {}; })
          .then(function (m) { self.manifest = m; }).catch(function () {});
      }
    });
  };
  DemoStore.prototype.readFile = function (path) {
    return Promise.resolve(this.files.has(path) ? { text: this.files.get(path), sha: "demo" } : null);
  };
  DemoStore.prototype.listDir = function (dir) {
    var prefix = dir + "/";
    var out = [];
    this.files.forEach(function (_, k) {
      if (k.indexOf(prefix) === 0 && k.slice(prefix.length).indexOf("/") === -1) out.push({ name: k.slice(prefix.length), path: k, type: "file", sha: "demo" });
    });
    return Promise.resolve(out);
  };
  DemoStore.prototype.commit = function (message, changes) {
    var self = this;
    changes.forEach(function (c) {
      if (c.delete) self.files.delete(c.path);
      else self.files.set(c.path, c.text != null ? c.text : "[binaire]");
    });
    return Promise.resolve("demo");
  };
  DemoStore.prototype.runs = function () { return Promise.resolve([]); };
  DemoStore.prototype.dispatch = function () { return Promise.resolve(null); };
  DemoStore.prototype.loadManifest = function () { return Promise.resolve(this.manifest); };

  // ==========================================================================
  // État de l'application
  // ==========================================================================

  var S = {
    store: null,
    articles: [],          // { slug, path, meta, body }
    settings: {},
    instagram: { username: "", updated: null, posts: [] },
    manifest: {},
    mediaFiles: {},        // nom -> chemin dans src/media
    pending: {},           // nom -> { url, bytes, committed }
    igLive: new Map(),     // id -> publication fraîchement lue sur Instagram
    igNext: null,
    guard: null,           // fonction qui renvoie true si la vue a des changements non enregistrés
    route: "tableau",
    ignoreHash: false
  };

  function isDemo() { return S.store && S.store.mode === "demo"; }

  function serializeArticle(meta, body) {
    return "<!--\n" + JSON.stringify(meta, null, 2) + "\n-->\n" + String(body || "").trim() + "\n";
  }
  function parseArticle(text) {
    var m = /^\s*<!--([\s\S]*?)-->\s*([\s\S]*)$/.exec(text || "");
    if (!m) return null;
    try { return { meta: JSON.parse(m[1]), body: m[2].trim() }; } catch (e) { return null; }
  }
  function articleStatus(meta) {
    if (meta.draft) return { key: "draft", label: "Brouillon", cls: "ad-badge--draft" };
    if (meta.date && meta.date > today()) return { key: "plan", label: "Programmé", cls: "ad-badge--plan" };
    return { key: "ok", label: "Publié", cls: "ad-badge--ok" };
  }
  function sortArticles() {
    S.articles.sort(function (a, b) {
      var da = a.meta.date || "", db = b.meta.date || "";
      if (da !== db) return da < db ? 1 : -1;
      return (a.meta.order || 50) - (b.meta.order || 50);
    });
  }

  function loadAll() {
    var st = S.store;
    return Promise.all([
      st.readFile(SETTINGS_PATH),
      st.readFile(INSTAGRAM_PATH),
      st.listDir(BLOG_DIR),
      st.listDir(MEDIA_DIR),
      st.loadManifest()
    ]).then(function (r) {
      S.settings = r[0] ? JSON.parse(r[0].text) : {};
      S.instagram = r[1] ? JSON.parse(r[1].text) : { username: "", updated: null, posts: [] };
      if (!Array.isArray(S.instagram.posts)) S.instagram.posts = [];
      S.manifest = r[4] || {};
      S.mediaFiles = {};
      r[3].forEach(function (f) {
        if (f.type === "file" && /\.(jpe?g|png|webp)$/i.test(f.name)) S.mediaFiles[f.name.replace(/\.[^.]+$/, "")] = f.path;
      });
      var files = r[2].filter(function (f) { return f.type === "file" && /\.html$/.test(f.name); });
      return Promise.all(files.map(function (f) {
        return st.readFile(f.path).then(function (res) {
          var parsed = res && parseArticle(res.text);
          return parsed ? { slug: f.name.replace(/\.html$/, ""), path: f.path, meta: parsed.meta, body: parsed.body } : null;
        });
      }));
    }).then(function (list) {
      S.articles = list.filter(Boolean);
      sortArticles();
    });
  }

  // Lecture fraîche d'un fichier JSON avant modification (évite d'écraser un autre changement)
  function freshJSON(path, fallback) {
    return S.store.readFile(path).then(function (r) { return r ? JSON.parse(r.text) : clone(fallback); });
  }

  function commitWithFeedback(message, changes, button) {
    if (button) { button.disabled = true; button.dataset.label = button.textContent; button.textContent = "Enregistrement…"; }
    return S.store.commit(message, changes).then(function (sha) {
      toast(isDemo() ? DEMO_MSG : SAVED_MSG, isDemo() ? "demo" : "ok");
      return sha;
    }).catch(function (e) {
      toast("Échec de l’enregistrement : " + e.message, "err");
      throw e;
    }).finally(function () {
      if (button) { button.disabled = false; button.textContent = button.dataset.label || button.textContent; }
    });
  }

  // ==========================================================================
  // Images : manifest, aperçus, redimensionnement
  // ==========================================================================

  function mediaPreview(name, prefer) {
    var m = S.manifest[name];
    if (m && m.widths && m.widths.length) {
      var w = m.widths.filter(function (x) { return x >= (prefer || 800); })[0] || m.widths[m.widths.length - 1];
      return "../assets/img/" + name + "-" + w + ".webp";
    }
    if (S.pending[name]) return S.pending[name].url;
    if (name.indexOf("ig-") === 0) {
      var id = name.slice(3);
      var live = S.igLive.get(id);
      var stored = findIgPost(id);
      var p = live || stored;
      if (p) return igImageUrl(p);
    }
    return "";
  }
  function isProcessed(name) { return !!S.manifest[name]; }
  function allMediaNames() {
    var names = {};
    Object.keys(S.manifest).forEach(function (n) { names[n] = true; });
    Object.keys(S.mediaFiles).forEach(function (n) { names[n] = true; });
    Object.keys(S.pending).forEach(function (n) { names[n] = true; });
    return Object.keys(names).sort();
  }
  function uniqueMediaName(fileName) {
    var base = "photo-" + (slugify(String(fileName).replace(/\.[^.]+$/, "")).slice(0, 40) || "image");
    var taken = allMediaNames();
    var name = base, i = 2;
    while (taken.indexOf(name) !== -1) name = base + "-" + (i++);
    return name;
  }
  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error("Ce format d’image n’est pas pris en charge par le navigateur. Utilisez une photo JPEG ou PNG.")); };
      img.src = url;
    });
  }
  // Redimensionne à 2000 px max (grand côté), JPEG qualité 0.86
  function resizeImage(file) {
    var src = URL.createObjectURL(file);
    return loadImage(src).then(function (img) {
      var scale = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
      var w = Math.max(1, Math.round(img.naturalWidth * scale));
      var hgt = Math.max(1, Math.round(img.naturalHeight * scale));
      var canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = hgt;
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, hgt);
      ctx.drawImage(img, 0, 0, w, hgt);
      return new Promise(function (resolve) { canvas.toBlob(resolve, "image/jpeg", 0.86); });
    }).then(function (blob) {
      URL.revokeObjectURL(src);
      if (!blob) throw new Error("Impossible de préparer cette image.");
      return blob.arrayBuffer().then(function (bytes) { return { bytes: bytes, url: URL.createObjectURL(blob) }; });
    }, function (e) { URL.revokeObjectURL(src); throw e; });
  }
  function addPendingFiles(files) {
    var list = Array.prototype.slice.call(files || []).filter(function (f) { return /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic)$/i.test(f.name); });
    var names = [];
    var chain = Promise.resolve();
    list.forEach(function (f) {
      chain = chain.then(function () {
        return resizeImage(f).then(function (r) {
          var name = uniqueMediaName(f.name);
          S.pending[name] = { url: r.url, bytes: r.bytes, committed: false };
          names.push(name);
        }).catch(function (e) { toast(f.name + " : " + e.message, "err"); });
      });
    });
    return chain.then(function () { return names; });
  }
  function pendingChanges(names) {
    return names.filter(function (n) { return S.pending[n] && !S.pending[n].committed; })
      .map(function (n) { return { path: MEDIA_DIR + "/" + n + ".jpg", bytes: S.pending[n].bytes }; });
  }
  function markCommitted(names) {
    names.forEach(function (n) {
      if (S.pending[n]) {
        S.pending[n].committed = true;
        S.mediaFiles[n] = MEDIA_DIR + "/" + n + ".jpg";
      }
    });
  }

  // ==========================================================================
  // Instagram
  // ==========================================================================

  function igToken() {
    var raw = store.get("localStorage", IG_KEY);
    if (!raw) return null;
    try {
      var o = JSON.parse(raw);
      if (o && o.token) return o;
    } catch (e) { /* ancienne forme : chaîne brute */ }
    return { token: raw, expires: null };
  }
  function setIgToken(obj) {
    if (!obj) store.del("localStorage", IG_KEY);
    else store.set("localStorage", IG_KEY, JSON.stringify(obj));
  }
  function igMessage(err) {
    if (!err) return "Réponse inattendue d’Instagram.";
    if (err.code === 190) return "Le jeton Instagram n’est plus valide (expiré ou révoqué). Générez-en un nouveau.";
    if (err.code === 10 || err.code === 200) return "Autorisation manquante : le jeton doit inclure l’accès « instagram_business_basic ».";
    return err.message || "Erreur Instagram.";
  }
  function igFetch(url) {
    return fetch(url, { cache: "no-store" }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok || data.error) throw new Error(igMessage(data.error));
        return data;
      });
    }, function () { throw new Error("Instagram est injoignable depuis cette page."); });
  }
  function igImageUrl(p) {
    if (S.manifest["ig-" + p.id]) return "../assets/img/ig-" + p.id + "-" + S.manifest["ig-" + p.id].widths[0] + ".webp";
    return p.media_type === "VIDEO" ? (p.thumbnail_url || p.media_url) : (p.media_url || p.thumbnail_url);
  }
  function findIgPost(id) {
    for (var i = 0; i < S.instagram.posts.length; i++) if (S.instagram.posts[i].id === id) return S.instagram.posts[i];
    return null;
  }
  function postFromLive(live, existing) {
    var caption = live.caption || "";
    return {
      id: live.id,
      permalink: live.permalink || "",
      caption: caption,
      timestamp: live.timestamp || "",
      media_type: live.media_type || "IMAGE",
      media_url: live.media_url || "",
      thumbnail_url: live.thumbnail_url || "",
      alt: existing && existing.alt ? existing.alt : caption.replace(/\s+/g, " ").trim().slice(0, 120),
      show_on_home: existing ? !!existing.show_on_home : false
    };
  }
  function demoIgPosts() {
    var names = Object.keys(S.manifest).filter(function (n) { return n.indexOf("ig-") !== 0; });
    var captions = [
      "Séance de colorimétrie : les nuanciers ne mentent pas.",
      "Le blazer oversize, une pièce qui structure toute une silhouette.",
      "Préparer un lookbook digital, étape par étape.",
      "Une couleur forte portée près du visage.",
      "Rouge, blanc et une allure qui se voit de loin.",
      "Portrait : une image qui vous ressemble."
    ];
    return names.slice(0, 12).map(function (n, i) {
      var m = S.manifest[n];
      return {
        id: "demo" + (i + 1),
        caption: captions[i % captions.length],
        media_type: "IMAGE",
        media_url: "../assets/img/" + n + "-" + m.widths[0] + ".webp",
        thumbnail_url: "",
        permalink: "https://www.instagram.com/",
        timestamp: new Date(Date.now() - i * 5 * 86400000).toISOString()
      };
    });
  }
  function loadIgMedia(more) {
    if (isDemo()) {
      if (!more) demoIgPosts().forEach(function (p) { S.igLive.set(p.id, p); });
      S.igNext = null;
      return Promise.resolve(demoIgPosts());
    }
    var tk = igToken();
    if (!tk) return Promise.reject(new Error("Ajoutez d’abord votre jeton Instagram."));
    var url = more && S.igNext ? S.igNext : "https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=30&access_token=" + encodeURIComponent(tk.token);
    return igFetch(url).then(function (d) {
      (d.data || []).forEach(function (p) { S.igLive.set(p.id, p); });
      S.igNext = d.paging && d.paging.next ? d.paging.next : null;
      return d.data || [];
    });
  }
  function refreshIgToken(silent) {
    var tk = igToken();
    if (!tk) return Promise.resolve(null);
    return igFetch("https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=" + encodeURIComponent(tk.token))
      .then(function (d) {
        var obj = { token: d.access_token || tk.token, expires: Date.now() + (d.expires_in || 5184000) * 1000, refreshed: Date.now() };
        setIgToken(obj);
        if (!silent) toast("Jeton prolongé jusqu’au " + new Date(obj.expires).toLocaleDateString("fr-CH") + ".", "ok");
        return obj;
      }).catch(function (e) { if (!silent) toast(e.message, "err"); return null; });
  }
  function autoRefreshIg() {
    var tk = igToken();
    if (!tk || !tk.expires || isDemo()) return;
    if (tk.expires - Date.now() < 15 * 86400000) refreshIgToken(true);
  }
  function igDaysLeft() {
    var tk = igToken();
    if (!tk || !tk.expires) return null;
    return Math.max(0, Math.round((tk.expires - Date.now()) / 86400000));
  }

  // ==========================================================================
  // Corps d'article : nettoyage sur liste blanche
  // ==========================================================================

  var BLOCK_TAGS = /^(P|DIV|H[1-6]|UL|OL|LI|BLOCKQUOTE|ASIDE|FIGURE|SECTION|ARTICLE|HEADER|FOOTER|MAIN|PRE|TABLE|IMG)$/;
  function escText(t) { return esc(String(t).replace(/[ \t\n\r\f]+/g, " ")); }
  function hasText(html) { return /\S/.test(String(html).replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ")); }
  function textOf(html) { var d = document.createElement("div"); d.innerHTML = html; return d.textContent || ""; }
  function safeHref(href) {
    href = String(href || "").trim();
    if (!href) return "";
    if (/^\{\{root\}\}/.test(href) || /^(https?:|mailto:|tel:|#|\/|\.\.?\/)/i.test(href)) return href;
    if (/^[a-z]+:/i.test(href)) return ""; // javascript:, data:, etc.
    return href;
  }
  function inlineNode(n) {
    if (n.nodeType === 3) return escText(n.nodeValue);
    if (n.nodeType !== 1) return "";
    var tag = n.tagName;
    var inner = Array.prototype.map.call(n.childNodes, inlineNode).join("");
    if (tag === "STRONG" || (tag === "B" && !/normal|400/.test(n.style.fontWeight || ""))) return hasText(inner) ? "<strong>" + inner + "</strong>" : inner;
    if (tag === "EM" || tag === "I") return hasText(inner) ? "<em>" + inner + "</em>" : inner;
    if (tag === "A") {
      var href = safeHref(n.getAttribute("href"));
      return href && hasText(inner) ? '<a href="' + esc(href) + '">' + inner + "</a>" : inner;
    }
    if (tag === "BR") return " ";
    if (tag === "SPAN") {
      var r = inner, st = n.style;
      if (/^(bold|[6-9]00)$/.test(st.fontWeight || "")) r = "<strong>" + r + "</strong>";
      if (st.fontStyle === "italic") r = "<em>" + r + "</em>";
      return r;
    }
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEMPLATE") return "";
    if (BLOCK_TAGS.test(tag)) return inner + " ";
    return inner;
  }
  function inlineOf(node) { return Array.prototype.map.call(node.childNodes, inlineNode).join("").replace(/^ +| +$/g, ""); }
  function containsBlock(node) {
    for (var i = 0; i < node.children.length; i++) if (BLOCK_TAGS.test(node.children[i].tagName)) return true;
    return false;
  }
  function placeholderOf(node) {
    if (node.nodeType !== 1) return null;
    if (node.dataset && node.dataset.ph) return node.dataset.ph;
    var t = (node.textContent || "").trim();
    if (node.tagName === "P" && (t === "{{cta}}" || t === "{{image}}")) return t.slice(2, -2);
    return null;
  }
  function figureHtml(node) {
    var img = node.tagName === "IMG" ? node : node.querySelector("img");
    if (!img || !img.dataset.media) return "";
    var cap = node.querySelector ? node.querySelector("figcaption") : null;
    var caption = cap ? inlineOf(cap) : "";
    var ig = node.dataset ? node.dataset.instagram : "";
    return '<figure class="media"' + (ig ? ' data-instagram="' + esc(ig) + '"' : "") + '><img data-media="' + esc(img.dataset.media) +
      '" alt="' + esc(img.getAttribute("alt") || "") + '">' + (hasText(caption) ? "<figcaption>" + caption + "</figcaption>" : "") + "</figure>";
  }
  function tipHtml(node) {
    var inner = inlineOf(node).replace(/^\s*<strong>\s*Le conseil de Liv\s*<\/strong>\s*/i, "");
    if (!hasText(inner)) return "";
    return '<aside class="tip"><p><strong>Le conseil de Liv</strong> ' + inner + "</p></aside>";
  }
  function collectBlocks(container, out) {
    var buf = [];
    function flush() {
      var html = buf.join("").replace(/^ +| +$/g, "");
      if (hasText(html)) out.push({ tag: "p", html: html });
      buf = [];
    }
    Array.prototype.forEach.call(container.childNodes, function (node) {
      if (node.nodeType === 3) {
        var t = node.nodeValue;
        if (/^\s*\{\{(cta|image)\}\}\s*$/.test(t)) { flush(); out.push({ raw: t.trim() }); return; }
        buf.push(escText(t));
        return;
      }
      if (node.nodeType !== 1) return;
      var tag = node.tagName;
      var ph = placeholderOf(node);
      if (ph) { flush(); out.push({ raw: "{{" + ph + "}}" }); return; }
      if (tag === "FIGURE" || tag === "IMG") { flush(); var f = figureHtml(node); if (f) out.push({ raw: f }); return; }
      if (tag === "ASIDE") { flush(); var t2 = tipHtml(node); if (t2) out.push({ raw: t2 }); return; }
      if (/^H[1-6]$/.test(tag)) {
        flush();
        var hh = inlineOf(node);
        if (hasText(hh)) out.push({ tag: tag === "H1" || tag === "H2" ? "h2" : "h3", html: hh, id: node.id || "" });
        return;
      }
      if (tag === "UL" || tag === "OL") {
        flush();
        var items = Array.prototype.filter.call(node.children, function (li) { return li.tagName === "LI"; })
          .map(function (li) { return inlineOf(li); }).filter(hasText);
        if (items.length) out.push({ list: tag.toLowerCase(), items: items });
        return;
      }
      if (tag === "LI") { flush(); var li = inlineOf(node); if (hasText(li)) out.push({ list: "ul", items: [li] }); return; }
      if (tag === "BLOCKQUOTE") { flush(); var q = inlineOf(node); if (hasText(q)) out.push({ tag: "blockquote", html: q }); return; }
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEMPLATE" || tag === "META" || tag === "LINK") return;
      if (BLOCK_TAGS.test(tag)) {
        flush();
        if (containsBlock(node)) collectBlocks(node, out);
        else { var p = inlineOf(node); if (hasText(p)) out.push({ tag: "p", html: p }); }
        return;
      }
      buf.push(inlineNode(node));
    });
    flush();
    return out;
  }
  function blocksToHtml(blocks) {
    var ids = {}, leadDone = false, seenH2 = false, lines = [];
    blocks.forEach(function (b) {
      if (b.raw) { lines.push(b.raw); return; }
      if (b.list) {
        lines.push("<" + b.list + ">\n" + b.items.map(function (i) { return "  <li>" + i + "</li>"; }).join("\n") + "\n</" + b.list + ">");
        return;
      }
      if (b.tag === "h2") {
        var id = /^[a-z0-9][a-z0-9-]*$/.test(b.id) && !ids[b.id] ? b.id : slugify(textOf(b.html)) || "section";
        var base = id, n = 2;
        while (ids[id]) id = base + "-" + (n++);
        ids[id] = true;
        seenH2 = true;
        lines.push('<h2 id="' + id + '">' + b.html + "</h2>");
        return;
      }
      if (b.tag === "p") {
        var lead = !leadDone && !seenH2;
        leadDone = true;
        lines.push((lead ? '<p class="lead">' : "<p>") + b.html + "</p>");
        return;
      }
      lines.push("<" + b.tag + ">" + b.html + "</" + b.tag + ">");
    });
    return lines.join("\n\n");
  }
  function cleanHtmlFromString(html) {
    var marked = String(html || "").replace(/^[ \t]*(?:<p>)?[ \t]*\{\{(cta|image)\}\}[ \t]*(?:<\/p>)?[ \t]*$/gm, '<p data-ph="$1"></p>');
    var doc = new DOMParser().parseFromString("<body>" + marked + "</body>", "text/html");
    return blocksToHtml(collectBlocks(doc.body, []));
  }
  function cleanHtmlFromEditor(editor) {
    return blocksToHtml(collectBlocks(editor, []));
  }
  // Prépare le HTML propre pour l'affichage dans l'éditeur (blocs spéciaux, aperçus d'images)
  function fillEditor(editor, cleanHtml) {
    var marked = String(cleanHtml || "").replace(/^[ \t]*\{\{(cta|image)\}\}[ \t]*$/gm, '<p data-ph="$1"></p>');
    editor.innerHTML = marked;
    decorateEditor(editor);
  }
  function decorateEditor(editor) {
    editor.querySelectorAll("p[data-ph]").forEach(function (p) {
      p.className = "ad-chip-block";
      p.setAttribute("contenteditable", "false");
      p.textContent = p.dataset.ph === "cta" ? "Bloc réservation (prestation liée à l’article)" : "Photo de l’article";
    });
    editor.querySelectorAll("figure.media").forEach(function (fig) {
      fig.setAttribute("contenteditable", "false");
      fig.setAttribute("tabindex", "0");
      var img = fig.querySelector("img");
      if (img && img.dataset.media) {
        var src = mediaPreview(img.dataset.media, 800);
        if (src) { img.src = src; fig.removeAttribute("data-missing"); } else fig.setAttribute("data-missing", "");
      }
    });
  }
  function figureMarkup(name, alt, caption, permalink) {
    return '<figure class="media"' + (permalink ? ' data-instagram="' + esc(permalink) + '"' : "") + '><img data-media="' + esc(name) +
      '" alt="' + esc(alt) + '">' + (caption ? "<figcaption>" + esc(caption) + "</figcaption>" : "") + "</figure>";
  }

  // ==========================================================================
  // Disponibilités (mêmes règles que la page publique)
  // ==========================================================================

  function closedLabel(booking, iso) {
    var list = booking.closed || [];
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.from && iso >= c.from && iso <= (c.to || c.from)) return c.label || "Fermé";
    }
    return null;
  }
  function computeSlots(booking, durationMin, days) {
    var tz = booking.timezone || "Europe/Zurich";
    var now = zurichNow(tz);
    var minVal = dayIndex(now.date) * 1440 + now.minutes + (+booking.min_notice_hours || 0) * 60;
    var lastDay = dayIndex(now.date) + (+booking.horizon_days || 60);
    var step = Math.max(5, +booking.slot_step_minutes || 30);
    var span = (+durationMin || 60) + (+booking.buffer_minutes || 0);
    var out = [];
    for (var d = 0; d < days; d++) {
      var iso = addDays(now.date, d);
      var di = dayIndex(iso);
      if (di > lastDay) break;
      var closed = closedLabel(booking, iso);
      if (closed) { out.push({ date: iso, closed: closed, slots: [] }); continue; }
      var ranges = (booking.weekly || {})[String(isoWeekday(iso))] || [];
      var booked = (booking.booked || []).filter(function (b) { return b.date === iso; });
      var slots = [];
      ranges.forEach(function (r) {
        var a = toMin(r[0]), z = toMin(r[1]);
        for (var s = a; s + span <= z; s += step) {
          if (di * 1440 + s < minVal) continue;
          var overlaps = booked.some(function (b) { return s < toMin(b.end) && toMin(b.start) < s + span; });
          if (!overlaps) slots.push(s);
        }
      });
      out.push({ date: iso, closed: null, slots: slots });
    }
    return out;
  }

  // ==========================================================================
  // Rendu commun : coque, navigation, routes
  // ==========================================================================

  var root, view;

  function renderShell() {
    root = document.getElementById("ad-root");
    root.textContent = "";
    var nav = h("nav", { class: "ad-nav", "aria-label": "Sections de l’administration" },
      NAV.map(function (n) {
        return h("a", { href: "#" + n[0], dataset: { route: n[0] } }, icon(n[0]), h("span", { text: n[1] }));
      }));
    var foot = h("div", { class: "ad-side-foot" },
      isDemo() ? h("span", { class: "ad-badge ad-badge--demo", text: "Mode démo" }) : h("span", { class: "ad-repo", text: S.store.repo + " · " + S.store.branch }),
      h("a", { class: "ad-btn-plain", href: "../index.html", target: "_blank", rel: "noopener", text: "Voir le site" }),
      h("button", { type: "button", class: "ad-btn-plain", text: isDemo() ? "Quitter la démo" : "Se déconnecter", onclick: logout })
    );
    var side = h("aside", { class: "ad-side" },
      h("a", { class: "ad-brand", href: "#tableau" }, h("img", { src: "../assets/logo.svg", alt: "Liv Curty", width: "572", height: "204" }), h("span", { text: "Administration" })),
      nav, foot);
    view = h("main", { class: "ad-main", id: "ad-main", tabindex: "-1" });
    root.append(h("div", { class: "ad-shell" }, side, view));
  }
  function setActiveNav(route) {
    var top = route.split("/")[0];
    if (top === "article" || top === "nouvel-article" || top === "dupliquer") top = "articles";
    root.querySelectorAll(".ad-nav a").forEach(function (a) {
      if (a.dataset.route === top) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }
  function page(title, intro, actions) {
    var wrap = h("div", { class: "ad-view" });
    var t = h("h1");
    t.textContent = title;
    wrap.append(h("header", { class: "ad-head" },
      h("div", null, t, intro ? h("p", { text: intro }) : null),
      actions ? h("div", { class: "ad-head-actions" }, actions) : null));
    view.textContent = "";
    view.append(wrap);
    return wrap;
  }
  function loading(target, text) { target.append(h("p", { class: "ad-loading", text: text || "Chargement…" })); }

  var ROUTES = {
    "tableau": viewDashboard,
    "articles": viewArticles,
    "article": viewEditor,
    "nouvel-article": viewEditor,
    "dupliquer": viewEditor,
    "instagram": viewInstagram,
    "medias": viewMedia,
    "reservations": viewBooking,
    "reglages": viewSettings,
    "aide": viewHelp
  };
  function currentRoute() { return decodeURIComponent((location.hash || "#tableau").slice(1)) || "tableau"; }
  function go(route) { if (location.hash !== "#" + route) location.hash = route; else render(); }
  function render() {
    var route = currentRoute();
    var top = route.split("/")[0];
    var fn = ROUTES[top] || viewDashboard;
    S.guard = null;
    S.route = route;
    setActiveNav(route);
    fn(route.split("/").slice(1).join("/"), top);
    view.scrollTop = 0;
    window.scrollTo(0, 0);
    view.focus({ preventScroll: true });
  }
  function onHashChange() {
    if (S.ignoreHash) { S.ignoreHash = false; return; }
    if (S.guard && S.guard()) {
      var target = location.hash;
      S.ignoreHash = true;
      history.replaceState(null, "", "#" + S.route);
      confirmDialog("Modifications non enregistrées", "Vous avez des changements qui ne sont pas encore enregistrés. Quitter cette page quand même ?", "Quitter sans enregistrer", true)
        .then(function (ok) {
          if (ok) { S.guard = null; location.hash = target; }
        });
      return;
    }
    render();
  }
  window.addEventListener("beforeunload", function (e) {
    if (S.guard && S.guard()) { e.preventDefault(); e.returnValue = ""; }
  });

  // Petits composants de formulaire
  function field(id, label, control, hint, counter) {
    return h("div", { class: "field" },
      h("label", { for: id }, h("span", { text: label }), counter || null),
      control,
      hint ? h("p", { class: "ad-hint", text: hint }) : null);
  }
  function input(id, value, attrs) { return h("input", Object.assign({ id: id, name: id, value: value == null ? "" : value }, attrs || {})); }
  function textarea(id, value, attrs) {
    var t = h("textarea", Object.assign({ id: id, name: id }, attrs || {}));
    t.value = value == null ? "" : value;
    return t;
  }
  function checkbox(id, label, checked, onchange) {
    return h("label", { class: "ad-check", for: id }, h("input", { type: "checkbox", id: id, name: id, checked: checked, onchange: onchange }), h("span", { text: label }));
  }
  function counter(el, min, max) {
    var c = h("span", { class: "ad-counter" });
    function upd() {
      var n = el.value.length;
      c.textContent = n + (min ? " / " + min + "–" + max : " / " + max);
      var ok = n > 0 && n <= max && (!min || n >= min);
      c.dataset.state = ok ? "ok" : "warn";
    }
    el.addEventListener("input", upd);
    upd();
    return c;
  }

  // ==========================================================================
  // 1. Tableau de bord
  // ==========================================================================

  function viewDashboard() {
    var hour = new Date().getHours();
    var hello = hour < 12 ? "Bonjour" : hour < 18 ? "Bel après-midi" : "Bonsoir";
    var w = page(hello + ", Liv", "Voici l’état de votre site. Chaque modification enregistrée est en ligne 2 à 3 minutes plus tard.", [
      h("a", { class: "btn btn--small", href: "#nouvel-article", text: "Nouvel article" })
    ]);
    var counts = { ok: 0, plan: 0, draft: 0 };
    var next = null;
    S.articles.forEach(function (a) {
      var st = articleStatus(a.meta);
      counts[st.key]++;
      if (st.key === "plan" && (!next || a.meta.date < next.meta.date)) next = a;
    });

    var stats = h("div", { class: "ad-card" },
      h("h2", { text: "Articles" }),
      h("div", { class: "ad-stats" },
        h("div", { class: "ad-stat" }, h("strong", { text: String(counts.ok) }), h("span", { text: "publiés" })),
        h("div", { class: "ad-stat" }, h("strong", { text: String(counts.plan) }), h("span", { text: "programmés" })),
        h("div", { class: "ad-stat" }, h("strong", { text: String(counts.draft) }), h("span", { text: "brouillons" }))),
      next ? h("p", { class: "ad-muted" }, "Prochain article : ", h("a", { href: "#article/" + next.slug, text: next.meta.title }), " le " + frDate(next.meta.date) + ".")
        : h("p", { class: "ad-muted", text: "Aucun article programmé. Une date future publie un article automatiquement ce jour-là." }),
      h("div", { class: "ad-actions" }, h("a", { class: "ad-btn-plain", href: "#articles", text: "Gérer les articles" })));

    var runsBox = h("div", { class: "ad-card" }, h("h2", { text: "Mises à jour du site" }));
    if (isDemo()) {
      runsBox.append(h("p", { class: "ad-muted", text: "En mode réel, vous voyez ici les dernières publications du site et leur état." }));
    } else {
      var list = h("div");
      loading(list, "Lecture des dernières mises à jour…");
      runsBox.append(list, h("div", { class: "ad-actions" }, h("button", {
        type: "button", class: "ad-btn-plain", text: "Republier le site",
        onclick: function (e) {
          var b = e.currentTarget;
          b.disabled = true;
          S.store.dispatch().then(function () { toast("Mise à jour lancée. Le site sera à jour dans 2 à 3 minutes.", "ok"); })
            .catch(function (err) { toast(err.status === 403 || err.status === 404 ? "Impossible de lancer la mise à jour : le jeton doit avoir l’autorisation « Actions » en écriture." : err.message, "err"); })
            .finally(function () { b.disabled = false; });
        }
      })));
      S.store.runs().then(function (runs) {
        list.textContent = "";
        if (!runs.length) { list.append(h("p", { class: "ad-muted", text: "Aucune mise à jour récente." })); return; }
        list.append(h("ul", { class: "ad-list" }, runs.map(function (r) {
          var badge = r.status !== "completed" ? ["En cours", "ad-badge--plan"] : r.conclusion === "success" ? ["Réussie", "ad-badge--ok"] : ["Échec", "ad-badge--err"];
          return h("li", null,
            h("div", { class: "ad-grow" }, h("div", { class: "ad-title", text: r.display_title || r.name }), h("div", { class: "ad-sub", text: frDateTime(r.created_at) })),
            h("span", { class: "ad-badge " + badge[1], text: badge[0] }),
            h("a", { class: "ad-icon-btn", href: r.html_url, target: "_blank", rel: "noopener", "aria-label": "Voir sur GitHub", text: "↗" }));
        })));
      }).catch(function (err) {
        list.textContent = "";
        list.append(h("p", { class: "ad-muted", text: err.status === 403 || err.status === 404 ? "Pour voir l’état des mises à jour, donnez l’autorisation « Actions » (lecture) au jeton GitHub." : err.message }));
      });
    }

    var tk = igToken(), days = igDaysLeft();
    var ig = h("div", { class: "ad-card" }, h("h2", { text: "Instagram" }),
      isDemo() ? h("p", { class: "ad-muted", text: "En démo, des photos du site remplacent vos publications Instagram." })
        : tk ? h("p", null, "Connecté sur cet appareil. ", days !== null ? "Jeton valable encore " + days + " jour" + (days > 1 ? "s" : "") + "." : "Prolongez le jeton pour connaître sa date d’expiration.")
          : h("p", { class: "ad-muted", text: "Pas encore connecté sur cet appareil." }),
      h("p", { class: "ad-muted", text: S.instagram.posts.filter(function (p) { return p.show_on_home; }).length + " photo(s) affichée(s) sur le site." }),
      h("div", { class: "ad-actions" }, h("a", { class: "ad-btn-plain", href: "#instagram", text: "Choisir des photos Instagram" })));

    var shortcuts = h("div", { class: "ad-card" }, h("h2", { text: "Raccourcis" }),
      h("div", { class: "ad-links" },
        h("a", { class: "ad-btn-plain", href: "#nouvel-article", text: "Nouvel article" }),
        h("a", { class: "ad-btn-plain", href: "#instagram", text: "Choisir des photos Instagram" }),
        h("a", { class: "ad-btn-plain", href: "#reservations", text: "Bloquer des dates" }),
        h("a", { class: "ad-btn-plain", href: "#reglages", text: "Modifier les tarifs" })),
      h("div", { class: "ad-links" },
        h("a", { class: "link-arrow", href: "../index.html", target: "_blank", rel: "noopener", text: "Voir le site" }),
        h("a", { class: "link-arrow", href: "../reservation/index.html", target: "_blank", rel: "noopener", text: "Page de réservation" })));

    var ideas = [
      ["Bons cadeaux à offrir", "bientôt"],
      ["Témoignages de clientes", "bientôt"],
      ["Questionnaire préparatoire en ligne", "bientôt"],
      ["Espace cliente pour remettre palette et lookbook", "bientôt"],
      ["Newsletter", "bientôt"],
      ["Statistiques respectueuses de la vie privée", "bientôt"]
    ];
    var ideasCard = h("div", { class: "ad-card ad-card--soft" }, h("h2", { text: "Idées pour la suite" }),
      h("ul", { class: "ad-ideas" }, ideas.map(function (i) { return h("li", null, h("span", { text: i[0] }), h("span", { class: "ad-badge", text: i[1] })); })));

    w.append(h("div", { class: "ad-grid ad-grid--2" }, stats, runsBox, ig, shortcuts), ideasCard);
  }

  // ==========================================================================
  // 2. Articles : liste
  // ==========================================================================

  function viewArticles() {
    var w = page("Articles", "Publiez, programmez ou mettez de côté vos articles de blog.", [
      h("a", { class: "btn btn--small", href: "#nouvel-article", text: "Nouvel article" })
    ]);
    var search = input("ad-search", "", { type: "search", placeholder: "Rechercher un article…", class: "ad-search" });
    var listBox = h("div", { class: "ad-card" });
    function draw() {
      var q = norm(search.value);
      var items = S.articles.filter(function (a) { return !q || norm(a.meta.title + " " + a.meta.category + " " + a.slug).indexOf(q) !== -1; });
      listBox.textContent = "";
      if (!S.articles.length) { listBox.append(h("p", { class: "ad-empty", text: "Aucun article pour l’instant. Créez le premier !" })); return; }
      if (!items.length) { listBox.append(h("p", { class: "ad-empty", text: "Aucun article ne correspond à votre recherche." })); return; }
      listBox.append(h("ul", { class: "ad-list" }, items.map(function (a) {
        var st = articleStatus(a.meta);
        return h("li", null,
          h("div", { class: "ad-grow" },
            h("a", { class: "ad-title", href: "#article/" + a.slug, text: a.meta.title || a.slug }),
            h("div", { class: "ad-sub", text: [frDate(a.meta.date), a.meta.category].filter(Boolean).join(" · ") })),
          h("span", { class: "ad-badge " + st.cls, text: st.label }),
          h("div", { class: "ad-order" },
            h("a", { class: "ad-btn-plain", href: "#article/" + a.slug, text: "Modifier" }),
            h("a", { class: "ad-btn-plain", href: "#dupliquer/" + a.slug, text: "Dupliquer" }),
            h("button", { type: "button", class: "ad-btn-plain ad-btn-danger", text: "Supprimer", onclick: function (e) { deleteArticle(a, e.currentTarget).then(draw); } })));
      })));
    }
    search.addEventListener("input", draw);
    w.append(h("div", null, field("ad-search", "Rechercher", search)), listBox);
    draw();
  }
  function deleteArticle(a, button) {
    return confirmDialog("Supprimer l’article ?", "« " + (a.meta.title || a.slug) + " » sera retiré du site lors de la prochaine mise à jour. Il reste récupérable dans l’historique GitHub.", "Supprimer", true)
      .then(function (ok) {
        if (!ok) return;
        return commitWithFeedback("Article supprimé : " + (a.meta.title || a.slug), [{ path: a.path, delete: true }], button).then(function () {
          S.articles = S.articles.filter(function (x) { return x !== a; });
        }).catch(function () {});
      });
  }

  // ==========================================================================
  // 2b. Articles : éditeur
  // ==========================================================================

  function viewEditor(param, top) {
    var source = null;
    if (top === "article") {
      source = S.articles.filter(function (a) { return a.slug === param; })[0];
      if (!source) {
        var w0 = page("Article introuvable", "Cet article n’existe pas ou a été supprimé.");
        w0.append(h("a", { class: "ad-btn-plain", href: "#articles", text: "Retour aux articles" }));
        return;
      }
    }
    var dup = top === "dupliquer" ? S.articles.filter(function (a) { return a.slug === param; })[0] : null;
    var isNew = !source;
    var base = source ? clone(source.meta) : dup ? clone(dup.meta) : {};
    if (dup) { base.title = (base.title || "") + " (copie)"; base.draft = true; base.date = today(); }
    var meta = Object.assign({
      title: "", seo_title: "", description: "", keyword: "", date: today(), updated: today(), category: "",
      cover: ["", ""], image: null, image_alt: "", excerpt: "", service: (S.settings.services && S.settings.services[0] ? S.settings.services[0].slug : "conseil-en-image-geneve"),
      order: 50, faq: [], draft: isNew
    }, base);
    if (!Array.isArray(meta.cover)) meta.cover = ["", ""];
    if (!Array.isArray(meta.faq)) meta.faq = [];
    var bodySource = source ? source.body : dup ? dup.body : "";
    var slug = source ? source.slug : dup ? uniqueSlug(slugify(meta.title)) : "";
    var slugTouched = !!source;
    var dirty = false;
    var autosaveKey = AUTOSAVE_PREFIX + (source ? source.slug : "nouveau");

    var w = page(isNew ? "Nouvel article" : "Modifier l’article", isNew ? "Rédigez, prévisualisez, puis publiez ou gardez en brouillon." : "« " + (meta.title || slug) + " »", [
      h("a", { class: "ad-btn-plain", href: "#articles", text: "Retour aux articles" }),
      !isNew && articleStatus(meta).key === "ok" ? h("a", { class: "ad-btn-plain", href: "../blog/" + slug + "/index.html", target: "_blank", rel: "noopener", text: "Voir l’article" }) : null
    ]);

    // Champs
    var fTitle = input("ed-title", meta.title, { required: true, maxlength: "140" });
    var fSlug = input("ed-slug", slug, { pattern: "[a-z0-9-]+", disabled: !!source });
    var slugUnlock = source ? h("button", {
      type: "button", class: "ad-btn-plain", text: "Modifier l’adresse",
      onclick: function () {
        confirmDialog("Changer l’adresse de l’article ?", "L’adresse publique (et les liens déjà partagés) changera. Google mettra un peu de temps à la prendre en compte.", "Changer l’adresse")
          .then(function (ok) { if (ok) { fSlug.disabled = false; fSlug.focus(); } });
      }
    }) : null;
    var fSeo = input("ed-seo", meta.seo_title, { maxlength: "70" });
    var fDesc = textarea("ed-desc", meta.description, { rows: "3", maxlength: "200" });
    var fKw = input("ed-kw", meta.keyword || "", { placeholder: "ex. colorimétrie Genève" });
    var fDate = input("ed-date", meta.date, { type: "date" });
    var fDraft = h("input", { type: "checkbox", id: "ed-draft", checked: !!meta.draft });
    var cats = {};
    S.articles.forEach(function (a) { if (a.meta.category) cats[a.meta.category] = true; });
    var fCat = input("ed-cat", meta.category, { list: "ed-cat-list" });
    var catList = h("datalist", { id: "ed-cat-list" }, Object.keys(cats).sort().map(function (c) { return h("option", { value: c }); }));
    var fService = h("select", { id: "ed-service", name: "ed-service" }, (S.settings.services || []).map(function (s) {
      return h("option", { value: s.slug, selected: s.slug === meta.service, text: s.name });
    }));
    var fCover1 = input("ed-cover1", meta.cover[0] || "", { maxlength: "12", placeholder: "ex. Couleurs" });
    var fCover2 = input("ed-cover2", meta.cover[1] || "", { maxlength: "10", placeholder: "ex. vos" });
    var fExcerpt = textarea("ed-excerpt", meta.excerpt, { rows: "3", maxlength: "240" });
    var coverPreview = h("div", { class: "ad-cover-preview" });
    var coverPhoto = h("div", { class: "ad-form" });
    var faqBox = h("div", { class: "ad-repeat" });

    // Éditeur de texte
    var editor = h("div", { class: "ad-editor", id: "ed-body", contenteditable: "true", role: "textbox", "aria-multiline": "true", "aria-label": "Texte de l’article", "data-placeholder": "Commencez à écrire votre article…" });
    fillEditor(editor, cleanHtmlFromString(bodySource));
    try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch (e) { /* navigateur ancien */ }
    var savedRange = null;
    function saveRange() {
      var sel = window.getSelection();
      if (sel.rangeCount && editor.contains(sel.anchorNode)) savedRange = sel.getRangeAt(0).cloneRange();
    }
    function restoreRange() {
      editor.focus();
      if (savedRange) { var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(savedRange); }
      else { var r = document.createRange(); r.selectNodeContents(editor); r.collapse(false); var s2 = window.getSelection(); s2.removeAllRanges(); s2.addRange(r); }
    }
    function exec(cmd, val) { restoreRange(); document.execCommand(cmd, false, val); markDirty(); saveRange(); }
    function insertInline(html) { restoreRange(); document.execCommand("insertHTML", false, html); markDirty(); saveRange(); }
    // Les blocs (encadré, image, réservation) sont insérés par le DOM : execCommand place mal le curseur autour des blocs non éditables
    function insertBlock(html) {
      restoreRange();
      var sel = window.getSelection();
      var blockEl = sel.rangeCount ? sel.getRangeAt(0).startContainer : null;
      while (blockEl && blockEl.parentNode !== editor) blockEl = blockEl.parentNode;
      var tpl = document.createElement("template");
      tpl.innerHTML = html;
      var after = h("p", null, h("br"));
      var frag = document.createDocumentFragment();
      Array.prototype.slice.call(tpl.content.childNodes).forEach(function (n) { frag.appendChild(n); });
      frag.appendChild(after);
      if (blockEl) {
        var empty = blockEl.nodeType === 1 && blockEl.tagName === "P" && !blockEl.textContent.trim() && !blockEl.querySelector("img") && !blockEl.dataset.ph;
        if (empty) editor.replaceChild(frag, blockEl); else editor.insertBefore(frag, blockEl.nextSibling);
      } else editor.appendChild(frag);
      decorateEditor(editor);
      var r = document.createRange();
      r.setStart(after, 0);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
      markDirty();
      saveRange();
    }
    editor.addEventListener("keyup", saveRange);
    editor.addEventListener("mouseup", saveRange);
    editor.addEventListener("input", function () { markDirty(); });
    editor.addEventListener("paste", function (e) {
      e.preventDefault();
      var cd = e.clipboardData;
      var htmlData = cd.getData("text/html");
      var clean;
      if (htmlData) clean = cleanHtmlFromString(htmlData);
      else clean = cd.getData("text/plain").split(/\n{2,}/).map(function (p) { return p.trim() ? "<p>" + esc(p.trim()).replace(/\n/g, " ") + "</p>" : ""; }).join("");
      clean = clean.replace(/<p class="lead">/g, "<p>");
      document.execCommand("insertHTML", false, clean);
      decorateEditor(editor);
      markDirty();
    });
    editor.addEventListener("click", function (e) {
      var fig = e.target.closest("figure.media");
      if (fig && editor.contains(fig)) { editFigure(fig); return; }
      var chip = e.target.closest(".ad-chip-block");
      if (chip && editor.contains(chip)) {
        confirmDialog("Retirer ce bloc ?", chip.textContent + " sera retiré du texte.", "Retirer", true).then(function (ok) { if (ok) { chip.remove(); markDirty(); } });
      }
    });
    editor.addEventListener("keydown", function (e) {
      var fig = e.target.closest && e.target.closest("figure.media");
      if (fig && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); editFigure(fig); }
    });

    function tb(label, title, fn, pressedCmd) {
      var b = h("button", { type: "button", title: title, "aria-label": title, text: label });
      b.addEventListener("mousedown", function (e) { e.preventDefault(); });
      b.addEventListener("click", fn);
      if (pressedCmd) b.dataset.cmd = pressedCmd;
      return b;
    }
    function block(tag) {
      return function () {
        restoreRange();
        var current = document.queryCommandValue("formatBlock").toLowerCase();
        document.execCommand("formatBlock", false, current === tag ? "p" : tag);
        markDirty();
        saveRange();
      };
    }
    var toolbar = h("div", { class: "ad-toolbar", role: "toolbar", "aria-label": "Mise en forme" },
      tb("Titre", "Titre de section (h2)", block("h2")),
      tb("Sous-titre", "Sous-titre (h3)", block("h3")),
      h("span", { class: "ad-sep", "aria-hidden": "true" }),
      tb("G", "Gras", function () { exec("bold"); }, "bold"),
      tb("I", "Italique", function () { exec("italic"); }, "italic"),
      tb("• Liste", "Liste à puces", function () { exec("insertUnorderedList"); }),
      tb("1. Liste", "Liste numérotée", function () { exec("insertOrderedList"); }),
      tb("Lien", "Insérer un lien", function () { editLink(); }),
      tb("« Citation »", "Citation", block("blockquote")),
      h("span", { class: "ad-sep", "aria-hidden": "true" }),
      tb("Conseil de Liv", "Encadré « Le conseil de Liv »", function () {
        insertBlock('<aside class="tip"><p><strong>Le conseil de Liv</strong> Votre conseil ici…</p></aside>');
      }),
      tb("Image", "Insérer une image", function () { saveRange(); pickImage("insert"); }),
      tb("Instagram", "Insérer une photo Instagram", function () { saveRange(); pickInstagram("insert"); }),
      tb("Réservation", "Bloc réservation de la prestation liée", function () { insertBlock('<p data-ph="cta"></p>'); }),
      h("span", { class: "ad-sep", "aria-hidden": "true" }),
      tb("↶", "Annuler", function () { exec("undo"); }),
      tb("↷", "Rétablir", function () { exec("redo"); }));
    document.addEventListener("selectionchange", function onSel() {
      if (!document.body.contains(editor)) { document.removeEventListener("selectionchange", onSel); return; }
      toolbar.querySelectorAll("[data-cmd]").forEach(function (b) {
        var on = false;
        try { on = editor.contains(window.getSelection().anchorNode) && document.queryCommandState(b.dataset.cmd); } catch (e) { on = false; }
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
    });

    function editLink() {
      saveRange();
      var sel = window.getSelection();
      var anchor = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
      var existing = anchor && anchor.closest ? anchor.closest("a") : null;
      var url = input("lnk-url", existing ? existing.getAttribute("href") : "", { placeholder: "https://… ou choisissez une page du site" });
      var internal = h("select", { id: "lnk-int" }, h("option", { value: "", text: "— Choisir une page du site —" }),
        h("optgroup", { label: "Prestations" }, (S.settings.services || []).map(function (s) { return h("option", { value: "{{root}}services/" + s.slug + "/", text: s.name }); })),
        h("optgroup", { label: "Articles" }, S.articles.map(function (a) { return h("option", { value: "{{root}}blog/" + a.slug + "/", text: a.meta.title }); })),
        h("optgroup", { label: "Accueil" },
          h("option", { value: "{{root}}#tarifs", text: "Tarifs" }),
          h("option", { value: "{{root}}#contact", text: "Contact" }),
          h("option", { value: "{{root}}reservation/", text: "Page de réservation" })));
      internal.addEventListener("change", function () { if (internal.value) url.value = internal.value; });
      var actions = [{ label: "Annuler", value: null }];
      if (existing) actions.push({ label: "Retirer le lien", kind: "danger", value: "unlink" });
      actions.push({ label: "Appliquer", kind: "primary", value: function () { return url.value.trim(); } });
      openDialog({ title: "Lien", body: [field("lnk-int", "Lien interne", internal), field("lnk-url", "Adresse du lien", url, "Les liens internes commencent par {{root}} : ils fonctionnent quel que soit le nom de domaine.")], actions: actions })
        .then(function (v) {
          if (v === null || v === undefined) return;
          if (v === "unlink") { if (existing) { var r = document.createRange(); r.selectNodeContents(existing); savedRange = r; } exec("unlink"); return; }
          var href = safeHref(v);
          if (!href) { toast("Adresse de lien non valide.", "err"); return; }
          if (existing) { existing.setAttribute("href", href); markDirty(); return; }
          if (savedRange && !savedRange.collapsed) exec("createLink", href);
          else {
            var label = internal.value ? internal.options[internal.selectedIndex].text : href;
            insertInline('<a href="' + esc(href) + '">' + esc(label) + "</a>&nbsp;");
          }
        });
    }

    function editFigure(fig) {
      var img = fig.querySelector("img");
      var cap = fig.querySelector("figcaption");
      var alt = input("fig-alt", img.getAttribute("alt") || "", { maxlength: "160" });
      var caption = input("fig-cap", cap ? cap.textContent : "", { maxlength: "200" });
      openDialog({
        title: "Image",
        body: [h("img", { class: "ad-thumb", src: img.src || "", alt: "" }), field("fig-alt", "Texte alternatif (pour Google et l’accessibilité)", alt, "Décrivez l’image en quelques mots."), field("fig-cap", "Légende (facultatif)", caption)],
        actions: [{ label: "Supprimer l’image", kind: "danger", value: "delete" }, { label: "Annuler", value: null }, { label: "Appliquer", kind: "primary", value: "ok" }]
      }).then(function (v) {
        if (v === "delete") { fig.remove(); markDirty(); return; }
        if (v !== "ok") return;
        img.setAttribute("alt", alt.value.trim());
        var c = caption.value.trim();
        if (c) { if (!cap) { cap = document.createElement("figcaption"); fig.append(cap); } cap.textContent = c; }
        else if (cap) cap.remove();
        markDirty();
      });
    }

    // Sélecteurs d'images (téléversement, médiathèque, Instagram)
    function pickImage(purpose) {
      var fileIn = h("input", { type: "file", id: "pick-file", accept: "image/*" });
      var alt = input("pick-alt", "", { maxlength: "160", placeholder: "ex. Nuanciers de couleurs sur une table" });
      var caption = input("pick-cap", "", { maxlength: "200" });
      var chosen = null;
      var grid = h("div", { class: "ad-tiles" });
      allMediaNames().filter(function (n) { return n.indexOf("ig-") !== 0; }).forEach(function (n) {
        var src = mediaPreview(n, 480);
        var tile = h("div", { class: "ad-tile" },
          h("button", { type: "button", class: "ad-pick", "aria-label": "Choisir " + n, onclick: function () {
            chosen = n;
            grid.querySelectorAll(".ad-tile").forEach(function (t) { t.classList.remove("is-selected"); });
            tile.classList.add("is-selected");
          } }, src ? h("img", { src: src, alt: "" }) : h("div", { class: "ad-empty", text: "Aperçu indisponible" })),
          h("span", { class: "ad-tile-name", text: n }));
        grid.append(tile);
      });
      fileIn.addEventListener("change", function () {
        addPendingFiles(fileIn.files).then(function (names) {
          if (!names.length) return;
          chosen = names[0];
          grid.prepend(h("div", { class: "ad-tile is-selected" }, h("img", { src: S.pending[chosen].url, alt: "" }), h("span", { class: "ad-tile-name", text: chosen + " (nouvelle)" })));
        });
      });
      var body = [
        field("pick-file", "Téléverser une photo depuis votre appareil", fileIn, "La photo est réduite automatiquement (2000 px max)."),
        h("p", { class: "ad-muted", text: "Ou choisissez une image de la médiathèque :" }),
        grid,
        field("pick-alt", "Texte alternatif", alt, "Obligatoire : décrivez l’image pour Google et les lecteurs d’écran.")
      ];
      if (purpose === "insert") body.push(field("pick-cap", "Légende (facultatif)", caption));
      openDialog({
        title: purpose === "cover" ? "Photo de l’article" : "Insérer une image", wide: true, body: body,
        actions: [{ label: "Annuler", value: null }, {
          label: "Choisir", kind: "primary",
          validate: function () {
            if (!chosen) { toast("Choisissez ou téléversez une image.", "err"); return false; }
            if (!alt.value.trim()) { toast("Ajoutez un texte alternatif.", "err"); alt.focus(); return false; }
            return true;
          },
          value: function () { return { name: chosen, alt: alt.value.trim(), caption: caption.value.trim() }; }
        }]
      }).then(function (v) {
        if (!v) return;
        if (purpose === "cover") { meta.image = v.name; meta.image_alt = v.alt; drawCoverPhoto(); markDirty(); }
        else insertBlock(figureMarkup(v.name, v.alt, v.caption));
      });
    }
    function pickInstagram(purpose) {
      var grid = h("div", { class: "ad-tiles" });
      var status = h("div");
      var alt = input("pick-ig-alt", "", { maxlength: "160" });
      var caption = input("pick-ig-cap", "", { maxlength: "200" });
      var chosen = null;
      function addTile(p) {
        var src = igImageUrl(p);
        var tile = h("div", { class: "ad-tile" },
          h("button", { type: "button", class: "ad-pick", "aria-label": "Choisir cette publication", onclick: function () {
            chosen = p;
            grid.querySelectorAll(".ad-tile").forEach(function (t) { t.classList.remove("is-selected"); });
            tile.classList.add("is-selected");
            if (!alt.value) alt.value = (p.alt || p.caption || "").replace(/\s+/g, " ").trim().slice(0, 120);
          } }, h("img", { src: src || "", alt: "" })),
          h("div", { class: "ad-tile-cap", text: (p.caption || "").slice(0, 120) }));
        grid.append(tile);
      }
      var seen = {};
      S.instagram.posts.forEach(function (p) { seen[p.id] = true; addTile(S.igLive.get(p.id) ? Object.assign({}, p, S.igLive.get(p.id)) : p); });
      loading(status, "Lecture de vos publications Instagram…");
      loadIgMedia(false).then(function (list) {
        status.textContent = "";
        list.forEach(function (p) { if (!seen[p.id]) { seen[p.id] = true; addTile(p); } });
        if (!grid.children.length) status.append(h("p", { class: "ad-empty", text: "Aucune publication trouvée." }));
      }).catch(function (e) {
        status.textContent = "";
        status.append(h("p", { class: "ad-note" }, e.message + " ", h("a", { href: "#instagram", text: "Connecter Instagram" })));
      });
      var body = [status, grid, field("pick-ig-alt", "Texte alternatif", alt, "Obligatoire : décrivez la photo.")];
      if (purpose === "insert") body.push(field("pick-ig-cap", "Légende (facultatif)", caption));
      openDialog({
        title: "Photo Instagram", wide: true, body: body,
        actions: [{ label: "Annuler", value: null }, {
          label: "Choisir", kind: "primary",
          validate: function () {
            if (!chosen) { toast("Choisissez une publication.", "err"); return false; }
            if (!alt.value.trim()) { toast("Ajoutez un texte alternatif.", "err"); return false; }
            return true;
          },
          value: function () { return { post: chosen, alt: alt.value.trim(), caption: caption.value.trim() }; }
        }]
      }).then(function (v) {
        if (!v) return;
        var name = "ig-" + v.post.id;
        igUsed[v.post.id] = true;
        if (purpose === "cover") { meta.image = name; meta.image_alt = v.alt; drawCoverPhoto(); markDirty(); }
        else insertBlock(figureMarkup(name, v.alt, v.caption, v.post.permalink));
      });
    }
    var igUsed = {};

    function drawCover() {
      var w1 = fCover1.value.trim() || "Mot", w2 = fCover2.value.trim() || "script";
      coverPreview.textContent = "";
      coverPreview.append(h("div", { class: "cover", style: "--len:" + Math.max(w1.length, 4), "aria-hidden": "true" },
        h("span", { class: "cover-word", text: w1 }), h("span", { class: "cover-script", text: w2 })));
    }
    function drawCoverPhoto() {
      coverPhoto.textContent = "";
      if (meta.image) {
        var src = mediaPreview(meta.image, 480);
        coverPhoto.append(src ? h("img", { class: "ad-thumb", src: src, alt: "" }) : h("p", { class: "ad-muted", text: meta.image + " (en cours de traitement)" }));
        coverPhoto.append(field("ed-img-alt", "Texte alternatif de la photo", input("ed-img-alt", meta.image_alt || "", {
          maxlength: "160", oninput: function (e) { meta.image_alt = e.target.value; markDirty(); }
        })));
      } else {
        coverPhoto.append(h("p", { class: "ad-muted", text: "Facultatif : une photo affichée dans l’article (à la place de {{image}}, ou après l’introduction)." }));
      }
      coverPhoto.append(h("div", { class: "ad-actions" },
        h("button", { type: "button", class: "ad-btn-plain", text: "Médiathèque", onclick: function () { pickImage("cover"); } }),
        h("button", { type: "button", class: "ad-btn-plain", text: "Instagram", onclick: function () { pickInstagram("cover"); } }),
        meta.image ? h("button", { type: "button", class: "ad-btn-plain ad-btn-danger", text: "Retirer", onclick: function () { meta.image = null; meta.image_alt = ""; drawCoverPhoto(); markDirty(); } }) : null));
    }
    function drawFaq() {
      faqBox.textContent = "";
      meta.faq.forEach(function (item, i) {
        var q = input("faq-q-" + i, item.q, { oninput: function (e) { item.q = e.target.value; markDirty(); } });
        var a = textarea("faq-a-" + i, item.a, { rows: "2", oninput: function (e) { item.a = e.target.value; markDirty(); } });
        faqBox.append(h("div", { class: "ad-repeat-item" },
          h("div", { class: "ad-repeat-head" }, h("span", { text: "Question " + (i + 1) }),
            h("button", { type: "button", class: "ad-icon-btn", "aria-label": "Retirer la question " + (i + 1), text: "Retirer", onclick: function () { meta.faq.splice(i, 1); drawFaq(); markDirty(); } })),
          field("faq-q-" + i, "Question", q), field("faq-a-" + i, "Réponse", a)));
      });
      faqBox.append(h("div", { class: "ad-actions" }, h("button", { type: "button", class: "ad-btn-plain", text: "Ajouter une question", onclick: function () { meta.faq.push({ q: "", a: "" }); drawFaq(); markDirty(); } })));
    }

    // SEO : aperçu Google et liste de vérification
    var snippet = h("div", { class: "ad-snippet", "aria-label": "Aperçu dans Google" });
    var checklist = h("ul", { class: "ad-checklist" });
    var siteBase = location.origin + location.pathname.replace(/admin\/(index\.html)?$/, "");
    function updateSeo() {
      var body = cleanHtmlFromEditor(editor);
      var doc = new DOMParser().parseFromString("<body>" + body + "</body>", "text/html");
      var text = doc.body.textContent || "";
      var words = (text.match(/[A-Za-zÀ-ÿœŒ0-9’'-]+/g) || []).length;
      var h2 = doc.querySelectorAll("h2").length;
      var links = Array.prototype.filter.call(doc.querySelectorAll("a[href]"), function (a) { return /^\{\{root\}\}|^\.\.?\//.test(a.getAttribute("href")); }).length;
      var imgs = doc.querySelectorAll("img[data-media]");
      var allAlt = Array.prototype.every.call(imgs, function (i) { return (i.getAttribute("alt") || "").trim(); }) && (!fTitle.value || !meta.image || (meta.image_alt || "").trim());
      var firstP = doc.querySelector("p");
      var kw = norm(fKw.value.trim());
      var seo = fSeo.value.trim(), desc = fDesc.value.trim(), ex = fExcerpt.value.trim();
      var items = [
        [seo.length > 0 && seo.length <= 48, "Titre SEO de 48 caractères maximum (" + seo.length + ")"],
        [desc.length >= 140 && desc.length <= 158, "Description entre 140 et 158 caractères (" + desc.length + ")"]
      ];
      if (kw) {
        items.push([norm(fTitle.value + " " + seo).indexOf(kw) !== -1, "Mot-clé dans le titre"]);
        items.push([norm(desc).indexOf(kw) !== -1, "Mot-clé dans la description"]);
        items.push([!!firstP && norm(firstP.textContent).indexOf(kw) !== -1, "Mot-clé dans le premier paragraphe"]);
      } else items.push([null, "Ajoutez un mot-clé principal pour des conseils plus précis"]);
      items.push([h2 >= 3, "Au moins 3 titres de section (" + h2 + ")"]);
      items.push([words >= 600, "Au moins 600 mots (" + words + ")"]);
      items.push([links >= 2, "Au moins 2 liens vers d’autres pages du site (" + links + ")"]);
      items.push([allAlt, "Toutes les images ont un texte alternatif"]);
      items.push([!!(fCover1.value.trim() && fCover2.value.trim()), "Mots de couverture renseignés"]);
      items.push([ex.length > 0 && ex.length <= 180, "Extrait de 180 caractères maximum (" + ex.length + ")"]);
      checklist.textContent = "";
      items.forEach(function (it) {
        var cls = it[0] === null ? "info" : it[0] ? "ok" : "ko";
        checklist.append(h("li", { class: cls }, h("span", { class: "i", "aria-hidden": "true", text: it[0] === null ? "i" : it[0] ? "✓" : "✗" }),
          h("span", null, h("span", { class: "visually-hidden", text: it[0] === null ? "Conseil : " : it[0] ? "Validé : " : "À revoir : " }), it[1])));
      });
      var curSlug = fSlug.value.trim() || "adresse-de-l-article";
      snippet.textContent = "";
      snippet.append(
        h("div", { class: "s-url", text: siteBase.replace(/^https?:\/\//, "").replace(/\/$/, "") + " › blog › " + curSlug }),
        h("div", { class: "s-title", text: (seo || fTitle.value || "Titre de l’article") + " · Liv Curty" }),
        h("div", { class: "s-desc", text: desc ? (desc.length > 158 ? desc.slice(0, 155) + "…" : desc) : "La description apparaît ici. Rédigez 140 à 158 caractères qui donnent envie de cliquer." }));
    }
    var seoTimer = null;
    function markDirty() {
      dirty = true;
      dirtyLabel.textContent = "Modifications non enregistrées";
      clearTimeout(seoTimer);
      seoTimer = setTimeout(updateSeo, 350);
    }
    S.guard = function () { return dirty; };

    // Liaisons des champs
    fTitle.addEventListener("input", function () {
      if (!slugTouched && !source) fSlug.value = uniqueSlug(slugify(fTitle.value));
      markDirty();
    });
    fSlug.addEventListener("input", function () { slugTouched = true; markDirty(); });
    [fSeo, fDesc, fKw, fDate, fCat, fExcerpt].forEach(function (f) { f.addEventListener("input", markDirty); });
    fDraft.addEventListener("change", markDirty);
    fService.addEventListener("change", markDirty);
    [fCover1, fCover2].forEach(function (f) { f.addEventListener("input", function () { drawCover(); markDirty(); }); });

    function uniqueSlug(s) {
      var base = s || "article", out = base, i = 2;
      var taken = S.articles.map(function (a) { return a.slug; });
      while (taken.indexOf(out) !== -1 && (!source || out !== source.slug)) out = base + "-" + (i++);
      return out;
    }

    function collectMeta(asDraft) {
      var m = Object.assign({}, base, meta);
      m.title = fTitle.value.trim();
      m.seo_title = fSeo.value.trim();
      m.description = fDesc.value.trim();
      var kw = fKw.value.trim();
      if (kw) m.keyword = kw; else delete m.keyword;
      m.date = fDate.value || today();
      m.updated = today();
      m.category = fCat.value.trim();
      m.cover = [fCover1.value.trim(), fCover2.value.trim()];
      m.excerpt = fExcerpt.value.trim();
      m.service = fService.value;
      m.faq = meta.faq.filter(function (f) { return f.q.trim() && f.a.trim(); }).map(function (f) { return { q: f.q.trim(), a: f.a.trim() }; });
      m.draft = asDraft === undefined ? fDraft.checked : !!asDraft;
      if (typeof m.order !== "number") m.order = 50;
      if (!m.image) { m.image = null; m.image_alt = ""; }
      return m;
    }

    // Sauvegarde automatique locale
    var dirtyLabel = h("span", { class: "ad-dirty", "aria-live": "polite" });
    var autosaveTimer = setInterval(function () {
      if (!document.body.contains(editor)) { clearInterval(autosaveTimer); return; }
      if (!dirty) return;
      store.set("localStorage", autosaveKey, JSON.stringify({ meta: collectMeta(), body: cleanHtmlFromEditor(editor), slug: fSlug.value, at: Date.now() }));
    }, 5000);
    var restoreBox = h("div");
    var saved = getJSON("localStorage", autosaveKey);
    if (saved && saved.body !== undefined && (!source || saved.body !== cleanHtmlFromString(source.body) || JSON.stringify(saved.meta.title) !== JSON.stringify(source.meta.title))) {
      restoreBox.append(h("div", { class: "ad-note ad-restore" },
        h("span", { text: "Une version non enregistrée du " + new Date(saved.at).toLocaleString("fr-CH") + " existe sur cet appareil." }),
        h("span", { class: "ad-actions" },
          h("button", { type: "button", class: "ad-btn-plain", text: "Restaurer", onclick: function () {
            var m = saved.meta || {};
            fTitle.value = m.title || ""; fSeo.value = m.seo_title || ""; fDesc.value = m.description || ""; fKw.value = m.keyword || "";
            fDate.value = m.date || today(); fCat.value = m.category || ""; fExcerpt.value = m.excerpt || "";
            fCover1.value = (m.cover || [])[0] || ""; fCover2.value = (m.cover || [])[1] || "";
            if (m.service) fService.value = m.service;
            fDraft.checked = !!m.draft;
            meta.faq = Array.isArray(m.faq) ? m.faq : [];
            meta.image = m.image || null; meta.image_alt = m.image_alt || "";
            if (!source && saved.slug) fSlug.value = saved.slug;
            fillEditor(editor, saved.body);
            drawCover(); drawCoverPhoto(); drawFaq(); markDirty();
            restoreBox.textContent = "";
            [fSeo, fDesc, fExcerpt].forEach(function (f) { f.dispatchEvent(new Event("input")); });
          } }),
          h("button", { type: "button", class: "ad-btn-plain", text: "Ignorer", onclick: function () { store.del("localStorage", autosaveKey); restoreBox.textContent = ""; } }))));
    }

    // Enregistrement
    var btnDraft = h("button", { type: "button", class: "ad-btn-plain", text: "Enregistrer le brouillon", onclick: function () { save(true, btnDraft); } });
    var btnPublish = h("button", { type: "button", class: "btn btn--small", text: "Publier", onclick: function () { save(false, btnPublish); } });
    function save(asDraft, button) {
      var m = collectMeta(asDraft);
      var newSlug = fSlug.value.trim();
      if (!m.title) { toast("Ajoutez un titre.", "err"); fTitle.focus(); return; }
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(newSlug)) { toast("L’adresse ne doit contenir que des lettres minuscules, des chiffres et des tirets.", "err"); fSlug.disabled = false; fSlug.focus(); return; }
      if (S.articles.some(function (a) { return a.slug === newSlug && a !== source; })) { toast("Un autre article utilise déjà cette adresse.", "err"); fSlug.focus(); return; }
      if (!asDraft && (!m.description || !m.excerpt || !m.cover[0] || !m.cover[1])) {
        toast("Pour publier, complétez la description, l’extrait et les mots de couverture.", "err");
        return;
      }
      var body = cleanHtmlFromEditor(editor);
      var path = BLOG_DIR + "/" + newSlug + ".html";
      var changes = [{ path: path, text: serializeArticle(m, body) }];
      if (source && source.slug !== newSlug) changes.push({ path: source.path, delete: true });
      var used = {};
      body.replace(/data-media="([^"]+)"/g, function (_, n) { used[n] = true; return _; });
      if (m.image) used[m.image] = true;
      var usedNames = Object.keys(used);
      changes = changes.concat(pendingChanges(usedNames));
      // Photos Instagram utilisées : ajout à instagram.json avec des adresses fraîches
      var ig = clone(S.instagram), igChanged = false;
      usedNames.filter(function (n) { return n.indexOf("ig-") === 0; }).forEach(function (n) {
        var id = n.slice(3);
        var live = S.igLive.get(id);
        var existing = null;
        ig.posts.forEach(function (p) { if (p.id === id) existing = p; });
        if (!existing && live) { ig.posts.push(postFromLive(live, null)); igChanged = true; }
        else if (existing && live && (live.media_url !== existing.media_url || live.thumbnail_url !== existing.thumbnail_url)) {
          existing.media_url = live.media_url || ""; existing.thumbnail_url = live.thumbnail_url || ""; igChanged = true;
        }
      });
      if (igChanged) { ig.updated = new Date().toISOString(); changes.push({ path: INSTAGRAM_PATH, text: JSON.stringify(ig, null, 2) + "\n" }); }
      var msg = (asDraft ? "Brouillon : " : (source ? "Article mis à jour : " : "Nouvel article : ")) + m.title;
      commitWithFeedback(msg, changes, button).then(function () {
        markCommitted(usedNames);
        if (igChanged) S.instagram = ig;
        var entry = { slug: newSlug, path: path, meta: m, body: body };
        if (source) { var idx = S.articles.indexOf(source); S.articles[idx] = entry; } else S.articles.push(entry);
        sortArticles();
        store.del("localStorage", autosaveKey);
        dirty = false;
        S.guard = null;
        dirtyLabel.textContent = articleStatus(m).key === "plan" ? "Programmé pour le " + frDate(m.date) : asDraft ? "Brouillon enregistré" : "Publié";
        if (!source || source.slug !== newSlug) { S.ignoreHash = true; location.hash = "article/" + newSlug; S.route = "article/" + newSlug; source = entry; autosaveKey = AUTOSAVE_PREFIX + newSlug; fSlug.disabled = true; }
        else source = entry;
        fDraft.checked = !!m.draft;
      }).catch(function () {});
    }

    // Mise en page de l'éditeur
    var mainCol = h("div", { class: "ad-form" },
      restoreBox,
      h("div", { class: "ad-card" },
        field("ed-title", "Titre de l’article", fTitle),
        h("div", { class: "ad-row" },
          field("ed-slug", "Adresse (fin de l’URL)", fSlug, isNew ? "Créée à partir du titre. Elle ne change plus après la publication." : "Changer l’adresse modifie le lien public."),
          slugUnlock ? h("div", { class: "field" }, h("span", { class: "ad-hint", text: " " }), slugUnlock) : h("span")),
        h("div", { class: "ad-row" },
          field("ed-cat", "Catégorie", fCat), field("ed-service", "Prestation liée (bloc réservation)", fService)), catList),
      h("div", null, toolbar, editor),
      h("div", { class: "ad-card" }, h("h2", { text: "Questions fréquentes (facultatif)" }), h("p", { class: "ad-muted", text: "Affichées en fin d’article et comprises par Google." }), faqBox));
    var sideCol = h("div", { class: "ad-editor-side" },
      h("div", { class: "ad-card" }, h("h2", { text: "Publication" }),
        field("ed-date", "Date de publication", fDate, "Une date future programme l’article."),
        h("label", { class: "ad-check", for: "ed-draft" }, fDraft, h("span", { text: "Brouillon (non visible sur le site)" })),
        h("p", { class: "ad-hint", text: "Le dépôt GitHub est public : un brouillon n’apparaît pas sur le site, mais son texte reste lisible dans le code source du dépôt." })),
      h("div", { class: "ad-card" }, h("h2", { text: "Référencement" }),
        field("ed-seo", "Titre pour Google", fSeo, "« · Liv Curty » est ajouté automatiquement.", counter(fSeo, 0, 48)),
        field("ed-desc", "Description pour Google", fDesc, null, counter(fDesc, 140, 158)),
        field("ed-kw", "Mot-clé principal (facultatif)", fKw),
        snippet, checklist),
      h("div", { class: "ad-card" }, h("h2", { text: "Couverture" }),
        h("div", { class: "ad-row" }, field("ed-cover1", "Grand mot", fCover1), field("ed-cover2", "Mot manuscrit", fCover2)),
        coverPreview,
        field("ed-excerpt", "Extrait (cartes du blog)", fExcerpt, null, counter(fExcerpt, 0, 180))),
      h("div", { class: "ad-card" }, h("h2", { text: "Photo de l’article" }), coverPhoto));

    w.append(h("div", { class: "ad-editor-layout" }, mainCol, sideCol),
      h("div", { class: "ad-sticky-save" }, dirtyLabel, h("div", { class: "ad-actions" }, btnDraft, btnPublish)));
    drawCover(); drawCoverPhoto(); drawFaq(); updateSeo();
    if (dup) markDirty();
  }

  // ==========================================================================
  // 3. Instagram
  // ==========================================================================

  function viewInstagram() {
    var w = page("Instagram", "Choisissez les publications Instagram à afficher sur le site, ou à insérer dans un article.");
    var draft = clone(S.instagram);
    var dirty = false;
    S.guard = function () { return dirty; };
    function touch() { dirty = true; dirtyLabel.textContent = "Modifications non enregistrées"; }

    // Connexion
    var tokenIn = input("ig-token", (igToken() || {}).token || "", { type: "password", autocomplete: "off", spellcheck: "false" });
    var status = h("div", { class: "ad-muted" });
    function showStatus() {
      status.textContent = "";
      var tk = igToken(), days = igDaysLeft();
      if (isDemo()) { status.append(h("span", { text: "Mode démo : les photos ci-dessous sont des exemples tirés du site." })); return; }
      if (!tk) { status.append(h("span", { text: "Aucun jeton enregistré sur cet appareil." })); return; }
      status.append(h("span", { text: "Jeton enregistré sur cet appareil" + (days !== null ? ", valable encore " + days + " jour" + (days > 1 ? "s" : "") : "") + "." }));
    }
    var guide = h("details", { class: "ad-details" }, h("summary", { text: "Comment obtenir votre jeton Instagram (une seule fois)" }),
      h("ol", null,
        h("li", { text: "Passez votre compte Instagram en compte professionnel (Créateur ou Entreprise) : Paramètres → Type de compte et outils." }),
        h("li", { text: "Sur developers.facebook.com, créez une application (type « Entreprise ») et ajoutez le produit « Instagram API with Instagram Login »." }),
        h("li", { text: "Dans « Configuration de l’API », ajoutez votre compte Instagram, puis cliquez sur « Générer un jeton » et autorisez l’accès." }),
        h("li", { text: "Copiez le jeton (valable 60 jours) et collez-le ci-dessous. L’administration le prolonge automatiquement quand vous l’ouvrez." })),
      h("p", { class: "ad-hint", text: "Le jeton reste uniquement dans ce navigateur : il n’est jamais enregistré dans le dépôt GitHub." }));
    var connCard = h("div", { class: "ad-card" }, h("h2", { text: "Connexion" }),
      h("p", { class: "ad-muted", text: "Nécessite un compte Instagram professionnel et une application Meta gratuite." }),
      guide,
      isDemo() ? null : field("ig-token", "Jeton d’accès Instagram", tokenIn),
      status,
      isDemo() ? null : h("div", { class: "ad-actions" },
        h("button", { type: "button", class: "btn btn--small", text: "Tester la connexion", onclick: function (e) {
          var b = e.currentTarget, t = tokenIn.value.trim();
          if (!t) { toast("Collez d’abord votre jeton.", "err"); return; }
          var prev = igToken();
          if (!prev || prev.token !== t) setIgToken({ token: t, expires: null });
          b.disabled = true;
          igFetch("https://graph.instagram.com/me?fields=user_id,username,account_type,media_count&access_token=" + encodeURIComponent(t))
            .then(function (me) {
              toast("Connectée à @" + me.username + " (" + (me.media_count || 0) + " publications).", "ok");
              if (!draft.username) { draft.username = me.username; touch(); }
              showStatus();
              loadGrid(false);
            }).catch(function (err) { toast(err.message, "err"); })
            .finally(function () { b.disabled = false; });
        } }),
        h("button", { type: "button", class: "ad-btn-plain", text: "Prolonger le jeton", onclick: function () { refreshIgToken(false).then(showStatus); } }),
        h("button", { type: "button", class: "ad-btn-plain ad-btn-danger", text: "Oublier le jeton", onclick: function () { setIgToken(null); tokenIn.value = ""; showStatus(); toast("Jeton retiré de cet appareil.", "ok"); } })));
    showStatus();

    // Sélection actuelle
    var selBox = h("div", { class: "ad-tiles" });
    function drawSelection() {
      selBox.textContent = "";
      var sel = draft.posts.filter(function (p) { return p.show_on_home; });
      if (!sel.length) { selBox.append(h("p", { class: "ad-empty", text: "Aucune photo affichée sur le site pour l’instant. Choisissez-en dans vos publications ci-dessous." })); return; }
      sel.forEach(function (p, i) {
        var live = S.igLive.get(p.id);
        var altIn = input("ig-alt-" + p.id, p.alt || "", { maxlength: "120", oninput: function (e) { p.alt = e.target.value; touch(); } });
        selBox.append(h("div", { class: "ad-tile is-selected" },
          h("img", { src: igImageUrl(live ? Object.assign({}, p, live) : p) || "", alt: "" }),
          h("div", { class: "ad-tile-meta" }, h("span", { text: p.timestamp ? frDate(p.timestamp.slice(0, 10)) : "" }),
            h("span", { class: "ad-order" },
              h("button", { type: "button", class: "ad-icon-btn", "aria-label": "Monter", text: "↑", disabled: i === 0, onclick: function () { move(p, -1); } }),
              h("button", { type: "button", class: "ad-icon-btn", "aria-label": "Descendre", text: "↓", disabled: i === sel.length - 1, onclick: function () { move(p, 1); } }))),
          field("ig-alt-" + p.id, "Texte alternatif", altIn),
          h("button", { type: "button", class: "ad-btn-plain", text: "Retirer du site", onclick: function () { p.show_on_home = false; touch(); drawSelection(); drawGrid(); } })));
      });
    }
    function move(p, dir) {
      var sel = draft.posts.filter(function (x) { return x.show_on_home; });
      var i = sel.indexOf(p), j = i + dir;
      if (j < 0 || j >= sel.length) return;
      var a = draft.posts.indexOf(sel[i]), b = draft.posts.indexOf(sel[j]);
      var tmp = draft.posts[a]; draft.posts[a] = draft.posts[b]; draft.posts[b] = tmp;
      touch(); drawSelection();
    }

    // Publications récentes
    var grid = h("div", { class: "ad-tiles" });
    var gridStatus = h("div");
    var more = h("button", { type: "button", class: "ad-btn-plain", text: "Charger plus", hidden: true, onclick: function () { loadGrid(true); } });
    var liveOrder = [];
    function drawGrid() {
      grid.textContent = "";
      liveOrder.forEach(function (id) {
        var live = S.igLive.get(id);
        var stored = null;
        draft.posts.forEach(function (p) { if (p.id === id) stored = p; });
        var on = !!(stored && stored.show_on_home);
        var cb = h("input", { type: "checkbox", id: "ig-pick-" + id, checked: on, onchange: function (e) {
          if (e.target.checked) {
            if (stored) { stored.show_on_home = true; Object.assign(stored, { media_url: live.media_url || "", thumbnail_url: live.thumbnail_url || "", permalink: live.permalink || stored.permalink }); }
            else draft.posts.push(Object.assign(postFromLive(live, null), { show_on_home: true }));
          } else if (stored) stored.show_on_home = false;
          touch(); drawSelection(); drawGrid();
        } });
        grid.append(h("div", { class: "ad-tile" + (on ? " is-selected" : "") },
          on ? h("span", { class: "ad-badge ad-badge--plan", text: "Sur le site" }) : null,
          h("img", { src: igImageUrl(live) || "", alt: "", loading: "lazy" }),
          h("div", { class: "ad-tile-meta" }, h("span", { text: live.timestamp ? frDate(live.timestamp.slice(0, 10)) : "" }), h("span", { text: live.media_type === "VIDEO" ? "Vidéo" : live.media_type === "CAROUSEL_ALBUM" ? "Carrousel" : "Photo" })),
          h("div", { class: "ad-tile-cap", text: (live.caption || "").slice(0, 140) }),
          h("label", { class: "ad-check", for: "ig-pick-" + id }, cb, h("span", { text: "Afficher sur le site" }))));
      });
    }
    function loadGrid(append) {
      gridStatus.textContent = "";
      loading(gridStatus, "Lecture de vos publications…");
      loadIgMedia(append).then(function (list) {
        gridStatus.textContent = "";
        if (!append) liveOrder = [];
        list.forEach(function (p) { if (liveOrder.indexOf(p.id) === -1) liveOrder.push(p.id); });
        if (!liveOrder.length) gridStatus.append(h("p", { class: "ad-empty", text: "Aucune publication trouvée sur ce compte." }));
        more.hidden = !S.igNext;
        drawGrid(); drawSelection();
      }).catch(function (e) {
        gridStatus.textContent = "";
        gridStatus.append(h("p", { class: "ad-note", text: e.message }));
      });
    }

    var dirtyLabel = h("span", { class: "ad-dirty", "aria-live": "polite" });
    var saveBtn = h("button", { type: "button", class: "btn btn--small", text: "Enregistrer la sélection", onclick: function () {
      draft.updated = new Date().toISOString();
      var changes = [{ path: INSTAGRAM_PATH, text: JSON.stringify(draft, null, 2) + "\n" }];
      var chain = Promise.resolve();
      if (draft.username && !(S.settings.instagram && S.settings.instagram.username)) {
        chain = freshJSON(SETTINGS_PATH, S.settings).then(function (s) {
          s.instagram = Object.assign({ username: "", show_on_home: true, home_title: "Sur Instagram" }, s.instagram || {});
          s.instagram.username = draft.username;
          changes.push({ path: SETTINGS_PATH, text: JSON.stringify(s, null, 2) + "\n" });
          return s;
        });
      }
      chain.then(function (newSettings) {
        return commitWithFeedback("Instagram : sélection de photos", changes, saveBtn).then(function () {
          S.instagram = clone(draft);
          if (newSettings) S.settings = newSettings;
          dirty = false; S.guard = null;
          dirtyLabel.textContent = "Sélection enregistrée";
        });
      }).catch(function () {});
    } });

    w.append(connCard,
      h("div", { class: "ad-card" }, h("h2", { text: "Affichées sur le site" }),
        h("p", { class: "ad-muted", text: "Ces photos apparaissent dans la section Instagram de la page d’accueil, dans cet ordre. Les images sont copiées sur le site lors de la mise à jour." }),
        selBox),
      h("div", { class: "ad-card" }, h("h2", { text: "Vos dernières publications" }), gridStatus, grid, h("div", { class: "ad-actions" }, more)),
      h("div", { class: "ad-sticky-save" }, dirtyLabel, saveBtn));
    drawSelection();
    if (isDemo() || igToken()) loadGrid(false);
    else gridStatus.append(h("p", { class: "ad-note", text: "Connectez votre compte ci-dessus pour voir vos publications." }));
  }

  // ==========================================================================
  // 4. Médiathèque
  // ==========================================================================

  function viewMedia() {
    var w = page("Médiathèque", "Les photos du site et vos photos téléversées. Elles sont converties automatiquement en formats légers pour le web.");
    var fileIn = h("input", { type: "file", id: "media-file", accept: "image/*", multiple: true, class: "visually-hidden" });
    var drop = h("div", { class: "ad-drop" },
      h("p", { text: "Glissez vos photos ici" }),
      h("label", { class: "btn btn--small", for: "media-file", text: "Choisir des photos" }),
      h("p", { class: "ad-hint", text: "JPEG ou PNG. Réduites à 2000 px maximum avant l’envoi." }),
      fileIn);
    var grid = h("div", { class: "ad-tiles" });
    var count = h("p", { class: "ad-muted" });
    function upload(files) {
      addPendingFiles(files).then(function (names) {
        if (!names.length) return;
        commitWithFeedback("Médias : " + names.length + " photo" + (names.length > 1 ? "s" : ""), pendingChanges(names)).then(function () {
          markCommitted(names);
          draw();
        }).catch(function () {
          names.forEach(function (n) { delete S.pending[n]; });
          draw();
        });
        draw();
      });
    }
    fileIn.addEventListener("change", function () { upload(fileIn.files); fileIn.value = ""; });
    ["dragenter", "dragover"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("is-over"); }); });
    ["dragleave", "drop"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("is-over"); }); });
    drop.addEventListener("drop", function (e) { upload(e.dataTransfer.files); });

    function usage(name) {
      return S.articles.filter(function (a) { return a.meta.image === name || a.body.indexOf('data-media="' + name + '"') !== -1; });
    }
    function copy(text) {
      var done = function () { toast("Nom copié : " + text, "ok"); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { toast("Copie impossible ici. Nom : " + text); });
      } else toast("Nom : " + text);
    }
    function remove(name) {
      var used = usage(name);
      var msg = used.length ? "Attention : cette photo est utilisée dans " + used.length + " article(s) (" + used.map(function (a) { return a.meta.title; }).join(", ") + "). Elle n’y apparaîtra plus." : "La photo sera retirée de la médiathèque lors de la prochaine mise à jour du site.";
      confirmDialog("Supprimer « " + name + " » ?", msg, "Supprimer", true).then(function (ok) {
        if (!ok) return;
        var changes = [{ path: S.mediaFiles[name], delete: true }];
        var chain = Promise.resolve();
        if (S.manifest[name] && !isDemo()) {
          chain = S.store.listDir(IMG_DIR).then(function (files) {
            files.forEach(function (f) { if (f.name.indexOf(name + "-") === 0 && /^\d+\.webp$/.test(f.name.slice(name.length + 1))) changes.push({ path: f.path, delete: true }); });
          });
        }
        chain.then(function () {
          return commitWithFeedback("Médias : suppression de " + name, changes).then(function () {
            delete S.mediaFiles[name]; delete S.pending[name]; delete S.manifest[name];
            draw();
          });
        }).catch(function () {});
      });
    }
    function draw() {
      grid.textContent = "";
      var names = allMediaNames();
      count.textContent = names.length + " image" + (names.length > 1 ? "s" : "");
      if (!names.length) { grid.append(h("p", { class: "ad-empty", text: "Aucune image pour l’instant." })); return; }
      names.forEach(function (n) {
        var processed = isProcessed(n);
        var src = mediaPreview(n, 480);
        var isUpload = !!S.mediaFiles[n] || !!S.pending[n];
        var badge = !processed ? h("span", { class: "ad-badge ad-badge--plan", text: "En cours de traitement" })
          : n.indexOf("ig-") === 0 ? h("span", { class: "ad-badge", text: "Instagram" }) : null;
        grid.append(h("div", { class: "ad-tile" }, badge,
          src ? h("img", { src: src, alt: "", loading: "lazy" }) : h("div", { class: "ad-empty", text: "Aperçu après la mise à jour" }),
          h("span", { class: "ad-tile-name", text: n }),
          h("div", { class: "ad-actions" },
            h("button", { type: "button", class: "ad-btn-plain", text: "Copier le nom", onclick: function () { copy(n); } }),
            isUpload && S.mediaFiles[n] ? h("button", { type: "button", class: "ad-btn-plain ad-btn-danger", text: "Supprimer", onclick: function () { remove(n); } }) : null)));
      });
    }
    w.append(drop,
      h("p", { class: "ad-note" }, h("strong", { text: "Texte alternatif : " }), "quand vous insérez une photo dans un article, décrivez-la en quelques mots (ex. « Nuanciers de couleurs étalés sur une table »). C’est utile pour Google et pour les personnes malvoyantes."),
      h("div", { class: "ad-card" }, count, grid));
    draw();
  }

  // ==========================================================================
  // 5. Réservations
  // ==========================================================================

  function viewBooking() {
    var w = page("Réservations", "Vos disponibilités pour la page de réservation. Les clientes envoient une demande, vous confirmez par e-mail.", [
      h("a", { class: "ad-btn-plain", href: "../reservation/index.html", target: "_blank", rel: "noopener", text: "Voir la page" })
    ]);
    var b = Object.assign({
      enabled: true, provider: "email", web3forms_key: "", timezone: "Europe/Zurich", min_notice_hours: 48, horizon_days: 60,
      slot_step_minutes: 30, buffer_minutes: 30, weekly: {}, closed: [], booked: [], note: ""
    }, clone(S.settings.booking || {}));
    for (var d = 1; d <= 7; d++) if (!Array.isArray(b.weekly[String(d)])) b.weekly[String(d)] = [];
    var dirty = false;
    S.guard = function () { return dirty; };
    var dirtyLabel = h("span", { class: "ad-dirty", "aria-live": "polite" });
    function touch() { dirty = true; dirtyLabel.textContent = "Modifications non enregistrées"; drawPreview(); }

    // Général
    var general = h("div", { class: "ad-card" }, h("h2", { text: "Général" }),
      checkbox("bk-enabled", "Page de réservation active", b.enabled, function (e) { b.enabled = e.target.checked; touch(); }),
      h("div", { class: "ad-row" },
        field("bk-step", "Intervalle entre deux créneaux (minutes)", input("bk-step", b.slot_step_minutes, { type: "number", min: "5", step: "5", oninput: function (e) { b.slot_step_minutes = +e.target.value || 30; touch(); } })),
        field("bk-buffer", "Pause après une séance (minutes)", input("bk-buffer", b.buffer_minutes, { type: "number", min: "0", step: "5", oninput: function (e) { b.buffer_minutes = +e.target.value || 0; touch(); } }))),
      h("div", { class: "ad-row" },
        field("bk-notice", "Délai minimum avant un rendez-vous (heures)", input("bk-notice", b.min_notice_hours, { type: "number", min: "0", step: "1", oninput: function (e) { b.min_notice_hours = +e.target.value || 0; touch(); } })),
        field("bk-horizon", "Réservable jusqu’à (jours à l’avance)", input("bk-horizon", b.horizon_days, { type: "number", min: "1", step: "1", oninput: function (e) { b.horizon_days = +e.target.value || 60; touch(); } }))));

    // Semaine type
    var week = h("div", { class: "ad-week" });
    function drawWeek() {
      week.textContent = "";
      for (var dd = 1; dd <= 7; dd++) (function (day) {
        var ranges = b.weekly[String(day)];
        var list = h("div", { class: "ad-ranges" });
        if (!ranges.length) list.append(h("span", { class: "ad-muted", text: "Fermé" }));
        ranges.forEach(function (r, i) {
          var idA = "bk-w" + day + "-" + i + "-a", idB = "bk-w" + day + "-" + i + "-b";
          list.append(h("div", { class: "ad-range" },
            h("label", { class: "visually-hidden", for: idA, text: DAY_NAMES[day] + " début " + (i + 1) }),
            input(idA, r[0], { type: "time", step: "900", oninput: function (e) { r[0] = e.target.value; touch(); } }),
            h("span", { text: "–" }),
            h("label", { class: "visually-hidden", for: idB, text: DAY_NAMES[day] + " fin " + (i + 1) }),
            input(idB, r[1], { type: "time", step: "900", oninput: function (e) { r[1] = e.target.value; touch(); } }),
            h("button", { type: "button", class: "ad-icon-btn", "aria-label": "Retirer cette plage", text: "Retirer", onclick: function () { ranges.splice(i, 1); touch(); drawWeek(); } })));
        });
        list.append(h("div", null, h("button", { type: "button", class: "ad-btn-plain", text: "Ajouter une plage", onclick: function () {
          var last = ranges[ranges.length - 1];
          ranges.push(last ? [last[1], fromMin(Math.min(23 * 60 + 45, toMin(last[1]) + 180))] : ["09:00", "12:00"]);
          touch(); drawWeek();
        } })));
        week.append(h("div", { class: "ad-day" }, h("div", { class: "ad-day-name", text: DAY_NAMES[day] }), list));
      })(dd);
    }

    // Fermetures et créneaux pris
    var closedBox = h("div", { class: "ad-repeat" });
    function drawClosed() {
      closedBox.textContent = "";
      if (!b.closed.length) closedBox.append(h("p", { class: "ad-muted", text: "Aucune fermeture prévue." }));
      b.closed.forEach(function (c, i) {
        closedBox.append(h("div", { class: "ad-repeat-item ad-inline" },
          field("bk-c-from-" + i, "Du", input("bk-c-from-" + i, c.from, { type: "date", oninput: function (e) { c.from = e.target.value; if (!c.to || c.to < c.from) { c.to = c.from; } touch(); } })),
          field("bk-c-to-" + i, "Au", input("bk-c-to-" + i, c.to || c.from, { type: "date", oninput: function (e) { c.to = e.target.value; touch(); } })),
          field("bk-c-label-" + i, "Motif (visible)", input("bk-c-label-" + i, c.label || "", { placeholder: "Vacances", oninput: function (e) { c.label = e.target.value; touch(); } })),
          h("button", { type: "button", class: "ad-icon-btn", "aria-label": "Retirer cette fermeture", text: "Retirer", onclick: function () { b.closed.splice(i, 1); touch(); drawClosed(); } })));
      });
    }
    var bookedBox = h("div", { class: "ad-repeat" });
    function drawBooked() {
      bookedBox.textContent = "";
      if (!b.booked.length) bookedBox.append(h("p", { class: "ad-muted", text: "Aucun créneau bloqué." }));
      b.booked.forEach(function (k, i) {
        bookedBox.append(h("div", { class: "ad-repeat-item ad-inline" },
          field("bk-b-date-" + i, "Date", input("bk-b-date-" + i, k.date, { type: "date", oninput: function (e) { k.date = e.target.value; touch(); } })),
          field("bk-b-start-" + i, "De", input("bk-b-start-" + i, k.start, { type: "time", step: "900", oninput: function (e) { k.start = e.target.value; touch(); } })),
          field("bk-b-end-" + i, "À", input("bk-b-end-" + i, k.end, { type: "time", step: "900", oninput: function (e) { k.end = e.target.value; touch(); } })),
          field("bk-b-label-" + i, "Note (privée)", input("bk-b-label-" + i, k.label || "", { placeholder: "ex. Mme D., colorimétrie", oninput: function (e) { k.label = e.target.value; touch(); } })),
          h("button", { type: "button", class: "ad-icon-btn", "aria-label": "Retirer ce créneau", text: "Retirer", onclick: function () { b.booked.splice(i, 1); touch(); drawBooked(); } })));
      });
    }

    // Réception des demandes
    var keyField = field("bk-key", "Clé d’accès Web3Forms", input("bk-key", b.web3forms_key, { autocomplete: "off", oninput: function (e) { b.web3forms_key = e.target.value.trim(); touch(); } }), "Créez une clé gratuite sur web3forms.com avec votre adresse e-mail. Cette clé n’est pas secrète : elle peut figurer sur le site.");
    function radio(id, value, label) {
      return h("label", { class: "ad-check", for: id }, h("input", { type: "radio", name: "bk-provider", id: id, value: value, checked: b.provider === value, onchange: function () { b.provider = value; keyField.hidden = value !== "web3forms"; touch(); } }), h("span", { text: label }));
    }
    keyField.hidden = b.provider !== "web3forms";
    var reception = h("div", { class: "ad-card" }, h("h2", { text: "Réception des demandes" }),
      h("div", { class: "ad-radio-group", role: "radiogroup", "aria-label": "Mode de réception" },
        radio("bk-p-email", "email", "Par e-mail (le client envoie la demande depuis sa messagerie)"),
        radio("bk-p-w3f", "web3forms", "Web3Forms (vous recevez directement la demande par e-mail, clé gratuite sur web3forms.com)")),
      keyField,
      field("bk-note", "Message affiché sous le formulaire", textarea("bk-note", b.note, { rows: "3", oninput: function (e) { b.note = e.target.value; touch(); } })),
      h("p", { class: "ad-hint", text: "Rappel : le dépôt est public. Les notes des créneaux bloqués y sont lisibles ; évitez les noms complets." }));

    // Aperçu des créneaux
    var svcSel = h("select", { id: "bk-preview-svc" }, (S.settings.services || []).map(function (s) { return h("option", { value: s.slug, text: s.name + " (" + (s.duration_minutes || 60) + " min)" }); }));
    var preview = h("div", { class: "ad-slots" });
    function drawPreview() {
      var svc = (S.settings.services || []).filter(function (s) { return s.slug === svcSel.value; })[0] || {};
      var days = computeSlots(b, svc.duration_minutes || 60, 7);
      preview.textContent = "";
      if (!b.enabled) preview.append(h("p", { class: "ad-note", text: "La page de réservation est désactivée : elle invite à vous contacter directement." }));
      days.forEach(function (d) {
        var list = h("div", { class: "ad-slot-list" });
        if (d.closed) list.append(h("em", { text: d.closed }));
        else if (!d.slots.length) list.append(h("em", { text: "Aucun créneau" }));
        else d.slots.forEach(function (s) { list.append(h("span", { text: fromMin(s) })); });
        preview.append(h("div", { class: "ad-slot-day" }, h("span", { class: "d", text: frDate(d.date, { weekday: "short", day: "numeric", month: "short", year: undefined }) }), list));
      });
    }
    svcSel.addEventListener("change", drawPreview);

    var saveBtn = h("button", { type: "button", class: "btn btn--small", text: "Enregistrer", onclick: function () {
      var bad = false;
      Object.keys(b.weekly).forEach(function (k) { b.weekly[k].forEach(function (r) { if (!r[0] || !r[1] || toMin(r[1]) <= toMin(r[0])) bad = true; }); });
      if (bad) { toast("Une plage horaire est incomplète ou se termine avant de commencer.", "err"); return; }
      if (b.provider === "web3forms" && !b.web3forms_key) { toast("Ajoutez la clé Web3Forms, ou choisissez la réception par e-mail.", "err"); return; }
      b.closed = b.closed.filter(function (c) { return c.from; });
      b.booked = b.booked.filter(function (k) { return k.date && k.start && k.end; });
      freshJSON(SETTINGS_PATH, S.settings).then(function (s) {
        s.booking = b;
        return commitWithFeedback("Réservations : disponibilités", [{ path: SETTINGS_PATH, text: JSON.stringify(s, null, 2) + "\n" }], saveBtn).then(function () {
          S.settings = s; dirty = false; S.guard = null; dirtyLabel.textContent = "Disponibilités enregistrées";
        });
      }).catch(function () {});
    } });

    w.append(
      h("div", { class: "ad-grid ad-grid--2" },
        general,
        h("div", { class: "ad-card" }, h("h2", { text: "Aperçu des 7 prochains jours" }), field("bk-preview-svc", "Pour la prestation", svcSel), preview)),
      h("div", { class: "ad-card" }, h("h2", { text: "Semaine type" }), h("p", { class: "ad-muted", text: "Heure de Genève. Les créneaux proposés tiennent compte de la durée de chaque prestation et de la pause." }), week),
      h("div", { class: "ad-grid ad-grid--2" },
        h("div", { class: "ad-card" }, h("h2", { text: "Fermetures (vacances, jours fériés)" }), closedBox,
          h("div", { class: "ad-actions" }, h("button", { type: "button", class: "ad-btn-plain", text: "Ajouter une fermeture", onclick: function () { b.closed.push({ from: today(), to: today(), label: "" }); touch(); drawClosed(); } }))),
        h("div", { class: "ad-card" }, h("h2", { text: "Créneaux déjà pris" }), h("p", { class: "ad-muted", text: "Ajoutez ici les rendez-vous confirmés : ils disparaissent de la page publique." }), bookedBox,
          h("div", { class: "ad-actions" }, h("button", { type: "button", class: "ad-btn-plain", text: "Bloquer un créneau", onclick: function () { b.booked.push({ date: today(), start: "09:00", end: "12:00", label: "" }); touch(); drawBooked(); } })))),
      reception,
      h("div", { class: "ad-sticky-save" }, dirtyLabel, saveBtn));
    drawWeek(); drawClosed(); drawBooked(); drawPreview();
  }

  // ==========================================================================
  // 6. Réglages
  // ==========================================================================

  function viewSettings() {
    var w = page("Réglages", "Coordonnées, bannière d’annonce, tarifs et questions fréquentes.");
    var s = clone(S.settings);
    s.contact = Object.assign({ email: "", phone: "", city: "" }, s.contact || {});
    s.instagram = Object.assign({ username: "", show_on_home: true, home_title: "Sur Instagram" }, s.instagram || {});
    s.banner = Object.assign({ active: false, text: "", link_label: "", link: "" }, s.banner || {});
    s.services = s.services || [];
    s.home_faq = s.home_faq || [];
    var dirty = false;
    S.guard = function () { return dirty; };
    var dirtyLabel = h("span", { class: "ad-dirty", "aria-live": "polite" });
    function touch() { dirty = true; dirtyLabel.textContent = "Modifications non enregistrées"; }
    function bind(obj, key, transform) { return function (e) { obj[key] = transform ? transform(e.target.value) : e.target.value; touch(); }; }

    var contact = h("div", { class: "ad-card" }, h("h2", { text: "Coordonnées" }),
      h("div", { class: "ad-row--3 ad-row" },
        field("st-email", "E-mail", input("st-email", s.contact.email, { type: "email", oninput: bind(s.contact, "email") })),
        field("st-phone", "Téléphone", input("st-phone", s.contact.phone, { type: "tel", oninput: bind(s.contact, "phone") })),
        field("st-city", "Ville", input("st-city", s.contact.city, { oninput: bind(s.contact, "city") }))));

    var igCard = h("div", { class: "ad-card" }, h("h2", { text: "Instagram sur le site" }),
      h("div", { class: "ad-row" },
        field("st-ig-user", "Nom du compte (sans @)", input("st-ig-user", s.instagram.username, { oninput: bind(s.instagram, "username", function (v) { return v.replace(/^@/, "").trim(); }) })),
        field("st-ig-title", "Titre de la section", input("st-ig-title", s.instagram.home_title, { oninput: bind(s.instagram, "home_title") }))),
      checkbox("st-ig-home", "Afficher la section Instagram sur la page d’accueil", s.instagram.show_on_home, function (e) { s.instagram.show_on_home = e.target.checked; touch(); }));

    var bannerPreview = h("div");
    function drawBanner() {
      bannerPreview.textContent = "";
      if (!s.banner.active || !s.banner.text) { bannerPreview.append(h("p", { class: "ad-muted", text: "Bannière désactivée." })); return; }
      bannerPreview.append(h("div", { class: "ad-banner-preview" }, h("span", { text: s.banner.text }), s.banner.link && s.banner.link_label ? h("a", { href: "#", text: s.banner.link_label + " →", onclick: function (e) { e.preventDefault(); } }) : null));
    }
    function bindB(key) { return function (e) { s.banner[key] = e.target.value; touch(); drawBanner(); }; }
    var banner = h("div", { class: "ad-card" }, h("h2", { text: "Bannière d’annonce" }),
      h("p", { class: "ad-muted", text: "Un bandeau en haut de toutes les pages, par exemple pour une offre ou des vacances." }),
      checkbox("st-b-active", "Afficher la bannière", s.banner.active, function (e) { s.banner.active = e.target.checked; touch(); drawBanner(); }),
      field("st-b-text", "Texte", input("st-b-text", s.banner.text, { maxlength: "140", oninput: bindB("text") })),
      h("div", { class: "ad-row" },
        field("st-b-label", "Texte du lien (facultatif)", input("st-b-label", s.banner.link_label, { oninput: bindB("link_label") })),
        field("st-b-link", "Adresse du lien", input("st-b-link", s.banner.link, { placeholder: "{{root}}reservation/ ou https://…", oninput: bindB("link") }))),
      bannerPreview);

    var services = h("div", { class: "ad-card" }, h("h2", { text: "Prestations et tarifs" }),
      h("p", { class: "ad-muted", text: "Les textes plus longs (étapes, questions par prestation) restent modifiables dans settings.json." }));
    s.services.forEach(function (svc, si) {
      svc.prices = svc.prices || [];
      svc.format = svc.format || [];
      var prices = h("div", { class: "ad-repeat" });
      function drawPrices() {
        prices.textContent = "";
        svc.prices.forEach(function (p, pi) {
          prices.append(h("div", { class: "ad-inline" },
            field("sv-" + si + "-p-" + pi + "-a", "Prix (CHF)", input("sv-" + si + "-p-" + pi + "-a", p.amount, { type: "number", min: "0", step: "1", oninput: function (e) { p.amount = +e.target.value || 0; touch(); } })),
            field("sv-" + si + "-p-" + pi + "-l", "Précision (facultatif)", input("sv-" + si + "-p-" + pi + "-l", p.label || "", { placeholder: "ex. en ligne", oninput: function (e) { p.label = e.target.value; touch(); } })),
            h("button", { type: "button", class: "ad-icon-btn", "aria-label": "Retirer ce prix", text: "Retirer", disabled: svc.prices.length <= 1, onclick: function () { svc.prices.splice(pi, 1); touch(); drawPrices(); } })));
        });
        prices.append(h("div", null, h("button", { type: "button", class: "ad-btn-plain", text: "Ajouter un prix", onclick: function () { svc.prices.push({ amount: 0, label: "" }); touch(); drawPrices(); } })));
      }
      drawPrices();
      var formats = h("div", { class: "ad-inline" }, FORMATS.map(function (f, fi) {
        return checkbox("sv-" + si + "-f-" + fi, f, svc.format.indexOf(f) !== -1, function (e) {
          var set = FORMATS.filter(function (x) { return x === f ? e.target.checked : svc.format.indexOf(x) !== -1; });
          svc.format = set;
          touch();
        });
      }));
      var desc = textarea("sv-" + si + "-desc", svc.description || "", { rows: "3", oninput: bind(svc, "description") });
      services.append(h("details", { class: "ad-service" }, h("summary", { text: svc.name || svc.slug }),
        h("div", { class: "ad-form" },
          h("div", { class: "ad-row" },
            field("sv-" + si + "-name", "Nom", input("sv-" + si + "-name", svc.name, { oninput: bind(svc, "name") })),
            field("sv-" + si + "-dur", "Durée (texte affiché)", input("sv-" + si + "-dur", svc.duration, { placeholder: "ex. 1 h à 1 h 30", oninput: bind(svc, "duration") }))),
          h("div", { class: "ad-row" },
            field("sv-" + si + "-min", "Durée réservée (minutes)", input("sv-" + si + "-min", svc.duration_minutes, { type: "number", min: "15", step: "15", oninput: bind(svc, "duration_minutes", function (v) { return +v || 60; }) }), "Utilisée pour calculer les créneaux."),
            h("div", { class: "field" }, h("span", { class: "ad-hint", text: "Format" }), formats)),
          h("div", null, h("h3", { text: "Tarifs" }), prices),
          field("sv-" + si + "-lead", "Phrase de présentation", textarea("sv-" + si + "-lead", svc.lead, { rows: "2", oninput: bind(svc, "lead") })),
          field("sv-" + si + "-inc", "Ce qui est inclus (une ligne par élément)", textarea("sv-" + si + "-inc", (svc.included || []).join("\n"), { rows: "6", oninput: bind(svc, "included", function (v) { return v.split("\n").map(function (x) { return x.trim(); }).filter(Boolean); }) })),
          field("sv-" + si + "-desc", "Description pour Google", desc, "Pensez à la mettre à jour si elle mentionne un prix.", counter(desc, 140, 158)))));
    });

    var faqBox = h("div", { class: "ad-repeat" });
    function drawFaq() {
      faqBox.textContent = "";
      s.home_faq.forEach(function (item, i) {
        faqBox.append(h("div", { class: "ad-repeat-item" },
          h("div", { class: "ad-repeat-head" }, h("span", { text: "Question " + (i + 1) }),
            h("span", { class: "ad-order" },
              h("button", { type: "button", class: "ad-icon-btn", "aria-label": "Monter", text: "↑", disabled: i === 0, onclick: function () { var t = s.home_faq[i - 1]; s.home_faq[i - 1] = item; s.home_faq[i] = t; touch(); drawFaq(); } }),
              h("button", { type: "button", class: "ad-icon-btn", "aria-label": "Retirer la question " + (i + 1), text: "Retirer", onclick: function () { s.home_faq.splice(i, 1); touch(); drawFaq(); } }))),
          field("hf-q-" + i, "Question", input("hf-q-" + i, item.q, { oninput: bind(item, "q") })),
          field("hf-a-" + i, "Réponse", textarea("hf-a-" + i, item.a, { rows: "3", oninput: bind(item, "a") }))));
      });
      faqBox.append(h("div", null, h("button", { type: "button", class: "ad-btn-plain", text: "Ajouter une question", onclick: function () { s.home_faq.push({ q: "", a: "" }); touch(); drawFaq(); } })));
    }
    var faq = h("div", { class: "ad-card" }, h("h2", { text: "Questions fréquentes de l’accueil" }), faqBox);

    var saveBtn = h("button", { type: "button", class: "btn btn--small", text: "Enregistrer les réglages", onclick: function () {
      if (s.contact.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.contact.email)) { toast("L’adresse e-mail ne semble pas valide.", "err"); return; }
      if (s.services.some(function (x) { return !x.prices.length || x.prices.some(function (p) { return !(p.amount > 0); }); })) { toast("Chaque prestation doit avoir au moins un prix supérieur à 0.", "err"); return; }
      if (s.services.some(function (x) { return !x.format.length; })) { toast("Choisissez au moins un format pour chaque prestation.", "err"); return; }
      freshJSON(SETTINGS_PATH, S.settings).then(function (fresh) {
        fresh.contact = Object.assign({}, fresh.contact || {}, s.contact);
        fresh.instagram = Object.assign({}, fresh.instagram || {}, s.instagram);
        fresh.banner = Object.assign({}, fresh.banner || {}, s.banner);
        fresh.home_faq = s.home_faq.filter(function (f) { return f.q.trim() && f.a.trim(); });
        fresh.services = (fresh.services || []).map(function (old) {
          var edit = s.services.filter(function (x) { return x.slug === old.slug; })[0];
          if (!edit) return old;
          return Object.assign({}, old, {
            name: edit.name, duration: edit.duration, duration_minutes: edit.duration_minutes, format: edit.format,
            prices: edit.prices.map(function (p) { return { amount: p.amount, label: (p.label || "").trim() }; }),
            lead: edit.lead, included: edit.included, description: edit.description
          });
        });
        return commitWithFeedback("Réglages du site", [{ path: SETTINGS_PATH, text: JSON.stringify(fresh, null, 2) + "\n" }], saveBtn).then(function () {
          S.settings = fresh; dirty = false; S.guard = null; dirtyLabel.textContent = "Réglages enregistrés";
        });
      }).catch(function () {});
    } });

    w.append(contact, igCard, banner, services, faq, h("div", { class: "ad-sticky-save" }, dirtyLabel, saveBtn));
    drawBanner(); drawFaq();
  }

  // ==========================================================================
  // 7. Aide
  // ==========================================================================

  function viewHelp() {
    var w = page("Aide", "Tout ce qu’il faut savoir pour faire vivre le site.");
    function sec(title, nodes) { return h("div", { class: "ad-card ad-help" }, h("h2", { text: title }), nodes); }
    w.append(
      sec("Comment la publication fonctionne", [
        h("p", { text: "Chaque bouton « Enregistrer » ou « Publier » envoie vos changements dans le dépôt GitHub du site. Une mise à jour automatique (l’action « site ») régénère alors toutes les pages, convertit les photos et republie le site. Comptez 2 à 3 minutes." }),
        h("p", { text: "Le tableau de bord affiche l’état des dernières mises à jour. En cas d’échec, rien n’est perdu : corrigez et enregistrez à nouveau, ou cliquez sur « Republier le site »." })
      ]),
      sec("Articles programmés et brouillons", [
        h("ul", null,
          h("li", { text: "Une date de publication future programme l’article : il apparaît automatiquement ce jour-là (le site se régénère chaque matin)." }),
          h("li", { text: "Un brouillon n’est jamais affiché sur le site. Attention : le dépôt GitHub est public, le texte d’un brouillon y reste lisible." }),
          h("li", { text: "Votre travail en cours est aussi sauvegardé sur cet appareil toutes les quelques secondes." }))
      ]),
      sec("Le jeton GitHub (pour vous connecter)", [
        h("ol", null,
          h("li", { text: "Sur github.com, ouvrez Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token." }),
          h("li", { text: "Repository access : « Only select repositories », puis ce dépôt uniquement." }),
          h("li", { text: "Permissions : Contents en lecture et écriture ; Actions en lecture et écriture (facultatif, pour l’état des mises à jour et « Republier »)." }),
          h("li", { text: "Choisissez une date d’expiration, générez le jeton, copiez-le et collez-le dans l’écran de connexion." })),
        h("p", { class: "ad-hint", text: "Le jeton reste dans ce navigateur. Sur un appareil partagé, décochez « Rester connectée »." })
      ]),
      sec("Le jeton Instagram", [
        h("p", { text: "Il faut un compte Instagram professionnel (Créateur ou Entreprise) et une application gratuite sur developers.facebook.com avec le produit « Instagram API with Instagram Login ». Le guide pas à pas se trouve dans la section Instagram." }),
        h("p", { text: "Le jeton est valable 60 jours. Il est prolongé automatiquement à chaque ouverture de l’administration s’il expire dans moins de 15 jours. S’il a expiré, générez-en un nouveau et collez-le à nouveau." })
      ]),
      sec("Besoin d’aide ?", [
        h("p", { text: "Pour une évolution du site (nouvelle page, nouvelle fonction) ou un problème technique, contactez la personne qui gère le développement du site, en précisant la page concernée et ce que vous avez essayé." })
      ]));
  }

  // ==========================================================================
  // Connexion
  // ==========================================================================

  function savedAuth() {
    return getJSON("localStorage", AUTH_KEY) || getJSON("sessionStorage", AUTH_KEY);
  }
  function logout() {
    var leave = function () {
      store.del("localStorage", AUTH_KEY);
      store.del("sessionStorage", AUTH_KEY);
      S.store = null;
      S.guard = null;
      history.replaceState(null, "", location.pathname);
      renderLogin();
    };
    if (S.guard && S.guard()) {
      confirmDialog("Modifications non enregistrées", "Se déconnecter quand même ? Les changements en cours seront perdus.", "Se déconnecter", true).then(function (ok) { if (ok) leave(); });
    } else leave();
  }
  function renderLogin(message) {
    root = document.getElementById("ad-root");
    root.textContent = "";
    var prev = savedAuth() || {};
    var tokenIn = input("lg-token", "", { type: "password", autocomplete: "off", spellcheck: "false", required: true });
    var repoIn = input("lg-repo", prev.repo || DEFAULT_REPO, { required: true, spellcheck: "false" });
    var branchIn = input("lg-branch", prev.branch || DEFAULT_BRANCH, { required: true, spellcheck: "false" });
    var remember = h("input", { type: "checkbox", id: "lg-remember", checked: true });
    var msg = h("div", { "aria-live": "polite" });
    if (message) msg.append(h("p", { class: "ad-error", text: message }));
    var demoBtn = h("button", { type: "button", class: "btn btn--ghost", text: "Découvrir en mode démo", onclick: startDemo });
    var submit = h("button", { type: "submit", class: "btn", text: "Se connecter" });
    var form = h("form", { class: "ad-form", onsubmit: function (e) {
      e.preventDefault();
      var cfg = { token: tokenIn.value.trim(), repo: repoIn.value.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\/$/, ""), branch: branchIn.value.trim() };
      if (!cfg.token || !/^[\w.-]+\/[\w.-]+$/.test(cfg.repo) || !cfg.branch) {
        msg.textContent = "";
        msg.append(h("p", { class: "ad-error", text: "Renseignez le jeton, le dépôt (propriétaire/nom) et la branche." }));
        return;
      }
      submit.disabled = true;
      submit.textContent = "Vérification…";
      var gh = new GitHubStore(cfg);
      gh.check().then(function (repo) {
        if (repo && repo.permissions && repo.permissions.push === false) throw new Error("Ce jeton peut lire le dépôt mais pas y écrire. Ajoutez l’autorisation « Contents : Read and write ».");
        var area = remember.checked ? "localStorage" : "sessionStorage";
        store.del(remember.checked ? "sessionStorage" : "localStorage", AUTH_KEY);
        store.set(area, AUTH_KEY, JSON.stringify(cfg));
        start(gh);
      }).catch(function (err) {
        msg.textContent = "";
        if (err instanceof TypeError || /fetch|network|Load failed/i.test(err.message)) {
          msg.append(h("p", { class: "ad-error", text: "Impossible de joindre GitHub depuis cette page (connexion ou restrictions du navigateur)." }),
            h("p", { class: "ad-note", text: "Vous pouvez quand même découvrir l’administration en mode démo." }));
          demoBtn.focus();
        } else msg.append(h("p", { class: "ad-error", text: err.message }));
      }).finally(function () { submit.disabled = false; submit.textContent = "Se connecter"; });
    } },
      field("lg-token", "Jeton GitHub", tokenIn),
      h("div", { class: "ad-row" }, field("lg-repo", "Dépôt", repoIn), field("lg-branch", "Branche", branchIn)),
      h("label", { class: "ad-check", for: "lg-remember" }, remember, h("span", { text: "Rester connectée sur cet appareil" })),
      msg, submit);
    var help = h("details", { class: "ad-details" }, h("summary", { text: "Comment créer votre jeton GitHub" }),
      h("ol", null,
        h("li", { text: "github.com → Settings → Developer settings → Personal access tokens → Fine-grained tokens." }),
        h("li", { text: "« Generate new token », Repository access : « Only select repositories », puis ce dépôt." }),
        h("li", { text: "Permissions : Contents → Read and write ; Actions → Read and write (facultatif) ; Metadata → Read (automatique)." }),
        h("li", { text: "Générez, copiez le jeton et collez-le ci-dessus. Il reste uniquement dans ce navigateur." })));
    root.append(h("div", { class: "ad-login" }, h("div", { class: "ad-card ad-login-card" },
      h("span", { class: "ad-brand" }, h("img", { src: "../assets/logo.svg", alt: "Liv Curty", width: "572", height: "204" }), h("span", { text: "Administration" })),
      h("h1", { text: "Bienvenue" }),
      h("p", { class: "ad-muted", text: "Connectez-vous avec votre jeton GitHub pour gérer les articles, les photos Instagram, les réservations et les tarifs." }),
      form, help,
      h("div", { class: "ad-or", text: "ou" }),
      demoBtn,
      h("p", { class: "ad-hint", text: "Le mode démo utilise une copie du site : rien n’est enregistré." }))));
    tokenIn.focus();
  }
  function startDemo() {
    var demo = new DemoStore();
    root.textContent = "";
    root.append(h("p", { class: "ad-boot ad-loading", text: "Préparation de la démo…" }));
    demo.init().then(function () { start(demo); }).catch(function (e) { renderLogin(e.message); });
  }
  function start(st) {
    S.store = st;
    S.pending = {};
    S.igLive = new Map();
    root.textContent = "";
    root.append(h("p", { class: "ad-boot ad-loading", text: "Lecture du contenu du site…" }));
    loadAll().then(function () {
      renderShell();
      autoRefreshIg();
      render();
    }).catch(function (e) {
      if (st.mode === "github") renderLogin("Lecture du site impossible : " + e.message);
      else renderLogin(e.message);
    });
  }

  // ==========================================================================
  // Démarrage
  // ==========================================================================

  function boot() {
    window.addEventListener("hashchange", function () { if (S.store) onHashChange(); });
    var auth = savedAuth();
    if (auth && auth.token) start(new GitHubStore(auth));
    else renderLogin();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
