import json, datetime, asyncio, copy
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError, BaseModel
from .models import Telemetry
from . import investigation as inv
from .detector import D, TelemetryAnalyzer, IncidentDetector
from .incidents import build, classify, RANK, now
from .generator import InvestigationQA
from .gemini_qa import GeminiInvestigationQA
from .pdf_report import generate_pdf_report
from .memory import MissionMemoryStore

app = FastAPI(title="ST-10 Mission Operations Copilot")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

memory = MissionMemoryStore(D / "incidents" / "memory.json", D / "history" / "history.json")
analyzer, detector, qa = TelemetryAnalyzer(), IncidentDetector(), InvestigationQA()
gemini_qa = GeminiInvestigationQA()

REPORTS: Dict[str, Any] = {}
S = dict(sim_ws=None, truth=None, fut=None, UI=set())

def fresh():
    S.update(
        latest=None,
        history=[],
        active={},
        incidents=[],
        miss={},
        audit=[],
        resolved_scenarios=set(),
        counter=memory.next_number()
    )

fresh()

def audit(ev):
    e = dict(time=now()[11:19], event=ev)
    S["audit"].append(e)
    return e

def tl(inc, ev, kind):
    inc["timeline"].append(dict(time=now(), event=ev, kind=kind))

def primary():
    a = sorted(S["active"].values(), key=lambda i: i["detected"])
    return a[-1] if a else (S["incidents"][0] if S["incidents"] else None)

def find(iid):
    if not iid:
        return primary()
    return next((i for i in S["incidents"] if i.get("incident_id") == iid or i.get("id") == iid), None) or primary()

def close(inc, status, res):
    inc.update(status=status, end_time=now(), resolution=res)
    if status == "RESOLVED":
        inc["resolved_by"] = "Operator"
    tl(inc, f"Incident {status.lower()}: {res}", "outcome")
    S["active"].pop(inc["scenario_id"], None)
    S.setdefault("resolved_scenarios", set()).add(inc["scenario_id"])
    memory.add(inc)
    audit(f"{inc['incident_id']} {status.lower()}")

def sub_status(t):
    s = inv.subsystem_status(t)
    for i in S["active"].values():
        for k, v in i["subsystem_impact"].items():
            if RANK[v] > RANK[s[k]]:
                s[k] = v
    return s

def process(t):
    S["history"] = (S["history"] + [t.model_dump()])[-900:]
    sid = detector.detect(analyzer.features(t, S["history"]))
    for k, inc in list(S["active"].items()):
        S["miss"][k] = 0 if k == sid else S["miss"].get(k, 0) + 1
        inc.update(
            key_values=[
                dict(
                    kv,
                    observed=t.model_dump()[kv["param"]],
                    delta=round(t.model_dump()[kv["param"]] - kv["baseline"], 2),
                    pct=round((t.model_dump()[kv["param"]] - kv["baseline"]) / abs(kv["baseline"]) * 100, 1)
                ) for kv in inc["key_values"]
            ],
            updated=t.timestamp,
            final_telemetry=t.model_dump()
        )
        a, p, im, un, sv = classify(k, t, inc["key_values"])
        inc.update(
            affected_systems=a,
            potential_systems=p,
            subsystem_impact=im,
            unaffected=un,
            what_changed=[w for w in inv.what_changed(t) if w["significant"]]
        )
        if {"LOW": 0, "MEDIUM": 1, "HIGH": 2}[sv] > {"LOW": 0, "MEDIUM": 1, "HIGH": 2}[inc["severity"]]:
            inc["severity"] = sv
        if S["miss"][k] >= 5:
            close(inc, "CLOSED", "Telemetry returned to baseline (auto-closed)")

    if sid and sid not in S["active"] and sid not in S.get("resolved_scenarios", set()):
        inc = build(t, sid, S["history"], S["counter"], memory)
        S["counter"] += 1
        if sid == "CASCADE_01":
            for k in ("POWER_01", "COMM_01", "PAYLOAD_01"):
                if k in S["active"]:
                    close(S["active"][k], "ESCALATED", f"Escalated to {inc['incident_id']}")
        S["active"][sid] = inc
        S["incidents"].insert(0, inc)
        S["miss"][sid] = 0
        for e in ("detected", "evidence retrieved", "hypotheses presented (not confirmed)", "recommendation presented"):
            audit(f"{inc['incident_id']} {e}")

def message(t=None):
    t = t or S["latest"]
    t_data = t.model_dump() if t else None
    return dict(
        type="telemetry",
        data=t_data,
        subsystems=sub_status(t) if t else {},
        what_changed=inv.what_changed(t) if t else [],
        incident=primary(),
        incidents=S["incidents"],
        audit=S["audit"]
    )

async def push(msg):
    for ws in list(S["UI"]):
        try:
            await ws.send_text(json.dumps(msg))
        except Exception:
            S["UI"].discard(ws)

@app.websocket("/ws/telemetry")           # Laptop 2 -> backend
async def telemetry_ws(ws: WebSocket):
    await ws.accept()
    S["sim_ws"] = ws
    audit("Simulator connected")
    try:
        while True:
            raw = json.loads(await ws.receive_text())
            if raw.get("type") == "ground_truth":   # only stored for Reveal; never used by detection
                S["truth"] = raw["data"]
                if S["fut"] and not S["fut"].done():
                    S["fut"].set_result(1)
                continue
            try:
                t = Telemetry(**raw)
            except ValidationError:
                audit("Invalid telemetry rejected")
                continue
            if S["latest"] and S["latest"].timestamp == t.timestamp:
                continue
            S["latest"] = t
            process(t)
            await push(message(t))
    except WebSocketDisconnect:
        audit("Simulator disconnected")
    finally:
        if S["sim_ws"] is ws:
            S["sim_ws"] = None

@app.websocket("/ws/ui")                  # backend -> Laptop 1 frontend
async def ui_ws(ws: WebSocket):
    await ws.accept()
    S["UI"].add(ws)
    await ws.send_text(json.dumps(dict(type="snapshot", incident=primary(), incidents=S["incidents"], audit=S["audit"])))
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        S["UI"].discard(ws)

@app.get("/api/state")
def state():
    return dict(latest=S["latest"], incident=primary(), incidents=S["incidents"], audit=S["audit"])

@app.post("/api/simulate-outcome")        # no spacecraft command; local simulated state only
def simulate(incident_id: Optional[str] = None):
    i = find(incident_id)
    if not i:
        return dict(error="no active incident")
    i["outcome"] = i["outcome_template"]
    i["operator_decision"] = "Operator reviewed recommendation and selected Simulate Outcome"
    tl(i, "Operator reviewed recommendation", "operator")
    tl(i, "Simulated outcome recorded: " + "; ".join(i["outcome"]), "outcome")
    audit(f"{i['incident_id']} operator selected Simulate Outcome")
    if i["incident_id"] in [r["incident_id"] for r in memory.records]:
        memory.add(i)
    return dict(outcome=i["outcome"])

@app.post("/api/resolve")
async def resolve(incident_id: Optional[str] = None):
    i = find(incident_id)
    if i:
        i["operator_decision"] = (i.get("operator_decision") or "") + " | Marked as resolved by Operator"
        i["resolved_by"] = "Operator"
        close(i, "RESOLVED", "Operator marked resolved after simulated outcome and diagnostic review")
        await push(message())
    return dict(ok=True, incident=i)

@app.get("/api/ground-truth")
async def truth(incident_id: Optional[str] = None):
    i = find(incident_id)
    w = S["sim_ws"]
    if w:
        S["fut"] = asyncio.get_event_loop().create_future()
        try:
            await w.send_text(json.dumps(dict(type="reveal_request")))
            await asyncio.wait_for(S["fut"], 2)
        except Exception:
            pass
    a = i["hypotheses"][0] if i else None
    if i:
        i["ground_truth"] = dict(injected=S["truth"], assessment=a)
        audit("Ground truth revealed")
        if i["incident_id"] in [r["incident_id"] for r in memory.records]:
            memory.add(i)
    return dict(injected=S["truth"], assessment=a)

class Ask(BaseModel):
    question: str
    incident_id: Optional[str] = None

@app.post("/api/ask")
def ask(a: Ask):
    i = find(a.incident_id) if a.incident_id else primary()
    mem_records = memory.listing(i)
    tel = S["latest"].model_dump() if S.get("latest") else (i.get("abnormal_telemetry") if i else None)
    r = gemini_qa.answer(a.question, i, tel, mem_records)
    audit(f"Investigation question asked → {r.get('status', 'ANSWERED')}")
    return r

@app.get("/api/memory")
def mem():
    return memory.listing(primary())

@app.post("/api/report")
def report(incident_id: Optional[str] = None):
    i = find(incident_id)
    if i:
        REPORTS[i["incident_id"]] = copy.deepcopy(i)
        audit(f"{i['incident_id']} added to incident report ({len(REPORTS)} total)")
        return dict(ok=True, count=len(REPORTS), incidents=list(REPORTS.keys()))
    return dict(ok=False, error="no incident found to add to report")

@app.get("/api/report")
def get_report():
    return dict(count=len(REPORTS), incidents=list(REPORTS.keys()))

@app.get("/api/report/pdf")
def download_pdf(incident_id: Optional[str] = None):
    items = list(REPORTS.values())
    if not items:
        i = find(incident_id)
        if i:
            items = [copy.deepcopy(i)]
    if not items:
        raise HTTPException(status_code=400, detail="No incident records available for report generation.")
    pdf_bytes = generate_pdf_report(items, mission_state=primary())
    now_str = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=ST10_Incident_Report_{now_str}.pdf"}
    )

@app.post("/api/reset")
async def reset():
    fresh()
    REPORTS.clear()
    S["truth"] = None
    await push(dict(type="snapshot", incident=None, incidents=[], audit=S["audit"]))
    return dict(ok=True)
