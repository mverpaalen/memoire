#!/usr/bin/env python3
"""
Base de connaissances - Mémoire — mini serveur local type Notion.

Usage:
    cd memoire
    python3 app/server.py            # démarre sur http://localhost:8420
    python3 app/server.py 8080       # port personnalisé

Aucune dépendance externe : uniquement la bibliothèque standard Python 3.
Le serveur lit et écrit directement les fichiers .md du dossier parent
(plan/, expériences et cas/, références et concepts/, idées, thèses et
arguments/, annexes/). Si ce dossier est un dépôt git, le bouton
"Commit & push" dans l'interface fonctionne aussi (utilise votre config
git locale).
"""
import http.server
import json
import os
import re
import socketserver
import subprocess
import sys
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")

CATS = [
    ("plan", "Plan"),
    ("expériences et cas", "Expériences & cas"),
    ("références et concepts", "Références & concepts"),
    ("idées, thèses et arguments", "Idées, thèses et arguments"),
]
ANNEX_DIR = "annexes"


def sort_key(title):
    m = re.match(r"^(\d+(?:\.\d+)*)", title)
    if not m:
        return (1, (999,), title.lower())
    return (0, tuple(int(x) for x in m.group(1).split(".")), title.lower())


def list_notes(cat_folder):
    d = os.path.join(ROOT, cat_folder)
    if not os.path.isdir(d):
        return []
    notes = []
    for fn in os.listdir(d):
        if fn.endswith(".md"):
            notes.append(fn[:-3])
    notes.sort(key=sort_key)
    return notes


def safe_path(cat, fn):
    """Prevent path traversal; only allow known category folders + annexes."""
    valid_folders = [c for c, _ in CATS] + [ANNEX_DIR]
    if cat not in valid_folders:
        return None
    if "/" in fn or "\\" in fn or fn.startswith("."):
        return None
    return os.path.join(ROOT, cat, fn)


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # keep console quiet

    def _send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, path, content_type):
        with open(path, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _read_json_body(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8"))

    # ---------- GET ----------
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        qs = urllib.parse.parse_qs(parsed.query)

        if path == "/" or path == "/index.html":
            return self._send_file(os.path.join(STATIC_DIR, "index.html"), "text/html; charset=utf-8")
        if path == "/app.js":
            return self._send_file(os.path.join(STATIC_DIR, "app.js"), "application/javascript; charset=utf-8")
        if path == "/style.css":
            return self._send_file(os.path.join(STATIC_DIR, "style.css"), "text/css; charset=utf-8")

        if path == "/api/tree":
            categories = []
            for folder, label in CATS:
                categories.append({"folder": folder, "label": label, "notes": list_notes(folder)})
            annexes = []
            ad = os.path.join(ROOT, ANNEX_DIR)
            if os.path.isdir(ad):
                annexes = sorted(f for f in os.listdir(ad) if not f.startswith("."))
            return self._send_json({"categories": categories, "annexes": annexes, "root": ROOT})

        if path == "/api/note":
            cat = qs.get("cat", [""])[0]
            fn = qs.get("file", [""])[0] + ".md"
            fp = safe_path(cat, fn)
            if not fp or not os.path.isfile(fp):
                return self._send_json({"error": "not found"}, 404)
            with open(fp, encoding="utf-8") as f:
                content = f.read()
            return self._send_json({"content": content})

        if path == "/api/file":
            fn = qs.get("name", [""])[0]
            fp = safe_path(ANNEX_DIR, fn)
            if not fp or not os.path.isfile(fp):
                return self._send_json({"error": "not found"}, 404)
            ctype = "application/pdf" if fn.lower().endswith(".pdf") else "application/octet-stream"
            return self._send_file(fp, ctype)

        self.send_response(404)
        self.end_headers()

    # ---------- POST ----------
    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/note":
            data = self._read_json_body()
            cat, fn, content = data.get("cat", ""), data.get("file", "") + ".md", data.get("content", "")
            fp = safe_path(cat, fn)
            if not fp:
                return self._send_json({"error": "invalid path"}, 400)
            os.makedirs(os.path.dirname(fp), exist_ok=True)
            with open(fp, "w", encoding="utf-8") as f:
                f.write(content)
            return self._send_json({"ok": True})

        if path == "/api/note-create":
            data = self._read_json_body()
            cat, title = data.get("cat", ""), data.get("title", "").strip()
            if cat not in [c for c, _ in CATS] or not title:
                return self._send_json({"error": "invalid"}, 400)
            fn = title.replace("/", "-").replace(":", " -") + ".md"
            fp = safe_path(cat, fn)
            if not fp:
                return self._send_json({"error": "invalid path"}, 400)
            if os.path.exists(fp):
                return self._send_json({"error": "exists"}, 409)
            label = dict(CATS)[cat]
            default = f"# {title}\n\n*Catégorie : {label}*\n\n*(pas de contenu rédigé)*"
            with open(fp, "w", encoding="utf-8") as f:
                f.write(default)
            return self._send_json({"ok": True, "file": title})

        if path == "/api/git-commit":
            data = self._read_json_body()
            message = data.get("message") or "Mise à jour depuis l'interface"
            try:
                subprocess.run(["git", "add", "-A"], cwd=ROOT, check=True, capture_output=True, text=True)
                commit = subprocess.run(["git", "commit", "-m", message], cwd=ROOT, capture_output=True, text=True)
                push = subprocess.run(["git", "push"], cwd=ROOT, capture_output=True, text=True)
                ok = push.returncode == 0
                out = (commit.stdout + commit.stderr + "\n" + push.stdout + push.stderr).strip()
                return self._send_json({"ok": ok, "log": out})
            except Exception as e:
                return self._send_json({"ok": False, "log": str(e)})

        self.send_response(404)
        self.end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8420
    with socketserver.ThreadingTCPServer(("127.0.0.1", port), Handler) as httpd:
        print(f"Base de connaissances — http://localhost:{port}  (dossier : {ROOT})")
        print("Ctrl+C pour arrêter.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
