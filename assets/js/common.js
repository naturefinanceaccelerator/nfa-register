/* NFA Project Register – shared helpers. Plain JavaScript, no build step. */

const NFA = (() => {
  const CONTACT = "register@nfa.ch";
  // Work in progress: set to false at launch. Shows a label on the hero plus each project page.
  const WIP = true;
  const WIP_TEXT = "Entries are being built up. Items marked pending are not available yet.";
  const REPO = "https://github.com/naturefinanceaccelerator/nfa-register";

  const CANTONS = {
    AG: "Aargau", AI: "Appenzell Innerrhoden", AR: "Appenzell Ausserrhoden", BE: "Bern", BL: "Basel-Landschaft",
    BS: "Basel-Stadt", FR: "Fribourg", GE: "Geneva", GL: "Glarus", GR: "Graubünden", JU: "Jura", LU: "Lucerne",
    NE: "Neuchâtel", NW: "Nidwalden", OW: "Obwalden", SG: "St. Gallen", SH: "Schaffhausen", SO: "Solothurn",
    SZ: "Schwyz", TG: "Thurgau", TI: "Ticino", UR: "Uri", VD: "Vaud", VS: "Valais", ZG: "Zug", ZH: "Zurich"
  };
  const STAGES = { scoping: "Scoping", design: "Design", baseline: "Baseline", monitoring: "Monitoring", verified: "Verified", closed: "Closed" };
  const STATUS = { planned: "Planned", pending: "Pending", "in-progress": "In progress", available: "Available", draft: "Draft", signed: "Signed", ended: "Ended", done: "Done", ongoing: "Ongoing" };
  const DISCLOSURE = { public: "Public", "on-request": "On request", "not-disclosed": "Not disclosed" };
  const LICENCES = {
    "CC-BY-4.0": ["CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/"],
    "CC0-1.0": ["CC0 1.0", "https://creativecommons.org/publicdomain/zero/1.0/"],
    "CC-BY-SA-4.0": ["CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/"]
  };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  async function getJSON(url) {
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    return r.json();
  }

  function chip(status, text) {
    return `<span class="chip ${esc(status)}">${esc(text || STATUS[status] || status)}</span>`;
  }

  function licence(id) {
    if (!id) return "";
    const l = LICENCES[id];
    return l ? `<a href="${l[1]}" target="_blank" rel="noopener">${l[0]}</a>` : esc(id);
  }

  function mailto(project, title) {
    const subject = encodeURIComponent(`Register request: ${project.id} – ${title}`);
    return `mailto:${project.contact || CONTACT}?subject=${subject}`;
  }

  /** Access cell for datasets, agreements, documents. */
  function access(item, project) {
    const d = item.disclosure;
    const label = DISCLOSURE[d] || d;
    let detail = "";
    if (d === "public") {
      if (item.doi) detail = `<a href="https://doi.org/${esc(item.doi)}" target="_blank" rel="noopener">doi:${esc(item.doi)}</a>`;
      else if (item.url) detail = `<a href="${esc(item.url)}" target="_blank" rel="noopener">Open ↗</a>`;
      else detail = `<small>Link follows on publication</small>`;
    } else if (d === "on-request") {
      detail = `<a href="${mailto(project, item.title)}">${esc(project.contact || CONTACT)}</a>`;
      if (item.reason) detail += `<small>${esc(item.reason)}</small>`;
    } else {
      detail = `<small>${esc(item.reason || "Reason to be stated")}</small>`;
    }
    return `<div class="access ${esc(d)}"><span class="k">${esc(label)}</span>${detail}</div>`;
  }

  function opennessBar(counts) {
    const total = (counts.public || 0) + (counts["on-request"] || 0) + (counts["not-disclosed"] || 0);
    if (!total) return "";
    const w = (n) => ((n / total) * 100).toFixed(1) + "%";
    return `<span class="openness" title="Datasets, agreements, documents by disclosure level">
      <span class="bar"><i class="pub" style="width:${w(counts.public)}"></i><i class="req" style="width:${w(counts["on-request"])}"></i><i class="nd" style="width:${w(counts["not-disclosed"])}"></i></span>
      ${counts.public} public · ${counts["on-request"]} on request · ${counts["not-disclosed"]} not disclosed</span>`;
  }

  function area(p) {
    const a = p.areaHa ?? p.location?.areaHa;
    if (a == null) return "–";
    const approx = (p.areaPrecision ?? p.location?.areaPrecision) === "approximate" ? "~" : "";
    return `${approx}${a.toLocaleString("en-GB")} ha`;
  }

  function places(cantons, municipality) {
    const c = (cantons || []).map((x) => CANTONS[x] || x).join(", ");
    return [municipality, c].filter(Boolean).join(", ");
  }

  function fmtDate(s) {
    if (!s) return "";
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return s;
    return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  /* --- map: swisstopo tiles (Swiss open government data), Leaflet vendored */
  const TILES = {
    grey: "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-grau/default/current/3857/{z}/{x}/{y}.jpeg",
    colour: "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg",
    image: "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg"
  };

  // swisstopo tiles exist only inside this extent; outside it no tiles are requested (no empty boxes)
  const EXTENT = [[45.398181, 5.140242], [48.230651, 11.47757]];
  const SWITZERLAND = [[45.82, 5.96], [47.81, 10.49]];

  /** A colour from the tokens in register.css, so colours live in one place. */
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  function makeMap(el, opts = {}) {
    const map = L.map(el, { scrollWheelZoom: false, zoomControl: true, attributionControl: true, minZoom: 7, maxZoom: 19, zoomSnap: opts.zoomSnap || 1 });
    const attr = '© <a href="https://www.swisstopo.admin.ch" target="_blank" rel="noopener">swisstopo</a>';
    const extent = L.latLngBounds(EXTENT);
    const grey = L.tileLayer(TILES.grey, { attribution: attr, maxZoom: 19, maxNativeZoom: 18, bounds: extent });
    // aerial: sharper tiles on high-resolution screens
    const image = L.tileLayer(TILES.image, { attribution: attr, maxZoom: 19, maxNativeZoom: 18, detectRetina: true, bounds: extent });
    (opts.imagery ? image : grey).addTo(map);
    const container = map.getContainer();
    container.classList.toggle("aerial", !!opts.imagery);
    map.on("baselayerchange", (e) => container.classList.toggle("aerial", e.layer === image));
    L.control.layers({ "Map": grey, "Aerial": image }, null, { position: "topright" }).addTo(map);
    map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
    map.setMaxBounds(extent);
    map.on("focus", () => map.scrollWheelZoom.enable());
    map.on("blur", () => map.scrollWheelZoom.disable());
    return map;
  }

  /** Show all of Switzerland. If the box is taller than the map tiles, shorten it (no empty band below). */
  function fitSwitzerland(map) {
    const el = map.getContainer();
    const fit = () => {
      el.style.height = "";
      map.invalidateSize();
      map.fitBounds(SWITZERLAND);
      const z = map.getZoom(), b = L.latLngBounds(EXTENT);
      const tilesHigh = map.project(b.getSouthWest(), z).y - map.project(b.getNorthEast(), z).y;
      if (el.clientHeight > tilesHigh) {
        el.style.height = Math.floor(tilesHigh) + "px";
        map.invalidateSize();
        map.fitBounds(SWITZERLAND);
      }
    };
    fit();
    let t;
    window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(fit, 200); });
  }

  const pin = () => L.divIcon({ className: "", html: '<div class="nfa-pin"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });

  /* --- shared footer */
  function footer() {
    const el = document.getElementById("footer");
    if (!el) return;
    el.innerHTML = `
      <div class="wrap">
        <div class="top">
          <div>
            <h2>Questions about a record?</h2>
            <p>Requests for data or agreements marked “on request”, corrections, new projects: write to the register team.</p>
            <a class="btn" href="mailto:${CONTACT}">${CONTACT}</a>
          </div>
          <div class="links">
            <a href="index.html#projects">Projects</a>
            <a href="about.html">How the register works</a>
            <a href="about.html#openness">Disclosure rules</a>
            <a href="about.html#add">Add a project</a>
            <a href="data/catalog.rdf">DCAT-AP CH catalogue</a>
            <a href="schema/nfa-project-0.1.schema.json">Project file schema</a>
            <a href="${REPO}" target="_blank" rel="noopener">Source on GitHub</a>
            <a href="https://nfa.ch" target="_blank" rel="noopener">nfa.ch</a>
          </div>
        </div>
        <div class="bottom">
          <span>Nature Finance Accelerator · NFA Project Register</span>
          <span>Content CC BY 4.0 · Code Apache 2.0 · Map data © swisstopo</span>
        </div>
      </div>
      <img class="strip" src="assets/img/footer.jpg" alt="Mountain stream in Val Müstair" loading="lazy">`;
  }

  document.addEventListener("DOMContentLoaded", footer);

  return { CONTACT, REPO, WIP, WIP_TEXT, CANTONS, places, STAGES, STATUS, DISCLOSURE, esc, getJSON, chip, licence, access, mailto, opennessBar, area, fmtDate, makeMap, fitSwitzerland, cssVar, pin };
})();
