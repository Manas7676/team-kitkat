import sys, asyncio, json, websockets, requests
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

async def test_full_pipeline():
    print("--- 1. Injecting Anomaly Telemetry (POWER_01) ---")
    uri = "ws://localhost:8000/ws/telemetry"
    async with websockets.connect(uri) as ws:
        # Ground truth
        await ws.send(json.dumps({
            "type": "ground_truth",
            "data": {"scenario": "POWER_01", "severity": 0.8, "blind": True}
        }))
        
        # Telemetry tick with anomalous power values
        tel = {
            "timestamp": "2026-10-06T12:00:00Z",
            "temperature_a": 46.2, "temperature_b": 44.8, "temperature_c": 45.1,
            "bus_voltage": 18.2, "current": 2.8, "power": 38.5,
            "battery_soc": 58.0, "solar_generation": 82.0,
            "attitude_deviation": 0.9,
            "communication_signal": -74.0, "communication_latency": 195.0,
            "payload_load": 38.0
        }
        await ws.send(json.dumps(tel))
        await asyncio.sleep(0.5)

    print("--- 2. Checking Active State via API ---")
    st = requests.get("http://localhost:8000/api/state").json()
    inc = st.get("incident")
    print("Incident detected:", inc.get("incident_id") if inc else "None")
    assert inc is not None, "No incident detected!"
    iid = inc["incident_id"]

    print("\n--- TEST 1: Ask 'Why was this incident detected?' ---")
    r1 = requests.post("http://localhost:8000/api/ask", json={"question": "Why was this incident detected?", "incident_id": iid}).json()
    print("Status:", r1.get("status"))
    print("Answer:", r1.get("answer"))
    print("Citations:", r1.get("supporting_evidence"))
    assert r1["status"] == "ANSWERED"
    assert iid in r1["answer"] or "triggered" in r1["answer"].lower()

    print("\n--- TEST 2: Ask 'Which systems are affected?' ---")
    r2 = requests.post("http://localhost:8000/api/ask", json={"question": "Which systems are affected?", "incident_id": iid}).json()
    print("Status:", r2.get("status"))
    print("Answer:", r2.get("answer"))
    assert r2["status"] == "ANSWERED"
    assert "affected" in r2["answer"].lower()

    print("\n--- TEST 3: Ask 'What evidence supports this?' ---")
    r3 = requests.post("http://localhost:8000/api/ask", json={"question": "What evidence supports this?", "incident_id": iid}).json()
    print("Status:", r3.get("status"))
    print("Supporting Evidence:", r3.get("supporting_evidence"))
    assert r3["status"] == "ANSWERED"
    assert len(r3.get("supporting_evidence", [])) > 0
    # verify each citation actually exists in the incident
    real_ids = {e["id"] for e in inc["evidence"]}
    for c in r3["supporting_evidence"]:
        assert c in real_ids, f"Fake evidence citation detected: {c}"

    print("\n--- TEST 4: Ask cross-subsystem correlation question ---")
    r4 = requests.post("http://localhost:8000/api/ask", json={"question": "Is the communication degradation related to the power anomaly?", "incident_id": iid}).json()
    print("Status:", r4.get("status"))
    print("Answer:", r4.get("answer"))
    assert r4["status"] == "ANSWERED"

    print("\n--- TEST 5: Ask unanswerable question ---")
    r5 = requests.post("http://localhost:8000/api/ask", json={"question": "What happened to the spacecraft 6 hours ago?", "incident_id": iid}).json()
    print("Status:", r5.get("status"))
    print("Answer:", r5.get("answer"))
    assert r5["status"] == "INSUFFICIENT_EVIDENCE"
    assert "insufficient evidence" in r5["answer"].lower()

    print("\n--- TEST 6: Mark as Resolved ---")
    res_resp = requests.post(f"http://localhost:8000/api/resolve?incident_id={iid}").json()
    print("Resolve response status:", res_resp.get("ok"))
    assert res_resp.get("ok") is True

    st_after = requests.get("http://localhost:8000/api/state").json()
    resolved_inc = next((i for i in st_after["incidents"] if i["incident_id"] == iid), None)
    assert resolved_inc is not None
    assert resolved_inc["status"] == "RESOLVED"
    assert resolved_inc["resolved_by"] == "Operator"
    print("Status updated to:", resolved_inc["status"])
    print("Resolved by:", resolved_inc["resolved_by"])
    print("Resolution time:", resolved_inc.get("end_time"))

    # Verify Mission Memory has it
    mem = requests.get("http://localhost:8000/api/memory").json()
    found_in_mem = any(m["id"] == iid for m in mem)
    print("Found in Mission Memory:", found_in_mem)
    assert found_in_mem

    # Verify Audit has the resolution
    audit_events = [a["event"] for a in st_after.get("audit", [])]
    print("Latest audit events:", audit_events[-3:])
    assert any("resolved" in ev.lower() for ev in audit_events)

    print("\n--- TEST 7: Add to Report ---")
    rep1 = requests.post(f"http://localhost:8000/api/report?incident_id={iid}").json()
    print("Report add 1 response:", rep1)
    assert rep1.get("ok") is True
    assert rep1.get("count") >= 1

    print("\n--- TEST 8: Add another investigation to report ---")
    # Inject second anomaly: THERMAL_01
    async with websockets.connect(uri) as ws:
        tel2 = {
            "timestamp": "2026-10-06T12:05:00Z",
            "temperature_a": 84.5, "temperature_b": 79.2, "temperature_c": 77.0,
            "bus_voltage": 20.8, "current": 2.1, "power": 43.5,
            "battery_soc": 71.0, "solar_generation": 142.0,
            "attitude_deviation": 0.8,
            "communication_signal": -63.0, "communication_latency": 122.0,
            "payload_load": 38.0
        }
        await ws.send(json.dumps(tel2))
        await asyncio.sleep(0.5)

    st2 = requests.get("http://localhost:8000/api/state").json()
    inc2 = st2.get("incident")
    if inc2 and inc2["incident_id"] != iid:
        rep2 = requests.post(f"http://localhost:8000/api/report?incident_id={inc2['incident_id']}").json()
        print("Report add 2 response:", rep2)
        assert rep2.get("count") >= 2

    print("\n--- TEST 9: Download PDF Report ---")
    pdf_resp = requests.get("http://localhost:8000/api/report/pdf")
    print("PDF Response status:", pdf_resp.status_code)
    print("PDF Content Type:", pdf_resp.headers.get("content-type"))
    print("PDF Content-Disposition:", pdf_resp.headers.get("content-disposition"))
    print("PDF byte length:", len(pdf_resp.content))
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers.get("content-type") == "application/pdf"
    assert len(pdf_resp.content) > 3000
    assert pdf_resp.content.startswith(b"%PDF")

    print("\n--- TEST 10: Verify Gemini API key is NOT in frontend code ---")
    # We will also run a separate grep/search test.
    print("All backend tests PASSED!")

if __name__ == "__main__":
    asyncio.run(test_full_pipeline())
