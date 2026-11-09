/* Project page: renders data/projects/<slug>.json */
(async () => {
  const { esc, getJSON, chip, access, licence, area, fmtDate, STAGES, STATUS, CANTONS, makeMap, pin, CONTACT } = NFA;
  const main = document.getElementById("main");
  const slug = new URLSearchParams(location.search).get("id");
  let p;
  try {
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) throw new Error("no id");
    p = await getJSON(`data/projects/${slug}.json`);
  } catch (e) {
    main.innerHTML = `<div class="wrap p-head"><div class="crumb"><a href="index.html">Register</a></div><h1>Record not found</h1><p class="tag">No project with this identifier is in the register. <a href="index.html">Back to all projects</a>.</p></div>`;
    return;
  }
  document.title = `${p.name} (${p.id}) – NFA Project Register`;

  const orgs = Object.fromEntries(p.organisations.map((o) => [o.id, o]));
  const names = (ids, note) => (ids && ids.length ? ids.map((i) => esc(orgs[i]?.name || i)).join(", ") : `<span class="muted">${esc(note || "To be appointed")}</span>`);
  const loc = p.location;
  const hero = (p.images || [])[0];
  const docs = p.documents || [];
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const pageUrl = `https://register.nfa.ch/project.html?id=${p.slug}`;
  const year = (p.dates.registered || "").slice(0, 4);
  const citation = `Nature Finance Accelerator (${year}). ${p.name} (${p.id}). NFA Project Register. ${pageUrl} (accessed ${today}).`;

  /* ---------- header */
  const head = `
  <div class="wrap p-head">
    <div class="crumb"><a href="index.html">Register</a><span>/</span><span class="mono">${esc(p.id)}</span></div>
    <h1>${esc(p.name)}</h1>
    ${p.tagline ? `<p class="tag">${esc(p.tagline)}</p>` : ""}
    <div class="chips">${chip("stage", STAGES[p.stage] || p.stage)}${NFA.WIP ? `<span class="chip pending" title="${esc(NFA.WIP_TEXT)}">Work in progress</span>` : ""}${p.stageNote ? `<span class="muted" style="font-size:13px">${esc(p.stageNote)}</span>` : ""}</div>
    <dl class="facts">
      <div><dt>${(loc.cantons || []).length > 1 ? "Cantons" : "Canton"}</dt><dd>${esc((loc.cantons || []).map((c) => CANTONS[c] || c).join(", ") || "–")}<small>${esc(loc.municipality || "")}</small></dd></div>
      <div><dt>Area</dt><dd>${esc(area(p))}<small>${loc.areaPrecision === "approximate" ? "approximate" : "from boundary"}</small></dd></div>
      <div><dt>Ecosystem</dt><dd>${esc((p.ecosystem || []).slice(0, 2).join(", ") || "–")}<small>${esc((p.ecosystem || []).slice(2).join(", "))}</small></dd></div>
      <div><dt>Baseline (t0)</dt><dd>${esc(p.dates.baselineT0 ? fmtDate(p.dates.baselineT0) : "Pending")}<small>${esc(p.dates.baselineT0Note || "")}</small></dd></div>
      <div><dt>Registered</dt><dd>${esc(fmtDate(p.dates.registered))}</dd></div>
      <div><dt>Last updated</dt><dd>${esc(fmtDate(p.dates.lastUpdated))}</dd></div>
    </dl>
    <div class="visual">
      ${hero ? `<figure><img src="${esc(hero.src)}" alt="${esc(hero.alt)}"><figcaption>${esc(hero.credit ? "Photo: " + hero.credit : "")}</figcaption></figure>` : `<figure><div class="ph" style="height:420px;border-radius:8px;background:var(--sage-tint)"></div></figure>`}
      <div class="map-box"><div class="map" id="pmap" role="region" aria-label="Project location"></div>
        <figcaption style="font-size:12px;color:var(--grey-500);margin-top:8px">${esc(loc.boundary ? "Project boundary (" + (loc.boundaryStatus || "") + ")" : (loc.boundaryNote || "Boundary pending"))}</figcaption></div>
    </div>
  </div>`;

  /* ---------- tabs */
  const sections = [
    ["overview", "Overview"],
    ["measurements", "Measurements", p.measurements.length],
    ["data", "Data", p.datasets.length],
    ["agreements", "Agreements", p.agreements.length],
    ["documents", "Documents", docs.length],
    ["organisations", "Organisations", p.organisations.length],
    ["timeline", "Timeline"]
  ];
  const tabs = `<div class="tabs"><div class="wrap">${sections.map(([id, t, n]) => `<a href="#${id}">${t}${n != null ? `<sup>${n}</sup>` : ""}</a>`).join("")}</div></div>`;

  /* ---------- overview */
  const m = p.method || {};
  const overview = `
  <section class="block" id="overview">
    <div class="label">Overview</div>
    <h2>About the project</h2>
    <p class="lead">${esc(p.summary)}</p>
    ${(p.description || []).map((d) => `<p>${esc(d)}</p>`).join("")}
    <dl class="kv">
      ${m.name ? `<dt>Method</dt><dd>${esc(m.name)}${m.version ? `, ${esc(m.version)}` : ""}</dd>` : ""}
      ${m.basis ? `<dt>Basis</dt><dd>${esc(m.basis)}</dd>` : ""}
      ${m.design ? `<dt>Design</dt><dd>${esc(m.design)}</dd>` : ""}
      ${m.review ? `<dt>Review</dt><dd>${esc(m.review)}</dd>` : ""}
      ${p.landUse ? `<dt>Land use</dt><dd>${esc(p.landUse)}</dd>` : ""}
      <dt>Location</dt><dd>${esc(NFA.places(loc.cantons, loc.municipality))} · ${loc.point[1].toFixed(3)}° N, ${loc.point[0].toFixed(3)}° E <span class="muted">(${esc(loc.pointPrecision || "")} level)</span></dd>
    </dl>
  </section>`;

  /* ---------- measurements */
  const groups = [["core", "Core metrics"], ["context", "Context data"], ["design", "Study design"]];
  const mRows = groups.map(([g, label]) => {
    const list = p.measurements.filter((x) => x.group === g);
    if (!list.length) return "";
    return `<tr class="group-row"><td colspan="5">${label}</td></tr>` + list.map((x) => `
      <tr id="${esc(x.id)}">
        <td data-h="Metric"><b>${esc(x.metric)}${x.structural ? `<span class="structural">structural</span>` : ""}</b>
          ${(x.datasets || []).length ? `<span class="sub">Data: ${x.datasets.map((d) => `<a href="#${esc(d)}">${esc((p.datasets.find((y) => y.id === d) || {}).title || d)}</a>`).join(", ")}</span>` : ""}</td>
        <td data-h="Method">${esc(x.method || "")}</td>
        <td data-h="Provider">${names(x.provider, x.providerNote)}</td>
        <td data-h="Frequency">${esc(x.frequency || "")}</td>
        <td data-h="Status">${chip(x.status)}${x.statusNote ? `<span class="sub">${esc(x.statusNote)}</span>` : ""}</td>
      </tr>`).join("");
  }).join("");
  const measurements = `
  <section class="block" id="measurements">
    <div class="label">Measurements</div>
    <h2>What is measured</h2>
    <table class="reg"><thead><tr><th>Metric</th><th>Method</th><th>Provider</th><th>Frequency</th><th>Status</th></tr></thead><tbody>${mRows}</tbody></table>
  </section>`;

  /* ---------- data */
  const dRows = p.datasets.map((d) => `
    <tr id="${esc(d.id)}">
      <td data-h="Dataset"><b>${esc(d.title)}</b>${d.note ? `<span class="sub">${esc(d.note)}</span>` : ""}${d.creators && d.creators.length ? `<span class="sub">Creators: ${d.creators.map(esc).join(", ")}</span>` : ""}</td>
      <td data-h="Provider">${names(d.provider)}</td>
      <td data-h="Repository">${d.repository ? (d.repositoryUrl ? `<a href="${esc(d.repositoryUrl)}" target="_blank" rel="noopener">${esc(d.repository)}</a>` : esc(d.repository)) : `<span class="muted">–</span>`}
        <span class="sub">${esc([d.format, d.crs].filter(Boolean).join(" · "))}</span></td>
      <td data-h="Licence">${d.licence ? licence(d.licence) : `<span class="muted">–</span>`}</td>
      <td data-h="Status">${chip(d.status)}</td>
      <td data-h="Access">${access(d, p)}</td>
    </tr>`).join("");
  const layers = (p.referenceLayers || []).map((r) => `
    <tr><td data-h="Layer"><b>${esc(r.title)}</b></td><td data-h="Holder">${esc(r.holder)}</td><td data-h="Licence">${esc(r.licence || "")}</td><td data-h="Link"><a href="${esc(r.url)}" target="_blank" rel="noopener">Source ↗</a></td></tr>`).join("");
  const data = `
  <section class="block" id="data">
    <div class="label">Data</div>
    <h2>Datasets</h2>
    <table class="reg"><thead><tr><th>Dataset</th><th>Provider</th><th>Repository</th><th>Licence</th><th>Status</th><th>Access</th></tr></thead><tbody>${dRows}</tbody></table>
    ${layers ? `<h3>Third-party reference layers</h3><table class="reg"><thead><tr><th>Layer</th><th>Holder</th><th>Licence</th><th>Link</th></tr></thead><tbody>${layers}</tbody></table>` : ""}
  </section>`;

  /* ---------- agreements */
  const term = (k, v) => `<div><span>${k}</span>${v}</div>`;
  const aRows = p.agreements.map((a) => {
    const t = [];
    if (a.dataLicence) t.push(term("Data licence", licence(a.dataLicence)));
    if (a.claimRights) t.push(term("Claim rights", esc(a.claimRights)));
    if (a.signed) t.push(term("Signed", esc(fmtDate(a.signed))));
    if (a.term) t.push(term("Term", esc(a.term)));
    t.push(term("Fees", a.fees && a.fees !== "not-disclosed" ? esc(a.fees) : "Not disclosed"));
    return `
    <tr id="${esc(a.id)}" class="has-terms">
      <td data-h="Agreement"><b>${esc(a.title)}</b><span class="sub">${esc(a.type || "")}</span></td>
      <td data-h="Parties">${names(a.parties)}</td>
      <td data-h="Status">${chip(a.status)}</td>
      <td data-h="Access">${access(a, p)}</td>
    </tr>
    <tr class="terms-row"><td colspan="4" data-h="Key terms"><div class="terms">${t.join("")}</div></td></tr>`;
  }).join("");
  const agreements = `
  <section class="block" id="agreements">
    <div class="label">Agreements</div>
    <h2>Data contracts plus agreements</h2>
    <p>Key terms are published for every agreement. Signed documents go out on request. Fees are never published.</p>
    <table class="reg"><thead><tr><th>Agreement</th><th>Parties</th><th>Status</th><th>Access</th></tr></thead><tbody>${aRows}</tbody></table>
  </section>`;

  /* ---------- documents */
  const docRows = docs.map((d) => `
    <tr><td data-h="Document"><b>${esc(d.title)}</b>${d.author ? `<span class="sub">${esc(orgs[d.author]?.name || d.author)}</span>` : ""}</td>
      <td data-h="Type">${esc([d.type, d.version, d.date].filter(Boolean).join(" · "))}</td>
      <td data-h="Status">${d.status ? chip(d.status) : (d.url ? chip("available") : "")}</td>
      <td data-h="Access">${access(d, p)}</td></tr>`).join("");
  const documents = `
  <section class="block" id="documents">
    <div class="label">Documents</div>
    <h2>Documents</h2>
    ${docs.length ? `<table class="reg"><thead><tr><th>Document</th><th>Type</th><th>Status</th><th>Access</th></tr></thead><tbody>${docRows}</tbody></table>` : `<p class="muted">No documents listed yet.</p>`}
  </section>`;

  /* ---------- organisations */
  const organisations = `
  <section class="block" id="organisations">
    <div class="label">Organisations</div>
    <h2>Who is involved</h2>
    <div class="orgs">${p.organisations.map((o) => `
      <div class="org${o.logo ? " has-logo" : ""}">
        ${o.logo ? `<img class="logo" src="${esc(o.logo)}" alt="${esc(o.name)} logo">` : ""}
        <b>${esc(o.name)}</b>
        <span>${esc(o.role)}</span>
        ${o.type ? `<span class="muted">${esc(o.type)}</span>` : ""}
        ${o.url ? `<a href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""))} ↗</a>` : ""}
        ${o.note ? `<span class="note muted">${esc(o.note)}</span>` : ""}
      </div>`).join("")}</div>
  </section>`;

  /* ---------- timeline */
  const timeline = `
  <section class="block" id="timeline">
    <div class="label">Timeline</div>
    <h2>Milestones</h2>
    <ol class="timeline">${(p.timeline || []).map((t) => `<li class="${esc(t.status)}"><div class="d">${esc(t.date)}${t.status === "ongoing" ? " · ongoing" : ""}</div><div class="e">${esc(t.event)}</div></li>`).join("")}</ol>
    ${(p.changelog || []).length ? `<h3>Changes to this record</h3><ul style="padding-left:18px;margin:0;color:var(--grey-700);font-size:14px">${p.changelog.map((c) => `<li><span class="mono">${esc(c.date)}</span> ${esc(c.change)}</li>`).join("")}</ul>` : ""}
  </section>`;

  /* ---------- sidebar */
  const src = p._source || {};
  const people = (p.people || []).filter((x) => x.consent);
  const side = `
  <aside class="side">
    <section>
      <h4>Record</h4>
      <ul>
        <li><span class="mono">${esc(p.id)}</span></li>
        <li>Schema v${esc(p.schemaVersion)}</li>
        ${src.collected ? `<li class="muted">Collected ${esc(src.collected.replace("T", " "))}</li>` : ""}
      </ul>
      <a class="btn dark" href="data/projects/${esc(p.slug)}.json" download>Project file (JSON)</a><br>
      ${src.repo ? `<a class="btn" href="${esc(src.repo)}" target="_blank" rel="noopener">Project repository ↗</a>` : ""}
    </section>
    <section>
      <h4>Cite this record</h4>
      <div class="cite" id="cite">${esc(citation)}</div>
      <button class="btn" type="button" id="copyCite">Copy citation</button>
    </section>
    ${people.length ? `<section><h4>People</h4><ul class="people-line">${people.map((x) => `<li>${esc(x.name)}${x.organisation && orgs[x.organisation] ? `, ${esc(orgs[x.organisation].name)}` : ""}${x.orcid ? ` · <a href="https://orcid.org/${esc(x.orcid)}" target="_blank" rel="noopener">ORCID</a>` : ""}</li>`).join("")}</ul></section>` : ""}
    <section>
      <h4>Contact</h4>
      <a href="mailto:${esc(p.contact || CONTACT)}?subject=${encodeURIComponent(p.id)}">${esc(p.contact || CONTACT)}</a>
    </section>
    ${(p.links || []).length ? `<section><h4>Links</h4><ul>${p.links.map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a></li>`).join("")}</ul></section>` : ""}
    <section><h4>Licence</h4><span>Record ${licence(p.licence || "CC-BY-4.0")}</span></section>
  </aside>`;

  main.innerHTML = head + tabs + `<div class="wrap p-body"><div>${overview}${measurements}${data}${agreements}${documents}${organisations}${timeline}</div>${side}</div>`;

  /* ---------- map */
  const map = makeMap("pmap", { imagery: true });
  const ll = [loc.point[1], loc.point[0]];
  if (loc.boundary) {
    try {
      const gj = await getJSON(loc.boundary);
      const layer = L.geoJSON(gj, { style: { color: "#d4f36b", weight: 3, fillColor: "#d4f36b", fillOpacity: 0.15 } }).addTo(map);
      map.fitBounds(layer.getBounds(), { padding: [24, 24] });
    } catch { map.setView(ll, 14); }
  } else {
    L.marker(ll, { icon: pin(), title: p.name }).addTo(map);
    map.setView(ll, loc.pointPrecision === "municipality" ? 13 : 15);
  }

  /* ---------- copy citation, active tab, target row */
  document.getElementById("copyCite").addEventListener("click", async (e) => {
    try { await navigator.clipboard.writeText(citation); e.target.textContent = "Copied"; } catch { e.target.textContent = "Select the text above"; }
  });
  const links = [...document.querySelectorAll(".tabs a")];
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) links.forEach((a) => a.classList.toggle("on", a.getAttribute("href") === `#${en.target.id}`)); });
  }, { rootMargin: "-160px 0px -60% 0px" });
  document.querySelectorAll(".block").forEach((b) => obs.observe(b));
  if (location.hash) {
    const t = document.getElementById(location.hash.slice(1));
    if (t) { if (t.tagName === "TR") t.classList.add("target"); t.scrollIntoView(); }
  }
})();
