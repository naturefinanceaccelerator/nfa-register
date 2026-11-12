#!/usr/bin/env python3
"""
Locks the register site behind a password. Used by the GitHub workflow (.github/workflows/collect.yml).

What it does:
  1. Takes the site as collected by tools/collect.py: pages, styles, scripts, project data, photos, sounds.
  2. Locks all of it into one encrypted file (AES-256-GCM, key from the password with PBKDF2-SHA256,
     600,000 rounds). Same lock as web_register.py and the NFA maps.
  3. Writes the folder _site: index.html, project.html, about.html (password pages) plus site.bin.
     GitHub Pages publishes only _site - the open pages are never published.

The password is NOT in this file. It comes from the repository secret REGISTER_PASSWORD
(GitHub -> nfa-register -> Settings -> Secrets and variables -> Actions).
Without the secret this script stops and nothing is published.

The login page below is the same as in web_register.py. If you change one, change the other.
"""
import base64
import gzip
import hashlib
import json
import mimetypes
import os
import sys
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

SITE = Path(__file__).resolve().parent.parent
OUT = SITE / "_site"
PASSWORD = os.environ.get("REGISTER_PASSWORD", "")
ITERATIONS = 600_000
PAGES = {"index.html": "NFA Project Register", "project.html": "Project \u00b7 NFA Project Register",
         "about.html": "How it works \u00b7 NFA Project Register"}
SKIP_DIRS = {".git", ".github", "tools", "registry", "__pycache__", "_site"}
SKIP_FILES = {"README.md", "CITATION.cff", "LICENSE", "robots.txt", "404.html", ".gitignore", ".gitattributes",
              ".nojekyll", "preview.bat", "collect.bat"}
MIME = {".woff2": "font/woff2", ".json": "application/json", ".rdf": "application/rdf+xml", ".js": "text/javascript",
        ".css": "text/css", ".geojson": "application/geo+json", ".mp3": "audio/mpeg", ".m4a": "audio/mp4",
        ".ogg": "audio/ogg", ".wav": "audio/wav", ".flac": "audio/flac", ".webp": "image/webp", ".svg": "image/svg+xml"}


def bundle():
    files, pages = {}, {}
    for f in sorted(SITE.rglob("*")):
        rel = f.relative_to(SITE).as_posix()
        if not f.is_file() or set(rel.split("/")[:-1]) & SKIP_DIRS or f.name in SKIP_FILES or f.suffix == ".bat":
            continue
        if rel in PAGES:
            pages[rel] = f.read_text(encoding="utf-8")
            continue
        mime = MIME.get(f.suffix.lower()) or mimetypes.guess_type(f.name)[0] or "application/octet-stream"
        files[rel] = {"t": mime, "d": base64.b64encode(f.read_bytes()).decode("ascii")}
    return {"pages": pages, "files": files}


def lock(data):
    salt, iv = os.urandom(16), os.urandom(12)
    key = hashlib.pbkdf2_hmac("sha256", PASSWORD.encode("utf-8"), salt, ITERATIONS, dklen=32)
    ct = AESGCM(key).encrypt(iv, gzip.compress(json.dumps(data, separators=(",", ":")).encode("utf-8"), 9), None)
    return b"GRB1" + ITERATIONS.to_bytes(4, "big") + salt + iv + ct


LOGIN = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>__TITLE__</title>
<link rel="icon" href="__LOGO__">
<style>
:root { color-scheme: light; --forest: #0C3024; --sage: #527A64; --mist: #D3E4DA; --line: #9DBDA9; --paper: #F6F7F5; }
* { box-sizing: border-box; }
html, body { height: 100%; margin: 0; }
body { background: var(--paper); color: var(--forest); font: 15px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
       display: grid; place-items: center; padding: 16px; }
body.auto form { visibility: hidden; }
form { width: 100%; max-width: 340px; background: #fff; border: 1px solid var(--mist); border-radius: 10px;
       padding: 22px 24px 20px; box-shadow: 0 8px 28px rgba(27, 45, 35, 0.07); }
img { display: block; width: 170px; max-width: 100%; height: auto; margin: 0 0 18px; }
.eyebrow { font: 500 11px/1 ui-monospace, Consolas, monospace; letter-spacing: 0.08em; text-transform: uppercase;
           color: var(--sage); margin: 0 0 6px; }
h1 { font: 700 22px/1.15 system-ui, -apple-system, "Segoe UI", sans-serif; margin: 0 0 18px; }
label { display: block; font-size: 13px; color: var(--sage); margin: 0 0 6px; }
input { display: block; width: 100%; height: 34px; font: 16px system-ui, -apple-system, "Segoe UI", sans-serif;
        color: var(--forest); background: #fff; border: 1px solid var(--line); border-radius: 8px; padding: 0 12px; }
input:focus { outline: 2px solid var(--sage); outline-offset: 1px; }
button { display: block; width: 100%; height: 36px; margin: 12px 0 0; font: 600 15px system-ui, sans-serif;
         color: #fff; background: var(--forest); border: 0; border-radius: 6px; cursor: pointer; }
button:disabled { opacity: 0.6; cursor: progress; }
#msg { margin: 10px 0 0; font-size: 13px; color: #A3302F; }
#msg:empty { display: none; }
.contact { margin: 14px 0 0; font-size: 11px; color: var(--sage); }
.contact a { color: inherit; }
</style>
</head>
<body>
<form id="f" autocomplete="off">
  <img src="__LOGO__" alt="Nature Finance Accelerator" width="560" height="184">
  <p class="eyebrow">Project register · internal</p>
  <h1>NFA Project Register</h1>
  <label for="p">Password</label>
  <input id="p" name="password" type="password" autocomplete="off" required>
  <button id="b" type="submit">Open</button>
  <p id="msg" role="alert"></p>
  <p class="contact">Questions: <a href="mailto:matthias.haeni@nfa.ch">matthias.haeni@nfa.ch</a></p>
</form>
<script>
(() => {
  const PAGE = "__PAGE__", STORE = "nfa-register-key";
  const msg = document.getElementById("msg"), btn = document.getElementById("b"), pw = document.getElementById("p");
  let buf = null;
  const load = async () => buf || (buf = new Uint8Array(await (await fetch("site.bin", { cache: "no-cache" })).arrayBuffer()));
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const toB64 = (a) => btoa(String.fromCharCode(...new Uint8Array(a)));

  // Runs inside the unlocked page: serves the site's own files from memory.
  function patch() {
    const U = window.__NFA_URLS, base = location.pathname.replace(/[^/]*$/, "");
    const norm = (u) => {
      try {
        const x = new URL(u, location.href);
        if (x.origin !== location.origin || !x.pathname.startsWith(base)) return null;
        return decodeURIComponent(x.pathname.slice(base.length));
      } catch (e) { return null; }
    };
    const map = (u) => { const p = typeof u === "string" ? norm(u) : null; return p && U[p] ? U[p] : u; };
    const f = window.fetch.bind(window);
    window.fetch = (input, init) => f(typeof input === "string" ? map(input) : input, init);
    for (const C of [HTMLImageElement, HTMLMediaElement, HTMLSourceElement]) {
      const d = Object.getOwnPropertyDescriptor(C.prototype, "src");
      if (d && d.set) Object.defineProperty(C.prototype, "src", { configurable: true, get() { return d.get.call(this); }, set(v) { d.set.call(this, map(v)); } });
    }
    const fix = (el) => {
      if (!el.getAttribute) return;
      for (const a of ["src", "href"]) {
        const v = el.getAttribute(a);
        if (!v || /^(blob:|data:|#|mailto:|https?:)/.test(v)) continue;
        const m = map(v);
        if (m !== v) el.setAttribute(a, m);
      }
    };
    new MutationObserver((ms) => {
      for (const m of ms) {
        if (m.type === "attributes") fix(m.target);
        for (const n of m.addedNodes || []) if (n.nodeType === 1) { fix(n); n.querySelectorAll("[src],[href]").forEach(fix); }
      }
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["src", "href"] });
  }

  async function open(raw) {
    const data = await load();
    const iv = data.slice(24, 36), ct = data.slice(36);
    const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    const site = JSON.parse(await new Response(new Blob([plain]).stream().pipeThrough(new DecompressionStream("gzip"))).text());
    sessionStorage.setItem(STORE, toB64(raw));
    const urls = {}, css = [];
    for (const [p, f] of Object.entries(site.files)) {
      if (f.t === "text/css") { css.push(p); continue; }
      urls[p] = URL.createObjectURL(new Blob([b64(f.d)], { type: f.t }));
    }
    for (const p of css) {
      const dir = p.replace(/[^/]*$/, "");
      let text = new TextDecoder().decode(b64(site.files[p].d));
      text = text.replace(/url\((['"]?)([^'")]+)\1\)/g, (m, q, u) => {
        if (/^(data:|https?:|#)/.test(u)) return m;
        const abs = new URL(u, "https://x/" + dir).pathname.slice(1);
        return urls[abs] ? `url("${urls[abs]}")` : m;
      });
      urls[p] = URL.createObjectURL(new Blob([text], { type: "text/css" }));
    }
    let html = site.pages[PAGE] || site.pages["index.html"];
    html = html.replace(/\b(src|href)="([^"?#]+)[^"]*"/g, (m, a, u) => (urls[u] ? `${a}="${urls[u]}"` : m));
    const prelude = `<script>window.__NFA_URLS=${JSON.stringify(urls)};(${patch.toString()})();<\/script>`;
    html = html.replace(/<head[^>]*>/i, (h) => h + prelude);
    document.open(); document.write(html); document.close();
  }

  async function derive(word) {
    const data = await load();
    const rounds = new DataView(data.buffer).getUint32(4), salt = data.slice(8, 24);
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(word), "PBKDF2", false, ["deriveBits"]);
    return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: rounds }, base, 256);
  }

  if (!window.crypto || !crypto.subtle) {
    msg.textContent = "Open this page via https://.";
    btn.disabled = true;
    return;
  }
  const saved = sessionStorage.getItem(STORE);
  if (saved) {
    document.body.classList.add("auto");
    open(b64(saved)).catch(() => { sessionStorage.removeItem(STORE); document.body.classList.remove("auto"); pw.focus(); });
  } else pw.focus();
  document.getElementById("f").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    btn.disabled = true; msg.textContent = "";
    try {
      const raw = await derive(pw.value);
      try { await open(raw); } catch (e) { throw new Error("Wrong password."); }
    } catch (e) {
      msg.textContent = e.message || String(e);
      btn.disabled = false; pw.value = ""; pw.focus();
    }
  });
})();
</script>
</body>
</html>
"""


def main():
    if not PASSWORD:
        print("The secret REGISTER_PASSWORD is not set, so nothing is published.")
        print("Set it once: GitHub -> nfa-register -> Settings -> Secrets and variables -> Actions")
        print("-> New repository secret -> Name REGISTER_PASSWORD, Secret = the password. Then run the workflow again.")
        sys.exit(1)
    data = bundle()
    missing = [p for p in PAGES if p not in data["pages"]]
    if missing:
        print("Pages not found: " + ", ".join(missing))
        sys.exit(1)
    locked = lock(data)
    logo = SITE / "assets" / "img" / "logo-nfa-ink.png"
    logo_uri = "data:image/png;base64," + base64.b64encode(logo.read_bytes()).decode("ascii")
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "site.bin").write_bytes(locked)
    for page, title in PAGES.items():
        html = LOGIN.replace("__TITLE__", title).replace("__LOGO__", logo_uri).replace("__PAGE__", page)
        (OUT / page).write_text(html, encoding="utf-8")
    size = sum(f.stat().st_size for f in OUT.iterdir() if f.is_file())
    print(f"{len(data['files'])} files plus {len(data['pages'])} pages locked -> _site ({size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
