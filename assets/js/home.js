/* Home page: figures, filters, project rows, map. */
(async () => {
  const { esc, getJSON, STAGES, CANTONS, area, opennessBar, makeMap, pin, chip } = NFA;
  let index;
  try {
    index = await getJSON("data/index.json");
  } catch (e) {
    document.getElementById("rows").innerHTML = `<p class="empty">The register index could not be loaded. Open the site through a web server (preview.bat), not as a file.</p>`;
    return;
  }
  if (NFA.WIP) { const w = document.getElementById("wip"); w.querySelector("span").textContent = NFA.WIP_TEXT; w.hidden = false; }
  const projects = index.projects;
  const t = index.totals;

  // figures
  const openShare = t.items ? Math.round((t.public / t.items) * 100) : 0;
  document.getElementById("figures").innerHTML = [
    [t.projects, t.projects === 1 ? "Project" : "Projects"],
    [`${t.hectares.toLocaleString("en-GB")}`, "Hectares"],
    [t.measurements, "Measurements"],
    [t.datasets, "Datasets listed"],
    [`${openShare}%`, "Items public"]
  ].map(([b, s]) => `<div><b>${esc(b)}</b><span>${esc(s)}</span></div>`).join("");

  // latest card in hero
  const latest = [...projects].sort((a, b) => (b.lastUpdated || "").localeCompare(a.lastUpdated || ""))[0];
  if (latest) {
    const card = document.getElementById("latest");
    card.href = `project.html?id=${encodeURIComponent(latest.slug)}`;
    card.innerHTML = `${latest.image ? `<img src="${esc(latest.image)}" alt="" style="width:100%;height:110px;object-fit:cover;border-radius:6px;margin-bottom:12px">` : ""}
      <div class="label lime">Latest entry</div><strong>${esc(latest.name)}</strong><small>${esc(latest.id)} · updated ${esc(NFA.fmtDate(latest.lastUpdated))}</small>`;
    card.hidden = false;
  }

  // filters
  const fC = document.getElementById("fCanton"), fS = document.getElementById("fStage"), q = document.getElementById("q");
  [...new Set(projects.flatMap((p) => p.cantons || []))].sort().forEach((c) => fC.insertAdjacentHTML("beforeend", `<option value="${esc(c)}">${esc(CANTONS[c] || c)}</option>`));
  [...new Set(projects.map((p) => p.stage))].forEach((s) => fS.insertAdjacentHTML("beforeend", `<option value="${esc(s)}">${esc(STAGES[s] || s)}</option>`));

  // map
  const map = makeMap("map");
  map.fitBounds([[45.82, 5.96], [47.81, 10.49]]);
  const markers = {};
  projects.forEach((p) => {
    markers[p.slug] = L.marker([p.point[1], p.point[0]], { icon: pin(), title: p.name })
      .bindPopup(`<b>${esc(p.name)}</b><br><span class="mono">${esc(p.id)}</span><br>${esc(STAGES[p.stage])} · ${esc(area(p))}<br><a href="project.html?id=${encodeURIComponent(p.slug)}">Open record →</a>`)
      .addTo(map);
  });

  function row(p) {
    const c = p.counts;
    return `<a class="row" href="project.html?id=${encodeURIComponent(p.slug)}" data-slug="${esc(p.slug)}">
      ${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.imageAlt || "")}" loading="lazy">` : `<span class="ph"></span>`}
      <div>
        <div class="meta-line"><span class="mono">${esc(p.id)}</span>${chip("stage", STAGES[p.stage] || p.stage)}</div>
        <h3>${esc(p.name)}</h3>
        <p>${esc(p.summary)}</p>
        <div class="meta-line">
          <span>${esc(NFA.places(p.cantons, p.municipality))}</span>
          <span>${esc(area(p))}</span>
          <span>${c.measurements} measurements</span>
          <span>${c.datasets} datasets</span>
          <span>${c.agreements} agreements</span>
        </div>
        <div style="margin-top:10px">${opennessBar(p.disclosure)}</div>
      </div>
    </a>`;
  }

  function render() {
    const term = q.value.trim().toLowerCase();
    const list = projects.filter((p) =>
      (!fC.value || (p.cantons || []).includes(fC.value)) &&
      (!fS.value || p.stage === fS.value) &&
      (!term || [p.name, p.id, p.summary, p.municipality, ...(p.cantons || []).map((c) => CANTONS[c] || c), ...(p.ecosystem || [])].join(" ").toLowerCase().includes(term)));
    document.getElementById("rows").innerHTML = list.length ? list.map(row).join("") : `<p class="empty">No project matches these filters.</p>`;
    Object.entries(markers).forEach(([slug, m]) => {
      const show = list.some((p) => p.slug === slug);
      if (show && !map.hasLayer(m)) m.addTo(map);
      if (!show && map.hasLayer(m)) map.removeLayer(m);
    });
    document.querySelectorAll(".row").forEach((r) => {
      r.addEventListener("mouseenter", () => markers[r.dataset.slug]?.openPopup());
    });
  }
  [fC, fS].forEach((el) => el.addEventListener("change", render));
  q.addEventListener("input", render);
  render();
})();
