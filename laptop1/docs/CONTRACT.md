# Shared contract (Laptop 1 <-> Laptop 2)
Telemetry fields (units): timestamp (ISO UTC), temperature_a/b/c (C), bus_voltage (V), current (A), power (W),
battery_soc (%), solar_generation (W), attitude_deviation (deg), communication_signal (dBm), communication_latency (ms), payload_load (W).
Scenario IDs: THERMAL_01, POWER_01, NOISE_01, ATTITUDE_01, COMM_01, PAYLOAD_01, CASCADE_01 (nominal = baseline).
Status values: NORMAL, WARNING, ANOMALY (AFFECTED in impact view). Message types: telemetry, snapshot, ground_truth.
Blind mode: the simulator omits the ground_truth message; Laptop 1 only sees telemetry.
