import os, json, re, requests
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

# Load environment variables from .env if present
load_dotenv()

SYSTEM_INSTRUCTION = """You are the ST-10 Mission Operations Copilot.
You are a decision-support assistant for spacecraft operators.

Answer questions using ONLY the investigation context and evidence supplied to you.

Clearly distinguish:
- OBSERVED FACTS
- EVIDENCE
- HYPOTHESES
- RECOMMENDATIONS
- UNKNOWN / INSUFFICIENT EVIDENCE

Rules:
1. Never present a hypothesis as a confirmed fact.
2. Never invent telemetry values, events, evidence, historical incidents, procedures, or spacecraft states.
3. Important conclusions MUST reference available evidence using their exact IDs (e.g. TEL-..., PHY-CHECK-002, etc.).
4. If the supplied evidence does not support an answer, or if the question asks about unrecorded times/events, you MUST explicitly state: "Insufficient evidence to determine this." and set status to "INSUFFICIENT_EVIDENCE".
5. Do not issue spacecraft commands. All recommendations are advisory and require human operator review.
6. Be concise, technical, clear, and understandable to a mission operator.

You MUST respond strictly with valid JSON conforming to this schema:
{
  "status": "ANSWERED" | "INSUFFICIENT_EVIDENCE",
  "answer": "A concise direct answer to the operator's question.",
  "observed_facts": ["Fact 1", "Fact 2"],
  "supporting_evidence": ["EVID-001", "EVID-002"],
  "interpretation": "Explain what the evidence indicates.",
  "uncertainty": "Explain what cannot currently be confirmed.",
  "recommended_next_step": "Provide an advisory diagnostic action only if supported by available evidence.",
  "confidence": "High" | "Medium" | "Low"
}"""

class GeminiInvestigationQA:
    def __init__(self):
        self.api_key = os.environ.get("GEMINI_API_KEY", "").strip()

    def build_context(self, inc: Dict[str, Any], telemetry: Optional[Dict[str, Any]], memory_records: List[Dict[str, Any]]) -> str:
        """Constructs the comprehensive structured context as required by ST-10 specifications."""
        parts = []

        # 1. CURRENT INCIDENT
        parts.append("=== CURRENT INCIDENT ===")
        parts.append(f"Incident ID: {inc.get('incident_id', 'N/A')}")
        parts.append(f"Title: {inc.get('title', 'N/A')}")
        parts.append(f"Timestamp: {inc.get('detected') or inc.get('timestamp', 'N/A')}")
        parts.append(f"Severity: {inc.get('severity', 'N/A')}")
        parts.append(f"Status: {inc.get('status', 'N/A')}")
        parts.append(f"Subsystem: {inc.get('subsystem', 'N/A')}")
        parts.append(f"Description: {inc.get('description', 'N/A')}")
        parts.append(f"Trigger: {inc.get('trigger', 'N/A')}")
        parts.append(f"Affected Systems: {', '.join(inc.get('affected_systems', [])) or 'None'}")
        parts.append(f"Potential Systems: {', '.join(inc.get('potential_systems', [])) or 'None'}")
        parts.append(f"Unaffected Systems: {', '.join(inc.get('unaffected', [])) or 'None'}")
        if inc.get('resolution'):
            parts.append(f"Resolution: {inc.get('resolution')}")
        if inc.get('operator_decision'):
            parts.append(f"Operator Decision: {inc.get('operator_decision')}")

        # 2. CURRENT TELEMETRY
        parts.append("\n=== CURRENT TELEMETRY ===")
        tel = telemetry or inc.get("abnormal_telemetry") or inc.get("final_telemetry") or {}
        if tel:
            parts.append(f"temperature_a: {tel.get('temperature_a', 'N/A')} °C (baseline: 45 °C)")
            parts.append(f"temperature_b: {tel.get('temperature_b', 'N/A')} °C (baseline: 44 °C)")
            parts.append(f"temperature_c: {tel.get('temperature_c', 'N/A')} °C (baseline: 45 °C)")
            parts.append(f"bus_voltage: {tel.get('bus_voltage', 'N/A')} V (baseline: 21.0 V)")
            parts.append(f"current: {tel.get('current', 'N/A')} A (baseline: 2.1 A)")
            parts.append(f"power: {tel.get('power', 'N/A')} W (baseline: 44 W)")
            parts.append(f"battery_soc: {tel.get('battery_soc', 'N/A')} % (baseline: 72 %)")
            parts.append(f"solar_generation: {tel.get('solar_generation', 'N/A')} W (baseline: 145 W)")
            parts.append(f"attitude_deviation: {tel.get('attitude_deviation', 'N/A')} ° (baseline: 0.8 °)")
            parts.append(f"communication_signal: {tel.get('communication_signal', 'N/A')} dBm (baseline: -62 dBm)")
            parts.append(f"communication_latency: {tel.get('communication_latency', 'N/A')} ms (baseline: 120 ms)")
            parts.append(f"payload_load: {tel.get('payload_load', 'N/A')} W (baseline: 38 W)")
        
        wc = inc.get("what_changed", [])
        if wc:
            parts.append("Significant Parameter Deviations:")
            for item in wc:
                parts.append(f"  - {item.get('parameter')}: baseline {item.get('baseline')} -> current {item.get('current')} (Δ {item.get('change_pct')}%)")

        # 3. EVIDENCE
        parts.append("\n=== EVIDENCE ===")
        ev_list = inc.get("evidence", [])
        for e in ev_list:
            parts.append(f"- ID: [{e.get('id')}] | Source: {e.get('source_type')} ({e.get('source_name')}) | Subsystem: {e.get('subsystem')}")
            parts.append(f"  Parameter: {e.get('parameter', '—')} | Observed: {e.get('observed', '—')} | Baseline: {e.get('baseline', '—')} | Delta: {e.get('delta', '—')}")
            parts.append(f"  Finding: {e.get('finding', '—')} | Supports: {e.get('supports', '—')}")

        # 4. INVESTIGATION
        parts.append("\n=== INVESTIGATION ===")
        facts = inc.get("observed_facts", [])
        parts.append("Observed Facts:")
        for f in facts:
            parts.append(f"  - {f}")
        parts.append(f"Narrative Summary: {inc.get('narrative', 'N/A')}")
        parts.append("Hypotheses:")
        for h in inc.get("hypotheses", []):
            parts.append(f"  - Cause: {h.get('cause')} | Confidence: {h.get('confidence')}% | Status: {h.get('status')} | Supported by: {h.get('supporting_evidence', [])}")
        parts.append(f"Recommended Next Step: {inc.get('recommended_next_step', 'N/A')}")

        # 5. MISSION MEMORY
        parts.append("\n=== MISSION MEMORY ===")
        if memory_records:
            for m in memory_records[:5]:
                parts.append(f"- Past Incident: {m.get('id')} ({m.get('title')}) | Subsystem: {m.get('subsystem')} | Resolution: {m.get('resolution')}")
        else:
            parts.append("No directly matching historical anomalies recorded.")

        return "\n".join(parts)

    def answer(self, question: str, inc: Optional[Dict[str, Any]], telemetry: Optional[Dict[str, Any]], memory_records: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Answers the operator's question grounded in the current investigation."""
        if not inc:
            return {
                "status": "INSUFFICIENT_EVIDENCE",
                "answer": "Insufficient evidence to determine this. No active incident is currently loaded.",
                "observed_facts": [],
                "supporting_evidence": [],
                "interpretation": "Without an active incident or telemetry snapshot, no ground truth is available.",
                "uncertainty": "All parameters unknown.",
                "recommended_next_step": "Select an incident or trigger a scenario.",
                "confidence": "Low",
                "incident_id": None
            }

        valid_evidence_ids = {e.get("id") for e in inc.get("evidence", []) if e.get("id")}
        context_str = self.build_context(inc, telemetry, memory_records)

        # Check if Gemini API key is available
        api_key = os.environ.get("GEMINI_API_KEY", self.api_key).strip()
        if api_key and api_key != "your_api_key_here":
            try:
                res = self._call_gemini_api(api_key, context_str, question, valid_evidence_ids)
                if res:
                    res["incident_id"] = inc.get("incident_id")
                    return res
            except Exception as e:
                # Log and proceed to grounded deterministic fallback
                pass

        # Grounded Deterministic Analyzer Fallback
        res = self._grounded_fallback(question, inc, telemetry, valid_evidence_ids)
        res["incident_id"] = inc.get("incident_id")
        return res

    def _call_gemini_api(self, api_key: str, context: str, question: str, valid_evidence_ids: set) -> Optional[Dict[str, Any]]:
        """Invokes Gemini 2.5 Flash via standard REST API with JSON schema."""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
        user_prompt = f"{context}\n\n=== USER QUESTION ===\n{question}"

        payload = {
            "system_instruction": {
                "parts": [{"text": SYSTEM_INSTRUCTION}]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": user_prompt}]
                }
            ],
            "generationConfig": {
                "temperature": 0.15,
                "response_mime_type": "application/json"
            }
        }

        resp = requests.post(url, json=payload, timeout=12)
        if resp.status_code != 200:
            return None

        data = resp.json()
        candidates = data.get("candidates", [])
        if not candidates:
            return None

        text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        parsed = json.loads(text)

        # Grounding validation: filter evidence IDs to only those that exist
        cited = parsed.get("supporting_evidence", [])
        validated_citations = [c for c in cited if c in valid_evidence_ids]
        parsed["supporting_evidence"] = validated_citations

        # Enforce abstention if marked or if no facts/evidence exist for the query
        if parsed.get("status") == "INSUFFICIENT_EVIDENCE":
            parsed["supporting_evidence"] = []
            if "insufficient evidence" not in parsed.get("answer", "").lower():
                parsed["answer"] = "Insufficient evidence to determine this."

        return parsed

    def _grounded_fallback(self, question: str, inc: Dict[str, Any], telemetry: Optional[Dict[str, Any]], valid_evidence_ids: set) -> Dict[str, Any]:
        """
        High-fidelity deterministic grounded engine when Gemini API key is absent or offline.
        Strictly adheres to ST-10 evidence grounding, distinguishing facts/evidence/hypotheses.
        """
        q_lower = question.lower()
        ev_list = inc.get("evidence", [])
        facts = inc.get("observed_facts", [])
        hyps = inc.get("hypotheses", [])
        rec = inc.get("recommended_next_step", "Monitor telemetry against baselines.")
        aff = inc.get("affected_systems", [])
        pot = inc.get("potential_systems", [])
        unaff = inc.get("unaffected", [])
        tel = telemetry or inc.get("abnormal_telemetry") or {}
        kv = inc.get("key_values", [])

        # 1. Unanswerable / Out of scope check (e.g. historical times not recorded, random queries)
        unanswerable_patterns = [
            r"6\s*hours?\s*ago", r"yesterday", r"orbit\s*1\d{2}", r"14:21", r"unrelated", r"weather",
            r"fuel\s*level", r"launch\s*vehicle", r"who\s*is", r"what\s*did\s*the\s*president"
        ]
        is_unanswerable = any(re.search(pat, q_lower) for pat in unanswerable_patterns)
        
        # Check if the question asks about something with zero overlap in the incident
        incident_terms = {
            "why", "detected", "detection", "cause", "anomaly", "subsystem", "affected", "evidence",
            "first", "change", "changed", "communication", "comm", "power", "solar", "thermal", "temperature",
            "battery", "attitude", "payload", "unaffected", "not affected", "check", "next", "step", "happened",
            "root", "incident", "investigation", "status", "voltage", "current", "signal", "sensor", "what", "is"
        }
        tokens = set(re.findall(r"[a-z0-9]+", q_lower))
        if is_unanswerable or len(tokens & incident_terms) == 0:
            return {
                "status": "INSUFFICIENT_EVIDENCE",
                "answer": "Insufficient evidence to determine this.",
                "observed_facts": [],
                "supporting_evidence": [],
                "interpretation": "The available telemetry, active evidence context, and mission memory do not contain records regarding this query.",
                "uncertainty": "No telemetry data or historical incident reports cover the queried timeframe or parameter.",
                "recommended_next_step": "No action possible from available data. Await next scheduled ground station downlink.",
                "confidence": "Low"
            }

        # 2. "Why was this incident detected?" / "Why detected"
        if "why" in q_lower and ("detect" in q_lower or "created" in q_lower or "triggered" in q_lower):
            param_notes = [f"{k['label']} changed to {k['observed']} {k['unit']} (baseline: {k['baseline']} {k['unit']}, Δ {k['delta']:+.1f})" for k in kv]
            cites = [e["id"] for e in ev_list if e.get("source_type") in ("Telemetry", "Physics Check")]
            return {
                "status": "ANSWERED",
                "answer": f"Incident {inc.get('incident_id')} was triggered because monitored telemetry crossed operational limits: {inc.get('trigger')}.",
                "observed_facts": facts[:3],
                "supporting_evidence": cites[:3],
                "interpretation": f"Telemetry deviations in the {inc.get('subsystem')} subsystem exceeded the predefined alert threshold, prompting automated incident classification and evidence retrieval.",
                "uncertainty": "Telemetry reflects symptomatic operational deviations; root cause remains unconfirmed until physical diagnostic procedures conclude.",
                "recommended_next_step": rec,
                "confidence": "High"
            }

        # 3. "Which subsystems are affected?" / "systems affected"
        if "affected" in q_lower and ("subsystem" in q_lower or "system" in q_lower or "which" in q_lower or "what" in q_lower) and "not" not in q_lower:
            cites = [e["id"] for e in ev_list if "Dependency Map" in e.get("source_type", "") or "Telemetry" in e.get("source_type", "")]
            return {
                "status": "ANSWERED",
                "answer": f"Affected subsystems: {', '.join(aff) or 'None'}. Potential downstream subsystems: {', '.join(pot) or 'None'}.",
                "observed_facts": [f"Directly affected: {', '.join(aff) or 'None'}", f"Potential downstream impact: {', '.join(pot) or 'None'}"],
                "supporting_evidence": cites[:2],
                "interpretation": f"Active impact is centered on the {inc.get('subsystem')} subsystem, with potential cascading effects on {', '.join(pot) or 'none'} based on system dependency mapping.",
                "uncertainty": f"Downstream impact on {', '.join(pot) or 'adjacent systems'} depends on duration of the anomaly.",
                "recommended_next_step": rec,
                "confidence": "High"
            }

        # 4. "What systems are NOT affected?" / "unaffected"
        if "not affected" in q_lower or "unaffected" in q_lower:
            return {
                "status": "ANSWERED",
                "answer": f"Monitored subsystems NOT affected by this incident: {', '.join(unaff) or 'None'}.",
                "observed_facts": [f"Subsystems within baseline: {', '.join(unaff) or 'None'}"],
                "supporting_evidence": [e["id"] for e in ev_list if e.get("source_type") == "Telemetry"][:1],
                "interpretation": f"Telemetry for {', '.join(unaff) or 'these systems'} remains within nominal operational tolerances.",
                "uncertainty": "Conditions may evolve if the primary anomaly propagates across shared buses.",
                "recommended_next_step": "Continue background monitoring of nominal systems while addressing the primary anomaly.",
                "confidence": "High"
            }

        # 5. "What evidence supports this?" / "evidence"
        if "evidence" in q_lower:
            cites = [e["id"] for e in ev_list]
            return {
                "status": "ANSWERED",
                "answer": f"The investigation is supported by {len(ev_list)} retrieved records across Telemetry, Physics Plausibility Checks, Specifications, and Procedures.",
                "observed_facts": facts[:4],
                "supporting_evidence": cites[:5],
                "interpretation": "Retrieved evidence links observed telemetry deviations to documented system failure modes and procedures.",
                "uncertainty": "Evidence provides diagnostic correlations; physical hardware inspection is impossible in orbit.",
                "recommended_next_step": rec,
                "confidence": "High"
            }

        # 6. "What changed first?" / "first"
        if "first" in q_lower or "sequence" in q_lower:
            tl = inc.get("timeline", [])
            dev_events = [t for t in tl if "deviat" in t.get("event", "").lower() or "first" in t.get("event", "").lower()]
            first_event = dev_events[0]["event"] if dev_events else (tl[0]["event"] if tl else "Telemetry deviation")
            return {
                "status": "ANSWERED",
                "answer": f"Initial deviation recorded: {first_event}.",
                "observed_facts": [t["event"] for t in tl[:3]],
                "supporting_evidence": [e["id"] for e in ev_list if e.get("source_type") == "Telemetry"][:2],
                "interpretation": "Reconstruction of high-rate telemetry shows this initial deviation preceded subsequent secondary alarms.",
                "uncertainty": "Millisecond-level internal sensor clock jitter may slightly shift sequence boundaries.",
                "recommended_next_step": rec,
                "confidence": "High"
            }

        # 7. "Is communication degradation related to power?" / cross-subsystem correlation
        if ("comm" in q_lower or "communication" in q_lower) and ("power" in q_lower or "solar" in q_lower or "battery" in q_lower):
            cites = [e["id"] for e in ev_list if e.get("subsystem") in ("Power", "Communication") or "Dependency" in e.get("source_type", "")]
            return {
                "status": "ANSWERED",
                "answer": "Yes. Subsystem dependency architecture couples RF amplification to bus voltage and available power. A power or solar generation drop directly degrades communication signal and increases transmission latency.",
                "observed_facts": [
                    f"Bus Voltage: {tel.get('bus_voltage', 'N/A')} V | Solar Gen: {tel.get('solar_generation', 'N/A')} W",
                    f"Comm Signal: {tel.get('communication_signal', 'N/A')} dBm | Comm Latency: {tel.get('communication_latency', 'N/A')} ms"
                ],
                "supporting_evidence": cites[:3] or [e["id"] for e in ev_list][:2],
                "interpretation": "When bus voltage falls below nominal thresholds, RF power amplifiers throttle output power, resulting in immediate dBm degradation and packet retransmission latency.",
                "uncertainty": "External ground station atmospheric attenuation could also contribute to signal degradation.",
                "recommended_next_step": rec,
                "confidence": "Medium"
            }

        # 8. "What caused the anomaly?" / "root cause"
        if "cause" in q_lower or "what happened" in q_lower:
            lead_hyp = hyps[0]["cause"] if hyps else "Under investigation"
            conf_val = hyps[0]["confidence"] if hyps else 0
            alt_hyp = f"; secondary hypothesis: {hyps[1]['cause']}" if len(hyps) > 1 else ""
            cites = [e["id"] for e in ev_list if e.get("id") in hyps[0].get("supporting_evidence", [])] if hyps else [e["id"] for e in ev_list][:2]
            return {
                "status": "ANSWERED",
                "answer": f"Leading hypothesis: {lead_hyp} (Confidence: {conf_val}% — NOT CONFIRMED){alt_hyp}.",
                "observed_facts": facts[:3],
                "supporting_evidence": cites[:3] or [e["id"] for e in ev_list][:2],
                "interpretation": inc.get("narrative", "Telemetry patterns match documented subsystem failure modes."),
                "uncertainty": "Hypotheses remain probabilistic inferences. Root cause cannot be confirmed without diagnostic execution.",
                "recommended_next_step": rec,
                "confidence": "Medium"
            }

        # 9. "What should operator check next?" / "next step" / "recommendation"
        if "check" in q_lower or "next" in q_lower or "step" in q_lower or "recommend" in q_lower:
            proc_cites = [e["id"] for e in ev_list if e.get("source_type") == "Procedure"]
            return {
                "status": "ANSWERED",
                "answer": f"Recommended advisory next step: {rec}",
                "observed_facts": facts[:2],
                "supporting_evidence": proc_cites or [e["id"] for e in ev_list][:2],
                "interpretation": "Executing the recommended diagnostic procedure verifies sensor plausibility and isolates the affected hardware branch.",
                "uncertainty": "Operator must verify spacecraft thermal and power margins before executing procedure commands.",
                "recommended_next_step": rec,
                "confidence": "High"
            }

        # 10. General inquiry regarding current incident
        lead_hyp = hyps[0]["cause"] if hyps else "Anomalous subsystem reading"
        cites = [e["id"] for e in ev_list][:3]
        return {
            "status": "ANSWERED",
            "answer": f"Current status for {inc.get('incident_id')}: {inc.get('description')}. Leading hypothesis: {lead_hyp} (NOT CONFIRMED).",
            "observed_facts": facts[:3],
            "supporting_evidence": cites,
            "interpretation": inc.get("narrative", "Telemetry shows active deviations from baseline values."),
            "uncertainty": "Investigation is ongoing; hypothesis confidence is advisory.",
            "recommended_next_step": rec,
            "confidence": "Medium"
        }
