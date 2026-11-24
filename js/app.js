(function () {
  "use strict";
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  let book = OppslagBook.loadBook();
  let lastQuery = "";
  let abortCtrl = null;
  let debounceTimer = null;
  const input = $("#q");
  const results = $("#results");
  const status = $("#status");
  const menuBtn = $("#menu-btn");
  const popup = $("#popup");
  const dialogBackdrop = $("#dialog-backdrop");

  function applyTheme() {
    document.documentElement.setAttribute("data-theme", book.theme || "papir");
  }
  function formatPhone(p) {
    if (!p) return "";
    const d = String(p).replace(/\D/g, "");
    if (d.length === 8) return d.slice(0, 3) + " " + d.slice(3, 5) + " " + d.slice(5);
    if (d.length === 10 && d.startsWith("47")) return formatPhone(d.slice(2));
    return p;
  }
  function escapeHtml(s) {
    return String(s || "").replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, """);
  }
  function renderCard(h) {
    const bandClass = "band-" + (h.band || "loose");
    const phone = formatPhone(h.phone);
    const tel = h.phone ? "tel:+47" + String(h.phone).replace(/\D/g, "").replace(/^47/, "") : "";
    const saved = book.entries.some((e) => e.id === h.id || (e.name === h.name && e.postcode === h.postcode));
    const badge = h.source === "brreg" ? '<span class="badge">Brreg</span>' : h.source === "example" ? '<span class="badge">Eksempel</span>' : "";
    return `<article class="card ${bandClass}" data-id="${h.id || ""}">
      <div class="name">${escapeHtml(h.name)}${badge}</div>
      <div class="meta">
        ${phone ? `<span class="phone">${escapeHtml(phone)}</span>` : ""}
        ${h.postcode || h.place ? `<span>${escapeHtml([h.postcode, h.place].filter(Boolean).join(" "))}</span>` : ""}
        ${h.job ? `<span>${escapeHtml(h.job)}</span>` : ""}
      </div>
      <div class="actions">
        ${tel ? `<a href="${tel}">Ring</a>` : ""}
        ${phone ? `<button type="button" data-copy="${escapeHtml(h.phone)}">Kopier</button>` : ""}
        ${saved ? `<button type="button" data-forget="${h.id}">Fjern</button>` : `<button type="button" data-save>Lagre</button>`}
      </div>
    </article>`;
  }
  function render(groups) {
    const labels = { exact: "Treff", near: "Nær", loose: "Løst" };
    let html = "";
    let total = 0;
    for (const band of ["exact", "near", "loose"]) {
      const list = groups[band] || [];
      if (!list.length) continue;
      total += list.length;
      html += `<div class="band-header">${labels[band]}</div>` + list.map(renderCard).join("");
    }
    if (!total) html = `<div class="empty">Ingen treff.<br><strong>Prøv et eksempel-chip</strong> eller legg til en kontakt.</div>`;
    results.innerHTML = html;
  }
  async function doSearch(q) {
    lastQuery = q;
    if (abortCtrl) abortCtrl.abort();
    abortCtrl = new AbortController();
    const local = OppslagBook.allEntries(book);
    const localHits = OppslagMatch.searchEntries(q, local);
    const groups = OppslagMatch.groupHits(localHits);
    status.textContent = "Søker…";
    let firms = [];
    try { firms = await OppslagBrreg.searchFirms(q, abortCtrl.signal); } catch { firms = []; }
    if (lastQuery !== q) return;
    const firmHits = OppslagMatch.searchEntries(q, firms);
    const localKeys = new Set(localHits.map((h) => (h.name + "|" + (h.postcode || "")).toLowerCase()));
    for (const fh of firmHits) {
      const key = (fh.name + "|" + (fh.postcode || "")).toLowerCase();
      if (localKeys.has(key)) continue;
      groups[fh.band] = groups[fh.band] || [];
      groups[fh.band].push(fh);
      if (fh.phone) book = OppslagBook.remember(book, fh);
    }
    OppslagBook.saveBook(book);
    const total = (groups.exact?.length || 0) + (groups.near?.length || 0) + (groups.loose?.length || 0);
    status.textContent = total ? total + " treff" : "";
    render(groups);
  }
  function onInput() {
    const q = input.value.trim();
    clearTimeout(debounceTimer);
    if (!q) { results.innerHTML = ""; status.textContent = ""; return; }
    debounceTimer = setTimeout(() => doSearch(q), 280);
  }
  input.addEventListener("input", onInput);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { clearTimeout(debounceTimer); doSearch(input.value.trim()); } });
  $("#clear-btn")?.addEventListener("click", () => { input.value = ""; results.innerHTML = ""; status.textContent = ""; input.focus(); });
  $$(".chip").forEach((chip) => chip.addEventListener("click", () => { input.value = chip.dataset.q || chip.textContent; onInput(); input.focus(); }));
  results.addEventListener("click", (e) => {
    const btn = e.target.closest("button, a");
    if (!btn) return;
    const card = btn.closest(".card");
    if (!card) return;
    if (btn.dataset.copy) {
      navigator.clipboard?.writeText(btn.dataset.copy).then(() => {
        const old = btn.textContent; btn.textContent = "Kopiert"; setTimeout(() => (btn.textContent = old), 1200);
      });
    }
    if (btn.dataset.save !== undefined) {
      const name = card.querySelector(".name")?.childNodes[0]?.textContent?.trim();
      const phoneEl = card.querySelector(".phone");
      const entry = { id: card.dataset.id || "save-" + Date.now(), kind: "person", name, phone: phoneEl?.textContent?.replace(/\s/g, "") || "", source: "book" };
      book = OppslagBook.remember(book, entry);
      OppslagBook.saveBook(book);
      doSearch(lastQuery || input.value.trim());
    }
    if (btn.dataset.forget) {
      book = OppslagBook.forget(book, btn.dataset.forget);
      OppslagBook.saveBook(book);
      doSearch(lastQuery || input.value.trim());
    }
  });
  menuBtn.addEventListener("click", (e) => { e.stopPropagation(); popup.classList.toggle("open"); });
  document.addEventListener("click", (e) => { if (!popup.contains(e.target) && e.target !== menuBtn) popup.classList.remove("open"); });
  $("#theme-papir")?.addEventListener("click", () => { book.theme = "papir"; OppslagBook.saveBook(book); applyTheme(); popup.classList.remove("open"); });
  $("#theme-natt")?.addEventListener("click", () => { book.theme = "natt"; OppslagBook.saveBook(book); applyTheme(); popup.classList.remove("open"); });
  $("#theme-kart")?.addEventListener("click", () => { book.theme = "kart"; OppslagBook.saveBook(book); applyTheme(); popup.classList.remove("open"); });
  $("#toggle-examples")?.addEventListener("click", () => { book.showExamples = !book.showExamples; OppslagBook.saveBook(book); popup.classList.remove("open"); if (lastQuery) doSearch(lastQuery); });
  $("#add-contact")?.addEventListener("click", () => { popup.classList.remove("open"); dialogBackdrop.classList.add("open"); $("#add-name").value = ""; $("#add-phone").value = ""; $("#add-post").value = ""; $("#add-name").focus(); });
  $("#add-cancel")?.addEventListener("click", () => dialogBackdrop.classList.remove("open"));
  $("#add-save")?.addEventListener("click", () => {
    const name = $("#add-name").value.trim();
    if (!name) return;
    book = OppslagBook.remember(book, { kind: "person", name, phone: $("#add-phone").value.trim(), postcode: $("#add-post").value.trim().slice(0, 4), source: "book" });
    OppslagBook.saveBook(book);
    dialogBackdrop.classList.remove("open");
    if (lastQuery) doSearch(lastQuery);
  });
  applyTheme();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
})();
