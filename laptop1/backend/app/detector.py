import json, pathlib, statistics
D = pathlib.Path(__file__).resolve().parents[2] / "data"
CAT = json.loads((D / "scenarios" / "incident_catalog.json").read_text())   # data-driven incident types
OPS = {">": lambda a, b: a > b, "<": lambda a, b: a < b, ">=": lambda a, b: a >= b}
class TelemetryAnalyzer:
    """Derives features from telemetry only (scenario/ground truth is never visible here)."""
    def features(self, t, hist):
        f = t.model_dump(); f["tdiff"] = t.temperature_a - (t.temperature_b + t.temperature_c) / 2
        w = hist[-8:]
        f["noisy"] = sum(statistics.pstdev([h[k] for h in w]) > 1.5 for k in ("temperature_a", "temperature_b", "temperature_c")) if len(w) >= 6 else 0
        f["power_sig"] = int(t.battery_soc < 58 or t.bus_voltage < 19.5 or t.solar_generation < 110)
        f["comm_deg"] = int(t.communication_signal < -75 or t.communication_latency > 300)
        return f
class IncidentDetector:
    """Replaceable with an ML detector: features -> scenario/incident-type id or None."""
    def detect(self, f):
        for sid, c in sorted(CAT.items(), key=lambda x: x[1]["priority"]):
            if all(OPS[o](f[p], v) for p, o, v in c["trigger"]): return sid
