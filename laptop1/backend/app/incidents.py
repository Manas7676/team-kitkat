import datetime
from .detector import CAT
from .investigation import BASELINE, LABELS, what_changed
from .retrieval import EvidenceRetriever
from .generator import InvestigationGenerator, GroundingValidator
SUBS = ["Power", "Thermal", "Attitude", "Communication", "Payload"]
RANK = {"NORMAL": 0, "WARNING": 1, "AFFECTED": 2, "ANOMALY": 3}
retriever, generator, validator = EvidenceRetriever(), InvestigationGenerator(), GroundingValidator()
now = lambda: datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
def key_values(t, keys):
    d = t.model_dump(); out = []
    for k in keys:
        b = BASELINE[k]; l, u = LABELS[k]; out.append(dict(param=k, label=l, unit=u, observed=d[k], baseline=b, delta=round(d[k] - b, 2), pct=round((d[k] - b) / abs(b) * 100, 1)))
    return out
def classify(sid, t, kv):
    """Affected / potential / unaffected systems derived from live telemetry changes + catalog relationships."""
    c = CAT[sid]; wc = {w["parameter"]: w for w in what_changed(t)}; aff, pot = [], []
    for n, p, s in c["affected"]: (aff if c.get("always") or wc[p]["significant"] else pot).append((n, s))
    pot += [(n, s) for n, p, s in c["potential"]]
    a_s, p_s = {s for _, s in aff}, {s for _, s in pot}
    impact = {s.lower(): (c.get("state", "ANOMALY") if s == c["subsystem"] else "AFFECTED" if s in a_s else "WARNING" if s in p_s else "NORMAL") for s in SUBS}
    m = max(abs(k["pct"]) for k in kv); sev = c.get("sev") or ("HIGH" if m >= 25 else "MEDIUM" if m >= 10 else "LOW")
    return [n for n, _ in aff], [n for n, _ in pot], impact, [s for s in SUBS if impact[s.lower()] == "NORMAL"], sev
def build(t, sid, hist, num, memory):
    c = CAT[sid]; wc = {w["parameter"]: w for w in what_changed(t)}; kv = key_values(t, c["key"])
    aff, pot, impact, un, sev = classify(sid, t, kv)
    inc = dict(incident_id=f"INC-{num:03d}", scenario_id=sid, timestamp=t.timestamp, detected=t.timestamp, start_time=None, end_time=None, title=c["title"], severity=sev, subsystem=c["subsystem"], status="INVESTIGATING",
        state=c.get("state", "ANOMALY"), key_values=kv, affected_systems=aff, potential_systems=pot, unaffected=un, subsystem_impact=impact,
        trigger=c["trigger_text"], baseline_telemetry=BASELINE, initial_telemetry=hist[0], abnormal_telemetry=t.model_dump(), final_telemetry=t.model_dump(), updated=t.timestamp,
        what_changed=[w for w in wc.values() if w["significant"]], outcome=None, operator_decision=None, resolution=None, ground_truth=None)
    inc["id"] = inc["incident_id"]
    inc["description"] = f"{c['title']}: {kv[0]['label']} {kv[0]['observed']} {kv[0]['unit']} vs baseline {kv[0]['baseline']} {kv[0]['unit']} ({kv[0]['delta']:+.1f}). Affected: {', '.join(inc['affected_systems'])}."
    E, ctx, stats = retriever.retrieve(inc, t, memory); r = validator.validate(generator.generate(inc, ctx, E), E)
    inc.update(r); inc.update(evidence=E, evidence_ids=[e["id"] for e in E], retrieval=stats, procedures=[p["id"] for p in ctx["procedures"]], recommendation=dict(text=r["recommended_next_step"], supporting_evidence=r["supporting_evidence"]),
        summary=r["narrative"])
    tl = []; firsts = []
    for p in dict.fromkeys(c["key"] + [x[1] for x in c["affected"]]):
        b = BASELINE[p]; h = next((h for h in hist if abs(h[p] - b) / abs(b) > .08), None)
        if h: firsts.append((h["timestamp"], p, h[p]))
    firsts.sort()
    if not firsts or firsts[0][0] > hist[0]["timestamp"]: tl.append(dict(time=hist[0]["timestamp"], event="System nominal — monitored parameters within baseline", kind="telemetry"))
    tl += [dict(time=ts, event=f"{LABELS[p][0]} begins deviating from baseline ({v} {LABELS[p][1]})", kind="telemetry") for ts, p, v in firsts]
    n = now(); tl += [dict(time=t.timestamp, event=f"Threshold crossed: {c['trigger_text']}", kind="detection"), dict(time=t.timestamp, event=f"Incident {inc['incident_id']} created", kind="detection"),
        dict(time=n, event=f"Evidence retrieved ({stats['retrieved']} records)", kind="investigation"), dict(time=n, event="Hypotheses generated (not confirmed)", kind="investigation"), dict(time=n, event="Recommended diagnostic step generated", kind="investigation")]
    inc["timeline"] = tl; inc["start_time"] = tl[0]["time"]; inc["outcome_template"] = c["outcome"]; return inc
