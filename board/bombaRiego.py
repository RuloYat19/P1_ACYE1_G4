import os
import time
import json
import threading

try:
    import RPi.GPIO as GPIO
except Exception:
    GPIO = None

import paho.mqtt.client as mqtt

class PumpService:
    def __init__(self, pump_pin=14):
        self.pump_pin = pump_pin
        self.mqtt_host = os.environ.get("MQTT_HOST", "9a9751de0a5f4cf48ef00e50f9450e27.s1.eu.hivemq.cloud")
        self.mqtt_port = int(os.environ.get("MQTT_PORT", "8883"))
        self.mqtt_user = os.environ.get("MQTT_USERNAME", "isaac")
        self.mqtt_pass = os.environ.get("MQTT_PASSWORD", "ArquiGrupo4")
        self.mqtt_client_id = os.environ.get("MQTT_CLIENT_ID", "raspberry-pi-pump")
        self.client = None
        self.pump_state = False
        self._stop = threading.Event()
        self._thread = None

    def _setup_gpio(self):
        if GPIO is None:
            return
        try:
            GPIO.setmode(GPIO.BCM)
            GPIO.setup(self.pump_pin, GPIO.OUT)
            GPIO.output(self.pump_pin, GPIO.LOW)
        except Exception:
            pass

    def _setup_mqtt(self):
        try:
            self.client = mqtt.Client(client_id=self.mqtt_client_id)
            try:
                self.client.username_pw_set(self.mqtt_user, self.mqtt_pass)
            except Exception:
                pass
            try:
                self.client.tls_set()
            except Exception:
                pass
            self.client.on_connect = self._on_connect
            self.client.on_message = self._on_message
            self.client.connect(self.mqtt_host, self.mqtt_port, 60)
            self.client.loop_start()
        except Exception:
            pass

    def _on_connect(self, client, userdata, flags, rc):
        try:
            client.subscribe("/pump")
        except Exception:
            pass

    def _on_message(self, client, userdata, msg):
        try:
            payload_str = msg.payload.decode()
        except Exception:
            return
        try:
            data = json.loads(payload_str)
        except Exception:
            data = {"state": payload_str.strip()}
        self._handle_command(data)

    def _handle_command(self, data):
        try:
            value = None
            if "state" in data:
                value = str(data["state"]).lower().strip()
            elif "pump" in data:
                value = str(data["pump"]).lower().strip()
            elif "command" in data:
                value = str(data["command"]).lower().strip()
            if value in ["on", "1", "true", "encendido", "activar"]:
                self.turn_on()
            elif value in ["off", "0", "false", "apagado", "desactivar"]:
                self.turn_off()
        except Exception:
            pass

    def turn_on(self):
        if GPIO is not None:
            try:
                GPIO.output(self.pump_pin, GPIO.HIGH)
            except Exception:
                pass
        self.pump_state = True
        self.publish_status()

    def turn_off(self):
        if GPIO is not None:
            try:
                GPIO.output(self.pump_pin, GPIO.LOW)
            except Exception:
                pass
        self.pump_state = False
        self.publish_status()

    def publish_status(self):
        if not self.client:
            return
        status = {
            "type": "pump",
            "device": "water_pump",
            "state": "on" if self.pump_state else "off",
            "status": self.pump_state,
            "pin": self.pump_pin,
            "timestamp": time.time()
        }
        try:
            self.client.publish("/pump/status", json.dumps(status))
        except Exception:
            pass

    def loop(self):
        self._setup_gpio()
        self._setup_mqtt()
        try:
            while not self._stop.is_set():
                time.sleep(1)
        finally:
            self.cleanup()

    def start(self):
        self._stop.clear()
        self._thread = threading.Thread(target=self.loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2)

    def cleanup(self):
        if GPIO and self.pump_state:
            try:
                GPIO.output(self.pump_pin, GPIO.LOW)
            except Exception:
                pass
        if GPIO:
            try:
                GPIO.cleanup()
            except Exception:
                pass
        if self.client:
            try:
                self.client.loop_stop()
                self.client.disconnect()
            except Exception:
                pass

def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--pin", type=int, default=14)
    parser.add_argument("--test", action="store_true")
    args = parser.parse_args()
    svc = PumpService(args.pin)
    if args.test:
        svc._setup_gpio()
        try:
            svc.turn_on()
            time.sleep(5)
            svc.turn_off()
        finally:
            svc.cleanup()
        return
    try:
        svc.start()
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        svc.stop()

if __name__ == "__main__":
    main()