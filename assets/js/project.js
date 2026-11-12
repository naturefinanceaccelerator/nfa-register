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


  /* ---------- live monitoring: key figures, charts plus sounds right below the photo plus map.
     Sources marked "example" show placeholder figures with an Example data tag until the partner delivers. */
  const mon = p.monitoring;
  const RED = { CR: "Critically endangered", EN: "Endangered", VU: "Vulnerable", NT: "Near threatened", LC: "Least concern" };
  const nf = (n, dec = 0) => Number(n).toLocaleString("en-GB", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const short = (s) => fmtDate((s || "").slice(0, 10)).replace(/ \d{4}$/, "");
  const srcOf = (id) => (mon && (mon.sources || []).find((x) => x.id === id)) || null;
  const isEx = (id) => srcOf(id)?.status === "example";
  const exTag = (id, cls = "") => (isEx(id) ? `<span class="ex ${cls}" title="${esc(mon.exampleNote || "Example data")}">Example data</span>` : "");
  const srcLine = (id) => { const x = srcOf(id); return x ? `${esc(orgs[x.provider]?.name || x.provider)}${x.period ? " · " + esc(x.period) : ""}` : ""; };

  function barsChart(c) {
    const n = c.values.length, few = n <= 8, dec = c.decimals || 0;
    const W = 480, H = few ? 230 : 270, top = few ? 24 : 18, bottom = 26, left = 4;
    const max = Math.max(...c.values), peak = c.values.indexOf(max);
    const step = (W - left) / n, bw = step * (few ? 0.52 : 0.68), h = H - top - bottom;
    const bars = c.values.map((v, i) => {
      const bh = Math.max(1.5, (v / max) * h), x = left + i * step + (step - bw) / 2, y = top + h - bh;
      return `<rect class="b${i === peak ? " peak" : ""}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="2" style="--i:${i}"><title>${esc(c.labels[i])} · ${nf(v, dec)} ${esc(c.unit || "")}</title></rect>` +
        (few ? `<text class="val" x="${(x + bw / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle">${nf(v, dec)}${c.unit === "%" ? " %" : ""}</text>` : "");
    }).join("");
    const ticks = c.labels.map((l, i) => (few || i % 3 === 0 ? `<text x="${(left + i * step + step / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(l)}</text>` : "")).join("");
    const px = left + peak * step + step / 2;
    return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.title || "")}">
      <line class="base" x1="0" x2="${W}" y1="${top + h + 0.5}" y2="${top + h + 0.5}"/>${bars}${ticks}
      ${few ? "" : `<text class="peak-label" x="${Math.min(px, W - 60).toFixed(1)}" y="${top - 4}" text-anchor="middle">${nf(max)}</text>`}</svg>`;
  }

  function hbarsChart(c) {
    const max = Math.max(...c.values);
    return `<ol class="hbars">${c.labels.map((l, i) => `
      <li style="--w:${((c.values[i] / max) * 100).toFixed(1)}%;--i:${i}"><span class="n">${esc(l)}</span><span class="t"><i></i></span><span class="v">${nf(c.values[i], c.decimals || 0)}</span></li>`).join("")}</ol>`;
  }

  function splitChart(c, dark) {
    const total = c.values.reduce((a, b) => a + b, 0);
    return `<div class="split${dark ? "" : " light"}"><div class="split-bar">${c.values.map((v, i) => `<i class="s${i}" style="flex:${v}" title="${esc(c.labels[i])}: ${v}"></i>`).join("")}</div>
      <div class="split-legend">${c.values.map((v, i) => `<span><i class="s${i}"></i><b>${v}</b> ${esc(c.labels[i].toLowerCase())}</span>`).join("")}<span class="muted">${total} ${esc(c.unit || "")}${c.note ? ", " + esc(c.note.toLowerCase()) : ""}</span></div></div>`;
  }

  const chartBox = (c, body) => `
    <figure class="live-card${isEx(c.source) ? " is-ex" : ""}">
      <figcaption><b>${esc(c.title || "")}${exTag(c.source)}</b>${c.subtitle ? `<span>${esc(c.subtitle)}</span>` : ""}<span class="src">${srcLine(c.source)}</span></figcaption>
      ${body}
      ${c.note && c.type !== "split" ? `<small class="muted">${esc(c.note)}</small>` : ""}
    </figure>`;

  function soundRow(x, compact) {
    return `<button type="button" class="play" data-src="${esc(x.src || "")}" ${x.src ? "" : "disabled"} aria-label="${x.src ? "Play" : "No clip yet for"} ${esc(x.species)}" title="${x.src ? "Play the recording" : "Clip follows"}"><svg viewBox="0 0 16 16" aria-hidden="true"><path class="i-play" d="M5 3.5v9l7.5-4.5z"/><path class="i-pause" d="M4.5 3.5h2.6v9H4.5zM8.9 3.5h2.6v9H8.9z"/></svg></button>`;
  }

  function liveBlock(m) {
    const charts = m.charts || [];
    const band = charts.find((c) => c.type === "split" && !isEx(c.source));
    const cards = charts.filter((c) => c !== band);
    const sounds = (m.sounds || []).slice().sort((a, b) => (b.lastHeard || "").localeCompare(a.lastHeard || ""));
    const soundCard = sounds.length ? `
        <figure class="live-card sounds">
          <figcaption><b>Heard at ${esc(loc.municipality || p.name)}</b><span>Red List birds, last heard first</span><span class="src">${srcLine("acoustics")}</span></figcaption>
          <ul class="sound-list">${sounds.map((x) => `
            <li>
              ${soundRow(x)}
              <span class="sp"><b>${esc(x.species)}</b><i>${esc(x.latin || "")}</i></span>
              ${x.redList ? `<span class="rl rl-${esc(x.redList)}" title="${esc(RED[x.redList] || x.redList)}">${esc(x.redList)}</span>` : ""}
              <span class="when">${x.lastHeard ? esc(short(x.lastHeard)) : ""}<small>${x.detections != null ? `${nf(x.detections)} calls` : ""}</small></span>
            </li>`).join("")}</ul>
          ${sounds.some((x) => !x.src) ? `<small class="muted">Grey buttons: recording follows.</small>` : ""}
        </figure>` : "";
    const order = [];
    cards.forEach((c, i) => { order.push(chartBox(c, c.type === "bars" ? barsChart(c) : c.type === "hbars" ? hbarsChart(c) : splitChart(c, false))); if (i === 1 && soundCard) order.push(soundCard); });
    if (cards.length < 2 && soundCard) order.push(soundCard);
    return `
  <section class="live" id="live" aria-label="${esc(m.title || "Live from the site")}">
    <div class="wrap">
      <div class="live-band">
        <div class="live-top">
          <div class="label light"><span class="pulse" aria-hidden="true"></span>${esc(m.title || "Live from the site")}</div>
          <div class="streams">${(m.sources || []).map((x) => `<span class="stream ${esc(x.status)}"><i></i>${esc(x.label || x.id)} · ${esc(orgs[x.provider]?.name || x.provider)}${x.status === "example" ? " · example" : ""}</span>`).join("")}</div>
        </div>
        <div class="kpis">${(m.kpis || []).map((k) => `
          <div class="kpi${isEx(k.source) ? " is-ex" : ""}"><b data-count="${esc(k.value)}">${esc(k.value)}</b><span>${esc(k.label)}</span>${k.note ? `<small>${esc(k.note)}</small>` : ""}${exTag(k.source, "on-dark")}</div>`).join("")}</div>
        ${band ? `<div class="live-split"><span class="split-title">${esc(band.title || "")}</span>${splitChart(band, true)}</div>` : ""}
      </div>
      <div class="live-grid">${order.join("")}</div>
      <p class="live-note">${(m.sources || []).some((x) => x.status === "example") ? `<span class="ex">Example data</span> ${esc(m.exampleNote || "")} ` : ""}${esc(m.method || "")}${m.method ? ". " : ""}${esc(m.note || "")}${m.retrieved ? ` Sound figures retrieved ${esc(fmtDate(m.retrieved))}.` : ""}${m.dashboardUrl ? ` <a href="${esc(m.dashboardUrl)}" target="_blank" rel="noopener">Synature dashboard ↗</a> <span class="muted">(login)</span>` : ""}</p>
    </div>
  </section>`;
  }
  const live = mon ? liveBlock(mon) : "";

  /* ---------- tabs */
  const images = p.images || [];
  const sections = [
    ["overview", "Overview"],
    ...(images.length > 1 ? [["images", "Images", images.length]] : []),
    ["measurements", "Measurements", p.measurements.length],
    ["data", "Data", p.datasets.length],
    ["agreements", "Agreements, documents", p.agreements.length + docs.length],
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
  const sampleList = ((p.monitoring || {}).sounds || []).filter((x) => x.dataset);
  const samples = sampleList.length ? `
    <h3 id="samples">Samples</h3>
    <p>Short clips from the recordings, one per Red List bird, each a detection checked by a Synature expert.</p>
    <table class="reg samples"><thead><tr><th></th><th>Sample</th><th>Recorded</th><th>Recorder</th><th>From dataset</th></tr></thead><tbody>${sampleList.map((x) => `
      <tr><td data-h="">${soundRow(x)}</td>
        <td data-h="Sample"><b>${esc(x.species)}</b><span class="sub"><i>${esc(x.latin || "")}</i>${x.redList ? ` · Red List ${esc(x.redList)}` : ""}</span></td>
        <td data-h="Recorded">${x.clipRecorded ? esc(fmtDate(x.clipRecorded.slice(0, 10))) + `<span class="sub">${esc(x.clipRecorded.slice(11, 16))}</span>` : "–"}</td>
        <td data-h="Recorder">${esc(x.clipRecorder || "–")}</td>
        <td data-h="From dataset"><a href="#${esc(x.dataset)}">${esc((p.datasets.find((d) => d.id === x.dataset) || {}).title || x.dataset)}</a>${x.src ? "" : `<span class="sub">Clip follows</span>`}</td></tr>`).join("")}</tbody></table>` : "";
  const data = `
  <section class="block" id="data">
    <div class="label">Data</div>
    <h2>Datasets</h2>
    <table class="reg"><thead><tr><th>Dataset</th><th>Provider</th><th>Repository</th><th>Licence</th><th>Status</th><th>Access</th></tr></thead><tbody>${dRows}</tbody></table>
    ${samples}
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
  const docRows = docs.map((d) => `
    <tr><td data-h="Document"><b>${esc(d.title)}</b>${d.author ? `<span class="sub">${esc(orgs[d.author]?.name || d.author)}</span>` : ""}</td>
      <td data-h="Type">${esc([d.type, d.version, d.date].filter(Boolean).join(" · "))}</td>
      <td data-h="Status">${d.status ? chip(d.status) : (d.url ? chip("available") : "")}</td>
      <td data-h="Access">${access(d, p)}</td></tr>`).join("");
  const agreements = `
  <section class="block" id="agreements">
    <div class="label">Agreements, documents</div>
    <h2>Contracts plus documents</h2>
    <p>Key terms are published for every agreement. Signed documents go out on request. Fees are never published.</p>
    <table class="reg"><thead><tr><th>Agreement</th><th>Parties</th><th>Status</th><th>Access</th></tr></thead><tbody>${aRows}</tbody></table>
    ${docs.length ? `<h3 id="documents">Documents</h3><table class="reg"><thead><tr><th>Document</th><th>Type</th><th>Status</th><th>Access</th></tr></thead><tbody>${docRows}</tbody></table>` : ""}
  </section>`;

  /* ---------- images (shown once a project has more than the header photo) */
  const gallery = images.length > 1 ? `
  <section class="photos" id="images">
    <div class="wrap">
    <div class="photos-head"><h2>From the site</h2><span class="muted">${esc([images[1].date ? fmtDate(images[1].date) : "", images[1].credit ? "Photos: " + images[1].credit : ""].filter(Boolean).join(" · "))}</span></div>
    <div class="photo-strip">${images.slice(1).map((i) => `
      <figure>
        <a href="${esc(i.src)}" target="_blank" rel="noopener"><img src="${esc(i.src)}" alt="${esc(i.alt)}" loading="lazy"></a>
        <figcaption>${esc(i.caption || "")}</figcaption>
      </figure>`).join("")}</div>
    </div>
  </section>` : "";

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
  const SHOW_PEOPLE = false;   // people list in the sidebar: off until names are confirmed for publication
  const people = SHOW_PEOPLE ? (p.people || []).filter((x) => x.consent) : [];
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

  main.innerHTML = head + live + gallery + tabs + `<div class="wrap p-body"><div>${overview}${measurements}${data}${agreements}${organisations}${timeline}</div>${side}</div>`;

  /* ---------- map */
  const map = makeMap("pmap", { imagery: true });
  const ll = [loc.point[1], loc.point[0]];
  if (loc.boundary) {
    try {
      const gj = await getJSON(loc.boundary);
      const line = NFA.cssVar("--map-mark");
      const layer = L.geoJSON(gj, { style: { color: line, weight: 3, fillColor: line, fillOpacity: 0.15 } }).addTo(map);
      map.fitBounds(layer.getBounds(), { padding: [24, 24] });
    } catch { map.setView(ll, 14); }
  } else {
    L.marker(ll, { icon: pin(), title: p.name }).addTo(map);
    map.setView(ll, loc.pointPrecision === "municipality" ? 14 : 16);
  }


  /* ---------- live block: grow charts when they come into view, count up the key figures, play sounds */
  const liveEl = document.getElementById("live");
  if (liveEl) {
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const countUp = (el) => {
      const txt = el.dataset.count, m = /^([\d,]+)(.*)$/.exec(txt);
      if (!m || calm) return;
      const target = +m[1].replace(/,/g, ""), rest = m[2], t0 = performance.now(), dur = 1100;
      const tick = (t) => {
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        el.textContent = Math.round(target * e).toLocaleString("en-GB") + rest;
        if (k < 1) requestAnimationFrame(tick); else el.textContent = txt;
      };
      requestAnimationFrame(tick);
    };
    const seen = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add("in");
      en.target.querySelectorAll("[data-count]").forEach(countUp);
      seen.unobserve(en.target);
    }), { threshold: 0.25 });
    liveEl.querySelectorAll(".live-band, .live-card").forEach((el) => seen.observe(el));

    const player = new Audio();
    let playing = null;
    const stop = () => { if (playing) playing.classList.remove("on"); playing = null; };
    player.addEventListener("ended", stop);
    main.addEventListener("click", (e) => {
      const b = e.target.closest("button.play");
      if (!b || b.disabled) return;
      if (playing === b) { player.pause(); stop(); return; }
      stop();
      player.src = b.dataset.src;
      player.play().then(() => { playing = b; b.classList.add("on"); }).catch(() => { b.title = "This browser cannot play the clip"; });
    });
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
