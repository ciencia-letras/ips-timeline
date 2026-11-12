#!/usr/bin/env python3
"""Build one HL7 FHIR R4 International Patient Summary (IPS) bundle per virtual patient.

Gera um IPS (HL7 FHIR R4) por paciente virtual a partir das definicoes em tools/patients/*.py.

Usage / Uso:
    python tools/build_ips.py            # all patients / todos os pacientes
    python tools/build_ips.py matilde_sa # just one / apenas um

Output / Saida:
    patients/<id>/ips.json
    patients/index.json   (list shown on the home page / lista mostrada na pagina inicial)

The bundles are synthetic, for teaching. They follow the IPS structure (Composition + sections)
but were not run through the official IPS validator.
"""
import importlib.util, json, os, sys, uuid
from datetime import date, timedelta
from html import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDIR = os.path.join(ROOT, "tools", "patients")
OUT = os.path.join(ROOT, "patients")

BASE = "https://ciencia-letras.github.io/ips-timeline"
SYS = {
    "loinc": "http://loinc.org",
    "sct": "http://snomed.info/sct",
    "atc": "http://www.whocc.no/atc",
    "icpc2": "http://hl7.org/fhir/sid/icpc-2",
    "local": BASE + "/CodeSystem/virtual-patient-measures",
    "ucum": "http://unitsofmeasure.org",
}
IPS = "http://hl7.org/fhir/uv/ips/StructureDefinition/"
OBS_CAT = "http://terminology.hl7.org/CodeSystem/observation-category"

# IPS section codes (LOINC). "encounters" is an extra, open-slice section used by the timeline.
SECTIONS = [
    ("problems", "11450-4", "Problem list - Reported", "Problemas ativos"),
    ("allergies", "48765-2", "Allergies and adverse reactions Document", "Alergias e intolerâncias"),
    ("meds", "10160-0", "History of Medication use Narrative", "Medicação"),
    ("immunizations", "11369-6", "History of Immunization Narrative", "Vacinação"),
    ("past", "11348-0", "History of Past illness Narrative", "Doenças anteriores"),
    ("procedures", "47519-4", "History of Procedures Document", "Procedimentos"),
    ("results", "30954-2", "Relevant diagnostic tests/laboratory data Narrative", "Resultados"),
    ("vitals", "8716-3", "Vital signs", "Sinais vitais"),
    ("pregnancy", "10162-6", "History of pregnancies Narrative", "Gravidez"),
    ("social", "29762-2", "Social history Narrative", "Hábitos e contexto de vida"),
    ("encounters", "46240-8", "History of Hospitalizations+Outpatient visits Narrative", "Episódios de cuidados"),
    ("plan", "18776-5", "Plan of care note", "Plano de cuidados"),
]
CLS = {
    "AMB": ("ambulatory", "Consulta"), "EMER": ("emergency", "Urgência"),
    "IMP": ("inpatient encounter", "Internamento"), "VR": ("virtual", "Contacto à distância"),
}


def cc(codes, text):
    o = {}
    if codes:
        o["coding"] = [{"system": SYS[s], "code": c, "display": d} for s, c, d in codes]
    o["text"] = text
    return o


def end_of_month(ym):
    y, m = map(int, ym.split("-")[:2])
    nxt = date(y + (m == 12), m % 12 + 1, 1)
    return (nxt - timedelta(days=1)).isoformat()


def period_end(start, days):
    if len(start) == 7 and days in (30, 31):
        return end_of_month(start)
    s = start if len(start) == 10 else start + "-01"
    return (date.fromisoformat(s) + timedelta(days=days - 1)).isoformat()


def qty(v, unit, ucum):
    q = {"value": v, "unit": unit}
    if ucum:
        q.update(system=SYS["ucum"], code=ucum)
    return q


def rrange(lo, hi, unit, ucum):
    r = {}
    if lo is not None:
        r["low"] = qty(lo, unit, ucum)
    if hi is not None:
        r["high"] = qty(hi, unit, ucum)
    return [r] if r else None


def interp(v, lo, hi):
    if hi is not None and v > hi:
        return "H", "High"
    if lo is not None and v < lo:
        return "L", "Low"
    return "N", "Normal"


def table(head, rows):
    h = "".join(f"<th>{escape(x)}</th>" for x in head)
    b = "".join("<tr>" + "".join(f"<td>{escape(str(c if c is not None else ''))}</td>" for c in r) + "</tr>" for r in rows)
    return f'<div xmlns="http://www.w3.org/1999/xhtml"><table><thead><tr>{h}</tr></thead><tbody>{b}</tbody></table></div>'


def build(P):
    ns = uuid.uuid5(uuid.NAMESPACE_URL, BASE + "/" + P["id"])
    entries, sec = [], {k: [] for k, *_ in SECTIONS}
    narr = {k: [] for k, *_ in SECTIONS}
    today = P["today"]

    def add(res, section=None, row=None):
        local = res.pop("_local", None) or f"{res['resourceType']}-{len(entries)}"
        full = "urn:uuid:" + str(uuid.uuid5(ns, local))
        res["id"] = full.split(":")[-1]
        entries.append({"fullUrl": full, "resource": res})
        if section:
            sec[section].append({"reference": full})
            if row:
                narr[section].append(row)
        return full

    patient_ref = "urn:uuid:" + str(uuid.uuid5(ns, "patient"))
    subj = {"reference": patient_ref}

    # --- Patient, author ---
    patient = {
        "resourceType": "Patient", "_local": "patient",
        "meta": {"profile": [IPS + "Patient-uv-ips"]},
        "identifier": [{"system": BASE + "/NamingSystem/virtual-patient", "value": P["id"]}],
        "name": [{"family": P["family"], "given": [P["given"]], "text": f"{P['given']} {P['family']}"}],
        "gender": P["gender"], "birthDate": P["birth"],
        "address": [{"city": P["city"], "country": "PT"}],
        "communication": [{"language": cc([], "Português"), "preferred": True}],
    }
    org = {"resourceType": "Organization", "_local": "org", "name": P["org"]}
    prac = {"resourceType": "Practitioner", "_local": "prac", "name": [{"text": P["gp"]}]}
    entries_head = []
    for r in (patient, org, prac):
        full = add(r)
        entries_head.append(full)
    org_ref, prac_ref = {"reference": entries_head[1]}, {"reference": entries_head[2]}

    # --- Encounters (needed before conditions reference them) ---
    enc_ref = {}
    for e in P.get("encounters", []):
        planned = e.get("planned", False)
        code, label = CLS[e["cls"]]
        res = {
            "resourceType": "Encounter", "_local": "enc-" + e["d"] + e["title"],
            "status": "planned" if planned else "finished",
            "class": {"system": "http://terminology.hl7.org/CodeSystem/v3-ActCode", "code": e["cls"], "display": code},
            "type": [cc([], e["title"])],
            "subject": subj,
            "period": {"start": e["d"], **({"end": e["end"]} if e.get("end") else {})},
            "reasonCode": [cc([], e["txt"])] if e.get("txt") else None,
            "serviceProvider": org_ref,
        }
        if e.get("ab") and e["cls"] == "AMB":
            res["priority"] = {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/v3-ActPriority", "code": "UR", "display": "urgent"}],
                               "text": "Requires clinical attention"}
        res = {k: v for k, v in res.items() if v is not None}
        row = (e["d"] + (" → " + e["end"] if e.get("end") else ""), label, e["title"], e.get("txt", ""))
        ref = add(res, "plan" if planned else "encounters", row)
        if e.get("id"):
            enc_ref[e["id"]] = ref

    # --- Conditions ---
    for c in P.get("conditions", []):
        active = c.get("status", "active") == "active"
        res = {
            "resourceType": "Condition", "_local": "cond-" + c["text"],
            "meta": {"profile": [IPS + "Condition-uv-ips"]},
            "clinicalStatus": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                                           "code": "active" if active else "resolved"}]},
            "verificationStatus": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/condition-ver-status", "code": "confirmed"}]},
            "category": [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/condition-category", "code": "problem-list-item"}]}],
            "code": cc(c.get("codes"), c["text"]),
            "subject": subj,
            "onsetDateTime": c["onset"],
        }
        if c.get("abatement"):
            res["abatementDateTime"] = c["abatement"]
        if c.get("enc"):
            res["encounter"] = {"reference": enc_ref[c["enc"]]}
        if c.get("note"):
            res["note"] = [{"text": c["note"]}]
        add(res, "problems" if active else "past",
            (c["text"], c["onset"], c.get("abatement", ""), c.get("note", "")))

    # --- Allergies ---
    al = P.get("allergies", [])
    if not al:
        add({"resourceType": "AllergyIntolerance", "_local": "nka", "meta": {"profile": [IPS + "AllergyIntolerance-uv-ips"]},
             "clinicalStatus": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", "code": "active"}]},
             "code": cc([("sct", "716186003", "No known allergy")], "Sem alergias conhecidas"), "patient": subj},
            "allergies", ("Sem alergias conhecidas", "", "", ""))
    for a in al:
        res = {
            "resourceType": "AllergyIntolerance", "_local": "al-" + a["text"],
            "meta": {"profile": [IPS + "AllergyIntolerance-uv-ips"]},
            "clinicalStatus": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", "code": "active"}]},
            "verificationStatus": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification", "code": "confirmed"}]},
            "type": a.get("type", "allergy"), "category": [a.get("category", "medication")],
            "criticality": a.get("criticality", "low"),
            "code": cc(a.get("codes"), a["text"]), "patient": subj,
        }
        if a.get("onset"):
            res["onsetDateTime"] = a["onset"]
        if a.get("reaction"):
            res["reaction"] = [{"manifestation": [cc([], a["reaction"])]}]
        if a.get("note"):
            res["note"] = [{"text": a["note"]}]
        add(res, "allergies", (a["text"], a.get("onset", ""), a.get("reaction", ""), a.get("criticality", "low")))

    # --- Medication ---
    for m in P.get("meds", []):
        ended = bool(m.get("end")) and m["end"] <= today
        res = {
            "resourceType": "MedicationStatement", "_local": "med-" + m["text"] + m["start"],
            "meta": {"profile": [IPS + "MedicationStatement-uv-ips"]},
            "status": "completed" if ended else "active",
            "medicationCodeableConcept": cc(m.get("codes"), m["text"]),
            "subject": subj,
            "effectivePeriod": {"start": m["start"], **({"end": m["end"]} if m.get("end") else {})},
            "dosage": [{"text": m["dose"]}] if m.get("dose") else None,
            "note": [{"text": m["note"]}] if m.get("note") else None,
        }
        res = {k: v for k, v in res.items() if v is not None}
        add(res, "meds", (m["text"], m.get("dose", ""), m["start"], m.get("end", "em curso"), m.get("note", "")))

    # --- Immunizations ---
    for d, text, *codes in P.get("immunizations", []):
        add({"resourceType": "Immunization", "_local": "imm-" + d + text, "meta": {"profile": [IPS + "Immunization-uv-ips"]},
             "status": "completed", "vaccineCode": cc(codes[0] if codes else None, text),
             "patient": subj, "occurrenceDateTime": d}, "immunizations", (d, text))

    # --- Procedures ---
    for p in P.get("procedures", []):
        surg = p.get("surgical", True)
        res = {"resourceType": "Procedure", "_local": "proc-" + p["d"] + p["title"],
               "meta": {"profile": [IPS + "Procedure-uv-ips"]}, "status": "completed",
               "category": cc([("sct", "387713003", "Surgical procedure")] if surg else [("sct", "103693007", "Diagnostic procedure")],
                              "Cirurgia" if surg else "Procedimento diagnóstico"),
               "code": cc(p.get("codes"), p["title"]), "subject": subj, "performedDateTime": p["d"]}
        if p.get("txt"):
            res["note"] = [{"text": p["txt"]}]
        add(res, "procedures", (p["d"], p["title"], p.get("txt", "")))

    # --- Diagnostic reports (imaging, function tests) ---
    for r in P.get("reports", []):
        res = {"resourceType": "DiagnosticReport", "_local": "dr-" + r["d"] + r["title"],
               "meta": {"profile": [IPS + "DiagnosticReport-uv-ips"]}, "status": "final",
               "category": [cc([], r.get("cat", "Imagem / exame"))],
               "code": cc(r.get("codes"), r["title"]), "subject": subj, "effectiveDateTime": r["d"],
               "conclusion": r["txt"]}
        if r.get("ab"):
            res["conclusionCode"] = [cc([("sct", "263654008", "Abnormal")], "Alterado")]
        add(res, "results", (r["d"], r["title"], r["txt"]))

    # --- Laboratory results (one Observation per value) ---
    L = P.get("labs")
    if L:
        for key, (s, code, name, unit, ucum, lo, hi) in L["defs"].items():
            vals = L["values"][key]
            assert len(vals) == len(L["dates"]), f"{P['id']}: {key} has {len(vals)} values for {len(L['dates'])} dates"
            for i, v in enumerate(vals):
                if v is None:
                    continue
                rlo, rhi = L.get("ranges", {}).get(key, {}).get(i, (lo, hi))
                ic, idisp = interp(v, rlo, rhi)
                res = {"resourceType": "Observation", "_local": f"lab-{key}-{i}",
                       "meta": {"profile": [IPS + "Observation-results-laboratory-uv-ips"]},
                       "status": "final",
                       "category": [{"coding": [{"system": OBS_CAT, "code": "laboratory", "display": "Laboratory"}]}],
                       "code": cc([(s, code, name)], name), "subject": subj,
                       "effectiveDateTime": L["dates"][i], "valueQuantity": qty(v, unit, ucum),
                       "interpretation": [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation", "code": ic, "display": idisp}]}],
                       "performer": [org_ref]}
                rr = rrange(rlo, rhi, unit, ucum)
                if rr:
                    res["referenceRange"] = rr
                note = L.get("notes", {}).get(key)
                if note and i == max(j for j, x in enumerate(vals) if x is not None):
                    res["note"] = [{"text": note}]
                ref = f"{rlo if rlo is not None else ''}–{rhi if rhi is not None else ''}"
                add(res, "results", (L["dates"][i], name, f"{v} {unit}", ref + (" ▲" if ic == "H" else " ▼" if ic == "L" else "")))

    # --- Other observations: vital signs, home/wearable data, scores ---
    for o in P.get("obs", []):
        cat = o["cat"]
        section = {"vital-signs": "vitals", "activity": "social", "social-history": "social"}.get(cat, "results")
        prof = IPS + ("Observation-results-uv-ips" if section == "results" else "Observation-vital-signs-uv-ips" if section == "vitals" else "Observation-uv-ips")
        for d, v in o["pts"]:
            res = {"resourceType": "Observation", "_local": f"obs-{o['key']}-{d}",
                   "meta": {"profile": [prof]}, "status": "final",
                   "category": [{"coding": [{"system": OBS_CAT, "code": cat}]}],
                   "code": cc([(o["sys"], o["code"], o["name"])], o["name"]), "subject": subj,
                   "valueQuantity": qty(v, o["unit"], o.get("ucum"))}
            if o.get("period"):
                res["effectivePeriod"] = {"start": d, "end": period_end(d, o["period"])}
            else:
                res["effectiveDateTime"] = d
            if o.get("device"):
                res["device"] = {"display": o["device"]}
            rr = rrange(o.get("lo"), o.get("hi"), o["unit"], o.get("ucum"))
            if rr:
                res["referenceRange"] = rr
            if o.get("note") and d == o["pts"][-1][0]:
                res["note"] = [{"text": o["note"]}]
            add(res, section, (d, o["name"], f"{v} {o['unit']}", o.get("device", "")))

    # --- Life context: periods and milestones (social history / pregnancy) ---
    for l in P.get("life", []):
        section = "pregnancy" if l.get("pregnancy") else "social"
        code = [("loinc", "82810-3", "Pregnancy status")] if l.get("pregnancy") else [("local", "life-period", "Período de vida")]
        res = {"resourceType": "Observation", "_local": "life-" + l["a"] + l["title"], "status": "final",
               "meta": {"profile": [IPS + ("Observation-pregnancy-status-uv-ips" if l.get("pregnancy") else "Observation-uv-ips")]},
               "category": [{"coding": [{"system": OBS_CAT, "code": "social-history"}]}],
               "code": cc(code, "Gravidez" if l.get("pregnancy") else "Período de vida"),
               "subject": subj, "effectivePeriod": {"start": l["a"], "end": l["b"]},
               "valueString" if not l.get("pregnancy") else "valueCodeableConcept":
                   l["title"] if not l.get("pregnancy") else cc([("sct", "77386006", "Pregnant")], l["title"])}
        if l.get("txt"):
            res["note"] = [{"text": l["txt"]}]
        add(res, section, (l["a"] + " → " + l["b"], l["title"], l.get("txt", "")))
    for m in P.get("milestones", []):
        s, c, n = m.get("code", ("local", "life-event", "Acontecimento de vida"))
        res = {"resourceType": "Observation", "_local": "ms-" + m["d"] + m["title"], "status": "final",
               "meta": {"profile": [IPS + "Observation-uv-ips"]},
               "category": [{"coding": [{"system": OBS_CAT, "code": "social-history"}]}],
               "code": cc([(s, c, n)], n), "subject": subj, "effectiveDateTime": m["d"], "valueString": m["title"]}
        if m.get("txt"):
            res["note"] = [{"text": m["txt"]}]
        add(res, "pregnancy" if m.get("pregnancy") else "social", (m["d"], m["title"], m.get("txt", "")))

    # --- Composition ---
    heads = {
        "problems": ("Problema", "Início", "", "Nota"), "past": ("Doença", "Início", "Resolução", "Nota"),
        "allergies": ("Agente", "Início", "Reação", "Criticidade"), "meds": ("Medicamento", "Posologia", "Início", "Fim", "Nota"),
        "immunizations": ("Data", "Vacina"), "procedures": ("Data", "Procedimento", "Nota"),
        "results": ("Data", "Exame", "Valor", "Referência"), "vitals": ("Data", "Medição", "Valor", "Dispositivo"),
        "pregnancy": ("Data", "Registo", "Nota"), "social": ("Data", "Registo", "Valor / nota", ""),
        "encounters": ("Data", "Tipo", "Episódio", "Motivo"), "plan": ("Data", "Tipo", "Planeado", "Motivo"),
    }
    sections = []
    for key, code, disp, title in SECTIONS:
        if not sec[key]:
            continue
        sections.append({"title": title, "code": {"coding": [{"system": SYS["loinc"], "code": code, "display": disp}]},
                         "text": {"status": "generated", "div": table(heads[key], narr[key])},
                         "entry": sec[key]})
    comp = {"resourceType": "Composition", "_local": "composition",
            "meta": {"profile": [IPS + "Composition-uv-ips"]},
            "status": "final",
            "type": {"coding": [{"system": SYS["loinc"], "code": "60591-5", "display": "Patient summary Document"}]},
            "subject": subj, "date": today + "T09:00:00+00:00", "author": [prac_ref], "custodian": org_ref,
            "title": f"Resumo do paciente (IPS) — {P['given']} {P['family']}",
            "confidentiality": "N", "section": sections}
    full = add(comp)
    entries.insert(0, entries.pop())  # Composition first

    return {
        "resourceType": "Bundle", "id": P["id"],
        "meta": {"profile": [IPS + "Bundle-uv-ips"],
                 "tag": [{"system": "http://terminology.hl7.org/CodeSystem/v3-ActReason", "code": "HTEST", "display": "test health data"}]},
        "identifier": {"system": BASE + "/NamingSystem/ips-bundle", "value": P["id"] + "-" + today},
        "type": "document", "timestamp": today + "T09:00:00+00:00",
        "entry": entries,
    }


def load(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(PDIR, name + ".py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.P


def main():
    names = sorted(f[:-3] for f in os.listdir(PDIR) if f.endswith(".py") and not f.startswith("_"))
    only = sys.argv[1:]
    index = []
    for n in names:
        P = load(n)
        if not only or n in only or P["id"] in only:
            b = build(P)
            os.makedirs(os.path.join(OUT, P["id"]), exist_ok=True)
            with open(os.path.join(OUT, P["id"], "ips.json"), "w", encoding="utf-8") as f:
                json.dump(b, f, ensure_ascii=False, indent=2)
            print(f"OK {P['id']}: {len(b['entry'])} resources")
        y, m, d = map(int, P["birth"].split("-"))
        t = date.fromisoformat(P["today"])
        age = t.year - y - ((t.month, t.day) < (m, d))
        index.append({"id": P["id"], "name": f"{P['given']} {P['family']}", "gender": P["gender"], "age": age,
                      "order": P.get("order", 99), "accent": P.get("accent", "blue"), "card": P["card"],
                      "ips": f"patients/{P['id']}/ips.json"})
    index.sort(key=lambda x: x["order"])
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
    print(f"index.json: {len(index)} patients")


if __name__ == "__main__":
    main()
