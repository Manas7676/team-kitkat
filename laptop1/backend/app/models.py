from pydantic import BaseModel
class Telemetry(BaseModel):
    """Shared contract: field names/units identical on Laptop 2. See docs/CONTRACT.md"""
    timestamp: str
    temperature_a: float; temperature_b: float; temperature_c: float   # degC
    bus_voltage: float; current: float; power: float                    # V, A, W
    battery_soc: float; solar_generation: float                         # %, W
    attitude_deviation: float                                           # deg
    communication_signal: float; communication_latency: float           # dBm, ms
    payload_load: float                                                 # W
