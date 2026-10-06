import json, copy
class MissionMemoryStore:
    """Persists complete incident reconstruction packages (future RAG knowledge base)."""
    def __init__(self, path, seed):
        self.path, self.seed = path, json.loads(seed.read_text()); self.records = json.loads(path.read_text()) if path.exists() else []
    def add(self, inc):
        self.records = [r for r in self.records if r["incident_id"] != inc["incident_id"]] + [copy.deepcopy(inc)]; self.path.write_text(json.dumps(self.records))
    def latest_for(self, sid): return next((r for r in reversed(self.records) if r["scenario_id"] == sid), None)
    def next_number(self): return max([int(r["incident_id"][4:]) for r in self.records] + [23]) + 1
    def listing(self, ref=None):
        rel = lambda sid, sub: 90 if ref and sid == ref["scenario_id"] else 55 if ref and sub == ref["subsystem"] else 15
        out = [dict(id=r["incident_id"], title=r["title"], subsystem=r["subsystem"], resolution=r.get("resolution"), similarity=rel(r["scenario_id"], r["subsystem"]), record=r) for r in reversed(self.records)]
        return out + [dict(id=s["id"], title=s["title"], subsystem=s["subsystem"], resolution=s["resolution"], similarity=rel(s["scenario_id"], s["subsystem"]) if ref else s["similarity"], record=None) for s in self.seed]
