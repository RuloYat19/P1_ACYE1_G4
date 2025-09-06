import os
import time
import json
import threading
from datetime import datetime

try:
    import board
    import adafruit_dht
except Exception:
    board = None
    adafruit_dht = None

import paho.mqtt.client as mqtt

class DHTPublisher:
    def __init__(self, period=5.0):
        self.period = period
        self.mqtt_host = os.environ.get("MQTT_HOST", "9a9751de0a5f4cf48ef00e50f9450e27.s1.eu.hivemq.cloud")
        self.mqtt_port = int(os.environ.get("MQTT_PORT", "8883"))
        self.mqtt_user = os.environ.get("MQTT_USERNAME", "isaac")
        self.mqtt_pass = os.environ.get("MQTT_PASSWORD", "ArquiGrupo4")
        self.mqtt_client_id = os.environ.get("MQTT_CLIENT_ID", "raspberry-pi-sensor")
        self.client = None
        self._stop = threading.Event()
        self._thread = None

    def loop(self):
        if board is None or adafruit_dht is None:
            print("DHT libs not available")
            return
        dht = adafruit_dht.DHT11(board.D27)
        client = mqtt.Client(client_id=self.mqtt_client_id)
        client.username_pw_set(self.mqtt_user, self.mqtt_pass)
        client.tls_set()
        client.connect(self.mqtt_host, self.mqtt_port, 60)
        client.loop_start()
        self.client = client
        try:
            while not self._stop.is_set():
                try:
                    t = dht.temperature
                    h = dht.humidity
                except Exception as e:
                    time.sleep(self.period)
                    continue
                if t is not None and h is not None:
                    ts = datetime.now().isoformat()
                    temp_data = {"temperature": float(t), "location": "interior", "timestamp": ts, "device": "DHT11", "pin": "D27", "connected": True}
                    hum_data = {"humidity": float(h), "location": "interior", "timestamp": ts, "device": "DHT11", "pin": "27", "connected": True}
                    try:
                        client.publish("/temperatura", json.dumps(temp_data))
                        client.publish("/humedad_aire", json.dumps(hum_data))
                        print("Temp {:.1f}C Hum {:.1f}%".format(t, h))
                    except Exception:
                        pass
                time.sleep(self.period)
        finally:
            try:
                client.loop_stop()
                client.disconnect()
            except Exception:
                pass

    def start(self):
        self._stop.clear()
        t = threading.Thread(target=self.loop, daemon=True)
        t.start()
        self._thread = t

    def stop(self):
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2)

def main():
    svc = DHTPublisher()
    try:
        svc.start()
        while True:
            time.sleep(2.0)
    except KeyboardInterrupt:
        pass
    finally:
        svc.stop()

if __name__ == "__main__":
    main()
