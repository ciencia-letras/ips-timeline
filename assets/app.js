/* Shared helpers: language (EN first, PT), icons, escaping. */
(function (g) {
  "use strict";
  const T = {
    en: {
      brand: "Virtual patients · IPS → timeline",
      eyebrow: "Advanced GenAI for health professionals · course resource",
      h1: "From an International Patient Summary to an interactive health timeline",
      lead: "Each virtual patient is stored as an HL7 FHIR International Patient Summary (IPS). This page reads the IPS, shows it in human-readable form and turns it, by rules, into an interactive timeline. It is an example of what participants learn to build with generative AI in the advanced course.",
      s1: "IPS (FHIR R4)", s1d: "One JSON document per patient",
      s2: "Converter", s2d: "Rules based on LOINC, SNOMED CT, ATC",
      s3: "Timeline", s3d: "Zoom, areas, reference ranges",
      choose: "Choose a virtual patient",
      open: "Timeline", summary: "Patient summary", download: "Download IPS",
      years: "years", female: "female", male: "male",
      learnH: "What participants practise",
      l1: "Read a FHIR standard", l1d: "Find their way around an IPS Bundle: Composition, sections, coded resources.",
      l2: "Generate realistic synthetic data", l2d: "Create coherent clinical cases with an AI assistant, without real patient data.",
      l3: "Write a converter with AI help", l3d: "Turn a clinical standard into a data model for visualisation, with explicit, auditable rules.",
      l4: "Ship a small web tool", l4d: "Publish a static site on GitHub Pages, with no server and no patient data leaving the browser.",
      foot1: "All patients are fictitious. Data generated for teaching; not validated against the official IPS validator. Not for clinical use.",
      foot2: "Timeline engine originally built for the author's own health timeline.",
      back: "All patients",
      tTimeline: "Timeline", tSummary: "Patient summary (IPS)", tJson: "FHIR JSON", tHow: "How it is built",
      fict: "Fictitious data",
      loading: "Loading…", err: "Could not load the IPS.",
      copy: "Copy", copied: "Copied", showIps: "IPS (input)", showTl: "Timeline data (output)",
      jsonNote: "Raw IPS as downloaded, or the timeline data the converter produced from it.",
    },
    pt: {
      brand: "Pacientes virtuais · IPS → timeline",
      eyebrow: "GenAI avançado para profissionais de saúde · recurso do curso",
      h1: "De um resumo do paciente (IPS) a uma linha do tempo de saúde interativa",
      lead: "Cada paciente virtual está guardado como um International Patient Summary (IPS) em HL7 FHIR. Esta página lê o IPS, mostra-o em formato legível e transforma-o, por regras, numa timeline interativa. É um exemplo do que os formandos aprendem a criar com IA generativa no curso avançado.",
      s1: "IPS (FHIR R4)", s1d: "Um documento JSON por paciente",
      s2: "Conversor", s2d: "Regras com LOINC, SNOMED CT, ATC",
      s3: "Timeline", s3d: "Zoom, áreas, valores de referência",
      choose: "Escolha um paciente virtual",
      open: "Timeline", summary: "Resumo do paciente", download: "Descarregar IPS",
      years: "anos", female: "sexo feminino", male: "sexo masculino",
      learnH: "O que os formandos praticam",
      l1: "Ler uma norma FHIR", l1d: "Orientar-se num Bundle IPS: Composition, secções, recursos codificados.",
      l2: "Gerar dados sintéticos realistas", l2d: "Criar casos clínicos coerentes com um assistente de IA, sem dados de doentes reais.",
      l3: "Escrever um conversor com ajuda da IA", l3d: "Transformar uma norma clínica num modelo de dados para visualização, com regras explícitas e auditáveis.",
      l4: "Publicar uma pequena ferramenta web", l4d: "Um site estático no GitHub Pages, sem servidor e sem dados a sair do browser.",
      foot1: "Todos os pacientes são fictícios. Dados gerados para formação; não validados com o validador oficial do IPS. Não usar em contexto clínico.",
      foot2: "Motor da timeline criado originalmente para a timeline de saúde do autor.",
      back: "Todos os pacientes",
      tTimeline: "Timeline", tSummary: "Resumo do paciente (IPS)", tJson: "JSON FHIR", tHow: "Como é construída",
      fict: "Dados fictícios",
      loading: "A carregar…", err: "Não foi possível carregar o IPS.",
      copy: "Copiar", copied: "Copiado", showIps: "IPS (entrada)", showTl: "Dados da timeline (saída)",
      jsonNote: "O IPS tal como é descarregado, ou os dados que o conversor produziu a partir dele.",
    },
  };
  let lang = "en";
  try { const s = localStorage.getItem("ipsLang"); if (s === "pt" || s === "en") lang = s; } catch (e) {}
  const q = new URLSearchParams(location.search).get("lang");
  if (q === "pt" || q === "en") lang = q;

  const I = {
    back: '<svg class="i" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
    dl: '<svg class="i" viewBox="0 0 24 24"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v3h16v-3"/></svg>',
    tl: '<svg class="i" viewBox="0 0 24 24"><path d="M3 12h18M7 8v8M12 5v14M17 9v6"/></svg>',
    doc: '<svg class="i" viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6"/></svg>',
    copy: '<svg class="i" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>',
  };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function apply() {
    document.documentElement.lang = lang === "pt" ? "pt-PT" : "en";
    document.querySelectorAll("[data-t]").forEach(n => { const k = n.dataset.t; if (T[lang][k] != null) n.textContent = T[lang][k]; });
    document.querySelectorAll(".lang button[data-lang], .cel-lang button[data-lang]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
  }
  function setLang(l) { lang = l; try { localStorage.setItem("ipsLang", l); } catch (e) {} apply(); document.dispatchEvent(new CustomEvent("langchange")); }
  document.addEventListener("click", e => { const b = e.target.closest(".lang button[data-lang], .cel-lang button[data-lang]"); if (b) setLang(b.dataset.lang); });

  g.APP = { t: k => T[lang][k] || k, lang: () => lang, apply, esc, I };
  document.addEventListener("DOMContentLoaded", apply);
})(window);
