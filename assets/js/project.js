/* Project page: renders data/projects/<slug>.json
   Two views of the same record:
     Summary      for funders, project developers, policy makers: who is behind the project, the basket
                  of core metrics over time, the headline indicator, what was done on the ground, nice-to-knows.
     Full record  for scientists plus reviewers: methods, monitoring streams, datasets, agreements,
                  documents, organisations, the complete timeline. */
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

  /* ---------- small helpers */
  const nf = (n, dec = 0) => Number(n).toLocaleString("en-GB", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const num = (v) => nf(v, Number.isInteger(v) ? 0 : Math.abs(v) < 10 ? 2 : 1);
  const signed = (v, dec = 0) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${nf(Math.abs(v), dec)}`;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const when = (d) => { const m = /^(\d{4})-(\d{2})$/.exec(d || ""); return m ? `${MONTHS[+m[2] - 1]} ${m[1]}` : /^\d{4}-\d{2}-\d{2}$/.test(d || "") ? fmtDate(d) : (d || "").replace("-Q", " Q"); };
  const yearsOf = (s) => (String(s || "").match(/\d{4}/g) || []).map(Number);

  /* ---------- who is behind the project: developer, funder, funding amount */
  const developers = p.developers || [];
  const funding = p.funding || {};
  const funders = funding.funders || [];
  const orgList = (ids, note) => (ids.length ? ids.map((i) => esc(orgs[i]?.name || i)).join(", ") : `<span class="muted">${esc(note || "Name follows")}</span>`);
  function amount(a) {
    if (!a) return ["–", ""];
    if (a.disclosure === "public" && a.value != null) return [`${esc(a.currency || "CHF")} ${nf(a.value)}`, a.period || ""];
    if (a.disclosure === "on-request") return ["On request", p.contact || CONTACT];
    return ["Not disclosed", a.reason || ""];
  }
  const [amountText, amountNote] = amount(funding.amount);

  /* ---------- measurement rounds plus the basket of core metrics */
  const rounds = p.schedule || [];
  const basket = p.measurements.filter((x) => x.group === "core");
  const point = (mm, r) => (mm.series || []).find((x) => x.period === r.id) || {};
  const firstRepeat = rounds[1] ? rounds[1].years : null;

  /** Change of one metric: first round (baseline) against the latest round with a value. */
  function change(mm) {
    const v = rounds.map((r) => point(mm, r).value ?? null);
    if (v[0] == null || v[0] === 0) return null;
    let j = -1;
    v.forEach((x, i) => { if (i > 0 && x != null) j = i; });
    return j < 0 ? null : { pct: ((v[j] - v[0]) / Math.abs(v[0])) * 100, to: rounds[j], values: v, ref: rounds.map((r) => point(mm, r).reference ?? null) };
  }

  function spark(c) {
    const W = 96, H = 28, pad = 3;
    const all = [...c.values, ...c.ref].filter((x) => x != null), lo = Math.min(...all), hi = Math.max(...all), span = hi - lo || 1;
    const xy = (v, i) => `${(pad + (i * (W - 2 * pad)) / Math.max(1, rounds.length - 1)).toFixed(1)},${(H - pad - ((v - lo) / span) * (H - 2 * pad)).toFixed(1)}`;
    const line = (arr) => arr.map((v, i) => (v == null ? null : xy(v, i))).filter(Boolean).join(" ");
    const last = c.values.reduce((a, v, i) => (v != null ? i : a), 0);
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true">${c.ref.some((x) => x != null) ? `<polyline class="ref" points="${line(c.ref)}"/>` : ""}<polyline points="${line(c.values)}"/><circle cx="${xy(c.values[last], last).split(",")[0]}" cy="${xy(c.values[last], last).split(",")[1]}" r="2.6"/></svg>`;
  }

  const CELL = { planned: "Planned", "in-progress": "Under way", available: "Measured", missing: "No value" };
  const cellState = (mm, r, i) => {
    const pt = point(mm, r);
    if (pt.value != null) return "available";
    if (pt.status) return pt.status;
    if (r.status === "done") return "missing";
    if (r.status === "in-progress") return i > 0 || mm.status === "in-progress" ? "in-progress" : "planned";
    return "planned";
  };
  function boardCell(mm, r, i) {
    const pt = point(mm, r);
    if (pt.value != null) {
      return `<td class="has"><b>${num(pt.value)}</b>${mm.unit ? `<span class="u">${esc(mm.unit)}</span>` : ""}${pt.reference != null ? `<small>Reference ${num(pt.reference)}</small>` : ""}</td>`;
    }
    const st = cellState(mm, r, i);
    return `<td><span class="mark ${esc(st)}" title="${esc(CELL[st])}"></span><span class="sr">${esc(CELL[st])}</span></td>`;
  }

  /** The basket board: one row per core metric, one column per measurement round. */
  function board() {
    if (!basket.length || !rounds.length) return "";
    const changes = basket.map(change), anyChange = changes.some(Boolean), anyRef = basket.some((mm) => (mm.series || []).some((x) => x.reference != null));
    const used = new Set();
    basket.forEach((mm) => rounds.forEach((r, i) => used.add(cellState(mm, r, i))));
    return `
      <div class="board-scroll"><table class="board">
        <thead><tr><th scope="col">Basket of ${basket.length === 5 ? "five" : basket.length}</th>${rounds.map((r, i) => `<th scope="col" class="${esc(r.status)}">${esc(i === 0 ? (r.label || "Baseline") : r.years)}<small>${esc(i === 0 ? r.years : (r.label || ""))}</small></th>`).join("")}${anyChange ? `<th scope="col" class="chg">Change since baseline</th>` : ""}</tr></thead>
        <tbody>${basket.map((mm, k) => `
          <tr><th scope="row"><b>${esc(mm.plainName || mm.metric)}</b>${mm.tells ? `<span>${esc(mm.tells)}</span>` : ""}</th>
            ${rounds.map((r, i) => boardCell(mm, r, i)).join("")}
            ${anyChange ? (changes[k] ? `<td class="chg"><div class="chg-in">${spark(changes[k])}<span class="delta"><b>${changes[k].pct > 0 ? "▲" : changes[k].pct < 0 ? "▼" : "■"} ${signed(changes[k].pct, Math.abs(changes[k].pct) < 10 ? 1 : 0)} %</b><small>to ${esc(changes[k].to.years)}</small></span></div></td>` : `<td class="chg muted">–</td>`) : ""}</tr>`).join("")}
        </tbody></table></div>
      <p class="board-key">${[["available", "Measured"], ["in-progress", "Under way"], ["planned", "Planned"], ["missing", "No value"]].filter(([k]) => used.has(k) && k !== "available").map(([k, t]) => `<span><i class="mark ${k}"></i>${t}</span>`).join("")}${anyRef ? `<span><i class="key-ref"></i>Reference areas</span>` : ""}${!anyChange && firstRepeat ? `<span class="muted">First comparison against the baseline: ${esc(firstRepeat)}</span>` : ""}</p>`;
  }

  /* ---------- the headline indicator. Set in the project file by NFA; the page never computes it. */
  const OUT = { "not-yet-measurable": "Not yet measurable", improving: "Improving", stable: "Stable", declining: "Declining" };
  const out = p.outcome || { status: "not-yet-measurable" };
  const roundById = (id) => rounds.find((r) => r.id === id);
  function indicator() {
    const has = out.status !== "not-yet-measurable" && out.value != null;
    const span = has && roundById(out.from) && roundById(out.to) ? `${roundById(out.from).years} to ${roundById(out.to).years}` : "";
    return `
      <div class="ind ${esc(out.status)}">
        <div class="label light">Is biodiversity improving?</div>
        ${has ? `<div class="ind-fig"><b><i aria-hidden="true">${out.status === "improving" ? "▲" : out.status === "declining" ? "▼" : "■"}</i>${signed(out.value, Math.abs(out.value) < 10 ? 1 : 0)} ${esc(out.unit || "%")}</b></div>
        <div class="ind-status">${esc(OUT[out.status])}${span ? `<span>${esc(span)}</span>` : ""}</div>
        <span class="ind-tag">${out.verified ? "Independently reviewed" : "Not yet reviewed"}</span>` : `<div class="ind-status big">${esc(OUT[out.status] || out.status)}</div>`}
        ${out.note ? `<p>${esc(out.note)}</p>` : ""}
        ${out.method ? `<small><span>How it is read</span>${esc(out.method)}</small>` : ""}
      </div>`;
  }

  const basketBand = basket.length && rounds.length ? `
  <section class="basket only-summary" id="basket" aria-label="Basket of core metrics over time">
    <div class="wrap"><div class="basket-grid">${indicator()}<div class="basket-board">${board()}</div></div></div>
  </section>` : "";

  /* ---------- header */
  const head = `
  <div class="wrap p-head">
    <div class="crumb"><a href="index.html">Register</a><span>/</span><span class="mono">${esc(p.id)}</span></div>
    <h1>${esc(p.name)}</h1>
    ${p.tagline ? `<p class="tag">${esc(p.tagline)}</p>` : ""}
    <div class="chips">${chip("stage", STAGES[p.stage] || p.stage)}${NFA.WIP ? `<span class="chip pending" title="${esc(NFA.WIP_TEXT)}">Work in progress</span>` : ""}${p.stageNote ? `<span class="muted" style="font-size:13px">${esc(p.stageNote)}</span>` : ""}</div>
    <dl class="facts">
      <div><dt>Project developer</dt><dd>${orgList(developers, p.developersNote)}</dd></div>
      <div><dt>${funders.length > 1 ? "Funders" : "Funder"}</dt><dd>${orgList(funders, funding.fundersNote)}</dd></div>
      <div><dt>Funding</dt><dd>${esc(amountText)}<small>${esc(amountNote)}</small></dd></div>
      <div><dt>Location</dt><dd>${esc(loc.municipality || "–")}<small>${esc((loc.cantons || []).map((c) => CANTONS[c] || c).join(", "))}</small></dd></div>
      <div><dt>Area</dt><dd>${esc(area(p))}<small>${loc.areaPrecision === "approximate" ? "approximate" : "from boundary"}</small></dd></div>
      <div><dt>Baseline</dt><dd>${esc(rounds[0] ? rounds[0].years : p.dates.baselineT0 ? fmtDate(p.dates.baselineT0) : "Pending")}<small>${esc(rounds[0] ? (rounds[0].status === "done" ? "complete" : rounds[0].status === "in-progress" ? "under way" : "planned") : (p.dates.baselineT0Note || ""))}</small></dd></div>
    </dl>
    <div class="views">
      <div class="view-switch" role="tablist" aria-label="View of this record">
        <button type="button" role="tab" data-view="summary"><b>Summary</b><span>Funders, developers, policy</span></button>
        <button type="button" role="tab" data-view="record"><b>Full record</b><span>Scientists, reviewers</span></button>
      </div>
      <span class="muted">Registered ${esc(fmtDate(p.dates.registered))} · updated ${esc(fmtDate(p.dates.lastUpdated))}</span>
    </div>
  </div>`;

  /* ---------- photo plus map (both views). The map shows the project area plus the reference areas. */
  const visual = `
  <div class="wrap">
    <div class="visual">
      ${hero ? `<figure><img src="${esc(hero.src)}" alt="${esc(hero.alt)}"><figcaption>${esc(hero.credit ? "Photo: " + hero.credit : "")}</figcaption></figure>` : `<figure><div class="ph" style="height:420px;border-radius:8px;background:var(--blush)"></div></figure>`}
      <div class="map-box"><div class="map" id="pmap" role="region" aria-label="Project area plus reference areas"></div>
        <ul class="map-legend" id="legend">
          <li>${loc.boundary ? `<i class="lg area"></i>Project area${loc.boundaryStatus && loc.boundaryStatus !== "surveyed" ? ` (${esc(loc.boundaryStatus)})` : ""}` : `<i class="lg site"></i>Project site, ${esc(loc.pointPrecision || "approximate")} level <span class="muted">· boundary follows</span>`}</li>
          <li id="legendRef">${loc.referenceAreas ? `<i class="lg ref"></i>Reference areas${loc.referenceAreasStatus && loc.referenceAreasStatus !== "surveyed" ? ` (${esc(loc.referenceAreasStatus)})` : ""}` : `<i class="lg ref off"></i><span class="muted">Reference areas: ${esc(loc.referenceAreasNote ? "outlines follow" : "not on the map yet")}</span>`}</li>
        </ul>
      </div>
    </div>
  </div>`;


  /* ---------- monitoring streams: key figures, charts plus sounds.
     Full record: everything, sources marked "example" carry an Example data tag until the partner delivers.
     Summary: only measured items that belong to no basket metric, under "Did you know?". */
  const mon = p.monitoring;
  const RED = { CR: "Critically endangered", EN: "Endangered", VU: "Vulnerable", NT: "Near threatened", LC: "Least concern" };
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

  const drawChart = (c) => (c.type === "bars" ? barsChart(c) : c.type === "hbars" ? hbarsChart(c) : splitChart(c, false));

  function soundsCard(m) {
    const sounds = (m.sounds || []).slice().sort((a, b) => (b.lastHeard || "").localeCompare(a.lastHeard || ""));
    return sounds.length ? `
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
  }

  function liveBlock(m) {
    const charts = m.charts || [];
    const band = charts.find((c) => c.type === "split" && !isEx(c.source));
    const cards = charts.filter((c) => c !== band);
    const soundCard = soundsCard(m);
    const order = [];
    cards.forEach((c, i) => { order.push(chartBox(c, drawChart(c))); if (i === 1 && soundCard) order.push(soundCard); });
    if (cards.length < 2 && soundCard) order.push(soundCard);
    return `
  <section class="live only-record" id="live" aria-label="${esc(m.title || "Monitoring streams")}">
    <div class="wrap">
      <div class="live-band">
        <div class="live-top">
          <div class="label light"><span class="pulse" aria-hidden="true"></span>${esc(m.title || "Monitoring streams")}</div>
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

  /** Summary: measured, nice to know, not part of the basket. */
  function didYouKnow(m) {
    const nice = (x) => !x.metric && !isEx(x.source);
    const facts = (m.kpis || []).filter(nice), charts = (m.charts || []).filter(nice);
    const strip = charts.find((c) => c.type === "split"), cards = charts.filter((c) => c !== strip), soundCard = soundsCard(m);
    if (!facts.length && !charts.length && !soundCard) return "";
    return `
  <section class="dyk only-summary" id="didyouknow">
    <div class="wrap">
      <div class="opener"><div class="label">Did you know?</div>
        <h2>Heard on the site</h2>
        <p>${esc(m.didYouKnow || "Good to know. These figures are not part of the basket.")}</p></div>
      ${facts.length ? `<div class="dyk-facts">${facts.map((k) => `<div><b>${esc(k.value)}</b><span>${esc(k.label)}</span>${k.note ? `<small>${esc(k.note)}</small>` : ""}</div>`).join("")}</div>` : ""}
      ${strip ? `<div class="dyk-strip"><span>${esc(strip.title || "")}</span>${splitChart(strip, false)}</div>` : ""}
      <div class="live-grid">${cards.map((c) => chartBox(c, drawChart(c))).join("")}${soundCard}</div>
      <p class="live-note">${esc(m.method || "")}${m.method ? ". " : ""}${m.retrieved ? `Figures retrieved ${esc(fmtDate(m.retrieved))}. ` : ""}<a href="#live">All monitoring streams in the full record →</a></p>
    </div>
  </section>`;
  }
  const dyk = mon ? didYouKnow(mon) : "";

  /* ---------- tabs */
  const images = p.images || [];
  const sections = [
    ["overview", "Overview"],
    ["measurements", "Measurements", p.measurements.length],
    ["data", "Data", p.datasets.length],
    ["agreements", "Agreements, documents", p.agreements.length + docs.length],
    ["organisations", "Organisations", p.organisations.length],
    ["timeline", "Timeline"]
  ];
  const tabs = `<div class="tabs only-record"><div class="wrap">${sections.map(([id, t, n]) => `<a href="#${id}">${t}${n != null ? `<sup>${n}</sup>` : ""}</a>`).join("")}</div></div>`;

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
      ${(p.ecosystem || []).length ? `<dt>Ecosystem</dt><dd>${esc(p.ecosystem.join(", "))}</dd>` : ""}
      <dt>Project developer</dt><dd>${orgList(developers, p.developersNote)}</dd>
      <dt>${funders.length > 1 ? "Funders" : "Funder"}</dt><dd>${orgList(funders, funding.fundersNote)}</dd>
      <dt>Funding</dt><dd>${esc(amountText)}${amountNote ? ` <span class="muted">· ${esc(amountNote)}</span>` : ""}</dd>
      <dt>Location</dt><dd>${esc(NFA.places(loc.cantons, loc.municipality))} · ${loc.point[1].toFixed(3)}° N, ${loc.point[0].toFixed(3)}° E <span class="muted">(${esc(loc.pointPrecision || "")} level)</span></dd>
    </dl>
  </section>`;

  /* ---------- measurements */
  const groups = [["core", "Core metrics: the basket"], ["context", "Context data"], ["design", "Study design"]];
  const mRows = groups.map(([g, label]) => {
    const list = p.measurements.filter((x) => x.group === g);
    if (!list.length) return "";
    return `<tr class="group-row"><td colspan="5">${label}</td></tr>` + list.map((x) => `
      <tr id="${esc(x.id)}">
        <td data-h="Metric"><b>${esc(x.metric)}${x.structural ? `<span class="structural">structural</span>` : ""}</b>
          ${x.indicator ? `<span class="sub">${esc(x.indicator)}${x.unit ? `, ${esc(x.unit)}` : ""}</span>` : ""}
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
    ${basket.length && rounds.length ? `<h3 style="margin-top:0">Basket over time</h3>
    <div class="basket-board in-record">${board()}</div>
    ${out.method ? `<p class="muted" style="font-size:13px;margin-top:14px">Headline indicator: ${esc(OUT[out.status] || out.status)}. ${esc(out.method)}</p>` : ""}
    <h3>Methods</h3>` : ""}
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
  <section class="photos only-summary" id="images">
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
        <b>${esc(o.name)}${developers.includes(o.id) ? `<span class="structural">Project developer</span>` : ""}${funders.includes(o.id) ? `<span class="structural">Funder</span>` : ""}</b>
        <span>${esc(o.role)}</span>
        ${o.type ? `<span class="muted">${esc(o.type)}</span>` : ""}
        ${o.url ? `<a href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""))} ↗</a>` : ""}
        ${o.note ? `<span class="note muted">${esc(o.note)}</span>` : ""}
      </div>`).join("")}</div>
  </section>`;

  /* ---------- timeline. Interventions (work on the ground) are shown in the summary on a year axis,
     next to the measurement rounds. The full record lists every step. */
  const TYPES = { intervention: "On the ground", measurement: "Measurement", data: "Data", review: "Review", record: "Register" };
  const steps = p.timeline || [];
  const interventions = steps.filter((t) => t.type === "intervention");
  const timeline = `
  <section class="block" id="timeline">
    <div class="label">Timeline</div>
    <h2>Milestones</h2>
    <ol class="timeline">${steps.map((t) => `<li class="${esc(t.status)}"><div class="d">${esc(when(t.date))}${t.status === "ongoing" ? " · ongoing" : ""}${t.type ? `<span class="ty ${esc(t.type)}">${esc(TYPES[t.type] || t.type)}</span>` : ""}</div><div class="e">${esc(t.event)}${(t.by || []).length ? `<span class="by">${names(t.by)}</span>` : ""}</div></li>`).join("")}</ol>
    ${(p.changelog || []).length ? `<h3>Changes to this record</h3><ul style="padding-left:18px;margin:0;color:var(--grey-700);font-size:14px">${p.changelog.map((c) => `<li><span class="mono">${esc(c.date)}</span> ${esc(c.change)}</li>`).join("")}</ul>` : ""}
  </section>`;

  function ground() {
    const ys = [...interventions.flatMap((t) => yearsOf(t.date)), ...rounds.flatMap((r) => yearsOf(r.years))];
    if (!ys.length) return "";
    const y0 = Math.min(...ys), y1 = Math.max(...ys), years = Array.from({ length: y1 - y0 + 1 }, (_, i) => y0 + i), now = new Date().getFullYear();
    const col = (y) => y - y0 + 2;
    return `
  <section class="ground only-summary" id="ground">
    <div class="wrap">
      <div class="opener"><div class="label">On the ground</div>
        <h2>What has been done, when</h2>
        <p>Work on the site, set against the measurement rounds. A change in the basket can then be read next to what was done before it.</p></div>
      <div class="years-scroll"><div class="years" style="--n:${years.length}">
        <span class="yk" style="grid-row:1"></span>${years.map((y) => `<span class="yh${y === now ? " now" : ""}" style="grid-column:${col(y)}">${y}</span>`).join("")}
        <span class="yk" style="grid-row:2">On the ground</span>
        ${years.map((y) => `<div class="yc" style="grid-column:${col(y)}">${interventions.filter((t) => yearsOf(t.date)[0] === y).map((t) => `<div class="iv ${esc(t.status)}"><b>${esc(t.event)}</b><span>${esc(when(t.date))}${t.status === "ongoing" ? " · ongoing" : t.status === "planned" ? " · planned" : ""}${(t.by || []).length ? ` · ${names(t.by)}` : ""}</span></div>`).join("")}</div>`).join("")}
        <span class="yk" style="grid-row:3">Measured</span>
        ${rounds.map((r, i) => { const y = yearsOf(r.years); return y.length ? `<div class="rd ${esc(r.status)}" style="grid-column:${col(y[0])} / span ${y[y.length - 1] - y[0] + 1}"><b>${esc(i === 0 ? (r.label || "Baseline") : (r.label || r.id))}</b><span>${esc(r.status === "done" ? "done" : r.status === "in-progress" ? "under way" : "planned")}</span></div>` : ""; }).join("")}
      </div></div>
      <p class="live-note">${interventions.length ? "" : "No work on the ground is recorded yet. "}<a href="#timeline">Every measurement, data plus review step in the full record →</a></p>
    </div>
  </section>`;
  }

  /* ---------- summary: about the project, who is behind it */
  const m0 = p.method || {};
  const about = `
  <section class="about only-summary" id="about">
    <div class="wrap">
      <div class="opener"><div class="label">The project</div><h2>In brief</h2></div>
      <div class="about-grid">
        <div><p class="lead">${esc(p.summary)}</p>${(p.description || []).slice(0, 1).map((d) => `<p>${esc(d)}</p>`).join("")}</div>
        <dl class="kv">
          ${(p.ecosystem || []).length ? `<dt>Ecosystem</dt><dd>${esc(p.ecosystem.join(", "))}</dd>` : ""}
          ${p.landUse ? `<dt>Land use</dt><dd>${esc(p.landUse)}</dd>` : ""}
          ${m0.design ? `<dt>How change is read</dt><dd>${esc(m0.design)}</dd>` : ""}
          ${m0.review ? `<dt>Independent review</dt><dd>${esc(m0.review)}</dd>` : ""}
          <dt>Partners</dt><dd>${p.organisations.length} organisations · <a href="#organisations">see all</a></dd>
        </dl>
      </div>
    </div>
  </section>`;

  const openness = { public: 0, "on-request": 0, "not-disclosed": 0 };
  [...p.datasets, ...p.agreements, ...docs].forEach((i) => { openness[i.disclosure] = (openness[i.disclosure] || 0) + 1; });
  const toRecord = `
  <section class="to-record only-summary">
    <div class="wrap"><div class="to-record-box">
      <div><div class="label">For scientists, reviewers</div>
        <h2>The full record</h2>
        <p>${p.measurements.length} measurements with their methods, ${p.datasets.length} datasets, ${p.agreements.length} agreements, ${docs.length} documents, the complete timeline.</p>
        ${NFA.opennessBar(openness)}</div>
      <button type="button" class="btn dark" data-view="record">Open the full record →</button>
    </div></div>
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
        <li class="muted">Registered ${esc(fmtDate(p.dates.registered))}</li>
        <li class="muted">Updated ${esc(fmtDate(p.dates.lastUpdated))}</li>
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

  main.innerHTML = head + basketBand + visual + ground() + about + dyk + gallery + toRecord
    + live + tabs + `<div class="wrap p-body only-record"><div>${overview}${measurements}${data}${agreements}${organisations}${timeline}</div>${side}</div>`;

  /* ---------- the two views. Summary by default; ?view=record or a link to a row of the record opens the full record. */
  const inRecord = (el) => !!(el && el.closest(".only-record"));
  function setView(v, push) {
    main.dataset.view = v;
    document.querySelectorAll(".view-switch button").forEach((b) => { const on = b.dataset.view === v; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
    if (push) {
      const u = new URL(location.href);
      if (v === "record") u.searchParams.set("view", "record"); else u.searchParams.delete("view");
      history.replaceState(null, "", u);
    }
  }
  const hashTarget = location.hash ? document.getElementById(location.hash.slice(1)) : null;
  setView(new URLSearchParams(location.search).get("view") === "record" || inRecord(hashTarget) ? "record" : "summary");
  main.addEventListener("click", (e) => {
    const b = e.target.closest("[data-view]");
    if (b && b.tagName === "BUTTON") {
      setView(b.dataset.view, true);
      if (!b.closest(".view-switch")) document.querySelector(".views").scrollIntoView();
      return;
    }
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const t = document.getElementById(a.getAttribute("href").slice(1));
    if (!t) return;
    const need = inRecord(t) ? "record" : t.closest(".only-summary") ? "summary" : null;
    if (need && main.dataset.view !== need) {
      e.preventDefault();
      setView(need, true);
      history.replaceState(null, "", a.getAttribute("href"));
      t.scrollIntoView();
    }
  });

  /* ---------- map: project area (or site pin) plus reference areas */
  const map = makeMap("pmap", { imagery: true });
  const ll = [loc.point[1], loc.point[0]];
  let bounds = null;
  const grow = (layer) => { const b = layer.getBounds(); if (b.isValid()) bounds = bounds ? bounds.extend(b) : L.latLngBounds(b.getSouthWest(), b.getNorthEast()); };
  if (loc.boundary) {
    try {
      const gj = await getJSON(loc.boundary);
      const line = NFA.cssVar("--map-mark");
      grow(L.geoJSON(gj, { style: { color: line, weight: 3, fillColor: line, fillOpacity: 0.15 } }).bindTooltip("Project area", { sticky: true }).addTo(map));
    } catch { /* falls back to the pin below */ }
  }
  if (!bounds) L.marker(ll, { icon: pin(), title: p.name }).addTo(map);
  if (loc.referenceAreas) {
    try {
      const gj = await getJSON(loc.referenceAreas);
      // dark casing under a white dashed line: readable on the aerial image and on the grey map
      const casing = L.geoJSON(gj, { style: { color: NFA.cssVar("--forest"), weight: 5, opacity: 0.9, fill: false }, pointToLayer: (f, at) => L.circleMarker(at, { radius: 9 }) }).addTo(map);
      L.geoJSON(gj, {
        style: { color: "#fff", weight: 2, dashArray: "6 5", fillColor: "#fff", fillOpacity: 0.12 },
        pointToLayer: (f, at) => L.circleMarker(at, { radius: 8 }),
        onEachFeature: (f, layer) => layer.bindTooltip(`Reference area${f.properties && f.properties.name ? ": " + esc(f.properties.name) : ""}`, { sticky: true })
      }).addTo(map);
      grow(casing);
      const n = (gj.features || []).length;
      if (n) document.getElementById("legendRef").insertAdjacentHTML("beforeend", ` <span class="muted">· ${n}</span>`);
    } catch {
      document.getElementById("legendRef").innerHTML = `<i class="lg ref off"></i><span class="muted">Reference areas: file could not be loaded</span>`;
    }
  }
  if (bounds) { if (!loc.boundary) bounds.extend(ll); map.fitBounds(bounds, { padding: [28, 28] }); }
  else map.setView(ll, loc.pointPrecision === "municipality" ? 14 : 16);


  /* ---------- live block: grow charts when they come into view, count up the key figures, play sounds */
  const liveEls = [...document.querySelectorAll("#live, #didyouknow")];
  if (liveEls.length) {
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
    liveEls.forEach((el) => el.querySelectorAll(".live-band, .live-card").forEach((x) => seen.observe(x)));

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
  if (hashTarget) { if (hashTarget.tagName === "TR") hashTarget.classList.add("target"); hashTarget.scrollIntoView(); }
})();
