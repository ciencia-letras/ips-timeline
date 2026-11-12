/* Human-readable view of an IPS Bundle, built from the coded resources (not from the narrative). */
(function (g) {
  "use strict";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const SEC = {
    "11450-4": ["Active problems", "Problemas ativos"], "48765-2": ["Allergies and intolerances", "Alergias e intolerâncias"],
    "10160-0": ["Medication", "Medicação"], "11369-6": ["Immunizations", "Vacinação"], "11348-0": ["Past illnesses", "Doenças anteriores"],
    "47519-4": ["Procedures", "Procedimentos"], "30954-2": ["Results", "Resultados"], "8716-3": ["Vital signs", "Sinais vitais"],
    "10162-6": ["Pregnancy", "Gravidez"], "29762-2": ["Social history and life context", "Hábitos e contexto de vida"],
    "46240-8": ["Care episodes", "Episódios de cuidados"], "18776-5": ["Plan of care", "Plano de cuidados"],
  };
  const L = {
    en: { born: "Date of birth", sex: "Sex", city: "City", author: "Author", org: "Organisation", date: "Summary date", id: "Identifier",
      female: "Female", male: "Male", item: "Item", codes: "Codes", since: "Since", note: "Note", until: "Resolved", dose: "Dosage", period: "Period",
      status: "Status", ongoing: "ongoing", test: "Test", latest: "Latest value", ref: "Reference", trend: "Trend", n: "values",
      when: "Date", type: "Type", reason: "Reason", vaccine: "Vaccine", agent: "Agent", reaction: "Reaction", crit: "Criticality",
      report: "Report", conclusion: "Conclusion", records: "records", device: "Source",
      cls: { AMB: "Outpatient", EMER: "Emergency", IMP: "Inpatient", VR: "Remote" }, nar: "Section narrative" },
    pt: { born: "Data de nascimento", sex: "Sexo", city: "Localidade", author: "Autor", org: "Organização", date: "Data do resumo", id: "Identificador",
      female: "Feminino", male: "Masculino", item: "Item", codes: "Códigos", since: "Desde", note: "Nota", until: "Resolvido", dose: "Posologia", period: "Período",
      status: "Estado", ongoing: "em curso", test: "Análise / medição", latest: "Último valor", ref: "Referência", trend: "Evolução", n: "valores",
      when: "Data", type: "Tipo", reason: "Motivo", vaccine: "Vacina", agent: "Agente", reaction: "Reação", crit: "Criticidade",
      report: "Exame", conclusion: "Conclusão", records: "registos", device: "Origem",
      cls: { AMB: "Consulta", EMER: "Urgência", IMP: "Internamento", VR: "À distância" }, nar: "Narrativa da secção" },
  };
  const SYS = s => s.includes("snomed") ? "SNOMED CT" : s.includes("loinc") ? "LOINC" : s.includes("whocc") ? "ATC" : s.includes("icpc") ? "ICPC-2" : s.includes("virtual-patient") ? "local" : "code";
  const codes = c => ((c && c.coding) || []).map(x => `<span class="code" title="${esc(x.system)}">${SYS(x.system || "")} ${esc(x.code)}</span>`).join("");
  const text = c => (c && (c.text || (c.coding && c.coding[0] && c.coding[0].display))) || "";
  const fmtD = (s, lg) => { if (!s) return ""; if (s.length === 4) return s; const d = new Date((s.length === 7 ? s + "-15" : s.slice(0, 10)) + "T12:00:00");
    return s.length === 7 ? d.toLocaleDateString(lg === "pt" ? "pt-PT" : "en-GB", { month: "short", year: "numeric" }) : d.toLocaleDateString(lg === "pt" ? "pt-PT" : "en-GB"); };
  const num = (v, lg) => Number(v).toLocaleString(lg === "pt" ? "pt-PT" : "en-GB", { maximumFractionDigits: 2 });
  const note = r => (r.note && r.note[0] && r.note[0].text) || "";

  function spark(pts) {
    if (pts.length < 2) return "";
    const W = 90, H = 24, xs = pts.map(p => new Date(p.d.length === 7 ? p.d + "-15" : p.d).getTime()), ys = pts.map(p => p.v);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const X = x => 2 + (x1 === x0 ? 0 : (x - x0) / (x1 - x0)) * (W - 4), Y = y => H - 3 - (y1 === y0 ? .5 : (y - y0) / (y1 - y0)) * (H - 6);
    const d = pts.map((p, i) => (i ? "L" : "M") + X(xs[i]).toFixed(1) + " " + Y(p.v).toFixed(1)).join("");
    const last = pts[pts.length - 1];
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${d}" fill="none" stroke="var(--point)" stroke-width="1.6"/>` +
      `<circle cx="${X(xs[xs.length - 1]).toFixed(1)}" cy="${Y(last.v).toFixed(1)}" r="2.6" fill="${last.ab ? "var(--alert)" : "var(--point)"}"/></svg>`;
  }

  function render(bundle, lg) {
    const t = L[lg] || L.en;
    const R = (bundle.entry || []).map(e => Object.assign({ _url: e.fullUrl }, e.resource));
    const byUrl = Object.fromEntries(R.map(r => [r._url, r]));
    const comp = R.find(r => r.resourceType === "Composition") || { section: [] };
    const pat = R.find(r => r.resourceType === "Patient") || {};
    const author = comp.author && byUrl[comp.author[0].reference];
    const org = comp.custodian && byUrl[comp.custodian.reference];
    let h = `<div class="pcard">
      <div><b>${t.born}</b>${fmtD(pat.birthDate, lg)}</div>
      <div><b>${t.sex}</b>${t[pat.gender] || esc(pat.gender)}</div>
      <div><b>${t.city}</b>${esc(pat.address && pat.address[0] && pat.address[0].city)}</div>
      <div><b>${t.date}</b>${fmtD(comp.date, lg)}</div>
      <div><b>${t.author}</b>${esc(author && author.name && author.name[0].text)}</div>
      <div><b>${t.org}</b>${esc(org && org.name)}</div>
      <div><b>${t.id}</b><span class="code">${esc(bundle.identifier && bundle.identifier.value)}</span></div></div>`;

    for (const s of comp.section || []) {
      const lc = s.code.coding[0].code;
      const title = (SEC[lc] || [s.title, s.title])[lg === "pt" ? 1 : 0];
      const res = (s.entry || []).map(e => byUrl[e.reference]).filter(Boolean);
      let body = "";
      const kinds = new Set(res.map(r => r.resourceType));
      const rowsOf = type => res.filter(r => r.resourceType === type);

      if (kinds.has("Condition")) {
        body += table([t.item, t.codes, t.since, lc === "11348-0" ? t.until : "", t.note], rowsOf("Condition").map(c =>
          [`<b>${esc(text(c.code))}</b>`, codes(c.code), fmtD(c.onsetDateTime, lg), fmtD(c.abatementDateTime, lg), `<span class="sub">${esc(note(c))}</span>`]), [3]);
      }
      if (kinds.has("AllergyIntolerance")) {
        body += table([t.agent, t.codes, t.reaction, t.crit], rowsOf("AllergyIntolerance").map(a =>
          [`<b>${esc(text(a.code))}</b>${note(a) ? `<div class="sub">${esc(note(a))}</div>` : ""}`, codes(a.code),
           esc(a.reaction ? text(a.reaction[0].manifestation[0]) : ""), esc(a.criticality || "")]));
      }
      if (kinds.has("MedicationStatement")) {
        const ms = rowsOf("MedicationStatement").sort((a, b) => (a.status === b.status ? (b.effectivePeriod.start > a.effectivePeriod.start ? 1 : -1) : a.status === "active" ? -1 : 1));
        body += table([t.item, t.codes, t.dose, t.period, t.status], ms.map(m =>
          [`<b>${esc(text(m.medicationCodeableConcept))}</b>${note(m) ? `<div class="sub">${esc(note(m))}</div>` : ""}`, codes(m.medicationCodeableConcept),
           esc(m.dosage && m.dosage[0].text), `<span class="num">${fmtD(m.effectivePeriod.start, lg)} → ${m.effectivePeriod.end ? fmtD(m.effectivePeriod.end, lg) : t.ongoing}</span>`,
           m.status === "active" ? `<span class="ok">${esc(m.status)}</span>` : esc(m.status)]));
      }
      if (kinds.has("Immunization")) {
        body += table([t.when, t.vaccine], rowsOf("Immunization").sort((a, b) => a.occurrenceDateTime < b.occurrenceDateTime ? 1 : -1)
          .map(i => [`<span class="num">${fmtD(i.occurrenceDateTime, lg)}</span>`, esc(text(i.vaccineCode))]));
      }
      if (kinds.has("Procedure")) {
        body += table([t.when, t.item, t.codes, t.note], rowsOf("Procedure").map(p =>
          [fmtD(p.performedDateTime, lg), `<b>${esc(text(p.code))}</b>`, codes(p.code), `<span class="sub">${esc(note(p))}</span>`]));
      }
      if (kinds.has("DiagnosticReport")) {
        body += table([t.when, t.report, t.conclusion], rowsOf("DiagnosticReport").sort((a, b) => a.effectiveDateTime < b.effectiveDateTime ? 1 : -1).map(r =>
          [`<span class="num">${fmtD(r.effectiveDateTime, lg)}</span>`, `<b>${esc(text(r.code))}</b>`,
           ((r.conclusionCode || []).length ? '<span class="flag">▲ </span>' : "") + esc(r.conclusion)]));
      }
      if (kinds.has("Encounter")) {
        body += table([t.when, t.type, t.item, t.reason], rowsOf("Encounter").sort((a, b) => a.period.start < b.period.start ? 1 : -1).map(e =>
          [`<span class="num">${fmtD(e.period.start, lg)}</span>`, esc(t.cls[e.class.code] || e.class.code), `<b>${esc(text(e.type[0]))}</b>`,
           `<span class="sub">${esc(e.reasonCode ? text(e.reasonCode[0]) : "")}</span>`]));
      }
      const obs = rowsOf("Observation");
      if (obs.length) {
        const qty = obs.filter(o => o.valueQuantity), other = obs.filter(o => !o.valueQuantity);
        if (other.length) {
          body += table([t.when, t.item, t.note], other.sort((a, b) => ((a.effectiveDateTime || a.effectivePeriod.start) < (b.effectiveDateTime || b.effectivePeriod.start) ? 1 : -1)).map(o => {
            const when = o.effectivePeriod ? `${fmtD(o.effectivePeriod.start, lg)} → ${fmtD(o.effectivePeriod.end, lg)}` : fmtD(o.effectiveDateTime, lg);
            const label = o.valueString || text(o.valueCodeableConcept);
            return [`<span class="num">${when}</span>`, `<b>${esc(label)}</b><div class="sub">${esc(text(o.code))}</div>`, `<span class="sub">${esc(note(o))}</span>`];
          }));
        }
        if (qty.length) {
          const by = {};
          qty.forEach(o => { const k = text(o.code); (by[k] = by[k] || []).push(o); });
          body += table([t.test, t.latest, t.ref, t.trend], Object.entries(by).map(([k, arr]) => {
            arr.sort((a, b) => ((a.effectiveDateTime || a.effectivePeriod.start) > (b.effectiveDateTime || b.effectivePeriod.start) ? 1 : -1));
            const last = arr[arr.length - 1], q = last.valueQuantity, rr = (last.referenceRange || [])[0] || {};
            const ic = last.interpretation && last.interpretation[0].coding[0].code;
            const lo = rr.low && rr.low.value, hi = rr.high && rr.high.value;
            const ab = ic ? ic !== "N" : (hi != null && q.value > hi) || (lo != null && q.value < lo);
            const ref = lo != null && hi != null ? `${num(lo, lg)}–${num(hi, lg)}` : hi != null ? `≤ ${num(hi, lg)}` : lo != null ? `≥ ${num(lo, lg)}` : "";
            const when = last.effectiveDateTime || last.effectivePeriod.start;
            const pts = arr.map(o => ({ d: (o.effectiveDateTime || o.effectivePeriod.start), v: o.valueQuantity.value }));
            pts[pts.length - 1].ab = ab;
            return [`<b>${esc(k)}</b><div>${codes(last.code)}</div>${last.device ? `<div class="sub">${t.device}: ${esc(last.device.display)}</div>` : ""}`,
              `<span class="num ${ab ? "flag" : ""}">${num(q.value, lg)} ${esc(q.unit)}${ab ? (ic === "L" || (lo != null && q.value < lo) ? " ▼" : " ▲") : ""}</span><div class="sub">${fmtD(when, lg)}</div>`,
              `<span class="num">${ref}</span>`, `${spark(pts)} <span class="sub">${arr.length} ${t.n}</span>`];
          }));
        }
      }
      h += `<section class="sect"><header><h2>${esc(title)}</h2><span class="loinc">LOINC ${esc(lc)}</span><span class="n">${res.length} ${t.records}</span></header>${body}</section>`;
    }
    return h;
  }

  function table(head, rows, hideEmptyCols) {
    const keep = head.map((hd, i) => hd !== "" || rows.some(r => r[i]));
    return `<div class="scroll"><table class="tbl"><thead><tr>${head.map((x, i) => keep[i] ? `<th>${esc(x)}</th>` : "").join("")}</tr></thead><tbody>` +
      rows.map(r => "<tr>" + r.map((c, i) => keep[i] ? `<td>${c == null ? "" : c}</td>` : "").join("") + "</tr>").join("") + "</tbody></table></div>";
  }

  g.renderIPS = render;
})(window);
