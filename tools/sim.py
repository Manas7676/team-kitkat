"""ST-10 Laptop 2 telemetry generator. Usage: python sim.py --scenario THERMAL_01 --severity 0.7 --after 10 [--blind]"""
import asyncio, json, argparse, random, datetime, os, websockets
N = dict(temperature_a=45, temperature_b=44, temperature_c=45, bus_voltage=21.0, current=2.1, battery_soc=72,
         solar_generation=145, attitude_deviation=0.8, communication_signal=-62, communication_latency=120, payload_load=38)
def gen(sc, s, k):
    d = dict(N); r = lambda a: random.uniform(-a, a); e = s * min(1, max(k, 0) / 8)   # ramp over 8 s
    if sc == "THERMAL_01": d["temperature_a"] += 55 * e
    elif sc == "POWER_01": d["solar_generation"] *= 1 - .5 * e; d["battery_soc"] -= 30 * e; d["bus_voltage"] -= 3.5 * e
    elif sc == "NOISE_01":
        for key in ("temperature_a","temperature_b","temperature_c"): d[key] += r(12 * e)
        d["bus_voltage"] += r(.8 * e)
    elif sc == "ATTITUDE_01": d["attitude_deviation"] += 9 * e
    elif sc == "COMM_01": d["communication_signal"] -= 40 * e; d["communication_latency"] += 900 * e
    elif sc == "PAYLOAD_01": d["payload_load"] += 40 * e; d["battery_soc"] -= 12 * e; d["current"] += .8 * e
    elif sc == "CASCADE_01":
        d["solar_generation"] *= 1 - .6 * e; d["battery_soc"] -= 28 * e; d["bus_voltage"] -= 3 * e
        d["payload_load"] -= 15 * e; d["communication_signal"] -= 25 * e; d["communication_latency"] += 500 * e
    for key in d: d[key] += r(.01 * abs(N[key]))
    d["power"] = d["bus_voltage"] * d["current"]
    d["timestamp"] = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    return {k: (round(v, 2) if k != "timestamp" else v) for k, v in d.items()}
async def main(a):
    while True:
        try:
            async with websockets.connect(a.url) as ws:
                if not a.blind: await ws.send(json.dumps(dict(type="ground_truth", data=dict(scenario=a.scenario, severity=a.severity))))
                t = 0
                while True:
                    await ws.send(json.dumps(gen(a.scenario if t >= a.after else "NOMINAL", a.severity, t - a.after)))
                    t += 1; await asyncio.sleep(1)
        except Exception as ex: print("reconnecting:", ex); await asyncio.sleep(2)
p = argparse.ArgumentParser()
p.add_argument("--url", default=os.getenv("ST10_WS_URL", "ws://127.0.0.1:8000/ws/telemetry"))
p.add_argument("--scenario", default="THERMAL_01"); p.add_argument("--severity", type=float, default=.7)
p.add_argument("--after", type=int, default=10); p.add_argument("--blind", action="store_true")
asyncio.run(main(p.parse_args()))
