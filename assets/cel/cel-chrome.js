/* Ciência e Letras chrome for lab tools: header with "back to the lab" + copyright/citation sidebar.
 * Reads window.CEL_TOOL (assets/cel/tool.js). Follows <html lang>: "pt…" → Portuguese, otherwise English.
 * If the page has no language handler of its own (window.APP), the EN/PT buttons set <html lang> directly. */
(function () {
  "use strict";
  const C = window.CEL_TOOL;
  if (!C) return;
  const base = (document.currentScript && document.currentScript.src.replace(/cel-chrome\.js.*$/, "")) || "assets/cel/";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const T = {
    en: {
      lab: "Ciência e Letras · Research & Innovation", back: "Back to the lab", labShort: "Lab",
      side: "Use and citation", hide: "Hide panel", show: "Show panel", rail: "Cite · Licence",
      authorL: "Author", authorsL: "Authors", cTitle: "Copyright", lTitle: "Free to use, with attribution",
      lText: "Any institution may use, adapt and share this tool, including in teaching and training, as long as it cites it as shown below.",
      code: "Code", content: "Content and fictitious data",
      howTitle: "How to cite", copy: "Copy", copied: "Copied",
      doiTitle: "Persistent identifier", doiPending: "DOI on Zenodo: being prepared. Until then, cite the URL.",
      linksTitle: "Links", src: "Source code (GitHub)", cff: "Citation file (CITATION.cff)", lic: "Licence", labLink: "All lab resources",
      note: "Made for the course", disclaimer: "Fictitious data, for teaching. Not for clinical use.",
      computer: "Computer software", accessed: "cited", available: "Available from",
    },
    pt: {
      lab: "Ciência e Letras · Investigação e Inovação", back: "Voltar ao laboratório", labShort: "Laboratório",
      side: "Utilização e citação", hide: "Esconder painel", show: "Mostrar painel", rail: "Citar · Licença",
      authorL: "Autor", authorsL: "Autores", cTitle: "Direitos de autor", lTitle: "Uso livre, com referência",
      lText: "Qualquer instituição pode usar, adaptar e partilhar esta ferramenta, incluindo em ensino e formação, desde que a cite como indicado abaixo.",
      code: "Código", content: "Conteúdos e dados fictícios",
      howTitle: "Como citar", copy: "Copiar", copied: "Copiado",
      doiTitle: "Identificador persistente", doiPending: "DOI no Zenodo: em preparação. Até lá, cite o URL.",
      linksTitle: "Ligações", src: "Código-fonte (GitHub)", cff: "Ficheiro de citação (CITATION.cff)", lic: "Licença", labLink: "Todos os recursos do laboratório",
      note: "Criado para o curso", disclaimer: "Dados fictícios, para formação. Não usar em contexto clínico.",
      computer: "Software", accessed: "citado em", available: "Disponível em",
    },
  };
  const IC = {
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>',
    gh: '<svg viewBox="0 0 24 24" aria-hidden="true" class="fill"><path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.4-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.4 1.1 2.9.8.1-.6.4-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9V21c0 .3.2.6.7.5A10 10 0 0 0 12 2Z"/></svg>',
    lab: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.5 14h9"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>',
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>',
    file: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/></svg>',
  };
  const lang = () => ((document.documentElement.lang || "en").toLowerCase().startsWith("pt") ? "pt" : "en");
  let fmt = "apa";
  try { fmt = localStorage.getItem("celCiteFmt") || "apa"; } catch (e) {}

  function cite(f, L) {
    const t = T[L], a = C.authors, title = C.title.en;
    const link = C.doi ? "https://doi.org/" + C.doi : C.url;
    const today = new Date();
    if (f === "apa") {
      const names = a.map(x => `${x.family}, ${x.given.split(/\s+/).map(g => g[0] + ".").join(" ")}`).join(", ");
      return `${names} (${C.year}). ${title} (Version ${C.version}) [${T.en.computer}]. ${C.publisher}. ${link}`;
    }
    if (f === "vancouver") {
      const names = a.map(x => `${x.family} ${x.given.split(/\s+/).map(g => g[0]).join("")}`).join(", ");
      const d = today.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "2-digit" }).replace(/(\d+) (\w+) (\d+)/, "$3 $2 $1");
      return `${names}. ${title} [Internet]. Version ${C.version}. ${C.place}: ${C.publisher}; ${C.year} [cited ${d}]. Available from: ${C.url}` + (C.doi ? `. doi:${C.doi}` : "");
    }
    const key = (a[0].family + "_" + C.year + "_" + C.repo.split("/").pop()).toLowerCase().replace(/[^a-z0-9_]/g, "_");
    return `@software{${key},\n  author    = {${a.map(x => x.family + ", " + x.given).join(" and ")}},\n  title     = {${title}},\n  year      = {${C.year}},\n  version   = {${C.version}},\n  publisher = {${C.publisher}},\n  url       = {${C.url}}` + (C.doi ? `,\n  doi       = {${C.doi}}` : "") + "\n}";
  }

  function header() {
    const L = lang(), t = T[L], el = document.getElementById("cel-header");
    if (!el) return;
    el.innerHTML = `<div class="cel-chrome cel-topbar"><div class="cel-wrap">
        <a href="${esc(C.lab[L])}">${IC.lab}<span>${esc(t.lab)}</span></a>
        <a class="cel-hide-sm" href="${esc(C.home)}"><span>${esc(C.short[L])}</span></a>
        <a href="${esc(C.repo)}" class="cel-gh" aria-label="GitHub">${IC.gh}</a></div></div>
      <div class="cel-chrome cel-header"><div class="cel-wrap">
        <a class="cel-brand" href="${esc(C.lab[L])}" aria-label="${esc(t.back)}">
          <img class="cel-logo-h" src="${base}cel-logo-cores-horizontal.svg" alt="Ciência e Letras" width="143" height="38">
          <img class="cel-logo-i" src="${base}cel-logo-cores-icon.svg" alt="" width="34" height="34" style="display:none">
        </a>
        <a class="cel-brand" href="${esc(C.home)}"><span class="cel-sep"></span><span class="cel-tool"><small>${esc(t.labShort)}</small>${esc(C.short[L])}</span></a>
        <div class="cel-nav">
          <div class="cel-lang" role="group" aria-label="Language"><button data-lang="en" aria-pressed="${L === "en"}">EN</button><button data-lang="pt" aria-pressed="${L === "pt"}">PT</button></div>
          <a class="cel-back" href="${esc(C.lab[L])}" aria-label="${esc(t.back)}">${IC.back}<span>${esc(t.back)}</span></a>
        </div></div></div>`;
  }

  function aside() {
    const L = lang(), t = T[L], el = document.getElementById("cel-aside");
    if (!el) return;
    const authors = C.authors.map(a => `${esc(a.given)} ${esc(a.family)}` + (a.orcid ? ` <a class="cel-orcid" href="https://orcid.org/${esc(a.orcid)}" title="ORCID ${esc(a.orcid)}" aria-label="ORCID ${esc(a.orcid)}">iD</a>` : "")).join(", ");
    el.classList.add("cel-chrome", "cel-aside");
    el.setAttribute("aria-label", t.side);
    el.innerHTML = `<div class="cel-aside-head"><span>${esc(t.side)}</span>
        <button class="cel-toggle" type="button" data-cel-toggle aria-label="${esc(t.hide)}" title="${esc(t.hide)}">${IC.right}</button>
        <button class="cel-rail" type="button" data-cel-toggle>${esc(t.rail)}</button></div>
      <div class="cel-aside-in">
        <h2>${esc(t.cTitle)}</h2>
        <p>© ${C.year} ${esc(C.copyright || C.publisher)}<br>${esc(C.authors.length > 1 ? t.authorsL : t.authorL)}: ${authors}</p>
        <h2>${esc(t.lTitle)}</h2>
        <p>${esc(t.lText)}</p>
        <p><span class="cel-pill">${esc(t.code)}: ${esc(C.licences.code)}</span><span class="cel-pill">${esc(t.content)}: ${esc(C.licences.content)}</span></p>
        <h2>${esc(t.howTitle)}</h2>
        <div class="cel-fmt" role="group" aria-label="${esc(t.howTitle)}">
          <button data-fmt="apa" aria-pressed="${fmt === "apa"}">APA</button><button data-fmt="vancouver" aria-pressed="${fmt === "vancouver"}">Vancouver</button><button data-fmt="bibtex" aria-pressed="${fmt === "bibtex"}">BibTeX</button></div>
        <div class="cel-cite${fmt === "bibtex" ? " mono" : ""}" id="cel-cite">${esc(cite(fmt, L))}</div>
        <button class="cel-copy" type="button" data-cel-copy>${IC.copy}<span>${esc(t.copy)}</span></button>
        <h2>${esc(t.doiTitle)}</h2>
        <p>${C.doi ? `<a class="cel-doi" href="https://doi.org/${esc(C.doi)}"><b>DOI</b><span>${esc(C.doi)}</span></a>` : esc(t.doiPending)}</p>
        <h2>${esc(t.linksTitle)}</h2>
        <ul class="cel-links">
          <li><a href="${esc(C.repo)}">${IC.gh}${esc(t.src)}</a></li>
          <li><a href="${esc(C.repo)}/blob/main/CITATION.cff">${IC.file}${esc(t.cff)}</a></li>
          <li><a href="${esc(C.repo)}/blob/main/LICENSE">${IC.file}${esc(t.lic)}</a></li>
          <li><a href="${esc(C.lab[L])}">${IC.lab}${esc(t.labLink)}</a></li>
        </ul>
        <p class="cel-note">${esc(t.note)} <em>${esc(C.course[L])}</em> · v${esc(C.version)}<br>${esc(t.disclaimer)}</p>
      </div>`;
  }

  function collapsed(v) {
    const lay = document.querySelector(".cel-layout");
    if (!lay) return;
    if (v === undefined) { try { v = localStorage.getItem("celAside") === "closed"; } catch (e) { v = false; } }
    lay.classList.toggle("cel-collapsed", v);
    try { localStorage.setItem("celAside", v ? "closed" : "open"); } catch (e) {}
    const b = document.querySelector(".cel-toggle");
    if (b) { const t = T[lang()]; b.innerHTML = v ? IC.left : IC.right; b.title = b.ariaLabel = v ? t.show : t.hide; }
    window.dispatchEvent(new Event("resize"));
  }

  document.addEventListener("click", async e => {
    const lb = e.target.closest(".cel-lang button");
    if (lb && !window.APP) { document.documentElement.lang = lb.dataset.lang === "pt" ? "pt-PT" : "en"; try { localStorage.setItem("celLang", lb.dataset.lang); } catch (_) {} }
    if (e.target.closest("[data-cel-toggle]")) collapsed(!document.querySelector(".cel-layout").classList.contains("cel-collapsed"));
    const fb = e.target.closest("[data-fmt]");
    if (fb) { fmt = fb.dataset.fmt; try { localStorage.setItem("celCiteFmt", fmt); } catch (_) {} aside(); }
    const cb = e.target.closest("[data-cel-copy]");
    if (cb) { try { await navigator.clipboard.writeText(cite(fmt, lang())); cb.querySelector("span").textContent = T[lang()].copied; } catch (_) {} }
  });

  function renderAll() { header(); aside(); collapsed(); }
  new MutationObserver(renderAll).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  if (!window.APP) { try { const s = localStorage.getItem("celLang"); if (s) document.documentElement.lang = s === "pt" ? "pt-PT" : "en"; } catch (e) {} }
  renderAll();
})();
