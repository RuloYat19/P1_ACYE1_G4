import os
import time
import json
import threading

try:
    import RPi.GPIO as GPIO
except Exception:
    GPIO = None

import paho.mqtt.client as mqtt

class SoilPublisher:
    def __init__(self, period=5.0, pin=26):
        self.period = period
        self.pin = pin
        self.mqtt_host = os.environ.get("MQTT_HOST", "9a9751de0a5f4cf48ef00e50f9450e27.s1.eu.hivemq.cloud")
        self.mqtt_port = int(os.environ.get("MQTT_PORT", "8883"))
        self.mqtt_user = os.environ.get("MQTT_USERNAME", "isaac")
        self.mqtt_pass = os.environ.get("MQTT_PASSWORD", "ArquiGrupo4")
        self.mqtt_client_id = os.environ.get("MQTT_CLIENT_ID", "raspberry-pi-soil-sensor")
        self._stop = threading.Event()
        self._thread = None

    def loop(self):
        if GPIO is None:
            print("GPIO not available")
            return
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(self.pin, GPIO.IN)
        client = mqtt.Client(client_id=self.mqtt_client_id)
        client.username_pw_set(self.mqtt_user, self.mqtt_pass)
        client.tls_set()
        client.connect(self.mqtt_host, self.mqtt_port, 60)
        client.loop_start()
        try:
            while not self._stop.is_set():
                try:
                    v = GPIO.input(self.pin)
                except Exception:
                    time.sleep(self.period)
                    continue
                state = "seco" if int(v) == 1 else "humedo"
                data = {"soil_moisture_digital": int(v), "state": state, "pin": "GPIO{}".format(self.pin)}
                try:
                    client.publish("/humedad_suelo", json.dumps(data))
                    print("Soil {} ({})".format(int(v), state))
                except Exception:
                    pass
                time.sleep(self.period)
        finally:
            try:
                GPIO.cleanup()
            except Exception:
                pass
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
    svc = SoilPublisher()
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
