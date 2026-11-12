/* IPS (HL7 FHIR R4 document Bundle)  ->  timeline data (schema of the "timeline-saude" engine)
 *
 * Converte um IPS em dados para o motor da timeline. Nada aqui é específico de um paciente:
 * os grupos, as séries, os episódios e os problemas saem todos dos recursos FHIR, por regras.
 *
 *   Patient                      -> título, idade, data de nascimento
 *   Composition.date             -> "hoje"
 *   Condition (ativa)            -> chips de problemas; diagnóstico sem episódio -> evento
 *   Encounter                    -> eventos (AMB consulta, EMER urgência, IMP internamento, VR nota)
 *   Encounter status=planned     -> evento tracejado + "Por completar"
 *   Procedure / DiagnosticReport -> eventos (cirurgia / exame)
 *   Observation laboratory       -> colheitas + séries por analito (referência por colheita)
 *   Observation outras           -> séries; com effectivePeriod -> barras por período
 *   Observation social-history   -> períodos de vida (effectivePeriod) e marcos
 *   MedicationStatement          -> barras de medicação
 *   Immunization, AllergyIntolerance -> eventos
 */
(function (global) {
  "use strict";

  const LOCAL = "virtual-patient-measures";
  // code -> [series key, group id]. Keys follow the engine's recommended names (enables FIB-4).
  const CODE_MAP = {
    "4548-4": ["hba1c", "met"], "1558-6": ["gli", "met"], "2345-7": ["gli", "met"], "ogtt-75g-2h": ["ogtt", "met"],
    "smbg-1h-postprandial": ["smbg", "casa"],
    "29463-7": ["peso", "cresc"], "8302-2": ["altura", "cresc"], "39156-5": ["imc", "cresc"],
    "8480-6": ["pas", "cv"], "8462-4": ["pad", "cv"], "8867-4": ["fc", "cv"], "18262-6": ["ldl", "cv"], "13457-7": ["ldl", "cv"],
    "2085-9": ["hdl", "cv"], "2571-8": ["tg", "cv"], "2093-3": ["ct", "cv"], "33762-6": ["ntprobnp", "cv"],
    "2160-0": ["cre", "ren"], "62238-1": ["tfg", "ren"], "33914-3": ["tfg", "ren"], "9318-7": ["acr", "ren"],
    "2823-3": ["k", "ren"], "2951-2": ["na", "ren"],
    "1742-6": ["alt", "fig"], "1920-8": ["ast", "fig"], "2324-2": ["ggt", "fig"], "1975-2": ["bil", "fig"],
    "1751-7": ["alb", "fig"], "6768-6": ["fa", "fig"], "liver-stiffness": ["rigidez", "fig"], "alcohol-drinks-week": ["alcool", "fig"],
    "718-7": ["hb", "sang"], "6690-2": ["leu", "sang"], "777-3": ["plq", "sang"], "1988-5": ["pcr", "sang"], "2276-4": ["ferritina", "sang"],
    "3016-3": ["tsh", "tir"], "3024-7": ["t4l", "tir"],
    "711-2": ["eos", "alerg"], "19113-0": ["ige", "alerg"],
    "59408-5": ["spo2", "resp"], "2708-6": ["spo2", "resp"], "c-act": ["cact", "resp"], "fev1-pct-pred": ["fev1", "resp"],
    "inhaler-adherence": ["toma", "casa"], "cough-nights": ["noites", "casa"], "cpap-usage": ["cpap", "sono"],
    "41950-7": ["passos", "act"], "walking-hours": ["cam", "act"], "gym-hours": ["gin", "act"], "93832-4": ["sono", "sono"],
  };
  // Condition (SNOMED CT) -> group, so that problem chips open the right area
  const COND_GROUP = {
    "195967001": "resp", "4120002": "resp", "233604007": "resp", "78275009": "sono",
    "44054006": "met", "714628002": "met", "11687002": "met", "414916001": "cresc",
    "38341003": "cv", "84114007": "cv", "49436004": "cv", "55822004": "cv",
    "709044004": "ren", "95570007": "ren", "14140009": "ren",
    "197321007": "fig", "40930008": "tir", "87522002": "sang",
  };
  // Areas, in display order (life context, care, medication, then clinical systems, then patient-generated data)
  const GROUPS = [
    ["vida", "Contexto de vida", "brown", "família, trabalho, hábitos"],
    ["ep", "Episódios de cuidados", "blue"],
    ["med", "Medicação", "olive"],
    ["met", "Diabetes e metabolismo", "ochre"],
    ["cv", "Cardiovascular", "red"],
    ["resp", "Respiratório", "teal"],
    ["ren", "Rim e eletrólitos", "plum"],
    ["fig", "Fígado", "rust"],
    ["tir", "Tiroide", "violet"],
    ["sang", "Sangue e inflamação", "coral"],
    ["alerg", "Alergia", "purple"],
    ["cresc", "Peso e crescimento", "indigo"],
    ["sono", "Sono", "slate"],
    ["casa", "Dados recolhidos em casa", "rust", "dispositivos e registos"],
    ["act", "Atividade física", "green", "wearables"],
    ["vac", "Vacinação", "green"],
    ["out", "Outras observações", "slate"],
  ];

  const day = s => (s || "").slice(0, 10);
  const txt = c => (c && (c.text || (c.coding && c.coding[0] && c.coding[0].display))) || "";
  const codeOf = c => (c && c.coding && c.coding[0] && c.coding[0].code) || null;
  const isLocal = c => !!(c && c.coding && c.coding[0] && (c.coding[0].system || "").includes(LOCAL));
  const D = s => new Date(s.length === 7 ? s + "-15T12:00:00" : s.length === 4 ? s + "-07-01T12:00:00" : s.slice(0, 10) + "T12:00:00");
  const addMonths = (s, n) => { const d = D(s); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 7); };
  const monthPT = s => D(s).toLocaleDateString("pt-PT", { month: "short", year: "numeric" }).replace(" de ", "/").replace(".", "");
  const numPT = v => Number(v).toLocaleString("pt-PT", { maximumFractionDigits: 2 });
  const normDate = s => (s && s.length === 4 ? s + "-07" : s); // engine needs YYYY-MM or YYYY-MM-DD

  function convert(bundle) {
    const R = (bundle.entry || []).map(e => Object.assign({ _url: e.fullUrl }, e.resource));
    const byType = t => R.filter(r => r.resourceType === t);
    const byUrl = Object.fromEntries(R.map(r => [r._url, r]));
    const comp = byType("Composition")[0] || {};
    const pat = byType("Patient")[0] || {};
    const today = day(comp.date || bundle.timestamp || new Date().toISOString());
    const name = (pat.name && pat.name[0] && (pat.name[0].text || [].concat(pat.name[0].given || [], pat.name[0].family || []).join(" "))) || "Paciente";
    const birth = pat.birthDate;
    const age = birth ? Math.floor((D(today) - D(birth)) / (365.25 * 864e5)) : null;
    const fict = ((bundle.meta && bundle.meta.tag) || []).some(t => t.code === "HTEST");

    const rows = {};            // group id -> {events:[], spans:[], series:[], bars:[], life:false}
    const G = id => (rows[id] = rows[id] || { events: [], spans: [], series: [], bars: [], marks: [] });
    const dates = [];
    const pushDate = s => s && dates.push(s);

    /* ---- Encounters, procedures, reports -> care episodes ---- */
    const dxEncounters = new Set(byType("Condition").map(c => c.encounter && c.encounter.reference).filter(Boolean));
    const KIND = { AMB: "consulta", EMER: "urgencia", IMP: "internamento", VR: "nota", HH: "consulta" };
    const todo = [];
    byType("Encounter").forEach(e => {
      const cls = e.class && e.class.code;
      const planned = e.status === "planned";
      const start = normDate((e.period && e.period.start) || "");
      const ev = { d: start, title: txt(e.type && e.type[0]) || "Episódio", k: KIND[cls] || "consulta", txt: txt(e.reasonCode && e.reasonCode[0]) };
      if (e.period && e.period.end && !planned) ev.txt = (ev.txt ? ev.txt + " " : "") + "Alta a " + new Date(e.period.end + "T12:00:00").toLocaleDateString("pt-PT") + ".";
      if (planned) { ev.planned = true; todo.push(ev.title + (ev.txt ? ": " + ev.txt : "")); }
      const pri = codeOf(e.priority);
      if (!planned && (cls === "EMER" || cls === "IMP" || pri === "UR" || pri === "EM" || dxEncounters.has(e._url))) ev.ab = true;
      G("ep").events.push(ev); pushDate(start);
    });
    byType("Procedure").forEach(p => {
      const surg = (codeOf(p.category) === "387713003");
      const d = normDate(p.performedDateTime || (p.performedPeriod && p.performedPeriod.start));
      G("ep").events.push({ d, title: txt(p.code), k: surg ? "cirurgia" : "exame", txt: (p.note && p.note[0] && p.note[0].text) || "" });
      pushDate(d);
    });
    byType("DiagnosticReport").forEach(r => {
      const d = normDate(day(r.effectiveDateTime));
      const ab = (r.conclusionCode || []).some(c => codeOf(c) === "263654008");
      G("ep").events.push(Object.assign({ d, title: txt(r.code), k: "exame", txt: r.conclusion || "" }, ab ? { ab: true } : {}));
      pushDate(d);
    });

    /* ---- Conditions -> problem chips (+ diagnosis event when there is no encounter) ---- */
    const problems = [];
    const condGroups = [];
    byType("Condition").forEach(c => {
      const active = codeOf(c.clinicalStatus) === "active";
      const sct = (c.code.coding || []).find(x => (x.system || "").includes("snomed"));
      const g = (sct && COND_GROUP[sct.code]) || "ep";
      const onset = normDate(c.onsetDateTime);
      const year = (c.onsetDateTime || "").slice(0, 4);
      if (active) { problems.push([txt(c.code) + (year ? " (desde " + year + ")" : ""), g]); condGroups.push(g); }
      if (!c.encounter && onset) {
        G("ep").events.push({ d: onset, title: (active ? "Diagnóstico: " : "") + txt(c.code), k: "nota", approx: onset.length < 10,
          txt: ((c.note && c.note[0] && c.note[0].text) || "") + (c.abatementDateTime ? " Resolvido em " + c.abatementDateTime + "." : "") });
      }
    });

    /* ---- Allergies and immunizations -> events ---- */
    byType("AllergyIntolerance").forEach(a => {
      if (codeOf(a.code) === "716186003" || !a.onsetDateTime) return;
      const react = a.reaction && a.reaction[0] && txt(a.reaction[0].manifestation && a.reaction[0].manifestation[0]);
      G("alerg").events.push({ d: normDate(a.onsetDateTime), title: "Alergia: " + txt(a.code), k: "nota", ab: a.criticality === "high",
        approx: a.onsetDateTime.length < 10, txt: [react, a.note && a.note[0] && a.note[0].text].filter(Boolean).join(". ") });
      problems.push(["Alergia: " + txt(a.code), "alerg"]);
    });
    byType("Immunization").forEach(i => {
      const d = normDate(day(i.occurrenceDateTime));
      G("vac").events.push({ d, title: txt(i.vaccineCode), k: "nota", txt: "Vacina administrada." });
    });

    /* ---- Medication -> spans ---- */
    byType("MedicationStatement").forEach(m => {
      const p = m.effectivePeriod || {};
      if (!p.start) return;
      const dose = m.dosage && m.dosage[0] && m.dosage[0].text;
      const note = m.note && m.note[0] && m.note[0].text;
      G("med").spans.push({ a: normDate(p.start), b: normDate(p.end || today), title: txt(m.medicationCodeableConcept),
        txt: [dose, note, p.end ? null : "Em curso."].filter(Boolean).join(". ") });
      pushDate(normDate(p.start));
    });

    /* ---- Observations ---- */
    const labs = {};       // key -> {n,u,lo,hi,byDate:{}, refs:{}, note}
    const series = {};     // key -> {n,u,lo,hi,pts:[],note}
    const bars = {};
    const life = [];
    byType("Observation").forEach(o => {
      const cat = ((o.category || [])[0] && codeOf(o.category[0])) || "";
      const code = codeOf(o.code);
      const name = txt(o.code);
      const note = o.note && o.note[0] && o.note[0].text;
      const q = o.valueQuantity;
      // life context: periods and milestones
      if (cat === "social-history" && !q) {
        const label = o.valueString || txt(o.valueCodeableConcept) || name;
        if (o.effectivePeriod) {
          life.push({ a: o.effectivePeriod.start, b: o.effectivePeriod.end || today, title: o.valueCodeableConcept ? name + ": " + label : label, txt: note || "" });
        } else {
          const ms = code === "life-event" ? label : (isLocal(o.code) ? label : label);
          G("vida").marks.push({ d: normDate(o.effectiveDateTime), title: ms, k: "nota", txt: note || (code === "life-event" ? "" : name), approx: (o.effectiveDateTime || "").length < 10 });
        }
        return;
      }
      if (!q) return;
      const [key0, grp] = CODE_MAP[code] || ["o" + String(code || name).replace(/[^a-z0-9]/gi, ""), "out"];
      const rr = (o.referenceRange || [])[0] || {};
      const lo = rr.low ? rr.low.value : null, hi = rr.high ? rr.high.value : null;
      if (cat === "laboratory") {
        const d = day(o.effectiveDateTime);
        const L = labs[key0] = labs[key0] || { grp, n: name, u: q.unit || "", byDate: {}, refs: {}, note: null };
        L.byDate[d] = q.value; L.refs[d] = [lo, hi]; if (note) L.note = note;
        pushDate(d);
      } else if (o.effectivePeriod) {
        const B = bars[key0] = bars[key0] || { grp, n: name, u: q.unit || "", pts: [], note: null, days: 0 };
        const a = o.effectivePeriod.start, b = o.effectivePeriod.end || a;
        B.days = Math.max(B.days, Math.round((D(b) - D(a)) / 864e5) + 1);
        B.pts.push([a.length === 10 && a.endsWith("-01") && B.days < 40 ? a.slice(0, 7) : a, q.value]);
        if (note) B.note = note;
      } else {
        const d = normDate(o.effectiveDateTime);
        const S = series[key0] = series[key0] || { grp, n: name, u: q.unit || "", lo, hi, pts: [], note: null, device: null };
        S.pts.push([d, q.value]);
        if (note) S.note = note;
        if (o.device && o.device.display) S.device = o.device.display;
        pushDate(d);
      }
    });

    // labs -> columns (one value per collection date), reference range overrides per collection
    const labDates = [...new Set(Object.values(labs).flatMap(L => Object.keys(L.byDate)))].sort();
    const analytes = {};
    const mode = arr => { const c = {}; arr.forEach(x => { const k = JSON.stringify(x); c[k] = (c[k] || 0) + 1; }); return JSON.parse(Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]); };
    for (const [k, L] of Object.entries(labs)) {
      const [lo, hi] = mode(Object.values(L.refs));
      const a = { n: L.n, u: L.u, v: labDates.map(d => (d in L.byDate ? L.byDate[d] : null)) };
      if (lo != null) a.lo = lo; if (hi != null) a.hi = hi;
      const r = {};
      labDates.forEach((d, i) => { const ref = L.refs[d]; if (ref && (ref[0] !== lo || ref[1] !== hi)) { r[i] = {}; if (ref[0] != null) r[i].lo = ref[0]; if (ref[1] != null) r[i].hi = ref[1]; } });
      if (Object.keys(r).length) { a.r = r; a.note = (L.note ? L.note + " " : "") + "Algumas colheitas têm referência própria (ex.: gravidez)."; }
      else if (L.note) a.note = L.note;
      analytes[k] = a;
      G(L.grp).series.push(k);
    }
    // series: gapDays from the typical interval, so sparse data does not draw misleading lines
    const seriesOut = {};
    for (const [k, S] of Object.entries(series)) {
      S.pts.sort((a, b) => D(a[0]) - D(b[0]));
      const gaps = S.pts.slice(1).map((p, i) => (D(p[0]) - D(S.pts[i][0])) / 864e5).sort((a, b) => a - b);
      const med = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 365;
      const o = { n: S.n, u: S.u + (S.device ? " · " + S.device : ""), pts: S.pts, gapDays: Math.max(130, Math.round(med * 2.6)) };
      if (S.lo != null) o.lo = S.lo; if (S.hi != null) o.hi = S.hi; if (S.note) o.note = S.note;
      seriesOut[k] = o;
      G(S.grp).series.push(k);
    }
    const barsOut = {};
    for (const [k, B] of Object.entries(bars)) {
      B.pts.sort((a, b) => D(a[0]) - D(b[0]));
      const mx = Math.max(...B.pts.map(p => p[1]));
      const max = Math.ceil(mx * 1.15) || 1;
      const step = max <= 5 ? 1 : max <= 12 ? 2 : Math.ceil(max / 4);
      const grid = []; for (let g = step; g < max; g += step) grid.push(g);
      barsOut[k] = { n: B.n, u: B.u, periodDays: B.days, max, gridlines: grid.slice(0, 4), pts: B.pts };
      if (B.note) barsOut[k].note = B.note;
      G(B.grp).bars.push(k);
    }

    /* ---- FIB-4 when AST, ALT and platelets exist ---- */
    const derived = (analytes.ast && analytes.alt && analytes.plq && birth) ? { fib4: true } : {};
    if (derived.fib4) G("fig").series.push("fib4");

    /* ---- Assemble groups ---- */
    const groups = [];
    for (const [id, gname, color, sub] of GROUPS) {
      const g = rows[id];
      const isVida = id === "vida";
      if (!g && !(isVida && life.length)) continue;
      const out = { id, name: gname, color, rows: [] };
      if (sub) out.sub = sub;
      if (isVida && life.length) out.rows.push({ type: "life", name: "Períodos" });
      if (g) {
        if (g.marks.length) out.rows.push({ type: "events", name: "Marcos e hábitos", events: g.marks });
        if (g.events.length) {
          g.events.sort((a, b) => D(a.d) - D(b.d));
          const rowName = { ep: "Consultas, urgências, internamentos e exames", alerg: "Alergias registadas", vac: "Vacinas administradas" }[id] || "Eventos";
          out.rows.push({ type: "events", name: rowName, events: g.events });
        }
        if (id === "ep" && labDates.length) out.rows.push({ type: "collections", name: "Colheitas de análises" });
        if (g.spans.length) { g.spans.sort((a, b) => D(a.a) - D(b.a)); out.rows.push({ type: "spans", name: "Tratamentos", spans: g.spans }); }
        g.series.forEach(k => out.rows.push({ type: "series", k }));
        g.bars.forEach(k => out.rows.push({ type: "bars", k, name: barsOut[k].n }));
      }
      if (out.rows.length) groups.push(out);
    }
    const gids = new Set(groups.map(g => g.id));

    /* ---- Chips: active problems + latest out-of-range values ---- */
    const chips = problems.filter(p => gids.has(p[1]) || (p[1] = "ep"));
    const flags = [];
    const lastOut = (k, n, u, pts, lo, hi) => {
      const last = pts[pts.length - 1]; if (!last) return;
      const [d, v] = last; if (D(d) < D(addMonths(today, -18))) return;
      if ((hi != null && v > hi) || (lo != null && v < lo)) flags.push([`${n} ${numPT(v)} ${u.split(" · ")[0]} (${monthPT(d)})`, k]);
    };
    for (const [k, a] of Object.entries(analytes)) {
      const i = a.v.map((v, j) => (v == null ? -1 : j)).filter(j => j >= 0).pop();
      if (i == null) continue;
      const ref = (a.r && a.r[i]) || a;
      lastOut(labs[k].grp, a.n, a.u, [[labDates[i], a.v[i]]], ref.lo, ref.hi);
    }
    for (const [k, s] of Object.entries(seriesOut)) lastOut(series[k].grp, s.n.replace(/ \(.*\)$/, ""), s.u, s.pts, s.lo, s.hi);
    flags.slice(0, 3).forEach(f => chips.push(["Fora da referência: " + f[0], f[1]]));

    const rowsIn = id => (groups.find(g => g.id === id) || { rows: [] }).rows.length;
    const open = ["ep", ...[...new Set(condGroups.filter(g => gids.has(g) && g !== "ep"))].sort((a, b) => rowsIn(b) - rowsIn(a))].slice(0, 3);

    /* ---- Meta ---- */
    // range: from the first encounter, collection, medication or measurement (old diagnosis dates alone do not stretch the view)
    const allDates = dates.concat(life.map(l => l.a)).filter(Boolean).map(s => normDate(s)).sort();
    const from = addMonths(allDates[0] || today, -6), to = addMonths(today, 8);
    const sexo = pat.gender === "female" ? (age < 18 ? "menina" : "mulher") : (age < 18 ? "menino" : "homem");
    const counts = {};
    R.forEach(r => (counts[r.resourceType] = (counts[r.resourceType] || 0) + 1));
    return {
      meta: {
        title: name + ", linha do tempo de saúde",
        subtitle: (fict ? "Caso fictício: " : "") + `${sexo} de ${age} anos. Timeline gerada automaticamente a partir do IPS (HL7 FHIR R4) de ${new Date(today + "T12:00:00").toLocaleDateString("pt-PT")}, com ${R.length} recursos.`,
        birth, today, range: { from, to }, fictitious: fict,
        sources: [
          "International Patient Summary (HL7 FHIR R4): " + Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${n} ${t}`).join(", ") + ".",
          fict ? "Dados gerados para demonstração e formação. Não correspondem a nenhuma pessoa real." : null,
        ].filter(Boolean),
        todo,
        notes: ["Os grupos, as séries e os destaques foram construídos por regras a partir dos códigos LOINC, SNOMED CT e das categorias FHIR. Coincidências temporais não implicam causa."],
      },
      labs: { dates: labDates, analytes },
      series: seriesOut,
      bars: barsOut,
      derived,
      life,
      groups,
      problems: chips.slice(0, 9),
      open,
    };
  }

  global.ips2timeline = convert;
  if (typeof module !== "undefined") module.exports = convert;
})(typeof window !== "undefined" ? window : globalThis);
