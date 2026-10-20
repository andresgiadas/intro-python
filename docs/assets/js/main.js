/* Liv Curty — interactions légères (aucune dépendance, aucun traceur). */
(function () {
  "use strict";

  // En-tête : filet discret dès qu'on défile
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () { header.classList.toggle("is-scrolled", window.scrollY > 8); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // Menu mobile
  var nav = document.querySelector(".nav");
  var toggle = document.querySelector(".nav-toggle");
  if (nav && toggle) {
    var setOpen = function (open) {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.querySelector(".nav-toggle-label").textContent = open ? "Fermer" : "Menu";
      document.body.classList.toggle("menu-open", open);
    };
    toggle.addEventListener("click", function () { setOpen(!nav.classList.contains("is-open")); });
    nav.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") setOpen(false); });
  }

  // Formulaire de contact : prépare un e-mail dans la messagerie du visiteur
  var form = document.querySelector("#contact-form");
  if (form) {
    var status = form.querySelector(".form-status");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var data = new FormData(form);
      var service = data.get("service") || "Demande d’information";
      var lines = [
        "Bonjour Liv,",
        "",
        String(data.get("message") || "").trim(),
        "",
        "Prestation : " + service,
        "Nom : " + String(data.get("name") || "").trim(),
        "E-mail : " + String(data.get("email") || "").trim()
      ];
      var phone = String(data.get("phone") || "").trim();
      if (phone) lines.push("Téléphone : " + phone);
      var href = "mailto:" + form.dataset.to +
        "?subject=" + encodeURIComponent("Demande de rendez-vous · " + service) +
        "&body=" + encodeURIComponent(lines.join("\n"));
      window.location.href = href;
      if (status) {
        status.textContent = "Votre messagerie s’ouvre avec le message prérempli. Si rien ne se passe, écrivez directement à " + form.dataset.to + ".";
      }
    });
  }

  // Bouton « Copier » de l'adresse e-mail
  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var value = btn.getAttribute("data-copy");
      var done = function () {
        var label = btn.textContent;
        btn.textContent = "Copié";
        setTimeout(function () { btn.textContent = label; }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(done, function () {});
      }
    });
  });

  // Sommaire d'article : surligne la section en cours de lecture
  var tocLinks = document.querySelectorAll(".toc a");
  if (tocLinks.length && "IntersectionObserver" in window) {
    var byId = {};
    tocLinks.forEach(function (a) { byId[a.getAttribute("href").split("#")[1]] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          tocLinks.forEach(function (a) { a.classList.remove("is-active"); });
          var link = byId[entry.target.id];
          if (link) link.classList.add("is-active");
        }
      });
    }, { rootMargin: "-20% 0px -70% 0px" });
    document.querySelectorAll(".prose h2[id]").forEach(function (h) { io.observe(h); });
  }
})();
