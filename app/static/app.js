// Base de connaissances — mini client type Notion
(function () {
  "use strict";

  let TREE = null;               // {categories:[{folder,label,notes:[]}], annexes:[]}
  let TITLE_INDEX = {};          // title -> {cat, label}
  let ANNEX_SET = new Set();
  let current = null;            // {cat, file}
  let dirty = false;

  const categoriesEl = document.getElementById("categories");
  const emptyEl = document.getElementById("empty");
  const noteEl = document.getElementById("note");
  const previewEl = document.getElementById("preview");
  const editorEl = document.getElementById("editor");
  const noteCatEl = document.getElementById("noteCat");
  const editToggle = document.getElementById("editToggle");
  const saveBtn = document.getElementById("saveBtn");
  const saveStatus = document.getElementById("saveStatus");
  const gitBtn = document.getElementById("gitBtn");
  const gitStatus = document.getElementById("gitStatus");

  marked.setOptions({ breaks: false, gfm: true });

  function collapsedKey(folder) { return "collapsed:" + folder; }

  async function loadTree() {
    const res = await fetch("/api/tree");
    TREE = await res.json();
    TITLE_INDEX = {};
    for (const cat of TREE.categories) {
      for (const title of cat.notes) {
        TITLE_INDEX[title] = { cat: cat.folder, label: cat.label };
      }
    }
    ANNEX_SET = new Set(TREE.annexes || []);
    renderSidebar();
  }

  function renderSidebar() {
    categoriesEl.innerHTML = "";
    for (const cat of TREE.categories) {
      const block = document.createElement("div");
      block.className = "cat-block";
      const collapsedStored = localStorage.getItem(collapsedKey(cat.folder));
      if (collapsedStored === "1") block.classList.add("collapsed");

      const title = document.createElement("div");
      title.className = "cat-title";
      title.innerHTML =
        '<span class="chevron">▾</span><span>' + escapeHtml(cat.label) +
        '</span><span class="cat-count">' + cat.notes.length + "</span>";
      title.addEventListener("click", () => {
        block.classList.toggle("collapsed");
        localStorage.setItem(collapsedKey(cat.folder), block.classList.contains("collapsed") ? "1" : "0");
      });
      block.appendChild(title);

      const list = document.createElement("div");
      list.className = "note-list";
      for (const noteTitle of cat.notes) {
        const item = document.createElement("div");
        item.className = "note-item";
        item.textContent = noteTitle;
        item.dataset.cat = cat.folder;
        item.dataset.file = noteTitle;
        if (current && current.cat === cat.folder && current.file === noteTitle) {
          item.classList.add("active");
        }
        item.addEventListener("click", () => openNote(cat.folder, noteTitle));
        list.appendChild(item);
      }
      const addBtn = document.createElement("div");
      addBtn.className = "add-note-btn";
      addBtn.textContent = "+ Nouvelle fiche";
      addBtn.addEventListener("click", () => createNote(cat.folder, cat.label));
      list.appendChild(addBtn);

      block.appendChild(list);
      categoriesEl.appendChild(block);
    }
  }

  async function createNote(cat, label) {
    const title = prompt("Titre de la nouvelle fiche (" + label + ") :");
    if (!title || !title.trim()) return;
    const res = await fetch("/api/note-create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cat, title: title.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert("Impossible de créer la fiche : " + (data.error || res.status));
      return;
    }
    await loadTree();
    openNote(cat, data.file);
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  // Convert [[Target]] / [[Target|Alias]] into HTML anchors BEFORE markdown parsing,
  // using a placeholder-free approach: emit raw <a> tags (marked passes inline HTML through).
  function convertWikilinks(md) {
    return md.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (whole, target, alias) => {
      target = target.trim();
      const display = (alias || target).trim();
      if (target.startsWith("annexes/")) {
        const fname = target.slice("annexes/".length);
        return '<a class="filelink" href="/api/file?name=' + encodeURIComponent(fname) +
          '" target="_blank">' + escapeHtml(display) + "</a>";
      }
      const stem = target.split("/").pop();
      const known = TITLE_INDEX[stem];
      if (known) {
        return '<a class="wikilink" data-cat="' + escapeHtml(known.cat) + '" data-file="' +
          escapeHtml(stem) + '">' + escapeHtml(display) + "</a>";
      }
      return '<a class="wikilink missing" title="Fiche introuvable">' + escapeHtml(display) + "</a>";
    });
  }

  async function openNote(cat, file) {
    if (dirty && !confirm("Des modifications non enregistrées seront perdues. Continuer ?")) return;
    const res = await fetch("/api/note?cat=" + encodeURIComponent(cat) + "&file=" + encodeURIComponent(file));
    if (!res.ok) { alert("Fiche introuvable."); return; }
    const data = await res.json();
    current = { cat, file };
    dirty = false;

    emptyEl.hidden = true;
    noteEl.hidden = false;
    const label = (TREE.categories.find((c) => c.folder === cat) || {}).label || cat;
    noteCatEl.textContent = label;

    setEditing(false);
    editorEl.value = data.content;
    renderPreview(data.content);
    saveStatus.textContent = "";

    document.querySelectorAll(".note-item").forEach((el) => {
      el.classList.toggle("active", el.dataset.cat === cat && el.dataset.file === file);
    });
    window.scrollTo(0, 0);
    noteEl.querySelector(".note-toolbar").scrollIntoView({ block: "start" });
  }

  function renderPreview(md) {
    const withLinks = convertWikilinks(md);
    previewEl.innerHTML = marked.parse(withLinks);
    previewEl.querySelectorAll("a.wikilink[data-cat]").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        openNote(a.dataset.cat, a.dataset.file);
      });
    });
  }

  function setEditing(editing) {
    previewEl.hidden = editing;
    editorEl.hidden = !editing;
    saveBtn.hidden = !editing;
    editToggle.textContent = editing ? "Aperçu" : "Éditer";
  }

  editToggle.addEventListener("click", () => {
    const editing = editorEl.hidden; // currently in preview -> switch to edit
    if (editing) {
      setEditing(true);
      editorEl.focus();
    } else {
      renderPreview(editorEl.value);
      setEditing(false);
    }
  });

  editorEl.addEventListener("input", () => {
    dirty = true;
    saveStatus.textContent = "Modifié";
  });

  saveBtn.addEventListener("click", async () => {
    if (!current) return;
    saveStatus.textContent = "Enregistrement…";
    const res = await fetch("/api/note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cat: current.cat, file: current.file, content: editorEl.value }),
    });
    if (res.ok) {
      dirty = false;
      saveStatus.textContent = "Enregistré ✓";
      renderPreview(editorEl.value);
      setTimeout(() => { if (saveStatus.textContent === "Enregistré ✓") saveStatus.textContent = ""; }, 2500);
    } else {
      saveStatus.textContent = "Erreur d'enregistrement";
    }
  });

  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      if (!editorEl.hidden) saveBtn.click();
    }
  });

  gitBtn.addEventListener("click", async () => {
    const message = prompt("Message de commit :", "Mise à jour depuis l'interface");
    if (message === null) return;
    gitStatus.textContent = "Envoi en cours…";
    const res = await fetch("/api/git-commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    gitStatus.textContent = (data.ok ? "✓ " : "✗ ") + (data.log || "");
  });

  loadTree();
})();
