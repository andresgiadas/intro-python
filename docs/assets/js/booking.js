/* Liv Curty — page de réservation : prestation, calendrier des créneaux, envoi de la demande.
   Les règles (horaires, fermetures, créneaux pris) viennent de l'admin via settings.json. */
(function () {
  "use strict";

  var form = document.getElementById("booking-form");
  var dataEl = document.getElementById("booking-data");
  if (!form || !dataEl) return;
  var data = JSON.parse(dataEl.textContent);
  var rules = data.rules;
  var DAY = 86400000;

  // ---------- Dates : tout est calculé en heure de Genève, sur des jours « YYYY-MM-DD » ----------
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function toIso(idx) { var d = new Date(idx * DAY); return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()); }
  function toIdx(iso) { var p = iso.split("-"); return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / DAY); }
  function minutes(hhmm) { var p = hhmm.split(":"); return +p[0] * 60 + +p[1]; }
  function hhmm(m) { return pad(Math.floor(m / 60)) + ":" + pad(m % 60); }
  function isoWeekday(idx) { return ((new Date(idx * DAY).getUTCDay() + 6) % 7) + 1; }

  function nowInGeneva() {
    var parts = {};
    new Intl.DateTimeFormat("en-CA", {
      timeZone: rules.timezone || "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(new Date()).forEach(function (p) { parts[p.type] = p.value; });
    var idx = toIdx(parts.year + "-" + parts.month + "-" + parts.day);
    return { idx: idx, abs: idx * 1440 + (+parts.hour) * 60 + (+parts.minute) };
  }

  var fmtLong = new Intl.DateTimeFormat("fr-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  var fmtMonth = new Intl.DateTimeFormat("fr-CH", { month: "long", year: "numeric", timeZone: "UTC" });
  function longDate(iso) { return fmtLong.format(new Date(toIdx(iso) * DAY)); }

  function isClosed(iso) {
    return (rules.closed || []).some(function (c) { return iso >= c.from && iso <= (c.to || c.from); });
  }

  // Créneaux de départ libres pour un jour et une durée donnés
  function slotsFor(iso, duration) {
    var idx = toIdx(iso);
    var now = nowInGeneva();
    if (idx > now.idx + (rules.horizon_days || 60) || isClosed(iso)) return [];
    var ranges = (rules.weekly || {})[String(isoWeekday(idx))] || [];
    var step = rules.slot_step_minutes || 30;
    var buffer = rules.buffer_minutes || 0;
    var earliest = now.abs + (rules.min_notice_hours || 0) * 60;
    var booked = (rules.booked || []).filter(function (b) { return b.date === iso; });
    var out = [];
    ranges.forEach(function (r) {
      var start = minutes(r[0]), end = minutes(r[1]);
      for (var s = start; s + duration + buffer <= end; s += step) {
        if (idx * 1440 + s < earliest) continue;
        var clash = booked.some(function (b) { return s < minutes(b.end) + buffer && s + duration + buffer > minutes(b.start); });
        if (!clash) out.push(s);
      }
    });
    return out;
  }

  // ---------- État ----------
  var state = { option: null, date: null, time: null, month: null };
  var calEl = document.getElementById("b-cal");
  var slotsEl = document.getElementById("b-slots");
  var nojs = form.querySelector(".b-nojs");
  if (nojs) nojs.hidden = true;
  calEl.hidden = false;

  function currentOption() {
    return data.options.filter(function (o) { return o.id === state.option; })[0] || null;
  }

  // ---------- Calendrier ----------
  function renderCalendar() {
    var now = nowInGeneva();
    var first = toIso(now.idx).slice(0, 7);
    var last = toIso(now.idx + (rules.horizon_days || 60)).slice(0, 7);
    if (!state.month) state.month = first;
    var opt = currentOption();
    var y = +state.month.slice(0, 4), m = +state.month.slice(5, 7);
    var startIdx = toIdx(state.month + "-01");
    var daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    var lead = isoWeekday(startIdx) - 1;

    var html = '<div class="cal-head"><button type="button" class="cal-nav" data-nav="-1" aria-label="Mois précédent"' +
      (state.month <= first ? " disabled" : "") + '>‹</button><p class="cal-month">' +
      fmtMonth.format(new Date(startIdx * DAY)) + '</p><button type="button" class="cal-nav" data-nav="1" aria-label="Mois suivant"' +
      (state.month >= last ? " disabled" : "") + '>›</button></div>';
    html += '<div class="cal-grid" role="grid"><span class="cal-dow">lu</span><span class="cal-dow">ma</span><span class="cal-dow">me</span><span class="cal-dow">je</span><span class="cal-dow">ve</span><span class="cal-dow">sa</span><span class="cal-dow">di</span>';
    for (var i = 0; i < lead; i++) html += "<span></span>";
    for (var d = 1; d <= daysInMonth; d++) {
      var iso = state.month + "-" + pad(d);
      var free = opt ? slotsFor(iso, opt.minutes).length > 0 : false;
      var cls = "cal-day" + (free ? " is-free" : "") + (iso === state.date ? " is-selected" : "") + (toIdx(iso) === now.idx ? " is-today" : "");
      html += '<button type="button" class="' + cls + '" data-date="' + iso + '"' + (free ? "" : " disabled") +
        ' aria-label="' + longDate(iso) + (free ? ", disponible" : ", indisponible") + '"' +
        (iso === state.date ? ' aria-pressed="true"' : "") + ">" + d + "</button>";
    }
    html += "</div>";
    calEl.innerHTML = html;
  }

  function firstFreeMonth() {
    var opt = currentOption();
    if (!opt) return null;
    var now = nowInGeneva();
    for (var i = 0; i <= (rules.horizon_days || 60); i++) {
      var iso = toIso(now.idx + i);
      if (slotsFor(iso, opt.minutes).length) return iso.slice(0, 7);
    }
    return null;
  }

  function renderSlots() {
    var opt = currentOption();
    if (!opt) { slotsEl.innerHTML = '<p class="b-hint">Choisissez d’abord une prestation.</p>'; return; }
    if (!state.date) {
      slotsEl.innerHTML = firstFreeMonth()
        ? '<p class="b-hint">Choisissez un jour en surbrillance dans le calendrier.</p>'
        : '<p class="b-hint">Aucun créneau en ligne pour le moment. Écrivez-moi directement : je vous proposerai une date.</p>';
      return;
    }
    var slots = slotsFor(state.date, opt.minutes);
    var html = '<p class="b-day">' + longDate(state.date) + "</p><div class=\"slot-list\">";
    slots.forEach(function (s) {
      var t = hhmm(s);
      html += '<button type="button" class="slot' + (t === state.time ? " is-selected" : "") + '" data-time="' + t + '"' +
        (t === state.time ? ' aria-pressed="true"' : ' aria-pressed="false"') + ">" + t + "</button>";
    });
    slotsEl.innerHTML = html + "</div>";
  }

  // ---------- Récapitulatif ----------
  var sum = {
    service: document.getElementById("sum-service"),
    format: document.getElementById("sum-format"),
    date: document.getElementById("sum-date"),
    time: document.getElementById("sum-time"),
    price: document.getElementById("sum-price")
  };
  function renderSummary() {
    var opt = currentOption();
    sum.service.textContent = opt ? opt.name : "—";
    sum.format.textContent = opt ? opt.format + " · " + opt.duration : "—";
    sum.date.textContent = state.date ? longDate(state.date) : "—";
    sum.time.textContent = state.time ? state.time + " (heure de Genève)" : "—";
    sum.price.textContent = opt ? "CHF " + opt.price + ".–" : "—";
  }

  function refresh() { renderCalendar(); renderSlots(); renderSummary(); }

  // ---------- Interactions ----------
  form.addEventListener("change", function (e) {
    if (e.target.name !== "option") return;
    state.option = e.target.value;
    var opt = currentOption();
    if (state.date && !slotsFor(state.date, opt.minutes).length) { state.date = null; }
    if (state.time && state.date && slotsFor(state.date, opt.minutes).indexOf(minutes(state.time)) < 0) state.time = null;
    if (!state.date) state.month = firstFreeMonth() || state.month;
    refresh();
  });

  calEl.addEventListener("click", function (e) {
    var nav = e.target.closest("[data-nav]");
    if (nav && !nav.disabled) {
      var y = +state.month.slice(0, 4), m = +state.month.slice(5, 7) + (+nav.dataset.nav);
      if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
      state.month = y + "-" + pad(m);
      renderCalendar();
      return;
    }
    var day = e.target.closest("[data-date]");
    if (day && !day.disabled) {
      state.date = day.dataset.date;
      state.time = null;
      refresh();
      var first = slotsEl.querySelector(".slot");
      if (first) first.focus({ preventScroll: true });
    }
  });

  slotsEl.addEventListener("click", function (e) {
    var b = e.target.closest("[data-time]");
    if (!b) return;
    state.time = b.dataset.time;
    renderSlots();
    renderSummary();
  });

  // Présélection depuis une page service : /reservation/#colorimetrie-personnelle
  var wanted = (location.hash || "").slice(1);
  if (wanted) {
    var match = form.querySelector('input[name="option"][value^="' + wanted.replace(/[^a-z0-9-]/g, "") + ':"]');
    if (match) { match.checked = true; state.option = match.value; state.month = firstFreeMonth(); }
  }
  refresh();

  // ---------- Envoi ----------
  var submitBox = document.getElementById("b-submit");
  var status = submitBox.querySelector(".form-status");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var opt = currentOption();
    if (!opt) { status.textContent = "Choisissez une prestation."; form.querySelector('input[name="option"]').focus(); return; }
    if (!state.date || !state.time) { status.textContent = "Choisissez un jour puis un horaire dans le calendrier."; calEl.querySelector("button:not([disabled])") && calEl.scrollIntoView({ block: "center" }); return; }
    if (!form.reportValidity()) return;

    var f = new FormData(form);
    var name = String(f.get("name") || "").trim();
    var email = String(f.get("email") || "").trim();
    var phone = String(f.get("phone") || "").trim();
    var message = String(f.get("message") || "").trim();
    var subject = "Demande de réservation · " + opt.name + " · " + longDate(state.date) + " à " + state.time;
    var lines = [
      "Bonjour Liv,", "",
      "Je souhaite réserver la séance suivante :",
      "Prestation : " + opt.name + " (" + opt.format + ")",
      "Date : " + longDate(state.date),
      "Heure : " + state.time + " (heure de Genève)",
      "Durée : " + opt.duration,
      "Tarif : CHF " + opt.price + ".–", "",
      "Nom : " + name, "E-mail : " + email
    ];
    if (phone) lines.push("Téléphone : " + phone);
    if (message) lines.push("", message);
    var text = lines.join("\n");

    var done = function () {
      form.hidden = true;
      submitBox.hidden = true;
      var ok = document.getElementById("booking-done");
      ok.querySelector("[data-recap]").textContent = opt.name + ", " + longDate(state.date) + " à " + state.time + ".";
      ok.hidden = false;
      ok.focus();
    };
    var mail = function () {
      window.location.href = "mailto:" + data.email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(text);
      status.textContent = "Votre messagerie s’ouvre avec la demande préremplie : il ne reste qu’à l’envoyer. Si rien ne se passe, écrivez à " + data.email + ".";
    };

    if (data.provider === "web3forms" && data.key) {
      status.textContent = "Envoi en cours…";
      fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ access_key: data.key, subject: subject, from_name: name, email: email, replyto: email, message: text })
      }).then(function (r) { return r.json(); }).then(function (r) {
        if (r && r.success) done(); else { status.textContent = "L’envoi n’a pas abouti. Votre messagerie va s’ouvrir à la place."; mail(); }
      }, function () { status.textContent = "Pas de connexion au service d’envoi. Votre messagerie va s’ouvrir à la place."; mail(); });
    } else {
      mail();
    }
  });
})();
