# Virtual patients · IPS → timeline

**[English](#english)** · **[Português](#português)**

Live: **https://ricardojccorreia.github.io/ips-timeline/**

---

## English

Five fictitious patients, each stored as an **HL7 FHIR R4 International Patient Summary (IPS)**. For each patient you can:

- **download** the IPS (`patients/<id>/ips.json`);
- read it as a **human-readable summary**, built from the coded resources;
- explore an **interactive health timeline** generated from the IPS, in the browser, by explicit rules.

It is a resource of the course *Advanced GenAI for Health Professionals* (Ciência e Letras): an example of what participants learn to build with an AI assistant — synthetic clinical data in a standard format, a converter, and a small web tool.

| Patient | Case |
|---|---|
| Matilde Sá, 6 | Asthma, exacerbations during heat waves, connected inhaler |
| Ana Lopes, 58 | Type 2 diabetes, hypertension, smartwatch walking programme |
| Joaquim Ferreira, 79 | Heart failure, atrial fibrillation, CKD, home telemonitoring |
| Sofia Martins, 34 | Hypothyroidism, pregnancy with gestational diabetes, caesarean section |
| Rui Carvalho, 47 | Obesity, fatty liver (FIB-4), prediabetes, sleep apnoea, CPAP |

### How it works

```
tools/patients/*.py  ──build_ips.py──▶  patients/<id>/ips.json  ──ips2timeline.js──▶  timeline engine
 (clinical case)                         (FHIR IPS Bundle)          (rules, in the browser)
```

- `tools/build_ips.py` builds each IPS Bundle: `Composition` with IPS sections, `Patient`, `Condition`, `AllergyIntolerance`, `MedicationStatement`, `Immunization`, `Procedure`, `DiagnosticReport`, `Observation`, plus `Encounter` in an extra “History of encounters” section (LOINC 46240-8).
- `assets/ips2timeline.js` converts any IPS into timeline data. It uses only the resources: LOINC and SNOMED CT codes pick the area, `referenceRange` gives the green band (per collection, e.g. pregnancy), `effectivePeriod` turns an observation into bars, AST + ALT + platelets give FIB-4.
- `assets/timeline-engine.html` is the timeline engine (unchanged), loaded in an iframe with the converted data.
- `assets/ips-viewer.js` renders the human-readable summary.

To add a patient, copy a file in `tools/patients/`, edit it and run:

```bash
python3 tools/build_ips.py
python3 -m http.server 8000
```

### Limits

All data are fictitious. The bundles follow the IPS structure but were **not** checked with the official IPS validator; some measures use a local code system where no standard code was certain. The timeline text is in Portuguese, like the patients. Not for clinical use.

Code: MIT. Patient data: CC BY 4.0.

---

## Português

Cinco pacientes fictícios, cada um guardado como um **International Patient Summary (IPS) em HL7 FHIR R4**. Para cada paciente é possível:

- **descarregar** o IPS (`patients/<id>/ips.json`);
- lê-lo como **resumo legível**, construído a partir dos recursos codificados;
- explorar uma **linha do tempo de saúde interativa**, gerada a partir do IPS, no browser, por regras explícitas.

É um recurso do curso *GenAI para Profissionais de Saúde — Avançado* (Ciência e Letras): um exemplo do que os formandos aprendem a criar com um assistente de IA — dados clínicos sintéticos numa norma, um conversor e uma pequena ferramenta web.

| Paciente | Caso |
|---|---|
| Matilde Sá, 6 anos | Asma, exacerbações em ondas de calor, inalador conectado |
| Ana Lopes, 58 anos | Diabetes tipo 2, hipertensão, caminhada registada no relógio |
| Joaquim Ferreira, 79 anos | Insuficiência cardíaca, fibrilhação auricular, DRC, telemonitorização |
| Sofia Martins, 34 anos | Hipotiroidismo, gravidez com diabetes gestacional, cesariana |
| Rui Carvalho, 47 anos | Obesidade, esteatose hepática (FIB-4), pré-diabetes, apneia do sono, CPAP |

### Como funciona

- `tools/build_ips.py` constrói cada Bundle IPS a partir da definição do caso em `tools/patients/`.
- `assets/ips2timeline.js` converte qualquer IPS em dados para a timeline, só com os recursos: os códigos LOINC e SNOMED CT escolhem a área, o `referenceRange` dá a faixa verde (por colheita, por exemplo na gravidez), o `effectivePeriod` transforma uma observação em barras, AST + ALT + plaquetas dão o FIB-4.
- `assets/timeline-engine.html` é o motor da timeline (sem alterações), carregado num iframe com os dados convertidos.
- `assets/ips-viewer.js` desenha o resumo legível.

Para acrescentar um paciente, copiar um ficheiro de `tools/patients/`, editá-lo e correr `python3 tools/build_ips.py`.

### Limites

Todos os dados são fictícios. Os bundles seguem a estrutura do IPS mas **não** foram verificados com o validador oficial; algumas medições usam um sistema de códigos local quando não havia um código normalizado seguro. Não usar em contexto clínico.

Código: MIT. Dados dos pacientes: CC BY 4.0.
