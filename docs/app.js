// Base de connaissances — client 100% navigateur, lit/écrit directement
// dans le dépôt GitHub via l'API REST. Aucun serveur nécessaire.
(function () {
  "use strict";

  const API = "https://api.github.com";
  const CATS = [
    ["plan", "Plan"],
    ["expériences et cas", "Expériences & cas"],
    ["références et concepts", "Références & concepts"],
    ["idées, thèses et arguments", "Idées, thèses et arguments"],
  ];
  const CAT_FOLDERS = new Set(CATS.map((c) => c[0]));
  const ANNEX_DIR = "annexes";

  let TOKEN = sessionStorage.getItem("gh_token") || "";
  let REPO = sessionStorage.getItem("gh_repo") || "";
  let BRANCH = "main";
  let TREE = { categories: [], annexesSet: new Set() };
  let TITLE_INDEX = {}; // title -> {cat, label}
  let current = null;   // {cat, title, sha, path}
  let dirty = false;

  // ---------- DOM refs ----------
  const loginScreen = document.getElementById("login");
  const appRoot = document.getElementById("app");
  const repoInput = document.getElementById("repoInput");
  const tokenInput = document.getElementById("tokenInput");
  const loginBtn = document.getElementById("loginBtn");
  const loginError = document.getElementById("loginError");
  const logoutBtn = document.getElementById("logoutBtn");
  const repoLabel = document.getElementById("repoLabel");
  const syncStatusEl = document.getElementById("syncStatus");

  const categoriesEl = document.getElementById("categories");
  const emptyEl = document.getElementById("empty");
  const noteEl = document.getElementById("note");
  const previewEl = document.getElementById("preview");
  const editorEl = document.getElementById("editor");
  const noteCatEl = document.getElementById("noteCat");
  const editToggle = document.getElementById("editToggle");
  const saveBtn = document.getElementById("saveBtn");
  const saveStatus = document.getElementById("saveStatus");

  marked.setOptions({ breaks: false, gfm: true });

  // ---------- GitHub API helpers ----------
  async function gh(path, opts) {
    const res = await fetch(API + path, Object.assign({
      headers: Object.assign({
        Authorization: "Bearer " + TOKEN,
        Accept: "application/vnd.github+json",
      }, (opts && opts.headers) || {}),
    }, opts || {}));
    return res;
  }

  function b64EncodeUtf8(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
      (m, p1) => String.fromCharCode(parseInt(p1, 16))));
  }
  function b64DecodeUtf8(b64) {
    const clean = b64.replace(/\n/g, "");
    return decodeURIComponent(atob(clean).split("").map((c) =>
      "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""));
  }
  function b64DecodeBinary(b64) {
    const clean = b64.replace(/\n/g, "");
    const bin = atob(clean);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }

  function pathFor(cat, title) {
    return cat + "/" + title + ".md";
  }
  function apiPathEncode(path) {
    return path.split("/").map(encodeURIComponent).join("/");
  }

  // ---------- Login ----------
  function showLogin(errMsg) {
    loginScreen.hidden = false;
    appRoot.hidden = true;
    if (errMsg) loginError.textContent = errMsg;
  }
  function showApp() {
    loginScreen.hidden = true;
    appRoot.hidden = false;
    repoLabel.textContent = REPO;
  }

  loginBtn.addEventListener("click", async () => {
    const repo = repoInput.value.trim();
    const token = tokenInput.value.trim();
    loginError.textContent = "";
    if (!repo.includes("/") || !token) {
      loginError.textContent = "Renseigne le dépôt (owner/repo) et le token.";
      return;
    }
    loginBtn.disabled = true;
    loginBtn.textContent = "Connexion…";
    TOKEN = token;
    REPO = repo;
    try {
      const res = await gh("/repos/" + repo);
      if (res.status === 401) throw new Error("Token invalide ou expiré.");
      if (res.status === 404) throw new Error("Dépôt introuvable, ou le token n'y a pas accès.");
      if (!res.ok) throw new Error("Erreur GitHub (" + res.status + ").");
      const data = await res.json();
      BRANCH = data.default_branch || "main";
      sessionStorage.setItem("gh_token", TOKEN);
      sessionStorage.setItem("gh_repo", REPO);
      showApp();
      await loadTree();
    } catch (e) {
      showLogin(e.message);
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = "Se connecter";
    }
  });

  logoutBtn.addEventListener("click", () => {
    sessionStorage.removeItem("gh_token");
    sessionStorage.removeItem("gh_repo");
    location.reload();
  });

  // ---------- Tree ----------
  function sortKey(title) {
    const m = title.match(/^(\d+(?:\.\d+)*)/);
    if (!m) return { rank: 1, nums: [999], text: title.toLowerCase() };
    return { rank: 0, nums: m[1].split(".").map(Number), text: title.toLowerCase() };
  }
  function cmpSortKey(a, b) {
    const ka = sortKey(a), kb = sortKey(b);
    if (ka.rank !== kb.rank) return ka.rank - kb.rank;
    const len = Math.max(ka.nums.length, kb.nums.length);
    for (let i = 0; i < len; i++) {
      const va = ka.nums[i] ?? -1, vb = kb.nums[i] ?? -1;
      if (va !== vb) return va - vb;
    }
    return ka.text < kb.text ? -1 : ka.text > kb.text ? 1 : 0;
  }

  async function loadTree() {
    setSync("Chargement…", "");
    const res = await gh("/repos/" + REPO + "/git/trees/" + BRANCH + "?recursive=1");
    if (!res.ok) { setSync("Erreur de chargement (" + res.status + ")", "error"); return; }
    const data = await res.json();
    const byFolder = {};
    for (const [folder] of CATS) byFolder[folder] = [];
    const annexes = [];

    for (const entry of data.tree) {
      if (entry.type !== "blob") continue;
      const parts = entry.path.split("/");
      if (parts.length !== 2) continue;
      const [folder, fname] = parts;
      if (CAT_FOLDERS.has(folder) && fname.endsWith(".md")) {
        byFolder[folder].push(fname.slice(0, -3));
      } else if (folder === ANNEX_DIR) {
        annexes.push(fname);
      }
    }

    TREE.categories = CATS.map(([folder, label]) => ({
      folder, label, notes: byFolder[folder].sort(cmpSortKey),
    }));
    TREE.annexesSet = new Set(annexes);

    TITLE_INDEX = {};
    for (const cat of TREE.categories) {
      for (const t of cat.notes) TITLE_INDEX[t] = { cat: cat.folder, label: cat.label };
    }
    setSync("", "");
    renderSidebar();
  }

  function setSync(msg, kind) {
    syncStatusEl.textContent = msg;
    syncStatusEl.className = "sync-status" + (kind ? " " + kind : "");
  }

  function renderSidebar() {
    categoriesEl.innerHTML = "";
    for (const cat of TREE.categories) {
      const block = document.createElement("div");
      block.className = "cat-block";
      if (localStorage.getItem("collapsed:" + cat.folder) === "1") block.classList.add("collapsed");

      const title = document.createElement("div");
      title.className = "cat-title";
      title.innerHTML = '<span class="chevron">▾</span><span>' + escapeHtml(cat.label) +
        '</span><span class="cat-count">' + cat.notes.length + "</span>";
      title.addEventListener("click", () => {
        block.classList.toggle("collapsed");
        localStorage.setItem("collapsed:" + cat.folder, block.classList.contains("collapsed") ? "1" : "0");
      });
      block.appendChild(title);

      const list = document.createElement("div");
      list.className = "note-list";
      for (const t of cat.notes) {
        const item = document.createElement("div");
        item.className = "note-item";
        item.textContent = t;
        if (current && current.cat === cat.folder && current.title === t) item.classList.add("active");
        item.addEventListener("click", () => openNote(cat.folder, t));
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

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  // ---------- Notes ----------
  async function createNote(cat, label) {
    const title = prompt("Titre de la nouvelle fiche (" + label + ") :");
    if (!title || !title.trim()) return;
    const clean = title.trim();
    const path = pathFor(cat, clean);
    const content = "# " + clean + "\n\n*Catégorie : " + label + "*\n\n*(pas de contenu rédigé)*";
    setSync("Création…", "");
    const res = await gh("/repos/" + REPO + "/contents/" + apiPathEncode(path), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Nouvelle fiche « " + clean + " » depuis l'interface",
        content: b64EncodeUtf8(content),
        branch: BRANCH,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setSync("Échec création : " + (err.message || res.status), "error");
      return;
    }
    setSync("Fiche créée ✓", "ok");
    await loadTree();
    openNote(cat, clean);
  }

  async function openNote(cat, title) {
    if (dirty && !confirm("Des modifications non enregistrées seront perdues. Continuer ?")) return;
    setSync("Chargement de la fiche…", "");
    const path = pathFor(cat, title);
    const res = await gh("/repos/" + REPO + "/contents/" + apiPathEncode(path) + "?ref=" + BRANCH);
    if (!res.ok) { setSync("Fiche introuvable (" + res.status + ")", "error"); return; }
    const data = await res.json();
    const content = b64DecodeUtf8(data.content);

    current = { cat, title, sha: data.sha, path };
    dirty = false;
    setSync("", "");

    emptyEl.hidden = true;
    noteEl.hidden = false;
    const label = (TREE.categories.find((c) => c.folder === cat) || {}).label || cat;
    noteCatEl.textContent = label;

    setEditing(false);
    editorEl.value = content;
    renderPreview(content);
    saveStatus.textContent = "";

    renderSidebar(); // re-render so the newly opened note is highlighted as active
    window.scrollTo(0, 0);
  }

  function convertWikilinks(md) {
    return md.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (whole, target, alias) => {
      target = target.trim();
      const display = (alias || target).trim();
      if (target.startsWith("annexes/")) {
        const fname = target.slice("annexes/".length);
        return '<a class="filelink" href="#" data-annex="' + escapeHtml(fname) + '">' + escapeHtml(display) + "</a>";
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
      a.addEventListener("click", async (e) => {
        e.preventDefault();
        await openAnnex(a.dataset.annex);
      });
    });
  }

  async function openAnnex(fname) {
    setSync("Téléchargement de l'annexe…", "");
    const path = ANNEX_DIR + "/" + fname;
    const res = await gh("/repos/" + REPO + "/contents/" + apiPathEncode(path) + "?ref=" + BRANCH);
    if (!res.ok) { setSync("Annexe introuvable (" + res.status + ")", "error"); return; }
    const data = await res.json();
    const bytes = b64DecodeBinary(data.content);
    const mime = fname.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream";
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setSync("", "");
  }

  function setEditing(editing) {
    previewEl.hidden = editing;
    editorEl.hidden = !editing;
    saveBtn.hidden = !editing;
    editToggle.textContent = editing ? "Aperçu" : "Éditer";
  }

  editToggle.addEventListener("click", () => {
    const editing = editorEl.hidden;
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
    const res = await gh("/repos/" + REPO + "/contents/" + apiPathEncode(current.path), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Édition « " + current.title + " » depuis l'interface",
        content: b64EncodeUtf8(editorEl.value),
        sha: current.sha,
        branch: BRANCH,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      current.sha = data.content.sha;
      dirty = false;
      const commitSha = (data.commit && data.commit.sha || "").slice(0, 7);
      saveStatus.textContent = "Enregistré ✓" + (commitSha ? " (" + commitSha + ")" : "");
      renderPreview(editorEl.value);
      setTimeout(() => { if (saveStatus.textContent.startsWith("Enregistré")) saveStatus.textContent = ""; }, 3000);
    } else {
      const err = await res.json().catch(() => ({}));
      saveStatus.textContent = "Erreur : " + (err.message || res.status);
    }
  });

  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      if (!editorEl.hidden) saveBtn.click();
    }
  });

  // ---------- Boot ----------
  (async function boot() {
    if (TOKEN && REPO) {
      try {
        const res = await gh("/repos/" + REPO);
        if (!res.ok) throw new Error("Session expirée, reconnecte-toi.");
        const data = await res.json();
        BRANCH = data.default_branch || "main";
        showApp();
        await loadTree();
        return;
      } catch (e) {
        sessionStorage.removeItem("gh_token");
        sessionStorage.removeItem("gh_repo");
      }
    }
    showLogin();
  })();
})();
