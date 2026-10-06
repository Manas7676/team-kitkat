import re
fmt = lambda v: f"{v:.1f}".rstrip("0").rstrip(".")
class InvestigationGenerator:
    """Template generator over retrieved context. Swap for a local LLM by keeping the same inputs/outputs."""
    name = "deterministic-template-v1 (no LLM)"
    def generate(self, inc, ctx, evidence):
        kv, un = inc["key_values"], inc["unaffected"]
        facts = [f"{k['label']} reports {fmt(k['observed'])} {k['unit']} (baseline {fmt(k['baseline'])} {k['unit']}, Δ {k['delta']:+.1f})" for k in kv]
        pc = next(e for e in evidence if e["id"] == "PHY-CHECK-002"); facts.append("Physics check: " + ("power consistent with V × I" if "PASSED" in pc["finding"] else "power inconsistent with V × I"))
        if un: facts.append("No significant change in: " + ", ".join(un))
        hy = sorted(ctx["failure_modes"], key=lambda f: -f["prior"])
        sup = [e["id"] for e in evidence if e["source_type"] in ("Telemetry", "Specification", "Procedure", "Mission Memory")]
        hyps = [dict(id=h["id"], cause=h["cause"], confidence=h["prior"], status="NOT CONFIRMED", supporting_evidence=sup) for h in hy]
        rec = ctx["procedures"][0]["text"] if ctx["procedures"] else "INSUFFICIENT EVIDENCE: no matching procedure was retrieved."
        s1 = "; ".join(f"{k['label']} is {fmt(k['observed'])} {k['unit']} against a baseline of {fmt(k['baseline'])} {k['unit']} ({k['delta']:+.1f})" for k in kv) + "."
        s2 = f"No significant change is observed in: {', '.join(un)}." if un else f"Several subsystems show changes ({', '.join(inc['affected_systems'])}), indicating cross-subsystem impact."
        s3 = f" Potential downstream impact: {', '.join(inc['potential_systems'])}." if inc["potential_systems"] else ""
        s4 = f" The available evidence is consistent with a possible {hy[0]['cause'].lower()}; {hy[1]['cause'].lower()} cannot yet be ruled out. The root cause is not confirmed." if len(hy) > 1 else ""
        return dict(narrative=f"{s1} {s2}{s3}{s4}", observed_facts=facts, hypotheses=hyps, recommended_next_step=rec, supporting_evidence=sup if ctx["procedures"] else [], confidence=hyps[0]["confidence"] if hyps else 0, generator=self.name)
class GroundingValidator:
    def validate(self, resp, evidence):
        ids = {e["id"] for e in evidence}; cited = resp["supporting_evidence"]; bad = [c for c in cited if c not in ids]
        resp["supporting_evidence"] = [c for c in cited if c in ids]
        for h in resp["hypotheses"]: h["supporting_evidence"] = [c for c in h["supporting_evidence"] if c in ids]
        if not resp["supporting_evidence"]: resp["recommended_next_step"] = "INSUFFICIENT EVIDENCE: recommendation withheld (no supporting evidence)."
        resp["grounding"] = dict(valid=not bad and bool(resp["supporting_evidence"]), checked=len(cited), removed=bad); return resp
STOP = set("what the a an of at is was why did how caused cause by to in for on and or be are were this that with it its happened happen".split())
ABSTAIN = "INSUFFICIENT EVIDENCE\n\nI could not find sufficient evidence in the available mission telemetry, procedures, mission history, or incident records to determine the cause.\n\nNo root cause should be inferred from the available evidence."
class InvestigationQA:
    """Answers only from existing incidents/evidence; otherwise abstains."""
    def answer(self, q, incidents):
        qt = {w for w in re.findall(r"[a-z]+", q.lower()) if w not in STOP}; times = re.findall(r"\b(\d{1,2}):(\d{2})\b", q); cands = []
        sec = lambda ts: int(ts[11:13]) * 3600 + int(ts[14:16]) * 60 + int(ts[17:19])
        for i in incidents:
            words = set(re.findall(r"[a-z]+", " ".join([i["title"], i["subsystem"], i["description"], *i["affected_systems"], *i["potential_systems"], *[k["label"] for k in i["key_values"]], *[h["cause"] for h in i["hypotheses"]]]).lower()))
            score = len(qt & words)
            if times:
                tq = int(times[0][0]) * 3600 + int(times[0][1]) * 60; a, b = sec(i["timeline"][0]["time"]) - 120, sec(i.get("end_time") or i["updated"]) + 120
                if not (a <= tq <= b) or (qt and score < 1): continue
            elif score < 2: continue
            cands.append((score, i))
        if not cands: return dict(status="INSUFFICIENT_EVIDENCE", answer=ABSTAIN, supporting_evidence=[], incident_id=None)
        i = max(cands, key=lambda x: x[0])[1]
        return dict(status="ANSWERED", answer=i["narrative"] + "\n\nRecommended next step: " + i["recommended_next_step"], supporting_evidence=i["supporting_evidence"], incident_id=i["incident_id"])
