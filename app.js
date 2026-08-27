"use strict";

/* =========================================================
   SaltyNotes — lokale Notizen/Checklisten-App
   Alles wird ausschließlich in localStorage auf dem Gerät
   gespeichert. Kein Server, keine Konten, kein Tracking.
   ========================================================= */

const STORAGE_KEY = "saltynotes:data:v1";
const ROUTE_KEY = "saltynotes:route:v1";

/* ---------------- utilities ---------------- */

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function nowIso() {
  return new Date().toISOString();
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " · " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function debounce(fn, wait) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function sanitizeHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  tmp.querySelectorAll("script,style,iframe,object,embed,link,meta").forEach((el) => el.remove());
  tmp.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith("on") || value.startsWith("javascript:")) {
        el.removeAttribute(attr.name);
      }
    });
  });
  return tmp.innerHTML;
}

/* ---------------- state ---------------- */

function emptyState() {
  return { checklists: [], documents: [], collections: [], mindmaps: [] };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return { ...emptyState(), ...parsed };
  } catch {
    return emptyState();
  }
}

let state = loadState();

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
const persistDebounced = debounce(persist, 250);

/* ---------------- routing ---------------- */

let route = { section: "checkliste", view: "list", id: null };
try {
  const savedRoute = JSON.parse(sessionStorage.getItem(ROUTE_KEY) || "null");
  if (savedRoute && savedRoute.section) route.section = savedRoute.section;
} catch {}

function goTo(section, view = "list", id = null) {
  route = { section, view, id };
  sessionStorage.setItem(ROUTE_KEY, JSON.stringify({ section }));
  closeSidebarMobile();
  render();
}

/* ---------------- modal ---------------- */

function closeModal() {
  document.getElementById("modalRoot").innerHTML = "";
}

function showConfirm(title, message, confirmLabel, onConfirm) {
  const root = document.getElementById("modalRoot");
  root.innerHTML = `
    <div class="modal-scrim" data-close>
      <div class="modal-box" role="dialog" aria-modal="true">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
        <div class="modal-actions">
          <button class="btn secondary" data-cancel>Abbrechen</button>
          <button class="btn danger" data-confirm>${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    </div>`;
  root.querySelector("[data-close]").addEventListener("click", (e) => {
    if (e.target.hasAttribute("data-close")) closeModal();
  });
  root.querySelector("[data-cancel]").addEventListener("click", closeModal);
  root.querySelector("[data-confirm]").addEventListener("click", () => {
    closeModal();
    onConfirm();
  });
}

/* ---------------- sidebar / nav ---------------- */

function closeSidebarMobile() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("navScrim").classList.remove("show");
  document.getElementById("navToggle").setAttribute("aria-expanded", "false");
}

function initNav() {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => goTo(btn.dataset.section, "list", null));
  });
  const toggle = document.getElementById("navToggle");
  const sidebar = document.getElementById("sidebar");
  const scrim = document.getElementById("navScrim");
  toggle.addEventListener("click", () => {
    const open = sidebar.classList.toggle("open");
    scrim.classList.toggle("show", open);
    toggle.setAttribute("aria-expanded", String(open));
  });
  scrim.addEventListener("click", closeSidebarMobile);
}

function updateActiveNav() {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.section === route.section);
  });
}

/* ---------------- render dispatch ---------------- */

function render() {
  updateActiveNav();
  const content = document.getElementById("content");
  if (route.section === "checkliste") {
    content.innerHTML = route.view === "editor" ? checklistEditorHtml(route.id) : checklistListHtml();
    route.view === "editor" ? wireChecklistEditor(route.id) : wireChecklistList();
  } else if (route.section === "dokumentation") {
    content.innerHTML = route.view === "editor" ? documentEditorHtml(route.id) : dokumentationListHtml();
    route.view === "editor" ? wireDocumentEditor(route.id) : wireDokumentationList();
  } else if (route.section === "brainstorming") {
    if (route.view === "sammlung-editor") {
      content.innerHTML = collectionEditorHtml(route.id);
      wireCollectionEditor(route.id);
    } else if (route.view === "mindmap-editor") {
      content.innerHTML = mindmapEditorHtml(route.id);
      wireMindmapEditor(route.id);
    } else {
      content.innerHTML = brainstormingListHtml();
      wireBrainstormingList();
    }
  }
  content.scrollTop = 0;
  content.focus({ preventScroll: true });
}

/* =========================================================
   1) CHECKLISTE
   ========================================================= */

function checklistListHtml() {
  const items = [...state.checklists].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const cards = items.map((c) => {
    const total = c.items.length;
    const done = c.items.filter((i) => i.done).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return `
      <div class="card" data-open="${c.id}">
        <button class="card-delete" data-delete="${c.id}" title="Löschen" aria-label="Löschen">✕</button>
        <div class="card-title">${escapeHtml(c.title || "Ohne Titel")}</div>
        <div class="card-meta">${done}/${total} erledigt · ${formatDate(c.updatedAt)}</div>
        <div class="card-progress"><div style="width:${pct}%"></div></div>
      </div>`;
  }).join("");

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Checkliste</h1>
        <div class="page-subtitle">Erstelle To-do-Listen mit Kästchen zum Abhaken.</div>
      </div>
    </div>
    <div class="create-row">
      <button class="btn" id="newChecklist">+ Neue Checkliste</button>
    </div>
    ${items.length ? `<div class="card-grid">${cards}</div>` :
      `<div class="empty-state">Noch keine Checkliste vorhanden. Leg direkt los!</div>`}
  `;
}

function wireChecklistList() {
  document.getElementById("newChecklist").addEventListener("click", () => {
    const c = { id: uid(), title: "Neue Checkliste", items: [], updatedAt: nowIso() };
    state.checklists.push(c);
    persist();
    goTo("checkliste", "editor", c.id);
  });
  document.querySelectorAll("[data-open]").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target.closest("[data-delete]")) return;
      goTo("checkliste", "editor", el.dataset.open);
    });
  });
  document.querySelectorAll("[data-delete]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = el.dataset.delete;
      showConfirm("Checkliste löschen", "Diese Checkliste wird endgültig gelöscht.", "Löschen", () => {
        state.checklists = state.checklists.filter((c) => c.id !== id);
        persist();
        render();
      });
    });
  });
}

function checklistEditorHtml(id) {
  const c = state.checklists.find((x) => x.id === id);
  if (!c) return `<div class="empty-state">Checkliste nicht gefunden.</div>`;
  const rows = c.items.map((it) => `
    <div class="checklist-item ${it.done ? "done" : ""}" data-item="${it.id}">
      <input type="checkbox" ${it.done ? "checked" : ""} data-check="${it.id}" aria-label="Erledigt" />
      <input type="text" value="${escapeHtml(it.text)}" data-text="${it.id}" placeholder="Eintrag…" />
      <button class="item-remove" data-remove="${it.id}" aria-label="Eintrag entfernen">✕</button>
    </div>`).join("");

  return `
    <div class="btn-row" style="margin-bottom:16px;">
      <button class="btn ghost" id="backBtn">← Zurück</button>
    </div>
    <div class="sheet">
      <div class="editor-header">
        <input class="title-input" id="titleInput" value="${escapeHtml(c.title)}" placeholder="Titel der Checkliste" />
      </div>
      <div class="checklist-items" id="itemsWrap">${rows}</div>
      <button class="btn secondary" id="addItem">+ Eintrag hinzufügen</button>
    </div>
  `;
}

function wireChecklistEditor(id) {
  const c = state.checklists.find((x) => x.id === id);
  if (!c) return;
  document.getElementById("backBtn").addEventListener("click", () => goTo("checkliste", "list"));

  document.getElementById("titleInput").addEventListener("input", (e) => {
    c.title = e.target.value;
    c.updatedAt = nowIso();
    persistDebounced();
  });

  document.getElementById("addItem").addEventListener("click", () => {
    c.items.push({ id: uid(), text: "", done: false });
    c.updatedAt = nowIso();
    persist();
    render();
    const inputs = document.querySelectorAll("#itemsWrap input[type=text]");
    if (inputs.length) inputs[inputs.length - 1].focus();
  });

  document.querySelectorAll("[data-check]").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const item = c.items.find((i) => i.id === cb.dataset.check);
      item.done = e.target.checked;
      c.updatedAt = nowIso();
      persist();
      cb.closest(".checklist-item").classList.toggle("done", item.done);
    });
  });

  document.querySelectorAll("[data-text]").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const item = c.items.find((i) => i.id === inp.dataset.text);
      item.text = e.target.value;
      c.updatedAt = nowIso();
      persistDebounced();
    });
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        document.getElementById("addItem").click();
      }
    });
  });

  document.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      c.items = c.items.filter((i) => i.id !== btn.dataset.remove);
      c.updatedAt = nowIso();
      persist();
      render();
    });
  });
}

/* =========================================================
   2) DOKUMENTATION  (Dokumentation + Anleitung)
   ========================================================= */

function dokumentationListHtml() {
  const items = [...state.documents].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const cards = items.map((d) => `
    <div class="card" data-open="${d.id}">
      <button class="card-delete" data-delete="${d.id}" title="Löschen" aria-label="Löschen">✕</button>
      <span class="card-tag">${d.kind === "anleitung" ? "Anleitung" : "Dokumentation"}</span>
      <div class="card-title">${escapeHtml(d.title || "Ohne Titel")}</div>
      <div class="card-meta">${formatDate(d.updatedAt)}</div>
    </div>`).join("");

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Dokumentation</h1>
        <div class="page-subtitle">Text, Tabellen und Listen für Dokus und Anleitungen.</div>
      </div>
    </div>
    <div class="create-row">
      <button class="btn" id="newDoc">+ Neue Dokumentation</button>
      <button class="btn secondary" id="newGuide">+ Neue Anleitung</button>
    </div>
    ${items.length ? `<div class="card-grid">${cards}</div>` :
      `<div class="empty-state">Noch keine Dokumentation vorhanden.</div>`}
  `;
}

function wireDokumentationList() {
  const create = (kind) => {
    const d = {
      id: uid(),
      kind,
      title: kind === "anleitung" ? "Neue Anleitung" : "Neue Dokumentation",
      html: "",
      updatedAt: nowIso(),
    };
    state.documents.push(d);
    persist();
    goTo("dokumentation", "editor", d.id);
  };
  document.getElementById("newDoc").addEventListener("click", () => create("dokumentation"));
  document.getElementById("newGuide").addEventListener("click", () => create("anleitung"));

  document.querySelectorAll("[data-open]").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target.closest("[data-delete]")) return;
      goTo("dokumentation", "editor", el.dataset.open);
    });
  });
  document.querySelectorAll("[data-delete]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = el.dataset.delete;
      showConfirm("Eintrag löschen", "Dieser Eintrag wird endgültig gelöscht.", "Löschen", () => {
        state.documents = state.documents.filter((d) => d.id !== id);
        persist();
        render();
      });
    });
  });
}

function documentEditorHtml(id) {
  const d = state.documents.find((x) => x.id === id);
  if (!d) return `<div class="empty-state">Eintrag nicht gefunden.</div>`;
  return `
    <div class="btn-row" style="margin-bottom:16px;">
      <button class="btn ghost" id="backBtn">← Zurück</button>
    </div>
    <div class="editor-header">
      <input class="title-input" id="titleInput" value="${escapeHtml(d.title)}" placeholder="Titel" />
    </div>
    <div class="table-tools">
      <button data-tbl="addRow">+ Zeile</button>
      <button data-tbl="delRow">− Zeile</button>
      <button data-tbl="addCol">+ Spalte</button>
      <button data-tbl="delCol">− Spalte</button>
    </div>
    <div class="toolbar" id="toolbar">
      <button data-cmd="bold" title="Fett"><b>F</b></button>
      <button data-cmd="italic" title="Kursiv"><i>K</i></button>
      <button data-cmd="underline" title="Unterstrichen"><u>U</u></button>
      <span class="sep"></span>
      <button data-block="h2" title="Überschrift">H1</button>
      <button data-block="h3" title="Unterüberschrift">H2</button>
      <button data-block="p" title="Absatz">¶</button>
      <span class="sep"></span>
      <button data-cmd="insertUnorderedList" title="Aufzählung">• Liste</button>
      <button data-cmd="insertOrderedList" title="Nummerierte Liste">1. Liste</button>
      <span class="sep"></span>
      <button data-table title="Tabelle einfügen">▦ Tabelle</button>
    </div>
    <div class="rich-area" id="richArea" contenteditable="true" data-placeholder="Schreib hier deine ${d.kind === "anleitung" ? "Anleitung" : "Dokumentation"}…">${d.html || ""}</div>
  `;
}

function getSelectedTable() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  let node = sel.anchorNode;
  if (!node) return null;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  return node ? node.closest("table") : null;
}

function insertTableAtCursor(area, rows = 3, cols = 3) {
  area.focus();
  const sel = window.getSelection();
  let range;
  if (sel.rangeCount && area.contains(sel.anchorNode)) {
    range = sel.getRangeAt(0);
  } else {
    range = document.createRange();
    range.selectNodeContents(area);
    range.collapse(false);
  }
  const table = document.createElement("table");
  const tbody = document.createElement("tbody");
  for (let r = 0; r < rows; r++) {
    const tr = document.createElement("tr");
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement(r === 0 ? "th" : "td");
      cell.innerHTML = "&nbsp;";
      tr.appendChild(cell);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  range.deleteContents();
  range.insertNode(table);
  const p = document.createElement("p");
  p.innerHTML = "<br>";
  table.after(p);
  const newRange = document.createRange();
  newRange.selectNodeContents(table.querySelector("th,td"));
  newRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(newRange);
}

function wireDocumentEditor(id) {
  const d = state.documents.find((x) => x.id === id);
  if (!d) return;
  document.getElementById("backBtn").addEventListener("click", () => goTo("dokumentation", "list"));

  document.getElementById("titleInput").addEventListener("input", (e) => {
    d.title = e.target.value;
    d.updatedAt = nowIso();
    persistDebounced();
  });

  const area = document.getElementById("richArea");
  const saveBody = debounce(() => {
    d.html = sanitizeHtml(area.innerHTML);
    d.updatedAt = nowIso();
    persist();
  }, 300);
  area.addEventListener("input", saveBody);
  area.addEventListener("blur", () => {
    d.html = sanitizeHtml(area.innerHTML);
    d.updatedAt = nowIso();
    persist();
  });

  document.getElementById("toolbar").addEventListener("mousedown", (e) => e.preventDefault());
  document.querySelectorAll("[data-cmd]").forEach((btn) => {
    btn.addEventListener("click", () => {
      area.focus();
      document.execCommand(btn.dataset.cmd, false, null);
      saveBody();
    });
  });
  document.querySelectorAll("[data-block]").forEach((btn) => {
    btn.addEventListener("click", () => {
      area.focus();
      const tag = btn.dataset.block === "p" ? "P" : btn.dataset.block.toUpperCase();
      document.execCommand("formatBlock", false, tag);
      saveBody();
    });
  });
  document.querySelector("[data-table]").addEventListener("mousedown", (e) => {
    e.preventDefault();
    insertTableAtCursor(area, 3, 3);
    saveBody();
  });

  document.querySelectorAll("[data-tbl]").forEach((btn) => {
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const table = getSelectedTable();
      if (!table) return;
      const action = btn.dataset.tbl;
      const rows = [...table.rows];
      if (action === "addRow") {
        const ref = rows[rows.length - 1] || table.insertRow();
        const tr = table.insertRow(-1);
        const count = ref.cells.length || 1;
        for (let i = 0; i < count; i++) {
          const cell = tr.insertCell(-1);
          cell.innerHTML = "&nbsp;";
        }
      } else if (action === "delRow") {
        if (rows.length > 1) table.deleteRow(rows.length - 1);
      } else if (action === "addCol") {
        rows.forEach((tr, ri) => {
          const cell = document.createElement(ri === 0 ? "th" : "td");
          cell.innerHTML = "&nbsp;";
          tr.appendChild(cell);
        });
      } else if (action === "delCol") {
        rows.forEach((tr) => {
          if (tr.cells.length > 1) tr.deleteCell(-1);
        });
      }
      saveBody();
    });
  });
}

/* =========================================================
   3) BRAINSTORMING  (Sammlung + Mindmap)
   ========================================================= */

function brainstormingListHtml() {
  const collections = state.collections.map((c) => ({ ...c, type: "sammlung" }));
  const mindmaps = state.mindmaps.map((m) => ({ ...m, type: "mindmap" }));
  const items = [...collections, ...mindmaps].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const cards = items.map((it) => `
    <div class="card" data-open="${it.id}" data-type="${it.type}">
      <button class="card-delete" data-delete="${it.id}" data-type="${it.type}" title="Löschen" aria-label="Löschen">✕</button>
      <span class="card-tag">${it.type === "mindmap" ? "Mindmap" : "Sammlung"}</span>
      <div class="card-title">${escapeHtml(it.title || "Ohne Titel")}</div>
      <div class="card-meta">${formatDate(it.updatedAt)}</div>
    </div>`).join("");

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Brainstorming</h1>
        <div class="page-subtitle">Freies Schreiben und Mindmaps für neue Ideen.</div>
      </div>
    </div>
    <div class="create-row">
      <button class="btn" id="newCollection">+ Neue Sammlung</button>
      <button class="btn secondary" id="newMindmap">+ Neue Mindmap</button>
    </div>
    ${items.length ? `<div class="card-grid">${cards}</div>` :
      `<div class="empty-state">Noch nichts gesammelt. Starte eine Sammlung oder Mindmap.</div>`}
  `;
}

function wireBrainstormingList() {
  document.getElementById("newCollection").addEventListener("click", () => {
    const c = { id: uid(), title: "Neue Sammlung", html: "", updatedAt: nowIso() };
    state.collections.push(c);
    persist();
    goTo("brainstorming", "sammlung-editor", c.id);
  });
  document.getElementById("newMindmap").addEventListener("click", () => {
    const m = {
      id: uid(),
      title: "Neue Mindmap",
      nodes: [{ id: uid(), x: 120, y: 100, text: "Zentrales Thema", shape: "ellipse", color: "sun" }],
      links: [],
      updatedAt: nowIso(),
    };
    state.mindmaps.push(m);
    persist();
    goTo("brainstorming", "mindmap-editor", m.id);
  });

  document.querySelectorAll("[data-open]").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target.closest("[data-delete]")) return;
      const view = el.dataset.type === "mindmap" ? "mindmap-editor" : "sammlung-editor";
      goTo("brainstorming", view, el.dataset.open);
    });
  });
  document.querySelectorAll("[data-delete]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = el.dataset.delete;
      const type = el.dataset.type;
      showConfirm("Löschen", "Dieser Eintrag wird endgültig gelöscht.", "Löschen", () => {
        if (type === "mindmap") state.mindmaps = state.mindmaps.filter((m) => m.id !== id);
        else state.collections = state.collections.filter((c) => c.id !== id);
        persist();
        render();
      });
    });
  });
}

/* ---- 3a) Sammlung: blanko linierte Seite ---- */

function collectionEditorHtml(id) {
  const c = state.collections.find((x) => x.id === id);
  if (!c) return `<div class="empty-state">Sammlung nicht gefunden.</div>`;
  return `
    <div class="btn-row" style="margin-bottom:16px;">
      <button class="btn ghost" id="backBtn">← Zurück</button>
    </div>
    <div class="editor-header">
      <input class="title-input" id="titleInput" value="${escapeHtml(c.title)}" placeholder="Titel" />
    </div>
    <div class="lined-page" id="linedPage" contenteditable="true" data-placeholder="Schreib frei drauflos…">${c.html || ""}</div>
  `;
}

function wireCollectionEditor(id) {
  const c = state.collections.find((x) => x.id === id);
  if (!c) return;
  document.getElementById("backBtn").addEventListener("click", () => goTo("brainstorming", "list"));
  document.getElementById("titleInput").addEventListener("input", (e) => {
    c.title = e.target.value;
    c.updatedAt = nowIso();
    persistDebounced();
  });
  const page = document.getElementById("linedPage");
  const save = debounce(() => {
    c.html = sanitizeHtml(page.innerHTML);
    c.updatedAt = nowIso();
    persist();
  }, 300);
  page.addEventListener("input", save);
  page.addEventListener("blur", () => {
    c.html = sanitizeHtml(page.innerHTML);
    c.updatedAt = nowIso();
    persist();
  });
}

/* ---- 3b) Mindmap: Knoten, Formen, Linien, Verlinkungen ---- */

const SHAPES = ["rect", "ellipse", "diamond"];
const COLORS = ["default", "rose", "sage", "sky", "sun"];

function mindmapEditorHtml(id) {
  const m = state.mindmaps.find((x) => x.id === id);
  if (!m) return `<div class="empty-state">Mindmap nicht gefunden.</div>`;
  return `
    <div class="btn-row" style="margin-bottom:16px;">
      <button class="btn ghost" id="backBtn">← Zurück</button>
    </div>
    <div class="editor-header">
      <input class="title-input" id="titleInput" value="${escapeHtml(m.title)}" placeholder="Titel der Mindmap" />
    </div>
    <div class="mindmap-toolbar">
      <button class="btn secondary small" id="addNode">+ Knoten</button>
      <button class="btn secondary small" id="linkMode">🔗 Verbinden</button>
      <span class="hint" id="hintText">Ziehen zum Verschieben · Text antippen zum Bearbeiten</span>
    </div>
    <div class="mindmap-wrap" id="mmWrap">
      <div class="mindmap-canvas" id="mmCanvas">
        <svg id="mmSvg"></svg>
      </div>
    </div>
  `;
}

function wireMindmapEditor(id) {
  const m = state.mindmaps.find((x) => x.id === id);
  if (!m) return;
  document.getElementById("backBtn").addEventListener("click", () => goTo("brainstorming", "list"));
  document.getElementById("titleInput").addEventListener("input", (e) => {
    m.title = e.target.value;
    m.updatedAt = nowIso();
    persistDebounced();
  });

  const canvas = document.getElementById("mmCanvas");
  const svg = document.getElementById("mmSvg");
  const hint = document.getElementById("hintText");
  let linkMode = false;
  let linkSource = null;

  function touch() {
    m.updatedAt = nowIso();
    persistDebounced();
  }

  function nodeCenter(nodeEl) {
    return { x: nodeEl.offsetLeft + nodeEl.offsetWidth / 2, y: nodeEl.offsetTop + nodeEl.offsetHeight / 2 };
  }

  // Point where a ray from a node's center toward another point exits the node's
  // (rectangular) bounding box — so connectors touch the edge, not the middle,
  // and stay visible/clickable instead of hiding underneath the node itself.
  function edgePoint(cx, cy, halfW, halfH, tx, ty) {
    const dx = tx - cx;
    const dy = ty - cy;
    if (dx === 0 && dy === 0) return { x: cx, y: cy };
    const scale = Math.min(
      dx !== 0 ? halfW / Math.abs(dx) : Infinity,
      dy !== 0 ? halfH / Math.abs(dy) : Infinity
    );
    return { x: cx + dx * scale, y: cy + dy * scale };
  }

  function redrawLinks() {
    svg.innerHTML = "";
    m.links.forEach((link) => {
      const aEl = canvas.querySelector(`.mm-node[data-id="${link.a}"]`);
      const bEl = canvas.querySelector(`.mm-node[data-id="${link.b}"]`);
      if (!aEl || !bEl) return;
      const a = nodeCenter(aEl);
      const b = nodeCenter(bEl);
      const p1 = edgePoint(a.x, a.y, aEl.offsetWidth / 2, aEl.offsetHeight / 2, b.x, b.y);
      const p2 = edgePoint(b.x, b.y, bEl.offsetWidth / 2, bEl.offsetHeight / 2, a.x, a.y);

      const onDelete = () => {
        m.links = m.links.filter((l) => l.id !== link.id);
        touch();
        redrawLinks();
      };

      // Fat invisible line first (generous touch target), thin visible line drawn on top.
      const hit = document.createElementNS("http://www.w3.org/2000/svg", "line");
      hit.setAttribute("x1", p1.x);
      hit.setAttribute("y1", p1.y);
      hit.setAttribute("x2", p2.x);
      hit.setAttribute("y2", p2.y);
      hit.setAttribute("stroke", "transparent");
      hit.setAttribute("stroke-width", "24");
      hit.style.cursor = "pointer";
      hit.dataset.link = link.id;
      hit.addEventListener("click", onDelete);
      svg.appendChild(hit);

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", p1.x);
      line.setAttribute("y1", p1.y);
      line.setAttribute("x2", p2.x);
      line.setAttribute("y2", p2.y);
      line.dataset.link = link.id;
      line.style.pointerEvents = "none";
      svg.appendChild(line);
    });
  }

  function renderNodes() {
    canvas.querySelectorAll(".mm-node").forEach((el) => el.remove());
    m.nodes.forEach((node) => {
      const el = document.createElement("div");
      el.className = `mm-node ${node.shape}`;
      el.dataset.id = node.id;
      el.dataset.color = node.color || "default";
      el.style.left = node.x + "px";
      el.style.top = node.y + "px";
      el.innerHTML = `
        <button class="mm-node-remove" data-remove title="Knoten löschen">✕</button>
        <span class="mm-node-text" contenteditable="true" data-text>${escapeHtml(node.text)}</span>
      `;
      canvas.appendChild(el);
      setupNodeEvents(el, node);
    });
    redrawLinks();
  }

  function selectForLink(node, el) {
    if (!linkSource) {
      linkSource = node.id;
      el.classList.add("link-mode");
      hint.textContent = "Zweiten Knoten antippen, um zu verbinden…";
    } else if (linkSource !== node.id) {
      const exists = m.links.some(
        (l) => (l.a === linkSource && l.b === node.id) || (l.a === node.id && l.b === linkSource)
      );
      if (!exists) m.links.push({ id: uid(), a: linkSource, b: node.id });
      canvas.querySelectorAll(".mm-node.link-mode").forEach((n) => n.classList.remove("link-mode"));
      linkSource = null;
      touch();
      redrawLinks();
      hint.textContent = "Verbunden. Wähle den nächsten Startknoten oder beende den Modus.";
    } else {
      canvas.querySelectorAll(".mm-node.link-mode").forEach((n) => n.classList.remove("link-mode"));
      linkSource = null;
      hint.textContent = "Verbindungsmodus aktiv: zwei Knoten antippen, um sie zu verbinden.";
    }
  }

  function setupNodeEvents(el, node) {
    const textEl = el.querySelector("[data-text]");
    const removeBtn = el.querySelector("[data-remove]");

    textEl.addEventListener("input", () => {
      node.text = textEl.textContent;
      touch();
    });
    textEl.addEventListener("pointerdown", (e) => {
      if (linkMode) {
        e.preventDefault();
        e.stopPropagation();
        selectForLink(node, el);
        return;
      }
      e.stopPropagation();
    });
    textEl.addEventListener("dblclick", () => {
      // cycle shape on double click of empty space is handled below; keep text focus normal
    });

    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      m.nodes = m.nodes.filter((n) => n.id !== node.id);
      m.links = m.links.filter((l) => l.a !== node.id && l.b !== node.id);
      touch();
      renderNodes();
    });

    // shape/color cycle via a light tap on the node border (not text): double-click node background
    el.addEventListener("dblclick", (e) => {
      if (e.target.closest("[data-text]") || e.target.closest("[data-remove]")) return;
      const idx = SHAPES.indexOf(node.shape);
      node.shape = SHAPES[(idx + 1) % SHAPES.length];
      touch();
      renderNodes();
    });
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const idx = COLORS.indexOf(node.color || "default");
      node.color = COLORS[(idx + 1) % COLORS.length];
      touch();
      renderNodes();
    });

    let dragging = false;
    let moved = false;
    let startX = 0, startY = 0, origX = 0, origY = 0;

    el.addEventListener("pointerdown", (e) => {
      if (e.target.closest("[data-text]") || e.target.closest("[data-remove]")) return;

      if (linkMode) {
        e.stopPropagation();
        selectForLink(node, el);
        return;
      }

      dragging = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      origX = node.x;
      origY = node.y;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = "grabbing";
    });

    el.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
      if (!moved) return;
      node.x = Math.max(0, origX + dx);
      node.y = Math.max(0, origY + dy);
      el.style.left = node.x + "px";
      el.style.top = node.y + "px";
      redrawLinks();
    });

    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      el.style.cursor = "grab";
      if (moved) touch();
    };
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);
  }

  document.getElementById("addNode").addEventListener("click", () => {
    const wrap = document.getElementById("mmWrap");
    const count = m.nodes.length;
    const col = count % 5;
    const row = Math.floor(count / 5);
    const node = {
      id: uid(),
      x: wrap.scrollLeft + 40 + col * 190 + Math.round(Math.random() * 20),
      y: wrap.scrollTop + 40 + row * 150 + Math.round(Math.random() * 20),
      text: "Neuer Punkt",
      shape: "rect",
      color: "default",
    };
    m.nodes.push(node);
    touch();
    renderNodes();
    const el = canvas.querySelector(`.mm-node[data-id="${node.id}"] [data-text]`);
    if (el) {
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      el.focus();
    }
  });

  document.getElementById("linkMode").addEventListener("click", (e) => {
    linkMode = !linkMode;
    linkSource = null;
    canvas.querySelectorAll(".mm-node.link-mode").forEach((n) => n.classList.remove("link-mode"));
    e.target.classList.toggle("btn", true);
    e.target.style.boxShadow = linkMode ? "0 0 0 3px var(--danger)" : "";
    hint.textContent = linkMode
      ? "Verbindungsmodus aktiv: zwei Knoten antippen, um sie zu verbinden."
      : "Ziehen zum Verschieben · Text antippen zum Bearbeiten";
  });

  renderNodes();
}

/* ---------------- init ---------------- */

function init() {
  initNav();
  render();
}

document.addEventListener("DOMContentLoaded", init);
