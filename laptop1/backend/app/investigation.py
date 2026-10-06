import json, pathlib
from .models import Telemetry
DATA = pathlib.Path(__file__).resolve().parents[2] / "data" / "scenarios"
BASELINE = dict(temperature_a=45, temperature_b=44, temperature_c=45, bus_voltage=21.0, current=2.1, power=44,
                battery_soc=72, solar_generation=145, attitude_deviation=0.8, communication_signal=-62,
                communication_latency=120, payload_load=38)
def what_changed(t: Telemetry):
    out = []
    for k, b in BASELINE.items():
        v = getattr(t, k); pct = (v - b) / abs(b) * 100
        out.append(dict(parameter=k, baseline=b, current=v, change_pct=round(pct, 1), significant=abs(pct) >= 10))
    return out
def physics_check(t: Telemetry):
    exp = t.bus_voltage * t.current
    return dict(id="PHY-CHECK-002", expected_power=round(exp, 1), reported_power=t.power, passed=abs(exp - t.power) <= 0.15 * exp)
def subsystem_status(t: Telemetry):
    th = "ANOMALY" if max(t.temperature_a, t.temperature_b, t.temperature_c) > 75 else "NORMAL"
    return dict(power="NORMAL" if t.bus_voltage >= 19 and t.battery_soc >= 50 else "WARNING", thermal=th,
                attitude="NORMAL" if t.attitude_deviation < 5 else "WARNING",
                communication="NORMAL" if t.communication_signal > -90 else "WARNING",
                payload="NORMAL" if t.payload_load <= 50 else "WARNING")
LABELS = dict(temperature_a=("Temperature A","°C"),temperature_b=("Temperature B","°C"),temperature_c=("Temperature C","°C"),bus_voltage=("Bus Voltage","V"),current=("Current","A"),power=("Power","W"),
    battery_soc=("Battery SOC","%"),solar_generation=("Solar Generation","W"),attitude_deviation=("Attitude Deviation","°"),communication_signal=("Comm Signal","dBm"),communication_latency=("Comm Latency","ms"),payload_load=("Payload Load","W"))
