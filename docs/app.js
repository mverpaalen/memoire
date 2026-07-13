// Base de connaissances — client 100% navigateur, lecture publique, édition via token GitHub.
(function () {
  "use strict";

  const API = "https://api.github.com";
  const REPO = "mverpaalen/memoire";
  const CAT_FOLDERS = [
    ["plan", "Plan"],
    ["expériences et cas", "Expériences & cas"],
    ["références et concepts", "Références & concepts"],
    ["idées, thèses et arguments", "Idées, thèses et arguments"],
  ];
  const ANNEX_DIR = "annexes";

  let BRANCH = "main";
  let TOKEN = sessionStorage.getItem("gh_token") || "";
  let TREE = null;              // {categories:[{folder,label,notes:[{title,path}]}], annexes:[{name,path}]}
  let TITLE_INDEX = {};         // title -> {cat, label, path}
  let current = null;           // {cat, title, path, sha}
  let dirty = false;
  let pendingAfterAuth = null;  // function to call once a token is obtained

  const categoriesEl = document.getElementById("categories");
  const emptyEl = document.getElementById("empty");
  const noteEl = document.getElementById("note");
  const previewEl = document.getElementById("preview");
  const editorEl = document.getElementById("editor");
  const noteCatEl = document.getElementById("noteCat");
  const editToggle = document.getElementById("editToggle");
  const saveBtn = document.getElementById("saveBtn");
  const saveStatus = document.getElementById("saveStatus");
  const authBtn = document.getElementById("authBtn");
  const syncStatus = document.getElementById("syncStatus");

  const authModal = document.getElementById("authModal");
  const tokenInput = document.getElementById("tokenInput");
  const loginBtn = document.getElementById("loginBtn");
  const cancelAuthBtn = document.getElementById("cancelAuthBtn");
  const loginError = document.getElementById("loginError");

  marked.setOptions({ breaks: false, gfm: true });

  // ---------- GitHub API helper (works unauthenticated for public reads) ----------
  async function gh(path, opts) {
    const headers = Object.assign(
      { Accept: "application/vnd.github+json" },
      (opts && opts.headers) || {}
    );
    if (TOKEN) headers.Authorization = "Bearer " + TOKEN;
    return fetch(API + path, Object.assign({}, opts || {}, { headers }));
  }

  function b64EncodeUtf8(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }
  function b64DecodeUtf8(b64) {
    return decodeURIComponent(escape(atob(b64.replace(/\n/g, ""))));
  }
  function b64DecodeBinary(b64) {
    const bin = atob(b64.replace(/\n/g, ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function sortKey(title) {
    const m = title.match(/^(\d+(?:\.\d+)*)/);
    if (!m) return [1, [999], title.toLowerCase()];
    return [0, m[1].split(".").map(Number), title.toLowerCase()];
  }
  function cmpSortKey(a, b) {
    const ka = sortKey(a), kb = sortKey(b);
    if (ka[0] !== kb[0]) return ka[0] - kb[0];
    const na = ka[1], nb = kb[1];
    for (let i = 0; i < Math.max(na.length, nb.length); i++) {
      const d = (na[i] || 0) - (nb[i] || 0);
      if (d !== 0) return d;
    }
    return ka[2] < kb[2] ? -1 : ka[2] > kb[2] ? 1 : 0;
  }

  function collapsedKey(folder) { return "collapsed:" + folder; }

  // ---------- Auth UI ----------
  function updateAuthUI() {
    if (TOKEN) {
      authBtn.textContent = "Connecté · se déconnecter";
      authBtn.classList.add("connected");
    } else {
      authBtn.textContent = "Se connecter pour éditer";
      authBtn.classList.remove("connected");
    }
  }

  function openAuthModal(afterAuth) {
    pendingAfterAuth = afterAuth || null;
    loginError.textContent = "";
    tokenInput.value = "";
    authModal.hidden = false;
    tokenInput.focus();
  }
  function closeAuthModal() {
    authModal.hidden = true;
    pendingAfterAuth = null;
  }

  authBtn.addEventListener("click", () => {
    if (TOKEN) {
      TOKEN = "";
      sessionStorage.removeItem("gh_token");
      updateAuthUI();
      syncStatus.textContent = "";
    } else {
      openAuthModal(null);
    }
  });

  cancelAuthBtn.addEventListener("click", closeAuthModal);

  loginBtn.addEventListener("click", async () => {
    const tok = tokenInput.value.trim();
    if (!tok) {
      loginError.textContent = "Entre un token GitHub.";
      return;
    }
    loginBtn.disabled = true;
    loginBtn.textContent = "Vérification…";
    loginError.textContent = "";
    try {
      const res = await fetch(API + "/repos/" + REPO, {
        headers: { Accept: "application/vnd.github+json", Authorization: "Bearer " + tok },
      });
      if (!res.ok) {
        loginError.textContent = "Token invalide ou sans accès à ce dépôt (" + res.status + ").";
        return;
      }
      TOKEN = tok;
      sessionStorage.setItem("gh_token", TOKEN);
      updateAuthUI();
      const resume = pendingAfterAuth;
      closeAuthModal();
      if (resume) resume();
    } catch (e) {
      loginError.textContent = "Erreur réseau : " + e.message;
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = "Se connecter";
    }
  });

  function requireAuth(afterAuth) {
    if (TOKEN) { afterAuth(); return; }
    openAuthModal(afterAuth);
  }

  // ---------- Tree ----------
  async function loadTree() {
    syncStatus.textContent = "Chargement…";
    syncStatus.className = "sync-status";
    try {
      const res = await gh("/repos/" + REPO + "/git/trees/" + BRANCH + "?recursive=1");
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      const categories = CAT_FOLDERS.map(([folder, label]) => ({ folder, label, notes: [] }));
      const catByFolder = Object.fromEntries(categories.map((c) => [c.folder, c]));
      const annexes = [];
      for (const entry of data.tree || []) {
        if (entry.type !== "blob") continue;
        const parts = entry.path.split("/");
        if (parts.length !== 2) continue;
        const [folder, fname] = parts;
        if (folder === ANNEX_DIR) {
          annexes.push({ name: fname, path: entry.path });
        } else if (catByFolder[folder] && fname.endsWith(".md")) {
          catByFolder[folder].notes.push({ title: fname.slice(0, -3), path: entry.path });
        }
      }
      for (const cat of categories) {
        cat.notes.sort((a, b) => cmpSortKey(a.title, b.title));
      }
      annexes.sort((a, b) => a.name.localeCompare(b.name));
      TREE = { categories, annexes };
      TITLE_INDEX = {};
      for (const cat of TREE.categories) {
        for (const note of cat.notes) {
          TITLE_INDEX[note.title] = { cat: cat.folder, label: cat.label, path: note.path };
        }
      }
      renderSidebar();
      syncStatus.textContent = "";
    } catch (e) {
      syncStatus.textContent = "Erreur de chargement : " + e.message;
      syncStatus.className = "sync-status error";
    }
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
      for (const note of cat.notes) {
        const item = document.createElement("div");
        item.className = "note-item";
        item.textContent = note.title;
        item.dataset.cat = cat.folder;
        item.dataset.title = note.title;
        if (current && current.cat === cat.folder && current.title === note.title) {
          item.classList.add("active");
        }
        item.addEventListener("click", () => openNote(cat.folder, note.title));
        list.appendChild(item);
      }
      const addBtn = document.createElement("div");
      addBtn.className = "add-note-btn";
      addBtn.textContent = "+ Nouvelle fiche";
      addBtn.addEventListener("click", () => requireAuth(() => createNote(cat.folder, cat.label)));
      list.appendChild(addBtn);

      block.appendChild(list);
      categoriesEl.appendChild(block);
    }
  }

  async function createNote(cat, label) {
    const title = prompt("Titre de la nouvelle fiche (" + label + ") :");
    if (!title || !title.trim()) return;
    const t = title.trim();
    const fname = t.replace(/\//g, "-").replace(/:/g, " -") + ".md";
    const path = cat + "/" + fname;
    if (TITLE_INDEX[t]) {
      alert("Une fiche avec ce titre existe déjà.");
      return;
    }
    const content = "# " + t + "\n\n*Catégorie : " + label + "*\n\n*(pas de contenu rédigé)*";
    try {
      const res = await gh("/repos/" + REPO + "/contents/" + encodeURIComponent(path).replace(/%2F/g, "/"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Nouvelle fiche « " + t + " » depuis l'interface",
          content: b64EncodeUtf8(content),
          branch: BRANCH,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert("Impossible de créer la fiche : " + (err.message || res.status));
        return;
      }
      await loadTree();
      openNote(cat, t);
    } catch (e) {
      alert("Erreur réseau : " + e.message);
    }
  }

  // Convert [[Target]] / [[Target|Alias]] into HTML anchors BEFORE markdown parsing.
  function convertWikilinks(md) {
    return md.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (whole, target, alias) => {
      target = target.trim();
      const display = (alias || target).trim();
      if (target.startsWith("annexes/")) {
        const fname = target.slice("annexes/".length);
        return '<a class="filelink" data-annex="' + escapeHtml(fname) + '">' + escapeHtml(display) + "</a>";
      }
      const stem = target.split("/").pop();
      const known = TITLE_INDEX[stem];
      if (known) {
        return '<a class="wikilink" data-cat="' + escapeHtml(known.cat) + '" data-title="' +
          escapeHtml(stem) + '">' + escapeHtml(display) + "</a>";
      }
      return '<a class="wikilink missing" title="Fiche introuvable">' + escapeHtml(display) + "</a>";
    });
  }

  async function openNote(cat, title) {
    if (dirty && !confirm("Des modifications non enregistrées seront perdues. Continuer ?")) return;
    dirty = false;
    setEditing(false);
    saveStatus.textContent = "";
    try {
      const path = cat + "/" + title + ".md";
      const res = await gh("/repos/" + REPO + "/contents/" + encodeURIComponent(path).replace(/%2F/g, "/") + "?ref=" + BRANCH);
      if (!res.ok) { alert("Fiche introuvable."); return; }
      const data = await res.json();
      const content = b64DecodeUtf8(data.content);
      current = { cat, title, path, sha: data.sha };

      emptyEl.hidden = true;
      noteEl.hidden = false;
      const label = (TREE.categories.find((c) => c.folder === cat) || {}).label || cat;
      noteCatEl.textContent = label;

      editorEl.value = content;
      renderPreview(content);

      document.querySelectorAll(".note-item").forEach((el) => {
        el.classList.toggle("active", el.dataset.cat === cat && el.dataset.title === title);
      });
      window.scrollTo(0, 0);
      noteEl.querySelector(".note-toolbar").scrollIntoView({ block: "start" });
    } catch (e) {
      alert("Erreur de chargement : " + e.message);
    }
  }

  async function openAnnex(fname) {
    const entry = (TREE.annexes || []).find((a) => a.name === fname);
    if (!entry) { alert("Annexe introuvable."); return; }
    try {
      const res = await gh("/repos/" + REPO + "/contents/" + encodeURIComponent(entry.path).replace(/%2F/g, "/") + "?ref=" + BRANCH);
      if (!res.ok) { alert("Annexe introuvable."); return; }
      const data = await res.json();
      const bytes = b64DecodeBinary(data.content);
      const ctype = fname.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream";
      const blob = new Blob([bytes], { type: ctype });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      alert("Erreur : " + e.message);
    }
  }

  function renderPreview(md) {
    const withLinks = convertWikilinks(md);
    previewEl.innerHTML = marked.parse(withLinks);
    previewEl.querySelectorAll("a.wikilink[data-cat]").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        openNote(a.dataset.cat, a.dataset.title);
      });
    });
    previewEl.querySelectorAll("a.filelink[data-annex]").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        openAnnex(a.dataset.annex);
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
    const enteringEdit = editorEl.hidden; // currently in preview -> switch to edit
    if (enteringEdit) {
      requireAuth(() => {
        setEditing(true);
        editorEl.focus();
      });
    } else {
      renderPreview(editorEl.value);
      setEditing(false);
    }
  });

  editorEl.addEventListener("input", () => {
    dirty = true;
    saveStatus.textContent = "Modifié";
  });

  async function doSave() {
    if (!current) return;
    saveStatus.textContent = "Enregistrement…";
    try {
      const res = await gh("/repos/" + REPO + "/contents/" + encodeURIComponent(current.path).replace(/%2F/g, "/"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Édition « " + current.title + " » depuis l'interface",
          content: b64EncodeUtf8(editorEl.value),
          sha: current.sha,
          branch: BRANCH,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        dirty = false;
        current.sha = data.content && data.content.sha ? data.content.sha : current.sha;
        const short = data.commit && data.commit.sha ? data.commit.sha.slice(0, 7) : "";
        saveStatus.textContent = "Enregistré ✓" + (short ? " (" + short + ")" : "");
        renderPreview(editorEl.value);
        setTimeout(() => { if (saveStatus.textContent.startsWith("Enregistré")) saveStatus.textContent = ""; }, 3000);
      } else {
        saveStatus.textContent = "Erreur : " + (data.message || res.status);
      }
    } catch (e) {
      saveStatus.textContent = "Erreur réseau : " + e.message;
    }
  }

  saveBtn.addEventListener("click", () => requireAuth(doSave));

  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      if (!editorEl.hidden) requireAuth(doSave);
    }
    if (e.key === "Escape" && !authModal.hidden) closeAuthModal();
  });

  // ---------- Boot ----------
  (async function boot() {
    updateAuthUI();
    try {
      const res = await gh("/repos/" + REPO);
      if (res.ok) {
        const data = await res.json();
        BRANCH = data.default_branch || "main";
      }
    } catch (e) {
      // ignore — fall back to default branch "main"
    }
    await loadTree();
  })();
})();
