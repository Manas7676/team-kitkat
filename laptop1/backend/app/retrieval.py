import json
from .detector import CAT, D
from .investigation import LABELS
K = {n: json.loads((D / "knowledge" / f"{n}.json").read_text()) for n in ("procedures", "historical_incidents", "system_specs", "failure_modes", "subsystem_dependencies")}
def ev(id, typ, name, ts, inc, finding, supports, sub, param="—", obs="—", base="—", delta="—", rows=None):
    return dict(id=id, source_type=typ, source_name=name, timestamp=ts, parameter=param, observed=obs, baseline=base, delta=delta, finding=finding, supports=supports, subsystem=sub, incident_id=inc, rows=rows)
class EvidenceRetriever:
    """Keyword-overlap retrieval over small JSON records; returns only relevant records (never the whole DB)."""
    def retrieve(self, inc, t, memory):
        sid = inc["scenario_id"]; c = CAT[sid]; q = {sid.lower(), inc["subsystem"].lower(), *c["kw"], *c["key"]}
        def top(rs): sc = sorted(((len(q & set(r["tags"])), r) for r in rs), key=lambda x: -x[0]); return [r for s, r in sc if s > 0][:1]
        ts, iid, sub = t.timestamp, inc["incident_id"], inc["subsystem"]; kv = inc["key_values"]; k0 = kv[0]
        E = [ev(f"TEL-{ts[11:16]}", "Telemetry", "Live telemetry", ts, iid, f"{k0['label']} deviates from baseline, supporting {inc['title']}.", inc["title"], sub, k0["label"], f"{k0['observed']} {k0['unit']}", f"{k0['baseline']} {k0['unit']}", f"{k0['delta']:+.1f} {k0['unit']}", kv)]
        pc = inv_physics(t); E.append(ev("PHY-CHECK-002", "Physics Check", "P = V × I consistency", ts, iid, f"Expected {pc['expected_power']} W, reported {pc['reported_power']} W — " + ("PHYSICS CONSISTENCY CHECK PASSED: no electrical inconsistency." if pc["passed"] else "PHYSICS CONSISTENCY CHECK FAILED."), "Telemetry plausibility", "Power", "power", f"{pc['reported_power']} W", f"{pc['expected_power']} W", f"{pc['reported_power']-pc['expected_power']:+.1f} W"))
        ctx = dict(specs=top(K["system_specs"]), procedures=top(K["procedures"]), history=top(K["historical_incidents"]), failure_modes=K["failure_modes"].get(sid, []))
        for r in ctx["specs"]: E.append(ev(r["id"], "Specification", r["name"], ts, iid, r["text"], "Hypothesis plausibility", sub))
        for r in ctx["procedures"]: E.append(ev(r["id"], "Procedure", r["name"], ts, iid, r["text"], "Recommended next step", sub))
        for r in ctx["history"]: E.append(ev(r["id"], "Mission Memory", r["name"], ts, iid, r["text"], "Similar past incident", sub))
        m = memory.latest_for(sid)
        if m: E.append(ev(f"MEM-{m['incident_id']}", "Mission Memory", f"Earlier session incident {m['incident_id']}", m["detected"], iid, f"Same incident type; outcome: {m.get('resolution') or 'n/a'}.", "Similar past incident", sub))
        if inc["potential_systems"] or sid == "CASCADE_01":
            dep = K["subsystem_dependencies"]; E.append(ev(dep["id"], "Dependency Map", dep["name"], ts, iid, f"{sub} feeds: {', '.join(dep['edges'].get(sub, [])) or 'no downstream subsystems'}.", "Cross-subsystem impact", sub))
        return E, ctx, dict(considered=sum(len(K[k]) for k in ("procedures", "historical_incidents", "system_specs")) + len(ctx["failure_modes"]), retrieved=len(E) - 2 + len(ctx["failure_modes"]))
def inv_physics(t):
    from .investigation import physics_check; return physics_check(t)
